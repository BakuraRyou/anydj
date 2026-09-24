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


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('[data-layout-open]').click()");
  await wait("document.querySelector('#stageLayoutDialog').open&&document.querySelector('[data-layout-aim]').textContent.includes('Pan')");
  await evaluate(`window.edit=(key,value)=>{const el=document.querySelector('[data-layout-'+key+']');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};window.choose=id=>edit('device',id);window.saved=()=>JSON.parse(localStorage.getItem('anydj-stage-layout-v1'));choose('moving-0');edit('x',-1);edit('y',3);choose('moving-1');edit('x',1);edit('y',3);document.querySelector('[data-select-device="moving-0"]').click();document.querySelector('[data-layout-link]').click();edit('assembly-name','Meine Lichtbar');edit('rotation',90);`);
  const grouped=await evaluate('saved()');assert.equal(grouped.assemblies.length,1);assert.equal(grouped.assemblies[0].name,'Meine Lichtbar');
  assert.ok(Math.abs(grouped.positions['moving-0'].x)<1e-8);assert.ok(Math.abs(grouped.positions['moving-0'].y-2)<1e-8);
  await evaluate(`choose('moving-0');edit('x',1);edit('gain',42);`);
  assert.ok(Math.abs((await evaluate('saved()')).positions['moving-1'].x-1)<1e-8);
  assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('anydj-stage-design-v1')).equipment.devices.filter(d=>['moving-0','moving-1'].includes(d.id)).map(d=>d.gain)`),[42,42]);
  await evaluate(`choose('fixture-legacy-spot-0');document.querySelector('[data-layout-join]').click();`);
  assert.equal((await evaluate('saved()')).assemblies[0].members.length,3);
  await evaluate(`document.querySelector('[data-layout-detach]').click()`);
  assert.equal((await evaluate('saved()')).assemblies[0].members.length,2);
  await reload();await wait("document.querySelector('[data-layout-open]')");await evaluate("document.querySelector('[data-layout-open]').click()");
  assert.equal(await evaluate("document.querySelector('[data-layout-assembly-name]').value"),'Meine Lichtbar');
  assert.equal(await evaluate("document.querySelectorAll('[data-select-device]:checked').length"),2);
  await evaluate(`document.querySelector('.stage-fixture-library').open=true;const search=document.querySelector('[data-library-search]');search.value='ADJ';search.dispatchEvent(new Event('input'));document.querySelector('[data-library-add]').click();`);
  await wait(`JSON.parse(localStorage.getItem('anydj-stage-design-v1')).equipment.devices.some(d=>d.modelId==='adj-mega-tripar-plus-4')`);
  assert.equal(await evaluate("document.querySelector('[data-library-model]').options.length"),1);
  assert.ok(await evaluate("document.querySelector('[data-devices]').textContent.includes('4CH · RGB + UV')"));
  for(const [width,height] of [[1280,900],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("document.querySelector('#stageLayoutDialog').scrollWidth<=document.querySelector('#stageLayoutDialog').clientWidth"));
  }
  assert.deepEqual(errors,[]);console.log('Device groups and catalog passed: create, rotate, move, shared gain, add/remove member, reload, catalog addition and mobile bounds.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
