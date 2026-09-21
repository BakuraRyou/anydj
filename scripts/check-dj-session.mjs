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
await promisify(execFile)('ffmpeg',['-v','error','-i',wav,mp3]);
console.log('Fixtures ready');
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
console.log('Server ready');
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
 console.log('Browser ready');
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:Array.from({length:24},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 console.log('Import');
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Fertig'))");

 await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));
 document.querySelector('[aria-label="Auf Deck A laden"]').click();`);
 await wait("!document.querySelector('.dj-play').disabled");
 await evaluate(`window.deckA=document.querySelectorAll('.dj-deck')[0];window.deckB=document.querySelectorAll('.dj-deck')[1];window.setControl=(selector,value)=>{const n=deckA.querySelector(selector);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};document.querySelector('#autoCrossfade').checked=false;`);

 await evaluate(`setControl('.dj-volume',.63);setControl('[data-tempo]',7);setControl('[data-eq=low]',-9);
 document.querySelector('#crossfader').value=.3;document.querySelector('#autoBeat').checked=false;
 document.querySelector('#fadeDuration').value='12';document.querySelector('[data-master]').value=.42;
 deckA.querySelector('audio').currentTime=3;deckA.querySelector('.dj-set-cue').click();deckA.querySelector('audio').currentTime=5;`);
 await new Promise(r=>setTimeout(r,1200));
 console.log('Reload');await c('Page.reload');await wait("document.querySelector('.dj-clock')?.textContent.startsWith('0:05')");
 assert.equal(await evaluate("document.querySelector('.dj-volume').value"),'0.63');
 assert.equal(await evaluate("document.querySelector('[data-tempo]').value"),'7');
 assert.equal(await evaluate("document.querySelector('[data-eq=low]').value"),'-9');
 assert.equal(await evaluate("document.querySelector('#crossfader').value"),'0.3');
 assert.equal(await evaluate("document.querySelector('#autoBeat').checked"),false);
 assert.equal(await evaluate("document.querySelector('#fadeDuration').value"),'12');
 assert.equal(await evaluate("document.querySelector('[data-master]').value"),'0.42');
 assert.equal(await evaluate("document.querySelector('.dj-cue').textContent"),'Cue 0:03');
 assert.equal(await evaluate("[...document.querySelectorAll('.dj-deck audio')].every(a=>a.paused)"),true);
 // Capture the temporary file input created by the reconnect action.
 await evaluate("window.originalClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){window.relinkInput=this;};[...document.querySelectorAll('.dj-deck button')].find(b=>b.textContent==='Datei verbinden').click()");
 const {result:fileInput}=await c('Runtime.evaluate',{expression:"window.relinkInput"});
 await c('DOM.setFileInputFiles',{objectId:fileInput.objectId,files:[wav]});
 await wait("!document.querySelector('.dj-play').disabled");
 assert.ok(Math.abs(await evaluate("document.querySelector('.dj-deck audio').currentTime")-5)<.1);
 assert.ok(Math.abs(await evaluate("document.querySelector('.dj-deck audio').playbackRate")-1.07)<.001);
 await evaluate("document.querySelector('.dj-play').click()");await wait("document.querySelector('.dj-deck audio').currentTime>5.2");
 await evaluate("document.querySelector('#djStop').click()");await wait("document.querySelector('.dj-deck audio').paused");
 await wait("!document.querySelector('.dj-unload').disabled");
 await evaluate("document.querySelector('.dj-unload').click()");await wait("document.querySelector('.dj-track-title').textContent==='Track laden'");
 console.log('Reload');await c('Page.reload');await wait("document.querySelectorAll('#trackList li').length===2");
 await new Promise(r=>setTimeout(r,500));assert.equal(await evaluate("document.querySelector('.dj-track-title').textContent"),'Track laden');
 // Explicit preference survives runtime disarming by Stop and manual fader.
 await evaluate("document.querySelector('#autoCrossfade').checked=true;document.querySelector('#autoCrossfade').dispatchEvent(new Event('change'));document.querySelector('#djStop').click()");
 assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),true,'Stop preserves the checkbox');
 await c('Page.reload');await wait("document.querySelectorAll('#trackList li').length===2");
 await new Promise(r=>setTimeout(r,400));
 assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),true,'Stop must not overwrite the saved preference');
 await evaluate("document.querySelector('#crossfader').dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),true,'manual fader preserves the checkbox');
 await c('Page.reload');await wait("document.querySelectorAll('#trackList li').length===2");
 await new Promise(r=>setTimeout(r,400));
 assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),true,'manual fader must not overwrite the saved preference');
 await evaluate("document.querySelector('#autoCrossfade').click()");
 await c('Page.reload');await wait("document.querySelectorAll('#trackList li').length===2");
 await new Promise(r=>setTimeout(r,400));
 assert.equal(await evaluate("document.querySelector('#autoCrossfade').checked"),false,'explicit off survives immediate reload');
 assert.deepEqual(errors,[]);
 console.log('Session restore passed: deck, position, cue, volume, tempo, EQ, mixer, reconnect, paused reload and explicit unload.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
