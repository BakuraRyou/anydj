import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const errors=[];
const {createApp}=await import('../server.mjs');
const dataDir=await mkdtemp(join(tmpdir(),'anydj-startup-data-'));
const {server}=await createApp({demo:true,dataDir});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}/dj`;
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
 for(let pass=0;pass<2;pass++){
   if(pass)await c('Page.reload');else await c('Page.navigate',{url:base});
   await wait("document.querySelectorAll('.dj-play').length===2&&document.querySelector('#spotifyTab')&&document.querySelector('#queueSelect').dataset.lists!==undefined");
   if(!await evaluate("document.querySelector('#queueShuffle')!==null"))throw Error('Shuffle missing');
 }
 await evaluate("localStorage.setItem('anydj-spotify-client-id','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');document.querySelector('.provider-tabbar>button').click()");
 if(!await evaluate("document.querySelector('dialog[open]')&&!document.querySelector('dialog[open] input')"))throw Error('Login still requires developer configuration');
 await evaluate("window.open=url=>{window.spotifyLoginURL=url;return {close(){}}};[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Mit Spotify anmelden').click()");
 if(!await evaluate("new URLSearchParams(new URL(window.spotifyLoginURL).hash.slice(1)).get('client')==='70131f8aa1374f0ea9768b10210d3cc6'"))throw Error('Login does not use central client ID');
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({localServer:true,decks:2,library:true,shuffle:true,reload:true,centralSpotifyLogin:true,browserErrors:0}));
}finally{ws?.close();chrome.kill();await once(chrome,'exit');server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await rm(dataDir,{recursive:true,force:true});}
