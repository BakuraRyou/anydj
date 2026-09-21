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
  sessionStorage.setItem('anydj-spotify-session',JSON.stringify({clientId:'a'.repeat(32),access_token:'test',expiresAt:Date.now()+3600000,scope:sessionStorage.getItem('test-missing-consent')?'playlist-read-private':'streaming user-read-email user-read-private user-modify-playback-state'}));
  window.providerCalls=[];window.externalVisits=0;window.open=()=>{externalVisits++;return null;};
  const sid='s'.repeat(22);
  const track={id:sid,type:'track',name:'Spotify Queue Test',artists:[{name:'Test Artist'}],album:{name:'Test Album'},duration_ms:1200};
  window.Spotify={Player:class{
   constructor(options){this.options=options;this.listeners={};this.state=null;window.mockPlayer=this;}
   addListener(name,fn){this.listeners[name]=fn;}
   connect(){this.listeners.ready({device_id:'mock-device'});return Promise.resolve(true);}
   disconnect(){clearTimeout(this.endTimer);providerCalls.push('disconnect');}
   activateElement(){return Promise.resolve();}setVolume(){return Promise.resolve();}
   getCurrentState(){if(this.state&&!this.state.paused)this.state.position=Math.min(1199,Date.now()-this.started);return Promise.resolve(this.state);}
   pause(){this.state.paused=true;this.listeners.player_state_changed(this.state);return Promise.resolve();}
   resume(){this.state.paused=false;this.listeners.player_state_changed(this.state);return Promise.resolve();}
   seek(ms){this.state.position=ms;return Promise.resolve();}
   start(){this.started=Date.now();this.state={paused:false,position:0,duration:1200,track_window:{current_track:track}};this.listeners.player_state_changed(this.state);
    this.endTimer=setTimeout(()=>{this.state={...this.state,paused:true,position:0};this.listeners.player_state_changed(this.state);},1700);
   }
  }};
  const original=window.fetch.bind(window);
  window.fetch=async(url,options={})=>{
   if(!String(url).startsWith('https://api.spotify.com/'))return original(url,options);
   const path=new URL(url).pathname;
   if(path.endsWith('/me/player/play')){providerCalls.push(JSON.parse(options.body));if([...document.querySelectorAll('audio')].some(a=>!a.paused))throw Error('Local and Spotify audio overlap');setTimeout(()=>mockPlayer.start(),50);return new Response(null,{status:204});}
   const data=path.endsWith('/me/playlists')?{items:[{id:'A'.repeat(22),name:'Queue Playlist',images:[]}],next:null}:{items:[{item:track}],next:null};
   return new Response(JSON.stringify(data));
  };
 `});
 await c('Page.navigate',{url:base+'dj.html'});
 await wait("document.querySelector('#spotifyTab')&&document.querySelector('#queueSelect').dataset.lists!==undefined");
 await evaluate("document.querySelector('#demoTracks').click()");
 await wait("document.querySelectorAll('#trackList [data-analysis=complete]').length===2");
 await evaluate("document.querySelector('#enqueueAll').click();document.querySelector('#spotifyTab').click()");
 await wait("document.querySelector('#spotifyTracks .spotify-title')?.textContent==='Queue Playlist'");
 await evaluate("document.querySelector('#spotifyTracks .spotify-title').click()");
 await wait("document.querySelector('#spotifyTracks').textContent.includes('Spotify Queue Test')");
 assert.equal(await evaluate('externalVisits'),0);
 assert.equal(await evaluate("[...document.querySelectorAll('#spotifyTracks a')].every(a=>a.closest('details'))"),true);
 await evaluate("[...document.querySelectorAll('#spotifyTracks button')].find(b=>b.textContent==='Einreihen').click()");
 await wait("document.querySelector('#queueCount').textContent==='3'");
 await evaluate("[...document.querySelectorAll('#queueList>li')].at(-1).querySelector('button').click()");
 assert.match(await evaluate("document.querySelectorAll('#queueList>li')[1].textContent"),/Spotify Queue Test/);
 await evaluate("document.querySelector('#queueSaveList').click()");
 await wait("document.querySelector('#queueName').value==='Liste 1'");
 await evaluate("document.querySelector('#queueStart').click()");
 await wait("[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>.2)");
 await evaluate("[...document.querySelectorAll('audio')].find(a=>!a.paused).currentTime=23.9");
 await wait("providerCalls.some(c=>c.uris)");
 await wait("[...document.querySelectorAll('.dj-track-title')].some(t=>t.textContent.includes('Spotify Queue Test'))");
 await wait("providerCalls.includes('disconnect')&&[...document.querySelectorAll('audio')].some(a=>!a.paused&&a.currentTime>.2)&&document.querySelector('#queueCount').textContent==='0'");
 await evaluate("document.querySelector('#djStop').click();window.beforePlaybackReload=true");
 await c('Page.reload');
 await wait("!window.beforePlaybackReload&&document.querySelector('#queueSelect')?.options.length===2");
 await evaluate("const s=document.querySelector('#queueSelect');s.selectedIndex=1;s.dispatchEvent(new Event('change'))");
 await wait("document.querySelector('#queueCount').textContent==='3'");
 assert.match(await evaluate("document.querySelectorAll('#queueList>li')[1].textContent"),/Spotify Queue Test/);
 await evaluate("document.querySelector('#spotifyTab').click()");
 await wait("document.querySelector('#spotifyTracks .spotify-title')?.textContent==='Queue Playlist'");
 await evaluate("document.querySelector('#spotifyTracks .spotify-title').click()");
 await wait("document.querySelector('#spotifyTracks [draggable=true]')");
 await evaluate(`const row=document.querySelector('#spotifyTracks [draggable=true]'),data=new DataTransfer();row.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));document.querySelector('#queueList').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data}));document.querySelector('.dj-deck').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data}));`);
 await wait("document.querySelector('#queueCount').textContent==='4'&&document.querySelector('.spotify-deck-link')");
 assert.equal(await evaluate("!!document.querySelector('.spotify-deck-link').closest('details')"),true);
 await evaluate("sessionStorage.setItem('test-missing-consent','true');window.beforeConsentReload=true");
 await c('Page.reload');
 await wait("!window.beforeConsentReload&&document.querySelector('#queueSelect')?.dataset.lists!==undefined");
 await evaluate("document.querySelector('#spotifyTab').click()");
 await wait("document.querySelector('#spotifyTracks .spotify-title')?.textContent==='Queue Playlist'");
 await evaluate("document.querySelector('#spotifyTracks .spotify-title').click()");
 await wait("document.querySelector('#spotifyTracks [draggable=true]')");
 await evaluate("[...document.querySelectorAll('#spotifyTracks button')].find(b=>b.textContent==='Play').click()");
 await wait("document.querySelector('dialog[open][data-spotify-connection]')");
 assert.equal(await evaluate("[...document.querySelectorAll('dialog[open] button')].some(b=>b.textContent==='Wiedergabe freigeben')"),true);
 assert.equal(await evaluate('providerCalls.some(c=>c.uris)'),false);
 await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Schließen').click()");
 for(const width of [1280,390]){
  await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({playlistOpensInsideApp:true,externalLinksInSubmenu:true,mixedQueue:true,localSpotifyLocal:true,noOverlap:true,savedMixedList:true,reload:true,providerDragDrop:true,missingConsentDialog:true,mobile:true,browserErrors:0},null,2));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
