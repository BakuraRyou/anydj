import http from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=resolve('dist/web'),prefix='/preview/anydj/',requests=[],errors=[];
const server=http.createServer(async(req,res)=>{
  requests.push({url:req.url,method:req.method});
  try{
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))throw Error();
    const file=resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)||'index.html'));if(!file.startsWith(root+'/'))throw Error();
    const data=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}${prefix}`;
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
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+await evaluate("document.querySelector('#trackList')?.innerText"));};
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base});await wait("document.querySelector('h1')?.textContent.includes('Dein Mix')");
 for(const width of [1280,390]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
   if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw Error('Landing overflow');
   const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`/tmp/anydj-web-landing-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base+'dj.html'});await wait("document.querySelectorAll('.dj-play').length===2");
 await wait("document.querySelector('#queueSelect').dataset.lists!==undefined");
 await evaluate("document.querySelector('#demoTracks').click()");
 await wait("document.querySelectorAll('#trackList [data-analysis=complete]').length===2");
 await evaluate("document.querySelector('#queueShuffleCount').value='1';document.querySelector('#queueShuffleCount').dispatchEvent(new Event('change'))");
 await evaluate("document.querySelector('#trackSearch').value='no-match';document.querySelector('#trackSearch').dispatchEvent(new Event('input'));document.querySelector('#queueShuffle').click()");
 await wait("document.querySelector('#queueCount').textContent==='1'");
 await evaluate("document.querySelector('#queueShuffleCount').value='2';document.querySelector('#queueShuffleCount').dispatchEvent(new Event('change'))");
 await wait("document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('#queueShuffleCount').value='1';document.querySelector('#queueShuffleCount').dispatchEvent(new Event('change'))");
 if(!await evaluate("document.querySelector('#queueCount').textContent==='2'"))throw Error('Reducing lookahead removed planned titles');

 if(!await evaluate("[...document.querySelectorAll('audio')].every(a=>a.paused)"))throw Error('Shuffle toggle unexpectedly starts playback');
 await evaluate("document.querySelector('#queueStart').click()");
 await wait("[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>.2)");
 await wait("document.querySelector('#queueCount').textContent==='1'");
 const first=await evaluate("[...document.querySelectorAll('audio')].findIndex(a=>!a.paused)");
 await evaluate("document.querySelector('#fadeDuration').value='2';document.querySelector('#autoBeat').checked=false;[...document.querySelectorAll('audio')].find(a=>!a.paused).currentTime=20");
 await wait(`[...document.querySelectorAll('audio')].some((a,i)=>i!==${first}&&!a.paused&&a.currentTime>.2)`);
 await wait("document.querySelector('#queueCount').textContent==='1'");
 await evaluate("document.querySelector('#queueStart').click();document.querySelector('#queueShuffle').click()");
 if(!await evaluate("document.querySelector('#queueCount').textContent==='1'"))throw Error('Disabling shuffle removed queued titles');
 await evaluate("document.querySelector('#queueShuffle').click();document.querySelector('#queueClear').click()");
 if(!await evaluate("document.querySelector('#queueShuffle').getAttribute('aria-pressed')==='false'&&document.querySelector('#queueCount').textContent==='0'"))throw Error('Clearing queue must disable refill');
 await c('Page.reload');await wait("document.querySelector('#queueSelect').dataset.lists!==undefined");
 if(!await evaluate("document.querySelector('#queueShuffleCount').value==='1'"))throw Error('Lookahead setting not restored');
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({shuffle:true,ignoresSearch:true,noAutoplay:true,automaticRefill:true,disablePreservesQueue:true,clearDisablesShuffle:true,browserErrors:0}));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
