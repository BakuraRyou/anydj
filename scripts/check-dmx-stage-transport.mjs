import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const fixtures=await mkdtemp(join(tmpdir(),'wiz-queue-audio-'));
const wav=join(fixtures,'test.wav'),mp3=join(fixtures,'test.mp3');
await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=12','-ar','16000',wav]);
if(process.argv.includes('--covers')){
 const cover=join(fixtures,'cover.png');
 await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=64x64','-frames:v','1','-threads','1',cover]);
 await promisify(execFile)('ffmpeg',['-v','error','-i',wav,'-i',cover,'-map','0:a','-map','1:v','-c:a','libmp3lame','-c:v','png','-id3v2_version','3','-metadata:s:v','title=Cover','-metadata:s:v','comment=Cover (front)',mp3]);
}else await promisify(execFile)('ffmpeg',['-v','error','-i',wav,mp3]);
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});
const profile=await mkdtemp(join(tmpdir(),'wiz-beat-chrome-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--mute-audio','--autoplay-policy=no-user-gesture-required','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);chrome.stderr.on('data',c=>{out+=c;const match=out.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});chrome.once('exit',code=>{clearTimeout(timer);reject(Error('Chrome exited '+code+' '+out.slice(-1000)));});});
 ws=new WebSocket(endpoint);await once(ws,'open');let next=1;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 const c=(method,params)=>command(method,params,sessionId);await c('Runtime.enable');await c('Page.enable');
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression+' '+JSON.stringify(errors)+' '+await evaluate("({queue:document.querySelector('#queueStatus')?.textContent,status:document.querySelector('#djStatus')?.textContent,count:document.querySelector('#queueCount')?.textContent,start:document.querySelector('#queueStart')?.textContent,decks:[...document.querySelectorAll('audio')].map(a=>({time:a.currentTime,paused:a.paused}))})"));};
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await c('Page.addScriptToEvaluateOnNewDocument',{source:`const objectUrl=URL.createObjectURL.bind(URL);window.recordedBlobs=[];URL.createObjectURL=b=>{window.recordedBlobs.push(b);return objectUrl(b);};
 const Native=window.AudioContext;window.testAudioNodes=[];window.testGains=[];window.AudioContext=class extends Native {constructor(...args){super(...args);window.testContext=this;}async setSinkId(id){window.testMasterSink=id;}createGain(){const n=super.createGain();window.testGains.push(n);return n;}createBiquadFilter(){const n=super.createBiquadFilter();window.testAudioNodes.push(n);return n;}};
 Object.defineProperty(navigator.mediaDevices,'selectAudioOutput',{configurable:true,value:async()=>window.testOutput});
 HTMLMediaElement.prototype.setSinkId=async function(id){window.testCueSink=id;};
 const nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.srcObject?Promise.resolve():nativePlay.call(this);};`});
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:Array.from({length:24},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait(`document.querySelectorAll('#trackList [aria-label="Auf Deck A laden"]:not(:disabled)').length===2`);

 if(process.argv.includes('--covers')){
  await wait("document.querySelector('#trackList img.dj-track-cover')?.naturalWidth>0");
  assert.equal(await evaluate("document.querySelectorAll('#trackList img.dj-track-cover').length"),1);
  await writeFile(new URL('../reports/local-cover-browser.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));
 document.querySelector('[aria-label="Auf Deck A laden"]').click();`);
 await wait("!document.querySelector('.dj-play').disabled");
 await evaluate(`window.deckA=document.querySelectorAll('.dj-deck')[0];window.deckB=document.querySelectorAll('.dj-deck')[1];window.setControl=(selector,value)=>{const n=deckA.querySelector(selector);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};document.querySelector('#autoCrossfade').checked=false;`);

 await evaluate("if(document.querySelector('#inlineLightStage').hidden)document.querySelector('#openLightStage').click();document.querySelector('[data-stage3d-toggle]').click()");
 await wait("!document.querySelector('[data-song-seek]').disabled");
 assert.equal(await evaluate("document.querySelector('[data-song-title]').textContent"),'test.wav');
 await evaluate("document.querySelector('[data-stage3d-full]').focus()");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await c('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await wait("!deckA.querySelector('audio').paused");
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full')"),false,'Space plays music instead of activating focused Full button');
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK'});await wait("deckA.querySelector('audio').paused");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 await wait("deckA.querySelector('audio').currentTime>=5");
 const masterBefore=await evaluate("Number(document.querySelector('[data-master]').value)");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown'});
 assert.ok(Number(await evaluate("document.querySelector('[data-master]').value"))<masterBefore);
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await wait("deckA.querySelector('audio').currentTime<.1");
 await evaluate("document.querySelector('[data-song-rate]').focus()");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'k',code:'KeyK'});
 assert.equal(await evaluate("deckA.querySelector('audio').paused"),true,'editing fields keep shortcuts disabled');
 await evaluate("document.querySelector('[data-stage3d-full]').click()");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'q',code:'KeyQ'});await wait("!deckA.querySelector('audio').paused");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'q',code:'KeyQ'});await wait("deckA.querySelector('audio').paused");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});

 await evaluate("const rate=document.querySelector('[data-song-rate]');rate.value=12;rate.dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("deckA.querySelector('audio').playbackRate"),1.12);
 await evaluate("const seek=document.querySelector('[data-song-seek]');seek.value=6;seek.dispatchEvent(new Event('input'))");
 await wait("Math.abs(deckA.querySelector('audio').currentTime-6)<.02");
 await evaluate("var bar=document.querySelector('[data-song-seek]');bar.value=3;bar.dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("document.querySelector('.stage-3d-waveform')===null"),true,'compact preview has no detailed waveform');
 await wait("Math.abs(deckA.querySelector('audio').currentTime-3)<.05");
 await evaluate("document.querySelector('[data-song-play]').click()");await wait("!deckA.querySelector('audio').paused");
 await evaluate("document.querySelector('[data-song-play]').click()");await wait("deckA.querySelector('audio').paused");
 await evaluate("document.querySelector('[data-song-reset]').click()");assert.equal(await evaluate("deckA.querySelector('audio').playbackRate"),1);
 await evaluate("var select=document.querySelector('[data-song-deck]');select.value='B';select.dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('[data-song-seek]').disabled"),true);
 assert.equal(await evaluate("document.querySelector('[data-song-rate]').disabled"),true);
 await evaluate("var select=document.querySelector('[data-song-deck]');select.value='A';select.dispatchEvent(new Event('change'));document.querySelector('.stage-3d-transport').scrollIntoView({block:'center'})");
 // Preparing a show stays inside the same window.
 await evaluate("document.querySelector('[data-workspace-tab=fixtures]').click()");
 assert.equal(await evaluate("Boolean(document.querySelector('.stage-3d-device-editor [data-layout-map]'))"),true);
 await evaluate("const x=document.querySelector('[data-layout-x]');x.value=1;x.dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-layout-v1')).positions['moving-0'].x"),1);
 await evaluate("document.querySelector('[data-layout-fixture=\"moving-0\"]').focus()");
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-layout-v1')).positions['moving-0'].x"),1.1,'device-map arrows move the fixture, not the song');
 await evaluate("document.querySelector('[data-workspace-tab=lighting]').click();document.querySelector('[data-light-view=live]').click();document.querySelector('[data-stage-choice=wash]').click()");
 assert.equal(await evaluate("document.querySelector('.stage-3d-light-editor [data-mode]').value"),'wash');
 assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false,'lighting editor does not require leaving 3D');
 await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
 assert.equal(await evaluate("Boolean(document.querySelector('#dmxStage .stage-editor'))"),true,'original editor restored after switching tools');
 const fit=await evaluate("(()=>{const p=document.querySelector('.stage-3d-transport').getBoundingClientRect(),c=document.querySelector('.stage-3d-viewport canvas').getBoundingClientRect(),d=document.querySelector('.stage-3d-dialog');return p.bottom<=innerHeight&&p.top>=c.bottom&&d.scrollHeight<=d.clientHeight})()");
 assert.equal(fit,true,'preview and music stay visible without window scrolling');
 await evaluate("document.querySelector('[data-song-library]').click()");
 await wait("document.querySelectorAll('[data-song-track] option').length===2");
 await evaluate("var select=document.querySelector('[data-song-track]');select.selectedIndex=1;select.dispatchEvent(new Event('change'));document.querySelector('[data-song-load]').click()");
 await wait("document.querySelector('[data-song-title]').textContent==='test.mp3'");
 await evaluate("document.querySelector('[data-workspace-tab=lighting]').click()");
 await wait("document.querySelector('.section-editor-embedded .light-editor')");
 assert.equal(await evaluate("document.querySelector('dialog.section-editor')===null"),true,'manager is embedded, not a new dialog');
 await evaluate("var movement=document.querySelector('.stage-3d-song-editor [name=movement]');movement.value='1.35';movement.dispatchEvent(new Event('input',{bubbles:true}))");
 await evaluate("document.querySelector('[data-workspace-tab=room]').click();document.querySelector('[data-workspace-tab=lighting]').click()");
 assert.equal(await evaluate("document.querySelector('.stage-3d-song-editor [name=movement]').value"),'1.35','draft survives tool changes');
 await evaluate("var bar=document.querySelector('[data-song-seek]');bar.value=5;bar.dispatchEvent(new Event('input'))");
 await wait("document.querySelector('.stage-3d-song-editor [data-clock]').textContent.startsWith('0:05')");
 await evaluate("document.querySelector('.stage-3d-song-editor [data-play]').click()");await wait("!deckA.querySelector('audio').paused");
 await evaluate("document.querySelector('[data-song-play]').click()");await wait("deckA.querySelector('audio').paused");
 await evaluate("document.querySelector('.stage-3d-song-editor form').requestSubmit()");
 await wait("document.querySelector('.stage-3d-song-editor .section-feedback').textContent.includes('gespeichert')");
 assert.equal(await evaluate("Boolean(document.querySelector('.section-editor-embedded'))"),true,'save keeps manager in place');
 await evaluate("var movement=document.querySelector('.stage-3d-song-editor [name=movement]');movement.value='1.25';movement.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-stage3d-expand]').click()");
 await wait("!document.querySelector('.section-editor-embedded')");
 await evaluate("document.querySelector('[data-stage3d-expand]').click();document.querySelector('[data-workspace-tab=lighting]').click()");
 await wait("document.querySelector('.stage-3d-song-editor [name=movement]')?.value==='1.25'");
 await evaluate("var deckSelect=document.querySelector('[data-song-deck]');deckSelect.value='B';deckSelect.dispatchEvent(new Event('change'))");
 await wait("!document.querySelector('.section-editor-embedded')");
 await evaluate("deckSelect.value='A';deckSelect.dispatchEvent(new Event('change'))");
 await wait("document.querySelector('.stage-3d-song-editor [name=movement]')?.value==='1.25'");

 await writeFile(new URL('../reports/dmx-stage-light-manager.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
 await evaluate("document.querySelector('[data-room-preset=true]').click();document.querySelector('[data-song-play]').click()");
 await wait("!deckA.querySelector('audio').paused");
 await new Promise(r=>setTimeout(r,150));

 await writeFile(new URL('../reports/dmx-stage-transport.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("if(!deckA.querySelector('audio').paused)document.querySelector('[data-song-play]').click();document.querySelector('[data-stage3d-expand]').click()");
 for(const width of [1280,390]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   for(const ratio of [.1,.5,.9]){
     await evaluate(`setControl('.dj-seek',${ratio*12})`);await new Promise(r=>setTimeout(r,120));
     const offset=await evaluate(`(()=>{const input=deckA.querySelector('.dj-seek'),canvas=deckA.querySelector('.dj-waveform'),r=input.getBoundingClientRect(),w=canvas.getBoundingClientRect(),data=canvas.getContext('2d').getImageData(0,20,canvas.width,1).data;let x=-1;for(let i=0;i<canvas.width;i++)if(data[i*4]>245&&data[i*4+1]>245&&data[i*4+2]>245){x=i;break;}if(x<0)throw Error('No playhead');const line=w.left+(x+1)/canvas.width*w.width,thumb=r.left+10+(+input.value/+input.max)*(r.width-20);return Math.abs(line-thumb)})()`);

     assert.ok(offset<2,`waveform and thumb must align at ${width}px/${ratio}: ${offset}`);
   }
   assert.equal(await evaluate("deckA.lastElementChild.className"),'dj-analysis-footer');
   const stable=await evaluate("(()=>{const p=deckA.querySelector('.dj-analysis'),button=deckA.querySelector('.dj-play'),before=button.getBoundingClientRect().top,height=deckA.getBoundingClientRect().height;p.dataset.analysis='working';p.textContent='Lichtshow wird berechnet …';const during=button.getBoundingClientRect().top;p.dataset.analysis='complete';return before===during&&before===button.getBoundingClientRect().top&&height===deckA.getBoundingClientRect().height})()");
   assert.equal(stable,true,'analysis status must not move transport or deck boundary');
 }
 await evaluate("document.querySelector('[data-stage3d-expand]').click();document.querySelector('.stage-3d-transport').scrollIntoView({block:'center'})");
 await new Promise(r=>setTimeout(r,100));
 assert.equal(await evaluate("(()=>{const r=document.querySelector('.stage-3d-transport').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&document.querySelector('.stage-3d-dialog').scrollWidth<=document.querySelector('.stage-3d-dialog').clientWidth})()"),true,'mobile song controls fit without horizontal scrolling');
 await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
 assert.equal(await evaluate("(()=>{const r=document.querySelector('.stage-3d-transport').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"),true,'mobile music remains visible while editing room');
 await writeFile(new URL('../reports/dmx-stage-workspace-mobile.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.deepEqual(errors,[]);
 console.log('Stage transport passed: real audio tempo, seek, embedded manager, shared playback, save, draft retention, play/pause, empty deck, aligned playhead at desktop/mobile widths, stable analysis footer.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
