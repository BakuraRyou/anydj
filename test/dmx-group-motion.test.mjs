import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUP_MOTIONS,groupMotionOffset,automaticGroupScore,automaticGroupMotionAt,automaticFixtureGroups} from '../public/dmx-group-motion.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
import {largeClubRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
const song=()=>({duration:24,sections:[{start:0,end:24,look:'flow'}],arrangement:{patterns:{phrases:[0,8,16].map((start,i)=>({start,end:start+8,energy:.5+i*.1,tone:.3+i*.15,movement:{character:'rhythmic',driving:.8}}))}}});
function source(time,plan=song()){
 const movingPresence=movingPresenceAt({movingPlan:plan,songTime:time,movingMood:'balanced'});
 return {layout:{width:8,depth:6,positions:{}},lights:Array.from({length:8},(_,i)=>({id:'s'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:'auto',movingPresence,movingPresenceBasePower:.7,power:.7,color:'#00cccc'}))};
}
const heads=scene=>scene.lights.filter(l=>l.type==='moving');
test('ten distinct paths evolve through the second half and have smooth endpoints',()=>{
 const signatures=new Set();
 for(const motion of GROUP_MOTIONS){
  const at=(progress,row=0)=>Array.from({length:12},(_,rank)=>groupMotionOffset({motion,progress,energy:.8,duration:8,amount:1},rank,12,row));
  signatures.add(JSON.stringify([at(.3),at(.7)]));
  assert.notDeepEqual(at(.6),at(.85),motion+' must not plateau halfway');
  assert.notDeepEqual(at(.4),at(.4,1),'answer group has a separate trajectory');
  for(const progress of [0,1])assert.ok(at(progress).every(p=>Math.hypot(p.x,p.y)<1e-10));
  assert.ok(at(.00001).every(p=>Math.hypot(p.x,p.y)<1e-8));
 }
 assert.equal(signatures.size,10);
});
test('group inference is independent of insertion order, supports explicit groups and irregular mounts',()=>{
 const room=largeClubRoom(),fixtures=Object.entries(room.positions).filter(([,p])=>p.type==='moving').map(([id,position])=>({id,position}));
 const groups=automaticFixtureGroups(fixtures);
 assert.equal(new Set([...groups.values()].map(g=>g.row)).size,6);
 assert.ok([...groups.values()].every(g=>g.count===12));
 const reverse=automaticFixtureGroups([...fixtures].reverse());
 for(const [id,g] of groups)assert.deepEqual(reverse.get(id),g);
 const irregular=fixtures.slice(0,24).map((f,i)=>({...f,position:{x:Math.sin(i)*6,y:i*.41,height:2+i%3*.7},...(i<4?{group:'lead'}:{})}));
 const mapped=automaticFixtureGroups(irregular);
 assert.ok(irregular.slice(0,4).every(f=>mapped.get(f.id).group==='user:lead'&&mapped.get(f.id).count===4));
 assert.ok(new Set([...mapped.values()].map(g=>g.row)).size>=3);
 assert.ok([...mapped.values()].every(g=>g.count>=2));
 assert.deepEqual([...automaticFixtureGroups([])],[]);
});
test('musical selection is deterministic, does not animate quiet pads, and respects movement holds',()=>{
 const plan=song(),saved=structuredClone(plan),score=automaticGroupScore(plan);
 assert.ok(new Set(score.map(s=>s.motion)).size>=2);
 assert.deepEqual(score,automaticGroupScore(structuredClone(plan)));assert.deepEqual(plan,saved);
 const held={...plan,sectionLighting:[{start:3,end:7,movement:0}]};
 assert.deepEqual(automaticGroupMotionAt(held,3),automaticGroupMotionAt(held,6.99));
 const quiet=song();quiet.arrangement.patterns.phrases.forEach(p=>{p.energy=.1;p.movement={character:'atmospheric',driving:0};});
 assert.ok(automaticGroupScore(quiet).every(p=>p.motion===null));
});
test('large room retains distinct group paths, bounds, brightness, colors and exact future mapping',()=>{
 const plan=song(),room=largeClubRoom(),scene=source(3,plan),future=source(3.12,plan),saved=structuredClone(scene);
 scene.lights.forEach((l,i)=>l.motionAhead={seconds:.12,target:future.lights[i].target,motionUV:future.lights[i].motionUV,movingPresence:future.lights[i].movingPresence});
 const mapped=heads(applyRoomPlan(scene,room)),predicted=heads(applyRoomPlan(future,room));
 mapped.forEach((l,i)=>assert.deepEqual(l.motionAhead.target,predicted[i].target));
 const later=heads(applyRoomPlan(source(6,plan),room));
 assert.ok(mapped.some((l,i)=>Math.hypot(l.target.x-later[i].target.x,l.target.y-later[i].target.y)>1));
 assert.ok(new Set(mapped.map(l=>(l.target.y-l.position.y).toFixed(2))).size>6,'rows do not copy one target offset');
 assert.ok(mapped.every(l=>l.target.x>=-10&&l.target.x<=10&&l.target.y>=7&&l.target.y<=35));
 assert.ok(mapped.every(l=>l.color==='#00cccc'));
 const unanimated=source(3,plan);unanimated.lights.forEach(l=>l.movingPresence.layers.forEach(p=>delete p.groupMotion));
 const base=heads(applyRoomPlan(unanimated,room));mapped.forEach(l=>assert.ok(l.power>=0&&l.power<=.7,'composition stays within the installed power budget'));
 assert.deepEqual(scene.lights.map(({motionAhead,...l})=>l),saved.lights);
 const frozen=source(3,plan);frozen.lights.forEach(l=>l.motionRange=0);
 const fixed=heads(applyRoomPlan(frozen,room));assert.ok(fixed.every((l,i)=>Math.abs(l.target.x-base[i].target.x)<1e-9&&Math.abs(l.target.y-base[i].target.y)<1e-9));
});
test('final routed room targets evolve smoothly through motor playback',()=>{
 const plan=song(),room=largeClubRoom(),preview=createRoomPreview();let previous=null,travel=0;
 for(let i=0;i<180;i++){
  const lights=heads(preview(source(2+i/60,plan),room,false,i/60));
  if(previous)for(let j=0;j<lights.length;j++)if(lights[j].power>0&&previous[j].power>0){
   const d=Math.hypot(lights[j].target.x-previous[j].target.x,lights[j].target.y-previous[j].target.y);
   assert.ok(d<1,'no discontinuous room-scale jumps');travel+=d;
  }
  previous=lights;
 }
 assert.ok(travel>10,'group motion survives routing and motor constraints');
});
test('active passage handovers preserve position and velocity instead of stopping at the base pose',()=>{
 const plan=song(),eps=.0001;
 const at=(t,rank,row)=>groupMotionOffset(automaticGroupMotionAt(plan,t),rank,12,row);
 for(const boundary of [8,16]){
  let distance=0,speed=0;
  for(let row=0;row<3;row++)for(let rank=0;rank<12;rank++){
   const before=at(boundary-eps,rank,row),center=at(boundary,rank,row),after=at(boundary+eps,rank,row);
   assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<.0001,'no position jump');
   const left={x:(center.x-before.x)/eps,y:(center.y-before.y)/eps};
   const right={x:(after.x-center.x)/eps,y:(after.y-center.y)/eps};
   assert.ok(Math.hypot(left.x-right.x,left.y-right.y)<.0001,'velocity continues across the boundary');
   distance+=Math.hypot(center.x,center.y);speed+=Math.hypot(left.x,left.y);
  }
  assert.ok(distance>.01,'no compulsory return to base');
  assert.ok(speed>.01,'not all groups stop together');
 }
 const snapshot=automaticGroupMotionAt(plan,8.4);automaticGroupMotionAt(plan,20);
 assert.deepEqual(automaticGroupMotionAt(plan,8.4),snapshot,'seeking reproduces the same blend');
});
