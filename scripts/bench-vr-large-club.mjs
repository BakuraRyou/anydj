// Synthetic transitions in the actual 192-light preset, including CPU scene mapping.
// gl.getError forces a readback after finish; submission-only timings underreport GPU cost.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const eyeSize=Number(process.env.VR_EYE_SIZE||640);
assert.ok(Number.isInteger(eyeSize)&&eyeSize>=256&&eyeSize<=4096);
const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

// CI: VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/bench-vr-large-club.mjs
const baseline=process.env.VR_BASELINE?await readFile(process.env.VR_BASELINE,'utf8'):null;
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
  if(baseline){ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused')void c('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(baseline).toString('base64')});});await c('Fetch.enable',{patterns:[{urlPattern:base+'/vr-baseline.js'}]});}
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {largeClubRoom}=await import('/dmx-room-presets.js');
    const {applyRoomPlan}=await import('/dmx-ar-model.js');
    const current=await import('/dmx-stage-vr.js');
    const old=${Boolean(baseline)}?await import('/vr-baseline.js'):null;
    WebGLRenderingContext.prototype.makeXRCompatible=async()=>{};
    const size=${eyeSize};
    let gl;
    window.XRWebGLLayer=class {
      constructor(session,context,options){gl=context;context.canvas.width=size*2;context.canvas.height=size;this.framebuffer=null;this.options=options;this.framebufferWidth=size*2;this.framebufferHeight=size;}
      getViewport(eye){return {x:eye.eye==='left'?0:size,y:0,width:size,height:size};}
    };
    const projection=new Float32Array([1,0,0,0,0,1,0,0,0,0,-1.000667,-1,0,0,-.100033,0]);
    const eye=(name,x)=>({eye:name,projectionMatrix:projection,transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,-1.7,0,1])}}});
    const pose={views:[eye('left',.032),eye('right',-.032)]},origin={x:0,y:1,yaw:0,floorOffset:0},plan=largeClubRoom(),results=[];
    for(const [name,module] of [...(old?[['before',old]]:[]),['after',current]]){
      const renderer=await module.createVRGraphics({}),context=gl;
      for(const phase of ['quiet','intense','blackout','recover']){
        const timings=[],build=[],upload=[];let lights=0;
        for(let f=0;f<45;f++){
          const start=performance.now();
          const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},crowd:[],lights:['moving','spot','bar'].map((type,i)=>({id:type,type,position:{x:0,y:2,height:3},target:{x:Math.sin(f*.09)*3,y:3},power:phase==='blackout'?0:phase==='quiet'?(i===0?.25:0):.95,color:i===0?'#00bddd':'#ff40a0'}))},plan);
          lights=new Set(scene.lights.filter(l=>!['stand','truss'].includes(l.type)).map(l=>l.id)).size;
          renderer.render(pose,scene,origin);context.finish();const error=context.getError();if(error)throw Error(name+' '+phase+' WebGL error '+error);
          if(f>=15){timings.push(performance.now()-start);if(renderer.stats){build.push(renderer.stats.buildMs);upload.push(renderer.stats.uploadedBytes);}}
          await new Promise(requestAnimationFrame);
        }
        const stats=a=>{a.sort((x,y)=>x-y);return {median:+a[Math.floor(a.length*.5)].toFixed(2),p95:+a[Math.floor(a.length*.95)].toFixed(2)};};
        const pixels=new Uint8Array(size*size*2*4);context.readPixels(0,0,size*2,size,context.RGBA,context.UNSIGNED_BYTE,pixels);
        let left=0,right=0,parallax=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=(y*size*2+x)*4,b=a+size*4;if(pixels[a]+pixels[a+1]+pixels[a+2]>40)left++;if(pixels[b]+pixels[b+1]+pixels[b+2]>40)right++;if(pixels[a]!==pixels[b]||pixels[a+1]!==pixels[b+1])parallax++;}
        if(!left||!right||!parallax)throw Error('Missing stereo image '+name+' '+phase);
        results.push({renderer:name,phase,fixtures:lights,totalMs:stats(timings),...(build.length?{...renderer.stats,buildMs:stats(build),uploadedBytes:stats(upload)}:{}),pixels:{left,right,parallax}});
        window.vrSnapshots||={};window.vrSnapshots[name+'-'+phase]=context.canvas.toDataURL();
      }
      if(renderer.stats){const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},crowd:[],lights:[]},plan);renderer.render(pose,scene,origin);renderer.render(pose,scene,origin);if(renderer.stats.uploadedBytes!==0)throw Error('Stable scene reuploaded');}
      renderer.destroy();await new Promise(resolve=>setTimeout(resolve,100));
    }
    return {eyeSize:[size,size],warmupFrames:15,measuredFrames:30,results};
  })()`);
  if(process.env.VR_SNAPSHOT)for(const [name,data] of Object.entries(await evaluate('window.vrSnapshots')))await writeFile(process.env.VR_SNAPSHOT+'-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
  if(process.env.VR_REPORT)await writeFile(process.env.VR_REPORT,JSON.stringify(result,null,2)+'\n');
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
