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


  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  assert.equal(await evaluate("document.querySelector('.dj-color-preview').hidden"),false);
  await evaluate("document.querySelector('#openLightStage').click()");
  assert.equal(await evaluate("document.querySelector('.dj-color-preview').hidden"),true);
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false);
  assert.equal(await evaluate("document.querySelector('#inlineLightStage').hidden"),false);
  await evaluate("document.querySelector('.stage-inline-toolbar button:last-child').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click()");
  await wait("Number(document.querySelector('.stage-spot').style.getPropertyValue('--stage-power'))>0");
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false);
  assert.equal(await evaluate("document.querySelector('.stage-status').textContent"),'Demo läuft · ohne Musik');
  for(const [width,height] of [[1280,720],[1024,768],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    const bounds=await evaluate("({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,list:document.querySelector('#trackList').getBoundingClientRect().height})");
    assert.ok(bounds.width<=width,JSON.stringify(bounds));
    if(width>760){assert.ok(bounds.height<=height,JSON.stringify(bounds));assert.ok(bounds.list>70,JSON.stringify(bounds));}
    await writeFile(new URL(`../reports/dmx-inline-${width}.png`,import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await c('Page.reload');await wait("document.querySelector('#inlineLightStage')&&!document.querySelector('#inlineLightStage').hidden");
  assert.equal(await evaluate("document.querySelector('#dmxStage').open"),false);
  await evaluate("document.querySelector('#openLightStage').click()");
  assert.equal(await evaluate("document.querySelector('.dj-color-preview').hidden"),false);
  assert.equal(await evaluate("document.querySelector('#inlineLightStage').hidden"),true);
  assert.deepEqual(errors,[]);console.log('Inline stage passed: replacement, settings close keeps demo running, activation restored, layouts, deactivate.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
