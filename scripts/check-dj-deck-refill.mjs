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
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:[.25,.75,1.25,1.75],downbeats:[.25]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 await evaluate(`const trackInput=document.querySelector('#djFiles'),importOriginal=trackInput.onchange;
 trackInput.onchange=event=>importOriginal({target:{files:Array.from({length:8},(_,i)=>new File([event.target.files[0]],'track-'+i+'.wav',{type:'audio/wav'})),value:''}});`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===8&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Fertig'))");

 await evaluate(`for(let i=0;i<8;i++)document.querySelectorAll('#trackList [aria-label="In Warteschlange einreihen"]')[i].click();document.querySelector('#fadeDuration').value='2';document.querySelector('#autoBeat').checked=false;document.querySelector('#autoCrossfade').checked=true;document.querySelector('#autoCrossfade').dispatchEvent(new Event('change'));document.querySelector('#queueStart').click();
 window.nativePlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=async function(){if(this.dataset.delayNext){delete this.dataset.delayNext;await new Promise(r=>setTimeout(r,650));}return nativePlay.call(this);};`);
 await wait("document.querySelector('#queueCount').textContent==='7'&&!document.querySelectorAll('.dj-deck audio')[0].paused");
 if(!await evaluate("document.querySelector('#autoCrossfade').checked"))throw Error('Queue start unchecked Auto-Crossfade');
 for(let i=0;i<7;i++){
  const from=i%2,to=1-from;
  await wait(`document.querySelectorAll('.dj-track-title')[${to}].textContent.endsWith(${JSON.stringify('track-'+(i+1)+'.wav')})&&document.querySelectorAll('.dj-deck audio')[${to}].readyState>=1`);
  await new Promise(r=>setTimeout(r,250));
  if(i===0){
   await evaluate(`{const seek=document.querySelector('.dj-seek');seek.value=2;seek.dispatchEvent(new Event('input'));const cue=document.querySelector('[data-hotcue="0"]');cue.click();seek.value=4;seek.dispatchEvent(new Event('input'));cue.click();document.querySelector('[data-jump="1"]').click();}`);
   if(await evaluate("document.querySelector('#queueStart').textContent==='Start'"))throw Error('Seeking paused queue');
  }
  if(i===1)await evaluate("document.querySelector('#fadeNow').click()");
  else await evaluate(`{const outgoing=document.querySelectorAll('.dj-deck audio')[${from}],incoming=document.querySelectorAll('.dj-deck audio')[${to}];${i===2?"incoming.dataset.delayNext='true';outgoing.currentTime=outgoing.duration-.2;":"const seek=document.querySelectorAll('.dj-seek')["+from+"];seek.value=9.8;seek.dispatchEvent(new Event('input'));"}}`);
  if(i===1){
   await wait("!document.querySelector('#fadeCancel').hidden&&!document.querySelectorAll('.dj-deck audio')[0].paused");
   await evaluate("const seek=document.querySelectorAll('.dj-seek')[1];seek.value=3;seek.dispatchEvent(new Event('input'))");
  }
  await wait(`document.querySelector('#crossfader').value==='${to}'&&document.querySelectorAll('.dj-deck audio')[${from}].paused&&document.querySelector('#queueCount').textContent==='${6-i}'`,10000);
  await wait(`document.querySelectorAll('.dj-track-title')[${from}].textContent===${JSON.stringify(i<6?'track-'+(i+2)+'.wav':'Track laden')}`,5000);
  if(!await evaluate("document.querySelector('#autoCrossfade').checked"))throw Error('Transition unchecked Auto-Crossfade');
  if(await evaluate("document.querySelector('#queueStart').textContent==='Start'"))throw Error('Queue stopped during transition '+i);
 }
 await evaluate("const last=document.querySelectorAll('.dj-deck audio')[1];last.currentTime=last.duration-.1");
 await wait("document.querySelector('#queueStatus').textContent==='Warteschlange beendet'");
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('Deck refill passed: eight distinct titles, early manual crossfade keeps queue running, freed deck loads next title after each transition and clears when queue is empty.');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
