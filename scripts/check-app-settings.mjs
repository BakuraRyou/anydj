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

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
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




  await c('Page.addScriptToEvaluateOnNewDocument',{source:`window.__wakeRequests=0;window.__wakeReleases=0;Object.defineProperty(navigator,'wakeLock',{value:{request:async()=>{window.__wakeRequests++;const lock=new EventTarget();lock.release=async()=>{window.__wakeReleases++;lock.dispatchEvent(new Event('release'));};return lock;}}});`});
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#appSettingsDialog')");
  const open=()=>evaluate("document.querySelector('.dj-settings>summary').click()");
  await open();await wait("document.querySelector('#appSettingsDialog').open");
  assert.equal(await evaluate("document.querySelector('#djStructure').closest('#libraryImportPopover')!==null"),true);
  assert.equal(await evaluate("document.querySelector('#appSettingsDialog #djStructure')===null"),true);
  await evaluate("document.querySelector('[data-pref=comfortable]').click();document.querySelector('[data-pref=contrast]').click();const motion=document.querySelector('[data-pref=motion]');motion.value='reduced';motion.dispatchEvent(new Event('change'));document.querySelector('[data-pref=awake]').click()");
  await wait("window.__wakeRequests===1");
  assert.equal(await evaluate("document.documentElement.dataset.appComfortable==='true'&&document.documentElement.dataset.appContrast==='true'&&document.documentElement.dataset.appReducedMotion==='true'"),true);
  await evaluate("document.querySelector('[data-pref=awake]').click()");await wait("window.__wakeReleases===1");
  assert.equal(await evaluate(`(()=>{const audio=document.querySelector('.dj-deck audio');Object.defineProperty(audio,'paused',{configurable:true,value:false});const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);delete audio.paused;return event.defaultPrevented;})()`),true);
  await evaluate("document.querySelector('[data-pref=leaveGuard]').click()");
  assert.equal(await evaluate(`(()=>{const audio=document.querySelector('.dj-deck audio');Object.defineProperty(audio,'paused',{configurable:true,value:false});const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);delete audio.paused;return event.defaultPrevented;})()`),false);

  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-app-settings-v1')).leaveGuard"),false);
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait("!document.querySelector('#appSettingsDialog').open");
  assert.equal(await evaluate("document.activeElement.matches('.dj-settings>summary')"),true);
  await evaluate("window.__reload=true");await c('Page.reload');await wait("!window.__reload&&document.querySelector('#appSettingsDialog')");
  assert.equal(await evaluate("document.documentElement.dataset.appComfortable==='true'&&document.querySelector('[data-pref=motion]').value==='reduced'&&!document.querySelector('[data-pref=leaveGuard]').checked"),true);
  await open();
  const reset=await evaluate("[...document.querySelectorAll('#appSettingsDialog button')].find(n=>n.textContent==='Layout zurücksetzen')!==undefined");assert.equal(reset,true);
  for(const [width,height] of [[1280,900],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("(()=>{const n=document.querySelector('#appSettingsDialog'),r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth;})()"),true);
    await writeFile(new URL('../reports/app-settings-'+width+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.deepEqual(errors,[]);console.log('App settings passed: modal/keyboard, persistent preferences, appearance, wake lock acquire/release, analysis relocation, layout action, desktop/mobile geometry.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
