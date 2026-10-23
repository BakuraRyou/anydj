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
const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--autoplay-policy=no-user-gesture-required','--mute-audio','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+await evaluate("document.querySelector('.stage-3d-song-editor-hint')?.textContent"));};


  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/editor-check'});await wait("document.readyState==='complete'");
  await evaluate(`(async()=>{
    const {createStage3d}=await import('/dmx-stage-3d.js'),{openSectionEditor}=await import('/section-editor.js'),{compileShow}=await import('/show-plan.js');
    const duration=24,windows=Array.from({length:1200},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
    const beats=Array.from({length:48},(_,i)=>i*.5),options={arrangement:'auto',mood:'auto',minimum:5,maximum:100,palette:'sunset',saturation:100,toneFollow:.8,smoothing:.5,speed:1,intensity:1,dynamics:'balanced'};
    window.plan=compileShow(windows,duration,options,{version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)});
    const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';document.head.append(viewport);
    const css=document.createElement('link');css.rel='stylesheet';css.href='/style.css';document.head.append(css);document.body.replaceChildren();
    const {newRoomPlan,planningDevice}=await import('/dmx-ar-model.js');
    const room=newRoomPlan(8,8,3);room.id='edit-test';
    for(const [id,x] of [['left',-2],['right',2]])room.positions[id]={...planningDevice(room,'moving').position,x,y:6,height:2,target:{x,y:3}};
    localStorage.setItem('anydj-ar-rooms-v1',JSON.stringify({plans:[room],selected:room.id,enabled:true}));
    window.room=room;
    window.stage=createStage3d(document.body,document.body,{getLayout:()=>({width:8,depth:6,height:3,positions:{}}),mountLayout:()=>{},mountLighting:()=>{}});
    await stage.setEnabled(true);stage.open();document.querySelector('[data-camera=front]').click();document.querySelector('[data-camera=reset]').click();
    stage.setTransport({getDecks:()=>[{id:'A',trackId:'ux-track',title:'Lichtshow · Testtrack',duration,position:3.25,rate:1,canEdit:true,canSeek:true,canPlay:true}],mountEditor:async(id,host,context)=>window.editor=openSectionEditor({track:{name:'Lichtshow · Testtrack'},plan,host,targets:[...context.targets,{id:'patch:fixture-test',name:'DMX · Testlampe'}],getTargetPreview:context.getTargetPreview,onEditPosition:context.onEditPosition,onSave:async edits=>{const {saveTrack}=await import('/dj-library.js');await saveTrack({id:'ux-track',name:'Testtrack',sectionEdits:edits});window.savedEdits=structuredClone(edits);},onDispose:context.onDispose})});
    stage.update([{id:'source',type:'spot',cells:[[255,80,0]]}],[]);
    window.mountsBefore=document.querySelectorAll('.light-editor').length;
  })()`);
  assert.equal(await evaluate('mountsBefore'),0,'edit mode starts without a mounted editor');
  assert.equal(await evaluate("document.querySelector('[data-camera=reset]').nextElementSibling.matches('[data-stage-edit]')"),true,'edit switch sits beside Fit');
  assert.equal(await evaluate("document.querySelector('[data-stage-edit]').getAttribute('aria-pressed')"),'false');
  await evaluate("document.querySelector('[data-stage-edit]').click()");
  await wait("document.querySelector('.light-editor')");
  // Use the same projection as the canvas, then send real pointer input.
  const point=await evaluate(`(async()=>{const {stageCamera,stageFloorPoint}=await import('/dmx-stage-3d-renderer.js');const {roomPlanLayout}=await import('/dmx-ar-model.js');const c=document.querySelector('.stage-3d canvas'),r=c.getBoundingClientRect();const project=stageCamera(roomPlanLayout(room),{yaw:.32,pitch:.55,zoom:1},r.width,r.height);const p=project([-2,6,2]);return {x:r.left+p.x,y:r.top+p.y};})()`);
  const click=async p=>{await c('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p});await c('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p});};
  await click(point);
  assert.equal(await evaluate("document.querySelector('[data-target]').value"),'room:edit-test:left','canvas click selects fixture');
  assert.equal(await evaluate("Number(document.querySelector('[name=start]').value)<=3.25 && Number(document.querySelector('[name=end]').value)>3.25"),true,'selection follows current playback interval');
  await evaluate("document.querySelector('[data-edit-group]').click()");
  assert.equal(await evaluate("document.querySelector('[data-target]').value"),'room-group:edit-test:0');
  await evaluate("document.querySelector('[data-cue-active]').click()");
  assert.deepEqual(await evaluate("editor.getEdits().flatMap(e=>e.fixtures||[]).filter(c=>c.target.startsWith('room:')).map(c=>c.look.brightness)"),[0,0],'group blackout applies to current members');
  await evaluate("document.querySelector('[data-undo]').click()");
  await evaluate("document.querySelector('[data-edit-formation]').value='line';document.querySelector('[data-edit-aim]').click()");
  const floor=await evaluate(`(async()=>{const {stageCamera}=await import('/dmx-stage-3d-renderer.js');const {roomPlanLayout}=await import('/dmx-ar-model.js');const r=document.querySelector('.stage-3d canvas').getBoundingClientRect();const p=stageCamera(roomPlanLayout(room),{yaw:.32,pitch:.55,zoom:1},r.width,r.height)([0,3,0]);return {x:r.left+p.x,y:r.top+p.y};})()`);
  await click(floor);
  const aims=await evaluate("editor.getEdits().flatMap(e=>e.fixtures||[]).filter(c=>c.target.startsWith('room:')).map(c=>c.aim)");
  assert.equal(aims.length,2);assert.ok(Math.abs(aims[0].x+1)<.03);assert.ok(Math.abs(aims[1].x-1)<.03);assert.ok(Math.abs(aims[0].y-3)<.03);
  await evaluate("document.querySelector('[data-undo]').click()");
  assert.equal(await evaluate("editor.getEdits().flatMap(e=>e.fixtures||[]).filter(c=>c.aim).length"),0);
  await evaluate("document.querySelector('[data-redo]').click();document.querySelector('.light-editor form').requestSubmit()");
  await wait('window.savedEdits');
  assert.equal(await evaluate("savedEdits.flatMap(e=>e.fixtures||[]).filter(c=>c.aim).length"),2);
  await evaluate("document.querySelector('[data-stage-edit]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.light-editor').length"),0,'switching off releases the editor and its timers');
  assert.equal(await evaluate("document.querySelector('[data-stage-edit]').getAttribute('aria-pressed')"),'false');
  assert.deepEqual(errors,[]);await evaluate('stage.destroy()');
  console.log('3D Edit mode passed: off by default, beside Fit, canvas selection, current interval, group blackout, click-to-aim formation, undo/redo, save, dispose.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
