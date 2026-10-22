import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureParticipation,showFixtureParticipation,fixtureParticipationLevel} from '../public/dmx-participation.js';
import {movingPresenceAt,applyMovingPresence,mixMovingPresence} from '../public/dmx-activity.js';
import {planSongMovement} from '../public/song-movement-plan.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';

test('membership scales to arbitrary rigs, stays bright and transfers without a blackout',()=>{
 for(const count of [1,2,3,4,5,7,8,16,31,72,128])for(const fraction of [.65,.85,1]){
  for(let selection=0;selection<Math.ceil(count/2)+2;selection++)for(const blend of [0,.1,.5,.9,1]){
   const policy={fraction,selection,previous:selection-1,blend};
   const levels=Array.from({length:count},(_,rank)=>fixtureParticipationLevel(policy,rank,count));
   assert.ok(levels.every(v=>v>=0&&v<=1));
   assert.ok(levels.reduce((a,b)=>a+b,0)>=Math.ceil(count/2)-1e-9,`${count} retains at least half the rig`);
   if(fraction===1)assert.ok(levels.every(v=>v===1));
   if(count>2&&count%2===0)levels.forEach((v,i)=>assert.equal(v,levels[count-1-i]));
  }
 }
});

function song(){
 const p={duration:48,sections:[{start:0,end:48,look:'flow',intensity:.6}],beatGrid:{downbeats:Array.from({length:24},(_,i)=>i*2)},arrangement:{times:[],patterns:{phrases:Array.from({length:6},(_,i)=>({start:i*8,end:(i+1)*8,energy:.6,tone:.45,movement:{driving:.6}}))}}};
 p.songMovement=planSongMovement(p);return p;
}
test('Show and Automatic expose different physical members, including a single row and two heads',()=>{
 const plan=song();
 for(const mood of ['balanced','show'])for(const count of [1,2,3,4,8,31,72]){
  const selections=new Set();
  const render=time=>applyMovingPresence(Array.from({length:count},(_,i)=>({id:`h${i}`,type:'moving',position:{x:i,y:0},power:1,movingPresenceBasePower:1,movingPresence:movingPresenceAt({movingPlan:plan,songTime:time,movingMood:mood,stageMode:'auto'})})));
  for(const time of [4,12,20,28,36,44]){
   const frame=render(time),active=frame.filter(l=>l.power>1e-9);
   assert.ok(active.length>=Math.ceil(count/2),`${mood}/${count} remains illuminated`);
   if(count>1)assert.ok(active.length<count,`${mood}/${count} has resting members`);
   selections.add(active.map(l=>l.id).join(','));
   assert.ok(applyMovingPresence(frame.map(l=>({...l,movingPresenceBasePower:0}))).every(l=>l.power===0));
   assert.deepEqual(applyMovingPresence(frame),frame);
  }
  if(count>1)assert.ok(selections.size>1,`${mood}/${count} transfers membership`);
  const before=render(8-1e-5),after=render(8+1e-5);
  before.forEach((l,i)=>assert.ok(Math.abs(l.power-after[i].power)<.001));
  const saved=render(12);render(40);assert.deepEqual(render(12),saved,'seeks use only song time');
 }
});
test('crossfades retain membership layers and manual rhythms and silence keep precedence',()=>{
 const plan=song(),scene={start:0,end:48,index:0,energy:.6};
 const a={level:1,mask:'all',participation:fixtureParticipation(plan,scene,4)};
 const b={level:1,mask:'all',participation:fixtureParticipation(plan,scene,28)};
 for(const weight of [0,.25,.5,.75,1]){
  const presence=mixMovingPresence([{presence:a,weight},{presence:b,weight:1-weight}]);
  const lights=applyMovingPresence(Array.from({length:4},(_,i)=>({id:`h${i}`,type:'moving',position:{x:i},movingPresenceBasePower:.8,movingPresence:presence})));
  assert.ok(lights.reduce((sum,l)=>sum+l.power,0)>=1.6-1e-9);
  assert.ok(lights.every(l=>l.power<=.8));
 }
 for(const mood of ['balanced','show']){
  const manual={...plan,sectionLighting:[{start:0,end:48,rhythm:'pulse'}]};
  const p=movingPresenceAt({movingPlan:manual,songTime:12,movingMood:mood});
  assert.ok((p.layers||[p]).every(l=>!l.participation));
 }
 assert.equal(fixtureParticipationLevel({fraction:.65,selection:0},0,1),1);
});
test('Automatic develops membership within each scene without a second song-wide clock',()=>{
 const p=song(),scene={start:0,end:48,index:0,energy:.6};
 assert.equal(fixtureParticipation(p,scene,4).selection,0);
 assert.equal(fixtureParticipation(p,scene,20).selection,2);
 assert.equal(fixtureParticipation(p,scene,28).selection,3);
 assert.deepEqual(fixtureParticipation(p,{...scene,start:16,index:9},20),{
  fraction:.65,selection:9,previous:undefined,blend:1
 });
 // Dense beats cannot restart selection between authored phrase handovers.
 const dense=structuredClone(p);dense.arrangement.times=Array.from({length:240},(_,i)=>i*.2);
 dense.arrangement.eventSalience=dense.arrangement.times.map(()=>.95);
 for(const time of [4,12,20,28])assert.deepEqual(fixtureParticipation(dense,scene,time),fixtureParticipation(p,scene,time));
});
test('Show retains its picture-local membership and Automatic restores that selection policy',()=>{
 const p=song(),picture={start:16,end:40,index:3,energy:.86,form:'tiers'};
 const show=showFixtureParticipation(p,picture,20);
 assert.deepEqual(show,{fraction:.85,selection:3,previous:undefined,blend:1});
 assert.deepEqual(showFixtureParticipation(p,picture,28),{fraction:.85,selection:4,previous:3,blend:1});
 const automatic=fixtureParticipation(p,picture,20,{start:40,end:48,energy:.95,climax:true});
 assert.deepEqual(automatic,show);
 for(const time of [4,12,20,28,36,44]){
  const presence=movingPresenceAt({movingPlan:p,movingMood:'show',songTime:time});
  for(const layer of presence.layers||[presence])if(layer.participation){
   assert.equal(layer.participation.pattern,undefined);
   assert.ok(layer.participation.fraction>=.65);
  }
 }
});
test('Automatic keeps the current picture illuminated before a stronger entrance',()=>{
 const p=song(),scene={start:0,end:24,index:0,energy:.86,form:'fan'};
 const next={start:24,end:48,energy:.95,climax:true};
 for(const time of [20,23,23.99]){
  const policy=fixtureParticipation(p,scene,time,next);
  assert.equal(policy.fraction,.85,'no anticipatory removal of the active picture');
 }
 const levels=form=>{
  const policy=fixtureParticipation(p,{...scene,energy:.6,form},4);
  return Array.from({length:16},(_,i)=>fixtureParticipationLevel(policy,i,16));
 };
 // Geometry belongs to the movement score, not another membership remapping.
 assert.deepEqual(levels('fan'),levels('tiers'));
 assert.deepEqual(levels('fan'),levels('ribbon'));
 assert.ok(levels('fan').reduce((sum,v)=>sum+v,0)>=8);
 assert.ok(levels('fan').some(v=>v===0));
});
test('builds introduce members smoothly and climax uses the complete rig',()=>{
 const plan=song(),scene={start:0,end:48,index:0,energy:.6,kind:'build'};
 for(const count of [2,3,4,8,31,72]){
  let previous;
  for(let time=0;time<8;time+=.01){
   const policy=fixtureParticipation(plan,scene,time);
   const levels=Array.from({length:count},(_,i)=>fixtureParticipationLevel(policy,i,count));
   if(previous)levels.forEach((v,i)=>assert.ok(Math.abs(v-previous[i])<.01));
   previous=levels;
  }
  const peak=fixtureParticipation(plan,{...scene,climax:true},4);
  assert.ok(Array.from({length:count},(_,i)=>fixtureParticipationLevel(peak,i,count)).every(v=>v===1));
 }
});
test('room expansion reselects the physical rig instead of cloning source shutters',()=>{
 const plan=song();
 for(const mood of ['balanced','show'])for(const count of [2,3,4,8,31,72]){
  const room=newRoomPlan(12,10,4);
  for(let i=0;i<count;i++)room.positions[`room-${i}`]={type:'moving',x:-5+10*i/Math.max(1,count-1),y:8,height:3,rotation:0};
  const render=time=>{
   const presence=movingPresenceAt({movingPlan:plan,songTime:time,movingMood:mood});
   const lights=Array.from({length:4},(_,i)=>({id:`source-${i}`,type:'moving',position:{x:i-1.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:mood==='show'?'show':'auto',movingPresence:presence,movingPresenceBasePower:.8,power:.8,color:'#4488ff'}));
   return applyRoomPlan({layout:{width:12,depth:10,positions:{}},lights,crowd:[]},room).lights;
  };
  const a=render(4),b=render(28);
  assert.equal(a.length,count);
  for(const lights of [a,b]){
   assert.ok(lights.filter(l=>l.power>0).length>=Math.ceil(count/2));
   assert.ok(lights.some(l=>l.power===0));
   assert.ok(lights.every(l=>l.power<=.8));
  }
  const signatures=new Set([4,12,20,28,36,44].map(t=>JSON.stringify(render(t).map(l=>l.power))));
  assert.ok(signatures.size>1);
 }
});
