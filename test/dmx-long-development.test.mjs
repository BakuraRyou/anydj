import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
function song(cuts=[0,13,31,46,68,91,108,120]){
 const plan={duration:120,sections:[{start:0,end:120,look:'flow',motif:2}],beatGrid:{downbeats:Array.from({length:61},(_,i)=>i*2)},arrangement:{patterns:{phrases:cuts.slice(0,-1).map((start,i)=>({start,end:cuts[i+1],energy:.55,tone:.45,movement:{driving:.55}}))}}};
 return {...plan,songMovement:planSongMovement(plan)};
}
test('a monotonous song develops several related figures at musical boundaries',()=>{
 const plan=song(),parts=plan.songMovement.passages;
 assert.ok(parts.length>=4);
 assert.ok(new Set(parts.map(p=>p.composition)).size>=3);
 const boundaries=[13,31,46,68,91,108];
 assert.equal(parts[0].start,0);assert.equal(parts.at(-1).end,120);
 for(let i=1;i<parts.length;i++){
  assert.equal(parts[i-1].end,parts[i].start);
  assert.ok(boundaries.includes(parts[i].start));
  assert.notEqual(parts[i].composition,parts[i-1].composition);
  assert.ok(parts[i].transition.overlap>=3);
 }
 assert.ok(new Set(parts.map(p=>p.end-p.start)).size>1);
});
test('without phrase changes development is deterministic, seekable and not a fixed bar loop',()=>{
 const plan=song([0,120]),parts=plan.songMovement.passages;
 assert.ok(parts.length>=4);
 assert.ok(new Set(parts.map(p=>(p.end-p.start).toFixed(2))).size>=3);
 const copy=JSON.parse(JSON.stringify(plan)),before=JSON.stringify(plan);
 for(const time of [92,2,63,21,92])assert.deepEqual(automaticGroupMotionAt(plan,time),automaticGroupMotionAt(copy,time));
 assert.equal(JSON.stringify(plan),before);
});
test('development handovers preserve continuous paired geometry and manual motor holds',()=>{
 const plan=song();
 for(const passage of plan.songMovement.passages.slice(1))for(let rank=0;rank<8;rank++){
  const at=t=>groupComposition(automaticGroupMotionAt(plan,t),rank,8,2,6);
  const a=at(passage.start-1e-5),b=at(passage.start+1e-5);
  for(const key of ['x','y','level','weight'])assert.ok(Math.abs(a[key]-b[key])<.001,key);
  for(const time of [passage.start+.5,passage.start+1.5,passage.start+3]){
   const motion=automaticGroupMotionAt(plan,time),left=groupComposition(motion,rank,8,2,6),right=groupComposition(motion,7-rank,8,2,6);
   assert.ok(Math.abs(left.x+right.x-1)<1e-9&&Math.abs(left.y-right.y)<1e-9);
  }
 }
 const held={...plan,sectionLighting:[{start:12,end:70,movement:0}]};
 assert.deepEqual(automaticGroupMotionAt(held,13),automaticGroupMotionAt(held,69));
});
test('row roles exchange reach without changing phase, visibility or breaking symmetry',()=>{
 const motion=automaticGroupMotionAt(song(),8);
 const a={...motion,from:undefined,progress:.2,phase:1},b={...a,progress:.8};
 for(let row=0;row<3;row++){
  const x=groupComposition(a,0,8,row,3),y=groupComposition(b,0,8,row,3);
  assert.equal(x.level,y.level);
  if(row<2)assert.ok(Math.abs(x.x-y.x)>1e-4);
 }
});
test('long silence and authored quiet looks never gain development subdivisions',()=>{
 for(const look of ['quiet','held','break','outro']){
  const p=song([0,120]);delete p.songMovement;p.sections=[{start:0,end:120,look}];
  p.arrangement.patterns.phrases[0].energy=.1;p.arrangement.patterns.phrases[0].movement.driving=0;
  const parts=planSongMovement(p).passages;
  assert.equal(parts.length,1);assert.ok(!parts[0].motion);
 }
});
