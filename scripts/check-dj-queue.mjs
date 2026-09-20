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
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-WiZ-Local':'1'},body:'{}'});
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
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:[.25,.75,1.25,1.75],downbeats:[.25]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Fertig'))");
 await evaluate("document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[0].click();document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[1].click();document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[0].click();document.querySelector('#fadeDuration').value='2'");
 await wait("document.querySelector('#queueCount').textContent==='3'");await evaluate("document.querySelector('#queueStart').click()");
 await wait("document.querySelectorAll('audio')[0].currentTime>.2&&document.querySelector('#queueCount').textContent==='2'&&document.querySelectorAll('.dj-track-title')[1].textContent.endsWith('.mp3')");
 await evaluate("document.querySelectorAll('audio')[0].currentTime=9.8");
 await wait("document.querySelector('#crossfader').value==='1'&&document.querySelectorAll('audio')[0].paused&&document.querySelector('#queueCount').textContent==='1'",10000);
 await wait("document.querySelectorAll('.dj-track-title')[0].textContent.endsWith('.wav')");
 await evaluate("document.querySelectorAll('audio')[1].currentTime=9.8");
 await wait("document.querySelector('#crossfader').value==='0'&&document.querySelectorAll('audio')[1].paused&&document.querySelector('#queueCount').textContent==='0'",10000);
 await evaluate("document.querySelectorAll('audio')[0].currentTime=11.8");await wait("document.querySelector('#queueStatus').textContent==='Warteschlange beendet'");
 // Save, reorder and remove pending entries. No automatic playback after reload.
 await evaluate("document.querySelector('#enqueueAll').click()");
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('#queueList button[aria-label=\"Später abspielen\"]').click()");
 await wait("document.querySelector('#queueList strong').textContent.endsWith('.mp3')");
 await evaluate("document.querySelector('#queueList button[aria-label=\"Aus Warteschlange entfernen\"]').click()");await wait("document.querySelector('#queueCount').textContent==='1'");
 await wait("(async()=>{const q=await (await import('/dj-library.js')).readQueue();return q?.length===1;})()");
 await c('Page.reload');await wait("document.querySelector('#queueCount')?.textContent==='1'");
 const restored=await evaluate("document.querySelector('#queueStart').textContent==='Start'&&[...document.querySelectorAll('audio')].every(a=>a.paused)");if(!restored)throw Error('Queue reload started playback');
 const layouts=[];
 for(const [width,height] of [[1280,720],[1024,768],[390,844]]){
 await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 const layout=await evaluate("(()=>{const library=document.querySelector('#libraryDrop').getBoundingClientRect(),queue=document.querySelector('.dj-queue').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,sideBySide:library.right<=queue.left&&Math.abs(library.top-queue.top)<1,bothListsVisible:[...document.querySelectorAll('#trackList,#queueList')].every(list=>list.getBoundingClientRect().height>70&&!list.hidden)};})()");
 if(layout.scrollWidth>width||(width>760&&layout.scrollHeight>height)||!layout.sideBySide||!layout.bothListsVisible)throw Error('Layout regression '+JSON.stringify(layout));layouts.push(layout);
 if(width===1280||width===390){const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(tmpdir(),`wiz-dj-containers-${width}.png`),Buffer.from(shot.data,'base64'));}

 }
 if(errors.length)throw Error(JSON.stringify(errors));const result={threeTracks:true,twoAutomaticCrossfades:true,finished:true,reorder:true,remove:true,restored,layouts,browserErrors:0};console.log(JSON.stringify(result,null,2));await writeFile(join(projectRoot,'reports/dj-queue-browser-check.json'),JSON.stringify(result,null,2)+'\n');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
