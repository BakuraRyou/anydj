import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeEndingAt,strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {automaticStage} from '../public/dmx-auto.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {showFrameAt} from '../public/show-plan.js';
import {stageWashDimming} from '../public/stage-motifs.js';
import {planSongMovement} from '../public/song-movement-plan.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';

function song({end=20,silence=8,internal=false}={}){
 const beats=Array.from({length:end*2},(_,i)=>i*.5);
 return {duration:end,step:.125,showProfile:'strobe',frames:Array.from({length:end*8},(_,i)=>({state:true,r:80,g:150,b:255,dimming:i/8<silence?80:0})),
  showScore:[{start:0,end:silence,role:'held',energy:.7,tone:.5},
   {start:silence,end:internal?silence+2:end,role:'silence',energy:0},
   ...(internal?[{start:silence+2,end,role:'arrival',energy:.9,tone:.5}]:[])],
  sections:[{start:0,end,look:'flow'}],beatGrid:{beats},
  arrangement:{times:beats.filter(t=>t<silence),accents:beats.filter(t=>t<silence).map(()=>.8),
   blackouts:[{start:silence,end:internal?silence+2:end}]}};
}
const stream=(plan,time)=>({movingPlan:plan,songTime:time,look:'flow',flicker:53,weight:1,frame:showFrameAt(plan,time),washDimming:stageWashDimming(plan,time)});
const equipment={devices:[{id:'head',type:'moving',cells:1},...Array.from({length:8},(_,i)=>({id:'spot'+i,type:'spot',cells:1}))]};

test('a terminal pause releases the actual last light picture continuously instead of cutting it off',()=>{
 const plan=song(),start=8,previous=strobeScoreAt(plan,start-1e-6);
 const baseline=Array.from({length:12},(_,rank)=>strobeComposition(previous,rank,12));
 assert.ok(baseline.some(p=>p.level>0));
 for(const age of [0,1/60,.3,.9,1.7]){
  const figure=strobeScoreAt(plan,start+age),release=strobeEndingAt(plan,start+age);
  baseline.forEach((p,rank)=>{
   const q=strobeComposition(figure,rank,12);
   assert.equal(q.x,p.x);assert.equal(q.y,p.y,'hold the final geometry through the release');
   assert.ok(Math.abs(q.level-p.level*release.level)<1e-9);
  });
 }
 assert.ok(strobeEndingAt(plan,start+1/60).level>.99);
 assert.equal(strobeEndingAt(plan,start+1.8),null);
 assert.ok(Array.from({length:12},(_,rank)=>strobeComposition(strobeScoreAt(plan,10),rank,12).level).every(v=>v===0));
});

test('moving and fixed fixtures retain their pre-ending brightness basis even when silent source frames are zero',()=>{
 const plan=song(),before=automaticStage([stream(plan,8-1e-6)],2,equipment,'strobe').frames;
 for(const time of [8,8.3,8.9,9.7]){
  const source=stream(plan,time),release=strobeEndingAt(plan,time);
  assert.equal(source.frame.dimming,0);
  const frames=automaticStage([source],2,equipment,'strobe').frames;
  frames.slice(1).flat().forEach((frame,i)=>assert.ok(Math.abs(frame.dimming-before.slice(1).flat()[i].dimming*release.level)<1e-9));
  const now=movingPresenceAt({...source,stageMode:'strobe'}),prior=movingPresenceAt({...stream(plan,8-1e-6),stageMode:'strobe'});
  for(let rank=0;rank<12;rank++)assert.ok(Math.abs(movingPresenceLevel(now,rank,12)-movingPresenceLevel(prior,rank,12)*release.level)<1e-9);
  assert.equal(frames[0][0].dimming,before[0][0].dimming,'moving presence applies the release exactly once');
 }
 assert.ok(automaticStage([stream(plan,10)],2,equipment,'strobe').frames.flat().every(f=>f.dimming===0));
});

test('internal rests, empty openings and explicit off states stay dark',()=>{
 const internal=song({internal:true});
 assert.equal(strobeEndingAt(internal,8.1),null);
 assert.ok(automaticStage([stream(internal,8.1)],2,equipment,'strobe').frames.slice(1).flat().every(f=>f.dimming===0));
 const silence=song();silence.showScore=[{start:0,end:20,role:'silence',energy:0}];
 assert.equal(strobeEndingAt(silence,.1),null);
 const source=stream(song(),8.1);source.frame.state=false;
 assert.ok(automaticStage([source],2,equipment,'strobe').frames.flat().every(f=>f===null));
});

test('disabling beat flicker still allows the final fixed-light release',()=>{
 const plan=song(),render=time=>automaticStage([{...stream(plan,time),flicker:0}],2,equipment,'strobe').frames.slice(1).flat();
 const before=render(8-1e-6),middle=render(8.9);
 middle.forEach((frame,i)=>assert.ok(Math.abs(frame.dimming-before[i].dimming*.5)<1e-9));
 assert.ok(render(10).every(f=>f.dimming===0));
});

test('the release is bounded by file duration and remains deterministic across seeks and transferred scenes',()=>{
 const plan=song({end:8.6});
 assert.ok(strobeEndingAt(plan,8.5).level<.1);
 assert.equal(strobeScoreAt(plan,8.6),null);
 const before=strobeScoreAt(plan,8.2);strobeScoreAt(plan,2);
 assert.deepEqual(strobeScoreAt(plan,8.2),before);
 for(let rank=0;rank<12;rank++)assert.deepEqual(strobeComposition(before,rank,12),strobeComposition(JSON.parse(JSON.stringify(before)),rank,12));
});

test('the recorded dmx-test ending starts a short release rather than lighting its entire silent file tail',()=>{
 // Boundary and file duration from the saved full-song formation report.
 const plan=song({end:216.11102040816326,silence:202.5});
 const release=strobeEndingAt(plan,202.5);
 assert.equal(release.start,202.5);assert.equal(release.end,204.3);
 const before=strobeScoreAt(plan,202.5-1e-6),after=strobeScoreAt(plan,202.5+1/60);
 for(let rank=0;rank<12;rank++){
  const a=strobeComposition(before,rank,12),b=strobeComposition(after,rank,12);
  assert.ok(Math.abs(a.level-b.level)<.001);
 }
 assert.equal(strobeEndingAt(plan,210),null);
 assert.ok(Array.from({length:12},(_,rank)=>strobeComposition(strobeScoreAt(plan,210),rank,12).level).every(v=>v===0));
});

test('the current shared formation director releases its full multi-row picture without changing geometry',()=>{
 const plan=structuredClone(varietySong());delete plan.songMovement;
 plan.sections=[{start:0,end:48,look:'peak',intensity:.7},{start:48,end:64,look:'quiet',intensity:0}];
 plan.frames.forEach((f,i)=>{if(i*.125>=48)f.dimming=0;});
 plan.arrangement.bases=plan.arrangement.bases.map((v,i)=>i*.125>=48?0:v);
 for(const key of ['intensity','percussion'])plan.arrangement.drama[key]=plan.arrangement.drama[key].map((v,i)=>i*.125>=48?0:v);
 plan.arrangement.times=plan.arrangement.times.filter(t=>t<48);
 for(const [key,value]of [['accents',.8],['eventSources','onset'],['decays',.2]])plan.arrangement[key]=plan.arrangement.times.map(()=>value);
 plan.arrangement.motionEnvelope=[{time:0,energy:.7,tone:.5},{time:47.9,energy:.7,tone:.5},{time:48,energy:0,tone:.5},{time:64,energy:0,tone:.5}];
 plan.arrangement.blackouts=[{start:48,end:64}];
 plan.arrangement.patterns.phrases=[{start:0,end:48,energy:.7,tone:.5,movement:{driving:.7}},{start:48,end:64,energy:0,tone:.5,movement:{driving:0}}];
 plan.songMovement=planSongMovement(plan);
 const previous=strobeScoreAt(plan,48-1e-6);
 assert.ok(previous.music.sequence.formationStory?.action);
 for(const time of [48,48.3,48.9,49.7]){
  const figure=strobeScoreAt(plan,time),wire=JSON.parse(JSON.stringify(figure)),release=strobeEndingAt(plan,time);
  for(let row=0;row<3;row++)for(let rank=0;rank<12;rank++){
   const before=strobeComposition(previous,rank,12,row,3),after=strobeComposition(figure,rank,12,row,3);
   assert.equal(after.x,before.x);assert.equal(after.y,before.y);
   assert.ok(Math.abs(after.level-before.level*release.level)<1e-9);
   assert.deepEqual(strobeComposition(wire,rank,12,row,3),after);
  }
 }
});
