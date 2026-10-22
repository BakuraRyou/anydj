import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';

if(!process.versions.electron){
 const profile=await mkdtemp(join(tmpdir(),'anydj-focus-'));
 try{
  const {default:electron}=await import('electron');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>{
   const child=spawn('xvfb-run',['-a','-s','-screen 0 1600x1100x24',electron,'--no-sandbox','--disable-gpu',fileURLToPath(import.meta.url),profile],{env,detached:true,stdio:['ignore','pipe','pipe']});let log='';
   const timer=setTimeout(()=>{process.kill(-child.pid,'SIGKILL');reject(Error('Desktop focus timeout: '+log));},60000);
   child.stdout.on('data',data=>{log+=data;process.stdout.write(data);});child.stderr.on('data',data=>{log+=data;});
   child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(log));});
  });
 }finally{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}else{
 void (async()=>{
 const {app,dialog}=await import('electron');dialog.showErrorBox=(title,message)=>console.error('Startup error',title,message);const entry=process.argv.findIndex(arg=>arg.endsWith('check-desktop-focus.mjs'));
 app.setPath('userData',process.argv[entry+1]);process.argv.push('--demo','--isolated-test');
 let window;
 app.on('browser-window-created',(_event,win)=>{window=win;win.webContents.debugger.attach('1.3');});
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const evaluate=source=>window.webContents.executeJavaScript(source,true);
 const wait=async source=>{const until=Date.now()+15000;while(Date.now()<until){if(window&&!window.webContents.isLoading()&&await evaluate(source))return;await pause(80);}throw Error('Timeout: '+source+' '+JSON.stringify(window?await evaluate("({url:location.href,ready:document.readyState,status:document.querySelector('#djStatus')?.textContent,output:document.querySelector('[data-routing]')?.textContent,body:document.body?.innerText.slice(-1200)})"):null));};
 const send=(method,params)=>window.webContents.debugger.sendCommand(method,params);
 const click=async selector=>{
  const point=await evaluate(`(()=>{const el=document.querySelector('${selector}');for(let n=el;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)===el,other:document.elementFromPoint(x,y)?.outerHTML.slice(0,200),rect:[r.width,r.height],hidden:el.hidden};})()`);
  assert.equal(point.hit,true,selector+' must be clickable '+JSON.stringify(point));
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});
 };
 // A native popup can block Electron's UI loop. Deliver its response from
 // another process using OS events, without changing window activation.
 const nativeKeys=(keys,clickDialog=false)=>promisify(execFile)('python3',['-c',`
import ctypes,time,subprocess,re
x=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(None)
x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XKeysymToKeycode.restype=ctypes.c_uint
t.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
x.XFlush.argtypes=[ctypes.c_void_p]
time.sleep(.7)
tree=subprocess.check_output(['xwininfo','-root','-tree']).decode()
if ${clickDialog?'True':'False'}:
 candidates=[tuple(map(int,m)) for m in re.findall(r'  (\\d+)x(\\d+)\\+(-?\\d+)\\+(-?\\d+)',tree)]
 candidates=[p for p in candidates if 250<p[0]<900 and p[1]>100]
 if not candidates: raise RuntimeError('No native dialog: '+tree)
 w,h,left,top=max(candidates,key=lambda p:p[0]*p[1])
 t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
 t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
 t.XTestFakeMotionEvent(d,-1,left+w//4,top+h-25,0)
 t.XTestFakeButtonEvent(d,1,1,0);t.XTestFakeButtonEvent(d,1,0,0);x.XFlush(d)
else:

 for symbol in ${JSON.stringify(keys)}:
  code=x.XKeysymToKeycode(d,symbol)
  t.XTestFakeKeyEvent(d,code,1,0);t.XTestFakeKeyEvent(d,code,0,0);x.XFlush(d);time.sleep(.1)
`]);
 const chooseSelect=async selector=>{
  const before=await evaluate(`document.querySelector('${selector}').value`);
  const chosen=nativeKeys([0xff54,0xff0d]);await click(selector);const observed=await chosen;
  assert.notEqual(await evaluate(`document.querySelector('${selector}').value`),before,'native menu must accept a choice without refocusing');
  return observed.stdout;
 };
 try{
  await import('../desktop/main.mjs');
  await wait("typeof document.querySelector('#djFiles')?.onchange==='function'&&!document.querySelector('[data-output=master]').disabled");
  await pause(500);await evaluate(`
   window.nativeConfirms=0;const confirm=window.confirm.bind(window);window.confirm=message=>{nativeConfirms++;return confirm(message);};
   Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[{kind:'audiooutput',deviceId:'test-master',groupId:'master',label:'Test Master'},{kind:'audiooutput',deviceId:'test-cue',groupId:'cue',label:'Test Kopfhörer'}]});
   AudioContext.prototype.setSinkId=async()=>{};HTMLMediaElement.prototype.setSinkId=async function(id){window.cueSink=id;};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.srcObject?Promise.resolve():play.call(this);};
   document.querySelector('[data-refresh-outputs]').click();
  `);
  await wait("document.querySelector('[data-output-select=master] option[value=test-master]')");
  assert.equal(window.isVisible(),true);assert.equal(window.isFocused(),true);
  assert.equal(await evaluate('document.hasFocus()'),true,'renderer has focus immediately on startup');
  const select='#fadeDuration';
  await chooseSelect(select);
  await evaluate("(()=>{const s=document.querySelector('[data-output-select=master]');s.value='test-master';s.dispatchEvent(new Event('change'));})()");await wait("document.querySelector('[data-routing]').textContent.includes('Master: Test Master')");
  for(const accept of [false,true]){
   const dismissed=nativeKeys([accept?0xff0d:0xff1b],accept);
   await evaluate("(()=>{const s=document.querySelector('[data-output-select=cue]');s.value='test-master';s.dispatchEvent(new Event('change'));})()");await dismissed;
   await wait("!document.querySelector('[data-output=cue]').disabled");
   assert.equal(await evaluate('document.hasFocus()'),true,'native dialog returns focus without switching apps');
   assert.equal(await evaluate('window.cueSink'),accept?'test-master':undefined);
   await chooseSelect(select);
  }
  assert.equal(await evaluate('nativeConfirms'),2);
  await evaluate("(()=>{const i=document.createElement('input');i.id='focusProbe';document.body.append(i);i.focus();})()");
  window.webContents.sendInputEvent({type:'char',keyCode:'a'});await pause(80);
  assert.equal(await evaluate("document.querySelector('#focusProbe').value"),'a');
  console.log(JSON.stringify({desktopFocus:true,electron:process.versions.electron,startupSelect:true,nativeConfirm:true,nativeConfirmMouseAccept:true,focusAfterConfirm:true,typingAfterConfirm:true}));
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
 })();
}
