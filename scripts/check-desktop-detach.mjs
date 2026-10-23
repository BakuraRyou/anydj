import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';

if(!process.versions.electron){
 const profile=await mkdtemp(join(tmpdir(),'anydj-detach-'));
 try{
  const {default:electron}=await import('electron');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>{
   const child=spawn('xvfb-run',['-a','-s','-screen 0 1920x1200x24',electron,'--no-sandbox','--disable-gpu',fileURLToPath(import.meta.url),profile],{env,detached:true,stdio:['ignore','pipe','pipe']});let log='';
   const timer=setTimeout(()=>{process.kill(-child.pid,'SIGKILL');reject(Error('Detach timeout: '+log));},60000);
   child.stdout.on('data',data=>{log+=data;process.stdout.write(data);});child.stderr.on('data',data=>{log+=data;});
   child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(log));});
  });
 }finally{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}else{
 void (async()=>{
 const {app,BrowserWindow,dialog}=await import('electron');
 dialog.showErrorBox=(title,message)=>console.error(title,message);
 const entry=process.argv.findIndex(arg=>arg.endsWith('check-desktop-detach.mjs'));
 app.setPath('userData',process.argv[entry+1]);process.argv.push('--demo','--isolated-test');
 let main;const errors=[];
 app.on('browser-window-created',(_event,win)=>{
  if(!main)main=win;
  win.webContents.on('console-message',(_event,...args)=>{const detail=_event?.level?_event:args[0];if(detail?.level==='error')errors.push(detail.message);else if(detail===3)errors.push(args[1]);});
 });
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const evaluate=source=>main.webContents.executeJavaScript(source,true);
 const wait=async source=>{const until=Date.now()+15000;while(Date.now()<until){if(main&&!main.webContents.isLoading()&&await evaluate(source))return;await pause(50);}throw Error('Timeout: '+source+' '+errors.join('\n')+' '+JSON.stringify(main?await evaluate("({url:location.href,body:document.body?.innerText.slice(-1200),desktop:window.anydjDesktop})"):null));};
 try{
  await import('../desktop/main.mjs');
  await wait("!!document.querySelector('.dj-detach')&&!document.querySelector('#queueNew').disabled");
  const demoSource=(await (await import('node:fs/promises')).readFile(new URL('../public/web-demo.js',import.meta.url),'utf8')).replace('export function','function');
  const file=new Function(demoSource+';return createDemoFiles()[0];')();
  const song=join(process.argv[entry+1],file.name);
  await (await import('node:fs/promises')).writeFile(song,Buffer.from(await file.arrayBuffer()));
  main.webContents.debugger.attach('1.3');
  const {result:input}=await main.webContents.debugger.sendCommand('Runtime.evaluate',{expression:"document.querySelector('#djFiles')"});
  await main.webContents.debugger.sendCommand('DOM.setFileInputFiles',{objectId:input.objectId,files:[song]});
  await wait("!!document.querySelector('#trackList .dj-enqueue')");
  await evaluate("document.querySelector('#trackList .dj-enqueue').click();window.queueIdentity=document.querySelector('.dj-queue');window.audioIdentity=[...document.querySelectorAll('.dj-deck audio')];document.querySelector('.dj-detach').click()");
  await wait("!!document.querySelector('.dj-queue-placeholder')");
  const child=BrowserWindow.getAllWindows().find(win=>win!==main);
  const remote=source=>child.webContents.executeJavaScript(source,true);
  assert.equal(await remote("document.querySelectorAll('#queueList [data-queue-id]').length"),1);
  assert.equal(await remote("document.querySelector('.dj-queue')===opener.queueIdentity"),true);
  assert.equal(await remote("typeof process==='undefined'&&typeof require==='undefined'"),true);
  // Edit a set name while the regular 200 ms render loop is running.
  await remote("document.querySelector('#queueNew').click();document.querySelector('#queueName').focus();document.querySelector('#queueName').value='Mein Desktop Set';document.querySelector('#queueName').dispatchEvent(new Event('input',{bubbles:true}))");
  await pause(450);
  assert.equal(await remote("document.querySelector('#queueName').value"),'Mein Desktop Set');
  // Real X11 pointer events exercise Chromium's native cross-window drag store.
  main.setBounds({x:0,y:0,width:960,height:1050});child.setBounds({x:1000,y:0,width:680,height:950});
  await pause(200);
  const point=async(win,selector)=>{
   const rect=await win.webContents.executeJavaScript(`(()=>{const el=document.querySelector('${selector}');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   const bounds=win.getContentBounds();return {x:Math.round(bounds.x+rect.x),y:Math.round(bounds.y+rect.y)};
  };
  const nativeDrag=async(from,to)=>promisify(execFile)('python3',['-c',`
import ctypes,time
x=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(None)
x.XFlush.argtypes=[ctypes.c_void_p]
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
def move(a,b):
 t.XTestFakeMotionEvent(d,-1,a,b,0);x.XFlush(d);time.sleep(.04)
move(${from.x},${from.y});t.XTestFakeButtonEvent(d,1,1,0);x.XFlush(d);time.sleep(.1)
for i in range(1,26): move(round(${from.x}+(${to.x}-${from.x})*i/25),round(${from.y}+(${to.y}-${from.y})*i/25))
time.sleep(.2);t.XTestFakeButtonEvent(d,1,0,0);x.XFlush(d);time.sleep(.2)
`]);
  await nativeDrag(await point(main,'#trackList .dj-track-label strong'),await point(child,'#queueList'));
  assert.equal(await remote("document.querySelectorAll('#queueList [data-queue-id]').length"),1,'native library-to-window drop');
  await nativeDrag(await point(child,'#queueList .dj-track-info strong'),await point(main,'.dj-deck .dj-track-title'));
  await wait("document.querySelector('.dj-deck .dj-track-title').textContent.includes('AnyDj Demo')");
  await remote("document.querySelector('#queueExport').click()");
  assert.equal(await remote("document.querySelector('#queueExportMenu').matches(':popover-open')"),true);
  await remote("document.querySelector('#queueExportMenu').hidePopover()");
  await pause(100);
  await (await import('node:fs/promises')).writeFile('/tmp/anydj-detached-queue.png',(await child.webContents.capturePage()).toPNG());
  // Clear the test set and also check direct handler data and row identity.
  await remote("document.querySelector('#queueList .queue-row-remove').click()");
  // Copy a library song into the detached queue, then drag it onto Deck A.
  await evaluate(`(()=>{const dt=new DataTransfer();document.querySelector('#trackList li').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));const doc=window.queueIdentity.ownerDocument;doc.querySelector('.dj-queue').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));document.dispatchEvent(new DragEvent('dragend',{bubbles:true}));})()`);
  assert.equal(await remote("document.querySelectorAll('#queueList [data-queue-id]').length"),1);
  await remote(`(()=>{const row=document.querySelector('#queueList [data-queue-id]'),dt=new DataTransfer();row.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));opener.document.querySelector('.dj-deck').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));row.dispatchEvent(new DragEvent('dragend',{bubbles:true}));})()`);
  await wait("document.querySelector('.dj-deck .dj-track-title').textContent.includes('AnyDj Demo')");
  await wait("!document.querySelector('.dj-deck .dj-play').disabled");
  await evaluate("document.querySelector('.dj-deck .dj-play').click()");
  await wait("!document.querySelector('.dj-deck audio').paused&&document.querySelector('.dj-deck audio').currentTime>0.1");
  const before=await evaluate("document.querySelector('.dj-deck audio').currentTime");
  await remote("document.querySelector('.dj-detach').click()");
  await wait("!!document.querySelector('.dj-queue')&&!document.querySelector('.dj-queue-placeholder')");
  await pause(300);
  assert.equal(await evaluate("document.querySelector('.dj-queue')===queueIdentity&&[...document.querySelectorAll('.dj-deck audio')].every((a,i)=>a===audioIdentity[i])"),true);
  assert.ok(await evaluate('document.querySelector(".dj-deck audio").currentTime')>before);
  // Pulling the heading onto the desktop also detaches the list.
  await nativeDrag(await point(main,'.dj-queue h2'),{x:1400,y:700});
  await wait("!!document.querySelector('.dj-queue-placeholder')");
  BrowserWindow.getAllWindows().find(win=>win!==main).close();
  await wait("!!document.querySelector('.dj-queue')");
  assert.equal(await evaluate("document.querySelectorAll('#queueList [data-queue-id]').length"),1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({desktopDetach:true,queueStatePreserved:true,crossWindowDrops:true,setNameEditing:true,audioUninterrupted:true,nativeCloseRestores:true,nativeCrossWindowDrag:true,headingTearOff:true,exportMenu:true}));
  app.exit(0);
 }catch(error){console.error(error,errors);app.exit(1);}
 })();
}
