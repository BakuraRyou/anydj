// Real WebGL checks for the immersive renderer, independent of legacy manager UI.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

// CI: VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/check-vr-renderer.mjs
const profile=await mkdtemp(join(tmpdir(),'anydj-stage-gpu-'));
const chrome=spawn('/usr/bin/google-chrome',[...(process.env.DISPLAY?[]:['--headless=new']),'--no-sandbox','--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
if(process.env.GPU_DEBUG)chrome.stderr.on('data',data=>process.stderr.write(data));
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


  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {createVRGraphics}=await import('/dmx-stage-vr.js');
    // Exercise real WebGL using a simulated XR framebuffer and two eye matrices.
    WebGLRenderingContext.prototype.makeXRCompatible=async()=>{};
    let gl,worldAllocations=0;
    window.XRWebGLLayer=class{constructor(session,context){gl=context;const allocate=gl.bufferData.bind(gl);gl.bufferData=(target,data,usage)=>{if(typeof data==='number'&&data>=131072)worldAllocations++;return allocate(target,data,usage);};context.canvas.width=512;context.canvas.height=256;this.framebuffer=null;}getViewport(eye){return {x:eye.eye==='left'?0:256,y:0,width:256,height:256};}};
    const graphics=await createVRGraphics({});
    const projection=new Float32Array([1,0,0,0,0,1,0,0,0,0,-1.002,-1,0,0,-.2,0]);
    const eye=(name,x)=>({eye:name,projectionMatrix:projection,transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,-1.7,0,1])}}});
    graphics.render({views:[eye('left',.032),eye('right',-.032)]},{layout:{width:8,depth:12,height:5,positions:{},room:true,lightMin:0},lights:[{type:'moving',position:{x:0,y:5,height:4},target:{x:0,y:3},power:1,color:'rgb(255,60,20)'}],crowd:[{x:.5,y:.5}],motion:0},{x:0,y:1,yaw:0,floorOffset:0});
    const pixels=new Uint8Array(512*256*4);gl.readPixels(0,0,512,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let litLeft=0,litRight=0,different=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=(y*512+x)*4,b=a+256*4;if(pixels[a]>40)litLeft++;if(pixels[b]>40)litRight++;if(pixels[a]!==pixels[b])different++;}
    const {createVRConsole}=await import('/dmx-vr-console.js');
    const ui=createVRConsole({command:()=>{},exit:()=>{}}),head=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,1.7,0,1]);
    const scene={layout:{width:8,depth:12,height:5,positions:{}},lights:[],crowd:[],motion:0,transport:{decks:[{id:'A',title:'VR control test',canPlay:true}]}};
    const overlay=ui.update({}, {}, {transform:{matrix:head}}, {inputSources:[]},scene,{x:0,y:1,yaw:0},1);
    overlay.ray=[[.2,1.4,-.2],[0,1.4,-.8]];
    const allocationsBefore=worldAllocations;
    for(let i=0;i<3;i++)graphics.render({views:[eye('left',.032),eye('right',-.032)]},scene,{x:0,y:1,yaw:0},overlay);
    const panelPixels=new Uint8Array(4);gl.readPixels(128,88,1,1,gl.RGBA,gl.UNSIGNED_BYTE,panelPixels);
    const error=gl.getError();graphics.destroy();return {litLeft,litRight,different,error,panelPixel:[...panelPixels],repeatAllocations:worldAllocations-allocationsBefore};
  })()`);
  assert.equal(result.error,0);assert.equal(result.repeatAllocations,0,'world GPU storage is reused across frames');assert.ok(result.panelPixel[0]>10,'panel renders in eye viewport');assert.ok(result.litLeft>100);assert.ok(result.litRight>100);assert.ok(result.different>100,'left and right eye differ through parallax');
  const pixels=await evaluate(`(async()=>{
    const {createVRGraphics}=await import('/dmx-stage-vr.js');const {newRoomPlan,applyRoomPlan}=await import('/dmx-ar-model.js');
    WebGLRenderingContext.prototype.makeXRCompatible=async()=>{};
    let gl,options;window.XRWebGLLayer=class{constructor(session,context,value){gl=context;options=value;context.canvas.width=256;context.canvas.height=256;this.framebuffer=null;}getViewport(){return {x:0,y:0,width:256,height:256};}};
    const graphics=await createVRGraphics({environmentBlendMode:'alpha-blend'});
    const eye={projectionMatrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,-1.002,-1,0,0,-.2,0]),transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,-1.7,0,1])}}};
    const empty={layout:{width:8,depth:6,positions:{},ar:true},lights:[],crowd:[],motion:0};graphics.render({views:[eye]},empty,{x:0,y:0,yaw:0});
    const clear=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,clear);
    const plan=newRoomPlan();plan.positions.lamp={x:0,y:3,height:1,rotation:45,size:{width:.5,depth:.4,height:.7}};
    const scene=applyRoomPlan(empty,plan,true);graphics.render({views:[eye]},scene,{x:0,y:0,yaw:0});
    const data=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,data);let transparent=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]===255)opaque++;}
    const {createARControls}=await import('/dmx-ar-controls.js');const ref=new EventTarget();const controls=createARControls({planner:{plan},reference:ref,session:{inputSources:[]},floorAvailable:true,exit(){},command(){}});
    const overlay=controls.update({getPose:()=>null},ref,{transform:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,1.7,0,1])}},{inputSources:[]},empty,{},0);
    graphics.render({views:[eye]},scene,{x:0,y:0,yaw:0},overlay);
    const error=gl.getError();controls.destroy();graphics.destroy();return {alpha:options.alpha,clear:[...clear],transparent,opaque,error};
  })()`);
  assert.equal(pixels.alpha,true);assert.deepEqual(pixels.clear,[0,0,0,0]);assert.ok(pixels.transparent>50000);assert.ok(pixels.opaque>100);assert.equal(pixels.error,0);
  const fallback=await evaluate(`(async()=>{
    const {createVRGraphics}=await import('/dmx-stage-vr.js');
    const getExtension=WebGLRenderingContext.prototype.getExtension;
    let gl;window.XRWebGLLayer=class{constructor(session,context){gl=context;context.canvas.width=512;context.canvas.height=256;this.framebuffer=null;}getViewport(eye){return {x:eye.eye==='left'?0:256,y:0,width:256,height:256};}};
    const projection=new Float32Array([1,0,0,0,0,1,0,0,.05,-.05,-1.002,-1,0,0,-.1,0]);
    const eye=(name,x)=>({eye:name,projectionMatrix:projection,transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,-1.7,0,1])}}});
    const pose={views:[eye('left',.032),eye('right',-.032)]},origin={x:0,y:1,yaw:.15,floorOffset:.1};
    const scene={layout:{width:8,depth:8,height:4,positions:{},room:true},lights:Array.from({length:6},(_,i)=>({id:'beam'+i,type:'moving',position:{x:i-3,y:6,height:3},target:{x:2-i*.7,y:2,z:0},power:.7,color:i%2?'#ff40a0':'#20bbee'})),crowd:[],motion:0};
    const snapshots=[],modes=[];let supported=false,disposed=false;
    try{
      for(const disable of [false,true]){
        WebGLRenderingContext.prototype.getExtension=function(name){return disable&&name==='ANGLE_instanced_arrays'?null:getExtension.call(this,name);};
        const renderer=await createVRGraphics({});if(!disable)supported=!!getExtension.call(gl,'ANGLE_instanced_arrays');
        renderer.render(pose,scene,origin);modes.push(renderer.stats.instancedBeams);
        const data=new Uint8Array(512*256*4);gl.readPixels(0,0,512,256,gl.RGBA,gl.UNSIGNED_BYTE,data);if(gl.getError())throw Error('Fallback WebGL error');snapshots.push(data);
        renderer.destroy();renderer.destroy();try{renderer.render(pose,scene,origin);}catch{disposed=true;}
      }
    }finally{WebGLRenderingContext.prototype.getExtension=getExtension;}
    let difference=0;for(let i=0;i<snapshots[0].length;i++)difference+=Math.abs(snapshots[0][i]-snapshots[1][i]);
    return {supported,modes,meanPixelDifference:difference/snapshots[0].length,disposed};
  })()`);
  if(fallback.supported)assert.equal(fallback.modes[0],true,'instanced shader compiled');
  assert.equal(fallback.modes[1],false);assert.ok(fallback.meanPixelDifference<1,'fallback preserves the same stereo lighting');assert.equal(fallback.disposed,true);
  const depth=await evaluate(`(async()=>{
    const {createVRGraphics}=await import('/dmx-stage-vr.js');
    let gl;window.XRWebGLLayer=class{constructor(session,context){gl=context;context.canvas.width=256;context.canvas.height=256;this.framebuffer=null;}getViewport(){return {x:0,y:0,width:256,height:256};}};
    const eye={projectionMatrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,-1.002,-1,0,0,-.1,0]),transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,-1.7,0,1])}}};
    const renderer=await createVRGraphics({}),origin={x:0,y:1,yaw:0};
    const light={id:'beam',type:'moving',position:{x:0,y:6,height:3},target:{x:0,y:0,z:0},power:1,color:'#00ffff',beamAngle:5};
    const blocker={id:'blocker',type:'truss',position:{x:0,y:3,height:1.2},target:{x:0,y:3,z:0},modelSize:{width:1.2,depth:.6,height:1},power:0,color:'#404040'};
    const scene={layout:{width:8,depth:8,height:4,positions:{},room:true},lights:[light,blocker],crowd:[],motion:0};
    const center=()=>{const p=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
    scene.layout.hazeDensity=0;renderer.render({views:[eye]},scene,origin);const clear=center();
    scene.layout.hazeDensity=.65;renderer.render({views:[eye]},scene,origin);const occluded=center();
    scene.lights=[light];renderer.render({views:[eye]},scene,origin);const beam=center();
    const error=gl.getError();renderer.destroy();return {clear,occluded,beam,error};
  })()`);
  assert.deepEqual(depth.occluded,depth.clear,'foreground fixture blocks background haze');
  assert.notDeepEqual(depth.beam,depth.occluded,'removing the foreground exposes the beam');assert.equal(depth.error,0);
  assert.deepEqual(errors,[]);console.log('VR renderer: shaders, stereo, controller overlay, buffer reuse and AR transparency passed.',result,pixels,fallback,depth);
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
