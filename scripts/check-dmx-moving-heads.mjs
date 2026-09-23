import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'wiz-dj-connection-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);
    chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.once('exit',()=>{clearTimeout(timer);reject(Error('Chrome exited'));});
  });
  ws=new WebSocket(endpoint);await once(ws,'open');
  let next=1;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  });
  const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  await c('Runtime.enable');await c('Page.enable');
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/Inspected target navigated or closed|Cannot find context|Execution context was destroyed/.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click()");
  assert.equal(await evaluate("document.querySelector('#stageMovingHeads').hidden"),true);
  await evaluate("document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click()");
  await wait("Number(document.querySelector('.stage-moving-head').style.getPropertyValue('--stage-power'))>0");
  assert.equal(await evaluate("document.querySelectorAll('.stage-moving-head').length"),4);
  const activity=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const heads=createMovingHeads(scene,controls);
    const frame={state:true,r:255,g:80,b:0,dimming:60};
    const read=()=>[...scene.querySelectorAll('.stage-moving-head')].map(n=>Number(n.style.getPropertyValue('--stage-power')));
    const output=[];
    for(const look of ['held','flow','peak']){
      const streams=[{frame,weight:1,look}];
      const fixtures=decodeStage(encodeStage(automaticStage(streams,2).frames));
      heads.update(fixtures,frame,0,false,streams,'auto');output.push(read());
    }
    heads.update([],frame,0,false,[{frame,weight:1,look:'flow'}],'auto');output.push(read());
    heads.update([],frame,0,true,[{frame,weight:1,look:'flow'}],'auto');output.push(read());
    heads.destroy();return output;
  })()`);
  assert.deepEqual(activity.map(values=>values.filter(v=>v===0).length),[2,2,1,2,4]);
  const pan=await evaluate("document.querySelector('.stage-moving-head').style.getPropertyValue('--head-pan')");
  await wait(`document.querySelector('.stage-moving-head').style.getPropertyValue('--head-pan')!==${JSON.stringify(pan)}`);
  for(const [width,height] of [[1280,800],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
    await writeFile(new URL(`../reports/dmx-moving-heads-${width}.png`,import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("document.querySelector('#stageSettings').click();document.querySelector('[data-blackout]').click()");
  assert.ok(await evaluate("[...document.querySelectorAll('.stage-moving-head')].every(n=>Number(n.style.getPropertyValue('--stage-power'))===0)"));
  await evaluate("document.querySelector('[data-blackout]').click();document.querySelector('[data-demo]').click()");
  assert.ok(await evaluate("[...document.querySelectorAll('.stage-moving-head')].every(n=>Number(n.style.getPropertyValue('--stage-power'))===0)"));
  await reload();await wait("document.querySelector('#stageMovingHeads')&&!document.querySelector('#stageMovingHeads').hidden");
  await evaluate("document.querySelector('[data-moving-heads]').click()");
  assert.equal(await evaluate("document.querySelector('#stageMovingHeads').hidden"),true);
  await reload();await wait("document.querySelector('#stageMovingHeads')");
  assert.equal(await evaluate("document.querySelector('#stageMovingHeads').hidden"),true);
  await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click()");
  await wait("Number(document.querySelector('.stage-moving-head').style.getPropertyValue('--stage-power'))>0");
  assert.equal(await evaluate("document.querySelector('.stage-moving-head').style.getPropertyValue('--head-pan')"),await evaluate("(async()=>{const {projectMovingHeads,stageLayout}=await import('/dmx-layout-model.js');const {restingHeads}=await import('/dmx-moving-model.js');return projectMovingHeads(stageLayout(),restingHeads())[0].frontPan.toFixed(2)+'deg';})()"));
  await c('Emulation.setEmulatedMedia',{features:[]});
  // Exercise real stream metadata directly through the renderer, independently
  // of audio playback and the demo clock.
  const musical=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const simulation=createMovingHeads(scene,controls);
    const frame={state:true,r:255,g:60,b:0,dimming:80};
    const stream={frame,weight:1,beat:3,motionBeat:3,look:'peak',accentStrength:.7};
    let time=0;
    const update=(sources,blackout=false)=>simulation.update([],frame,time+=.05,blackout,sources,'auto');
    const pan=()=>Number.parseFloat(scene.querySelector('.stage-moving-head').style.getPropertyValue('--head-pan'));
    for(let i=0;i<100;i++)update([stream]);
    const first=pan();
    for(let i=0;i<100;i++)update([{...stream,beat:70}]);
    const motif=pan();
    for(let i=0;i<100;i++)update([{...stream,motionBeat:7}]);
    const moved=pan();
    update([{...stream,motionBeat:100}],true);
    const held=pan(),dark=scene.querySelector('.stage-moving-head').style.getPropertyValue('--stage-power');
    for(let i=0;i<100;i++)update([{...stream,beat:null,motionBeat:null}]);
    const noGrid=pan();
    simulation.destroy();
    return {first,motif,moved,held,dark,noGrid,clean:scene.children.length===0&&controls.children.length===0};
  })()`);
  assert.ok(Math.abs(musical.first-musical.motif)<.02);
  assert.ok(Math.abs(musical.moved-musical.first)>1);
  assert.equal(musical.held,musical.moved);assert.equal(musical.dark,'0');
  assert.ok(Math.abs(musical.noGrid+18)<.02);assert.equal(musical.clean,true);
  const preparedSong=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const plan={duration:300,beatGrid:{beats:Array.from({length:601},(_,i)=>i/2)},sections:Array.from({length:19},(_,i)=>({start:i*16,end:Math.min(300,(i+1)*16),look:['held','flow','lift','peak'][i%4]}))};
    const started=performance.now();
    const simulation=createMovingHeads(scene,controls,{getPlans:()=>[plan]});
    try{
      const deadline=started+10000;
      while(!scene.querySelector('.stage-moving-title').textContent.includes('Choreografie bereit')){
        if(performance.now()>deadline)throw Error('Song preparation timeout');
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      const preparationMs=performance.now()-started;
      const frame={state:true,r:255,g:80,b:0,dimming:80};let time=0;
      const sample=(songTime,beat,light=frame)=>{
        for(let i=0;i<100;i++)simulation.update([],light,time+=.05,false,[{frame:light,weight:1,movingPlan:plan,songTime,beat,look:'peak'}],'auto');
        return Number.parseFloat(scene.querySelector('.stage-moving-head').style.getPropertyValue('--head-pan'));
      };
      const first=sample(55,0),repeat=sample(55,100),later=sample(58,100),seekBack=sample(55,800);
      const dark=sample(58,100,{...frame,dimming:0});
      const power=scene.querySelector('.stage-moving-head').style.getPropertyValue('--stage-power');
      const paused=sample(55,0,null);
      return {preparationMs,first,repeat,later,seekBack,dark,power,paused};
    }finally{simulation.destroy();}
  })()`);
  assert.ok(Math.abs(preparedSong.first-preparedSong.repeat)<.02);
  assert.ok(Math.abs(preparedSong.first-preparedSong.seekBack)<.02);
  assert.ok(Math.abs(preparedSong.first-preparedSong.later)>1);
  assert.ok(Math.abs(preparedSong.dark-preparedSong.later)<.02);
  assert.equal(preparedSong.power,'0');assert.equal(preparedSong.paused,preparedSong.dark);
  console.log('Five-minute synthetic song, cooperative browser preparation: '+Math.round(preparedSong.preparationMs)+' ms.');
  assert.deepEqual(await evaluate("[...document.querySelector('#djShowProfile').options].map(o=>o.textContent)"),['Automatisch','Party','Disco','Ruhig','Atmosphärisch']);
  assert.equal(await evaluate("document.querySelector('[data-moving-mood-control]')===null"),true);
  assert.ok(await evaluate("document.querySelector('#djShowProfile').closest('.dj-light-settings')!==null"));
  await evaluate("document.querySelector('.dj-light-settings').open=true;const mood=document.querySelector('#djShowProfile');mood.value='atmospheric';mood.dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),'atmospheric');
  await reload();await wait("document.querySelector('#djShowProfile')");
  assert.equal(await evaluate("document.querySelector('#djShowProfile').value"),'atmospheric');
  assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),'atmospheric');
  await evaluate("document.querySelector('[data-moving-heads]').click();const mood=document.querySelector('#djShowProfile');mood.value='calm';mood.dispatchEvent(new Event('change'))");
  await reload();await wait("document.querySelector('#djShowProfile')");
  assert.equal(await evaluate("document.querySelector('#djShowProfile').value"),'calm');
  assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),'calm');
  assert.equal(await evaluate("document.querySelector('[data-moving-heads]').getAttribute('aria-pressed')"),'false');
  assert.ok(!requests.some(url=>/^\/api\/dmx\/(start|frame)(?:\?|$)/.test(url)));
  assert.deepEqual(errors,[]);console.log('Moving heads passed: toggle, animation, light, blackout, stop, persistence, reduced motion and responsive layouts.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
