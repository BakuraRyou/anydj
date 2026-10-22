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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};




  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#tidalTab')");
  await evaluate(`(async()=>{const {saveTrack}=await import('/dj-library.js');await saveTrack({id:'compact-test',name:'Beispieltrack.mp3',size:123,lastModified:1});})()`);
  await evaluate('window.__reload=true');await c('Page.reload');await wait("!window.__reload&&document.querySelector('#trackList li')&&document.querySelector('#tidalTab')");
  for(const [width,height,pane] of [[1440,900,0],[1280,800,0],[390,844,0],[1440,900,300]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await c('Emulation.setTouchEmulationEnabled',{enabled:width<600});
   await evaluate(`{const n=document.querySelector('.dj-resize-collections');if(${pane})n.style.setProperty('--dj-split-tracks','${pane}px 8px minmax(0,1fr)');else n.style.removeProperty('--dj-split-tracks');}`);
   await new Promise(r=>setTimeout(r,180));
   const metrics=await evaluate(`(()=>{const root=document.querySelector('#libraryDrop'),heading=root.querySelector('.dj-library-heading'),tools=document.querySelector('#libraryTools'),list=document.querySelector('#trackList'),r=root.getBoundingClientRect(),h=heading.getBoundingClientRect(),t=tools.getBoundingClientRect();const nodes=[heading.querySelector('h2'),...root.querySelectorAll('.provider-tabs button'),root.querySelector('.dj-import-options>button'),...tools.children].filter(n=>!n.matches('[popover]')&&n.checkVisibility());return {pane:r.width,headerHeight:Math.round(list.getBoundingClientRect().top-r.top),oneHeadingRow:[...root.querySelectorAll('.provider-tabs button')].filter(n=>n.checkVisibility()).every(n=>Math.abs(n.getBoundingClientRect().top+n.getBoundingClientRect().height/2-h.top-h.height/2)<3),fits:nodes.every(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.left>=r.left&&b.right<=r.right+1;}),overlap:Math.max(...[...heading.children].map(n=>n.getBoundingClientRect().bottom))>t.top};})()`);
   console.log({width,pane,...metrics});assert.equal(metrics.oneHeadingRow,true);assert.equal(metrics.fits,true);assert.equal(metrics.overlap,false);assert.ok(metrics.headerHeight<=110);
   await evaluate("document.querySelector('.dj-import-options>button').click()");await wait("document.querySelector('#libraryImportPopover').matches(':popover-open')");
   assert.equal(await evaluate("document.querySelector('.dj-connect-provider').checkVisibility()&&document.querySelector('#addTracks').checkVisibility()&&document.querySelector('#linkFolder').checkVisibility()"),true);
   await evaluate("document.querySelector('#libraryImportPopover').hidePopover()");
   await evaluate("document.querySelector('#libraryDrop').scrollIntoView({block:'start'})");
   await writeFile(new URL('../reports/library-compact-'+width+(pane?'-narrow':'')+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.equal(await evaluate("[...document.querySelectorAll('.provider-tabs button')].every(n=>!n.checkVisibility())"),true);
  await evaluate("document.querySelector('#libraryFilterButton').click()");await wait("document.querySelector('#libraryFilterPopover').matches(':popover-open')");
  assert.deepEqual(errors,[]);console.log('Compact library passed: two header rows, 300 px resized pane, touch layout, import/connect controls, disconnected sources hidden and filters.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
