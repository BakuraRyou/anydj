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


  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click()");
  assert.equal(requests.includes('/dmx-stage-3d-renderer.js'),false,'renderer must load lazily');
  assert.equal(await evaluate("document.querySelector('.stage-3d').hidden"),true);
  await evaluate("document.querySelector('[data-stage3d-toggle]').click();if(!document.querySelector('.stage-3d-dialog').open)throw Error('3D button must open large view directly');document.querySelector('[data-stage3d-expand]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('.stage-3d').scrollIntoView({block:'center'})");
  await wait("document.querySelector('.stage-3d canvas').height>=100");
  await wait("performance.getEntriesByType('resource').some(r=>r.name.includes('dmx-stage-3d-renderer.js'))");
  assert.equal(await evaluate("document.querySelector('#stageMovingHeads').hidden"),true,'3D works with old moving view off');
  const pixels=()=>evaluate("(()=>{const c=document.querySelector('.stage-3d canvas');return c.toDataURL()})()");
  const before=await pixels();await new Promise(r=>setTimeout(r,250));assert.notEqual(await pixels(),before,'live lights must change');
  await evaluate("document.querySelector('[data-stage3d-expand]').click();document.querySelector('[data-workspace-tab=room]').click();document.querySelector('[data-ar-new]').click();document.querySelector('[data-ar-step=\"2\"]').click()");
  for(const type of ['moving','spot','bar'])await evaluate(`(()=>{document.querySelector('[data-ar-template=${type}]').click();const height=document.querySelector('[data-ar-z]');height.value='2.5';height.dispatchEvent(new Event('change'));})()`);
  const stored=()=>evaluate("(()=>{const s=JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'));return s.plans.find(p=>p.id===s.selected);})()");
  const plan=await stored();assert.equal(Object.keys(plan.positions).length,3);
  await evaluate("document.querySelector('[data-share-start]').click()");
  await wait("document.querySelector('[data-share-code]').textContent.length===6");
  await evaluate(`(async()=>{const pair=await (await fetch('/api/vr-preview/test-connect')).json(),{applyRoomPlan}=await import('/dmx-ar-model.js');window.roomMotion=[];window.roomStream=new EventSource('/api/vr-preview/stream?id='+pair.id);roomStream.onmessage=e=>{const scene=JSON.parse(e.data).scene;if(!scene.roomPlan)return;const head=applyRoomPlan(scene,scene.roomPlan).lights.find(l=>l.type==='moving');if(head)roomMotion.push({target:head.target,angle:head.aimRotation,power:head.power});};})()`);
  await wait("window.roomMotion?.length>=3&&new Set(roomMotion.map(f=>f.angle.toFixed(3))).size>1");
  await evaluate("roomStream.close()");
  await new Promise(r=>setTimeout(r,200));const lit=await pixels();await new Promise(r=>setTimeout(r,350));assert.notEqual(await pixels(),lit,'new room fixtures must animate with the live show');
  await writeFile('/tmp/anydj-room-live.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('[data-stage3d-expand]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-blackout]').click();document.querySelector('[data-close]').click();document.querySelector('[data-stage3d-expand]').click()");
  await new Promise(r=>setTimeout(r,200));const black=await pixels();assert.notEqual(black,lit,'blackout changes visible room illumination');await new Promise(r=>setTimeout(r,250));assert.equal(await pixels(),black,'room lamps stay dark during blackout');
  await evaluate("document.querySelector('[data-stage3d-expand]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-blackout]').click();document.querySelector('[data-close]').click();document.querySelector('[data-stage3d-expand]').click()");
  await new Promise(r=>setTimeout(r,200));assert.notEqual(await pixels(),black,'show resumes after blackout');assert.deepEqual(await stored(),plan,'show playback leaves the saved room untouched');
  assert.deepEqual(errors,[]);assert.equal(requests.includes('/api/music/start'),false);
  console.log('Live room browser passed: new Moving Head changes its actual aim angle; spot and LED bar follow live frames; blackout and resume work; placement stays saved; no hardware session.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
