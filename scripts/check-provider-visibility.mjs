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

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors));};





  await c('Page.addScriptToEvaluateOnNewDocument',{source:`const providerTestFetch=window.fetch.bind(window);window.fetch=(url,...args)=>['api.spotify.com','openapi.tidal.com'].includes(new URL(String(url),location.href).hostname)?Promise.resolve(new Response(JSON.stringify({items:[],data:[],included:[]}))):providerTestFetch(url,...args);`});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#tidalTab')");
  const visible=()=>evaluate("[...document.querySelectorAll('.provider-tabs [role=tab]')].filter(n=>n.checkVisibility()).map(n=>n.id)");
  assert.deepEqual(await visible(),[]);
  await evaluate("document.querySelector('.dj-import-options>button').click()");
  assert.equal(await evaluate("[...document.querySelectorAll('.dj-connect-provider')].every(n=>n.checkVisibility())&&document.querySelectorAll('.dj-connect-provider').length===2"),true);
  for(const label of ['Spotify verbinden','TIDAL verbinden']){
   await evaluate(`[...document.querySelectorAll('.dj-connect-provider')].find(n=>n.textContent===${JSON.stringify(label)}).click()`);
   await wait("document.querySelector('dialog[open]')");
   assert.deepEqual(await visible(),[]);
   await evaluate("document.querySelector('dialog[open]').close();document.querySelector('.dj-import-options>button').click()");
  }
  await evaluate("document.querySelector('#libraryImportPopover').hidePopover();sessionStorage.setItem('anydj-spotify-session',JSON.stringify({access_token:'test',clientId:'test',expiresAt:Date.now()+3600000}));window.__reload=true");
  await c('Page.reload');await wait("!window.__reload&&document.querySelector('#tidalTab')");
  console.log('Spotify visible',await visible());
  assert.deepEqual(await visible(),['localTab','spotifyTab']);
  await evaluate("document.querySelector('#spotifyTab').click()");
  await evaluate("[...document.querySelectorAll('#spotifyLibrary button')].find(n=>n.textContent==='Verbindung').click()");
  await evaluate("[...document.querySelectorAll('dialog[open] button')].find(n=>n.textContent==='Verbindung trennen').click()");
  assert.deepEqual(await visible(),[]);assert.equal(await evaluate("!document.querySelector('#localLibrary').hidden"),true);
  await evaluate("sessionStorage.setItem('anydj-tidal-session',JSON.stringify({access_token:'test',clientId:'test',expiresAt:Date.now()+3600000}));window.__reload=true");
  await c('Page.reload');await wait("!window.__reload&&document.querySelector('#tidalTab')");
  assert.deepEqual(await visible(),['localTab','tidalTab']);
  await evaluate("document.querySelector('#localTab').focus();document.querySelector('#localTab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("document.activeElement.id"),'tidalTab');
  await evaluate("[...document.querySelectorAll('#tidalLibrary button')].find(n=>n.textContent==='Verbindung').click()");
  await evaluate("[...document.querySelectorAll('dialog[open] button')].find(n=>n.textContent==='Verbindung trennen').click()");
  assert.deepEqual(await visible(),[]);assert.equal(await evaluate("!document.querySelector('#localLibrary').hidden"),true);
  assert.deepEqual(errors,[]);console.log('Provider visibility passed: disconnected, connection dialogs, restored sessions, disconnect fallback and keyboard skips hidden sources.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
