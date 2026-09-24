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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('[data-stage3d-toggle]').click()");
  await wait("document.querySelector('.stage-3d-dialog')?.open");
  await evaluate("document.querySelector('[data-workspace-tab=fixtures]').click();for(var i=0;i<12;i++)document.querySelector('[data-add-spot]').click()");
  await c('Performance.enable');
  await new Promise(r=>setTimeout(r,500));
  const metrics=async()=>Object.fromEntries((await c('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const before=await metrics();
  const mutations=await evaluate(`new Promise(resolve=>{
    const body=document.querySelector('.stage-3d-inspector-body'),map=document.querySelector('[data-layout-map]');let changes=0,frames=0;
    const observer=new MutationObserver(records=>changes+=records.length);observer.observe(map,{subtree:true,attributes:true,childList:true});
    const start=performance.now();function step(now){body.scrollTop=(.5+.5*Math.sin((now-start)/350))*(body.scrollHeight-body.clientHeight);frames++;if(now-start<3000)requestAnimationFrame(step);else{observer.disconnect();resolve({changes,frames});}}requestAnimationFrame(step);
  })`);
  const after=await metrics(),result={...mutations};for(const key of ['TaskDuration','LayoutDuration','RecalcStyleDuration','ScriptDuration','LayoutCount','RecalcStyleCount'])result[key]=after[key]-before[key];
  assert.deepEqual(errors,[]);
  assert.ok(result.LayoutCount<1500,'scrolling must not trigger per-device layout flushes');
  assert.ok(result.changes<30000,'unchanged SVG attributes must not be rewritten each tick');
  console.log(JSON.stringify(result,null,2));
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
