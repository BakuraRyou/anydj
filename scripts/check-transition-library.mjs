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
 const wait=async(expression,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression+' '+JSON.stringify(errors)+' '+JSON.stringify(await evaluate("({queue:document.querySelector('#queueStatus')?.textContent,status:document.querySelector('#djStatus')?.textContent,count:document.querySelector('#queueCount')?.textContent,start:document.querySelector('#queueStart')?.textContent,decks:[...document.querySelectorAll('audio')].map(a=>({time:a.currentTime,paused:a.paused}))})")));};
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

 await wait("document.querySelectorAll('#trackList [data-analysis]').length===2&&[...document.querySelectorAll('#trackList [data-analysis]')].every(n=>n.textContent.includes('Spielbereit'))");
 const click=label=>evaluate(`document.querySelector('[aria-label="${label}"]').click()`);
 await click('In Warteschlange einreihen');
 await wait("document.querySelectorAll('#queueList [data-queue-id]').length===1");
 await click('Gespeicherte Übergänge von diesem Titel');
 await wait("document.querySelector('.transition-links[open]')");
 await evaluate("document.querySelector('.transition-links [data-new]').click();document.querySelector('[data-targets] button').click()");
 await wait("document.querySelector('.dj-transition-preview[open]')");
 await evaluate(`window.editor=document.querySelector('.dj-transition-preview[open]');
 for(const [key,value] of [['time',6],['cue',1],['duration',2]]){const field=editor.querySelector('[data-edit-'+key+']');field.value=value;field.dispatchEvent(new Event('input'));}
 editor.querySelector('[data-variant-name]').value='Mein Mix';editor.querySelector('[data-choose]').click();`);
 await wait("editor.querySelector('[data-status]').textContent.includes('Übergangsbibliothek gespeichert')");
 const saved=await evaluate("import('/dj-library.js').then(m=>m.readTransitionLibrary())");
 assert.equal(saved.length,1);assert.equal(saved[0].name,'Mein Mix');
 await evaluate("editor.close()");await click('Gespeicherte Übergänge von diesem Titel');
 for(const [width,height] of [[1280,900],[390,844]]){
  await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  assert.ok(await evaluate("document.querySelector('.transition-links').scrollWidth<=document.querySelector('.transition-links').clientWidth"));
  await writeFile(join(tmpdir(),`anydj-transition-library-${width}.png`),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate("[...document.querySelectorAll('.transition-links button')].find(b=>b.textContent==='Als nächsten Titel wählen').click()");
 await wait("document.querySelectorAll('#queueList [data-queue-id]').length===2");
 let queue=await evaluate("import('/dj-library.js').then(m=>m.readQueue())");
 assert.equal(queue[1].transition.variantName,'Mein Mix');assert.equal(queue[1].transition.plan.time,6);
 await click('Gespeicherte Übergänge von diesem Titel');
 await evaluate("document.querySelector('.transition-links .links-more').open=true;[...document.querySelectorAll('.transition-links button')].find(b=>b.textContent==='Bearbeiten & probehören').click()");
 await wait("editor.open");
 await evaluate("editor.querySelector('[data-variant-name]').value='Geändert';editor.querySelector('[data-choose]').click()");
 await wait("editor.querySelector('[data-status]').textContent.includes('Übergangsbibliothek gespeichert')");
 queue=await evaluate("import('/dj-library.js').then(m=>m.readQueue())");assert.equal(queue[1].transition.variantName,'Mein Mix');
 await evaluate("editor.close()");await click('Gespeicherte Übergänge von diesem Titel');
 await evaluate("[...document.querySelectorAll('.transition-links button')].find(b=>b.textContent==='Als nächsten Titel wählen').click();[...document.querySelectorAll('.transition-links button')].find(b=>b.textContent==='Vorhandenen Eintrag hierher verschieben').click()");
 await wait("!document.querySelector('.transition-links[open]')");
 assert.equal(await evaluate("document.querySelectorAll('#queueList [data-queue-id]').length"),2);
 await click('Später abspielen');
 assert.ok(await evaluate("document.querySelector('#queueList').textContent.includes('Übergang passt nicht')"));
 await click('Später abspielen');
 await evaluate("document.querySelector('#queueStart').click()");
 await wait("[...document.querySelectorAll('.dj-deck audio')].filter(a=>!a.paused).length===2");
 const positions=await evaluate("[...document.querySelectorAll('.dj-deck audio')].map(a=>a.currentTime)");
 assert.ok(positions[0]>=5.9&&positions[0]<7.5,'saved exit time is used');
 assert.ok(positions[1]>=1&&positions[1]<2.5,'saved incoming cue is used');
 await wait("document.querySelectorAll('#queueList [data-queue-id]').length===0");
 await evaluate("document.querySelector('#djStop').click()");
 await c('Page.reload');await wait("document.querySelectorAll('#trackList li').length===2");
 const restored=await evaluate("import('/dj-library.js').then(m=>m.readTransitionLibrary())");assert.equal(restored[0].name,'Geändert');
 assert.deepEqual(errors,[]);
 console.log('Transition library passed: create, save, queue snapshot, edit isolation, move existing, reorder invalidation, saved timing during playback, responsive layout and persistence.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
