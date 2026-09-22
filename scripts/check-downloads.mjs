import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHostedServer} from '../builder/hosting/server.mjs';
const errors=[];
const server=await createHostedServer({root:resolve('dist/hosting'),watchRestart:false});
server.prependListener('request',req=>{if(req.url.startsWith('/preview/anydj/'))req.url=req.url.slice('/preview/anydj'.length);});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/preview/anydj/`;
const profile=await mkdtemp(join(tmpdir(),'anydj-web-test-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--mute-audio','--autoplay-policy=no-user-gesture-required','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timeout=setTimeout(()=>reject(Error('Chrome timeout')),15000);chrome.stderr.on('data',data=>{log+=data;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});chrome.on('error',reject);});
 ws=new WebSocket(endpoint);await once(ws,'open');let next=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const c=(method,params)=>send(method,params,sessionId);await c('Runtime.enable');await c('Page.enable');
 const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors));};
 await c('Page.navigate',{url:base+'index.html'});await wait("document.querySelector('a[href=\"./downloads.html\"]')");
 await evaluate("document.querySelector('a[href=\"./downloads.html\"]').click()");
 await wait("document.querySelectorAll('.download-card').length===2");
 for(const width of [1280,390]){
  await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw Error('Download page overflow');
  const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`/tmp/anydj-downloads-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 const links=await evaluate("[...document.querySelectorAll('a[download]')].map(a=>a.href)");
 if(!links.length)throw Error('No published installers to verify');
 for(const link of links){
  if(!link.startsWith(base+'downloads/'))throw Error('Broken subdirectory link');
  const head=await fetch(link,{method:'HEAD'});if(head.status!==200||Number(head.headers.get('Content-Length'))<=0)throw Error('Installer HEAD failed');
  const range=await fetch(link,{headers:{Range:'bytes=0-15'}});if(range.status!==206||(await range.arrayBuffer()).byteLength!==16)throw Error('Installer range download failed');
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({downloads:links.length,subdirectory:true,desktopAndMobile:true,headAndRange:true,browserErrors:0}));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
