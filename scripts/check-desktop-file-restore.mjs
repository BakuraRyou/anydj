import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

if(!process.versions.electron){
 const directory=await mkdtemp(join(tmpdir(),'anydj-file-restore-'));
 try{
  const rate=8000,n=rate*30,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*440*Math.PI*2)*3000),44+i*2);
  await writeFile(join(directory,'song.wav'),b);
  const {default:electron}=await import('electron');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  for(const stage of ['import','restart','handle-import','handle-restart'])await new Promise((resolve,reject)=>{
   const child=spawn('xvfb-run',['-a',electron,'--no-sandbox','--disable-gpu',fileURLToPath(import.meta.url),directory,stage],{env,detached:true,stdio:['ignore','pipe','pipe']});let output='';
   const timer=setTimeout(()=>{process.kill(-child.pid,'SIGKILL');reject(Error('Desktop restore test timeout: '+output));},45000);
   child.stdout.on('data',v=>{output+=v;process.stdout.write(v);});child.stderr.on('data',v=>{output+=v;});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(output));});
  });
  console.log('Desktop file restore passed: native file import and real dropped file handles, reload, complete app restart, saved seek position, paused playback, no reconnect action.');
 }finally{await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}else{
 void (async()=>{
 const {app,BrowserWindow,session,ipcMain}=await import('electron');
 const {createApp}=await import('../server.mjs');const {installLocalAudio,installLocalReadPermissions}=await import('../desktop/local-audio.mjs');const {installWindowChrome}=await import('../desktop/window-chrome.mjs');
 const entry=process.argv.findIndex(arg=>arg.endsWith('check-desktop-file-restore.mjs'));const [directory,stage]=process.argv.slice(entry+1);const handleMode=stage.startsWith('handle-'),restarting=stage.endsWith('restart');app.setPath('userData',join(directory,handleMode?'handle-profile':'profile'));
 let backend,window;
 try{
  await app.whenReady();backend=await createApp({demo:true,previewPort:0});
  const port=restarting?Number(await readFile(join(directory,'port'),'utf8')):0;
  await new Promise((resolve,reject)=>{backend.server.once('error',reject);backend.server.listen(port,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${backend.server.address().port}`;await writeFile(join(directory,'port'),String(backend.server.address().port));
  const browserSession=session.fromPartition('persist:restore-check');installLocalReadPermissions(browserSession,{origin,getWindow:()=>window});await installLocalAudio({ipcMain,origin,getWindow:()=>window,directory:join(directory,handleMode?'handle-references':'references')});
  window=new BrowserWindow({show:false,webPreferences:{session:browserSession,preload:fileURLToPath(new URL('../desktop/titlebar.cjs',import.meta.url)),sandbox:true,contextIsolation:true,nodeIntegration:false}});installWindowChrome(window,ipcMain,origin);
  const evaluate=source=>window.webContents.executeJavaScript(source,true);
  const wait=async expression=>{const end=Date.now()+15000;while(Date.now()<end){if(await evaluate('(async()=>Boolean(await ('+expression+')))()'))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+await evaluate("document.querySelector('#djStatus')?.textContent"));};
  await window.loadURL(origin+'/dj');await wait("document.querySelector('.dj-play')&&window.anydjFiles");
  if(!restarting){
   const info=await stat(join(directory,'song.wav'));
   await evaluate(`(async()=>{const {saveTrack,saveShow}=await import('/dj-library.js');const {compileShow}=await import('/show-plan.js');const windows=Array.from({length:1500},(_,i)=>({rms:.12,bass:.02,flux:0,tone:.5,beatSeq:Math.floor(i/25)}));const design={arrangement:'auto',mood:'auto',minimum:5,maximum:100};const t={id:'restore-test',name:'song.wav',size:${info.size},lastModified:${Math.trunc(info.mtimeMs)},basePlan:compileShow(windows,30,design),windows,refined:true};await saveTrack(t);await saveShow(t,design);})()`);
   await window.loadURL(origin+'/dj');await wait("document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]')");
   window.webContents.debugger.attach('1.3');
   if(handleMode){
    const point=await evaluate("(()=>{const r=document.querySelector('#libraryDrop').getBoundingClientRect();return {x:r.left+20,y:r.top+8};})()");
    for(const type of ['dragEnter','dragOver','drop'])await window.webContents.debugger.sendCommand('Input.dispatchDragEvent',{type,...point,data:{items:[],files:[join(directory,'song.wav')],dragOperationsMask:1}});
   }else{
    const {root}=await window.webContents.debugger.sendCommand('DOM.getDocument');const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#djFiles'});await window.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[join(directory,'song.wav')]});
   }
   window.webContents.debugger.detach();
   await wait("(async()=>{const {readLibrary}=await import('/dj-library.js');return (await readLibrary())[0]?.nativeFile;})()");
   await evaluate("document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]').click()");await wait("!document.querySelector('.dj-play').disabled&&document.querySelector('.dj-deck audio').readyState>=1");
   await evaluate("const seek=document.querySelector('.dj-seek');seek.value=4;seek.dispatchEvent(new Event('input'))");
   await wait("JSON.parse(localStorage.getItem('anydj-dj-session-local'))?.decks[0].time===4");
   if(handleMode){
    const handle=await evaluate("(async()=>{const {readLibrary}=await import('/dj-library.js');const track=(await readLibrary())[0];return {present:!!track.handle,permission:await track.handle?.queryPermission({mode:'read'}),size:(await track.handle?.getFile())?.size};})()");
    assert.equal(handle.present,true);assert.equal(handle.permission,'granted');assert.equal(handle.size,info.size);
    // Simulate a legacy import: only its persisted browser handle is available.
    await evaluate("window.anydjFiles.forget('restore-test')");
   }
   await window.loadURL(origin+'/dj');
  }
  await wait("document.querySelector('.dj-deck audio')?.readyState>=1&&!document.querySelector('.dj-play').disabled");
  const restored=await evaluate("(()=>{const root=document.querySelector('.dj-deck');return {paused:root.querySelector('audio').paused,time:root.querySelector('audio').currentTime,reconnect:[...root.querySelectorAll('button')].some(n=>n.textContent==='Datei verbinden'&&!n.hidden)}})()");
  assert.equal(restored.paused,true);assert.equal(restored.time,4);assert.equal(restored.reconnect,false);console.log(stage,restored);
  if(handleMode)await evaluate("window.anydjFiles.forget('restore-test')");
  await browserSession.flushStorageData();window.destroy();backend.server.closeAllConnections();await new Promise(r=>backend.server.close(r));app.exit(0);
 }catch(error){console.error(error);window?.destroy();backend?.server.closeAllConnections();backend?.server.close();app.exit(1);}
 })();
}
