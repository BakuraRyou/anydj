import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationStoryPose,formationStoryProgress} from '../public/dmx-strobe-choreography.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {strobeMovingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';

function passage(duration=64,role='groove'){
 const beats=Array.from({length:duration*2},(_,i)=>i*.5);
 const sequence={start:0,end:duration,role,formationId:'open-fan',energy:.7,
  sharedPassage:{motif:'riff',intent:{motionDrive:.7}},phraseArt:{function:'development'},
  entrances:beats.map(time=>({time,strength:.8,duration:.5}))};
 return {sequence,plan:{beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)}}};
}

test('acoustic waypoints preserve nonzero continuous velocity instead of stopping the full clock',()=>{
 const {sequence,plan}=passage();
 const story=planFormationScenes([sequence],plan)[0].formationStory,dt=.0001;
 for(const knot of story.knots.slice(1,-1)){
  const left=(formationStoryProgress(story,knot.time)-formationStoryProgress(story,knot.time-dt))/dt;
  const right=(formationStoryProgress(story,knot.time+dt)-formationStoryProgress(story,knot.time))/dt;
  assert.ok(left>.05&&right>.05,'moving music must not stop at an acoustic anchor');
  assert.ok(Math.abs(left-right)<.001,'both sides share one velocity');
 }
 let previous=0;
 for(let t=0;t<=8;t+=.001){const value=formationStoryProgress(story,t);assert.ok(value>=previous-1e-12&&value<=1+1e-12);previous=value;}
});

test('source motor cues carry velocity through connected formation targets',()=>{
 const cues=strobeMovingCues(varietySong());let checked=0;
 for(let i=2;i<cues.length-1&&checked<20;i++){
  const [a,b,c]=[cues[i-1],cues[i],cues[i+1]];
  if(!a.continuous||!b.continuous||!c.continuous)continue;
  for(let head=0;head<4;head++)for(const key of ['pan','tilt']){
   const left=(b.pose[head][key]-a.pose[head][key])/(b.time-a.time);
   const right=(c.pose[head][key]-b.pose[head][key])/(c.time-b.time);
   if(left*right<=0||Math.min(Math.abs(left),Math.abs(right))<.01)continue;
   const dt=Math.min(.0001,(b.time-a.time)/100,(c.time-b.time)/100);
   const speed=(movingCueAt(cues,b.time+dt)[head][key]-movingCueAt(cues,b.time-dt)[head][key])/(2*dt);
   assert.ok(Math.abs(speed)>Math.min(Math.abs(left),Math.abs(right))*.2,'a waypoint must not become an isolated stop');checked++;
  }
 }
 assert.ok(checked>=10,'exercise several genuinely moving source targets');
});

test('phrase handovers and their completion join continuous target velocities',()=>{
 const plan=varietySong(),dt=.0001;
 const at=(t,rank,row)=>strobeComposition(strobeScoreAt(plan,t),rank,16,row,3);
 let checked=0;
 for(const boundary of [8,16,24,32,40,48,56])for(const time of [boundary,boundary+.9])
 for(const row of [0,1,2])for(const rank of [2,5,10,13])for(const key of ['x','y']){
  const a=at(time-2*dt,rank,row),b=at(time-dt,rank,row),c=at(time+dt,rank,row),d=at(time+2*dt,rank,row);
  const left=(b[key]-a[key])/dt,right=(d[key]-c[key])/dt;
  if(Math.min(a[key],b[key],c[key],d[key])<.02||Math.max(a[key],b[key],c[key],d[key])>.98)continue;
  assert.ok(Math.abs(left-right)<.03,`${time}s, row ${row}, fixture ${rank}, ${key}: ${left} / ${right}`);
  checked++;
 }
 assert.ok(checked>100);
});

test('a long repeated musical theme develops distinct path, gesture and articulation combinations',()=>{
 const {sequence,plan}=passage(512),scenes=planFormationScenes([sequence],plan),stories=scenes.map(s=>s.formationStory);
 const variants=stories.map(s=>s.variation);
 assert.equal(new Set(stories.map(s=>s.theme)).size,1,'variation retains one recognizable musical theme');
 assert.ok(new Set(variants.map(v=>v.key)).size>=48,'a long passage must not repeat a four-scene preset cycle');
 assert.equal(new Set(variants.map(v=>v.path)).size,8);
 assert.equal(new Set(variants.map(v=>v.gesture)).size,8);
 assert.equal(new Set(variants.map(v=>v.articulation)).size,4);
 const traces=stories.map(s=>JSON.stringify([.2,.5,.8].flatMap(p=>[0,1,2].flatMap(row=>[1,5,10,14].map(rank=>{
  const c=formationStoryPose(s,s.start+p*(s.end-s.start),rank,16,row,3);
  return [c.x,c.y,c.exposure].map(v=>Math.round(v*1000));
 })))));
 assert.ok(new Set(traces).size>=60,'variation reaches the visible trajectories, not just recipe identifiers');
 const again=passage(512);assert.deepEqual(planFormationScenes([again.sequence],again.plan).map(s=>s.formationStory),stories,'seeking and rebuilding remain deterministic');
});

test('a continuous build retains its shape, recipe and motor phase across visual sentences',()=>{
 const {sequence,plan}=passage(64,'build'),stories=planFormationScenes([sequence],plan).map(s=>s.formationStory);
 assert.ok(stories.length>2);
 assert.equal(new Set(stories.map(s=>s.shape)).size,1);
 assert.equal(new Set(stories.map(s=>s.variation.key)).size,1);
 assert.equal(new Set(stories.map(s=>s.phaseStart)).size,1);
});

test('a resolved active figure continues drifting until the musical handover',()=>{
 const {sequence,plan}=passage(),story=planFormationScenes([sequence],plan)[3].formationStory;
 const a=formationStoryPose(story,story.end-.4,4,16,0,3);
 const b=formationStoryPose(story,story.end-.2,4,16,0,3);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.0001,'closing the figure must not impose another collective hold');
});
