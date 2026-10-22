import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const fixtures=await mkdtemp(join(tmpdir(),'anydj-queue-audio-'));
const wav=join(fixtures,'test.wav'),mp3=join(fixtures,'test.mp3');
await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=12','-ar','16000',wav]);
await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=880:duration=12','-ar','16000',mp3]);
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,dataDir:fixtures,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
const profile=await mkdtemp(join(tmpdir(),'anydj-beat-chrome-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--mute-audio','--autoplay-policy=no-user-gesture-required','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);chrome.stderr.on('data',c=>{out+=c;const match=out.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});chrome.once('exit',code=>{clearTimeout(timer);reject(Error('Chrome exited '+code+' '+out.slice(-1000)));});});
 ws=new WebSocket(endpoint);await once(ws,'open');let next=1;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 const c=(method,params)=>command(method,params,sessionId);await c('Runtime.enable');await c('Page.enable');await c('Page.addScriptToEvaluateOnNewDocument',{source:`window.playbackTimers=[];const interval=setInterval;window.setInterval=(fn,ms,...args)=>{const id=interval(fn,ms,...args);if(ms===10||ms===25)playbackTimers.push(id);return id;};`});
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression+' '+JSON.stringify(errors)+' '+JSON.stringify(await evaluate("({queue:document.querySelector('#queueStatus')?.textContent,status:document.querySelector('#djStatus')?.textContent,count:document.querySelector('#queueCount')?.textContent,start:document.querySelector('#queueStart')?.textContent,decks:[...document.querySelectorAll('audio')].map(a=>({time:a.currentTime,paused:a.paused})),cuts:[...document.querySelectorAll('.dj-cut-editor [data-status],.dj-cut-editor [data-draft-state]')].map(n=>n.textContent)})")));};
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base+'/dj'});await wait("typeof document.querySelector('#djFiles')?.onchange==='function'");



 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:[.25,.75,1.25,1.75],downbeats:[.25]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});
 await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Spielbereit'))");
 await evaluate(`window.row=ending=>[...document.querySelectorAll('#trackList>li')].find(li=>li.querySelector('strong').textContent.endsWith(ending));window.cutDialog=()=>document.querySelector('.dj-cut-editor');window.cutRange=(a,b)=>{const d=cutDialog();for(const [key,value] of [['start',a],['end',b]]){const f=d.querySelector('[data-'+key+']');f.value=value;f.dispatchEvent(new Event('input',{bubbles:true}));}d.querySelector('[data-remove]').click();};row('.wav').querySelector('[aria-label="Lied schneiden"]').click();`);
 await wait('Boolean(cutDialog())');
 await evaluate("cutRange(0,2);cutRange(4,8);cutRange(10,12);cutDialog().querySelector('[data-save]').click()");await wait('!cutDialog()');
 await evaluate("row('.wav').querySelector('[aria-label=\"Auf Deck A laden\"]').click();document.querySelector('#autoCrossfade').checked=false;window.media=()=>document.querySelector('#decks audio')");await wait('media().readyState>=1');
 await evaluate("window.seeks=[];window.samples=[];media().addEventListener('seeked',()=>seeks.push(media().currentTime));window.sampling=setInterval(()=>{if(!media().paused)samples.push(media().currentTime)},10);document.querySelector('.dj-play').click()");await wait('!media().paused');
 await wait('media().ended',18000);
 const plain=await evaluate('({seeks,samples,ended:media().ended})');console.log('plain',JSON.stringify({seeks:plain.seeks,removedSamples:plain.samples.filter(t=>t>4.08&&t<7.98).slice(0,8),count:plain.samples.length}));
 await evaluate("row('.wav').querySelector('[aria-label=\"Lied schneiden\"]').click()");await wait('Boolean(cutDialog())');
 await evaluate("cutDialog().querySelector('[data-cut-join]').click()");await wait("Boolean(document.querySelector('.dj-transition-preview[open]'))");
 await evaluate("document.querySelector('.dj-transition-preview[open] [data-choose]').click()");await wait("!document.querySelector('.dj-transition-preview[open]')");
 await evaluate("cutDialog().querySelector('[data-save]').click()");await wait('!cutDialog()');
 await evaluate("media().currentTime=0;seeks=[];samples=[];document.querySelector('.dj-play').click()");await wait('!media().paused');await wait('media().ended',18000);
 if(plain.samples.some(t=>t<1.98||t>4.08&&t<7.98||t>10.08&&t<11.98))throw Error('Deck played removed audio');
 const joined=await evaluate('({seeks,samples,ended:media().ended})');console.log('joined',JSON.stringify({seeks:joined.seeks,removedSamples:joined.samples.filter(t=>t>4.08&&t<7.98).slice(0,8),count:joined.samples.length}));
 if(!joined.seeks.some(t=>t>=8.8&&t<9.3)||joined.samples.some(t=>t>4.08&&t<7.98))throw Error('Deck cut join was not applied');
 await evaluate("clearInterval(sampling);playbackTimers.forEach(clearInterval);window.seeks=[];window.samples=[];window.sampling=setInterval(()=>{if(!media().paused)samples.push(media().currentTime)},20);document.querySelector('#queueClear').click();row('.wav').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();document.querySelector('#queueStart').click()");
 await wait('!media().paused');await wait('media().ended',18000);
 const queue=await evaluate('({seeks,samples,ended:media().ended})');console.log('queue without UI timers',JSON.stringify({seeks:queue.seeks,removedSamples:queue.samples.filter(t=>t>4.35&&t<7.98).slice(0,8)}));
 if(!queue.seeks.some(t=>t>=8&&t<10)||queue.samples.some(t=>t>4.35&&t<7.98))throw Error('Queue played removed passage');
 await c('Page.reload');await wait("document.querySelector('#decks .dj-track-title')?.textContent.includes('.wav')");
 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats'))return response({version:1,source:'beat-this',duration,beats:[.25,.75,1.25,1.75],downbeats:[.25]});
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 await evaluate("window.savedInputClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){window.reconnectInput=this;return;}return savedInputClick.call(this);};[...document.querySelectorAll('#decks button')].find(b=>b.textContent==='Datei verbinden').click()");
 const {result:reinput}=await c('Runtime.evaluate',{expression:'reconnectInput'});await c('DOM.setFileInputFiles',{objectId:reinput.objectId,files:[wav]});
 await wait("!document.querySelector('.dj-play').disabled");
 await evaluate("window.media=()=>document.querySelector('#decks audio');window.seeks=[];media().addEventListener('seeked',()=>seeks.push(media().currentTime));document.querySelector('.dj-cue').click();document.querySelector('.dj-play').click()");
 await wait('!media().paused');await wait('media().ended',18000);
 const restored=await evaluate('({seeks,ended:media().ended})');console.log('restored',JSON.stringify(restored));
 if(!restored.seeks.some(t=>t>=8&&t<10))throw Error('Restored session ignored persisted cuts');
 if(errors.length)throw Error(JSON.stringify(errors));
 const result={plain,joined,queue,restored,browserErrors:errors.length};await writeFile(join(projectRoot,'reports/dj-live-cuts-check.json'),JSON.stringify(result,null,2)+'\n');
}finally{ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
