import http from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
let testMeasurementId='';
const root=resolve('dist/web'),prefix='/preview/anydj/',requests=[],errors=[];
const server=http.createServer(async(req,res)=>{
  requests.push({url:req.url,method:req.method});
  try{
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))throw Error();
    const file=resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)||'index.html'));if(!file.startsWith(root+'/'))throw Error();
    const data=file===join(root,'analytics-config.js')?Buffer.from('export const measurementId='+JSON.stringify(testMeasurementId)+';'):await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream'});res.end(data);
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


 // Google is mocked at the network boundary; no test data leaves this machine.
 const googleRequests=[],mockScript=[
 "window.__privacyMockLoaded=true;",
 "const config=window.dataLayer.map(args=>Array.from(args)).find(args=>args[0]==='config');",
 "if(config&&!window['ga-disable-'+config[1]]){",
 "document.cookie='_ga=GA1.1.test; Path='+config[2].cookie_path+'; SameSite=Lax';",
 "document.cookie='_ga_TEST123456=test; Path='+config[2].cookie_path+'; SameSite=Lax';",
 "navigator.sendBeacon('https://www.google-analytics.com/g/collect?tid='+config[1]+'&dl='+encodeURIComponent(config[2].page_location));}"
 ].join('\n');
 ws.addEventListener('message',event=>{
   const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return;
   const request=m.params;googleRequests.push(request.request.url);
   void send('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:200,
     responseHeaders:[{name:'Content-Type',value:request.request.url.includes('/gtag/js')?'text/javascript':'text/plain'},{name:'Access-Control-Allow-Origin',value:'*'}],
     body:Buffer.from(request.request.url.includes('/gtag/js')?mockScript:'').toString('base64')},m.sessionId);
 });
 const interception={patterns:[{urlPattern:'https://*.googletagmanager.com/*'},{urlPattern:'https://*.google-analytics.com/*'},{urlPattern:'https://*.analytics.google.com/*'}]};
 await c('Fetch.enable',interception);
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,150));
 const ready="document.readyState==='complete'&&document.querySelector('[data-privacy-settings]')?.hidden===false";
 const navigate=async(page='index.html')=>{await c('Page.navigate',{url:base+page});await wait(ready);await pause();};
 const click=selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
 const value=()=>evaluate("JSON.parse(localStorage.getItem('anydj-privacy-v1'))");
 const noGoogle=async(count=0)=>{await pause();assert(googleRequests.length===count,'Unexpected Google request: '+JSON.stringify(googleRequests));};
 const consent=()=>({version:1,measurementId:'G-TEST123456',analytics:true,savedAt:Date.now()});
 const installChoice=async saved=>{saved.expiresAt=saved.savedAt+180*86400_000;await evaluate("localStorage.setItem('anydj-privacy-v1',"+JSON.stringify(JSON.stringify(saved))+")");};

 await navigate();
 assert(await evaluate("document.querySelector('#privacy-panel').hidden"),'Banner without configuration');
 await click('[data-privacy-settings]');
 assert(await evaluate("!document.querySelector('#privacy-panel').hidden&&document.querySelector('#privacy-accept').hidden"),'Inactive settings');
 await click('#privacy-close');await noGoogle();

 testMeasurementId='G-TEST123456';
 await navigate('index.html?email=private@example.invalid#secret');
 assert(await evaluate("!document.querySelector('#privacy-panel').hidden"),'Initial consent missing');
 assert(await value()===null,'No consent may be stored before a choice');await noGoogle();
 for(const width of [1440,768,390,320]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"),'Privacy horizontal overflow at '+width);
   assert(await evaluate("['privacy-reject','privacy-accept'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})"),'Buttons not reachable at '+width);
   assert(await evaluate("getComputedStyle(document.getElementById('privacy-reject')).backgroundColor===getComputedStyle(document.getElementById('privacy-accept')).backgroundColor"),'Unequal consent button emphasis');
   if(width===390){const shot=await c('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/anydj-privacy-mobile.png',Buffer.from(shot.data,'base64'));}
 }
 await click('#privacy-reject');assert((await value()).analytics===false,'Reject not saved');
 await navigate('downloads.html');assert(await evaluate("document.querySelector('#privacy-panel').hidden"),'Reject not remembered');await noGoogle();

 await click('[data-privacy-settings]');await click('#privacy-accept');
 await wait("window.__privacyMockLoaded===true");await pause();assert(googleRequests.length===2,'One script and one collection request expected');
 const commands=await evaluate("window.dataLayer.map(args=>Array.from(args))");
 assert(commands[0][0]==='consent'&&commands[0][2].analytics_storage==='denied','Missing default-denied consent');
 assert(commands[0][2].ad_storage==='denied'&&commands[0][2].ad_user_data==='denied'&&commands[0][2].ad_personalization==='denied','Advertising allowed');
 assert(commands[1][2].analytics_storage==='granted','Missing grant');
 const config=commands.find(args=>args[0]==='config')[2];
 assert(config.page_referrer===''&&config.page_location===base+'downloads.html','Unsafe page URL or referrer');
 assert(config.cookie_expires===180*86400&&config.cookie_update===false&&config.cookie_domain==='none','Cookie minimization');
 assert(config.allow_google_signals===false&&config.allow_ad_personalization_signals===false,'Advertising signals');
 assert((await evaluate('document.cookie')).includes('_ga='),'Test cookies not set');

 await click('[data-privacy-settings]');await click('#privacy-reject');await wait(ready);
 assert((await value()).analytics===false,'Withdrawal not saved');
 assert(await evaluate("!document.cookie.includes('_ga')&&!document.getElementById('anydj-google-tag')"),'Withdrawal did not remove cookies/tag');
 await noGoogle(2);

 await navigate('index.html?email=private@example.invalid#secret');
 await click('[data-privacy-settings]');await click('#privacy-accept');await wait('window.__privacyMockLoaded===true');
 assert(await evaluate("window.dataLayer.find(args=>args[0]==='config')[2].page_location===location.origin+location.pathname"),'Query/hash leaked');
 await pause();const allowedCount=googleRequests.length;
 const {targetId:secondTarget}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId:secondSession}=await send('Target.attachToTarget',{targetId:secondTarget,flatten:true});
 const second=(method,params)=>send(method,params,secondSession);
 await second('Fetch.enable',interception);await second('Page.enable');await second('Runtime.enable');
 await second('Page.navigate',{url:base+'dj.html'});
 for(let i=0;i<200;i++){
   const r=await second('Runtime.evaluate',{expression:ready,returnByValue:true});
   if(r.result.value)break;await pause();
 }
 await second('Runtime.evaluate',{expression:"document.querySelector('[data-privacy-settings]').click();document.querySelector('#privacy-reject').click()",userGesture:true});
 await wait("document.readyState==='complete'&&document.querySelector('[data-privacy-settings]')?.hidden===false&&!window.__privacyMockLoaded");
 await noGoogle(allowedCount);
 await send('Target.closeTarget',{targetId:secondTarget});

 for(const saved of [null,{...consent(),savedAt:Date.now()-181*86400_000},{...consent(),savedAt:Date.now()+86400_000},{...consent(),version:0},{...consent(),measurementId:'G-OTHER12345'}]){
   if(saved)await installChoice(saved);else await evaluate("localStorage.setItem('anydj-privacy-v1','broken')");
   await navigate();
   assert(await evaluate("!document.querySelector('#privacy-panel').hidden&&!document.getElementById('anydj-google-tag')"),'Invalid consent loaded Analytics');
 }
 await noGoogle(allowedCount);

 const almostExpired=consent();almostExpired.savedAt=Date.now()-180*86400_000+2500;
 await installChoice(almostExpired);await navigate();await wait('window.__privacyMockLoaded===true');
 await wait("document.readyState==='complete'&&!window.__privacyMockLoaded&&document.querySelector('#privacy-panel')?.hidden===false");
 const expiryCount=googleRequests.length;await noGoogle(expiryCount);

 await installChoice(consent());await navigate('dj.html');
 assert(await evaluate("!document.getElementById('anydj-google-tag')"),'DJ measured');
 await click('[data-privacy-settings]');await click('#privacy-accept');await noGoogle(expiryCount);
 for(const page of ['spotify-callback.html','tidal-callback.html']){
   const html=await (await fetch(base+page)).text();
   assert(!html.includes('privacy.js')&&!html.includes('googletagmanager'),'OAuth callback contains tracking');
 }

 const {identifier}=await c('Page.addScriptToEvaluateOnNewDocument',{source:"Storage.prototype.getItem=function(){throw new Error('blocked')};Storage.prototype.setItem=function(){throw new Error('blocked')};"});
 await navigate();await click('#privacy-accept');
 assert(await evaluate("!document.getElementById('anydj-google-tag')&&document.querySelector('#privacy-status').textContent.includes('nicht speichern')"),'Storage failure did not fail closed');
 await noGoogle(expiryCount);await c('Page.removeScriptToEvaluateOnNewDocument',{identifier});await navigate();

 // Failure to persist a withdrawal must still stop an already loaded tag.
 await installChoice(consent());await navigate();await wait('window.__privacyMockLoaded===true');await pause();
 const beforeFailedWrite=googleRequests.length;
 await evaluate("window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('write blocked')}");
 await click('[data-privacy-settings]');await click('#privacy-reject');
 assert(await evaluate("window['ga-disable-G-TEST123456']===true&&!document.cookie.includes('_ga')&&localStorage.getItem('anydj-privacy-v1')===null"),'Failed withdrawal did not stop tracking');
 await evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow'))");await noGoogle(beforeFailedWrite);
 await evaluate("Storage.prototype.setItem=window.originalSetItem");
 await click('#privacy-accept');await wait("document.readyState==='complete'&&window.__privacyMockLoaded===true&&typeof window.originalSetItem==='undefined'");
 await pause();const finalCount=googleRequests.length;
 assert(finalCount===beforeFailedWrite+2,'Retry after storage failure did not restore opted-in measurement');
 testMeasurementId='';await navigate();await noGoogle(finalCount);
 assert(await evaluate("document.querySelector('#privacy-panel').hidden"),'Missing ID must disable restored consent');
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('Privacy passed: disabled configuration, prior consent, reject/accept/revoke, cookies, query stripping, expiry, invalid consent, cross-tab withdrawal, blocked storage, mobile, subdirectory, no DJ/OAuth tracking; all Google requests intercepted.');
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
