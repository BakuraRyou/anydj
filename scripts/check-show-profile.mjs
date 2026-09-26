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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/Inspected target navigated or closed|Cannot find context|Execution context was destroyed/.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  assert.ok(await evaluate("[...document.querySelector('#djShowProfile').options].some(o=>o.value==='show'&&o.textContent==='Show')"));
  for(const value of ['show','party','auto','show']){
    await evaluate(`{const select=document.querySelector('#djShowProfile');select.value='${value}';select.dispatchEvent(new Event('change'));}`);
    assert.equal(await evaluate("localStorage.getItem('wiz-dj-show-profile')"),value);
    assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),value==='auto'?'balanced':value==='party'?'energetic':value);
  }
  await reload();await wait("document.querySelector('#inlineLightStage')");
  assert.equal(await evaluate("document.querySelector('#djShowProfile').value"),'show');
  assert.equal(await evaluate("localStorage.getItem('anydj-moving-mood')"),'show');
  await evaluate("document.querySelector('#stage-tab-2d').click();document.querySelector('#stageSettings').click()");
  await wait("document.querySelector('#dmxStage').open");
  for(const width of [1280,390]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width<600});
    await evaluate("document.querySelector('.dj-light-settings').open=true");
    assert.ok(await evaluate("document.querySelector('#djShowProfile').checkVisibility()"));
  }
  assert.deepEqual(errors,[]);
  console.log('Show: selectable on desktop/mobile, switches independent profiles and survives reload with matching moving mode.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
