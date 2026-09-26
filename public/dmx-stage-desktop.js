import {renderStage3d,drawStageLabel} from './dmx-stage-3d-renderer.js';
import {createStageGpuScene} from './dmx-stage-gpu-scene.js';
export {moveStageCamera,createCrowdMotion} from './dmx-stage-3d-renderer.js';
// Keep the original canvas as the input/accessibility and text layer. Each GPU
// backend owns a separate canvas, so a lost/bound context never traps fallback.
export async function createDesktopRenderer(canvas,{onInvalidate=()=>{},backends=['webgpu','webgl']}={}){
  let active=null,layer=null,disposed=false,next=0,switching=null;
  const scene=createStageGpuScene();
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
  return {get kind(){return active?.kind||'canvas';},render(ctx,width,height,layout,lights,camera,crowd,time){
    if(disposed)return;
    if(active){
      try{
        const ratio=Math.min(1,active.maxSize/canvas.width,active.maxSize/canvas.height);
        const w=Math.max(1,Math.round(canvas.width*ratio)),h=Math.max(1,Math.round(canvas.height*ratio));
        if(layer.width!==w)layer.width=w;if(layer.height!==h)layer.height=h;
        layer.style.width=width+'px';layer.style.height=height+'px';
        active.render(scene.build(width,height,layout,lights,camera,crowd,time));
        ctx.clearRect(0,0,width,height);drawStageLabel(ctx,width,height,layout,camera);return;
      }catch(error){canvas.dataset.rendererError=String(error.message);switching??=select().finally(()=>{switching=null;onInvalidate();});}
    }
    renderStage3d(ctx,width,height,layout,lights,camera,crowd,time);
  },destroy(){disposed=true;remove();delete canvas.dataset.renderer;delete canvas.dataset.rendererError;}};
}
