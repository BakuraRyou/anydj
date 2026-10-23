import {exportQueueAudio} from './queue-audio-export.js';
import {queueVideoStreams} from './queue-video-timeline.js';
import {createQueueVideoScene} from './queue-video-scene.js';
import {createStageGpuScene} from './dmx-stage-gpu-scene.js';
import {createWebGlStage} from './dmx-stage-webgl.js';
import {createQueueVideoEncoder} from './queue-video-encoder.js';
import {tuneLightFrame} from './light-tuning.js';

export async function exportQueueVideo(schedule,files,{setup,signal,onProgress=()=>{},onTiming=()=>{},onPerformance=()=>{},width=1920,height=1080,bridge=window.anydjVideo}={}){
 if(!bridge||!setup)throw Error('MP4-Export ist in der Desktop-App verfügbar.');
 signal?.throwIfAborted();
 const fps=30,session=await bridge.begin({width,height,fps,duration:schedule.duration});
 if(!session)throw new DOMException('Export abgebrochen.','AbortError');
 const {id}=session;let complete=false,scene,renderer,encoder,graphicsLost=false;
 const work=new AbortController();
 const timings={sceneMs:0,geometryMs:0,imageMs:0,transferMs:0,frames:0};
 const cancel=()=>{work.abort();void bridge.cancel(id).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  signal?.throwIfAborted();
  await exportQueueAudio(schedule,files,{signal,format:'wav',onPart:part=>bridge.audio(id,part),onProgress:(value,text)=>onProgress(value*.2,text)});
  signal?.throwIfAborted();onProgress(.2,'3D-Lichtshow wird vorbereitet …');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  renderer=createWebGlStage(canvas,()=>{graphicsLost=true;});
  timings.renderer=renderer.device;
  onPerformance({renderer:timings.renderer,frames:0});
  if(width>renderer.maxSize||height>renderer.maxSize)throw Error('Die Grafikkarte unterstützt diese Videoauflösung nicht. Bitte 720p wählen.');
  const geometry=createStageGpuScene();
  scene=createQueueVideoScene({...setup,adjustFrame:frame=>tuneLightFrame(frame,setup.tuning)});
  encoder=await createQueueVideoEncoder({width,height,fps,onChunk:async data=>{
   const start=performance.now();await bridge.frame(id,data);timings.transferMs+=performance.now()-start;
  }});
  timings.encoding=encoder?'h264':'jpeg';
  await bridge.start(id,{format:encoder?'h264':'jpeg'});
  const count=Math.ceil(schedule.duration*fps);
  const videoStart=performance.now();let lastReport=videoStart;
  async function prepareFrame(index){
   work.signal.throwIfAborted();if(graphicsLost)throw Error('Grafikverbindung beim Videoexport verloren.');
   const time=index/fps,streams=queueVideoStreams(schedule,time,setup.flicker);
   let step=performance.now();const value=await scene.sample(streams,time,work.signal);timings.sceneMs+=performance.now()-step;
   work.signal.throwIfAborted();
   step=performance.now();const frame=geometry.build(width,height,value.layout,value.lights,scene.camera,value.crowd,value.motion);timings.geometryMs+=performance.now()-step;
   // Preserve full resolution and all optical samples. The direct encoder
   // bounds snapshots internally; the JPEG fallback captures one at a time.
   const imageStart=performance.now();frame.volumeScale=1;renderer.render(frame);
   if(encoder){await encoder.frame(canvas,index,work.signal);timings.imageMs+=performance.now()-imageStart;return null;}
   const image=new Promise(resolve=>canvas.toBlob(blob=>{
    timings.imageMs+=performance.now()-imageStart;
    resolve(blob?{blob}:{error:Error('Videobild konnte nicht gerendert werden.')});
   },'image/jpeg',.95));
   return {image};
  }
  for(let index=0;index<count;index++){
   work.signal.throwIfAborted();
   const current=await prepareFrame(index);
   if(current){
    const image=await current.image;if(image.error)throw image.error;
    work.signal.throwIfAborted();const transferStart=performance.now();
    await bridge.frame(id,new Uint8Array(await image.blob.arrayBuffer()));timings.transferMs+=performance.now()-transferStart;
   }
   timings.frames++;
   const now=performance.now();
   // Repainting the whole dialog for every encoded image competes with rendering.
   if(now-lastReport>=250||index===count-1){
    lastReport=now;const elapsed=(now-videoStart)/1000,rate=(index+1)/elapsed;
    onPerformance({renderer:timings.renderer,frames:index+1,rate,remaining:(count-index-1)/rate});
    onProgress(.2+.78*(index+1)/count,`Lichtshow · Bild ${index+1} / ${count}`);
   }
  }
  await encoder?.finish(work.signal);
  timings.videoMs=performance.now()-videoStart;
  onProgress(.99,'MP4 wird abgeschlossen …');const result=await bridge.finish(id);signal?.throwIfAborted();complete=true;onTiming({...timings});onProgress(1,'MP4 gespeichert: '+result.name);return result;
 }finally{
  signal?.removeEventListener('abort',cancel);work.abort();encoder?.destroy();scene?.destroy();renderer?.destroy();if(!complete)await bridge.cancel(id).catch(()=>{});
 }
}
