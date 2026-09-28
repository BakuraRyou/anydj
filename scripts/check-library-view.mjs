import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'wiz-dj-connection-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);
    chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.once('exit',()=>{clearTimeout(timer);reject(Error('Chrome exited'));});
  });
  ws=new WebSocket(endpoint);await once(ws,'open');
  let next=1;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  });
  const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  await c('Runtime.enable');await c('Page.enable');
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");



  await evaluate(`(async()=>{const {saveTrack}=await import('/dj-library.js');for(const track of [
   {id:'old',name:'Zulu.mp3',order:0,addedAt:100},
   {id:'middle',name:'Alpha.mp3',order:1,addedAt:200,folderId:'folder',relativePath:'Set/Alpha.mp3'},
   {id:'new',name:'Beta.mp3',order:2,addedAt:300}])await saveTrack(track);window.__beforeLibraryReload=true;})()`);
  await c('Page.reload');await wait("!window.__beforeLibraryReload&&document.querySelectorAll('#trackList .dj-track-label strong').length===3");
  const names=()=>evaluate("[...document.querySelectorAll('#trackList .dj-track-label strong')].map(n=>n.textContent)");
  const change=(id,value)=>evaluate(`{const n=document.getElementById('${id}');n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('${id==='trackSearch'?'input':'change'}',{bubbles:true}));}`);
  assert.deepEqual(await names(),['Beta.mp3','Alpha.mp3','Zulu.mp3']);
  await change('trackSort','az');assert.deepEqual(await names(),['Alpha.mp3','Beta.mp3','Zulu.mp3']);
  await change('trackFilter','folder');assert.deepEqual(await names(),['Alpha.mp3']);
  await change('trackSearch','SET');assert.deepEqual(await names(),['Alpha.mp3']);
  await change('trackSearch','missing');assert.deepEqual(await names(),[]);
  assert.equal(await evaluate("document.querySelector('#trackList').textContent"),'Keine Treffer');
  await change('trackSearch','');await change('trackFilter','all');await change('trackSort','oldest');
  assert.deepEqual(await names(),['Zulu.mp3','Alpha.mp3','Beta.mp3']);
  await evaluate("document.querySelector('#enqueueAll').click()");
  assert.deepEqual(await evaluate("(async()=>{const {readQueue}=await import('/dj-library.js');return (await readQueue()).map(e=>e.trackId);})()"),['old','middle','new']);
  await evaluate('window.__beforeLibraryReload=true');await c('Page.reload');
  await wait("!window.__beforeLibraryReload&&document.querySelectorAll('#trackList .dj-track-label strong').length===3");
  assert.equal(await evaluate("document.querySelector('#trackSort').value"),'oldest');
  for(const [width,height] of [[1280,900],[390,844]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await evaluate("document.querySelector('#libraryTools').scrollIntoView({block:'center'})");
   assert.equal(await evaluate("document.querySelector('#trackFilter').checkVisibility()"),false);
   await evaluate("document.querySelector('#libraryFilterButton').click()");
   await wait("document.querySelector('#libraryFilterButton').getAttribute('aria-expanded')==='true'");
   assert.equal(await evaluate("['trackSearch','libraryFilterButton','trackFilter','trackSort'].every(id=>{const n=document.getElementById(id),r=n.getBoundingClientRect();return n.checkVisibility()&&r.left>=0&&r.right<=innerWidth;})"),true);
   await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await wait("!document.querySelector('#libraryFilterPopover').matches(':popover-open')");
  }
  // Catalog extension, multiple assignments and persistence through the real UI.
  await evaluate("document.querySelector('#libraryFilterButton').click()");
  await wait("document.querySelector('#libraryFilterPopover').matches(':popover-open')");
  await evaluate("{const form=document.querySelector('#libraryFilterPopover form');form.closest('details').open=true;form.querySelector('input').value='Verträumt';form.requestSubmit();}");
  await wait("[...document.querySelectorAll('.feeling-filter label')].some(n=>n.textContent==='Verträumt')");
  await evaluate("document.querySelector('#libraryFilterPopover').hidePopover();document.querySelector('#trackList button[aria-label=\"Gefühle bearbeiten\"]').click()");
  await wait("document.querySelector('.feeling-dialog')");
  await evaluate("{const dialog=document.querySelector('.feeling-dialog');for(const label of dialog.querySelectorAll('label'))if(['Ruhig','Verträumt'].includes(label.textContent))label.querySelector('input').click();[...dialog.querySelectorAll('button')].find(n=>n.textContent==='Speichern').click();}");
  await wait("!document.querySelector('.feeling-dialog')&&document.querySelectorAll('#trackList .feeling-badges span').length===2");
  await evaluate("document.querySelector('#libraryFilterButton').click()");
  await wait("document.querySelector('#libraryFilterPopover').matches(':popover-open')");
  await evaluate("[...document.querySelectorAll('.feeling-filter label')].find(n=>n.textContent==='Verträumt').querySelector('input').click()");
  assert.deepEqual(await names(),['Zulu.mp3']);
  await evaluate('window.__beforeLibraryReload=true');await c('Page.reload');
  await wait("!window.__beforeLibraryReload&&document.querySelectorAll('#trackList .dj-track-label strong').length===1");
  assert.deepEqual(await names(),['Zulu.mp3']);
  assert.equal(await evaluate("document.querySelectorAll('#trackList .feeling-badges span').length"),2);
  assert.equal(await evaluate("[...document.querySelectorAll('.feeling-filter label')].find(n=>n.textContent==='Verträumt').querySelector('input').checked"),true);
  // A real audio import still creates persisted suggestions when model APIs fail.
  const importFallback=()=>evaluate(`{
   const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).startsWith('/api/analysis/')?Promise.reject(new TypeError('Desktop offline')):nativeFetch(url,options);
   document.querySelector('#djStructure').checked=false;
   document.querySelector('.feeling-filter button').click();
   const rate=16000,length=rate*12,buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
   const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
   text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
   for(let i=0;i<length;i++){const t=i/rate,value=(Math.sin(t*2*Math.PI*261.63)+Math.sin(t*2*Math.PI*329.63)+Math.sin(t*2*Math.PI*392))*.12;view.setInt16(44+i*2,value*32767,true);}
   const transfer=new DataTransfer();transfer.items.add(new File([buffer],'Fallback.wav',{type:'audio/wav'}));const files=document.querySelector('#djFiles');files.files=transfer.files;files.dispatchEvent(new Event('change'));
  }`);
  await importFallback();
  await wait("(async()=>{const {readLibrary}=await import('/dj-library.js');return (await readLibrary()).some(t=>t.name==='Fallback.wav'&&t.feelingAnalysis?.source==='browser');})()");
  assert.equal(await evaluate("(async()=>{const {readLibrary}=await import('/dj-library.js');return Object.keys((await readLibrary()).find(t=>t.name==='Fallback.wav').feelingAnalysis.scores).length>0;})()"),true);
  await evaluate("document.querySelector('#libraryTools').scrollIntoView({block:'center'});document.querySelector('#libraryFilterButton').click()");
  await wait("document.querySelector('#libraryFilterPopover').matches(':popover-open')");
  await writeFile(join(tmpdir(),'anydj-feeling-filter.png'),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // Standalone web edition uses the same tag UI and local signal fallback.
  await c('Page.addScriptToEvaluateOnNewDocument',{source:"const editionObserver=new MutationObserver(()=>{if(document.documentElement)document.documentElement.dataset.edition='web';if(document.body){const demo=document.createElement('button');demo.id='demoTracks';demo.hidden=true;document.body.append(demo);editionObserver.disconnect();}});editionObserver.observe(document,{childList:true,subtree:true});"});
  await evaluate('window.__beforeLibraryReload=true');await c('Page.reload');
  await wait("!window.__beforeLibraryReload&&document.querySelector('.feeling-filter')&&document.querySelector('#djStructure').disabled&&document.querySelector('#trackList').textContent==='Dateien hierher ziehen'");
  await importFallback();
  await wait("(async()=>{const {readLibrary}=await import('/dj-library.js');return (await readLibrary()).some(t=>t.name==='Fallback.wav'&&t.feelingAnalysis?.source==='browser');})()");
  await wait("document.querySelectorAll('#trackList .feeling-badges span').length>0");
  assert.deepEqual(errors,[]);console.log('Library view passed: sorting, search, responsive popover, feeling catalog, manual tags, persistence and real audio fallback.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
