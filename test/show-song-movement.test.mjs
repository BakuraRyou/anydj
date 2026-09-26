import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {planShowScore,showScorePose} from '../public/show-score.js';
import {movingPresenceAt,applyMovingPresence,movingPresenceLevel} from '../public/dmx-activity.js';
import {showGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
import {applyRoomPlan,wallChoreography} from '../public/dmx-ar-model.js';
import {createRoomMotors} from '../public/dmx-light-geometry.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
function plan(){
 const p={duration:24,sections:[{start:0,end:24,look:'peak',motif:1}],beatGrid:{beats:Array.from({length:48},(_,i)=>i*.5),downbeats:Array.from({length:12},(_,i)=>i*2)},arrangement:{step:.125,bases:Array(192).fill(.5),times:[],accents:[],bassAttacks:Array.from({length:96},(_,i)=>({time:i*.25,strength:.8})),patterns:{phrases:[{start:0,end:24,energy:.8,tone:.5,movement:{driving:.8}}]}}};
 p.songMovement=planSongMovement(p);p.showScore=planShowScore(p);return p;
}
test('show consumes measured movement even without selected flash accents and keeps developing late in a passage',()=>{
 const p=plan(),picture=p.showScore[0];assert.equal(picture.role,'groove');
 assert.ok(picture.movementIntent);
 assert.notDeepEqual(showScorePose(picture,15),showScorePose(picture,19));
 const source={movingPlan:p,movingMood:'show',songTime:10};
 assert.ok(movingPresenceAt(source).groupMotion);
 assert.deepEqual(movingPresenceAt({...source,movingPlan:JSON.parse(JSON.stringify(p))}),movingPresenceAt(source));
 const a=showGroupMotionAt(p,10,picture);showGroupMotionAt(p,20,picture);assert.deepEqual(showGroupMotionAt(p,10,picture),a);
});
test('show group development preserves show occupancy and authored holds and rhythms',()=>{
 const p=plan(),picture=p.showScore[0],motion=showGroupMotionAt(p,10,picture);
 for(let rank=0;rank<8;rank++)assert.equal(groupComposition(motion,rank,8,0,6).level,1);
 assert.equal(showGroupMotionAt(p,10,{...picture,role:'held'}),null);
 assert.equal(showGroupMotionAt(p,10,{...picture,role:'silence'}),null);
 const held={...p,sectionLighting:[{start:8,end:20,movement:0}]};
 assert.deepEqual(showGroupMotionAt(held,9,picture),showGroupMotionAt(held,18,picture));
 const manual={...p,sectionLighting:[{start:0,end:24,rhythm:'pulse'}]};
 assert.ok(!movingPresenceAt({movingPlan:manual,movingMood:'show',songTime:10}).groupMotion);
});
test('show gestures reach audience and wall-enabled stage heads without relighting blackouts',()=>{
 const p=plan(),room=clubStageRoom();
 const frame=(time,power=1)=>({layout:{width:8,depth:6,positions:{}},lights:Array.from({length:8},(_,i)=>({id:'h'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:'show',movingPresence:movingPresenceAt({movingPlan:p,movingMood:'show',songTime:time}),movingPresenceBasePower:power,power,color:'#4488ff'}))});
 const a=applyRoomPlan(frame(8),room).lights.filter(l=>l.type==='moving'),b=applyRoomPlan(frame(11),room).lights.filter(l=>l.type==='moving');
 for(const wall of [false,true])assert.ok(a.some((l,i)=>!!room.positions[l.id].wallTarget===wall&&Math.hypot(l.motionUV.x-b[i].motionUV.x,l.motionUV.y-b[i].motionUV.y)>.01));
 for(const l of [...a,...b]){const mapped=wallChoreography(l,room);assert.ok(Number.isFinite(mapped.target.x)&&Number.isFinite(mapped.target.y));assert.ok(mapped.power>=0&&mapped.power<=1);}
 assert.ok(applyRoomPlan(frame(8,0),room).lights.every(l=>l.power===0));
});

test('show occupancy and action shutters survive spatial group expansion',()=>{
 const p=plan(),motion=showGroupMotionAt(p,10,p.showScore[0]);
 for(const mask of ['show-score','show-action']){
  const presence={level:1,spread:1,mask,occupancy:.5,selection:0,rowFraction:1,groupMotion:motion,action:'launch',progress:.5,amount:1};
  const lights=Array.from({length:16},(_,i)=>({id:'h'+i,type:'moving',position:{x:i%8,y:Math.floor(i/8)*3,height:3},power:1,movingPresenceBasePower:1,movingPresence:presence}));
  const result=applyMovingPresence(lights);
  for(let i=0;i<16;i++)assert.equal(result[i].power,movingPresenceLevel(presence,i%8,8),`${mask}: head ${i}`);
  assert.ok(result.some(l=>l.power===0));assert.ok(result.some(l=>l.power>0));
 }
});
test('unlit show flow keeps its motor phase without additional group choreography',()=>{
 const p=plan();delete p.songMovement;
 p.showScore=[{...p.showScore[0],start:0,end:24,role:'flow'}];
 const presence=movingPresenceAt({movingPlan:p,movingMood:'show',songTime:2});
 // A score can stand alone (legacy plans or no group motion for this passage).
 presence.groupMotion=null;
 assert.equal(presence.trackMotion,true);
 const lit=createRoomMotors(),masked=createRoomMotors(),layout={width:8,depth:6,height:3,room:true};
 for(let i=0;i<240;i++){
  const time=i/60,dark=i>20&&i<180;
  const source={id:'head',type:'moving',position:{x:0,y:3,height:2},target:{x:3*Math.sin(time),y:1,z:1.2},power:1};
  const a=lit(source,layout,time);
  const [input]=applyMovingPresence([{...source,movingPresenceBasePower:dark?0:1,movingPresence:presence}]);
  const b=masked(input,layout,time);
  assert.equal(b.power,dark?0:presence.level);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(a.target[axis]-b.target[axis])<1e-7,`motor ${axis} at ${time}`);
 }
});
test('show holds, silence, manual rhythms and zero-weight layers do not request flow tracking',()=>{
 for(const role of ['held','silence']){
  const p=plan();p.showScore=[{...p.showScore[0],start:0,end:24,role}];
  const presence=movingPresenceAt({movingPlan:p,movingMood:'show',songTime:2});
  assert.equal(presence.trackMotion,false);
 }
 const p=plan();p.sectionLighting=[{start:0,end:24,rhythm:'pulse'}];
 assert.ok(!movingPresenceAt({movingPlan:p,movingMood:'show',songTime:2}).trackMotion);
 const [light]=applyMovingPresence([{id:'h',type:'moving',position:{x:0,y:0},movingPresenceBasePower:0,movingPresence:{layers:[{level:1,mask:'show-score',trackMotion:true,weight:0}]}}]);
 assert.equal(light.movingGroupActive,false);assert.equal(light.power,0);
});
