// Reproduce authored color pauses separately from browser scheduling delays.
// Run: node scripts/check-light-animation-timing.mjs [output.json]
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
  const result=await evaluate(`(async()=>{
    const {startShowClock}=await import('/show-clock.js');
    const {automaticStage}=await import('/dmx-auto.js');
    const times=Array.from({length:40},(_,i)=>i*.5),plan={arrangement:{times,patterns:{events:times.map(()=>({driving:true})),phrases:[{start:0,end:20,kind:'bounce',movement:{character:'rhythmic',driving:1,rate:2}}]}}};
    const began=performance.now(),ticks=[],frames=[],costs=[];let previous=null,unchanged=0,longest=0,live=true,lastFrame;
    const read=()=>[{key:'song',time:(performance.now()-began)/1000,playing:true,rate:1,weight:1,beats:times}];
    const stop=startShowClock(read,()=>{
      const now=performance.now();ticks.push(now);const source={movingPlan:plan,songTime:(now-began)/1000,look:'peak',weight:1,frame:{state:true,r:255,g:40,b:0,dimming:60}};
      const colors=automaticStage([source],2).frames.slice(0,4).flat().map(f=>[f.r,f.g,f.b]);
      const signature=JSON.stringify(colors);
      if(signature===previous)unchanged++;else {longest=Math.max(longest,unchanged);unchanged=0;}previous=signature;costs.push(performance.now()-now);
    },16);
    function frame(t){if(!live)return;if(lastFrame!==undefined)frames.push(t-lastFrame);lastFrame=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
    await new Promise(r=>setTimeout(r,8000));stop();live=false;
    const stats=xs=>{const a=[...xs].sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:Math.max(...a),over25:a.filter(x=>x>25).length,over50:a.filter(x=>x>50).length};};
    // Ideal-time sampling separates authored pauses from scheduling stalls.
    const pauses=[];let start=null,prior;
    for(let t=1;t<7;t+=.01){const color=JSON.stringify(automaticStage([{movingPlan:plan,songTime:t,look:'peak',weight:1,frame:{state:true,r:255,g:40,b:0,dimming:60}}],2).frames.slice(0,4).flat().map(f=>[f.r,f.g,f.b]));
      if(color===prior){if(start===null)start=t-.01;}else if(start!==null){if(t-start>.15)pauses.push({start:+start.toFixed(2),duration:+(t-start).toFixed(2)});start=null;}prior=color;}
    return {displayFrames:stats(frames),previewUpdates:stats(ticks.slice(1).map((t,i)=>t-ticks[i])),stageCalculation:stats(costs),longestUnchangedUpdates:longest,idealTimeColorPauses:pauses};
  })()`);
  assert.deepEqual(result.idealTimeColorPauses,[],'rolling colors must not freeze between musical steps');
  console.log(JSON.stringify(result,null,2));
  await writeFile(process.argv[2]||'/tmp/anydj-animation-lag.json',JSON.stringify(result,null,2)+'\n');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
