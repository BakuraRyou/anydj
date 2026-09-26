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
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,previewPort:0,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
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
 await evaluate("document.querySelector('#trackSort').value='oldest';document.querySelector('#trackSort').dispatchEvent(new Event('change'))");
 await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));
 document.querySelector('[aria-label="Auf Deck A laden"]').click();`);
 await wait("!document.querySelector('.dj-play').disabled");
 await evaluate(`window.deckA=document.querySelectorAll('.dj-deck')[0];window.deckB=document.querySelectorAll('.dj-deck')[1];window.setControl=(selector,value)=>{const n=deckA.querySelector(selector);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};document.querySelector('#autoCrossfade').checked=false;`);

 await evaluate("if(document.querySelector('#inlineLightStage').hidden)document.querySelector('#openLightStage').click();document.querySelector('[data-stage3d-toggle]').click()");
 await wait("!document.querySelector('[data-song-seek]').disabled");
 const key=async(key,code=key)=>{await c('Input.dispatchKeyEvent',{type:'keyDown',key,code});await c('Input.dispatchKeyEvent',{type:'keyUp',key,code});};
 const point=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const click=async selector=>{const p=await point(selector);await c('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await c('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
 assert.equal(await evaluate("document.querySelector('.stage-3d-full-transport').hidden"),false,'shared show screen uses both decks');
 await click('[data-full-deck=B] [data-full-deck-tools]');
 assert.equal(await evaluate("document.querySelector('[data-song-deck]').value"),'B');
 assert.equal(await evaluate("document.querySelector('[data-workspace-page=music]').hidden"),false);
 await click('[data-tools-close]');
 for(const tab of ['room','fixtures','lighting','position','music']){
  await click('[data-workspace-tab='+tab+']');
  assert.equal(await evaluate("document.querySelector('[data-workspace-page="+tab+"]').hidden"),false);
  assert.equal(await evaluate("document.querySelector('.stage-3d-viewport').checkVisibility()"),true,'drawers preserve the preview');
  assert.equal(await evaluate("document.querySelector('.stage-3d-full-transport').checkVisibility()"),true,'drawers preserve decks');
 }
 await key('Escape');
 assert.equal(await evaluate("document.querySelector('.stage-3d-workspace').classList.contains('has-tools')"),false,'Escape closes the drawer first');
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full')"),true);

 await wait("!document.querySelector('.stage-3d-full-transport').hidden");
 assert.equal(await evaluate("document.querySelectorAll('[data-full-deck]').length"),2);
 assert.equal(await evaluate("document.querySelector('[data-full-deck=A] [data-full-title]').textContent"),'test.wav');
 assert.equal(await evaluate("document.querySelector('[data-full-deck=B] [data-full-play]').disabled"),true,'empty deck cannot play');
 assert.equal(await evaluate("document.querySelector('[data-full-deck=B] [data-full-seek]').disabled"),true,'empty deck cannot seek');
 assert.equal(await evaluate("document.querySelector('[data-full-fade]').disabled"),true,'transition unavailable without second track');
 await evaluate("document.querySelectorAll('[aria-label=\"Auf Deck B laden\"]')[1].click()");
 await wait("document.querySelector('[data-full-deck=B] [data-full-title]').textContent==='test.mp3'");
 await wait("!document.querySelector('[data-full-deck=B] [data-full-seek]').disabled");
 // Fullscreen profile shares the original selection and saved moving mode.
 assert.deepEqual(await evaluate("[...document.querySelector('[data-full-profile]').options].map(o=>o.value)"),['auto','show','party','disco','calm','atmospheric']);
 await evaluate("document.querySelector('[data-full-profile]').value='show';document.querySelector('[data-full-profile]').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('#djShowProfile').value"),'show');
 assert.equal(await evaluate("localStorage.getItem('wiz-dj-show-profile')"),'show');
 assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),'show');
 await evaluate("document.querySelector('#djShowProfile').value='party';document.querySelector('#djShowProfile').dispatchEvent(new Event('change'))");
 await wait("document.querySelector('[data-full-profile]').value==='party'");
 // Real pointer seeking and independent playback use the main audio elements.
 await click('[data-full-deck=B] [data-full-seek]');
 await wait("Math.abs(deckB.querySelector('audio').currentTime-6)<.15");
 assert.equal(await evaluate("deckA.querySelector('audio').currentTime"),0);
 await click('[data-full-deck=B] [data-full-play]');
 await wait("!deckB.querySelector('audio').paused&&document.querySelector('[data-full-deck=B] [data-full-play]').textContent==='Pause'");
 await click('[data-full-deck=B] [data-full-play]');await wait("deckB.querySelector('audio').paused");
 await click('[data-full-deck=A] [data-full-play]');await wait("!deckA.querySelector('audio').paused");
 await wait("Number(document.querySelector('[data-full-deck=A] [data-full-seek]').value)>.1");
 await click('[data-full-deck=A] [data-full-play]');await wait("deckA.querySelector('audio').paused");
 await click('[data-full-crossfade]');
 assert.ok(Math.abs(await evaluate("Number(document.querySelector('#crossfader').value)")-.5)<.02,'mini crossfader changes actual mixer');
 await evaluate("document.querySelector('#crossfader').value=.25;document.querySelector('#crossfader').dispatchEvent(new Event('input'))");
 await wait("document.querySelector('[data-full-crossfade]').value==='0.25'");
 await click('[data-full-auto]');assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),true);
 await click('[data-full-auto]');assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),false);
 await evaluate("document.querySelector('[data-full-fade-duration]').value='2';document.querySelector('[data-full-fade-duration]').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('#fadeDuration').value"),'2');
 // Hover and keyboard interaction prevent idle hiding.
 await c('Input.dispatchMouseEvent',{type:'mouseMoved',...await point('[data-full-deck=A] [data-full-title]')});
 await new Promise(r=>setTimeout(r,3200));
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')"),false,'hover keeps controls visible');
 await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:600,y:250});
 await wait("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')",4500);
 assert.equal(await evaluate("document.querySelector('.stage-3d-full-transport').inert"),true);
 await wait("getComputedStyle(document.querySelector('.stage-3d-full-transport')).visibility==='hidden'");
 await key('Tab');
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')"),false,'keyboard reveals controls');
 await evaluate("document.querySelector('[data-full-deck=B] [data-full-play]').focus()");
 await wait("document.activeElement===document.querySelector('[data-full-deck=B] [data-full-play]')",1500);
 await new Promise(r=>setTimeout(r,3200));
 assert.equal(await evaluate("document.querySelector('.stage-3d-full-transport').inert"),false,'keyboard focus prevents hiding');
 await key(' ','Space');await wait("!deckB.querySelector('audio').paused");
 assert.equal(await evaluate("deckA.querySelector('audio').paused"),true,'Space on B controls only B');
 await key(' ','Space');await wait("deckB.querySelector('audio').paused");
 await evaluate("document.querySelector('[data-full-deck=B] [data-full-seek]').focus()");
 const before=await evaluate("deckB.querySelector('audio').currentTime");
 await key('ArrowRight');
 assert.ok(Math.abs(await evaluate("deckB.querySelector('audio').currentTime")-before-.01)<.015,'native timeline arrows are not DJ shortcuts');
 // Automatic fade and cancel go through the original transition logic.
 await evaluate("for(const id of ['A','B']){const s=document.querySelector('[data-full-deck='+id+'] [data-full-seek]');s.value=0;s.dispatchEvent(new Event('input'));}document.querySelector('[data-full-crossfade]').value=0;document.querySelector('[data-full-crossfade]').dispatchEvent(new Event('input'))");
 await click('[data-full-deck=A] [data-full-play]');await wait("!document.querySelector('[data-full-fade]').disabled");
 await click('[data-full-fade]');await wait("!deckB.querySelector('audio').paused&&document.querySelector('[data-full-fade]').textContent==='Abbrechen'");
 await click('[data-full-fade]');await wait("document.querySelector('#fadeCancel').hidden");
 await wait("document.querySelector('[data-full-fade]').textContent==='Überblenden'");
 await click('[data-full-fade]');
 await wait("deckA.querySelector('audio').paused&&Number(document.querySelector('#crossfader').value)>.99");
 await click('[data-full-deck=B] [data-full-play]');await wait("deckB.querySelector('audio').paused");
 // Compact controls must fit both portrait and landscape views.
 for(const [width,height] of [[1280,800],[390,844],[320,640],[844,390]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<800});
   await evaluate("document.querySelector('.stage-3d-dialog').dispatchEvent(new PointerEvent('pointermove',{bubbles:true}))");
   await new Promise(r=>setTimeout(r,250));
   assert.equal(await evaluate("(()=>{const p=document.querySelector('.stage-3d-full-transport'),r=p.getBoundingClientRect(),d=document.querySelector('.stage-3d-dialog');return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&p.scrollWidth<=p.clientWidth&&d.scrollWidth<=d.clientWidth&&d.scrollHeight<=d.clientHeight;})()"),true,`controls fit ${width} x ${height}`);
   assert.equal(await evaluate("[...document.querySelectorAll('[data-full-play],[data-full-seek],[data-full-crossfade],[data-full-fade],[data-full-profile]')].every(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})"),true,'controls remain reachable');
   if(width===1280||width===390)await writeFile(`/tmp/anydj-3d-full-${width}.png`,Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 // Touch activity wakes the view; Escape and close restore normal controls.
 await evaluate("document.querySelector('.stage-3d-viewport>canvas').focus();document.querySelector('.stage-3d-dialog').dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,pointerType:'touch',bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,pointerType:'touch'}))");
 await wait("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')",4500);
 await c('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:120}]});
 await c('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')"),false);
 await key('Escape');
 await wait("!document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full')");
 assert.equal(await evaluate("document.querySelector('.stage-show-shell').hidden&&document.querySelector('.stage-3d-full-transport').hidden"),true);
 await evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click()");
 await wait("!document.querySelector('.stage-3d-full-transport').hidden");
 await click('[data-stage3d-expand]');
 assert.equal(await evaluate("document.querySelector('.stage-show-shell').hidden"),true);
 await new Promise(r=>setTimeout(r,3200));
 assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').classList.contains('stage-3d-full-idle')"),false,'closing stops idle timer');
 assert.deepEqual(errors,[]);
 console.log('3D fullscreen passed: two real decks, waveform seek, independent play/pause, shared crossfader, auto mode, fade/cancel, hover, idle, keyboard, touch, responsive layouts and exit cleanup.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
