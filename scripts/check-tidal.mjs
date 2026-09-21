import assert from 'node:assert/strict';
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

 await c('Page.addScriptToEvaluateOnNewDocument',{source:`
  if(!sessionStorage.getItem('test-tidal-disconnected'))sessionStorage.setItem('anydj-tidal-session',JSON.stringify({clientId:'testClient123',access_token:'access',expiresAt:Date.now()+3600000}));
  window.tidalCalls=[];window.externalVisits=0;
  window.open=url=>{window.loginURL=url;return {close(){}}};
  const original=fetch.bind(window),pid='550e8400-e29b-41d4-a716-446655440000';
  const ref=(type,id)=>({type,id});
  const track={...ref('tracks','123'),attributes:{title:'TIDAL Test Track',duration:'PT3M20S'},relationships:{artists:{data:[ref('artists','456')]},albums:{data:[ref('albums','789')]}}};
  const included=[{...ref('artists','456'),attributes:{name:'Test Artist'}},{...ref('albums','789'),relationships:{coverArt:{data:[ref('artworks','cover')]}}},{...ref('artworks','cover'),attributes:{files:[{href:'https://resources.tidal.com/images/test/80x80.jpg',meta:{width:80}}]}}];
  window.fetch=async(url,options={})=>{
   if(!String(url).startsWith('https://openapi.tidal.com/v2/'))return original(url,options);
   tidalCalls.push(String(url));const u=new URL(url),p=u.pathname;let data;
   if(p.endsWith('/users/me'))data={data:{type:'users',id:'me',attributes:{country:'DE'}}};
   else if(p.includes('/userCollectionPlaylists/'))data={data:[ref('playlists',pid)]};
   else if(p.endsWith('/playlists'))data={data:[{...ref('playlists',pid),attributes:{name:'TIDAL Set'}}]};
   else if(p.endsWith('/tracks'))data=p.includes('/relationships/')?{data:[ref('tracks','123')]}:{data:[track],included};
   else if(p.endsWith('/searchResults'))data={data:[ref('searchResults','search-id')]};
   else if(p.includes('/userCollectionTracks/'))data={data:[ref('tracks','123')]};
   else if(p.includes('/playlists/'))data={data:[ref('tracks','123')],links:{next:u.searchParams.has('page[cursor]')?null:'?page[cursor]=next'}};
   else return new Response('{}',{status:404});
   return new Response(JSON.stringify(data));
  };
 `});
 await c('Page.navigate',{url:base+'dj.html'});
 await wait("document.querySelector('#tidalTab')&&document.querySelector('#queueSelect').dataset.lists!==undefined");
 assert.equal(await evaluate('tidalCalls.length'),0);
 await evaluate("document.querySelector('#demoTracks').click()");
 await wait("document.querySelectorAll('#trackList [data-analysis=complete]').length===2");
 await evaluate("document.querySelector('#tidalTab').click()");
 await wait("document.querySelector('#tidalTracks').textContent.includes('TIDAL Set')");
 assert.equal(await evaluate("document.querySelector('#localLibrary').hidden&&document.querySelector('#spotifyLibrary').hidden&&!document.querySelector('#tidalLibrary').hidden"),true);
 await evaluate("document.querySelector('#tidalTracks .spotify-title').click()");
 await wait("document.querySelector('#tidalTracks').textContent.includes('TIDAL Test Track')");
 assert.equal(await evaluate("[...document.querySelectorAll('#tidalTracks a')].every(a=>a.closest('details'))"),true);
 assert.equal(await evaluate("[...document.querySelectorAll('#tidalTracks button')].find(b=>b.textContent==='Einreihen').disabled"),true);
 assert.equal(await evaluate("document.querySelector('#tidalTracks img').getAttribute('src')"),'https://resources.tidal.com/images/test/80x80.jpg');
 await evaluate("[...document.querySelectorAll('#tidalTracks button')].find(b=>b.textContent==='Datei zuordnen').click()");
 await evaluate("const s=document.querySelector('dialog[open] select');s.selectedIndex=1;[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Zuordnung bestätigen').click()");
 await evaluate("[...document.querySelectorAll('#tidalTracks button')].find(b=>b.textContent==='Einreihen').click()");
 await wait("document.querySelector('#queueCount').textContent==='1'");
 await evaluate("[...document.querySelectorAll('#tidalLibrary button')].find(b=>b.textContent==='Mehr laden').click()");
 await wait("document.querySelectorAll('#tidalTracks>li').length===2");
 await evaluate("[...document.querySelectorAll('#tidalLibrary button')].find(b=>b.textContent==='Zugeordnete einreihen').click()");
 await wait("document.querySelector('#queueCount').textContent==='3'");
 await evaluate("[...document.querySelectorAll('#tidalTracks button')].find(b=>b.textContent==='Auf Deck A').click()");
 await wait("document.querySelector('.dj-track-title').textContent.includes('Demo')");
 await evaluate("document.querySelector('#tidalLibrary form input').value='song';document.querySelector('#tidalLibrary form').dispatchEvent(new Event('submit',{cancelable:true}))");
 await wait("document.querySelectorAll('#tidalTracks>li').length===1&&document.querySelector('#tidalLibrary').getAttribute('aria-busy')==='false'");
 assert.equal(await evaluate("tidalCalls.some(u=>u.includes('/searchResults?'))"),true);
 await evaluate("document.querySelector('#tidalSource').value='tracks';document.querySelector('#tidalSource').dispatchEvent(new Event('change'))");
 await wait("tidalCalls.some(u=>u.includes('/userCollectionTracks/'))&&document.querySelector('#tidalLibrary').getAttribute('aria-busy')==='false'");
 await evaluate("document.querySelector('#tidalTab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
 assert.equal(await evaluate("document.querySelector('#spotifyTab').getAttribute('aria-selected')"),'true');
 assert.equal(await evaluate("document.querySelector('#tidalLibrary').hidden"),true);
 await evaluate("document.querySelector('#tidalTab').click();document.querySelector('.provider-tabbar>button').click()");
 await wait("document.querySelector('[data-tidal-connection]')");
 await evaluate("document.querySelector('dialog[open] input').value='testClient123';[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Erneut anmelden').click()");
 await wait('window.loginURL');
 assert.equal(await evaluate("new URL(loginURL).pathname"),'/preview/anydj/tidal-callback.html');
 await evaluate("const p=new URLSearchParams(new URL(loginURL).hash.slice(1)),bc=new BroadcastChannel('anydj-tidal-'+p.get('channel'));bc.postMessage({token:{clientId:'testClient123',access_token:'new',expiresAt:Date.now()+3600000}});bc.close()");
 await wait("!document.querySelector('dialog[open]')&&document.querySelector('#tidalTracks').textContent.includes('TIDAL Set')");
 for(const width of [1280,390]){await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
 await evaluate("[...document.querySelectorAll('#tidalLibrary button')].find(b=>b.textContent==='Verbindung').click();[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Verbindung trennen').click()");
 assert.equal(await evaluate("sessionStorage.getItem('anydj-tidal-session')"),null);
 assert.equal(await evaluate("document.querySelector('#tidalTracks').textContent.includes('TIDAL Set')"),false);
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({tidalTabs:true,playlists:true,search:true,favourites:true,covers:true,pagination:true,localMapping:true,queueDuplicates:true,deckLoading:true,oauthPopup:true,disconnect:true,mobile:true,browserErrors:0},null,2));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
