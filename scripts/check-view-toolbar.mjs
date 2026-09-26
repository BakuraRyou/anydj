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



  await evaluate("document.querySelector('#stage-tab-3d').click();document.querySelector('#stageSettings').click()");
  await wait("document.querySelector('.stage-view-toolbar')");
  const visible=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).checkVisibility()`);
  assert.equal(await visible('[data-stage-vr]'),false);
  assert.equal(await visible('[data-camera-help]'),false);
  await evaluate("document.querySelector('[data-view-menu=help] summary').click()");
  assert.equal(await visible('[data-camera-help]'),true);
  await evaluate("document.querySelector('[data-view-menu=xr] summary').click()");
  await wait("!document.querySelector('[data-view-menu=help]').open");
  assert.equal(await visible('[data-stage-vr]'),true);
  assert.equal(await visible('[data-vr-recheck]'),true);
  await evaluate("document.querySelector('[data-view-menu=xr] summary').focus()");
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  assert.equal(await evaluate("document.querySelector('[data-view-menu=xr]').open"),false);
  assert.equal(await evaluate("document.querySelector('.stage-3d-dialog').open"),true);
  await evaluate("document.querySelector('[data-dancer]').click()");
  assert.equal(await evaluate("document.querySelector('[data-dancer]').getAttribute('aria-pressed')"),'true');
  await evaluate("document.querySelector('[data-camera=top]').click()");
  assert.equal(await evaluate("document.querySelector('[data-camera=top]').getAttribute('aria-pressed')"),'true');
  assert.equal(await evaluate("document.querySelector('[data-dancer]').getAttribute('aria-pressed')"),'false');
  await evaluate("document.querySelector('[data-camera=in]').click()");
  assert.equal(await evaluate("document.querySelector('[data-camera=top]').getAttribute('aria-pressed')"),'true','zoom preserves the selected perspective');
  for(const [width,height] of [[1440,900],[1024,768],[390,844]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await evaluate("document.querySelector('.stage-view-toolbar').scrollIntoView({block:'nearest'})");
   assert.equal(await evaluate("[...document.querySelectorAll('.stage-view-group button,.stage-view-menu>summary')].every(n=>{const r=n.getBoundingClientRect();return n.checkVisibility()&&r.left>=0&&r.right<=innerWidth;})"),true,'primary controls fit');
   assert.ok(await evaluate("document.querySelector('.stage-view-toolbar').getBoundingClientRect().height")<130);
   await evaluate("document.querySelector('[data-view-menu=xr]').open=true");
   assert.equal(await evaluate("(()=>{const r=document.querySelector('[data-view-menu=xr] .stage-view-popover').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0;})()"),true,'XR panel stays inside viewport');
   await evaluate("document.querySelector('[data-view-menu=xr]').open=false");
   await writeFile('/tmp/anydj-view-toolbar-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.deepEqual(errors,[]);console.log('Viewport toolbar passed: perspective, hidden setup, disclosure switching, Escape without closing preview and responsive layout.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
