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
    const data=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[extname(file)]||'application/octet-stream'});res.end(data);
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
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+JSON.stringify(await evaluate("({status:document.querySelector('#djStatus')?.textContent,library:document.querySelector('#libraryStatus')?.textContent,tracks:[...document.querySelectorAll('#trackList small')].map(n=>({text:n.textContent,kind:n.dataset.analysis})),demo:typeof document.querySelector('#demoTracks')?.onclick})")));};

 if(process.argv.includes('--capture-product')){
  await c('Emulation.setDeviceMetricsOverride',{width:1440,height:920,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'dj.html'});await wait("typeof document.querySelector('#demoTracks')?.onclick==='function'&&document.querySelector('#queueNew')?.disabled===false");
  await evaluate("document.querySelector('#demoTracks').click()");

  await wait("document.querySelectorAll('#trackList small').length===2&&[...document.querySelectorAll('#trackList small')].every(n=>n.dataset.analysis==='complete')");
  await evaluate("document.querySelectorAll('[aria-label=\"Auf Deck A laden\"]')[0].click();document.querySelectorAll('[aria-label=\"Auf Deck B laden\"]')[1].click();document.querySelector('#enqueueAll').click();document.querySelector('#openLightStage').click()");
  await wait("[...document.querySelectorAll('.dj-play')].every(b=>!b.disabled)");
  await evaluate("document.querySelector('.dj-play').click()");await wait("document.querySelector('audio').currentTime>.5");
  await evaluate("document.querySelector('.dj-seek').value=8;document.querySelector('.dj-seek').dispatchEvent(new Event('input'))");
  await new Promise(resolve=>setTimeout(resolve,350));
  const shot=await c('Page.captureScreenshot',{format:'webp',quality:90});
  await writeFile('web/product-preview.webp',Buffer.from(shot.data,'base64'));
  console.log('Actual DJ product screenshot captured with generated demo audio.');
 }else{
  for(const page of ['index.html','downloads.html']){
   await c('Page.navigate',{url:base+page});await wait("document.querySelector('h1')&&document.readyState==='complete'");
   for(const width of [1440,768,390,320]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw Error('Horizontal overflow: '+page+' '+width);
    if(!await evaluate("[...document.images].every(i=>i.complete&&i.naturalWidth>0)"))throw Error('Missing image: '+page);
    const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`/tmp/anydj-site-${page.replace('.html','')}-${width}.png`,Buffer.from(shot.data,'base64'));
   }
   const links=await evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))");
   for(const href of new Set(links)){
    if(href.startsWith('#')){if(!await evaluate(`Boolean(document.getElementById(${JSON.stringify(href.slice(1))}))`))throw Error('Missing anchor '+href);continue;}
    if(href.includes('/downloads/'))continue;
    const response=await fetch(new URL(href,base+page));if(!response.ok)throw Error('Broken page link: '+href);
   }
   if(page==='downloads.html'){
    await evaluate("document.querySelectorAll('.faq-list details')[1].querySelector('summary').click()");
    if(!await evaluate("document.querySelectorAll('.faq-list details')[1].open"))throw Error('FAQ did not open');
    if(!await evaluate("document.querySelector('.is-pending')===null||document.querySelector('.is-pending a[download]')===null"))throw Error('Unavailable installer has download button');
   }
  }
  if(errors.length)throw Error(JSON.stringify(errors));
  console.log('Marketing pages passed: desktop/tablet/mobile, no overflow, product image, navigation, FAQ and honest download availability.');
 }
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
