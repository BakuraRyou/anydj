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
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('[data-layout-open]').click()");
  await wait("document.querySelector('#stageLayoutDialog').open&&document.querySelector('[data-layout-aim]').textContent.includes('Pan')");
  assert.equal(await evaluate("document.querySelectorAll('[data-layout-fixture]').length"),8);
  await evaluate(`window.layoutEdit=(key,value)=>{const input=document.querySelector('[data-layout-'+key+']');input.value=value;input.dispatchEvent(new Event('change'));};layoutEdit('width',12);layoutEdit('depth',8);layoutEdit('x',-4.5);layoutEdit('y',6);layoutEdit('height',4);`);
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-layout-v1')).positions['moving-0']"),{x:-4.5,y:6,height:4});
  const geometry=await evaluate(`(()=>{const svg=document.querySelector('[data-layout-map]'),node=svg.querySelector('[data-layout-fixture="moving-0"]'),r=node.firstElementChild.getBoundingClientRect(),target=new DOMPoint(3,3).matrixTransform(svg.getScreenCTM());return {x:r.x+r.width/2,y:r.y+r.height/2,targetX:target.x,targetY:target.y};})()`);
  await c('Input.dispatchMouseEvent',{type:'mousePressed',x:geometry.x,y:geometry.y,button:'left',clickCount:1});
  await c('Input.dispatchMouseEvent',{type:'mouseMoved',x:geometry.targetX,y:geometry.targetY,button:'left',buttons:1});
  await c('Input.dispatchMouseEvent',{type:'mouseReleased',x:geometry.targetX,y:geometry.targetY,button:'left',clickCount:1});
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('anydj-stage-layout-v1')).positions['moving-0']"),{x:-3,y:5,height:4});
  await evaluate(`document.querySelector('[data-layout-fixture="moving-0"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
  assert.ok(Math.abs(await evaluate("Number(document.querySelector('[data-layout-x]').value)")+2.9)<.001);
  await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await new Promise(resolve=>setTimeout(resolve,100));
  const before=await evaluate("document.querySelector('[data-layout-aim]').textContent");
  await evaluate("layoutEdit('height',7)");
  const after=await evaluate("document.querySelector('[data-layout-aim]').textContent");assert.notEqual(before,after);
  for(const [width,height] of [[1280,900],[390,844]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#stageLayoutDialog').scrollWidth<=document.querySelector('#stageLayoutDialog').clientWidth"));
    await writeFile(new URL(`../reports/dmx-layout-${width}.png`,import.meta.url),Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate("document.querySelector('[data-layout-close]').click()");
  await wait("document.activeElement.hasAttribute('data-layout-open')");
  await reload();await wait("document.querySelector('[data-layout-open]')");
  await evaluate("document.querySelector('[data-layout-open]').click()");
  assert.equal(await evaluate("Number(document.querySelector('[data-layout-width]').value)"),12);
  assert.equal(await evaluate("Number(document.querySelector('[data-layout-height]').value)"),7);
  await evaluate("document.querySelector('[data-layout-symmetry]').click()");
  assert.equal(await evaluate("Object.keys(JSON.parse(localStorage.getItem('anydj-stage-layout-v1')).positions).length"),0);
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await c('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait("!document.querySelector('#stageLayoutDialog').open");
  assert.deepEqual(errors,[]);console.log('Stage layout passed: equipment, dimensions, dragging, keyboard, height projection, persistence, symmetric reset, focus and responsive layout.');

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
