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
 if(url.endsWith('structure')){const duration=options.body.byteLength/176400,count=Math.ceil(duration*10);return response({version:1,source:'all-in-one',duration,segments:[{start:0,end:duration,label:'intro'}],instruments:{version:1,source:'htdemucs',step:.1,bass:Array(count).fill(.6),vocals:Array(count).fill(.01),drums:Array(count).fill(.1),other:Array(count).fill(.1)}});}
 if(url.endsWith('beats')){const step=window.beatRequests++%2===0?.5:.6;return response({version:1,source:'beat-this',duration,beats:Array.from({length:Math.floor(duration/step)},(_,i)=>i*step),downbeats:Array.from({length:Math.floor(duration/(4*step))},(_,i)=>i*4*step)});}
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 if(process.argv.includes('--pair'))await evaluate(`document.querySelector('#djStructure').checked=true;
 const Native=AudioContext;window.filters=[];window.AudioContext=class extends Native{createBiquadFilter(){const node=super.createBiquadFilter();filters.push(node);return node;}};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.dataset.analysis==='complete')");


 if(process.argv.includes('--plain'))await evaluate("document.querySelector('#autoBeat').checked=false;document.querySelector('#autoBeat').dispatchEvent(new Event('change'))");
 if(process.argv.includes('--queue')){
 await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));document.querySelector('#fadeDuration').value='4';document.querySelector('#enqueueAll').click()`);
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('#queueStart').click()");
 }else{
 await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));
 document.querySelector('[aria-label="Auf Deck A laden"]').click();document.querySelectorAll('[aria-label="Auf Deck B laden"]')[1].click();document.querySelector('#fadeDuration').value='4';`);
 await wait("[...document.querySelectorAll('.dj-play')].every(b=>!b.disabled)");
 await evaluate("document.querySelector('.dj-play').click()");
 }
 if(process.argv.includes('--manual')){
  await wait("document.querySelectorAll('.dj-deck audio')[1].readyState>=1&&!document.querySelectorAll('.dj-set-cue')[1].disabled");
  await evaluate("document.querySelectorAll('.dj-deck audio')[1].currentTime=.6;document.querySelectorAll('.dj-set-cue')[1].click()");
 }
 if(process.argv.includes('--adaptive'))await evaluate("document.querySelector('#fadeDuration').value='auto'");
 await wait("document.querySelector('audio').currentTime>.2");
 await evaluate("const seek=document.querySelector('.dj-seek');seek.value=7.6;seek.dispatchEvent(new Event('input'))");
 if(process.argv.includes('--manual'))await evaluate("document.querySelector('#fadeNow').click()");
 await wait("!document.querySelectorAll('audio')[1].paused");
 const started=await evaluate("({time:document.querySelector('audio').currentTime,status:document.querySelector('#fadeStatus').textContent})");
 if(process.argv.includes('--pair')){
  if(!started.status.includes('Bassübergabe'))throw Error('Pair plan not applied: '+JSON.stringify(started));
  await wait("filters.filter(f=>f.type==='lowshelf'&&f.gain.value<-1).length>0",2000);
 }
 if(process.argv.includes('--manual')){
  const incoming=await evaluate("document.querySelectorAll('.dj-deck audio')[1].currentTime");
  if(incoming<2.4||incoming>3)throw Error('Manual fade ignored musical incoming cue: '+incoming);
  if(!started.status.includes('musikalischer Start'))throw Error('Manual musical start missing');
 }else if(process.argv.includes('--adaptive')){
  if(started.time<7.6||started.time>11)throw Error('Adaptive transition ignored current position: '+JSON.stringify(started));
  if(!started.status.includes('musikalischer Start'))throw Error('Adaptive musical status missing');
 }else if(process.argv.includes('--plain')){
  if(started.time<8.9||started.time>9.6)throw Error('Fixed transition did not start around 9 s: '+JSON.stringify(started));
  if(started.status.includes('musikalischer Start'))throw Error('Musical selection must be disabled');
 }else{
  if(started.time<7.9||started.time>=9)throw Error('Not on early bar boundary: '+JSON.stringify(started));
  if(!started.status.includes('musikalischer Start'))throw Error('Missing musical status '+JSON.stringify(started));
 }
 if(!await evaluate("[...document.querySelectorAll('.dj-deck audio')].every(a=>a.playbackRate===1)"))throw Error('Automatic transition changed playback tempo');
 if(process.argv.includes('--cancel')){
  await evaluate("document.querySelector('#fadeCancel').click()");
  await new Promise(r=>setTimeout(r,250));
  if(!await evaluate("filters.every(f=>Math.abs(f.gain.value)<.1)"))throw Error('Cancelled transition filters not reset');
 }else await wait("document.querySelector('audio').paused&&document.querySelector('#crossfader').value==='1'");
 if(!await evaluate('window.rateWrites.every(rate=>rate===1)'))throw Error('Automatic playback wrote a tempo change');
 if(process.argv.includes('--pair')){
  await new Promise(r=>setTimeout(r,200));
  if(!await evaluate("filters.every(f=>Math.abs(f.gain.value)<.1)"))throw Error('Transition filters not reset');
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('Audio crossfade passed ('+(process.argv.includes('--plain')?'fixed time':'musical boundary')+'): 120/100 BPM tracks kept original tempo throughout, including start and fade.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
