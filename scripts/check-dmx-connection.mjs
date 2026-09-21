import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const {DmxConnection}=await import('../lib/dmx.mjs');
let plugged=true;const sent=[];
const dmx=new DmxConnection({pollMs:150,transport:{
 async scan(){return {ports:plugged?[{id:'ola:1-O-0',port:'1-O-0',name:'USB Testinterface',description:'Emulator',kind:'usb',universe:100,ready:true}]:[],universes:[]};},
 async prepare(){return 100;},async send(u,frame){sent.push([...frame]);},
}});
const app=await createApp({demo:true,dmx});
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
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('#stageSettings').click()");
  await wait("document.querySelector('.stage-hardware select').value==='ola:1-O-0'");
  await evaluate("document.querySelector('.stage-hardware button').click()");
  await wait("document.querySelector('.stage-hardware button').textContent.includes('ausschalten')");
  assert.equal(dmx.status().active,true);
  await evaluate("document.querySelector('[data-demo]').click()");
  await wait("document.querySelector('.stage-hardware button').disabled");
  await new Promise(r=>setTimeout(r,300));
  assert.equal(dmx.status().active,false);
  assert.ok(sent.every(frame=>frame.every(v=>v===0)),'preview demo must never reach physical output');
  await evaluate("document.querySelector('[data-demo]').click()");
  await wait("!document.querySelector('.stage-hardware button').disabled");
  await evaluate("document.querySelector('.stage-hardware button').click()");
  await wait("document.querySelector('.stage-hardware button').textContent.includes('ausschalten')");
  plugged=false;
  await wait("document.querySelector('.stage-hardware select').textContent.includes('getrennt')");
  assert.equal(dmx.status().active,false);
  plugged=true;
  await wait("!document.querySelector('.stage-hardware button').disabled");
  assert.equal(dmx.status().active,false);
  await evaluate("document.querySelector('.stage-hardware button').click()");
  await wait("document.querySelector('.stage-hardware button').textContent.includes('ausschalten')");
  await evaluate("document.querySelector('[data-add-spot]').click()");
  await wait("document.querySelector('.stage-hardware button').textContent.includes('einschalten')");
  await new Promise(r=>setTimeout(r,200));
  assert.equal(dmx.status().active,false);
  await wait("!document.querySelector('.stage-hardware button').disabled");
  await evaluate("document.querySelector('.stage-hardware button').click();document.querySelector('#openLightStage').click()");
  await new Promise(r=>setTimeout(r,500));
  assert.equal(dmx.status().active,false,'deactivation cancels an in-flight start');
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('DMX browser: detect, enable, demo isolation, unplug/replug and equipment change passed.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
