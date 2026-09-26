import {volumeWGSL} from './dmx-beam-volume.js';
// Soft haze, body and bright core share the existing beam pass; no extra draw calls.
const shader=`
struct Camera {eye:vec4f,right:vec4f,up:vec4f,forward:vec4f};
@group(0) @binding(0) var<uniform> camera:Camera;
struct Output {@builtin(position) position:vec4f,@location(0) color:vec4f,@location(1) uv:vec3f,@location(2) @interpolate(flat) kind:u32,@location(3) world:vec3f};
@vertex fn vertex(@location(0) p:vec3f,@location(1) color:vec4f,@location(2) uv:vec3f,@location(3) kind:f32)->Output {
  var o:Output;let v=p-camera.eye.xyz;let z=dot(v,camera.forward.xyz);
  o.position=vec4f(dot(v,camera.right.xyz)*camera.right.w,dot(v,camera.up.xyz)*camera.up.w,z-camera.forward.w,z);
  if(kind==3.0){o.position=vec4f(p,1.0);}
  o.color=color;o.uv=uv;o.kind=u32(kind);o.world=p;return o;
}
${volumeWGSL}
fn hazeNoise(p:vec2f)->f32 {
 let cell=floor(p);let raw=fract(p);let f=raw*raw*(3.0-2.0*raw);
 let h=fract(sin(vec4f(dot(cell,vec2f(127.1,311.7)),dot(cell+vec2f(1,0),vec2f(127.1,311.7)),dot(cell+vec2f(0,1),vec2f(127.1,311.7)),dot(cell+vec2f(1,1),vec2f(127.1,311.7))))*43758.5453);
 return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
@fragment fn fragment(i:Output)->@location(0) vec4f {
  var color=i.color;var alpha=1.0;
  if(i.kind==1u){
    let along=clamp(i.uv.y,0.0,1.0);let across=abs(i.uv.x)*1.12/(.035+.965*along);
    let edge=max(0.0,1.0-across*across);let halo=max(0.0,1.0-across*across/1.2544);
    let body=.72*edge*edge+.018*halo*halo;
    alpha=min(1.0,body*(1.0-.22*along)/(.6+along)*min(1.0,along*40.0)*min(1.0,(1.0-along)*40.0));
    alpha*=smoothstep(0.0,1.0,i.uv.z);
    if(camera.eye.w>.5){alpha*=.72+.5*hazeNoise(vec2f(i.world.x+.37*i.world.y,i.world.z+.21*i.world.y)*1.1);}
  }
  if(i.kind==2u){
    let radius=length(i.uv.xy);let edge=max(0.0,1.0-radius*radius);let core=max(0.0,1.0-radius*radius/.1);
    alpha=.07*edge*edge+.93*core*core;color=vec4f(mix(color.rgb,vec3f(1.0),.65*max(0.0,1.0-radius/.12)),color.a);
  }
  if(i.kind==4u || i.kind==5u){
    let radius=length(i.uv.xy);let stop=select(.08,.3,i.kind==5u);alpha=1.0-smoothstep(stop,1.0,radius);
  }
  if(i.kind==7u){
    let r=length(i.uv.xy/max(.0001,i.uv.z));alpha=0.0;
    if(r<1.0){alpha=clamp(log((1.0-.65*exp(-4.0))/(1.0-.65*exp(-4.0*r*r))),0.0,1.0);}
    if(alpha>0.0){let noise=fract(sin(dot(i.position.xy,vec2f(12.9898,78.233)))*43758.5453)-.5;alpha=max(0.0,alpha+noise/255.0);}
  }
  if(i.kind==8u){alpha=volumeLight(camera.eye.xyz,normalize(i.world-camera.eye.xyz));}
  if(i.kind==6u){alpha=fract(sin(dot(i.position.xy,vec2f(12.9898,78.233)))*43758.5453);}
  return vec4f(color.rgb,color.a*alpha);
}`;
export async function createWebGpuStage(canvas,onLost){
  const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw Error('WebGPU adapter unavailable');
  const device=await adapter.requestDevice();let disposed=false,failed=false,buffer=null,capacity=0,multisample=null;
  const context=canvas.getContext('webgpu');
  const fail=event=>{failed=true;if(!disposed)onLost(event?.error?.message||event?.message||'WebGPU device lost');};
  device.lost.then(fail);device.addEventListener('uncapturederror',fail);
  const beamStride=Math.max(256,device.limits.minUniformBufferOffsetAlignment),beamBuffer=device.createBuffer({size:beamStride*257,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const beamUpload=new Float32Array(beamStride/4*257);
  const uniform=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  function destroy(){if(disposed)return;disposed=true;context?.unconfigure();buffer?.destroy();multisample?.destroy();uniform.destroy();beamBuffer.destroy();device.destroy();}
  try{
    if(!context)throw Error('WebGPU canvas unavailable');
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    const module=device.createShaderModule({code:shader});
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:80}}]});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    const bindGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:{buffer:beamBuffer,size:80}}]});
    const pipelines={};
    for(const mode of ['normal','add','lines'])pipelines[mode]=await device.createRenderPipelineAsync({
      layout:pipelineLayout,
      vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:44,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x4'},{shaderLocation:2,offset:28,format:'float32x3'},{shaderLocation:3,offset:40,format:'float32'}]}]},
      fragment:{module,entryPoint:'fragment',targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:mode==='add'?'one':'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},
      primitive:{topology:mode==='lines'?'line-list':'triangle-list',cullMode:'none'},multisample:{count:4}
    });
    if(failed)throw Error('WebGPU device lost during initialization');
    return {kind:'webgpu',maxSize:device.limits.maxTextureDimension2D,destroy,render(frame){
      if(disposed||failed)throw Error('WebGPU device unavailable');
      const bytes=frame.vertices.byteLength;
      if(bytes>capacity){buffer?.destroy();capacity=2**Math.ceil(Math.log2(Math.max(256,bytes)));buffer=device.createBuffer({size:capacity,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});}
      device.queue.writeBuffer(buffer,0,frame.vertices);device.queue.writeBuffer(uniform,0,frame.camera);
      if(!multisample||multisample.width!==canvas.width||multisample.height!==canvas.height){
        multisample?.destroy();multisample=device.createTexture({size:[canvas.width,canvas.height],format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});
      }
      let beamCount=0;
      for(const batch of frame.batches){batch.volumeOffset=0;if(batch.volume){if(++beamCount>256)throw Error('Too many preview beams');batch.volumeOffset=beamCount*beamStride;beamUpload.set(batch.volume,batch.volumeOffset/4);}}
      device.queue.writeBuffer(beamBuffer,0,beamUpload.subarray(0,(beamCount+1)*beamStride/4));
      const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:multisample.createView(),resolveTarget:context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'discard'}]});
      pass.setVertexBuffer(0,buffer);pass.setBindGroup(0,bindGroup,[0]);
      for(const batch of frame.batches){pass.setBindGroup(0,bindGroup,[batch.volumeOffset]);pass.setPipeline(pipelines[batch.mode]);pass.draw(batch.count,1,batch.first);}
      pass.end();device.queue.submit([encoder.finish()]);
    }};
  }catch(error){destroy();throw error;}
}
