import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage,spatialColors} from '../public/dmx-auto.js';

const frame={state:true,r:255,g:87,b:0,dimming:70};
const palette=[[255,87,0],[255,198,0],[0,255,236],[80,0,255]];
const equipment={devices:[...Array.from({length:4},(_,i)=>({id:'spot-'+i,type:'spot',cells:1})),{id:'bar',type:'bar',cells:8}]};
const section=(start,end,look)=>({start,end,look});
const plan=sections=>({showProfile:'auto',sections,colorDirection:{events:[{time:0,reason:'opening'}]}});
function source(p,t,extra={}){
 const s=p.sections.find(s=>t>=s.start&&t<s.end);
 return {movingPlan:p,songTime:t,look:s.look,sectionProgress:(t-s.start)/(s.end-s.start),frame,palette,weight:1,...extra};
}
const render=(p,t,limit=2,extra={})=>automaticStage([source(p,t,extra)],limit,equipment,'auto',{movingSource:true});
const colors=result=>result.frames.flat().map(f=>[f.r,f.g,f.b]);
const distance=(a,b)=>Math.max(...a.flatMap((rgb,i)=>rgb.map((v,c)=>Math.abs(v-b[i][c]))));

test('short flow/build sections retain their two-color picture through both boundaries',()=>{
 const p=plan([section(0,16,'flow'),section(16,18,'lift'),section(18,24,'peak')]);
 const before=colors(render(p,15.99));
 for(const time of [16,16.02,16.5,17,17.99,18,18.02])assert.deepEqual(colors(render(p,time)),before);
});
test('quiet, build and peak colors remain continuous for every configured ceiling',()=>{
 const p=plan([section(0,1,'flow'),section(1,3,'held'),section(3,5,'lift'),section(5,7,'peak'),section(7,9,'flow')]);
 for(const limit of [1,2,3,4]){
  let previous=colors(render(p,0,limit));
  for(let tick=1;tick<9000;tick++){
   const result=render(p,tick/1000,limit),current=colors(result);
   assert.ok(distance(current,previous)<=5,`${limit} colors at ${tick/1000}: ${distance(current,previous)}`);
   assert.ok(new Set(current.map(c=>c.join(','))).size<=limit);
   assert.ok(result.frames.flat().every(f=>f.dimming===frame.dimming));
   previous=current;
  }
  assert.equal(new Set(colors(render(p,2,limit)).map(c=>c.join(','))).size,1);
  assert.ok(distance(colors(render(p,3,limit)),colors(render(p,2.99,limit)))<=1);
  if(limit>1)assert.notDeepEqual(colors(render(p,4,limit)),colors(render(p,3,limit)),'a build must open before its end');
 }
});
test('color transitions are seek-stable and preserve current source colors and blackout',()=>{
 const p=plan([section(0,2,'peak'),section(2,4,'held'),section(4,6,'lift')]);
 const first=render(p,2.3,4);render(p,5,4);render(p,0,4);
 assert.deepEqual(render(p,2.3,4),first);
 const green={...frame,r:0,g:255,b:20};
 assert.deepEqual(render(p,2.3,4,{frame:green}).palette[0],[0,255,20]);
 assert.ok(render(p,2.3,4,{frame:{...frame,dimming:0}}).frames.flat().every(f=>f.dimming===0));
});
test('very short analysis fragments carry their partial color transition forward',()=>{
 const sections=[section(0,1,'peak'),...Array.from({length:20},(_,i)=>section(1+i*.08,1+(i+1)*.08,['held','flow','lift','peak'][i%4])),section(2.6,4,'held')];
 const p=plan(sections);let previous=colors(render(p,.999,4));
 for(let tick=1000;tick<3500;tick++){
  const current=colors(render(p,tick/1000,4));assert.ok(distance(current,previous)<=5,`color step at ${tick/1000}`);previous=current;
 }
});
test('two automatic decks share a stable color ceiling while their palettes blend',()=>{
 const a=plan([section(0,2,'peak'),section(2,4,'held')]),b=plan([section(0,2,'held'),section(2,4,'lift')]);
 for(const limit of [1,2,3,4]){
  const result=automaticStage([source(a,2.3,{weight:.25}),source(b,2.3,{weight:.75,frame:{...frame,r:0,g:0,b:255}})],limit,equipment);
  assert.deepEqual(result.palette[0],[64,22,191]);
  assert.ok(new Set(colors(result).map(c=>c.join(','))).size<=limit);
 }
});
test('travelling colors enter from zero at a delayed first acoustic event',()=>{
 const times=[.32,.66,.98,1.32,1.66,1.98,2.32,2.66];
 const p={arrangement:{times,patterns:{events:times.map(()=>({driving:true})),phrases:[{start:0,end:3,kind:'bounce',movement:{character:'rhythmic',driving:1,rate:3}}]}}};
 const at=t=>spatialColors({movingPlan:p,songTime:t,look:'peak'},4,palette.slice(0,2));
 assert.deepEqual(at(.32),at(.319));
 assert.ok(distance(at(.34),at(.32))<5);
 assert.notDeepEqual(at(.7),at(.32));
 const first=at(.34);at(2);assert.deepEqual(at(.34),first);
});
