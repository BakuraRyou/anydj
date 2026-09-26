import test from 'node:test';
import assert from 'node:assert/strict';
import {createBeamSurfaceCache,beamSurfacePatches} from '../public/dmx-light-geometry.js';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';
const layout={width:8,depth:6,height:3,room:true,positions:{}};
const floor=[[[-4,0],[4,0],[4,6],[-4,6]]];
const light={id:'a',type:'spot',power:1,color:'#ffaa00',position:{x:0,y:3,height:2},target:{x:0,y:4,z:0}};
test('surface cache reuses geometry through dimmer/color changes but invalidates room and aim edits',()=>{
 const cache=createBeamSurfaceCache(3);cache.begin(layout);
 const a=cache.project(light,layout,floor,{smooth:true});
 assert.equal(cache.project({...light,power:.2,color:'#00ffff'},layout,floor,{smooth:true}),a);
 const moved={...light,target:{x:2,y:4,z:0}};
 assert.deepEqual(cache.project(moved,layout,floor,{smooth:true}),beamSurfacePatches(moved,layout,floor,{smooth:true}));
 const taller={...layout,height:5};cache.begin(taller);
 assert.notEqual(cache.project(light,taller,floor,{smooth:true}),a);
 for(let i=0;i<10;i++)cache.project({...light,target:{x:i/10,y:4,z:0}},taller,floor,{smooth:true});
 assert.equal(cache.size,3);
});
test('haze quality remains stable through a blackout and intense phases',()=>{
 const lights=Array.from({length:192},(_,i)=>({...light,id:String(i)}));
 const scene=createStageGpuScene(),camera={mode:'dancer',x:0,y:-2,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
 const on=scene.build(1280,720,layout,lights,camera);assert.equal(on.volumeScale,1/3);
 const rays=on.batches.filter(b=>b.volume).length;assert.equal(rays,192);
 const off=scene.build(1280,720,layout,lights.map(l=>({...l,power:0})),camera);
 assert.equal(off.volumeScale,1/3);assert.equal(off.batches.filter(b=>b.volume).length,0);
 const small=scene.build(1280,720,layout,[light],camera);assert.equal(small.volumeScale,1);
});
test('distant fixture detail reduces geometry while retaining every beam',()=>{
 const scene=createStageGpuScene(),lamp={...light,type:'moving',position:{x:0,y:5,height:2.5}};
 const camera={mode:'dancer',x:0,y:-12,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
 const small=scene.build(640,360,layout,[lamp],camera),count=small.vertices.length,rays=small.batches.filter(b=>b.volume).length;
 const selected=scene.build(640,360,{...layout,selectedFixture:lamp.id},[lamp],camera);
 assert.ok(selected.vertices.length>count);assert.equal(selected.batches.filter(b=>b.volume).length,rays);
});
