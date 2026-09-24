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
    const restPlan={sections:[{start:0,end:4,look:'flow',intensity:.7},{start:4,end:10,look:'held',intensity:.2}]};
    const buildPlan={sections:[{start:0,end:10,look:'lift'}],arrangement:{drama:{step:.5,intensity:[.1,.1,.1,.1,.2,.3,.4,.4,.4,.4,.5,.6,.7,.8,.9,.9,.9,.9,.9,.9]}}};
    for(const [movingPlan,songTime,look] of [[restPlan,6,'held'],[buildPlan,1,'lift'],[buildPlan,8,'lift']]){
      const streams=[{frame,weight:1,look,movingPlan,songTime}];
      const fixtures=decodeStage(encodeStage(automaticStage(streams,2).frames));
      heads.update(fixtures,frame,0,false,streams,'auto');output.push(read());
    }
    heads.destroy();return output;
  })()`);
  assert.deepEqual(activity.map(values=>values.filter(v=>v===0).length),[0,0,0,0,4,0,0,0]);
  for(const [index,levels] of activity.entries()){if(index===6)continue;assert.equal(levels[0],levels[3]);assert.equal(levels[1],levels[2]);}
  const musicalStop=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const simulation=createMovingHeads(scene,controls),frame={state:true,r:255,g:60,b:0,dimming:50};
    const movingPlan={arrangement:{blackouts:[{start:3,end:3.6}]}};
    const results=[];
    for(const spots of [3,4])for(const songTime of [2.9,3.2,3.59,3.6]){
      const equipment={devices:Array.from({length:spots},(_,i)=>({id:String(i),type:'spot',cells:1}))};
      const streams=[{frame,weight:1,look:'flow',movingPlan,songTime}];
      const fixtures=decodeStage(encodeStage(automaticStage(streams,2,equipment).frames,equipment),equipment);
      simulation.update(fixtures,frame,songTime,false,streams,'auto');
      results.push([...scene.querySelectorAll('.stage-moving-head')].map(n=>Number(n.style.getPropertyValue('--stage-power'))));
    }
    simulation.destroy();return results;
  })()`);
  for(const offset of [0,4]){
    assert.ok(musicalStop[offset].every(v=>v>0));
    assert.deepEqual(musicalStop[offset+1],[0,0,0,0]);
    assert.deepEqual(musicalStop[offset+2],[0,0,0,0]);
    assert.ok(musicalStop[offset+3].every(v=>v>0));
  }
  const sustainedRest=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div'),simulation=createMovingHeads(scene,controls);
    const zero=Array(220).fill(0),other=zero.map((_,i)=>i<40||i>=180?.2:.015);
    const movingPlan={structure:{instruments:{step:.1,drums:zero,bass:zero,vocals:zero,other}},arrangement:{}};
    const frame={state:true,r:255,g:60,b:0,dimming:30},results=[];
    for(const spots of [3,4])for(const songTime of [3,5,10,17.9,18]){
      const equipment={devices:Array.from({length:spots},(_,i)=>({id:String(i),type:'spot',cells:1}))};
      const streams=[{frame,weight:1,look:songTime>=4&&songTime<18?'held':'peak',movingPlan,songTime}];
      simulation.update(decodeStage(encodeStage(automaticStage(streams,2,equipment).frames,equipment),equipment),frame,songTime,false,streams,'auto');
      results.push([...scene.querySelectorAll('.stage-moving-head')].map(n=>Number(n.style.getPropertyValue('--stage-power'))));
    }
    simulation.destroy();return results;
  })()`);
  for(const offset of [0,5]){
    assert.ok(sustainedRest[offset].every(v=>v>0));
    for(const index of [1,2,3])assert.deepEqual(sustainedRest[offset+index],[0,0,0,0]);
    assert.ok(sustainedRest[offset+4].every(v=>v>0));
  }
  const finalFade=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div'),simulation=createMovingHeads(scene,controls);
    const intensity=Array.from({length:100},(_,i)=>i<20?.4:i<75?.4-.3*(i-20)/55:.1);
    const movingPlan={sections:[{start:0,end:10,look:'flow'}],arrangement:{drama:{step:.1,intensity},patterns:{phrases:[{start:0,end:10,movement:{character:'atmospheric'}}]}}};
    const frame={state:true,r:255,g:60,b:0,dimming:30},results=[];
    for(const songTime of [2,6.5,8.5,9.9,10]){
      const streams=[{frame,weight:1,look:'flow',movingPlan,songTime}];
      simulation.update(decodeStage(encodeStage(automaticStage(streams,2).frames)),frame,songTime,false,streams,'auto');
      results.push([...scene.querySelectorAll('.stage-moving-head')].map(n=>Number(n.style.getPropertyValue('--stage-power'))));
    }
    simulation.destroy();return results;
  })()`);
  assert.equal(finalFade[1].filter(v=>v>0).length,1);
  assert.ok(Math.max(...finalFade[1])<Math.max(...finalFade[0]));
  assert.deepEqual(finalFade[2],[0,0,0,0]);assert.deepEqual(finalFade[3],[0,0,0,0]);
  assert.ok(finalFade[4].every(v=>v>0));
  const quietBuild=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const simulation=createMovingHeads(scene,controls),zero=Array(120).fill(0);
    const movingPlan={sections:[{start:0,end:12,look:'lift'}],arrangement:{drama:{step:.1,intensity:zero},patterns:{phrases:[{start:0,end:12}]}},structure:{instruments:{step:.1,drums:zero,bass:zero,vocals:zero,other:zero.map((_,i)=>i<25?.08-i*.001:i<40?.055:i<90?.055+(i-40)*.004:.255)}}};
    const frame={state:true,r:255,g:40,b:0,dimming:40},result=[];
    for(const songTime of [3,5,8,11]){
      const streams=[{frame,weight:1,movingPlan,songTime,look:'lift'}];
      simulation.update(decodeStage(encodeStage(automaticStage(streams,2).frames)),frame,songTime,false,streams,'auto');
      result.push([...scene.querySelectorAll('.stage-moving-head')].map(n=>Number(n.style.getPropertyValue('--stage-power'))));
    }
    simulation.destroy();return result;
  })()`);
  const quietPower=quietBuild.map(heads=>heads.reduce((sum,v)=>sum+v,0));
  assert.ok(quietPower[1]>quietPower[0]+.03);
  assert.ok(quietPower[2]>quietPower[1]+.05);
  assert.ok(quietBuild[3].every(v=>v>0));
  const colorGroups=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div');
    const simulation=createMovingHeads(scene,controls);
    const frame={state:true,r:255,g:40,b:0,dimming:60};
    const movingPlan={colorDirection:{events:[0,8,16,24].map(time=>({time,reason:'sound-change'}))}};
    const results=[];
    for(const spots of [4,2,3,5,6,7,8,'bar-7','bar-8'])for(const songTime of [1,8.7,16.7,24.7]){
      const equipment={devices:typeof spots==='number'?Array.from({length:spots},(_,i)=>({id:String(i),type:'spot',cells:1})):[{id:'bar',type:'bar',cells:Number(spots.slice(4))}]};
      const streams=[{frame,weight:1,look:'peak',movingPlan,songTime}];
      const fixtures=decodeStage(encodeStage(automaticStage(streams,2,equipment).frames,equipment),equipment);
      simulation.update(fixtures,frame,songTime,false,streams,'auto');
      const colors=[...scene.querySelectorAll('.stage-moving-head')].map(n=>n.style.getPropertyValue('--stage-beam-color'));
      results.push(colors.map(color=>colors.indexOf(color)));
    }
    simulation.destroy();return results;
  })()`);
  for(const offset of [0,4,8,12,16,20,24,28,32])assert.deepEqual(colorGroups.slice(offset,offset+4),[[0,1,0,1],[0,0,2,2],[0,1,1,0],[0,1,0,1]]);
  const rollingPreview=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const {encodeStage,decodeStage}=await import('/dmx-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div'),simulation=createMovingHeads(scene,controls);
    const times=Array.from({length:20},(_,i)=>i*.5),frame={state:true,r:255,g:40,b:0,dimming:60};
    const movingPlan={arrangement:{times,patterns:{events:times.map(()=>({driving:true})),phrases:[{start:0,end:10,kind:'bounce',movement:{character:'rhythmic',driving:1,rate:2}}]}}};
    const results=[];
    for(const songTime of [1,1.15,1.3]){
      const streams=[{frame,weight:1,look:'peak',movingPlan,songTime}];
      simulation.update(decodeStage(encodeStage(automaticStage(streams,2).frames)),frame,songTime,false,streams,'auto');
      results.push([...scene.querySelectorAll('.stage-moving-head')].map(n=>n.style.getPropertyValue('--stage-beam-color')));
    }
    simulation.destroy();return results;
  })()`);
  assert.notDeepEqual(rollingPreview[0],rollingPreview[1]);
  assert.notDeepEqual(rollingPreview[1],rollingPreview[2]);
  const formation=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {stageLayout}=await import('/dmx-layout-model.js');
    const scene=document.createElement('div'),controls=document.createElement('div'),layout=stageLayout();
    const times=Array.from({length:48},(_,i)=>i*.5);
    const plan={duration:24,sections:[{start:0,end:24,look:'peak'}],beatGrid:{beats:times},arrangement:{times,accents:times.map(()=>.6),patterns:{events:times.map(()=>({kind:'bounce',driving:true})),phrases:[{start:0,end:24,section:0,energy:.8,tone:.5,movement:{character:'rhythmic',driving:1}}]}}};
    const simulation=createMovingHeads(scene,controls,{getPlans:()=>[plan],getLayout:()=>layout});
    simulation.setMood('disco');
    const deadline=performance.now()+5000;
    while(!scene.textContent.includes('Choreografie bereit')){
      if(performance.now()>deadline)throw Error('Formation preparation timed out');
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    const frame={state:true,r:255,g:60,b:0,dimming:80};
    let independent=0,total=0;
    for(let t=0;t<18;t+=.025){
      simulation.update([],frame,t,false,[{frame,weight:1,movingPlan:plan,songTime:t,look:'peak'}],'auto');
      if(t<3)continue;
      const poses=[...scene.querySelectorAll('.stage-moving-head')].map(n=>({pan:parseFloat(n.style.getPropertyValue('--head-pan')),tilt:parseFloat(n.style.getPropertyValue('--head-tilt'))}));
      const linked=([a,b])=>Math.abs(poses[a].pan+poses[b].pan)<.1&&Math.abs(poses[a].tilt-poses[b].tilt)<.002;
      independent+=!linked([0,3])&&!linked([1,2]);total++;
    }
    simulation.setMood('balanced');simulation.destroy();return independent/total;
  })()`);
  assert.ok(formation>.8,'disco moving heads must not stay locked into inner and outer pairs');
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
