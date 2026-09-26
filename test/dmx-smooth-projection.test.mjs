import test from 'node:test';
import assert from 'node:assert/strict';
import {beamSurfacePatches,clipBeamReceiver} from '../public/dmx-light-geometry.js';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';
const layout={width:8,depth:6,height:3,room:true,positions:{}};
const floor=[[[-4,0],[4,0],[4,6],[-4,6]]];
const light={id:'wash',type:'spot',color:'#ddcc20',power:1,position:{x:0,y:3,height:2},target:{x:0,y:6,z:0}};
const flat=(p,k,v)=>p.points.every(x=>Math.abs(x[k]-v)<1e-7);
test('smooth projection uses receiving surfaces instead of nested brightness rings',()=>{
 const rings=beamSurfacePatches(light,layout,floor),smooth=beamSurfacePatches(light,layout,floor,{smooth:true});
 assert.ok(smooth.length>0&&smooth.length<=6);
 assert.ok(rings.length>smooth.length*10);
 for(const p of smooth){assert.equal(p.uv.length,p.points.length);assert.equal(p.alpha,1);for(const uv of p.uv){assert.equal(uv.length,3);assert.ok(uv.every(Number.isFinite));assert.ok(uv[2]>0);}}
});
test('projective light coordinates agree at the floor/wall seam',()=>{
 const patches=beamSurfacePatches(light,layout,floor,{smooth:true});
 const ground=patches.find(p=>flat(p,2,.006)),wall=patches.find(p=>flat(p,1,5.994));
 assert.ok(ground&&wall);
 const edge=p=>p.points.flatMap((v,i)=>Math.abs(v[1]-6)<1e-7||Math.abs(v[2])<1e-7?[{x:v[0],uv:p.uv[i]}]:[]).sort((a,b)=>a.x-b.x);
 const a=edge(ground),b=edge(wall);assert.equal(a.length,2);assert.equal(b.length,2);
 a.forEach((p,i)=>{assert.ok(Math.abs(p.x-b[i].x)<1e-7);p.uv.forEach((v,k)=>assert.ok(Math.abs(v-b[i].uv[k])<1e-7));});
});
test('GPU surfaces carry continuous projection data and blackout removes them',()=>{
 const scene=createStageGpuScene(),camera={mode:'dancer',x:0,y:-2,eyeHeight:2,yaw:0,pitch:0,zoom:1};
 const frame=scene.build(640,360,layout,[light],camera);
 let count=0;
 for(let i=0;i<frame.vertices.length;i+=11)if(frame.vertices[i+10]===7){count++;assert.ok(frame.vertices[i+9]>0);}
 assert.ok(count>0&&count<100,'no ring geometry emitted');
 const dark=scene.build(640,360,layout,[{...light,power:0}],camera);
 for(let i=10;i<dark.vertices.length;i+=11)assert.notEqual(dark.vertices[i],7);
});

test('smooth wall targets retain their saved receiving bounds',()=>{
 const room={...layout,roomPlan:{boundary:[[-4,0],[4,0],[4,6],[-4,6]],positions:{wash:{wallTarget:{start:.4,end:.6,minHeight:1,maxHeight:2}}}}};
 const patches=beamSurfacePatches({...light,wallIndex:2,target:{x:0,y:6,z:1.5}},room,floor,{smooth:true});
 assert.ok(patches.length>0);
 for(const patch of patches)for(const p of patch.points){
  assert.ok(Math.abs(p[1]-5.994)<1e-7);
  assert.ok(p[0]>=-.800001&&p[0]<=.800001);
  assert.ok(p[2]>=1&&p[2]<=2);
 }
});

test('haze stops on the receiving ceiling and preserves interpolated texture coordinates',()=>{
 const lamp={...light,target:{x:0,y:1,z:3},targetSurface:'ceiling'};
 const clipped=clipBeamReceiver([[-1,2,2],[1,2,2],[1,1,3.5],[-1,1,2.5]],[[0,0],[1,0],[1,1],[0,1]],lamp,layout);
 assert.ok(clipped.points.every(p=>p[2]<=3));
 assert.ok(clipped.points.some(p=>p[2]===3));
 assert.equal(clipped.uv.length,clipped.points.length);
 assert.ok(clipped.uv.some(p=>p[1]>0&&p[1]<1));
});
test('grazing ceiling illumination weakens with incidence angle',()=>{
 const ceilingPatches=target=>beamSurfacePatches({...light,type:'moving',position:{x:0,y:1,height:2},target},layout,floor,{smooth:true}).filter(p=>flat(p,2,2.994));
 const direct=ceilingPatches({x:0,y:1,z:3}),grazing=ceilingPatches({x:0,y:5,z:3});
 assert.ok(direct.length&&grazing.length);
 assert.ok(grazing[0].attenuation<direct[0].attenuation*.4);
});

test('coplanar receiving triangles have identical attenuation',()=>{
 const triangles=[[[-4,0],[4,0],[4,6]],[[-4,0],[4,6],[-4,6]]];
 const patches=beamSurfacePatches({...light,target:{x:0,y:3,z:0}},layout,triangles,{smooth:true}).filter(p=>flat(p,2,.006));
 assert.equal(patches.length,2);
 assert.ok(Math.abs(patches[0].attenuation-patches[1].attenuation)<1e-12);
});
test('receiver contact fades continuously to zero on the clipped plane',()=>{
 const lamp={...light,target:{x:0,y:1,z:3},targetSurface:'ceiling'};
 const clipped=clipBeamReceiver([[-1,2,2],[1,2,2],[1,1,3.5],[-1,1,2.5]],[[0,0],[1,0],[1,1],[0,1]],lamp,layout,.2);
 clipped.points.forEach((p,i)=>assert.ok(Math.abs(clipped.uv[i][2]-(3-p[2])/.2)<1e-10));
 assert.ok(clipped.uv.some(uv=>Math.abs(uv[2])<1e-10));
});
