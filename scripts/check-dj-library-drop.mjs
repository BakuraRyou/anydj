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
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Fertig'))");



 async function dropTrack(index,selector,edge='center'){
  const data=await evaluate(`(()=>{window.dragSource=document.querySelectorAll('#trackList>li')[${index}];const data=new DataTransfer();dragSource.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));return data.getData('application/x-wiz-track');})()`);
  const position=await evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});target.scrollIntoView({block:'nearest'});const r=target.getBoundingClientRect();return {x:r.left+r.width/2,y:${edge==='before'?'r.top+3':edge==='after'?'r.bottom-3':'r.top+Math.min(r.height/2,40)'}};})()`);
  const drag={items:[{mimeType:'application/x-wiz-track',data}],dragOperationsMask:1};
  await c('Input.dispatchDragEvent',{type:'dragEnter',...position,data:drag});await c('Input.dispatchDragEvent',{type:'dragOver',...position,data:drag});
  await new Promise(r=>setTimeout(r,450));
  assert.ok(await evaluate("dragSource.isConnected"),'source remains attached while dragging');
  await c('Input.dispatchDragEvent',{type:'drop',...position,data:drag});
  await evaluate("dragSource.dispatchEvent(new DragEvent('dragend',{bubbles:true}))");
 }
 await dropTrack(0,'#queueList');await wait("document.querySelector('#queueCount').textContent==='1'");
 await dropTrack(1,'#queueList [data-queue-id]','before');await wait("document.querySelector('#queueCount').textContent==='2'");
 assert.ok(await evaluate("document.querySelector('#queueList strong').textContent.endsWith('test.mp3')"));
 await dropTrack(0,'#queueList [data-queue-id]','after');await wait("document.querySelector('#queueCount').textContent==='3'");
 const live=await evaluate("import('/dj-library.js').then(m=>m.readQueue())");assert.equal(live.length,3);
 await evaluate("document.querySelector('#queueNew').click()");await wait("document.querySelector('#queueCount').textContent==='0'");
 await dropTrack(1,'#queueList');await wait("document.querySelector('#queueCount').textContent==='1'&&document.querySelector('#queueSaved').textContent.includes('gespeichert')");
 assert.equal((await evaluate("import('/dj-library.js').then(m=>m.readQueue())")).length,3,'dropping into saved list leaves live queue intact');
 assert.equal((await evaluate("import('/dj-library.js').then(m=>m.readQueueLists())")).lists[0].entries.length,1);
 assert.equal(await evaluate("document.querySelectorAll('#trackList>li').length"),2,'drop copies, never removes library titles');
 assert.ok(await evaluate("[...document.querySelectorAll('.dj-deck audio')].every(a=>a.paused)"));
 assert.deepEqual(errors,[]);
 console.log('Library drag/drop passed: empty queue, insert before/after, source survives updates, persistence, named list isolation and no autoplay.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
