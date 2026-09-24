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
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'wiz-dj-connection-'));
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
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+JSON.stringify(errors)+' '+await evaluate("document.querySelector('#trackList')?.textContent"));};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#djLamp')?.options.length>1&&typeof document.querySelector('#djFiles').onchange==='function'");
  await evaluate(`(()=>{document.querySelector('#djStructure').checked=false;const originalFetch=fetch;window.fetch=async(url,options={})=>{if(String(url).startsWith('/api/analysis/')){if(options.method!=='POST')return new Response(JSON.stringify({available:true}));const duration=options.body.byteLength/64000;return new Response(JSON.stringify(url.endsWith('beats')?{version:1,source:'beat-this',duration,beats:[0,.5,1,1.5],downbeats:[0]}:{version:1,source:'discogs-effnet',duration,segments:[{start:0,end:duration,scores:{electronic:.8,rock:0,pop:0,groove:0,acoustic:0,orchestral:0,ambient:0},tags:[]}]}));}return originalFetch(url,options);};
    const rate=16000,n=rate*30,buffer=new ArrayBuffer(44+n*2),v=new DataView(buffer);const text=(offset,s)=>[...s].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));text(0,'RIFF');v.setUint32(4,36+n*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*5000,true);const dt=new DataTransfer();dt.items.add(new File([buffer],'vr-test.wav',{type:'audio/wav'}));const input=document.querySelector('#djFiles');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await wait(`document.querySelector('#trackList [aria-label="Auf Deck A laden"]:not(:disabled)')`);
  await evaluate(`document.querySelector('#djLamp').value='';document.querySelector('#djLamp').dispatchEvent(new Event('change'));document.querySelector('[aria-label="Auf Deck A laden"]').click();document.querySelector('#autoCrossfade').checked=false;`);
  await wait("!document.querySelector('.dj-play').disabled");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('[data-layout-open]').click()");
  await wait("document.querySelector('#stageLayoutDialog').open&&document.querySelector('[data-layout-aim]').textContent.includes('Pan')");
  await evaluate("document.querySelector('[data-layout-close]').click();document.querySelector('[data-stage3d-toggle]').click();document.querySelector('.stage-vr-share').open=true;document.querySelector('[data-share-start]').click()");
  await wait("document.querySelector('[data-share-links]').hidden===false");
  const link=await evaluate("document.querySelector('.stage-vr-share input').value");
  const code=await evaluate("document.querySelector('[data-share-code]').textContent");assert.match(code,/^\d{6}$/);
  const local=new URL(link);local.hostname='127.0.0.1';
  const {targetId:viewerTarget}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId:viewerSession}=await command('Target.attachToTarget',{targetId:viewerTarget,flatten:true});
  const vc=(method,params)=>command(method,params,viewerSession);await vc('Runtime.enable');await vc('Page.enable');
  const read=async expression=>{const r=await vc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  async function viewerWait(expression){const end=Date.now()+15000;while(Date.now()<end){if(await read(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Viewer timeout: '+expression);}
  await vc('Page.navigate',{url:local.origin});await viewerWait("document.querySelector('#joinPreview')?.hidden===false");
  await read(`document.querySelector('#previewLink').value=${JSON.stringify(code)};document.querySelector('#joinPreview').requestSubmit()`);await viewerWait("document.querySelector('#connection')?.textContent==='Live mit dem Rechner verbunden'");
  assert.ok(await read("document.querySelector('#sceneInfo').textContent.includes('8 × 6')"));
  await evaluate("document.querySelector('[data-workspace-tab=room]').click();const room=document.querySelector('[data-room-enabled]');if(!room.checked)room.click();const input=document.querySelector('[data-room-width]');input.value=14;input.dispatchEvent(new Event('change'))");
  await viewerWait("document.querySelector('#sceneInfo').textContent.includes('14 ×')");
  await vc('Page.reload');await viewerWait("document.querySelector('#connection')?.textContent==='Live mit dem Rechner verbunden'&&document.querySelector('#sceneInfo').textContent.includes('14 ×')");
  await read(`(async()=>{const id=location.hash.slice(1);const response=await fetch('/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id,control:sessionStorage.getItem('vr-control-'+id),command:{action:'select',deck:'B'}})});if(!response.ok)throw Error('VR command failed');})()`);
  await wait("document.querySelector('[data-song-deck]').value==='B'");
  async function music(action,value){assert.equal(await read(`(async()=>{const id=location.hash.slice(1);return (await fetch('/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id,control:sessionStorage.getItem('vr-control-'+id),command:{action:${JSON.stringify(action)},deck:'A',value:${JSON.stringify(value)}}})})).status})()`),200);}
  await music('playing',true);await wait("document.querySelector('.dj-play').textContent.includes('Pause')");
  await music('playing',false);await wait("!document.querySelector('.dj-play').textContent.includes('Pause')");
  await music('seek',12);await wait("Math.abs(Number(document.querySelector('.dj-seek').value)-12)<.5");
  assert.equal(await evaluate("new URL(document.querySelector('[data-share-test]').href).pathname"),'/vr-test');
  await vc('Page.navigate',{url:local.origin+'/vr-test'});
  await viewerWait("document.querySelector('#connection')?.textContent==='Live mit dem Rechner verbunden'");
  assert.equal(await read('location.pathname+location.hash'),'/vr-test');
  assert.equal(await read("document.querySelector('#joinPreview').hidden"),true);
  assert.equal(await read(`(async()=>{const pair=await (await fetch('/api/vr-preview/test-connect')).json();return (await fetch('/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({...pair,command:{action:'select',deck:'A'}})})).status})()`),200);
  await wait("document.querySelector('[data-song-deck]').value==='A'");
  await evaluate("document.querySelector('[data-share-start]').click()");
  await viewerWait("document.querySelector('#connection').textContent.includes('Übertragung am Rechner beendet')||document.querySelector('#connection').textContent.includes('Keine aktive VR-Übertragung')");
  await viewerWait("document.querySelector('#connection').textContent.includes('Keine aktive VR-Übertragung')");
  await evaluate("document.querySelector('[data-share-start]').click()");
  await viewerWait("document.querySelector('#connection').textContent==='Live mit dem Rechner verbunden'");
  assert.equal(await read('location.pathname+location.hash'),'/vr-test');
  assert.deepEqual(errors,[]);console.log('Paired preview passed: publisher, isolated viewer page, live room edit, reload/resync, remote deck selection, Play/Pause, seek and end.');
  await command('Target.closeTarget',{targetId:viewerTarget});
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
