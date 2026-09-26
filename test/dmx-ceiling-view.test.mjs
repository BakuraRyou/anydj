import test from 'node:test';
import assert from 'node:assert/strict';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
import {newRoomPlan} from '../public/dmx-ar-model.js';
const base={width:8,depth:6,height:3,room:true,positions:{}};
const light={id:'head',type:'moving',power:1,color:'#30bbff',position:{x:0,y:4,height:1.5},target:{x:0,y:3,z:3},targetSurface:'ceiling'};
function capture(layout,eye,lights=[]){
 const result={ceilings:[],hits:[]};
 drawStageGeometry(layout,lights,[],0,{eye,beam:()=>true,lens:()=>{},polygon(points,fill,alpha,stroke,width,emissive){
  if(fill&&points.length>=3&&!emissive&&points.every(p=>Math.abs(p[2]-3)<1e-8))result.ceilings.push(points);
  if(emissive&&points.every(p=>Math.abs(p[2]-2.994)<1e-8))result.hits.push(points);
 }});return result;
}
test('ceiling underside remains visible when the camera moves outside the floor boundary',()=>{
 for(const eye of [[0,2,1.7],[0,-4,1.7],[6,3,1.7],[0,6.1,1.7]]){
  const value=capture(base,eye,[light]);
  assert.ok(value.ceilings.length>=2,JSON.stringify(eye));
  assert.ok(value.hits.length>0,'upward light lands on the underside of the ceiling');
 }
});
test('ceiling stays open for overhead planning views and real-world AR',()=>{
 assert.equal(capture(base,[0,-4,3.1]).ceilings.length,0);
 assert.equal(capture({...base,ar:true},[0,2,1.7]).ceilings.length,0);
});
test('external views retain the concave room ceiling outline',()=>{
 const plan=newRoomPlan(8,6,3);plan.representation='style';
 plan.boundary=[[-4,0],[4,0],[4,3],[0,3],[0,6],[-4,6]];
 const value=capture({...base,roomPlan:plan},[0,-4,1.7]);
 assert.ok(value.ceilings.length>=4);
 const area=value.ceilings.reduce((sum,p)=>sum+Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1];},0))/2,0);
 assert.ok(Math.abs(area-36)<1e-8,'no ceiling across the missing room corner');
});
