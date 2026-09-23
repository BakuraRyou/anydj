import test from 'node:test';
import assert from 'node:assert/strict';
import {movingDirections,directedPose} from '../public/dmx-moving-direction.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
const song=(characters=['atmospheric','rhythmic','rhythmic','atmospheric'])=>({
 duration:64,
 sections:characters.map((_,i)=>({start:i*16,end:(i+1)*16,look:['held','lift','peak','held'][i],motif:i===3?0:i})),
 arrangement:{times:Array.from({length:128},(_,i)=>i*.5),accents:Array(128).fill(.6),patterns:{
  events:Array.from({length:128},()=>({kind:'bounce',driving:true})),
  phrases:characters.map((character,i)=>({start:i*16,end:(i+1)*16,section:i,energy:.7,tone:.7,kind:'bounce',movement:{character,driving:1}}))
 }}
});
test('movement motifs are deterministic, song-derived and recalled without mutating the plan',()=>{
 const p=song(),original=structuredClone(p),d=movingDirections(p);
 assert.deepEqual(movingDirections(p),d);assert.deepEqual(p,original);
 assert.deepEqual(d.map(x=>x.shape),['arc','fan','pulse','arc']);
 assert.equal(d[3].recalled,true);
 for(let i=0;i<4;i++)assert.deepEqual(directedPose(d[0],i),directedPose(d[3],i));
 p.arrangement.patterns.phrases[3].tone=.1;
 assert.equal(movingDirections(p)[3].recalled,false);
});
test('instrument balance changes formation; builds open progressively and width is independent of speed',()=>{
 const p=song(),d=movingDirections(p);
 assert.ok(d[0].width>12);assert.ok(d[0].speed<d[2].speed);assert.ok(d[0].spacing>d[2].spacing);
 const width=progress=>Math.abs(directedPose(d[1],0,progress)[0].pan);
 assert.ok(width(0)<width(.5)&&width(.5)<width(1));
 p.arrangement.drama={step:1,intensity:Array(64).fill(.7),percussion:Array(64).fill(.2),vocalShare:Array(64).fill(.8),attacks:Array(64).fill(0)};
 assert.equal(movingDirections(p)[2].shape,'focus');
 p.arrangement.drama.vocalShare.fill(.1);
 assert.equal(movingDirections(p)[2].shape,'cross');
});
test('planned travel reaches acoustic cues, holds between journeys and bounds speed through section changes',()=>{
 const p=song(),cues=movingCues(p,'auto');
 for(let i=1;i<cues.length;i++){
  const cue=cues[i],prev=cues[i-1];
  assert.ok(p.arrangement.times.includes(cue.time));
  assert.deepEqual(movingCueAt(cues,cue.time),cue.pose);
  assert.ok(cue.travel<=cue.time-prev.time+1e-9);
  if(cue.time-cue.travel>prev.time+.01)assert.deepEqual(movingCueAt(cues,(prev.time+cue.time-cue.travel)/2),prev.pose);
 }
 let prev=movingCueAt(cues,0);
 for(let t=.01;t<64;t+=.01){
  const next=movingCueAt(cues,t);
  next.forEach((v,i)=>{
   assert.ok(Math.abs(v.pan)<=42&&v.tilt>=.55&&v.tilt<=1.15);
   assert.ok(Math.abs(v.pan-prev[i].pan)<=70*.01+1e-8);
   assert.ok(Math.abs(v.tilt-prev[i].tilt)<=.8*.01+1e-8);
  });prev=next;
 }
 const quiet=cues.filter(c=>c.time>0&&c.time<16);
 assert.ok(quiet.every(c=>c.travel>=3));assert.ok(quiet.length<=4);
});
test('prepared directions survive forward and backward seeking and leave manual styles intact',()=>{
 const p=song(),job=movingPlanJob(p,'auto');while(!job.done)job.advance();
 const expected=movingPlanAt(job.result,35.125);
 movingPlanAt(job.result,60);movingPlanAt(job.result,3);
 assert.deepEqual(movingPlanAt(job.result,35.125),expected);
 const legacy=structuredClone(p);legacy.arrangement.patterns.phrases.forEach(x=>delete x.movement);
 for(const mode of ['follow','alternate','wash'])assert.deepEqual(movingCues(p,mode),movingCues(legacy,mode));
 for(const mood of ['calm','atmospheric','energetic'])assert.deepEqual(movingCues(p,'auto',mood),movingCues(legacy,'auto',mood));
});
