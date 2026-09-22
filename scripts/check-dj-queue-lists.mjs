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
await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=13','-ar','16000',wav]);
await promisify(execFile)('ffmpeg',['-v','error','-i',wav,mp3]);
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
 await c('Page.addScriptToEvaluateOnNewDocument',{source:`window.rateWrites=[];const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'playbackRate');Object.defineProperty(HTMLMediaElement.prototype,'playbackRate',{...descriptor,set(value){window.rateWrites.push(value);descriptor.set.call(this,value);}});`});
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 await evaluate(`document.querySelector('#djStructure').checked=false;window.beatRequests=0;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats')){const step=window.beatRequests++%2===0?.5:.6;return response({version:1,source:'beat-this',duration,beats:Array.from({length:Math.floor(duration/step)},(_,i)=>i*step),downbeats:Array.from({length:Math.floor(duration/(4*step))},(_,i)=>i*4*step)});}
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.dataset.analysis==='complete')");


 await evaluate("document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));document.querySelector('#fadeDuration').value='2';document.querySelector('#enqueueAll').click();document.querySelector('#queueSaveList').click();var listName=document.querySelector('#queueName');listName.value='Warm-up';listName.dispatchEvent(new Event('input'))");
 await wait("document.querySelector('#queueCount').textContent==='2'&&document.querySelector('#queueSaved').textContent.includes('gespeichert')");
 const first=await evaluate("document.querySelector('#queueSelect').value");
 await evaluate("document.querySelector('[aria-label=\"Übergang vom vorherigen Titel vorbereiten\"]').click()");
 await wait("document.querySelector('.dj-transition-preview').open");
 assert.ok(await evaluate("[...document.querySelectorAll('.dj-deck audio')].every(a=>a.paused&&!a.src)"),'preparation leaves decks unloaded');
 await evaluate("const dialog=document.querySelector('.dj-transition-preview');for(const [key,value] of [['time',8],['cue',1],['duration',2]]){const e=dialog.querySelector('[data-edit-'+key+']');e.value=value;e.dispatchEvent(new Event('input'));}dialog.querySelector('[data-add]').click();dialog.querySelector('[data-choose]').click()");
 await wait("document.querySelector('.dj-transition-preview [data-status]').textContent.includes('gespeichert')");
 const savedTransition=await evaluate("import('/dj-library.js').then(m=>m.readQueueLists()).then(data=>data.lists[0].entries[1].transition)");
 assert.equal(savedTransition.plan.time,8);assert.ok(savedTransition.plan.points);
 await evaluate("document.querySelector('.dj-transition-preview').close()");
 await evaluate("document.querySelector('#queueStart').click()");
 await wait("!document.querySelector('audio').paused");
 assert.equal(await evaluate("document.querySelector('#queueSelect').value"),first);
 assert.equal(await evaluate("document.querySelector('#queueCount').textContent"),'2');
 await evaluate("document.querySelector('#queueNew').click();var listName=document.querySelector('#queueName');listName.value='Party';listName.dispatchEvent(new Event('input'));document.querySelectorAll('[aria-label=\"In Warteschlange einreihen\"]')[1].click()");
 const second=await evaluate("document.querySelector('#queueSelect').value");
 await wait("document.querySelector('#queueCount').textContent==='1'&&document.querySelector('#queueLive').textContent.includes('läuft weiter')");
 await evaluate("document.querySelector('[aria-label=\"Aus Warteschlange entfernen\"]').click()");
 await wait("document.querySelector('#queueCount').textContent==='0'");
 const queueData=await evaluate("import('/dj-library.js').then(m=>m.readQueue())");assert.equal(queueData.length,1,'background edits leave live queue alone');
 await evaluate("document.querySelector('#enqueueAll').click()");
 await wait("document.querySelector('#queueSaved').textContent.includes('gespeichert')");
 const beforeOrder=await evaluate("[...document.querySelectorAll('#queueList strong')].map(n=>n.textContent.slice(3))");
 await evaluate("document.querySelector('#queueList [aria-label=\"Später abspielen\"]').click()");
 await wait("document.querySelector('#queueSaved').textContent.includes('gespeichert')");
 assert.deepEqual(await evaluate("[...document.querySelectorAll('#queueList strong')].map(n=>n.textContent.slice(3))"),[...beforeOrder].reverse());
 await evaluate("document.querySelector('.dj-queue').scrollIntoView({block:'center'})");
 await writeFile(new URL('../reports/dj-queue-lists.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('audio').currentTime=10.8");
 await wait("!document.querySelectorAll('audio')[1].paused");
 assert.ok(await evaluate("document.querySelector('#fadeStatus').textContent.includes('Gespeicherter Set-Übergang')"),'live playback uses the saved plan');
 assert.ok(await evaluate("document.querySelectorAll('.dj-deck audio')[1].currentTime>=1"),'saved entry cue is applied');
 assert.equal(await evaluate("document.querySelector('#queueSelect').value"),second,'view remains on preparation list');
 const lists=await evaluate("import('/dj-library.js').then(m=>m.readQueueLists())");
 assert.equal(lists.lists.find(l=>l.id===first).entries.length,2,'saved source not consumed');
 assert.deepEqual(lists.lists.find(l=>l.id===first).entries[1].transition,savedTransition);
 assert.equal(lists.lists.find(l=>l.id===second).entries.length,2);
 await evaluate("document.querySelector('#djStop').click()");
 await c('Page.reload');await wait("document.querySelector('#queueSelect').options.length===3");
 await wait(`document.querySelector('#queueSelect').value===${JSON.stringify(second)}`);
 assert.equal(await evaluate("document.querySelector('#queueSelect').value"),second);
 assert.equal(await evaluate("document.querySelector('#queueName').value"),'Party');
 assert.equal(await evaluate("document.querySelector('#queueCount').textContent"),'2');
 assert.ok(await evaluate("[...document.querySelectorAll('.dj-deck audio')].every(a=>a.paused)"),'reload never autostarts');
 await evaluate("window.confirm=()=>true;document.querySelector('#queueDeleteList').click()");
 await wait("document.querySelector('#queueSelect').options.length===2");
 const restoredLists=await evaluate("import('/dj-library.js').then(m=>m.readQueueLists())");
 assert.equal(restoredLists.lists[0].name,'Warm-up');assert.deepEqual(restoredLists.lists[0].entries[1].transition,savedTransition);
 await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('#trackList .dj-track-more summary').click()");
 assert.ok(await evaluate("document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]').checkVisibility()"),'deck loading accessible in More');
 assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
 assert.deepEqual(errors,[]);
 console.log('Named queues passed: prepare during playback, independent edits, intact saved source, live crossfade, reload, delete and mobile.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
