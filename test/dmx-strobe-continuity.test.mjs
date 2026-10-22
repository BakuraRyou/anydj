import test from 'node:test';
import assert from 'node:assert/strict';
import {strobePassages,strobeScore,strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
const scene=(start,end,extra={})=>({start,end,kind:'sweep',energy:.7,drive:.4,direction:1,...extra});
test('adjacent analyses of one motif share a passage despite feature and group changes',()=>{
 const scenes=[scene(0,4,{groupIndex:0}),scene(4,8,{groupIndex:1,energy:.9,direction:-1}),scene(8,12,{kind:'groove',drive:.4})];
 const passages=strobePassages(scenes,{});
 assert.equal(passages.length,1);assert.equal(passages[0].start,0);assert.equal(passages[0].end,12);
 assert.equal(passages[0].direction,1);assert.ok(Math.abs(passages[0].energy-23/30)<1e-9);
});
test('silence and actual motif changes still delimit passages',()=>{
 const passages=strobePassages([scene(0,4,{kind:'sculpture'}),scene(4,5,{kind:'silence'}),scene(5,9,{kind:'sculpture'}),scene(9,16,{kind:'impact',drive:.9})],{});
 assert.equal(passages.length,4);assert.equal(passages[1].silent,true);assert.equal(passages[3].motifId,'crown');
});
const song=()=>({duration:32,sections:[{start:0,end:16,look:'flow'},{start:16,end:32,look:'peak'}],beatGrid:{beats:Array.from({length:65},(_,i)=>i*.5),downbeats:Array.from({length:17},(_,i)=>i*2)},arrangement:{times:[3.3,4.7,7.9,16.1],accents:[.7,.7,.7,.7],patterns:{phrases:Array.from({length:8},(_,i)=>({start:i*4,end:(i+1)*4,energy:i<4?.6:.9,movement:{driving:i<4?.4:.9,character:'rhythmic'}}))},drama:{step:1,intensity:Array(32).fill(.85),percussion:Array(32).fill(.8)}}});
test('internal scene boundaries preserve beat phase, targets and exposure',()=>{
 const plan=song(),score=strobeScore(plan);let checked=0;
 for(let i=1;i<score.length;i++){
  const prev=score[i-1],next=score[i];
  if(prev.scene===next.scene||prev.motifId!==next.motifId)continue;
  assert.equal(prev.rhythmAnchor,next.rhythmAnchor);assert.equal(prev.motionStart,next.motionStart);assert.equal(prev.motionEnd,next.motionEnd);
  const a=strobeScoreAt(plan,next.start-1e-7),b=strobeScoreAt(plan,next.start);
  assert.ok(Math.abs(a.rhythmBeat-b.rhythmBeat)<1e-5);
  for(let rank=0;rank<8;rank++){
   const x=strobeComposition(a,rank,8),y=strobeComposition(b,rank,8);
   assert.ok(Math.hypot(x.x-y.x,x.y-y.y)<1e-5);
   // A shutter-score phrase may deliberately start a different fixture role.
   // Internal analysis boundaries within that same phrase must stay continuous.
   if(a.music.sequence?.index===b.music.sequence?.index)assert.ok(Math.abs(x.level-y.level)<1e-4);
  }
  checked++;
 }
 assert.ok(checked>0);
});
test('new formations begin at the previous target and seeks preserve the transition',()=>{
 const plan=song(),score=strobeScore(plan);let checked=0;
 for(let i=1;i<score.length;i++){
  const next=score[i];if(next.motionStart!==next.start||!next.previousFigure)continue;
  const before=strobeScoreAt(plan,next.start-1e-7),after=strobeScoreAt(plan,next.start);
  for(let rank=0;rank<8;rank++){
   const a=strobeComposition(before,rank,8),b=strobeComposition(after,rank,8);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5);
  }
  const middle=strobeScoreAt(plan,next.start+.3);strobeScoreAt(plan,30);
  assert.deepEqual(strobeScoreAt(plan,next.start+.3),middle);checked++;
 }
 assert.ok(checked>0);
});
