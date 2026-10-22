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
await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=4','-f','lavfi','-i','sine=frequency=1760:duration=4','-f','lavfi','-i','sine=frequency=880:duration=4','-filter_complex','[0:a][1:a][2:a]concat=n=3:v=0:a=1','-ar','16000',wav]);
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
 await evaluate("cut(4,8);document.querySelector('[data-cut-join]').click()");await wait("document.querySelector('.dj-transition-preview[open]')");
 const initial=await evaluate("(()=>{const d=document.querySelector('.dj-transition-preview[open]');return {time:+d.querySelector('[data-edit-time]').value,cue:+d.querySelector('[data-edit-cue]').value,duration:+d.querySelector('[data-edit-duration]').value};})()");
 if(initial.time!==3||initial.cue!==8||initial.duration!==1)throw Error('Wrong internal join '+JSON.stringify(initial));
 await evaluate("document.querySelector('.dj-transition-preview[open] [data-edit-style]').value='bass';document.querySelector('.dj-transition-preview[open] [data-edit-style]').dispatchEvent(new Event('change'));document.querySelector('.dj-transition-preview[open] [data-choose]').click()");
 await wait("!document.querySelector('.dj-transition-preview[open]')");
 const clocks=await evaluate("({ruler:[...document.querySelectorAll('[data-ruler] span')].map(n=>n.textContent),position:document.querySelector('[data-clock]').textContent,duration:document.querySelector('[data-duration]').textContent,join:document.querySelector('[data-cut-join]').textContent})");
 if(!clocks.duration.includes('0:07,00')||clocks.ruler.length<5||!clocks.position.includes('Original')||!clocks.position.includes('Bearbeitet')||!clocks.join.includes('1.00'))throw Error(JSON.stringify(clocks));
 const joinedShot=await c('Page.captureScreenshot',{format:'png'});await writeFile(join(projectRoot,'reports/dj-cut-joins-mobile.png'),Buffer.from(joinedShot.data,'base64'));
 await evaluate("document.querySelector('.dj-cut-editor [data-save]').click()");await wait("!document.querySelector('.dj-cut-editor')");
 const persisted=await evaluate("(async()=>{const rows=await (await import('/dj-library.js')).readLibrary();return rows.find(t=>t.name.endsWith('.wav')).audioCutJoins;})()");
 if(persisted.length!==1||persisted[0].style!=='bass'||persisted[0].duration!==1)throw Error('Join not persisted');
 await evaluate("row('.wav').querySelector('[aria-label=\"In Warteschlange einreihen\"]').click();document.querySelector('#queueExport').click()");await wait("document.querySelector('.dj-export-dialog[open]')");
 await evaluate("document.querySelector('.dj-export-dialog [data-start]').click()");await wait("document.querySelector('.dj-export-dialog [data-download]')?.hidden===false",60000);
 await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fixtures});await evaluate("document.querySelector('.dj-export-dialog [data-download]').click()");
 let downloaded;for(let i=0;i<100;i++){downloaded=(await readdir(fixtures)).find(f=>f.startsWith('AnyDj-Mix-')&&f.endsWith('.mp3'));if(downloaded)break;await new Promise(r=>setTimeout(r,100));}if(!downloaded)throw Error('Download missing');
 const {stdout:probe}=await promisify(execFile)('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',join(fixtures,downloaded)]),info=JSON.parse(probe);
 if(Math.abs(Number(info.format.duration)-7)>.1)throw Error('Internal crossfade missing from MP3 '+probe);
 const {stdout:pcm}=await promisify(execFile)('ffmpeg',['-v','error','-i',join(fixtures,downloaded),'-f','f32le','-ac','1','-ar','44100','pipe:1'],{encoding:'buffer',maxBuffer:8*1024*1024});
 function tone(start,frequency){let x=0,y=0;const n=4410;for(let i=0;i<n;i++){const sample=pcm.readFloatLE((Math.floor(start*44100)+i)*4),phase=2*Math.PI*frequency*i/44100;x+=sample*Math.cos(phase);y+=sample*Math.sin(phase);}return Math.hypot(x,y)/n;}
 const spectrum={before:tone(1,440),after:tone(6,880),overlapA:tone(3.5,440),overlapB:tone(3.5,880),removed:tone(3.5,1760)};
 if(spectrum.before<.02||spectrum.after<.02||spectrum.overlapA<.005||spectrum.overlapB<.005||spectrum.removed>.003)throw Error('Internal mix or cut audio incorrect '+JSON.stringify(spectrum));

 await evaluate("document.querySelector('.dj-export-dialog [data-close]').click();row('.wav').querySelector('[aria-label=\"Auf Deck A laden\"]').click()");await wait("document.querySelectorAll('#decks audio')[0].readyState>0");
 await evaluate("window.primarySeeks=[];document.querySelectorAll('#decks audio')[0].addEventListener('seeked',()=>primarySeeks.push(document.querySelectorAll('#decks audio')[0].currentTime));document.querySelector('#autoCrossfade').checked=false;document.querySelector('.dj-play').click()");
 await wait("!document.querySelectorAll('#decks audio')[0].paused");
 await wait("primarySeeks.some(t=>t>=8.8&&t<9.3)",10000);
 const liveSeeks=await evaluate("primarySeeks");await evaluate("document.querySelector('.dj-play').click()");
 // The cut editor's complete-draft audition uses the same mixer as the decks.
 const raw=(await readFile(wav)).toString('base64');
 await evaluate(`(async()=>{const {openTrackCutEditor}=await import('/track-cut-editor.js');const {readLibrary}=await import('/dj-library.js');const metadata=(await readLibrary()).find(t=>t.name.endsWith('.wav'));const OriginalAudio=Audio;window.cutAudios=[];window.Audio=class extends OriginalAudio{constructor(...args){super(...args);this.seeks=[];this.addEventListener('seeked',()=>this.seeks.push(this.currentTime));cutAudios.push(this);}};window.restoreTestAudio=()=>{window.Audio=OriginalAudio;};const bytes=Uint8Array.from(atob(${JSON.stringify(raw)}),c=>c.charCodeAt(0));openTrackCutEditor({track:{...metadata,plan:{duration:12}},file:new File([bytes],'test.wav',{type:'audio/wav'}),routing:{getPreviewOutput:()=>({deviceId:'',label:'Muted test output'})},onSave:async()=>{}});document.querySelector('.dj-cut-editor [data-start]').value='4';document.querySelector('.dj-cut-editor [data-end]').value='8';document.querySelector('.dj-cut-editor [data-play]').click();})()`);
 await wait("cutAudios[0]?.seeks.some(t=>t>=8.8&&t<9.3)",10000);
 const editorAudition=await evaluate("({seeks:cutAudios[0].seeks,clock:document.querySelector('.dj-cut-editor [data-clock]').textContent})");
 await evaluate("document.querySelector('.dj-cut-editor [data-close]').click();restoreTestAudio()");
 await c('Page.reload');await wait("document.querySelector('#queueCount')?.textContent==='1'");
 const restored=await evaluate("(async()=>{const rows=await (await import('/dj-library.js')).readLibrary();return rows.find(t=>t.name.endsWith('.wav')).audioCutJoins?.[0]?.duration===1;})()");
 if(!restored||errors.length)throw Error('Reload or browser regression '+JSON.stringify(errors));
 const result={clocks,internalManager:initial,persisted,restored,mp3:info,spectrum,liveSeeks,editorAudition,browserErrors:errors.length};console.log(JSON.stringify(result,null,2));await writeFile(join(projectRoot,'reports/dj-cut-joins-check.json'),JSON.stringify(result,null,2)+'\n');
}finally{ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
