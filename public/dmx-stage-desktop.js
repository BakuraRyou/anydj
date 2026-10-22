import {renderStage3d,drawStageLabel} from './dmx-stage-3d-renderer.js';
import {createStageGpuScene} from './dmx-stage-gpu-scene.js';
export {moveStageCamera,createCrowdMotion,stageFloorPoint,stageCamera} from './dmx-stage-3d-renderer.js';
// Keep the original canvas as the input/accessibility and text layer. Each GPU
// backend owns a separate canvas, so a lost/bound context never traps fallback.
// Prefer WebGL for this small per-beam workload; software WebGPU can be much slower.
export async function createDesktopRenderer(canvas,{onInvalidate=()=>{},backends=['webgl','webgpu']}={}){
  let active=null,layer=null,disposed=false,next=0,switching=null;
  const scene=createStageGpuScene();
  const timings={geometryMs:0,submitMs:0,overlayMs:0};
  const remove=()=>{active?.destroy();active=null;layer?.remove();layer=null;};
  async function select(){
    remove();canvas.dataset.renderer='canvas';
    while(!disposed&&next<backends.length){
      const kind=backends[next++],candidate=document.createElement('canvas');
      candidate.className='stage-3d-gpu';candidate.setAttribute('aria-hidden','true');
      let backend=null,expired=false,timer;
      try{
        const lost=reason=>{canvas.dataset.rendererError=String(reason||'Graphics context lost');if(active===backend&&backend&&!disposed){switching??=select().finally(()=>{switching=null;onInvalidate();});}};
        const initialize=async()=>{
          if(kind==='webgpu')return (await import('./dmx-stage-webgpu.js')).createWebGpuStage(candidate,lost);
          return (await import('./dmx-stage-webgl.js')).createWebGlStage(candidate,lost);
        };
        const pending=initialize().then(value=>{if(expired||disposed){value.destroy();throw Error('Renderer initialization cancelled');}return value;});
        backend=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Renderer initialization timed out'));},3000);})]);
        clearTimeout(timer);
        if(disposed){backend.destroy();return;}
        active=backend;layer=candidate;canvas.after(layer);canvas.dataset.renderer=active.kind;return;
      }catch(error){canvas.dataset.rendererError=String(error.message);clearTimeout(timer);backend?.destroy();candidate.remove();}
    }
  }
  await select();
  return {get kind(){return active?.kind||'canvas';},get device(){return active?.device||null;},get timings(){return timings;},render(ctx,width,height,layout,lights,camera,crowd,time){
    if(disposed)return;
    if(active){
      try{
        const ratio=Math.min(1,active.maxSize/canvas.width,active.maxSize/canvas.height);
        const w=Math.max(1,Math.round(canvas.width*ratio)),h=Math.max(1,Math.round(canvas.height*ratio));
        if(layer.width!==w)layer.width=w;if(layer.height!==h)layer.height=h;
        layer.style.width=width+'px';layer.style.height=height+'px';
        const start=performance.now(),frame=scene.build(width,height,layout,lights,camera,crowd,time),built=performance.now();
        active.render(frame);const submitted=performance.now();
        ctx.clearRect(0,0,width,height);drawStageLabel(ctx,width,height,layout,camera);
        timings.geometryMs=built-start;timings.submitMs=submitted-built;timings.overlayMs=performance.now()-submitted;return;
      }catch(error){canvas.dataset.rendererError=String(error.message);switching??=select().finally(()=>{switching=null;onInvalidate();});}
    }
    const start=performance.now();renderStage3d(ctx,width,height,layout,lights,camera,crowd,time);
    timings.geometryMs=0;timings.submitMs=performance.now()-start;timings.overlayMs=0;
  },destroy(){disposed=true;remove();delete canvas.dataset.renderer;delete canvas.dataset.rendererError;}};
}

// CPU submission time omits asynchronous GPU/compositor work. During continuous
// animation use delivered frame intervals as well; idle updates are not lag.
export function createPreviewQuality(){
 let resolution=1.5,workAverage=0,frameAverage=0,last=null,wasContinuous=false,slow=0,fast=0;
 return {
  scale(pixelRatio=1){return Math.min(pixelRatio,resolution);},
  get frameMs(){return frameAverage;},
  record(now,{drawMs,continuous=false,pixelRatio=1}){
   workAverage=workAverage*.9+Math.max(0,drawMs)*.1;
   const elapsed=last===null?0:now-last;
   const measured=continuous&&wasContinuous&&elapsed>0&&elapsed<1000;
   frameAverage=measured?(frameAverage?frameAverage*.9+elapsed*.1:elapsed):0;
   last=now;wasContinuous=continuous;
   const overloaded=continuous?measured&&Math.max(frameAverage,workAverage)>38:workAverage>16;
   const headroom=continuous?measured&&frameAverage<20&&workAverage<16:workAverage<8;
   slow=overloaded?slow+1:0;fast=headroom?fast+1:0;
   if(slow>=30&&resolution>.5){resolution=Math.max(.5,Math.min(pixelRatio,resolution)-.25);slow=fast=0;}
   else if(fast>=180&&resolution<1.5){resolution=Math.min(1.5,resolution+.25);slow=fast=0;}
  }
 };
}
