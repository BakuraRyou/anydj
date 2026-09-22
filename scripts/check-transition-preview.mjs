import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true});
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
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression+' · '+await evaluate("[...document.querySelectorAll('[data-status]')].map(e=>e.textContent).join(' | ')"));};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('.transition-preview-open')");
  await evaluate("document.querySelector('.transition-preview-open').click()");
  assert.ok(await evaluate("document.querySelector('.dj-transition-preview .dj-routing')!==null"));
  assert.ok(await evaluate("document.querySelector('.dj-transition-preview [data-status]').textContent.includes('Deck A')"));
  assert.equal(await evaluate("document.querySelector('.dj-transition-preview [data-play]').disabled"),true);
  await evaluate("document.querySelector('.dj-transition-preview').close()");
  await c('Runtime.evaluate',{userGesture:true,awaitPromise:true,expression:`(async()=>{
    const {createTransitionPreview}=await import('/transition-preview.js');
    const rate=22050,length=rate*8,buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
    const text=(at,value)=>[...value].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
    text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
    for(let i=0;i<length;i++)view.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*1500,true);
    window.previewURL=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
    const host=document.createElement('section');document.body.append(host);
    window.previewApplied=null;window.previewDirection=null;
    const deck=name=>({name,track:{name:'Testtitel '+name},url:previewURL,duration:8,rate:1,pitch:true,volume:.7,eq:{trim:0,low:0,mid:0,high:0}});
    // No physical headphones in headless Chrome: spy on routing, use its
    // default sink only in this test. Real decoding/playback remains enabled.
    window.originalSink=AudioContext.prototype.setSinkId;window.previewSinks=[];window.failSink=false;
    AudioContext.prototype.setSinkId=async function(id){previewSinks.push(id);if(failSink)throw Error('Test: Ausgang getrennt');await originalSink.call(this,'');Object.defineProperty(this,'sinkId',{configurable:true,value:id});};
    window.liveDeck=new Audio(previewURL);liveDeck.loop=true;await liveDeck.play();
    window.routingEvents=new EventTarget();window.previewOutput={deviceId:'test-headphones',label:'Test-Kopfhörer'};
    const routingHost=document.createElement('details');routingHost.innerHTML='<summary>Audioausgänge & Vorhören</summary>';host.append(routingHost);
    window.originalAudio=window.Audio;window.previewAudio=[];window.Audio=function(...args){const a=new originalAudio(...args);previewAudio.push(a);return a;};
    createTransitionPreview({host,getPair:direction=>{previewDirection=direction;return {from:deck(direction==='1'?'B':'A'),to:deck(direction==='1'?'A':'B'),position:0,plan:{time:1,cue:.2,duration:.6,style:'smooth',label:'Sanft'}};},routing:{routingHost,getPreviewOutput:()=>previewOutput,subscribeOutput:listener=>{routingEvents.addEventListener('change',listener);return ()=>routingEvents.removeEventListener('change',listener);}},onChoose:(_,choice)=>{previewApplied=choice;return true;}});
    host.querySelector('button').click();window.previewEditor=[...document.querySelectorAll('.dj-transition-preview')].at(-1);
    window.previewEdit=(key,value)=>{const input=previewEditor.querySelector('[data-edit-'+key+']');input.value=value;input.dispatchEvent(new Event(key==='style'?'change':'input'));};
  })()`});
  assert.equal(await evaluate("previewEditor.querySelector('[data-choose]').disabled"),false);
  await evaluate("previewEdit('time',7.8)");assert.equal(await evaluate("previewEditor.querySelector('[data-play]').disabled"),true);
  await evaluate("previewEdit('time',1.2);previewEdit('cue',.4);previewEdit('duration',.8);previewEdit('style','bass');previewEditor.querySelector('[data-choose]').click()");
  assert.deepEqual(await evaluate("[previewApplied.time,previewApplied.cue,previewApplied.duration,previewApplied.style]"),[1.2,.4,.8,'bass']);
  assert.equal(await evaluate("previewEditor.querySelectorAll('svg.transition-curve-editor').length"),1);
  const initialPoints=await evaluate("previewEditor.querySelectorAll('[data-point]').length");
  await evaluate("previewEditor.querySelector('[data-add]').click()");
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point]').length"),initialPoints+1);
  await evaluate("previewEditor.querySelector('[data-delete]').click();previewEditor.querySelector('[data-undo]').click()");
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point]').length"),initialPoints+1);
  await evaluate("previewEditor.querySelector('[data-channel=\"0\"][data-point=\"1\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");
  await evaluate("previewEditor.querySelector('[data-choose]').click()");
  assert.ok(await evaluate("previewApplied.points?.length===2"));
  const handle=await evaluate("(()=>{const e=previewEditor.querySelector('[data-channel=\"0\"][data-point=\"1\"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  const before=await evaluate("JSON.stringify(previewApplied.points)");
  await c('Input.dispatchMouseEvent',{type:'mousePressed',...handle,button:'left',clickCount:1});
  await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:handle.x+15,y:handle.y+10,button:'left',buttons:1});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:handle.x+15,y:handle.y+10,button:'left',clickCount:1});
  await evaluate("previewEditor.querySelector('[data-choose]').click()");
  assert.notEqual(await evaluate("JSON.stringify(previewApplied.points)"),before);
  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-play]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Hörprobe läuft')");
  assert.equal(await evaluate("liveDeck.paused"),false);
  assert.deepEqual(await evaluate("previewSinks"),['test-headphones']);
  assert.equal(await evaluate("previewEditor.querySelector('[data-pause-play]')"),null);
  assert.ok(await evaluate("previewAudio.length===2&&previewAudio.every(a=>!a.paused&&a.currentTime>0)"));
  await evaluate("previewEditor.querySelector('[data-stop]').click()");
  assert.ok(await evaluate("previewAudio.every(a=>a.paused&&!a.getAttribute('src'))"));
  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-play]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Hörprobe läuft')");
  await evaluate("previewOutput=null;routingEvents.dispatchEvent(new Event('change'))");
  assert.ok(await evaluate("previewAudio.every(a=>a.paused)&&!liveDeck.paused&&previewEditor.querySelector('[data-play]').disabled"));
  await evaluate("previewOutput={deviceId:'test-headphones',label:'Test-Kopfhörer'};routingEvents.dispatchEvent(new Event('change'));failSink=true");
  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-play]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Ausgang getrennt')");
  assert.ok(await evaluate("previewAudio.every(a=>a.paused)&&!liveDeck.paused"));
  await evaluate("failSink=false;previewEditor.querySelector('[data-stop]').click();const direction=previewEditor.querySelector('[data-direction]');direction.value='1';direction.dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("previewDirection"),'1');
  for(const [width,height] of [[1280,900],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("previewEditor.scrollWidth<=previewEditor.clientWidth&&document.documentElement.scrollWidth<=innerWidth"));
    await writeFile(new URL(`../reports/transition-editor-${width}.png`,import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await c('Runtime.evaluate',{userGesture:true,awaitPromise:true,expression:`(async()=>{
    const {createPerformance}=await import('/dj-performance.js');
    window.routingMixer=document.createElement('section');document.body.append(routingMixer);
    window.routingContext=null;
    window.routingControl=createPerformance({decks:[],mixer:routingMixer,ready:async()=>{if(!routingContext){routingContext=new AudioContext();routingControl.connect(routingContext);}await routingContext.resume();},manual:()=>{},save:()=>{},report:()=>{},sync:()=>{}});
    document.body.append(routingControl.routingHost); // Routing also works when moved into the transition dialog.
    Object.defineProperty(navigator.mediaDevices,'selectAudioOutput',{configurable:true,value:async()=>window.selectedDevice});
    window.mediaSink=HTMLMediaElement.prototype.setSinkId;HTMLMediaElement.prototype.setSinkId=async function(id){};
    window.routingChanges=0;routingControl.subscribeOutput(()=>routingChanges++);
    window.selectedDevice={deviceId:'master',groupId:'master-group',label:'Master'};
    routingControl.routingHost.querySelector('[data-output=master]').click();
  })()`});
  await wait("routingControl.routingHost.querySelector('[data-routing]').textContent.includes('Master: Master')");
  await evaluate("routingControl.routingHost.querySelector('[data-output=cue]').click()");
  await wait("routingControl.routingHost.querySelector('[data-routing]').textContent.includes('anderen Ausgang')");
  assert.equal(await evaluate("routingControl.getPreviewOutput()"),null);
  await c('Runtime.evaluate',{userGesture:true,expression:"selectedDevice={deviceId:'headphones',groupId:'headphone-group',label:'Kopfhörer'};routingControl.routingHost.querySelector('[data-output=cue]').click()"});
  await wait("routingControl.getPreviewOutput()?.deviceId==='headphones'");
  await evaluate("navigator.mediaDevices.dispatchEvent(new Event('devicechange'))");
  assert.equal(await evaluate("routingControl.getPreviewOutput()"),null);
  assert.ok(await evaluate("routingChanges>0&&!liveDeck.paused"));
  await evaluate("routingControl.destroy();routingControl.routingHost.remove();routingContext.close();routingMixer.remove();HTMLMediaElement.prototype.setSinkId=mediaSink");
  await evaluate("previewEditor.close();window.Audio=originalAudio;AudioContext.prototype.setSinkId=originalSink;liveDeck.pause();URL.revokeObjectURL(previewURL)");
  assert.deepEqual(errors,[]);console.log('Transition editor passed: missing-pair guidance, manual edits, bounds, single-proposal apply, separate output selection, uninterrupted live audio, output loss and routing failure, real audio rehearsal, replay, direction and responsive layout.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
