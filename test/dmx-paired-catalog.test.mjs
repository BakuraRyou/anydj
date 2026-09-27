import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUP_COMPOSITIONS,groupComposition} from '../public/dmx-group-motion.js';
const motion=(composition,progress,phase)=>({composition,progress,phase,amount:1,energy:.5,drive:.5,intent:{symmetry:'paired'}});
test('paired traveling groups keep an illuminated pair throughout the full chase',()=>{
 for(const count of [2,3,4,7,8,12,32])for(let step=0;step<=240;step++){
  const m=motion('traveling-group',.5,step/240*Math.PI*4);
  const heads=Array.from({length:count},(_,i)=>groupComposition(m,i,count,0,6));
  assert.ok(Math.max(...heads.map(h=>h.level))>.5,`${count} heads at phase ${m.phase}`);
 }
});
test('paired question-answer hands brightness between complete pairs without fading the whole rig',()=>{
 for(const count of [4,7,8,12]){
  const early=Array.from({length:count},(_,i)=>groupComposition(motion('question-answer',.25,1),i,count));
  const late=Array.from({length:count},(_,i)=>groupComposition(motion('question-answer',.75,1),i,count));
  assert.ok(early[0].level>early[1].level);
  assert.ok(late[0].level<late[1].level);
  for(let step=0;step<=100;step++){
   const heads=Array.from({length:count},(_,i)=>groupComposition(motion('question-answer',step/100,1),i,count));
   assert.ok(Math.max(...heads.map(h=>h.level))>=.57);
   heads.forEach((h,i)=>assert.equal(h.level,heads[count-1-i].level));
  }
 }
 for(const p of [.25,.5,.75])assert.equal(groupComposition(motion('question-answer',p,1),0,2).level,1);
});
test('every paired catalog figure stays finite, mirrored and continuous during its gesture',()=>{
 for(const composition of GROUP_COMPOSITIONS)for(const count of [2,3,8,12])for(let i=1;i<100;i++){
  const p=i/100,phase=p*Math.PI*4;
  const m=motion(composition,p,phase),next=motion(composition,p+1e-6,phase+1e-6*Math.PI*4);
  for(let rank=0;rank<count;rank++){
   const a=groupComposition(m,rank,count,1,6),b=groupComposition(m,count-1-rank,count,1,6),c=groupComposition(next,rank,count,1,6);
   for(const key of ['x','y','level','weight','wallBlend'])assert.ok(Number.isFinite(a[key])&&a[key]>=0&&a[key]<=1,`${composition}/${key}`);
   assert.ok(Math.abs(a.x+b.x-1)<1e-9);assert.equal(a.y,b.y);assert.equal(a.level,b.level);
   assert.ok(Math.hypot(a.x-c.x,a.y-c.y)<.001,composition);
  }
 }
});
test('extent crosses neutral continuously and preserves allowed area and pair symmetry',()=>{
 for(const composition of GROUP_COMPOSITIONS){
  const m=motion(composition,.5,1),at=extent=>groupComposition({...m,intent:{...m.intent,extent}},0,8,1,6);
  const a=at(1-1e-6),b=at(1),c=at(1+1e-6);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5,composition);
  assert.ok(Math.hypot(c.x-b.x,c.y-b.y)<1e-5,composition);
  for(const extent of [.8,1,1.2,1.6]){
   const left=at(extent),right=groupComposition({...m,intent:{...m.intent,extent}},7,8,1,6);
   assert.ok(left.x>=0&&left.x<=1&&left.y>=0&&left.y<=1);
   assert.ok(Math.abs(left.x+right.x-1)<1e-9);assert.equal(left.y,right.y);
  }
 }
});
