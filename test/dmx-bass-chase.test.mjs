import test from 'node:test';
import assert from 'node:assert/strict';
import {bassAttackEvents} from '../public/musical-attention.js';
import {scenePresence} from '../public/dmx-light-scenes.js';
import {movingPresenceAt,movingPresenceLevel,applyMovingPresence} from '../public/dmx-activity.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
const scene={start:0,end:10,index:0,kind:'impact',energy:.9,drive:.9};
const makePlan=()=>({duration:10,sections:[{start:0,end:10,look:'peak',intensity:.9}],arrangement:{bassAttacks:[{time:2.13,strength:.9},{time:2.63,strength:1}],patterns:{phrases:[{start:0,end:10,energy:.9,movement:{driving:.9}}]}}});
const levels=(plan,time,count=7)=>Array.from({length:count},(_,i)=>movingPresenceLevel(scenePresence(scene,plan,time),i,count));
test('bass detector preserves offbeat attacks and rejects steady bass and silence',()=>{
 const values=Array(200).fill(.01);for(const start of [37,69,130])for(let i=start;i<start+4;i++)values[i]=.3;
 const events=bassAttackEvents(values,.02);
 assert.deepEqual(events.map(e=>Number(e.time.toFixed(6))),[.74,1.38,2.6]);
 assert.deepEqual(bassAttackEvents(Array(200).fill(.3),.02),[]);
 assert.deepEqual(bassAttackEvents(Array(200).fill(0),.02),[]);
});
test('measured bass attacks hand over distinct physical heads, including odd rigs',()=>{
 const plan=makePlan();
 for(const count of [1,4,7,12]){
  const first=levels(plan,2.14,count),next=levels(plan,2.64,count);
  if(count>1){assert.ok(first[0]>.8&&first[1]===0);assert.ok(next[0]===0&&next[1]>.8);}
  for(let t=2.13;t<2.55;t+=.005)assert.ok(Math.max(...levels(plan,t,count))>.3,'no accidental whole-rig darkness');
 }
 assert.notEqual(scenePresence(scene,plan,2.12).mask,'bass-chase','no anticipation');
 assert.notEqual(scenePresence(scene,plan,3.5).mask,'bass-chase','no free-running chase');
 assert.ok(levels(plan,2.24)[1]>.8,'second group enters after delay');
 assert.equal(levels(plan,2.45)[0],0,'first group really switches off');
});
test('bass reactions respect quiet passages, manual rhythm and measured blackouts',()=>{
 const plan=makePlan();
 assert.notEqual(scenePresence({...scene,energy:.4},plan,2.14).mask,'bass-chase');
 for(const rhythm of ['none','bars','strong'])assert.notEqual(scenePresence(scene,{...plan,sectionLighting:[{start:0,end:10,rhythm}]},2.14).mask,'bass-chase');
 plan.arrangement.blackouts=[{start:2,end:3}];
 const presence=movingPresenceAt({movingPlan:plan,songTime:2.14});
 for(let i=0;i<7;i++)assert.equal(movingPresenceLevel(presence,i,7),0);
});
test('stem bass is used when available and seeking is deterministic',()=>{
 const plan=makePlan(),bass=Array(100).fill(.01);bass[34]=.4;
 plan.structure={instruments:{step:.1,bass,drums:Array(100).fill(.2),vocals:Array(100).fill(0),other:Array(100).fill(.02)}};
 assert.notEqual(scenePresence(scene,plan,2.14).mask,'bass-chase');
 const a=levels(plan,3.41);levels(plan,5);assert.deepEqual(levels(plan,3.41),a);
 assert.ok(a.some(v=>v===0)&&a.some(v=>v>.8));
});
test('room expansion preserves true off states instead of interpolating virtual groups',()=>{
 const plan=makePlan(),presence=scenePresence(scene,plan,2.14),room=newRoomPlan(10,10,4);
 for(let i=0;i<7;i++)room.positions['r'+i]={type:'moving',x:i-3,y:8,height:2.5,rotation:0};
 const lights=Array.from({length:4},(_,i)=>({id:'s'+i,type:'moving',position:{x:i-1.5,y:8,height:2.5},target:{x:0,y:1},motionUV:{x:.5,y:.4},power:1,movingPresenceBasePower:1,movingPresence:presence}));
 const expanded=applyRoomPlan({layout:{width:10,depth:10},lights:applyMovingPresence(lights)},room).lights.sort((a,b)=>a.position.x-b.position.x);
 assert.deepEqual(expanded.map(l=>l.power>0),[true,false,true,false,true,false,true]);
});


test('bass switching also reaches energetic automatic choreography',()=>{
 const presence=movingPresenceAt({movingPlan:makePlan(),songTime:2.14,movingMood:'energetic'});
 assert.ok(movingPresenceLevel(presence,0,7)>.8);
 assert.equal(movingPresenceLevel(presence,1,7),0);
});


test('repeated bass figures keep their group identity and weak decorations do not invert it',()=>{
 const plan=makePlan();plan.beatGrid={downbeats:[0,2,4,6,8]};
 plan.arrangement.bassAttacks=[{time:2.13,strength:.9},{time:2.63,strength:1},{time:3,strength:.9},{time:4.13,strength:.9},{time:4.4,strength:.2},{time:4.63,strength:1}];
 assert.deepEqual(levels(plan,2.14),levels(plan,4.14));
 assert.deepEqual(levels(plan,2.64),levels(plan,4.64));
 assert.notEqual(scenePresence(scene,plan,4.41).phase,1,'weak ornament does not advance the group');
});

test('measured bass articulation controls how long the handover lasts',()=>{
 const short=makePlan(),long=makePlan();short.arrangement.bassAttacks[0].duration=.2;long.arrangement.bassAttacks[0].duration=.5;
 assert.ok(scenePresence(scene,short,2.14).duration<scenePresence(scene,long,2.14).duration);
 const notes=Array(100).fill(.01);for(let i=10;i<13;i++)notes[i]=.2;for(let i=40;i<55;i++)notes[i]=.2;
 const events=bassAttackEvents(notes,.02);
 assert.ok(events[0].duration<events[1].duration);
});

test('bass handovers keep mirrored pairs together on even and odd physical rigs',()=>{
 const plan=makePlan();
 for(const count of [4,6,7,8,9,12])for(const time of [2.14,2.24,2.45,2.64]){
  const values=levels(plan,time,count);
  for(let i=0;i<count;i++)assert.equal(values[i],values[count-1-i]);
  assert.ok(values.some(v=>v>.3));
 }
});
test('a strong return after a bass pause reveals the whole formation together',()=>{
 const plan=makePlan();plan.arrangement.bassAttacks.push({time:5,strength:1});
 assert.equal(scenePresence(scene,plan,5.01).mask,'all');
 assert.ok(levels(plan,5.01,8).every(v=>v>.9));
});

test('only an active bass group lets dark members continue their formation',()=>{
 const presence=scenePresence(scene,makePlan(),2.14);
 const rig=Array.from({length:4},(_,i)=>({id:'h'+i,type:'moving',position:{x:i},movingPresence:presence,movingPresenceBasePower:1,power:1}));
 const active=applyMovingPresence(rig);
 assert.ok(active.some(l=>l.power===0&&l.movingGroupActive));
 const blackout=applyMovingPresence(rig.map(l=>({...l,movingPresenceBasePower:0})));
 assert.ok(blackout.every(l=>!l.movingGroupActive&&l.power===0));
 const rest=applyMovingPresence(rig.map(l=>({...l,movingPresence:{...presence,level:0}})));
 assert.ok(rest.every(l=>!l.movingGroupActive&&l.power===0));
});
