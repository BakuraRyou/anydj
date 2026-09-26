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
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox',...(process.env.ANYDJ_TEST_GPU?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--disable-gpu']),'--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
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


  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/camera-check'});await wait("document.readyState==='complete'");
  await evaluate('localStorage.clear()');
  const mount=`(async()=>{
    const {createStage3d}=await import('/dmx-stage-3d.js');
    document.body.replaceChildren();const css=document.createElement('link');css.rel='stylesheet';css.href='/style.css';document.head.append(css);
    const host=document.createElement('main'),controls=document.createElement('div');document.body.append(host,controls);
    window.stage=createStage3d(host,controls,{getLayout:()=>({width:8,depth:6,height:3,positions:{}}),mountLayout:()=>{},mountLighting:()=>{}});
    await stage.setEnabled(true);stage.open();
  })()`;
  const ready=async()=>{await wait("document.querySelector('.stage-3d canvas').width>500");await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');};
  const read=()=>evaluate("JSON.parse(localStorage.getItem('anydj-3d-camera-v1'))");
  const reload=async()=>{await c('Page.navigate',{url:base+'/camera-check?reload='+Date.now()});await wait("document.readyState==='complete'&&!window.stage");await evaluate(mount);await ready();};
  await evaluate(mount);await ready();
  if(process.env.ANYDJ_TEST_GPU)assert.equal(await evaluate("document.querySelector('.stage-3d canvas').dataset.renderer"),'webgl');
  await evaluate("document.querySelector('[data-camera=in]').click();document.querySelector('[data-dancer]').click();for(const [key,value] of [['x','1.25'],['distance','2.4'],['height','1.9']]){const e=document.querySelector('[data-dancer-'+key+']');e.value=value;e.dispatchEvent(new Event(key==='height'?'change':'input'));}");
  const rect=await evaluate("(()=>{const r=document.querySelector('.stage-3d canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await c('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',buttons:1,clickCount:1});
  await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+40,y:rect.y+20,button:'left',buttons:1});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+40,y:rect.y+20,button:'left',buttons:0,clickCount:1});
  await wait("Boolean(JSON.parse(localStorage.getItem('anydj-3d-camera-v1')||'null')?.dancer.yaw)");
  const before=await read();assert.equal(before.ego,true);assert.equal(before.dancer.x,1.25);assert.equal(before.dancer.y,-2.4);assert.equal(before.dancer.eyeHeight,1.9);assert.ok(before.overview.eye);
  await reload();
  assert.equal(await evaluate("document.querySelector('[data-dancer]').getAttribute('aria-pressed')"),'true');
  assert.equal(await evaluate("Number(document.querySelector('[data-dancer-height]').value)"),1.9);
  await evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");assert.deepEqual(await read(),before);
  // Save a final edit immediately on navigation, before the 250ms timer fires.
  await evaluate("const e=document.querySelector('[data-dancer-x]');e.value='2.15';e.dispatchEvent(new Event('input'));window.dispatchEvent(new PageTransitionEvent('pagehide'))");
  assert.equal((await read()).dancer.x,2.15);
  await reload();assert.equal(await evaluate("Number(document.querySelector('[data-dancer-x]').value)"),2.15);
  await evaluate("document.querySelector('[data-dancer]').click();window.dispatchEvent(new PageTransitionEvent('pagehide'))");
  const overview=await read();assert.equal(overview.ego,false);assert.deepEqual(overview.overview,before.overview);
  await reload();assert.equal(await evaluate("document.querySelector('[data-dancer]').getAttribute('aria-pressed')"),'false');
  await evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");assert.deepEqual(await read(),overview);
  // Corrupt browser storage falls back to usable defaults.
  await evaluate("stage.destroy();localStorage.setItem('anydj-3d-camera-v1','{broken')");
  await reload();assert.equal(await evaluate("document.querySelector('[data-dancer]').getAttribute('aria-pressed')"),'false');
  await evaluate('stage.destroy()');assert.deepEqual(errors,[]);
  console.log('Camera persistence passed: position, yaw/pitch, height, Ego mode, overview dolly, immediate pagehide save, reload and malformed storage.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
