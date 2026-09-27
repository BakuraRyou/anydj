import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
function plan(energy,drive,build=false){
 const p={duration:48,sections:[{start:0,end:48,look:'flow'}],beatGrid:{downbeats:Array.from({length:49},(_,i)=>i)},arrangement:{patterns:{phrases:[{start:0,end:48,energy,tone:.5,movement:{driving:drive}}]},...(build?{developments:[{time:1,progress:.1},{time:46,progress:.9}]}:{})}};
 return {...p,songMovement:planSongMovement(p)};
}
test('builds choose a directed opening or lift and keep developing towards the arrival',()=>{
 const p=plan(.6,.7,true),parts=p.songMovement.passages;
 assert.equal(parts.length,1,'a continuous build must not restart halfway');
 assert.ok(['opening-lines','rising-fan'].includes(parts[0].composition));
 for(const composition of ['opening-lines','rising-fan']){
  let previous;
  for(let i=1;i<=100;i++){
   const progress=i/100;
   const motion={...automaticGroupMotionAt(p,24),composition,progress,phase:i*17};
   const left=groupComposition(motion,0,8,1,3),right=groupComposition(motion,7,8,1,3);
   assert.ok(Math.abs(left.x+right.x-1)<1e-9&&left.y===right.y);
   const value=composition==='opening-lines'?right.x-left.x:left.y;
   if(previous!==undefined)assert.ok(value>=previous-1e-9,'no repeated closing or lowering during the build');
   previous=value;
   if(progress>.12)assert.equal(left.weight,1,'do not return to the base pose before arrival');
  }
 }
});
test('intermediate passages keep a shared slow gesture while intense passages retain beat motion',()=>{
 for(const [energy,drive,ordered] of [[.5,.55,true],[.55,.2,true],[.9,.9,false]]){
  const p=plan(energy,drive),part=p.songMovement.passages[0];
  assert.equal(part.coordination,ordered?'ordered':'layered');
  const a=automaticGroupMotionAt(p,3),b=automaticGroupMotionAt(p,6);
  const intrinsic=(b.progress-a.progress)*Math.PI*2;
  if(ordered)assert.ok(Math.abs(b.phase-a.phase-intrinsic)<1e-9);
  else assert.ok(b.phase-a.phase>intrinsic+.5);
  if(ordered)assert.ok(!['depth-wave','crossed-banks','diagonal-sweep'].includes(part.composition));
 }
});
test('ordered fans share orientation across rows and preserve distinct spatial bands',()=>{
 const m={composition:'rotating-fan',coordination:'ordered',intent:{symmetry:'paired'},phase:1,progress:.4,energy:.5};
 const rows=[0,1,2].map(row=>Array.from({length:8},(_,rank)=>groupComposition(m,rank,8,row,3)));
 for(let rank=0;rank<8;rank++){
  assert.equal(rows[0][rank].x,rows[1][rank].x);
  assert.equal(rows[1][rank].x,rows[2][rank].x);
  assert.ok(rows[0][rank].y<rows[1][rank].y&&rows[1][rank].y<rows[2][rank].y);
 }
});
