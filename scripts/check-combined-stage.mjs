import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+JSON.stringify(await evaluate("({title:document.querySelector('.dj-track-title')?.textContent,status:document.querySelector('#djStatus')?.textContent,analysis:document.querySelector('.dj-analysis')?.textContent,hidden:document.hidden,selects:[...document.querySelectorAll('[data-deck-show-profile]')].map(n=>({disabled:n.disabled,value:n.value}))})")));};




  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/style.css'});await wait("document.readyState==='complete'&&location.pathname==='/style.css'");
  const result=await evaluate(`(async()=>{
   const {createARPlanner}=await import('/dmx-ar-planner.js');
   const {strobeStageRoom,formationArenaRoom}=await import('/dmx-room-presets.js');
   const key='anydj-ar-rooms-v1',stage=strobeStageRoom(),arena=formationArenaRoom();
   stage.name='Meine bearbeitete Formationsbühne';stage.positions['strobe-head-0-0'].x=-10;
   arena.name='Meine Arena';arena.positions['formation-arena-0--1-0'].rotation=30;
   const flags={clubRoomAdded:true,clubStageRoomAdded:true,clubStageOpenRoomAdded:true,hallDJRoomAdded:true,barnRoomAdded:true,festivalRoomAdded:true,strobeRoomAdded:true,choreographyArenaAdded:true,formationArenaAdded:true};
   localStorage.setItem(key,JSON.stringify({...flags,plans:[stage,arena],selected:stage.id,enabled:true}));
   const host=document.createElement('main');document.body.replaceChildren(host);let planner=createARPlanner(host);
   const first=JSON.parse(localStorage.getItem(key)),combined=first.plans.find(p=>p.name==='Formationsbühne · Panorama & Raumfächer');
   const listed=[...planner.root.querySelector('[data-ar-room]').options].some(o=>o.value===combined?.id);
   planner.destroy();planner=createARPlanner(host);const second=JSON.parse(localStorage.getItem(key));planner.destroy();
   window.combinedId=combined?.id;
   return {listed,once:first.plans.length===3&&second.plans.length===3,
    preserved:JSON.stringify(first.plans[0])===JSON.stringify(stage)&&JSON.stringify(first.plans[1])===JSON.stringify(arena),
    selection:first.selected===stage.id&&second.selected===stage.id,flag:second.combinedFormationAdded===true};
  })()`);
  assert.ok(Object.values(result).every(Boolean),JSON.stringify(result));
  const combinedId=await evaluate('combinedId');
  await c('Page.navigate',{url:base+'/dj'});await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('[data-ar-room]')");
  await evaluate("document.querySelector('[data-stage3d-toggle]').click();document.querySelector('[data-workspace-tab=room]').click()");
  await evaluate(`(()=>{const choice=document.querySelector('[data-ar-room]');choice.value=${JSON.stringify(combinedId)};choice.dispatchEvent(new Event('change'));})()`);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-ar-rooms-v1')).selected"),combinedId);
  await c('Page.reload');await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('[data-ar-room]')");
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value"),combinedId);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-ar-rooms-v1')).plans.length"),3);
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('Combined stage: added once, both edited source rooms and selection preserved, selectable in real workspace, selection survives reload.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
