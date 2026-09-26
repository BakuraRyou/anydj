import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0});
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");



  const stored=()=>evaluate("JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'))");
  const change=async(name,value)=>evaluate(`{const input=document.querySelector('[data-ar-${name}]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));}`);
  const openRoom=()=>evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click();document.querySelector('[data-workspace-tab=room]').click()");
  await openRoom();
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').disabled"),false);
  const initialClub=(await stored()).plans.find(p=>p.name==='Großclub · 192 Lichter');
  assert.ok(initialClub);
  await evaluate("document.querySelector('[data-ar-new-room]').click()");
  await change('name','Wohnzimmer');
  await evaluate("document.querySelector('[data-ar-step=\"2\"]').click();document.querySelector('[data-ar-template=moving]').click();document.querySelector('[data-workspace-tab=room]').click();document.querySelector('.ar-room-zones [data-zone-add]').click()");
  const initial=await stored(),original=initial.plans.find(p=>p.id===initial.selected);
  assert.equal(original.name,'Wohnzimmer');assert.equal(Object.keys(original.positions).length,1);assert.equal(original.zones.length,1);
  await evaluate("document.querySelector('[data-ar-copy]').click()");
  let saved=await stored();assert.equal(saved.plans.length,4);const copied=saved.selected;
  const copy=saved.plans.find(p=>p.id===copied);
  assert.deepEqual(copy.positions,original.positions);assert.deepEqual(copy.zones,original.zones);
  await change('name','Partyraum');await change('height','5');
  saved=await stored();assert.deepEqual(saved.plans.find(p=>p.id===original.id),original,'editing the copy preserves the original');
  await change('room',original.id);
  assert.equal(await evaluate("document.querySelector('[data-ar-height]').value"),String(original.height));
  assert.equal((await stored()).enabled,true);
  await evaluate("document.querySelector('[data-ar-new-room]').click()");
  saved=await stored();assert.equal(saved.plans.length,5);assert.equal(Object.keys(saved.plans.find(p=>p.id===saved.selected).positions).length,0);
  await change('room',copied);
  await evaluate('window.__beforeRoomReload=true');await c('Page.reload');await wait("!window.__beforeRoomReload&&document.querySelector('#stage-tab-3d')&&document.querySelector('[data-ar-room]')");await openRoom();
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value"),copied);
  assert.equal(await evaluate("document.querySelector('[data-ar-name]').value"),'Partyraum');
  assert.equal(await evaluate("document.querySelector('[data-ar-height]').value"),'5');
  assert.deepEqual((await stored()).plans.find(p=>p.id===original.id),original);
  await change('room',initialClub.id);
  saved=await stored();const club=saved.plans.find(p=>p.id===saved.selected);
  assert.equal(saved.plans.length,5);assert.equal(saved.enabled,true);
  assert.equal(club.name,'Großclub · 192 Lichter');
  assert.equal(Object.values(club.positions).filter(p=>p.type!=='truss').length,192);
  assert.deepEqual(saved.plans.find(p=>p.id===original.id),original);
  await evaluate('window.__beforeRoomReload=true');await c('Page.reload');
  await wait("!window.__beforeRoomReload&&document.querySelector('[data-ar-room]')");await openRoom();
  assert.equal((await stored()).selected,club.id);
  assert.deepEqual((await stored()).plans.find(p=>p.id===club.id),club);
  for(const [width,height] of [[1280,800],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await evaluate("document.querySelector('.ar-room-switcher').scrollIntoView({block:'center'})");
    assert.equal(await evaluate("[...document.querySelectorAll('[data-ar-room],[data-ar-new-room],[data-ar-copy]')].every(n=>{const r=n.getBoundingClientRect();return n.checkVisibility()&&r.left>=0&&r.right<=innerWidth;})"),true,'room switching fits the viewport');
    await writeFile('/tmp/anydj-room-library-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  for(const [width,height] of [[1280,800],[390,844],[844,390]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await evaluate("document.querySelector('[data-workspace-tab=fixtures]').click()");
   await evaluate("document.querySelector('.ar-device-list .ar-device').click();document.querySelector('[data-device-tab=position]').click()");
   if(width<600)await evaluate("document.querySelector('.ar-device-mobile button:last-child').click()");
   assert.equal(await evaluate("document.querySelector('.stage-3d-viewport').checkVisibility()"),true);
   assert.ok(await evaluate("document.querySelector('.ar-device-tab-panel:not([hidden])').clientHeight")>60,'device fields have usable scroll space');
   await evaluate("{const n=document.querySelector('[data-ar-device-name]');n.value='Drawer-Test';n.dispatchEvent(new Event('change'));}");
   const state=await stored();assert.ok(Object.values(state.plans.find(p=>p.id===state.selected).positions).some(p=>p.name==='Drawer-Test'));
   await writeFile('/tmp/anydj-unified-drawer-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate("document.querySelector('[data-tools-close]').click()");
  }
  assert.deepEqual(errors,[]);
  console.log('Unified drawers and room library passed: create, duplicate devices/zones, isolated changes, switching, reload and desktop/mobile layout.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
