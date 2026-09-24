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
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(p.method+' '+JSON.stringify(p.params)+' '+JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  });
  const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject,method,params});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  await c('Runtime.enable');await c('Page.enable');
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch(error){if(!/Inspected target navigated|Execution context was destroyed|Cannot find context/.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  const reload=async()=>{const origin=await evaluate('performance.timeOrigin');await c('Page.reload');await wait(`performance.timeOrigin!==${origin}&&document.readyState==='complete'`);};
  await c('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/dj'});await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('[data-moving-heads]').click();document.querySelector('#stageSettings').click();document.querySelector('[data-demo]').click();document.querySelector('[data-close]').click();document.querySelector('[data-layout-open]').click()");
  await wait("document.querySelector('#stageLayoutDialog').open&&document.querySelector('[data-layout-aim]').textContent.includes('Pan')");
  await evaluate("document.querySelector('[data-layout-close]').click();document.querySelector('[data-stage3d-toggle]').click()");
  await wait("document.querySelector('.stage-3d-dialog').open");
  await evaluate("document.querySelector('[data-workspace-tab=room]').click()");
  assert.equal(await evaluate("document.querySelector('[data-ar-start]').hidden"),false,'first visit shows three clear entry points');
  assert.equal(await evaluate("document.querySelector('[data-ar-next]').disabled"),true);
  await writeFile('/tmp/anydj-room-start.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const change=async(field,value)=>evaluate(`(()=>{const input=document.querySelector('[data-ar-${field}]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change'));})()`);
  const mapPosition=async(x,y)=>evaluate(`(()=>{const svg=document.querySelector('[data-ar-map]');svg.scrollIntoView({block:'center'});const room=JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'));const plan=room.plans.find(p=>p.id===room.selected);const p=new DOMPoint(${x},plan.depth-${y}).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};})()`);
  const tap=async(x,y)=>{const p=await mapPosition(x,y);await c('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await c('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await c('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
  const stored=()=>evaluate("(()=>{const s=JSON.parse(localStorage.getItem('anydj-ar-rooms-v1'));return s.plans.find(p=>p.id===s.selected);})()");
  const {roomGLB}=await import('../test/room-model-fixture.mjs');
  const path=join(profile,'Testsaal.glb');await writeFile(path,roomGLB());
  const upload=async selector=>{const {root}=await c('DOM.getDocument');const {nodeId}=await c('DOM.querySelector',{nodeId:root.nodeId,selector});await c('DOM.setFileInputFiles',{nodeId,files:[path]});};
  await evaluate("document.querySelector('[data-ar-model-import]').open=true");
  await upload('[data-ar-model-file]');
  await wait("document.querySelector('[data-ar-representation]').value==='model'");
  let room=await stored();assert.equal(room.mesh.triangles.length,12);assert.equal(room.width,8);assert.equal(room.depth,6);assert.equal(room.height,3);
  assert.equal(await evaluate("document.querySelector('[data-ar-width]').disabled"),true);
  const originalId=room.id;
  await evaluate("(()=>{const input=document.querySelector('[data-ar-brightness]');input.value='12';input.dispatchEvent(new Event('input'));})()");
  assert.equal((await stored()).environmentBrightness,12);
  assert.equal(await evaluate("document.querySelector('[data-ar-brightness-value]').textContent"),'12 %');
  await change('representation','style');assert.equal((await stored()).representation,'style');
  await change('representation','model');
  await evaluate("document.querySelector('[data-ar-model-import]').open=false;document.querySelector('[data-ar-name]').scrollIntoView({block:'center'})");
  await writeFile('/tmp/anydj-model-import.png',Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await reload();await wait("document.querySelector('#inlineLightStage')");
  await evaluate("document.querySelector('#openLightStage').click();document.querySelector('[data-stage3d-toggle]').click()");
  await wait("document.querySelector('.stage-3d-dialog').open");
  assert.equal(await evaluate("document.querySelector('[data-ar-representation]').value"),'model');
  assert.equal((await stored()).id,originalId);assert.equal((await stored()).mesh.triangles.length,12);assert.equal((await stored()).environmentBrightness,12);assert.equal(await evaluate("document.querySelector('[data-ar-brightness]').value"),'12');
  // Failed file imports leave the saved room intact, including its selected representation.
  await writeFile(path,new Uint8Array([1,2,3]));await upload('[data-ar-model-file]');
  await wait("document.querySelector('[data-ar-status]').dataset.error==='true'");
  assert.equal((await stored()).id,originalId);assert.equal((await stored()).representation,'model');
  // Exercise the real shared renderer with the imported room, using a first-person camera.
  const image=await evaluate(`(async()=>{const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');const {roomPlanLayout}=await import('/dmx-ar-model.js');const data=JSON.parse(localStorage.getItem('anydj-ar-rooms-v1')),room=data.plans.find(p=>p.id===data.selected);const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;renderStage3d(canvas.getContext('2d'),800,600,roomPlanLayout(room),[],{mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:.3,pitch:.12,zoom:1});return canvas.toDataURL();})()`);
  await writeFile('/tmp/anydj-model-inside.png',Buffer.from(image.split(',')[1],'base64'));
  const exposure=await evaluate(`(async()=>{
    const {renderStage3d}=await import('/dmx-stage-3d-renderer.js');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');
    const camera={mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:.2,pitch:.15,zoom:1},layout={width:8,depth:6,height:3,room:true,style:'industrial',positions:{}};
    const energy=(brightness,lights=[])=>{renderStage3d(ctx,320,240,{...layout,environmentBrightness:brightness},lights,camera);const p=ctx.getImageData(0,0,320,240).data;let sum=0;for(let i=0;i<p.length;i+=4)sum+=p[i]+p[i+1]+p[i+2];return sum;};
    return {bright:energy(100),dim:energy(12),black:energy(0),show:energy(0,[{id:'spot',type:'spot',position:{x:0,y:5,height:2.5},target:{x:0,y:3},power:1,color:'#ff0000'}])};
  })()`);
  assert.ok(exposure.bright>exposure.dim*3);assert.equal(exposure.black,0);assert.ok(exposure.show>0,'the show remains visible in a black room');
  assert.deepEqual(errors,[]);
  console.log('Room model browser passed: native GLB upload, style switch, saved geometry after reload, failed import preserves room, and first-person rendering.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
