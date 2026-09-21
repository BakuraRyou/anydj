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
 await c('Page.navigate',{url:base+'/'});await wait(`location.origin===${JSON.stringify(base)}&&document.readyState==='complete'`);
 await evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('wiz-dj-library',2);request.onupgradeneeded=()=>{request.result.createObjectStore('tracks',{keyPath:'id'});request.result.createObjectStore('settings');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put([{id:'migration-entry',trackId:'migration-track'}],'queue');tx.oncomplete=()=>{db.close();resolve(true);};};})`);
 await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1");



 // Open a real native popup, then let the UI refresh timers run.
 const selectPoint=await evaluate("(()=>{const r=document.querySelector('#fadeDuration').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await c('Input.dispatchMouseEvent',{type:'mousePressed',...selectPoint,button:'left',clickCount:1});
 await c('Input.dispatchMouseEvent',{type:'mouseReleased',...selectPoint,button:'left',clickCount:1});
 await wait("document.querySelector('#fadeDuration').matches(':open')",2000);
 await new Promise(resolve=>setTimeout(resolve,600));
 if(!await evaluate("document.querySelector('#fadeDuration').matches(':open')"))throw Error('Duration dropdown closed during UI refresh');
 await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await evaluate("window.lampOptionChanges=0;new MutationObserver(changes=>window.lampOptionChanges+=changes.length).observe(document.querySelector('#djLamp'),{childList:true,subtree:true})");
 await new Promise(resolve=>setTimeout(resolve,7500));
 if(await evaluate("window.lampOptionChanges"))throw Error('Unchanged connection poll rebuilt lamp options');
 const migration=await evaluate(`(async()=>{const lib=await import('/dj-library.js');const queue=await lib.readQueue();if(queue?.[0]?.id!=='migration-entry')throw Error('v2 queue lost during upgrade');await lib.saveQueue([]);return true;})()`);
 await evaluate("document.querySelector('#queueClear').click()");
 await evaluate(`document.querySelector('#djStructure').checked=false;const original=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats')){const period=(window.beatFixtureCount=(window.beatFixtureCount||0)+1)%2?.5:.55;return response({version:1,source:'beat-this',duration,beats:Array.from({length:Math.floor((duration-.25)/period)},(_,i)=>.25+i*period),downbeats:Array.from({length:Math.floor((duration-.25)/(4*period))},(_,i)=>.25+i*4*period)});}
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return original(url,options);};`);
 const {result:input}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:input.objectId,files:[wav,mp3]});
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Fertig'))");
 await evaluate("document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[0].click();document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[1].click();document.querySelectorAll('#trackList button[aria-label=\"In Warteschlange einreihen\"]')[0].click();document.querySelector('#fadeDuration').value='2'");
 await wait("document.querySelector('#queueCount').textContent==='3'");
 const queueDragCheck=await evaluate(`(async()=>{
 const lib=await import('/dj-library.js');
 await new Promise(r=>setTimeout(r,100));const before=await lib.readQueue();
 const rows=[...document.querySelector('#queueList').children],data=new DataTransfer();
 rows[2].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));
 await new Promise(r=>setTimeout(r,350));
 if(document.querySelector('#queueList').children[2]!==rows[2])throw Error('Drag source rebuilt during refresh');
 const rect=rows[0].getBoundingClientRect();
 rows[0].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data,clientY:rect.top+1}));
 if(!rows[0].classList.contains('drop-before'))throw Error('Missing insertion marker');
 rows[0].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientY:rect.top+1}));
 await new Promise(r=>setTimeout(r,100));const after=await lib.readQueue();
 if(after.map(e=>e.id).join()!==[before[2].id,before[0].id,before[1].id].join())throw Error('Queue drag order not persisted');
 const reordered=[...document.querySelector('#queueList').children],bottom=reordered[2].getBoundingClientRect();
 reordered[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));
 reordered[2].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientY:bottom.bottom-1}));
 await new Promise(r=>setTimeout(r,100));
 if((await lib.readQueue()).map(e=>e.id).join()!==before.map(e=>e.id).join())throw Error('Downward drag changed duplicate identity');
 return true;})()`);
await evaluate("document.querySelector('#queueStart').click()");
 await wait("document.querySelectorAll('audio')[0].currentTime>.2&&document.querySelector('#queueCount').textContent==='2'&&document.querySelectorAll('.dj-track-title')[1].textContent.endsWith('.mp3')");
 await evaluate("const picker=document.querySelector('.dj-color-picker');picker.open=true;picker.querySelector('.color-search').value='oze';picker.querySelector('.color-filter').value='Kühl';picker.querySelector('.color-search').dispatchEvent(new Event('input'))");
 await wait("document.querySelectorAll('.dj-color-picker .color-options option').length>=1");
 if(!await evaluate("document.querySelector('.color-options').options.length===1&&document.querySelector('.color-options').value==='ocean'"))throw Error('Color search/filter failed');
 await evaluate("document.querySelector('.color-custom').open=true;document.querySelector('.color-name').value='Testpalette';document.querySelector('.color-a').value='#123456';document.querySelector('.color-b').value='#123456';document.querySelector('.color-add').click()");
 await wait("document.querySelector('.dj-color-picker>summary span').textContent==='Testpalette'&&!document.querySelector('.dj-color-picker').open");
 await wait("document.querySelector('#previewA').style.getPropertyValue('--light-color')==='rgb(18, 52, 86)'&&document.querySelector('#previewMix').style.getPropertyValue('--light-color')==='rgb(18, 52, 86)'");
 if(!await evaluate("(async()=>{const lib=await import('/dj-library.js');return (await lib.readLibrary()).find(t=>t.name.endsWith('.wav')).colorMode.name==='Testpalette';})()"))throw Error('Track color mode not persisted');
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
 const stored=await evaluate(`(async()=>{const lib=await import('/dj-library.js');const tracks=await lib.readLibrary();const show=await lib.readShow(tracks[0],{arrangement:'auto',mood:'auto',minimum:5,maximum:75});return {frames:show?.plan.frames.length,windows:show?.windows.length};})()`);
 if(!stored.frames||!stored.windows)throw Error('Prepared base show not persisted');
 await c('Page.reload');await wait("document.querySelector('#queueCount')?.textContent==='1'");
 const restored=await evaluate("document.querySelector('#queueStart').textContent==='Start'&&[...document.querySelectorAll('audio')].every(a=>a.paused)");if(!restored)throw Error('Queue reload started playback');
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.textContent.includes('Songaufbau wartet'))");
 await evaluate(`document.querySelector('#djStructure').checked=false;window.analysisCalls=0;const original=fetch;window.fetch=(url,...args)=>{if(String(url).startsWith('/api/analysis/')){window.analysisCalls++;throw Error('Unexpected reanalysis');}return original(url,...args);};`);
 const {result:reimport}=await c('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});await c('DOM.setFileInputFiles',{objectId:reimport.objectId,files:[wav,mp3]});
 await wait("!document.querySelector('#trackList button[aria-label=\"Erneut verknüpfen\"]')");
 await evaluate("document.querySelector('#trackList button[aria-label=\"Auf Deck A laden\"]').click()");
 await wait("!document.querySelector('.dj-play').disabled");
 if(!await evaluate("document.querySelector('.dj-color-picker>summary span').textContent==='Testpalette'"))throw Error('Color mode lost on reload');
 const cacheChecks=await evaluate(`(async()=>{
 const lib=await import('/dj-library.js'),tracks=await lib.readLibrary(),options={arrangement:'auto',mood:'auto',minimum:5,maximum:75};
 const saved=await lib.readShow(tracks[0],options);
 if(await lib.readShow({...tracks[0],lastModified:tracks[0].lastModified+1},options))throw Error('Stale file accepted');
 if(await lib.readShow(tracks[0],{...options,maximum:90}))throw Error('Stale options accepted');
 const other={...tracks[0],id:'cache-test-copy',basePlan:{...saved.plan,structure:{test:true}},windows:null,refined:true,structureState:'complete'};
 await lib.saveShow(other,options);const complete=await lib.readShow(other,options);
 if(complete.windows!==null||complete.structureState!=='complete'||!complete.plan.structure)throw Error('Refinement was not saved');
 await lib.removeTrack(other.id);if(await lib.readShow(other,options))throw Error('Removed show remains');
 return {restoredFrames:saved.plan.frames.length,pendingWindows:saved.windows.length,analysisCalls:window.analysisCalls,staleFileRejected:true,staleOptionsRejected:true,refinementSaved:true,removed:true};})()`);
 if(cacheChecks.analysisCalls)throw Error('Reload/relink reran analysis');
 await evaluate(`document.querySelector('#djStructure').checked=false;window.rebuildCalls=0;const rebuildFetch=fetch;window.fetch=async(url,options={})=>{
 if(String(url).startsWith('/api/analysis/')){if(options.method==='POST')window.rebuildCalls++;
 const response=data=>new Response(JSON.stringify(data));if(options.method!=='POST')return response({available:true});
 const duration=options.body.byteLength/64000;
 if(url.endsWith('beats')){const period=(window.beatFixtureCount=(window.beatFixtureCount||0)+1)%2?.5:.55;return response({version:1,source:'beat-this',duration,beats:Array.from({length:Math.floor((duration-.25)/period)},(_,i)=>.25+i*period),downbeats:Array.from({length:Math.floor((duration-.25)/(4*period))},(_,i)=>.25+i*4*period)});}
 return response({version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]});
 }return rebuildFetch(url,options);};`);
 await evaluate("document.querySelector('#trackList button[aria-label=\"Lichtshow neu berechnen\"]').click()");
 await wait("window.rebuildCalls===2&&document.querySelector('#trackList small').textContent.includes('Fertig')");
 const recalculated=await evaluate("window.rebuildCalls===2&&!document.querySelector('.dj-play').disabled");
 // Enable sync with a second loaded track and observe actual media rates.
 await evaluate("document.querySelectorAll('#trackList button[aria-label=\"Auf Deck B laden\"]')[1].click()");
 await wait("!document.querySelectorAll('.dj-play')[1].disabled");
 await evaluate(`(async()=>{
  // Use deterministic full beat grids for this browser check, independent of model inference.
  document.querySelector('#autoBeat').checked=true;document.querySelector('#autoBeat').dispatchEvent(new Event('change'));
  document.querySelector('.dj-play').click();
 })()`);
 await wait("!document.querySelectorAll('audio')[0].paused&&document.querySelectorAll('audio')[0].currentTime>.35");
 await evaluate("document.querySelectorAll('.dj-play')[1].click()");
 await wait("!document.querySelectorAll('audio')[1].paused");
 await wait("document.querySelector('#beatStatus').textContent.includes('→')&&document.querySelectorAll('audio')[1].playbackRate>1.05");
 if(!await evaluate("[...document.querySelectorAll('audio')].every(a=>a.preservesPitch&&a.playbackRate>=.768&&a.playbackRate<=1.3)"))throw Error('Invalid beat sync rates');
 await evaluate("document.querySelector('#autoBeat').checked=false;document.querySelector('#autoBeat').dispatchEvent(new Event('change'))");
 await wait("[...document.querySelectorAll('audio')].every(a=>Math.abs(a.playbackRate-1)<.001)");
 await evaluate("document.querySelector('#djStop').click()");
 await wait("[...document.querySelectorAll('audio')].every(a=>a.paused)");
 const layouts=[];
 for(const [width,height] of [[1280,720],[1024,768],[390,844]]){
 await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 const layout=await evaluate("(()=>{const library=document.querySelector('#libraryDrop').getBoundingClientRect(),queue=document.querySelector('.dj-queue').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,sideBySide:library.right<=queue.left&&Math.abs(library.top-queue.top)<1,bothListsVisible:[...document.querySelectorAll('#trackList,#queueList')].every(list=>list.getBoundingClientRect().height>70&&!list.hidden)};})()");
 if(layout.scrollWidth>width||(width>760&&layout.scrollHeight>height)||!layout.sideBySide||!layout.bothListsVisible)throw Error('Layout regression '+JSON.stringify(layout));layouts.push(layout);
 if(width===390){await evaluate("document.querySelector('.dj-color-picker').open=true");await wait("document.querySelector('.color-search')===document.activeElement");if(!await evaluate("(()=>{const r=document.querySelector('.dj-color-menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()"))throw Error('Color menu overflows mobile viewport');}
 if(width===1280||width===390){const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(tmpdir(),`wiz-dj-containers-${width}.png`),Buffer.from(shot.data,'base64'));}

 }
 if(errors.length)throw Error(JSON.stringify(errors));const result={autoBeat:true,colorModeFilter:true,customColorMode:true,colorModePersistence:true,liveColorPreview:true,recalculated,migration,cacheChecks,threeTracks:true,twoAutomaticCrossfades:true,finished:true,reorder:true,remove:true,restored,layouts,browserErrors:0};console.log(JSON.stringify(result,null,2));await writeFile(join(projectRoot,'reports/dj-show-cache-browser-check.json'),JSON.stringify(result,null,2)+'\n');
} finally {ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});await rm(fixtures,{recursive:true,force:true});}
