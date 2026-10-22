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
    window.stage=createStage3d(document.body,document.body,{getLayout:()=>({width:8,depth:6,height:3,positions:{}}),mountLayout:()=>{},mountLighting:()=>{}});
    await stage.setEnabled(true);stage.open();
    stage.setTransport({getDecks:()=>[{id:'A',trackId:'ux-track',title:'Lichtshow · Testtrack',duration,position:0,rate:1,canEdit:true,canSeek:true,canPlay:true}],mountEditor:async(id,host,context)=>openSectionEditor({track:{name:'Lichtshow · Testtrack'},plan,host,targets:[...context.targets,{id:'patch:fixture-test',name:'DMX · Testlampe'}],getTargetPreview:()=>[{color:'rgb(255,0,0)',power:.8}],onEditPosition:context.onEditPosition,onSave:async edits=>{const {saveTrack}=await import('/dj-library.js');await saveTrack({id:'ux-track',name:'Testtrack',sectionEdits:edits});window.savedEdits=structuredClone(edits);},onDispose:context.onDispose})});
    document.querySelector('[data-workspace-tab=lighting]').click();
  })()`);
  await wait("document.querySelector('.section-editor-embedded .light-editor')");
  const set=(selector,value)=>evaluate(`{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await set('[data-time]','3.25');await evaluate("document.querySelector('[data-moment]').click()");
  assert.equal(await evaluate("document.querySelector('[name=start]').value"),'3.25');
  assert.equal(await evaluate("document.querySelector('[name=end]').value"),'4.25');
  await set('[name=profile]','show');
  assert.ok(await evaluate("document.querySelectorAll('[data-palette] input[type=color]').length"));
  await set('[data-palette] input[type=color]','#12ab34');
  await set('[data-target]','patch:fixture-test');
  await wait("document.querySelector('[data-target-colors] input')");
  await set('[data-target-colors] input','#ffaa00');
  await set('[data-cue-mode]','fixed');await set('[data-cue-a]','#ffaa00');await set('[data-cue-animation]','pulse');
  await set('[data-cue-strength]','65');await set('[data-cue-brightness]','80');
  await evaluate("document.querySelector('.light-editor form').requestSubmit()");
  await wait('window.savedEdits');
  const moment=await evaluate("savedEdits.find(e=>e.start===3.25)");
  assert.equal(moment.fixtures[0].target,'patch:fixture-test');
  assert.equal(moment.end,4.25);assert.equal(moment.profile,'show');assert.equal(moment.colorA,'#12ab34');assert.equal(moment.fixtures[0].look.colors[0],'#ffaa00');assert.equal(moment.fixtures[0].look.strength,65);assert.equal(moment.fixtures[0].look.brightness,80);
  await evaluate("document.querySelector('[data-undo]').click()");
  await evaluate("document.querySelector('[data-redo]').click()");
  // Device aim uses the room planner's coordinates and remains inside its bounds.
  const roomTarget=await evaluate("[...document.querySelector('[data-target]').options].find(o=>o.value.startsWith('room:')).value");
  await set('[data-target]',roomTarget);await evaluate("document.querySelector('[data-cue-enabled]').click();document.querySelector('[data-cue-aim-enabled]').click()");
  await set('[data-cue-x]','1.5');await set('[data-cue-y]','12');
  await evaluate("document.querySelector('.light-editor form').requestSubmit()");
  assert.deepEqual(await evaluate("savedEdits.find(e=>e.start===3.25).fixtures.find(c=>c.target.startsWith('room:')).aim"),{x:1.5,y:12});
  assert.equal(await evaluate("(async()=>{const {readLibrary}=await import('/dj-library.js');return (await readLibrary()).find(t=>t.id==='ux-track').sectionEdits.find(e=>e.start===3.25).profile;})()"),'show');
  await set('[data-target]','scene');
  for(const [width,height] of [[1440,1000],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await evaluate("document.querySelector('.stage-3d-inspector-body').scrollTop=0");await new Promise(r=>setTimeout(r,200));
    assert.equal(await evaluate("(()=>{const n=document.querySelector('.stage-3d-inspector-body');return n.scrollWidth<=n.clientWidth+1;})()"),true,'no horizontal overflow');
    await evaluate("document.querySelector('.light-editor [type=submit]').scrollIntoView({block:'center'})");
    assert.equal(await evaluate("(()=>{const n=document.querySelector('.light-editor [type=submit]'),r=n.getBoundingClientRect();return n.checkVisibility()&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()"),true,'save remains reachable');
    await evaluate("document.querySelector('.stage-3d-inspector-body').scrollTop=0");
    await writeFile(join(tmpdir(),`anydj-light-editor-${width}.png`),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.deepEqual(errors,[]);await evaluate('stage.destroy()');
  console.log('Light editor UX passed: exact moment, phase style, visible palette, device color/accent, room aim, save/undo/redo, desktop/mobile reachability.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
