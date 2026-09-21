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
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors));};
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base});await wait("document.querySelector('h1')?.textContent.includes('Dein Mix')");
 for(const width of [1280,390]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
   if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw Error('Landing overflow');
   const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`/tmp/anydj-web-landing-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base+'dj.html'});await wait("document.querySelectorAll('.dj-play').length===2");
 await evaluate("document.querySelector('#demoTracks').click()");
 await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(s=>s.textContent==='✓ Browseranalyse fertig')");
 await evaluate("document.querySelectorAll('#trackList button[aria-label=\"Auf Deck A laden\"]')[0].click();document.querySelectorAll('#trackList button[aria-label=\"Auf Deck B laden\"]')[1].click();document.querySelector('#enqueueAll').click()");
 await wait("[...document.querySelectorAll('.dj-play')].every(b=>!b.disabled)&&document.querySelector('#queueCount').textContent==='2'");
 await evaluate("document.querySelector('.dj-play').click()");await wait("document.querySelector('audio').currentTime>.3");
 await wait("document.querySelector('#previewMix').style.getPropertyValue('--light-color').startsWith('rgb(')");
 if(!await evaluate("document.querySelector('#autoBeat').disabled&&!document.querySelector('#djStructure').checked"))throw Error('Unavailable features still active');
 const shot=await c('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/anydj-web-dj.png',Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('#djStop').click()");
 await wait("[...document.querySelectorAll('audio')].every(a=>a.paused)");
 await c('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw Error('DJ mobile overflow');
 await c('Page.reload');await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(s=>s.textContent==='✓ Browseranalyse fertig')");
 await new Promise(r=>setTimeout(r,7500));
 const unwanted=requests.filter(r=>r.url.includes('/api/')||r.method!=='GET');if(unwanted.length)throw Error('Backend request/upload: '+JSON.stringify(unwanted));
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({staticWeb:true,subdirectory:true,demoTracks:2,browserAnalysis:true,audioPlayback:true,colorPreview:true,queue:true,cacheRestored:true,mobileNoOverflow:true,apiRequests:0,uploads:0,browserErrors:0},null,2));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
