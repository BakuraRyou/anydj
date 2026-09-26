import test from 'node:test';
import assert from 'node:assert/strict';
import {previewOpticalRays,lightFootprint,beamSurfacePatches} from '../public/dmx-light-geometry.js';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';
const layout={width:10,depth:8,height:5,room:true,positions:{}};
const source={id:'head',type:'moving',power:1,color:'#48aaff',beamAngle:12,position:{x:0,y:4,height:3},target:{x:0,y:4,z:0}};
test('prism/gobo optics are opt-in, bounded, and leave source and total output intact',()=>{
 assert.equal(previewOpticalRays(source,layout)[0],source);
 for(const [prism,gobo,count] of [[3,null,3],[0,'triad',3],[3,'triad',9],[99,'unknown',1]]){
  const light={...source,prism,gobo},copy=structuredClone(light),rays=previewOpticalRays(light,layout);
  assert.equal(rays.length,count);assert.deepEqual(light,copy);
  assert.ok(rays.reduce((n,r)=>n+r.power,0)<=source.power+1e-9);
  for(const r of rays)assert.ok(Object.values(r.target).every(Number.isFinite));
 }
});
test('prism fans rotate around the head axis and stop at the first room surface',()=>{
 const a=previewOpticalRays({...source,prism:3,opticsRotation:0},layout);
 const b=previewOpticalRays({...source,prism:3,opticsRotation:90},layout);
 const extent=r=>[Math.abs(r[0].target.x-r[2].target.x),Math.abs(r[0].target.y-r[2].target.y)];
 assert.ok(extent(a)[0]>.5&&extent(a)[1]<1e-6);
 assert.ok(extent(b)[1]>.5&&extent(b)[0]<1e-6);
 const wall=previewOpticalRays({...source,prism:3,target:{x:0,y:10,z:3}},layout);
 for(const r of wall){assert.ok(Math.abs(r.target.y-8)<1e-6);assert.equal(r.targetSurface,'wall');}
});
test('triad gobos project three separated apertures with bounded surface detail',()=>{
 const rays=previewOpticalRays({...source,gobo:'triad'},layout);
 const narrow=previewOpticalRays({...source,beamAngle:4,gobo:'triad'},layout);
 assert.ok(lightFootprint(narrow[0]).radius<lightFootprint({...source,beamAngle:4}).radius*.4);
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
  const distance=Math.hypot(rays[i].target.x-rays[j].target.x,rays[i].target.y-rays[j].target.y);
  assert.ok(distance>lightFootprint(rays[i]).radius*2);
 }
 const floor=[[[-5,0],[5,0],[5,8]],[[-5,0],[5,8],[-5,8]]];
 for(const r of rays){const patches=beamSurfacePatches(r,layout,floor);assert.ok(patches.length>0&&patches.length<=16);for(const p of patches)assert.ok(p.points.every(v=>Math.abs(v[2]-.006)<1e-6));}
});
test('nine optical rays still have one lens, no added fixture bodies and a full blackout',()=>{
 const scene=createStageGpuScene(),camera={mode:'dancer',x:0,y:0,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
 const lamp={...source,target:{x:0,y:1,z:0},prism:3,gobo:'triad'};
 const count=(frame,kind)=>{let n=0;for(let i=10;i<frame.vertices.length;i+=11)if(frame.vertices[i]===kind)n++;return n;};
 const regular=scene.build(640,360,layout,[{...lamp,prism:0,gobo:null}],camera),bodies=count(regular,0),lens=count(regular,2);
 const split=scene.build(640,360,layout,[lamp],camera);
 assert.ok(count(split,8)>=9*6&&count(split,8)<=9*9);assert.equal(count(split,2),lens);
 // Kind 0 includes receiver patches, so compare models with surface lights disabled by AR mode.
 const simple=scene.build(640,360,{...layout,ar:true},[{...lamp,prism:0,gobo:null}],camera),simpleBodies=count(simple,0);
 const optical=scene.build(640,360,{...layout,ar:true},[lamp],camera);
 assert.equal(count(optical,0),simpleBodies);assert.ok(bodies>0);
 const dark=scene.build(640,360,layout,[{...lamp,power:0}],camera);
 assert.equal(count(dark,8),0);assert.equal(count(dark,2),0);
});
