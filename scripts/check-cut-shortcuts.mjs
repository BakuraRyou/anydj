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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};

  await c('Page.navigate',{url:base+'/dj'});
  await wait("document.readyState==='complete'");
  const makeAudio=`(()=>{const rate=8000,n=rate*60,b=new ArrayBuffer(44+n*2),v=new DataView(b);const text=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));text(0,'RIFF');v.setUint32(4,36+n*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*4000,true);return new File([b],'Mix-Test.wav',{type:'audio/wav',lastModified:123});})()`;
  await evaluate(`(async()=>{const {openTrackCutEditor}=await import('/track-cut-editor.js');const NativeAudio=Audio;window.Audio=class extends NativeAudio{constructor(...args){super(...args);window.cutAudio=this;}};window.cutSaved=null;window.editor=openTrackCutEditor({track:{name:'Schnitt-Test.wav',plan:{duration:60}},file:${makeAudio},routing:{getPreviewOutput:()=>({deviceId:'',label:'Testausgang'})},onSave:async value=>{window.cutSaved=value;}});window.cutRoot=document.querySelector('.dj-cut-editor');window.key=(key,extra={})=>cutRoot.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));window.select=(a,b)=>{for(const [name,value] of [['start',a],['end',b]]){const input=cutRoot.querySelector('[data-'+name+']');input.value=value;input.dispatchEvent(new Event('input'));}};})()`);
  await evaluate("select(5,9);cutRoot.querySelector('[data-play-position]').click()");
  await wait("cutAudio.currentTime>=5&&!cutAudio.paused");assert.equal(await evaluate("cutAudio.currentTime<7"),true);
  await evaluate("cutRoot.querySelector('[data-pause-position]').click();window.pausedAt=cutAudio.currentTime");assert.equal(await evaluate("cutAudio.paused"),true);
  await evaluate("key(' ')");await wait("!cutAudio.paused&&cutAudio.currentTime>pausedAt+.1");await evaluate("key(' ')");assert.equal(await evaluate("cutAudio.paused"),true);
  await evaluate("{const input=cutRoot.querySelector('[data-jump]');input.value='12';input.dispatchEvent(new Event('input'));cutRoot.querySelector('[data-jump-go]').click();}key('i');key('ArrowRight');key('o')");
  assert.equal(await evaluate("cutRoot.querySelector('[data-start]').value"),'12');assert.equal(await evaluate("cutRoot.querySelector('[data-end]').value"),'13');
  await evaluate("key('Delete')");assert.equal(await evaluate("cutRoot.querySelector('[data-cuts]').children.length"),1);
  await evaluate("key('z',{ctrlKey:true})");assert.equal(await evaluate("cutRoot.querySelector('[data-cuts]').children.length"),0);
  await evaluate("key('ArrowLeft',{altKey:true})");assert.equal(await evaluate("Math.abs(cutAudio.currentTime-12.9)<.01"),true);
  await evaluate("cutRoot.querySelector('[data-start]').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}))");assert.equal(await evaluate("cutRoot.querySelector('[data-cuts]').children.length"),0);
  await evaluate("select(20,25);key(' ',{shiftKey:true})");await wait("!cutAudio.paused&&cutAudio.currentTime>=18");assert.equal(await evaluate("cutAudio.currentTime<20"),true);await evaluate("key(' ')");
  for(const [width,height] of [[1280,900],[390,844]]){
   await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   assert.equal(await evaluate("cutRoot.scrollWidth<=cutRoot.clientWidth"),true);
   await writeFile(new URL('../reports/cut-shortcuts-'+width+'.png',import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("key('Delete');cutRoot.querySelector('[data-start]').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");await wait("cutSaved!==null");assert.deepEqual(await evaluate("cutSaved"),[[20,25]]);
  assert.deepEqual(errors,[]);console.log('Cut editor passed: start at selection, pause/resume, pre-roll, I/O, fine seek, delete/undo/save, typing isolation and responsive controls.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
