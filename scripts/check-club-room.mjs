import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const {createServer}=await import('node:http');
const {readFile}=await import('node:fs/promises');
const app={server:createServer(async(req,res)=>{try{if(req.url==='/dj'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');return;}res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(new URL('../public'+req.url,import.meta.url)));}catch{res.statusCode=404;res.end();}})};
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;

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



  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.readyState==='complete'");
  const mount=()=>evaluate(`(async()=>{
    window.planner?.destroy();
    document.body.innerHTML='<link rel="stylesheet" href="/dmx-ar.css"><main style="max-width:900px;margin:auto" id="host"></main>';
    const {createARPlanner}=await import('/dmx-ar-planner.js');
    window.planner=createARPlanner(document.querySelector('#host'));
  })()`);
  const stored=()=>evaluate("JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'))");
  const change=(name,value)=>evaluate(`{const input=document.querySelector('[data-ar-${name}]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await mount();
  let saved=await stored();const club=saved.plans[0];
  assert.equal(club.name,'Großclub · 192 Lichter');assert.equal(Object.keys(club.positions).length,216);
  assert.equal(await evaluate("document.querySelector('[data-ar-club-room]')===null"),true);
  await evaluate("document.querySelector('[data-ar-new-room]').click()");
  saved=await stored();const original=saved.plans.find(p=>p.id===saved.selected);
  await change('room',club.id);await change('name','Mein Testclub');
  await change('brightness','25');
  saved=await stored();assert.equal(saved.enabled,true);assert.deepEqual(saved.plans.find(p=>p.id===original.id),original);
  // Reload the browser document, then recreate the planner against localStorage.
  await c('Page.reload');await wait("document.readyState==='complete'&&!document.querySelector('#host')");await mount();
  assert.deepEqual(await stored(),saved);
  assert.equal(await evaluate("document.querySelector('[data-ar-room]').value"),club.id);
  assert.equal(await evaluate("document.querySelector('[data-ar-name]').value"),'Mein Testclub');
  await evaluate("window.confirm=()=>true;document.querySelector('[data-ar-delete]').click()");
  await mount();assert.equal((await stored()).plans.length,2);
  assert.ok((await stored()).plans.some(p=>p.id===original.id));
  // Upgrade an existing library while preserving its active room and enable flag.
  await evaluate(`localStorage.setItem('anydj-ar-rooms-v1',JSON.stringify({plans:[${JSON.stringify(original)}],selected:${JSON.stringify(original.id)},enabled:true}))`);
  await mount();saved=await stored();
  assert.equal(saved.plans.length,3);assert.deepEqual(saved.plans[0],original);
  assert.equal(saved.selected,original.id);assert.equal(saved.enabled,true);
  // A renamed club from the former button must not be duplicated.
  await evaluate(`localStorage.setItem('anydj-ar-rooms-v1',JSON.stringify({plans:[${JSON.stringify({...club,name:'Alter Club'})}],selected:${JSON.stringify(club.id)},enabled:false}))`);
  await mount();assert.equal((await stored()).plans.length,2);assert.equal((await stored()).enabled,false);
  const stage=(await stored()).plans.find(p=>p.name==='Club-Bühne · Publikum & Hintergrund');
  assert.ok(stage);assert.equal(Object.keys(stage.positions).length,168);
  await change('room',stage.id);await change('name','Meine Club-Bühne');
  await mount();assert.equal((await stored()).selected,stage.id);
  assert.equal(await evaluate("document.querySelector('[data-ar-name]').value"),'Meine Club-Bühne');
  await evaluate("window.confirm=()=>true;document.querySelector('[data-ar-delete]').click()");
  await mount();assert.equal((await stored()).plans.some(p=>p.id===stage.id),false);
  for(const width of [1280,390]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate("[...document.querySelectorAll('[data-ar-room],[data-ar-new-room],[data-ar-copy]')].every(n=>{const r=n.getBoundingClientRect();return n.checkVisibility()&&r.left>=0&&r.right<=innerWidth;})"),true);
  }
  assert.deepEqual(errors,[]);
  console.log('Club browser check passed: normal room selection, persistence, edits, deletion, existing library migration and desktop/mobile controls.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
