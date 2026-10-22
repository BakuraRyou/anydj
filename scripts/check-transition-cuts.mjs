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
 window.cut=(a,b)=>{const d=document.querySelector('.dj-cut-editor');d.querySelector('[data-start]').value=a;d.querySelector('[data-end]').value=b;d.querySelector('[data-remove]').click();};row('.wav').querySelector('[aria-label="Lied schneiden"]').click();`);
 await wait("document.querySelector('.dj-cut-editor[open]')");
 await evaluate("cut(4,8);cut(10,12);document.querySelector('.dj-cut-editor [data-save]').click()");await wait("!document.querySelector('.dj-cut-editor')");
 await evaluate("row('.mp3').querySelector('[aria-label=\"Lied schneiden\"]').click()");await wait("document.querySelector('.dj-cut-editor[open]')");
 await evaluate("cut(0,2);cut(5,7);document.querySelector('.dj-cut-editor [data-save]').click()");await wait("!document.querySelector('.dj-cut-editor')");
 await evaluate("row('.wav').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();row('.mp3').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();document.querySelector('#fadeDuration').value='2'");
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('[data-queue-transition]').click()");await wait("document.querySelector('.dj-transition-preview[open]')");
 const planned=await evaluate("(()=>{const d=document.querySelector('.dj-transition-preview');return {time:+d.querySelector('[data-edit-time]').value,cue:+d.querySelector('[data-edit-cue]').value,duration:+d.querySelector('[data-edit-duration]').value,status:d.querySelector('[data-status]').textContent};})()");
 if(planned.time!==8||planned.cue!==2||planned.duration!==2||!planned.status.includes('Schnitte berücksichtigt'))throw Error('Editor ignored cuts '+JSON.stringify(planned));
 await evaluate("document.querySelector('[data-proposal-edit]').click();var field=document.querySelector('[data-edit-duration]');field.value='4';field.dispatchEvent(new Event('input',{bubbles:true}))");
 if(!await evaluate("document.querySelector('[data-choose]').disabled&&document.querySelector('[data-edit-status]').textContent.includes('Schnitten')"))throw Error('Impossible overlap accepted');
 await evaluate("var field=document.querySelector('[data-edit-duration]');field.value='2';field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelectorAll('.timeline-zoom').forEach(b=>b.click())");
 const markers=await evaluate("[...document.querySelectorAll('[data-timeline-cuts]')].map(n=>n.children.length)");
 if(markers.some(n=>n!==2))throw Error('Cut markers missing '+JSON.stringify(markers));
 await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const shot=await c('Page.captureScreenshot',{format:'png'});await writeFile(join(projectRoot,'reports/dj-transition-cuts-mobile.png'),Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('.dj-transition-preview').close()");
 // An isolated routing stub uses Chrome's default (muted) test output. Real media
 // clocks and source seeks exercise cuts in pre-roll, overlap and post-roll.
 const raw=(await readFile(wav)).toString('base64');
 await evaluate(`(async()=>{
  const {createTransitionPreview}=await import('/transition-preview.js');
  const OriginalAudio=Audio;window.previewMedia=[];window.Audio=class extends OriginalAudio{constructor(...args){super(...args);this.testSeeks=[];this.testStarts=[];this.addEventListener('seeked',()=>this.testSeeks.push(this.currentTime));this.addEventListener('playing',()=>this.testStarts.push(this.currentTime));previewMedia.push(this);}};
  const bytes=Uint8Array.from(atob(${JSON.stringify(raw)}),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
  const source=(cuts)=>({name:'Test',track:{name:'Test'},duration:12,audioCuts:cuts,url,rate:1,pitch:true,volume:1,eq:{trim:0,low:0,mid:0,high:0}});
  const host=document.createElement('section');document.body.append(host);
  window.cutPreview=createTransitionPreview({host,getPair:()=>null,routing:{getPreviewOutput:()=>({deviceId:'',label:'Isolated muted test output'})}});
  cutPreview.openPair({from:source([[4,8],[10,12]]),to:source([[0,2],[5,7]]),plan:{time:8,cue:2,duration:2,style:'smooth'},position:0,dispose:()=>{URL.revokeObjectURL(url);window.Audio=OriginalAudio;}});
  document.querySelector('.dj-transition-preview[open] [data-play]').click();
 })()`);
 await wait("previewMedia.length===2&&previewMedia[0].testSeeks.some(t=>t>=7.99&&t<=8.1)",10000);
 await wait("previewMedia[1].testSeeks.some(t=>t>=6.99&&t<=7.1)",10000);
 await wait("document.querySelector('.dj-transition-preview[open] [data-status]').textContent.includes('Hörprobe beendet')",10000);
 const playback=await evaluate("({seeks:previewMedia.map(a=>a.testSeeks),starts:previewMedia.map(a=>a.testStarts),decksUnaffected:[...document.querySelectorAll('#decks audio')].every(a=>a.paused)})");
 if(!playback.decksUnaffected||playback.starts[1][0]<2||playback.seeks[0].some(t=>t>4.05&&t<7.95)||playback.seeks[1].some(t=>t>.05&&t<1.95||t>5.05&&t<6.95))throw Error('Audition played deleted audio '+JSON.stringify(playback));
 await evaluate("document.querySelector('.dj-transition-preview[open]').close()");
 if(errors.length)throw Error(JSON.stringify(errors));
 const result={queueEditorPlan:planned,invalidOverlapRejected:true,cutMarkers:markers,realMediaAudition:playback,browserErrors:errors.length};console.log(JSON.stringify(result,null,2));
 await writeFile(join(projectRoot,'reports/dj-transition-cuts-check.json'),JSON.stringify(result,null,2)+'\n');
}finally{ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
