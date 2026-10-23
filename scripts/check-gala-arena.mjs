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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};





  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/style.css'});await wait("document.readyState==='complete'&&location.pathname==='/style.css'");
  const migration=await evaluate(`(async()=>{
   const {createARPlanner}=await import('/dmx-ar-planner.js');
   const {villageBarnRoom,galaArenaRoom}=await import('/dmx-room-presets.js');
   const key='anydj-ar-rooms-v1',room=villageBarnRoom();room.name='Meine Scheune';room.positions['barn-moving-front'].height=2;
   const flags={clubRoomAdded:true,clubStageRoomAdded:true,clubStageOpenRoomAdded:true,hallDJRoomAdded:true,barnRoomAdded:true,festivalRoomAdded:true,strobeRoomAdded:true,choreographyArenaAdded:true,formationArenaAdded:true,combinedFormationAdded:true};
   const read=()=>JSON.parse(localStorage.getItem(key)),host=document.createElement('main');document.body.replaceChildren(host);
   localStorage.setItem(key,JSON.stringify({...flags,plans:[room],selected:room.id,enabled:true}));
   let planner=createARPlanner(host),first=read();planner.destroy();planner=createARPlanner(host);const second=read();planner.destroy();
   const arena=second.plans.find(p=>p.positions['gala-ring-0-0']);
   const result={once:first.plans.length===2&&second.plans.length===2,preserved:JSON.stringify(second.plans[0])===JSON.stringify(room),selection:second.selected===room.id,flag:second.galaArenaAdded};
   arena.name='Meine Lichtringe';arena.positions['gala-ring-0-0'].height=10;
   localStorage.setItem(key,JSON.stringify({...flags,plans:[arena],selected:arena.id,enabled:true}));
   planner=createARPlanner(host);result.renamed=read().plans.length===1&&read().plans[0].positions['gala-ring-0-0'].height===10;planner.destroy();
   localStorage.setItem(key,JSON.stringify({...flags,plans:Array.from({length:20},()=>villageBarnRoom()),selected:room.id,enabled:true}));
   planner=createARPlanner(host);result.full=read().plans.length===20&&!read().galaArenaAdded;planner.destroy();
   localStorage.setItem(key,JSON.stringify({...flags,plans:[room,arena],selected:arena.id,enabled:true,galaArenaAdded:true}));
   window.galaId=arena.id;
   return result;
  })()`);
  assert.ok(Object.values(migration).every(Boolean),JSON.stringify(migration));
  const arenaId=await evaluate('galaId');
  await c('Page.navigate',{url:base+'/dj'});await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('[data-ar-room]')");
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value"),arenaId);
  await evaluate("document.querySelector('[data-stage3d-toggle]').click();document.querySelector('[data-workspace-tab=room]').click()");
  assert.equal(await evaluate("[...document.querySelector('[data-ar-room]').options].some(o=>o.textContent.includes('Meine Lichtringe'))"),true);
  await c('Page.reload');await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&document.querySelector('[data-ar-room]')");
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value"),arenaId);
  const image=await evaluate(`(async()=>{
   const {galaArenaRoom,roomSpectatorView}=await import('/dmx-room-presets.js');
   const {roomPlanLayout}=await import('/dmx-ar-model.js');
   const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
   const room=galaArenaRoom(),layout=roomPlanLayout(room),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=750;
   const lights=Object.entries(room.positions).map(([id,p])=>({id,type:p.type,position:p,target:p.target,modelSize:p.size,beamAngle:p.beamAngle,power:p.type==='spot'?.5:.7,color:p.type==='bar'?'#ee3060':p.type==='spot'?'#7b52ff':'#c5dbff'}));
   renderStage3d(canvas.getContext('2d'),canvas.width,canvas.height,layout,lights,roomSpectatorView(layout),[],0);
   return canvas.toDataURL();
  })()`);
  await writeFile('/tmp/anydj-gala-arena.png',Buffer.from(image.split(',')[1],'base64'));
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('Gala arena: added once, edits/selection preserved, full library respected, renamed preset recognized, workspace selection survives reload, shared renderer screenshot saved.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
