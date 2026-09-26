import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const lightPower=Number(process.env.LIGHT_POWER??.75);
assert.ok(Number.isFinite(lightPower)&&lightPower>=0&&lightPower<=1);
const referenceScene=process.env.STAGE_SCENE_FILE?JSON.parse(await readFile(process.env.STAGE_SCENE_FILE,'utf8')):null;
const snapshotPrefix=process.env.SNAPSHOT_PREFIX||'/tmp/anydj';
const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

// CI: VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
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


  await c('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {newRoomPlan,roomPlanLayout}=await import('/dmx-ar-model.js');
    const {createDesktopRenderer}=await import('/dmx-stage-desktop.js');
    const reference=${JSON.stringify(referenceScene)};
    const layout=reference?.layout||roomPlanLayout(newRoomPlan(8,6,3));
    if(${process.env.STAGE_HAZE_DETAIL==='0'})layout.hazeDetail=false;
    const camera=reference?.camera||{mode:'dancer',x:0,y:.4,eyeHeight:1.7,yaw:0,pitch:.02,zoom:1};
    const lights=reference?.lights||Array.from({length:20},(_,i)=>({id:'head-'+i,type:'moving',power:${lightPower},color:'rgb(30,230,200)',
      position:{x:-3.5+i*7/19,y:5,height:2.5},target:{x:Math.sin(i)*3.8,y:1+i%4,z:i%3===0?3:0}}));
    // Read the swap texture directly; Linux software Vulkan composition can
    // fail independently of WebGPU execution. No production readback is used.
    const gpuContexts=new WeakMap(),configure=GPUCanvasContext.prototype.configure,getTexture=GPUCanvasContext.prototype.getCurrentTexture;
    GPUCanvasContext.prototype.configure=function(config){gpuContexts.set(this,{device:config.device,format:config.format});return configure.call(this,{...config,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});};
    GPUCanvasContext.prototype.getCurrentTexture=function(){const texture=getTexture.call(this);gpuContexts.get(this).texture=texture;return texture;};
    document.body.replaceChildren();const results=[],images=[];
    window.gpuChecks=[];window.rendererSnapshots={};
    for(const kind of ['webgpu','webgl','canvas']){
      const host=document.createElement('div');host.style.cssText='position:relative;width:640px;height:360px;display:inline-block';
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.style.cssText='position:relative;z-index:1';host.append(canvas);document.body.append(host);
      const renderer=await createDesktopRenderer(canvas,{backends:kind==='canvas'?[]:kind==='webgpu'?['webgpu','webgl']:['webgl']});
      const layer=host.querySelector('.stage-3d-gpu');if(layer)layer.style.cssText='position:absolute;left:0;top:0';
      const ctx=canvas.getContext('2d');const samples=[];
      for(let frame=0;frame<40;frame++){
        if(!reference)for(let i=0;i<lights.length;i++)lights[i].target.x=Math.sin(i+frame*.02)*3.8;
        const start=performance.now();renderer.render(ctx,640,360,layout,lights,camera,[],0);
        if(${process.env.GPU_SYNC==='1'}){
          if(renderer.kind==='webgpu')await gpuContexts.get(layer.getContext('webgpu')).device.queue.onSubmittedWorkDone();
          else if(renderer.kind==='webgl')layer.getContext('webgl').finish();
        }
        if(frame>9)samples.push(performance.now()-start);
        await new Promise(requestAnimationFrame);
      }
      const copy=document.createElement('canvas');copy.width=640;copy.height=360;const read=copy.getContext('2d');
      // Re-render and copy in the same task: WebGL's default buffer is transient.
      renderer.render(ctx,640,360,layout,lights,camera,[],0);
      if(renderer.kind==='webgpu'){
        const {device,texture,format}=gpuContexts.get(layer.getContext('webgpu'));
        const bytesPerRow=640*4,buffer=device.createBuffer({size:bytesPerRow*360,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
        const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow},[640,360]);device.queue.submit([encoder.finish()]);
        await buffer.mapAsync(GPUMapMode.READ);const pixels=new Uint8ClampedArray(buffer.getMappedRange().slice(0));buffer.unmap();buffer.destroy();
        if(format==='bgra8unorm')for(let i=0;i<pixels.length;i+=4){const red=pixels[i];pixels[i]=pixels[i+2];pixels[i+2]=red;}
        read.putImageData(new ImageData(pixels,640,360),0,0);window.webgpuSnapshot=copy.toDataURL();
      }else if(renderer.kind==='webgl')read.drawImage(layer,0,0);else read.drawImage(canvas,0,0);
      window.rendererSnapshots[kind]=copy.toDataURL();
      const pixels=read.getImageData(0,0,640,360).data;
      images.push(pixels);samples.sort((a,b)=>a-b);results.push({requested:kind,actual:renderer.kind,synchronized:${process.env.GPU_SYNC==='1'},fixtureCount:lights.length,error:canvas.dataset.rendererError,colors:new Set(pixels).size,medianMs:samples[15],p95Ms:samples[28]});
      window.gpuChecks.push({renderer,canvas,ctx,layout,lights,camera,layer,device:renderer.kind==='webgpu'?gpuContexts.get(layer.getContext('webgpu')).device:null});
    }
    let difference=0;for(let i=0;i<images[0].length;i++)difference+=Math.abs(images[0][i]-images[1][i]);
    window.gpuPixelDifference=difference/images[0].length;
    return results;
  })()`);

  for(const [kind,snapshot] of Object.entries(await evaluate('window.rendererSnapshots')))await writeFile(`${snapshotPrefix}-${kind}.png`,Buffer.from(snapshot.split(',')[1],'base64'));
  for(const r of result){assert.equal(r.actual,r.requested,JSON.stringify(r));assert.ok(r.colors>32,JSON.stringify(r));}
  await writeFile(`${snapshotPrefix}-gpu-comparison.png`,Buffer.from((await c('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.ok(await evaluate('gpuPixelDifference<4'),'WebGPU and WebGL images agree');
  await evaluate('gpuChecks[0].device.destroy()');
  await wait("gpuChecks[0].renderer.kind==='webgl'");
  assert.equal(await evaluate('gpuChecks[0].canvas.parentElement.querySelectorAll(".stage-3d-gpu").length'),1);
  const lost=await evaluate(`(async()=>{
    const entry=gpuChecks[1];entry.layer.getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
    await new Promise(r=>setTimeout(r,100));entry.renderer.render(entry.ctx,640,360,entry.layout,entry.lights,entry.camera,[],0);
    return {kind:entry.renderer.kind,layer:!!entry.canvas.parentElement.querySelector('.stage-3d-gpu')};
  })()`);
  assert.deepEqual(lost,{kind:'canvas',layer:false});
  await evaluate('gpuChecks.forEach(e=>e.renderer.destroy())');
  assert.equal(await evaluate('document.querySelectorAll(".stage-3d-gpu").length'),0);
  assert.deepEqual(errors,[]);
  console.log('GPU/Canvas scene rendering, context loss and disposal passed (software Vulkan; not hardware performance):',result);

} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
