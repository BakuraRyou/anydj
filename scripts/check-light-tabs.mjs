import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true});
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");

  for(const [width,height] of [[1440,900],[1024,800],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate("document.querySelector('#stage-tab-2d').getAttribute('aria-selected')"),'true');
    assert.ok(await evaluate("document.querySelector('.stage-scene').checkVisibility()"));
    assert.ok(await evaluate("[...document.querySelectorAll('.dj-mixer-light input,.dj-mixer-light select,.dj-mixer-light details')].every(e=>!e.checkVisibility())"));
    await evaluate("document.querySelector('#stage-tab-3d').click()");
    await wait("document.querySelector('.stage-3d canvas').checkVisibility()");
    assert.ok(await evaluate("!document.querySelector('.stage-scene').checkVisibility()"));
    assert.ok(await evaluate("!document.querySelector('.stage-3d-dialog').open"));
    assert.ok(await evaluate("!document.querySelector('.stage-3d-tools').checkVisibility()"));
    await writeFile('/tmp/light-tabs-3d-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate("document.querySelector('#stageSettings').click()");
    assert.ok(await evaluate("document.querySelector('.stage-3d-dialog').open"));
    assert.ok(await evaluate("document.querySelector('.stage-3d-tools').checkVisibility()"));
    await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await wait("!document.querySelector('.stage-3d-dialog').open");
    await wait("document.activeElement.id==='stageSettings'");
    await evaluate("document.querySelector('#stage-tab-2d').click();document.querySelector('#stageSettings').click()");
    assert.ok(await evaluate("document.querySelector('#dmxStage').open"));
    assert.ok(await evaluate("document.querySelector('#dmxStage .stage-scene').checkVisibility()"));
    assert.ok(await evaluate("document.querySelector('#djShowProfile').checkVisibility()"));
    await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await wait("!document.querySelector('#dmxStage').open");
    assert.ok(await evaluate("document.querySelector('#inlineLightStage .stage-scene').checkVisibility()"));
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'page overflow at '+width);
    await writeFile('/tmp/light-tabs-'+width+'.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.deepEqual(errors,[]);
  console.log('Light tabs passed: 2D/3D, compact preview, dialogs/settings, Escape, responsive widths, no browser errors.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
