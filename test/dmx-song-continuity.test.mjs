import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupMotionAt,automaticGroupScore,groupComposition} from '../public/dmx-group-motion.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
function song(duration=8,energies=[.5,.54,.57,.54]){
 const p={duration:duration*energies.length,sections:energies.map((energy,i)=>({start:i*duration,end:(i+1)*duration,look:'flow',motif:1,intensity:energy})),arrangement:{patterns:{phrases:energies.map((energy,i)=>({start:i*duration,end:(i+1)*duration,energy,tone:.45,movement:{driving:.55}}))}}};
 return {...p,songMovement:planSongMovement(p)};
}
test('small consecutive analysis changes carry a figure and exact phase across passage boundaries',()=>{
 const p=song(),score=automaticGroupScore(p);
 assert.equal(score[0].composition,score[1].composition);
 assert.equal(score[1].composition,score[2].composition);
 for(const time of [8,16]){
  const a=automaticGroupMotionAt(p,time-1e-6),b=automaticGroupMotionAt(p,time);
  assert.ok(Math.abs(a.phase-b.phase)<1e-5,'same figure inherits unwrapped phase');
  for(let row=0;row<3;row++)for(let rank=0;rank<8;rank++){
   const left=groupComposition(a,rank,8,row,3),right=groupComposition(b,rank,8,row,3);
   assert.ok(Math.hypot(left.x-right.x,left.y-right.y)<1e-5);
  }
 }
 assert.notEqual(score[3].composition,score[2].composition,'continuity must not suppress longer-term variety');
});
test('an outgoing ordered gesture keeps moving past its original end during the crossfade',()=>{
 const p=song(4,[.5,.58]);
 const a=automaticGroupMotionAt(p,4.7),b=automaticGroupMotionAt(p,4.9);
 assert.ok(a.from&&b.from);
 assert.ok(a.from.progress>1&&b.from.progress>a.from.progress);
 assert.ok(b.from.phase-a.from.phase>.2,'outgoing trajectory must not freeze at progress one');
 const x=groupComposition(a.from,0,8,0,3),y=groupComposition(b.from,0,8,0,3);
 assert.ok(Math.hypot(x.x-y.x,x.y-y.y)>1e-3);
});
test('automatic visibility hands over on the same timeline as the group movement',()=>{
 const p=song(8,[.5,.7]);
 for(const time of [8.1,8.5,9,9.5]){
  const motion=automaticGroupMotionAt(p,time),presence=movingPresenceAt({movingPlan:p,movingMood:'balanced',songTime:time});
  assert.ok(motion.from);
  assert.equal(presence.layers[1].weight,motion.blend);
  assert.equal(presence.layers[0].weight,1-motion.blend);
 }
});
