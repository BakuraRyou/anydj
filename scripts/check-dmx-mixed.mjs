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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors.slice(0,2)));};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click()");
  await evaluate("document.querySelector('[data-add-spot]').click();document.querySelector('[data-add-spot]').click();document.querySelector('[data-add-bar]').click();document.querySelector('[data-add-bar]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.stage-spot').length"),6);
  assert.equal(await evaluate("document.querySelectorAll('.stage-bar').length"),2);
  await evaluate("const input=document.querySelector('.stage-device-row input[type=number]');input.value='12';input.dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell').length"),20);
  await evaluate(`window.edit=(key,value)=>{const e=document.querySelector('[data-'+key+']');e.value=value;e.dispatchEvent(new Event(['mode','target'].includes(key)?'change':'input'));};
    edit('mode','design');edit('target','f5');document.querySelector('[data-own]').click();edit('color','fixed');edit('a','#00ff00');`);
  const id=await evaluate("JSON.parse(localStorage.getItem('anydj-stage-design-v1')).equipment.devices[5].id");
  await evaluate("document.querySelector('.stage-device-row button[aria-label]').click()");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-design-v1')).equipment.devices[4].id"),id);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-design-v1')).config.fixtures[4].colors[0]"),'#00ff00');
  await evaluate("edit('mode','auto');document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click()");
  await wait("[...document.querySelectorAll('.stage-cell')].some(n=>Number(n.style.getPropertyValue('--stage-power'))>0)");
  await writeFile(new URL('../reports/dmx-mixed-desktop.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await c('Page.reload');await wait("document.querySelectorAll('.stage-bar').length===2");
  assert.equal(await evaluate("document.querySelectorAll('.stage-spot').length"),5);
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell').length"),20);
  await evaluate("document.querySelector('#stageSettings').click();const input=document.querySelector('.stage-device-row input[type=number]');input.value='170';input.dispatchEvent(new Event('change'))");
  assert.ok(await evaluate("document.querySelector('[data-saved]').textContent.includes('512')"));
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell').length"),20);
  await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await evaluate("document.querySelector('[data-close]').click()");
  await writeFile(new URL('../reports/dmx-mixed-mobile.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('#stageSettings').click();while(document.querySelector('.stage-device-row button[aria-label]'))document.querySelector('.stage-device-row button[aria-label]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell,.stage-spot').length"),0);
  await c('Page.reload');await wait("document.querySelector('#dmxStage')");
  assert.equal(await evaluate("document.querySelectorAll('.stage-cell,.stage-spot').length"),0);
  // Old strip-only settings migrate its former fixture index 4 to dynamic index 0.
  await evaluate(`localStorage.setItem('anydj-stage-design-v1',JSON.stringify({equipment:{type:'bar',segments:3},config:{fixtures:[null,null,null,null,{mode:'fixed',colors:['#00ff00','#0000ff']}],members:[0,0,1,1,2]},mode:'design'}))`);
  await c('Page.reload');await wait("document.querySelectorAll('.stage-cell').length===3");
  await evaluate("document.querySelector('#stageSettings').click();document.querySelector('.stage-bar').click()");
  assert.equal(await evaluate("document.querySelector('[data-a]').value"),'#00ff00');
  assert.deepEqual(errors,[]);console.log('Mixed stage passed: six spots, two bars, segment resize, stable settings after deletion, reload, capacity error, empty stage, legacy migration and mobile.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
