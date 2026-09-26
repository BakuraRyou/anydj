import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUP_COMPOSITIONS,groupComposition,automaticGroupMotionAt} from '../public/dmx-group-motion.js';
import {applyMovingPresence} from '../public/dmx-activity.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
function scene(composition,progress=.4,count=12){
 const groupMotion={composition,motion:'orbit',progress,energy:.7,duration:8,amount:1};
 return {layout:{width:8,depth:6,positions:{}},lights:Array.from({length:count},(_,i)=>({id:'h'+i,type:'moving',position:{x:i/count*6-3,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:'auto',movingPresence:{level:.7,spread:1,mask:'all',rowFraction:1,groupMotion},movingPresenceBasePower:.8,power:.56,color:'#66aaee'}))};
}
test('all six compositions remain visibly distinct in a small permitted rectangle',()=>{
 const room=newRoomPlan(8,6,4),template=scene('curtain');
 template.lights.forEach(l=>room.positions[l.id]={...l.position,type:'moving',rotation:0,motionArea:{x:.4,y:.4,width:.2,depth:.2}});
 const geometries=new Set(),memberships=new Set();
 for(const composition of GROUP_COMPOSITIONS){
  const rendered=applyRoomPlan(scene(composition),room).lights;
  assert.ok(rendered.every(l=>l.target.x>=-.8-1e-9&&l.target.x<=.8+1e-9&&l.target.y>=2.4&&l.target.y<=3.6+1e-9));
  assert.ok(rendered.some(l=>l.power>.1));assert.ok(rendered.every(l=>l.color==='#66aaee'&&l.power<=.56+1e-9));
  geometries.add(JSON.stringify(rendered.map(l=>[+l.target.x.toFixed(3),+l.target.y.toFixed(3)])));
  memberships.add(rendered.map(l=>l.power>.3?'1':'0').join(''));
 }
 assert.equal(geometries.size,6);assert.ok(memberships.size>=4);
});
test('composition membership cannot cancel another pair mask or relight blackout',()=>{
 for(const count of [2,3,7,8,10,12])for(const composition of GROUP_COMPOSITIONS){
  const input=scene(composition,.4,count).lights.map(l=>({...l,movingPresence:{...l.movingPresence,mask:'answer',pairMix:0}}));
  assert.ok(applyMovingPresence(input).some(l=>l.power>.03),`${composition}/${count}`);
  assert.ok(applyMovingPresence(input.map(l=>({...l,movingPresenceBasePower:0}))).every(l=>l.power===0));
  assert.ok(applyMovingPresence(input.map(l=>({...l,movingShutter:0}))).every(l=>l.power===0));
 }
});
test('question-answer hands over softly and frames keep a quieter perimeter',()=>{
 const at=(composition,p)=>Array.from({length:12},(_,i)=>groupComposition({composition,progress:p,amount:1},i,12));
 const early=at('question-answer',.25),late=at('question-answer',.75);
 assert.ok(early[0].level>early[11].level);assert.ok(late[0].level<late[11].level);
 assert.ok(at('frame-center',.4)[0].level<at('frame-center',.4)[5].level);
 const before=at('question-answer',.49999),after=at('question-answer',.50001);
 assert.ok(before.every((l,i)=>Math.abs(l.level-after[i].level)<.001));
});
test('composition position and membership are continuous across musical handovers',()=>{
 const plan={duration:24,sections:[{start:0,end:24,look:'flow'}],arrangement:{patterns:{phrases:[0,8,16].map((start,i)=>({start,end:start+8,energy:.5+i*.1,tone:.3+i*.15,movement:{driving:.8,character:'rhythmic'}}))}}};
 for(const boundary of [8,16])for(let rank=0;rank<12;rank++){
  const a=groupComposition(automaticGroupMotionAt(plan,boundary-.00001),rank,12,0,6),b=groupComposition(automaticGroupMotionAt(plan,boundary+.00001),rank,12,0,6);
  for(const key of ['x','y','level','weight'])assert.ok(Math.abs(a[key]-b[key])<.001,key);
 }
});

test('intense compositions retain support without changing their lead or exceeding full power',()=>{
 for(const composition of GROUP_COMPOSITIONS){
  const levels=energy=>Array.from({length:12},(_,rank)=>groupComposition({composition,progress:.4,energy,amount:1},rank,12).level);
  const calm=levels(.6),strong=levels(.95);
  assert.ok(strong.reduce((a,b)=>a+b,0)>calm.reduce((a,b)=>a+b,0),composition);
  strong.forEach((v,i)=>{assert.ok(v>=calm[i]&&v<=1);if(calm[i]===1)assert.equal(v,1);});
 }
});

test('group formations retain source motion and give driving music more travel without extra brightness',()=>{
 const room=newRoomPlan(8,6,4),template=scene('question-answer');
 template.lights.forEach(l=>room.positions[l.id]={...l.position,type:'moving',rotation:0,motionArea:{x:.2,y:.2,width:.6,depth:.6}});
 const render=(energy,drive,x)=>{
  const s=scene('question-answer');
  s.lights=s.lights.map(l=>({...l,motionUV:{x,y:.5},movingPresence:{...l.movingPresence,groupMotion:{...l.movingPresence.groupMotion,energy,drive}}}));
  return applyRoomPlan(s,room).lights;
 };
 const travel=(energy,drive)=>{const a=render(energy,drive,.25),b=render(energy,drive,.75);return a.reduce((sum,l,i)=>sum+Math.abs(l.target.x-b[i].target.x),0);};
 assert.ok(travel(.4,.1)>0);
 assert.ok(travel(.9,.95)>travel(.4,.1)*2);
 const a=render(.9,.95,.25),b=render(.9,.95,.75);
 assert.deepEqual(a.map(l=>[l.power,l.color]),b.map(l=>[l.power,l.color]));
 assert.ok([...a,...b].every(l=>l.target.x>=-2.4&&l.target.x<=2.4&&l.target.y>=1.2&&l.target.y<=4.8));
});
