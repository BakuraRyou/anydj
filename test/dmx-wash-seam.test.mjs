import test from 'node:test';
import assert from 'node:assert/strict';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
import {beamSurfacePatches} from '../public/dmx-light-geometry.js';
const layout={width:8,depth:6,height:3,room:true,positions:{}};
const floor=[[[-4,0],[4,0],[4,6],[-4,6]]];
const onPlane=(p,axis,value)=>p.every(v=>Math.abs(v[axis]-value)<1e-6);
for(const type of ['spot','bar'])test(`${type} projects onto both sides of room seams through the actual renderer`,()=>{
 for(const [target,planes] of [[{x:0,y:5.8,z:0},[[2,.006],[1,5.994]]],[{x:3.9,y:6,z:1.2},[[0,3.994],[1,5.994]]],[{x:0,y:6,z:2.9},[[1,5.994],[2,2.994]]]]){
  const light={id:'wash',type,power:.8,color:'#ff3050',position:{x:0,y:3,height:2},target};
  const patches=[];
  drawStageGeometry(layout,[light],[],0,{polygon(p,c,a,s,w,emissive){if(emissive&&c===light.color)patches.push(p);},beam:()=>true,lens:()=>{},footprint:()=>true});
  for(const [axis,value] of planes)assert.ok(patches.some(p=>onPlane(p,axis,value)),`${type}: missing receiving plane ${axis}=${value}`);
 }
});
test('a wash reaches the wall continuously rather than acquiring a separate wall halo',()=>{
 const patches=beamSurfacePatches({id:'wash',type:'spot',power:1,position:{x:0,y:3,height:2},target:{x:0,y:6,z:0}},layout,floor);
 const levels=axis=>patches.filter(p=>onPlane(p.points,axis,axis===1?5.994:.006)).map(p=>p.alpha).sort((a,b)=>a-b);
 const ground=levels(2),wall=levels(1);
 assert.ok(ground.length>10);assert.equal(ground.length,wall.length,'the same cone levels reach both receiving planes');assert.ok([...ground,...wall].every(a=>a>0&&a<1));
});
test('LED bar projection retains its wider horizontal coverage on the wall',()=>{
 const base={power:1,beamAngle:30,position:{x:0,y:3,height:1.5},target:{x:0,y:6,z:1.5}};
 const width=type=>{const p=beamSurfacePatches({...base,type},layout,floor).filter(p=>onPlane(p.points,1,5.994)).flatMap(p=>p.points.map(v=>v[0]));return Math.max(...p)-Math.min(...p);};
 assert.ok(width('bar')>width('spot')*1.5);
});
