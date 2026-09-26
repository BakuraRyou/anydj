import test from 'node:test';
import assert from 'node:assert/strict';
import {lightFootprint,lightProfile} from '../public/dmx-light-geometry.js';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';

const lamp={id:'a',position:{x:0,y:5,height:3},target:{x:0,y:2,z:0},power:.8,color:'#4488ff'};
test('static fixtures cover a broad area and contribute less aerial light than moving beams',()=>{
  const moving=lightFootprint({...lamp,type:'moving'}),wash=lightFootprint({...lamp,type:'spot'}),bar=lightFootprint({...lamp,type:'bar'});
  assert.ok(wash.radius>moving.radius*5);
  assert.ok(bar.radius>moving.radius*5&&bar.stretch>wash.stretch);
  assert.ok(lightProfile('spot').volume<lightProfile('moving').volume*.25);
  assert.ok(lightFootprint({...lamp,type:'spot',target:{x:0,y:-4,z:0}}).radius>1.8,'wide illumination is not capped to the moving beam radius');
});
test('estimated fixture zoom changes cone coverage without changing its target or output',()=>{
  const source={...lamp,type:'moving',beamAngle:18},copy=structuredClone(source);
  assert.ok(lightFootprint(source).radius>lightFootprint({...source,beamAngle:5}).radius*3);
  assert.deepEqual(source,copy);
  for(const angle of [NaN,Infinity,-10,160])assert.ok(Number.isFinite(lightProfile('moving',angle).spread));
});
test('zero haze removes aerial beams while keeping lenses and illuminated surfaces',()=>{
  const scene=createStageGpuScene(),layout={width:10,depth:8,height:4,room:true,positions:{},environmentBrightness:5};
  const camera={mode:'dancer',x:0,y:-2,eyeHeight:2,yaw:0,pitch:0,zoom:1};
  const count=(f,k)=>{let n=0;for(let i=10;i<f.vertices.length;i+=11)if(f.vertices[i]===k)n++;return n;};
  const clear=scene.build(640,360,{...layout,hazeDensity:0},[{...lamp,type:'spot'}],camera);
  assert.equal(count(clear,8),0);assert.ok(count(clear,2)>0);assert.ok(clear.batches.filter(b=>b.mode==='add').reduce((n,b)=>n+b.count,0)>count(clear,2),'surface illumination remains without haze');
  const haze=scene.build(640,360,{...layout,hazeDensity:.65},[{...lamp,type:'spot'}],camera);
  assert.equal(count(haze,8),6);
  const low=scene.build(640,360,{...layout,hazeDetail:false},[{...lamp,type:'spot'}],camera);
  assert.equal(low.camera[3],0);
});
