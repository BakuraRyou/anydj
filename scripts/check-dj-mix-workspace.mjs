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

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'anydj-dj-check-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--autoplay-policy=no-user-gesture-required','--mute-audio','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/navigated or closed|context|Cannot find/i.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' '+await evaluate("JSON.stringify({error:document.querySelector('#djStatus').textContent,decks:[...document.querySelectorAll('.dj-deck audio')].map(n=>({paused:n.paused,time:n.currentTime,rate:n.playbackRate}))})"));};



  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");




  assert.equal(await evaluate("[...document.querySelectorAll('.dj-deck-mix')].every(n=>!n.open)&&[...document.querySelectorAll('[data-tempo],.dj-monitor,[data-eq],#fadeDuration')].every(n=>!n.checkVisibility())"),true);
  assert.equal(await evaluate("['#crossfader','#autoCrossfade','#fadeNow','.transition-preview-open','[data-master]'].every(s=>document.querySelector(s).checkVisibility())&&!document.querySelector('.dj-transition-options').open&&!document.querySelector('.dj-audio-options').open"),true);
  assert.equal(await evaluate("document.querySelector('.stage-scene').dataset.hasMovingHeads==='true'&&document.querySelector('.stage-moving-heads').checkVisibility()"),true);
  await writeFile(new URL('../reports/dj-calm-default.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const makeAudio=`(()=>{const rate=8000,n=rate*60,b=new ArrayBuffer(44+n*2),v=new DataView(b);const text=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));text(0,'RIFF');v.setUint32(4,36+n*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*4000,true);return new File([b],'Mix-Test.wav',{type:'audio/wav',lastModified:123});})()`;
  await evaluate(`(async()=>{const file=${makeAudio};const {saveTrack,saveShow}=await import('/dj-library.js');const {compileShow}=await import('/show-plan.js');const windows=Array.from({length:3000},(_,i)=>({rms:.12,bass:.02,flux:0,tone:.5,beatSeq:Math.floor(i/25)}));const design={arrangement:'auto',mood:'auto',minimum:5,maximum:100};const plan=compileShow(windows,60,design);plan.beatGrid={beats:Array.from({length:120},(_,i)=>i*.5)};const t={id:'mix-test',name:file.name,size:file.size,lastModified:file.lastModified,basePlan:plan,windows,refined:true};await saveTrack(t);await saveShow(t,design);})()`);
  await evaluate('window.__reload=true');await c('Page.reload');await wait("!window.__reload&&document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]')");
  await evaluate(`{const transfer=new DataTransfer();transfer.items.add(${makeAudio});const input=document.querySelector('#djFiles');input.files=transfer.files;input.dispatchEvent(new Event('change'));}`);
  await wait("!document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]').disabled");
  await evaluate("document.querySelector('#trackList [aria-label=\"Auf Deck A laden\"]').click();document.querySelector('#autoCrossfade').checked=false");
  await wait("!document.querySelector('.dj-play').disabled");
  await evaluate("document.querySelectorAll('.dj-deck-mix').forEach(n=>n.open=true)");
  await evaluate("document.querySelector('.dj-play').click()");await wait("document.querySelector('.dj-deck audio').currentTime>.2");
  await evaluate("{const p=document.querySelector('.dj-deck');p.querySelector('[data-tempo]').value=5;p.querySelector('[data-tempo]').dispatchEvent(new Event('input'));p.querySelector('[data-eq=low]').value=-9;p.querySelector('[data-eq=low]').dispatchEvent(new Event('input'));p.querySelectorAll('[role=tab]')[1].click();p.querySelector('[data-hotcue]').click();}");
  assert.equal(await evaluate("document.querySelector('.dj-deck audio').playbackRate"),1.05);
  await evaluate("document.querySelector('#trackList [aria-label=\"Auf Deck B laden\"]').click()");
  await wait("!document.querySelectorAll('.dj-deck')[1].querySelector('.dj-play').disabled");
  await evaluate("document.querySelectorAll('.dj-deck')[1].querySelector('[data-sync]').click()");
  await wait("document.querySelectorAll('.dj-deck audio')[1].playbackRate===1.05");

  assert.equal(await evaluate("document.querySelector('[data-value=low]').textContent"),'-9 dB');
  await wait("document.querySelector('[data-hotcue]').textContent.includes(':')");
  await evaluate("document.querySelector('[data-loop]').click()");await wait("document.querySelector('[data-loop]').getAttribute('aria-pressed')==='true'");
  await evaluate("document.querySelector('.dj-deck-mix').open=false");
  await wait("document.querySelector('[data-mix-summary]').textContent.includes('Loop aktiv')");
  assert.equal(await evaluate("document.querySelector('[data-loop]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-tempo]').checkVisibility()"),true);
  await evaluate("document.querySelector('.dj-deck-mix').open=true");

  await evaluate("document.querySelector('[data-loop]').click();document.querySelector('[data-tempo-reset]').click();document.querySelectorAll('.dj-deck [role=tab]')[0].click();document.querySelector('.dj-play').click()");
  assert.equal(await evaluate("document.querySelector('.dj-deck audio').playbackRate"),1);
  for(const [width,height] of [[1440,900],[1280,800],[390,844]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await new Promise(r=>setTimeout(r,250));
   const geometry=await evaluate(`(()=>{const visible=n=>{const r=n.getBoundingClientRect();return n.checkVisibility()&&r.width>0&&r.left>=0&&r.right<=innerWidth+1;};return {overflow:document.documentElement.scrollWidth>innerWidth,transport:[...document.querySelectorAll('.dj-play,.dj-cue,[data-tempo],[data-sync],[data-eq],.dj-monitor')].every(visible),hiddenTools:!!document.querySelector('.dj-deck-tools'),top:document.querySelector('.dj-deck-top').getBoundingClientRect().toJSON()};})()`);
   console.log(width,geometry);assert.equal(geometry.overflow,false);assert.equal(geometry.transport,true);assert.equal(geometry.hiddenTools,false);
   if(width>760){
    assert.equal(await evaluate(`(()=>{const root=document.querySelector('.dj-deck'),area=root.querySelector('.dj-deck-controls'),play=root.querySelector('.dj-play'),before=play.getBoundingClientRect().top;area.scrollTop=10000;return play.getBoundingClientRect().top===before&&play.getBoundingClientRect().bottom<=root.getBoundingClientRect().bottom;})()`),true);
    await evaluate("document.querySelectorAll('.dj-deck-controls').forEach(n=>n.scrollTop=0)");
   }
   await writeFile(new URL('../reports/dj-mix-workspace-'+width+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  }
  await evaluate("document.querySelector('.dj-audio-options').open=true;document.querySelector('.dj-cue-setup').click()");
  assert.equal(await evaluate("document.querySelector('.dj-routing').open&&document.querySelector('.dj-audio-options').open&&document.activeElement.matches('.dj-routing>summary')"),true);
  await evaluate("document.querySelector('.dj-transition-options').open=true");assert.equal(await evaluate("document.querySelector('.transition-preview-open').checkVisibility()&&document.querySelector('#fadeDuration').checkVisibility()"),true);
  assert.equal(await evaluate("document.querySelector('.dj-mixer-light').nextElementSibling.matches('.dj-mixer-transition')"),true);
  assert.equal(await evaluate("document.querySelector('.stage-inline').checkVisibility()"),true);
  await evaluate("localStorage.setItem('anydj-stage-moving-heads','false');window.__reload=true");await c('Page.reload');await wait("!window.__reload&&document.querySelector('.stage-scene')");
  assert.equal(await evaluate("document.querySelector('.stage-scene').dataset.hasMovingHeads==='false'"),true);
  assert.deepEqual(errors,[]);console.log('Mix workspace passed: playback, tempo/reset, two-deck Sync, EQ, hotcue, loop, responsive controls, pinned transport, headphone setup and visible light preview above output.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
