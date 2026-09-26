import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCues,movingCueAt,musicalMovementEvents} from '../public/dmx-moving-cues.js';
import {lightingScenes,scenePose} from '../public/dmx-light-scenes.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
const song=(tempo=120)=>{
 const beat=60/tempo,duration=64*beat;
 return {duration,beatGrid:{beats:Array.from({length:65},(_,i)=>i*beat),downbeats:Array.from({length:17},(_,i)=>i*4*beat)},sections:[{start:0,end:duration,look:'flow',intensity:.5}],arrangement:{times:Array.from({length:128},(_,i)=>i*beat/2),accents:Array(128).fill(.6),patterns:{phrases:[{start:0,end:duration,energy:.5,tone:.4,movement:{character:'atmospheric',driving:.1}}]}}};
};
test('sustained scenes develop on detected bars while the authored formation stays coordinated',()=>{
 const plan=song(),cues=movingCues(plan,'auto');assert.ok(cues.length>4);
 for(const cue of cues){assert.ok(plan.beatGrid.downbeats.includes(cue.time));assert.deepEqual(movingCueAt(cues,cue.time),cue.pose);const target=scenePose(lightingScenes(plan)[0],cue.time);assert.ok(cue.pose.every((p,i)=>Math.abs(p.pan-target[i].pan)<1e-6&&Math.abs(p.tilt-target[i].tilt)<1e-6));}
 assert.ok(new Set(cues.map(c=>c.pose[0].pan.toFixed(2))).size>4);
});
test('scene timing follows tempo, and preparation uses the exported cue sequence',()=>{
 const a=movingCues(song(100),'auto'),b=movingCues(song(140),'auto');assert.equal(a.length,b.length);
 a.forEach((c,i)=>assert.ok(Math.abs(c.time*100-b[i].time*140)<1e-6));
 const plan=song(),job=movingPlanJob(plan);while(!job.done)job.advance();
 assert.deepEqual(job.result.cues,movingCues(plan,'auto'));
 for(const cue of job.result.cues)assert.deepEqual(movingPlanAt(job.result,cue.time),cue.pose);
});
test('event selection retains exceptional audio timestamps but rejects ordinary repeated hits',()=>{
 const plan=song();plan.arrangement.eventSalience=Array(128).fill(.12);plan.arrangement.eventSalience[23]=.9;
 assert.deepEqual(musicalMovementEvents(plan,plan.beatGrid.downbeats).filter(e=>e.kind==='accent').map(e=>e.time),[5.75]);
 plan.arrangement.eventSalience.fill(.8);assert.ok(musicalMovementEvents(plan,plan.beatGrid.downbeats).every(e=>e.kind!=='accent'));
});

test('ordinary rhythmic arrivals flow through available time without synthetic holds',()=>{
 const plan=song();plan.arrangement.patterns.phrases[0].movement={character:'rhythmic',driving:.8};
 const cues=movingCues(plan,'auto'),flow=cues.filter(c=>c.flowing);
 assert.ok(flow.length>3);
 for(const c of flow){
  const i=cues.indexOf(c);assert.ok(Math.abs(c.travel-(c.time-cues[i-1].time))<1e-8);
  assert.ok(c.headTravel.every(t=>Math.abs(t-c.travel)<1e-8));
  if(!cues[i+1]?.flowing)continue;
  const h=.0001,a=movingCueAt(cues,c.time-h),b=movingCueAt(cues,c.time),d=movingCueAt(cues,c.time+h);
  for(let head=0;head<4;head++)for(const axis of ['pan','tilt']){
   assert.ok(Math.abs((b[head][axis]-a[head][axis])/h-(d[head][axis]-b[head][axis])/h)<.05,'velocity remains continuous');
  }
 }
 const edited={...plan,sectionLighting:[{start:0,end:plan.duration,rhythm:'strong'}]};
 assert.ok(movingCues(edited,'auto').every(c=>!c.flowing),'explicit rhythmic movement keeps its articulation');
});
