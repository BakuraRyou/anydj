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
  assert.ok(await evaluate("document.querySelector('.dj-transition-preview .preview-configure').checkVisibility()"));
  await evaluate("document.querySelector('.dj-transition-preview .preview-configure').click()");
  assert.ok(await evaluate("(()=>{const r=document.querySelector('.dj-transition-preview .dj-routing');return r.open&&r.checkVisibility()&&(r.querySelector('[data-output=cue]').checkVisibility()||r.querySelector('[data-output-select=cue]').checkVisibility());})()"));
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
    const routingHost=document.createElement('details');routingHost.className='dj-routing';routingHost.innerHTML='<summary>Audioausgänge & Vorhören</summary>';host.append(routingHost);
    window.originalAudio=window.Audio;window.previewAudio=[];window.Audio=function(...args){const a=new originalAudio(...args);previewAudio.push(a);return a;};
    createTransitionPreview({host,getPair:direction=>{previewDirection=direction;return {from:deck(direction==='1'?'B':'A'),to:deck(direction==='1'?'A':'B'),position:0,plan:{time:1,cue:.2,duration:.612345,style:'smooth',label:'Sanft',alternatives:[{time:1,cue:.2,duration:.612345,style:'smooth',label:'Sanft'},{time:2,cue:1,duration:1,style:'bass',label:'Bassübergabe'}]}};},routing:{routingHost,getPreviewOutput:()=>previewOutput,subscribeOutput:listener=>{routingEvents.addEventListener('change',listener);return ()=>routingEvents.removeEventListener('change',listener);}},onChoose:(_,choice)=>{previewApplied=choice;return true;}});
    host.querySelector('button').click();window.previewEditor=[...document.querySelectorAll('.dj-transition-preview')].at(-1);
    window.previewEdit=(key,value)=>{const input=previewEditor.querySelector('[data-edit-'+key+']');input.value=value;input.dispatchEvent(new Event(key==='style'?'change':'input'));};
  })()`});
  assert.equal(await evaluate("previewEditor.querySelector('[data-choose]').disabled"),false);
  assert.equal(await evaluate("previewEditor.querySelector('[data-edit-style]').checkVisibility()"),false);

  assert.equal(await evaluate("previewEditor.querySelector('[data-edit-style]').checkVisibility()"),false);
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-proposal-choose]').length"),4);
  await evaluate("previewEditor.querySelector('[data-proposal-choose=\"1\"]').click();previewEdit('duration',1.5);previewEditor.querySelector('[data-proposal-choose=\"0\"]').click();previewEditor.querySelector('[data-proposal-choose=\"1\"]').click()");
  assert.equal(await evaluate("previewEditor.querySelector('[data-edit-duration]').value"),'1.5','variant edits survive comparison');
  await evaluate("previewEditor.querySelector('[data-proposal-choose=\"0\"]').click()");
  await evaluate("previewEditor.querySelector('[data-proposal-edit=\"1\"]').click()");
  assert.ok(await evaluate("!previewEditor.querySelector('.proposal-editor').hidden&&previewEditor.querySelector('.proposal-editor').closest('article').querySelector('[data-proposal-edit=\"1\"]')!==null&&document.activeElement===previewEditor.querySelector('[data-edit-duration]')"));
  await evaluate("previewEditor.querySelector('[data-proposal-choose=\"0\"]').click();previewEditor.querySelector('.preview-advanced').open=false");

  assert.equal(await evaluate("previewEditor.querySelector('.transition-timeline').checkVisibility()"),false);

  assert.equal(await evaluate("previewEditor.querySelector('[data-choose]').checkVisibility()"),true);
  await evaluate("previewEditor.querySelector('[data-proposal-edit=\"0\"]').click();previewEditor.querySelector('[data-edit-places]').click()");
  assert.equal(await evaluate("previewEditor.querySelector('.transition-timeline').checkVisibility()"),true);

  assert.equal(await evaluate("previewEditor.querySelector('[data-edit-duration]').value"),'0.61');
  await evaluate("previewEdit('duration',1);previewEdit('duration',.61);previewEditor.querySelector('[data-choose]').click()");
  assert.equal(await evaluate("previewApplied.duration"),.612345,'rounded display preserves the original value when restored');
  await evaluate("previewEdit('time',7.8)");assert.equal(await evaluate("previewEditor.querySelector('[data-play]').disabled"),true);
  await evaluate("previewEdit('time',1.2);previewEdit('cue',.4);previewEdit('duration',.8);previewEdit('style','bass');previewEditor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}))");
  assert.deepEqual(await evaluate("[previewApplied.time,previewApplied.cue,previewApplied.duration,previewApplied.style]"),[1.2,.4,.8,'bass']);
  assert.equal(await evaluate("previewEditor.querySelectorAll('svg.transition-curve-editor').length"),1);
  assert.equal(await evaluate("previewEditor.querySelector('.preview-advanced').open"),false);
  await evaluate("previewEditor.querySelector('[data-proposal-edit=\"0\"]').click();previewEditor.querySelector('.preview-advanced').open=true");
  await evaluate(`window.curveKey=(key,extra={})=>previewEditor.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));curveKey('2');curveKey('n');`);
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point][data-channel=\"1\"]').length"),6);
  await evaluate("curveKey('z',{ctrlKey:true})");
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point][data-channel=\"1\"]').length"),5);
  await evaluate("curveKey('z',{ctrlKey:true,shiftKey:true})");
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point][data-channel=\"1\"]').length"),6);
  await evaluate("curveKey('z',{ctrlKey:true});curveKey('1');const input=previewEditor.querySelector('[data-edit-time]');input.dispatchEvent(new KeyboardEvent('keydown',{key:'n',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("previewEditor.querySelectorAll('[data-point]').length"),10);
  await evaluate("previewEditor.querySelector('[data-edit-places]').click()");
  await evaluate(`const start=previewEditor.querySelector('[data-timeline-start="cue"]');start.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}));previewEditor.querySelector('[data-choose]').click()`);
  assert.ok(Math.abs(await evaluate("previewApplied.cue")-1.4)<1e-8);
  await evaluate(`previewEditor.querySelector('[data-timeline-end="cue"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));previewEditor.querySelector('[data-choose]').click()`);
  assert.ok(Math.abs(await evaluate("previewApplied.duration")-.9)<1e-8);
  await evaluate("previewEdit('cue',.4);previewEdit('duration',.8)");
  for(const [selector,key] of [['[data-timeline-start="cue"]','cue'],['[data-timeline-end="cue"]','duration']]){
   const grip=await evaluate(`(()=>{const n=previewEditor.querySelector('${selector}');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
   await c('Input.dispatchMouseEvent',{type:'mousePressed',...grip,button:'left',clickCount:1});
   await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x+20,y:grip.y,button:'left',buttons:1});
   await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:grip.x+20,y:grip.y,button:'left',clickCount:1});
   await evaluate("previewEditor.querySelector('[data-choose]').click()");
   assert.ok(await evaluate(`previewApplied.${key}>${key==='cue'?.4:.8}`),'drag changes '+key);
   await evaluate("previewEdit('cue',.4);previewEdit('duration',.8)");
  }

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
  for(const step of [0,1,2]){
    await evaluate(`previewEditor.querySelector('[data-proposal-edit="${step}"]').click()`);
    assert.ok(await evaluate("previewEditor.querySelector('.preview-configure').checkVisibility()"));
  }
  await evaluate("previewEditor.querySelector('.preview-configure').click()");
  assert.ok(await evaluate("previewEditor.querySelector('.preview-configure').textContent.includes('ändern')&&previewEditor.querySelector('.dj-routing').open"));

  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-proposal-listen=\"0\"]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Hörprobe läuft')");
  assert.equal(await evaluate("liveDeck.paused"),false);
  assert.deepEqual(await evaluate("previewSinks"),['test-headphones']);
  assert.ok(await evaluate("previewEditor.querySelector('.preview-proposals').checkVisibility()"));
  assert.equal(await evaluate("previewEditor.querySelector('[data-pause-play]')"),null);
  assert.ok(await evaluate("previewAudio.length===2&&previewAudio.every(a=>!a.paused&&a.currentTime>0)"));
  await evaluate("previewEditor.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}))");
  assert.ok(await evaluate("previewAudio.every(a=>a.paused&&!a.getAttribute('src'))"));
  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-play]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Hörprobe läuft')");
  await evaluate("previewOutput=null;routingEvents.dispatchEvent(new Event('change'))");
  await evaluate("previewEditor.querySelector('[data-proposal-listen=\"0\"]').click()");
  assert.ok(await evaluate("previewEditor.querySelector('.preview-proposals').checkVisibility()&&previewEditor.querySelector('.dj-routing').open"));
  assert.ok(await evaluate("previewAudio.every(a=>a.paused)&&!liveDeck.paused&&previewEditor.querySelector('[data-play]').disabled"));
  await evaluate("previewOutput={deviceId:'test-headphones',label:'Test-Kopfhörer'};routingEvents.dispatchEvent(new Event('change'));failSink=true");
  await c('Runtime.evaluate',{expression:"previewEditor.querySelector('[data-play]').click()",userGesture:true});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Ausgang getrennt')");
  assert.ok(await evaluate("previewAudio.every(a=>a.paused)&&!liveDeck.paused"));
  await evaluate("failSink=false;previewEditor.querySelector('[data-stop]').click();const direction=previewEditor.querySelector('[data-direction]');direction.value='1';direction.dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("previewDirection"),'1');
  await evaluate("previewEditor.querySelector('.preview-advanced').open=false;previewEditor.querySelector('[data-edit-places]').click()");
  for(const [width,height] of [[1280,900],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("previewEditor.scrollWidth<=previewEditor.clientWidth&&document.documentElement.scrollWidth<=innerWidth"));
    await writeFile(new URL(`../reports/transition-editor-${width}.png`,import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    for(const step of [1,2]){
     await evaluate(`previewEditor.querySelector('[data-proposal-edit="${step}"]').click()`);
     assert.ok(await evaluate("previewEditor.scrollWidth<=previewEditor.clientWidth"));
     await writeFile(`/tmp/anydj-editor-step-${step}-${width}.png`,Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
    }
    await evaluate("previewEditor.querySelector('[data-edit-places]').click()");

  }
  await c('Runtime.evaluate',{userGesture:true,awaitPromise:true,expression:`(async()=>{
    const {createPerformance}=await import('/dj-performance.js');
    window.routingMixer=document.createElement('section');document.body.append(routingMixer);
    window.routingContext=null;
    Object.defineProperty(navigator.mediaDevices,'selectAudioOutput',{configurable:true,value:async()=>window.selectedDevice});
    window.routingControl=createPerformance({decks:[],mixer:routingMixer,ready:async()=>{if(!routingContext){routingContext=new AudioContext();routingControl.connect(routingContext);}await routingContext.resume();},manual:()=>{},save:()=>{},report:()=>{},sync:()=>{}});
    document.body.append(routingControl.routingHost); // Routing also works when moved into the transition dialog.
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
  await c('Runtime.evaluate',{userGesture:true,awaitPromise:true,expression:`(async()=>{
    Object.defineProperty(navigator.mediaDevices,'selectAudioOutput',{configurable:true,value:undefined});
    window.originalEnumerate=navigator.mediaDevices.enumerateDevices;
    navigator.mediaDevices.enumerateDevices=async()=>[
      {kind:'audiooutput',deviceId:'speakers',groupId:'speakers',label:'Lautsprecher'},
      {kind:'audiooutput',deviceId:'headphones',groupId:'headphones',label:'WH-1000XM5'},
      {kind:'audioinput',deviceId:'mic',label:'Mikrofon'}].map(device=>Object.create(Object.defineProperties({},Object.fromEntries(Object.entries(device).map(([key,value])=>[key,{get:()=>value}])))));
    HTMLMediaElement.prototype.setSinkId=async()=>{};
    const {createPerformance}=await import('/dj-performance.js');
    window.routingMixer=document.createElement('section');document.body.append(routingMixer);window.routingContext=null;
    window.routingControl=createPerformance({decks:[],mixer:routingMixer,ready:async()=>{if(!routingContext){routingContext=new AudioContext();routingControl.connect(routingContext);}await routingContext.resume();},manual:()=>{},save:()=>{},report:()=>{},sync:()=>{}});
    routingControl.routingHost.open=true;
  })()`});
  await wait("routingControl.routingHost.querySelector('[data-output-select=master]').options.length===3");
  assert.ok(await evaluate("routingControl.routingHost.querySelector('[data-output-select=cue]').disabled"));
  await c('Runtime.evaluate',{userGesture:true,expression:"(()=>{const s=routingControl.routingHost.querySelector('[data-output-select=master]');s.value='speakers';s.dispatchEvent(new Event('change'));})()"});
  await wait("!routingControl.routingHost.querySelector('[data-output-select=cue]').disabled");
  assert.ok(await evaluate("routingControl.routingHost.querySelector('[data-output-select=cue] option[value=speakers]').disabled"));
  await c('Runtime.evaluate',{userGesture:true,expression:"(()=>{const s=routingControl.routingHost.querySelector('[data-output-select=cue]');s.value='headphones';s.dispatchEvent(new Event('change'));})()"});
  await wait("routingControl.getPreviewOutput()?.deviceId==='headphones'");
  assert.equal(await evaluate("routingControl.routingHost.querySelector('[data-output-select=master]').value"),'speakers');
  assert.equal(await evaluate("routingControl.routingHost.querySelector('[data-output-select=cue]').value"),'headphones');
  assert.equal(await evaluate("routingControl.getPreviewOutput().label"),'WH-1000XM5');
  await evaluate("previewOutput=routingControl.getPreviewOutput();routingEvents.dispatchEvent(new Event('change'))");
  await c('Runtime.evaluate',{userGesture:true,expression:"previewEditor.querySelector('[data-proposal-listen=\"0\"]').click()"});
  await wait("previewEditor.querySelector('[data-status]').textContent.includes('Hörprobe läuft · WH-1000XM5')");
  assert.equal(await evaluate("previewSinks.at(-1)"),'headphones');
  assert.ok(await evaluate("previewEditor.querySelector('.preview-proposals [data-status]').checkVisibility()&&!liveDeck.paused"));
  await evaluate("previewEditor.querySelector('[data-stop]').click()");
  await evaluate("previewEditor.querySelector('.preview-output-bar').after(routingControl.routingHost);previewEditor.scrollTop=0");
  for(const width of [1280,390]){
    await c('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("previewEditor.scrollWidth<=previewEditor.clientWidth"));
    await writeFile(`/tmp/anydj-audio-routing-${width}.png`,Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("(()=>{const level=routingControl.routingHost.querySelector('[data-cue-level]');level.value='0.32';level.dispatchEvent(new Event('input'));})()");
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('anydj.audio-routing.v1'))"),{master:'speakers',cue:'headphones',level:.32});
  await c('Runtime.evaluate',{userGesture:true,awaitPromise:true,expression:`(async()=>{
    routingControl.destroy();routingControl.routingHost.remove();await routingContext.close();routingMixer.remove();
    const {createPerformance}=await import('/dj-performance.js');
    window.routingMixer=document.createElement('section');document.body.append(routingMixer);window.routingContext=null;
    window.routingControl=createPerformance({decks:[],mixer:routingMixer,ready:async()=>{if(!routingContext){routingContext=new AudioContext();routingControl.connect(routingContext);}await routingContext.resume();},manual:()=>{},save:()=>{},report:()=>{},sync:()=>{}});
  })()`});
  await wait("routingControl.getPreviewOutput()?.deviceId==='headphones'");
  assert.equal(await evaluate("routingControl.routingHost.querySelector('[data-output-select=master]').value"),'speakers');
  assert.equal(await evaluate("routingControl.routingHost.querySelector('[data-cue-level]').value"),'0.32');
  await evaluate("navigator.mediaDevices.dispatchEvent(new Event('devicechange'))");
  assert.equal(await evaluate("routingControl.getPreviewOutput()"),null);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('anydj.audio-routing.v1')).cue"),'headphones');
  await evaluate("routingControl.destroy();routingControl.routingHost.remove();routingContext.close();routingMixer.remove();navigator.mediaDevices.enumerateDevices=originalEnumerate;HTMLMediaElement.prototype.setSinkId=mediaSink");
  await evaluate("previewEditor.close();window.Audio=originalAudio;AudioContext.prototype.setSinkId=originalSink;liveDeck.pause();URL.revokeObjectURL(previewURL)");
  assert.deepEqual(errors,[]);console.log('Transition editor passed: missing-pair guidance, manual edits, bounds, single-proposal apply, separate output selection, uninterrupted live audio, output loss and routing failure, real audio rehearsal, replay, direction and responsive layout.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
