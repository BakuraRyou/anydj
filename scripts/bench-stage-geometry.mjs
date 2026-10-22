// CPU-only geometry benchmark. Pass a saved renderer module to compare revisions.
// The digest covers every emitted vertex, uniform and batch, not timing samples.
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {largeClubRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan} from '../public/dmx-ar-model.js';

const moduleUrl=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../public/dmx-stage-gpu-scene.js',import.meta.url);
const {createStageGpuScene}=await import(moduleUrl.href);
const builder=createStageGpuScene(),plan=largeClubRoom();
const camera={mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:0,pitch:-.1,zoom:1};
const times=[],hash=createHash('sha256');
for(let f=0;f<400;f++){
  const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},crowd:[],lights:['moving','spot','bar'].map((type,i)=>({
    id:type,type,position:{x:0,y:2,height:3},target:{x:Math.sin(f*.09)*3,y:3},
    power:f%100<25?.25:.95,color:i===0?'#00bddd':'#ff40a0',
  }))},plan);
  const start=performance.now(),frame=builder.build(1920,992,scene.layout,scene.lights,camera,[],f/60);
  if(f>=60)times.push(performance.now()-start);
  hash.update(Buffer.from(frame.vertices.buffer,frame.vertices.byteOffset,frame.vertices.byteLength));
  hash.update(JSON.stringify(frame.batches));hash.update(Buffer.from(frame.camera.buffer));
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({fixtures:192,frames:400,measuredFrames:times.length,
  medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],streamHash:hash.digest('hex')},null,2));
