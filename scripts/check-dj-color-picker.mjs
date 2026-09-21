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



  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.dj-color-picker')");
  await evaluate("document.querySelector('.dj-transport-options').open=true;document.querySelector('.dj-light-options').open=true;document.querySelector('.dj-color-picker summary').click()");
  await new Promise(r=>setTimeout(r,300));
  assert.equal(await evaluate("document.querySelector('.dj-color-picker').open"),true,'empty deck explains prerequisites without snapping closed');
  await evaluate(`(async()=>{window.picker= (await import('/dj-color-picker.js')).createColorPicker('Test',async(track,mode)=>{track.colorMode=mode;});
    document.body.append(picker.element);window.track={id:'test'};picker.update(track);picker.element.querySelector('summary').click();})()`);
  await wait("picker.element.open");
  await evaluate(`window.select=picker.element.querySelector('.color-options');select.selectedIndex=2;window.selected=select.value;select.focus();
    window.mutations=0;window.observer=new MutationObserver(entries=>mutations+=entries.length);observer.observe(picker.element,{subtree:true,childList:true});
    window.refresh=setInterval(()=>picker.update(track),50);`);
  await new Promise(r=>setTimeout(r,1200));
  assert.equal(await evaluate("picker.element.open&&select.value===selected&&document.activeElement===select"),true,'background updates retain focus and choice');
  assert.equal(await evaluate("mutations"),0,'unchanged updates do not rebuild controls');
  await evaluate("clearInterval(refresh);observer.disconnect();picker.element.querySelector('.color-apply').click()");
  await wait("!picker.element.open");assert.equal(await evaluate("track.colorMode.id===selected"),true);
  assert.deepEqual(errors,[]);
  console.log('Color picker passed: empty deck, stable open selection/focus during updates, apply and close.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
