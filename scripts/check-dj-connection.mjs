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
const lamp=app.client.lights.get('192.168.178.50');app.client.lights.clear();
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
  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.querySelector('#djConnection')?.dataset.state==='offline'");
  assert.ok(requests.includes('/api/connection'));
  assert.equal(requests.includes('/api/music/start'),false);
  assert.equal(await evaluate("document.querySelector('#djConnection').getBoundingClientRect().height>0"),true);
  app.client.lights.set('192.168.178.70',lamp);
  await wait("document.querySelector('#djConnection')?.dataset.state==='ready'");
  assert.equal(await evaluate("[...document.querySelector('#djLamp').options].some(o=>o.value==='192.168.178.70')"),true);
  assert.equal(await evaluate("[...document.querySelectorAll('audio')].every(a=>a.paused)"),true);
  assert.equal(requests.includes('/api/music/start'),false);
  await evaluate("document.querySelector('#djLamp').value='192.168.178.70';document.querySelector('#djLamp').dispatchEvent(new Event('change'))");
  await c('Page.reload');
  await wait("document.querySelector('#djConnection')?.dataset.state==='ready'");
  assert.equal(await evaluate("document.querySelector('#djLamp').value"),'192.168.178.70');
  await evaluate("document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'))");
  await c('Page.reload');
  await wait("document.querySelector('#djConnection')?.dataset.state==='ready'");
  assert.equal(await evaluate("document.querySelector('#djLamp').value"),'');
  assert.equal(requests.includes('/api/music/start'),false);
  assert.deepEqual(errors,[]);
  const result={opensWithoutPlay:true,offlineStatusVisible:true,automaticReconnect:true,changedIP:true,reloadConnects:true,selectionRestored:true,audioOnlyRestored:true,musicStarts:0,browserErrors:0};
  console.log(JSON.stringify(result,null,2));
  await writeFile(new URL('../reports/dj-connection-browser-check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
