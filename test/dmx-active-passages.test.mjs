import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingScenes} from '../public/dmx-light-scenes.js';
import {movingCues,movingCueAt,movingCueExposure} from '../public/dmx-moving-cues.js';
import {movingPresenceAt,movingPresenceLevel,activityAt} from '../public/dmx-activity.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';

function dance({look='flow',energy=.55,drive=.85,tempo=128,vocals=0}={}){
 const duration=180,bar=4*60/tempo;
 const sections=Array.from({length:3},(_,i)=>({start:i*60,end:(i+1)*60,look,intensity:energy}));
 return {duration,sections,beatGrid:{downbeats:Array.from({length:Math.ceil(duration/bar)},(_,i)=>i*bar)},arrangement:{
  times:[],accents:[],drama:{step:1,intensity:Array(duration).fill(energy),percussion:Array(duration).fill(drive),vocalShare:Array(duration).fill(vocals)},
  patterns:{phrases:sections.map(s=>({...s,energy,tone:.4,movement:{character:'rhythmic',driving:drive}}))}
 }};
}
const levels=(plan,t)=>{
 const source={movingPlan:plan,songTime:t,look:plan.sections.find(s=>t>=s.start&&t<s.end)?.look};
 const presence=movingPresenceAt(source);
 return Array.from({length:7},(_,i)=>movingPresenceLevel(presence,i,7));
};

test('sustained dance passages keep visible movement throughout long sections at different tempos',()=>{
 for(const tempo of [100,128,150])for(const look of ['flow','peak','held']){
  const plan=dance({look,energy:look==='peak'?.9:.5,tempo}),cues=movingCues(plan,'auto');
  const longest=Math.max(...cues.slice(1).map((cue,i)=>cue.time-cues[i].time),plan.duration-cues.at(-1).time);
  // A section may start between downbeats; a held impact gets at most
  // two full bars plus the fraction up to the next actual downbeat.
  assert.ok(longest<=(look==='peak'?3:2)*(4*60/tempo)+.01,`${look}/${tempo}: ${longest}s without an arrival`);
  assert.ok(cues.some(c=>c.reason==='scene-rhythm'));
  for(let time=2;time<plan.duration-1;time+=.25){
   assert.ok(levels(plan,time).some(v=>v>=.4),'continuing music remains visibly lit');
   assert.equal(movingCueExposure(cues,time).level,1,'ordinary rhythmic scene changes do not black out');
  }
  for(const start of [8,38,78,138]){
   const poses=Array.from({length:16},(_,i)=>movingCueAt(cues,start+i));
   assert.ok(new Set(poses.map(p=>p.map(h=>h.pan.toFixed(2)).join(','))).size>=4,'not a stationary image or two-position loop');
   assert.ok(new Set(poses.map(p=>p.map(h=>h.tilt.toFixed(3)).join(','))).size>=4,'movement uses height as well as sideways travel');
  }
  assert.ok(cues.filter(c=>c.reason==='scene-rhythm').every(c=>c.travel<=(c.flowing?3:1.6)&&c.travel>0),'flowing arrivals use bounded gaps; accents retain short travel');
 }
});

test('relative low energy and vocal dominance cannot silence a measured groove',()=>{
 for(const look of ['flow','held','quiet','break','outro']){
  const plan=dance({look,energy:.06,vocals:.8});
  // Simulate a loud preceding passage so the old rest fallback would also dim it.
  plan.sections[0].intensity=.9;plan.arrangement.drama.intensity.fill(.9,0,60);
  assert.ok(lightingScenes(plan).every(s=>s.kind==='groove'||s.kind==='impact'));
  for(const time of [65,90,130,170]){
   assert.ok(levels(plan,time).some(v=>v>=.5));
   assert.deepEqual(activityAt({movingPlan:plan,songTime:time,look},1),[1]);
  }
 }
 const unknown={sections:[{start:0,end:180,look:'break',intensity:.02}]};
 assert.equal(lightingScenes(unknown)[0].kind,'sculpture','uncertain low energy alone is not a blackout');
 assert.ok(levels(unknown,60).some(v=>v>0));
});

test('local phrases recover from a genuine pause inside one long quiet-labelled section',()=>{
 const plan=dance({look:'held'});plan.sections=[{start:0,end:180,look:'held',intensity:.2}];
 plan.arrangement.patterns.phrases=[
  {start:0,end:16,energy:.5,movement:{driving:.8}},
  {start:16,end:20,energy:.02,movement:{driving:0}},
  {start:20,end:180,energy:.5,movement:{driving:.8}}
 ];
 plan.arrangement.drama.intensity.fill(.02,16,20);plan.arrangement.drama.percussion.fill(0,16,20);
 plan.arrangement.blackouts=[{start:16,end:20}];
 assert.deepEqual(lightingScenes(plan).map(s=>[s.start,s.end,s.kind]),[[0,16,'groove'],[16,20,'silence'],[20,180,'groove']]);
 assert.ok(levels(plan,18).every(v=>v===0));
 assert.ok(levels(plan,21).some(v=>v>=.5));
 const cues=movingCues(plan,'auto');
 assert.ok(cues.some(c=>c.time>20&&c.time<24&&c.reason==='scene-rhythm'));
 // Seeking backwards must reproduce exactly the same presence and pose.
 const before={levels:levels(plan,23),pose:movingCueAt(cues,23)};
 levels(plan,150);movingCueAt(cues,150);
 assert.deepEqual({levels:levels(plan,23),pose:movingCueAt(cues,23)},before);
});

test('measured stem withdrawals remain dark and quiet passages do not acquire arbitrary motion',()=>{
 const plan=dance({look:'quiet',energy:.1,drive:.05}),n=1800;
 plan.structure={instruments:{step:.1,drums:Array(n).fill(0),bass:Array(n).fill(0),vocals:Array(n).fill(0),other:Array.from({length:n},(_,i)=>i>=160&&i<240?.001:.2)}};
 assert.ok(lightingScenes(plan).some(s=>s.start===16&&s.end===24&&s.kind==='silence'));
 assert.ok(levels(plan,19).every(v=>v===0));assert.ok(levels(plan,25).some(v=>v>0));
 const cues=movingCues(plan,'auto');
 assert.ok(cues.every(c=>c.reason!=='scene-rhythm'));
 const unknown=dance();delete unknown.beatGrid;
 assert.ok(movingCues(unknown,'auto').every(c=>c.reason!=='scene-rhythm'),'missing beat analysis is not replaced by a timer');
});

test('manual movement holds and rhythm suppression survive preparation of an active song',()=>{
 const plan=dance();plan.sectionLighting=[{start:20,end:40,movement:0,rhythm:'none'}];
 const cues=movingCues(plan,'auto');
 assert.deepEqual(movingCueAt(cues,20),movingCueAt(cues,39.99));
 assert.deepEqual(movingPresenceAt({movingPlan:plan,songTime:21}),movingPresenceAt({movingPlan:plan,songTime:25}));
 assert.ok(cues.some(c=>c.time>40&&c.time<44));
 const job=movingPlanJob(plan);while(!job.done)job.advance();
 assert.equal(job.result.version,38);assert.deepEqual(job.result.cues,cues);
 for(const t of [3,23,53,103,153])assert.deepEqual(movingPlanAt(job.result,t),movingCueAt(cues,t));
});
