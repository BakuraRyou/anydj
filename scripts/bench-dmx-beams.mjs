// CPU geometry benchmark; these numbers are not browser FPS or GPU timings.
// Optional baseline: node scripts/bench-dmx-beams.mjs /tmp/anydj-light-geometry-before.mjs
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {beamSurfacePatches} from '../public/dmx-light-geometry.js';
const layout={width:8,depth:6,height:3,room:true};
const floor=[[[-4,0],[4,0],[4,6],[-4,6]]];
const lights=Array.from({length:20},(_,i)=>({id:`head-${i}`,type:'moving',power:1,
  position:{x:-3.5+i*7/19,y:5,height:2.5},target:{x:Math.sin(i)*3.8,y:1+i%4,z:i%3===0?3:0}}));
const baseline=process.argv[2]?(await import(pathToFileURL(process.argv[2]))).beamSurfacePatches:null;
if(baseline){
  // Include a concave room and rays crossing floor/wall/ceiling seams.
  const rooms=[{layout,floor},{layout:{...layout,roomPlan:{boundary:[[-4,0],[4,0],[4,3],[0,3],[0,6],[-4,6]]}},floor:[[[ -4,0],[4,0],[4,3],[-4,3]],[[-4,3],[0,3],[0,6],[-4,6]]]}];
  for(const room of rooms)for(let i=0;i<120;i++){
    const light={...lights[i%20],target:{x:Math.sin(i*1.7)*4,y:(i%13)/2,z:(i%7)/2}};
    const before=baseline(light,room.layout,room.floor),after=beamSurfacePatches(light,room.layout,room.floor);
    assert.equal(after.length,before.length);
    for(let j=0;j<before.length;j++){
      assert.equal(after[j].alpha,before[j].alpha);assert.equal(after[j].points.length,before[j].points.length);
      before[j].points.flat().forEach((value,k)=>assert.ok(Math.abs(value-after[j].points.flat()[k])<1e-8));
    }
  }
  console.log('240 rectangular/concave scene samples match baseline geometry within 1e-8.');
}
function measure(fn){
  const frame=()=>{for(const light of lights)fn(light,layout,floor);};
  for(let i=0;i<40;i++)frame();
  const samples=[];
  for(let i=0;i<100;i++){const start=performance.now();frame();samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  return {medianMs:+samples[50].toFixed(2),p95Ms:+samples[95].toFixed(2)};
}
if(baseline)console.log('Before (20 moving heads):',measure(baseline));
console.log('Current (20 moving heads):',measure(beamSurfacePatches));
