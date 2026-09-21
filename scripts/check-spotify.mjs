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
   sessionStorage.setItem('anydj-spotify-session',JSON.stringify({clientId:'a'.repeat(32),access_token:'test-access',refresh_token:'test-refresh',expiresAt:Date.now()+3600000}));
   window.spotifyCalls=[];
   const original=window.fetch.bind(window);
   const track=(id,name)=>({id,type:'track',name,artists:[{name:'Demo Artist'}],duration_ms:180000,album:{name:'Demo album'}});
   window.fetch=async(url,options={})=>{
     if(!String(url).startsWith('https://api.spotify.com/'))return original(url,options);
     spotifyCalls.push(String(url));
     const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
     const path=new URL(url).pathname,offset=new URL(url).searchParams.get('offset');
     if(path.endsWith('/me/playlists'))return response({items:[{id:'A'.repeat(22),name:'Mein DJ-Set',owner:{display_name:'DJ Test'}}],next:null});
     if(path.includes('/playlists/'))return response(offset?{items:[{track:track('second','Zweiter Titel')},{item:track('first','Demo Groove')}],next:null}:{items:[{item:track('first','Demo Groove')},{item:null}],next:'https://api.spotify.com/v1/playlists/'+ 'A'.repeat(22)+'/items?offset=2'});
     if(path.endsWith('/me/tracks'))return response({items:[{track:track('first','Demo Groove')}],next:null});
     if(path.endsWith('/search'))return response({tracks:{items:[track('search','Gesuchter Titel')],next:null}});
     return response({},403);
   };
 `});
 await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await c('Page.navigate',{url:base+'dj.html'});await wait("document.querySelector('#spotifyTab')&&document.querySelector('#queueSelect').dataset.lists!==undefined");
 assert.equal(await evaluate('spotifyCalls.length'),0,'no Spotify requests before user action');
 await evaluate("document.querySelector('#demoTracks').click()");
 await wait("document.querySelectorAll('#trackList [data-analysis=complete]').length===2");
 await evaluate(`window.clickText=text=>{if(['Playlists','Lieblingssongs'].includes(text)){const s=document.querySelector('#spotifySource');s.value=text==='Playlists'?'playlists':'liked';s.dispatchEvent(new Event('change'));}else [...document.querySelectorAll('#spotifyLibrary button')].find(b=>b.textContent===text).click();};document.querySelector('#spotifyTab').click();clickText('Playlists')`);
 await wait("document.querySelector('#spotifyTracks')?.textContent.includes('Mein DJ-Set')");
 assert.equal(await evaluate("document.querySelector('#localLibrary').hidden"),true);
 await evaluate("clickText('Öffnen')");await wait("document.querySelector('#spotifyTracks')?.textContent.includes('Demo Groove')");
 assert.equal(await evaluate("[...document.querySelectorAll('#spotifyTracks button')].find(b=>b.textContent==='Einreihen').disabled"),false);
 await evaluate("clickText('Datei zuordnen')");await wait("document.querySelector('dialog[open] select')?.options.length===2");
 await evaluate("document.querySelector('dialog[open] select').selectedIndex=0;[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Zuordnung bestätigen').click()");
 await wait("!document.querySelector('dialog[open]')&&!document.querySelector('#spotifyTracks button').disabled");
 await evaluate("clickText('Restliche Titel laden')");await wait("document.querySelectorAll('#spotifyTracks>li').length===3");
 await evaluate("clickText('Zugeordnete einreihen')");await wait("document.querySelector('#queueCount').textContent==='2'");
 assert.match(await evaluate("document.querySelector('#spotifyStatus').textContent"),/1 ohne verfügbare/);
 await evaluate("clickText('Als DJ-Liste speichern')");await wait("document.querySelector('#queueName').value==='Spotify · Mein DJ-Set'");
 assert.equal(await evaluate("document.querySelectorAll('#queueList>li').length"),2);
 await evaluate("clickText('Lokale Datei auf Deck A')");await wait("!document.querySelector('.dj-play').disabled");
 await evaluate("document.querySelector('.dj-play').click()");await wait("document.querySelector('audio').currentTime>.2");
 await evaluate("clickText('Verbindung')");assert.equal(await evaluate("document.querySelector('audio').paused"),false,'connection dialog does not stop decks');
 assert.equal(await evaluate("document.querySelector('dialog[open] input')"),null);
 await evaluate("document.querySelector('dialog[open]').close();clickText('Lieblingssongs')");await wait("document.querySelectorAll('#spotifyTracks>li').length===1");
 assert.equal(await evaluate("document.querySelector('#spotifyTracks button').disabled"),false,'mapping reused in favourites');
 for(const width of [1280,390]){
   await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'no overflow');
   const shot=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`/tmp/anydj-spotify-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await evaluate("document.querySelector('#spotifyLibrary form input').value='Artist Song';document.querySelector('#spotifyLibrary form').requestSubmit()");
 await wait("document.querySelector('#spotifyTracks').textContent.includes('Gesuchter Titel')");
 assert.equal(await evaluate("new URL(spotifyCalls.at(-1)).searchParams.get('limit')"),'10');
 await evaluate("document.querySelector('#localTab').click()");assert.equal(await evaluate("document.querySelector('#localLibrary').hidden"),false);
 await evaluate("document.querySelector('#spotifyTab').click();clickText('Verbindung');[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Verbindung trennen').click()");
 assert.equal(await evaluate("sessionStorage.getItem('anydj-spotify-session')"),null);
 assert.equal(await evaluate("document.querySelector('#spotifyTracks').textContent.includes('Gesuchter Titel')"),false);
 assert.equal(await evaluate("document.querySelector('audio').paused"),false,'disconnect does not stop local playback');

 // Exercise the actual callback module and cross-window delivery without a Spotify account.
 const nonce='b'.repeat(64),state='c'.repeat(64);
 await evaluate(`window.authResult=null;window.authChannel=new BroadcastChannel('anydj-spotify-${nonce}');authChannel.onmessage=e=>window.authResult=e.data`);
 const {targetId:authTarget}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId:authSession}=await send('Target.attachToTarget',{targetId:authTarget,flatten:true});
 await send('Page.enable',{},authSession);
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
   sessionStorage.setItem('anydj-spotify-pkce',JSON.stringify({clientId:'a'.repeat(32),redirect:location.origin+location.pathname,channel:'${nonce}',state:'${state}',verifier:'test-verifier',created:Date.now()}));
   window.close=()=>{};
   window.fetch=async(url,options)=>{window.tokenRequest={url,body:String(options.body)};return new Response(JSON.stringify({access_token:'callback-access',refresh_token:'callback-refresh',expires_in:3600}));};
 `},authSession);
 await send('Page.navigate',{url:base+'spotify-callback.html?code=test-code&state='+state},authSession);
 await wait("window.authResult?.token?.access_token==='callback-access'");
 const authData=await send('Runtime.evaluate',{expression:"({url:location.href,pending:sessionStorage.getItem('anydj-spotify-pkce'),request:window.tokenRequest})",returnByValue:true},authSession);
 assert.equal(new URL(authData.result.value.url).search,'');assert.equal(authData.result.value.pending,null);
 assert.equal(authData.result.value.request.url,'https://accounts.spotify.com/api/token');
 assert.equal(new URLSearchParams(authData.result.value.request.body).get('code_verifier'),'test-verifier');
 await send('Target.closeTarget',{targetId:authTarget});await evaluate('authChannel.close()');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({oauthCallback:true,tabs:true,pagination:true,explicitLocalMapping:true,queuePreservesDuplicates:true,savedList:true,localDeckPlayback:true,favourites:true,search:true,disconnect:true,subdirectory:true,mobile:true,browserErrors:0},null,2));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
