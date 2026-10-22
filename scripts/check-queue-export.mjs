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
const {BeatAnalysis}=await import('../lib/beat-analysis.mjs');const app=await createApp({demo:true,beatAnalysis:new BeatAnalysis({ready:async()=>{throw Error('Test uses builtin analysis');}})});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
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
 const c=(method,params)=>command(method,params,sessionId);await c('Runtime.enable');await c('Page.enable');
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression+' '+JSON.stringify(errors)+' '+await evaluate("({queue:document.querySelector('#queueStatus')?.textContent,status:document.querySelector('#djStatus')?.textContent,count:document.querySelector('#queueCount')?.textContent,start:document.querySelector('#queueStart')?.textContent,decks:[...document.querySelectorAll('audio')].map(a=>({time:a.currentTime,paused:a.paused}))})"));};
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
 await evaluate(`window.row=ending=>[...document.querySelectorAll('#trackList>li')].find(li=>li.querySelector('strong').textContent.endsWith(ending));
 window.cut=(a,b)=>{const d=document.querySelector('.dj-cut-editor');d.querySelector('[data-start]').value=a;d.querySelector('[data-end]').value=b;d.querySelector('[data-remove]').click();};
 row('.wav').querySelector('[aria-label="Lied schneiden"]').click();`);
 await wait("document.querySelector('.dj-cut-editor[open]')");
 await evaluate("cut(4,8)");
 const originalSafe=await evaluate("document.querySelector('.dj-cut-editor [data-duration]').textContent.includes('0:08')");
 if(!originalSafe)throw Error('Wrong edited duration');
 await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const editorOverflow=await evaluate("document.querySelector('.dj-cut-editor').scrollWidth>document.querySelector('.dj-cut-editor').clientWidth");
 if(editorOverflow)throw Error('Mobile cut editor overflows');
 let shot=await c('Page.captureScreenshot',{format:'png'});await writeFile(join(projectRoot,'reports/dj-cut-editor-mobile.png'),Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('.dj-cut-editor [data-undo]').click()");
 if(!await evaluate("document.querySelector('.dj-cut-editor [data-cuts]').children.length===0"))throw Error('Undo failed');
 await evaluate("cut(4,8);document.querySelector('.dj-cut-editor [data-save]').click()");
 await wait("!document.querySelector('.dj-cut-editor')");
 await evaluate("row('.mp3').querySelector('[aria-label=\"Lied schneiden\"]').click()");await wait("document.querySelector('.dj-cut-editor[open]')");
 await evaluate("cut(0,2);document.querySelector('.dj-cut-editor [data-save]').click()");await wait("!document.querySelector('.dj-cut-editor')");
 const persisted=await evaluate("(async()=>{const ts=await (await import('/dj-library.js')).readLibrary();return ts.every(t=>t.audioCuts?.length===1);})()");
 if(!persisted)throw Error('Cuts were not persisted');
 await evaluate("row('.wav').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();row('.mp3').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();document.querySelector('#autoBeat').checked=false;document.querySelector('#fadeDuration').value='2'");
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('#queueExport').click();document.querySelector('[data-export-format=mp3]').click()");await wait("document.querySelector('.dj-export-dialog[open]')");
 if(!await evaluate("document.querySelector('.dj-export-dialog [data-summary]').textContent.includes('0:16')"))throw Error('Wrong export schedule');
 await evaluate("document.querySelector('.dj-export-dialog [data-start]').click()");
 await wait("document.querySelector('.dj-export-dialog [data-download]')?.hidden===false",60000);
 await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fixtures});
 await evaluate("document.querySelector('.dj-export-dialog [data-download]').click()");
 let downloaded;
 for(let i=0;i<100;i++){downloaded=(await readdir(fixtures)).find(f=>f.startsWith('AnyDj-Mix-')&&f.endsWith('.mp3'));if(downloaded)break;await new Promise(r=>setTimeout(r,100));}
 if(!downloaded)throw Error('MP3 download did not complete');
 const exported=join(fixtures,downloaded);
 const {stdout:probe}=await promisify(execFile)('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',exported]);
 const info=JSON.parse(probe);if(Math.abs(Number(info.format.duration)-16)>.1||info.streams[0].codec_name!=='mp3'||info.streams[0].channels!==2)throw Error('Invalid MP3 '+probe);
 const {stdout:pcm}=await promisify(execFile)('ffmpeg',['-v','error','-i',exported,'-f','f32le','-ac','1','-ar','44100','pipe:1'],{encoding:'buffer',maxBuffer:8*1024*1024});
 function tone(start,frequency){let x=0,y=0;const n=4410;for(let i=0;i<n;i++){const sample=pcm.readFloatLE((Math.floor(start*44100)+i)*4),p=2*Math.PI*frequency*i/44100;x+=sample*Math.cos(p);y+=sample*Math.sin(p);}return Math.hypot(x,y)/n;}
 if(tone(1,440)<.02||tone(14,880)<.02||tone(1,880)>.002)throw Error('Exported order/audio did not match both titles');
 function rms(start){let sum=0;for(let i=0;i<4410;i++)sum+=pcm.readFloatLE((Math.floor(start*44100)+i)*4)**2;return Math.sqrt(sum/4410);}
 if(rms(9.96)<.02||rms(10.03)<.02)throw Error('Chunk boundary created silence');
 const exportOverflow=await evaluate("document.querySelector('.dj-export-dialog').scrollWidth>document.querySelector('.dj-export-dialog').clientWidth");if(exportOverflow)throw Error('Mobile export dialog overflows');
 shot=await c('Page.captureScreenshot',{format:'png'});await writeFile(join(projectRoot,'reports/dj-queue-export-mobile.png'),Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('.dj-export-dialog [data-close]').click();row('.wav').querySelector('[aria-label=\"Auf Deck A laden\"]').click()");
 await wait("document.querySelectorAll('audio')[0].readyState>0");
 await evaluate("document.querySelector('#autoCrossfade').checked=false;document.querySelector('.dj-play').click()");await wait("!document.querySelectorAll('audio')[0].paused");
 await evaluate("document.querySelectorAll('audio')[0].currentTime=5");await wait("document.querySelectorAll('audio')[0].currentTime>=8",5000);
 await evaluate("document.querySelector('.dj-play').click()");
 // A cancelled encoder releases its worker and never returns a partial download.
 const cancelled=await evaluate(`(async()=>{const {planQueueExport}=await import('/queue-export-plan.js'),{exportQueueAudio}=await import('/queue-audio-export.js');const controller=new AbortController();controller.abort();try{await exportQueueAudio(planQueueExport([{id:'a',trackId:'a'}],[{id:'a',plan:{duration:1}}]),[],{signal:controller.signal});return false;}catch(e){return e.name==='AbortError';}})()`);
 if(!cancelled)throw Error('Abort failed');
 // Exercise a full automatic handover with an internal cut and removed intro.
 await evaluate("document.querySelector('#queueStart').click()");
 await wait("document.querySelector('#queueCount').textContent==='1'&&!document.querySelectorAll('audio')[0].paused&&document.querySelectorAll('.dj-track-title')[1].textContent.endsWith('.mp3')");
 await evaluate("document.querySelectorAll('audio')[0].currentTime=10.05");
 await wait("document.querySelector('#queueCount').textContent==='0'&&!document.querySelectorAll('audio')[1].paused");
 if(!await evaluate("document.querySelectorAll('audio')[1].currentTime>=2"))throw Error('Removed intro was played during crossfade');
 await wait("document.querySelector('#crossfader').value==='1'&&document.querySelectorAll('audio')[0].paused",10000);
 await evaluate("document.querySelectorAll('audio')[1].currentTime=11.85");
 await wait("document.querySelector('#queueStatus').textContent==='Warteschlange beendet'",5000);
 await evaluate("document.querySelector('#enqueueAll').click()");
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await c('Page.reload');await wait("document.querySelector('#queueCount')?.textContent==='2'");
 const restored=await evaluate("(async()=>{const ts=await (await import('/dj-library.js')).readLibrary();return ts.every(t=>t.audioCuts?.length===1)&&[...document.querySelectorAll('audio')].every(a=>a.paused);})()");if(!restored)throw Error('Cuts/reload regression');
 if(errors.length)throw Error(JSON.stringify(errors));
 const result={twoLocalTracks:true,mp3:info,cutEditor:{undo:true,persisted,restored,mobileOverflow:false},liveSkipsRemovedPassages:true,automaticCutCrossfade:true,originalsUnchanged:true,queueRetained:true,mp3Decodes:true,audioOrderVerified:true,chunkBoundaryWithoutSilence:true,cancelled,browserErrors:errors.length};
 console.log(JSON.stringify(result,null,2));await writeFile(join(projectRoot,'reports/dj-queue-export-check.json'),JSON.stringify(result,null,2)+'\n');
}finally{ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
