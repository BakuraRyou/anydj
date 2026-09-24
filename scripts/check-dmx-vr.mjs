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
  const result=await evaluate(`(async()=>{
    const {createVRGraphics}=await import('/dmx-stage-vr.js');
    // Exercise real WebGL using a simulated XR framebuffer and two eye matrices.
    WebGLRenderingContext.prototype.makeXRCompatible=async()=>{};
    let gl;
    window.XRWebGLLayer=class{constructor(session,context){gl=context;context.canvas.width=512;context.canvas.height=256;this.framebuffer=null;}getViewport(eye){return {x:eye.eye==='left'?0:256,y:0,width:256,height:256};}};
    const graphics=await createVRGraphics({});
    const projection=new Float32Array([1,0,0,0,0,1,0,0,0,0,-1.002,-1,0,0,-.2,0]);
    const eye=(name,x)=>({eye:name,projectionMatrix:projection,transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,-1.7,0,1])}}});
    graphics.render({views:[eye('left',.032),eye('right',-.032)]},{layout:{width:8,depth:12,height:5,positions:{},room:true,lightMin:0},lights:[{type:'moving',position:{x:0,y:5,height:4},target:{x:0,y:3},power:1,color:'rgb(255,60,20)'}],crowd:[{x:.5,y:.5}],motion:0},{x:0,y:1,yaw:0,floorOffset:0});
    const pixels=new Uint8Array(512*256*4);gl.readPixels(0,0,512,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let litLeft=0,litRight=0,different=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=(y*512+x)*4,b=a+256*4;if(pixels[a]>40)litLeft++;if(pixels[b]>40)litRight++;if(pixels[a]!==pixels[b])different++;}
    const error=gl.getError();graphics.destroy();return {litLeft,litRight,different,error};
  })()`);
  assert.equal(result.error,0);assert.ok(result.litLeft>100);assert.ok(result.litRight>100);assert.ok(result.different>100,'left and right eye differ through parallax');
  assert.deepEqual(errors,[]);console.log('VR WebGL passed: real shader compilation, shared scene, both eye viewports, stereo parallax, no GL errors.',result);
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
