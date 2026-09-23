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
 assert.ok(quiet.every(c=>c.travel<=1.5));assert.ok(quiet.length<=1);
});
test('prepared directions survive forward and backward seeking and leave manual styles intact',()=>{
 const p=song(),job=movingPlanJob(p,'auto');while(!job.done)job.advance();
 const expected=movingPlanAt(job.result,35.125);
 movingPlanAt(job.result,60);movingPlanAt(job.result,3);
 assert.deepEqual(movingPlanAt(job.result,35.125),expected);
 const legacy=structuredClone(p);legacy.arrangement.patterns.phrases.forEach(x=>delete x.movement);
 for(const mode of ['follow','alternate','wash'])assert.deepEqual(movingCues(p,mode),movingCues(legacy,mode));
 for(const mood of ['calm','atmospheric','energetic'])assert.ok(movingCues(p,'auto',mood).length<movingCues(legacy,'auto',mood).length);
});


test('moderate unchanged music holds formation across visual phrases in every automatic mood',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='peak');p.arrangement.patterns.phrases.forEach(p=>p.energy=.4);
 const snapshot=structuredClone(p);
 for(const mood of ['balanced','calm','atmospheric','energetic']){
  const cues=movingCues(p,'auto',mood);
  assert.equal(cues.length,2,`${mood}: only the first musical entrance should move`);
  assert.deepEqual(movingCueAt(cues,10),movingCueAt(cues,63));
 }
 assert.deepEqual(p,snapshot);
});
test('a standout hit and a measured timbre change trigger gestures, ordinary accents do not',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='peak');p.arrangement.patterns.phrases.forEach(p=>p.energy=.4);p.arrangement.accents.fill(.4);
 p.arrangement.accents[12]=.7;
 p.arrangement.patterns.phrases.slice(1).forEach(p=>p.tone=.2);
 const cues=movingCues(p,'auto');
 assert.deepEqual(cues.slice(1).map(c=>[c.time,c.reason]),[[.5,'musical-change'],[6,'strong-accent'],[16,'musical-change']]);
 assert.deepEqual(movingCueAt(cues,5),movingCueAt(cues,1));
 assert.deepEqual(movingCueAt(cues,15),movingCueAt(cues,7));
 assert.ok(cues.slice(1).every(c=>c.travel<=.6));
});
test('a build label alone cannot cause repeated gestures; measured rising energy can',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);
 p.sections.forEach(s=>s.look='lift');
 p.beatGrid={downbeats:Array.from({length:32},(_,i)=>i*2)};
 p.arrangement.patterns.events.forEach(e=>e.kind='build');
 assert.equal(movingCues(p,'auto').length,2);
 p.arrangement.drama={step:.5,intensity:Array.from({length:128},(_,i)=>Math.min(.9,.1+i*.025)),percussion:Array(128).fill(.6),vocalShare:Array(128).fill(.1),attacks:Array(128).fill(.1)};
 const cues=movingCues(p,'auto');
 assert.ok(cues.some(c=>c.reason==='build'));
 assert.ok(cues.filter(c=>c.reason==='build').every(c=>p.beatGrid.downbeats.includes(c.time)));
});


test('intense grooves follow actual accents continuously and stop moving through breaks',()=>{
 const p=song(['rhythmic','rhythmic','atmospheric','atmospheric']);
 p.sections[0].look=p.sections[1].look='peak';p.sections[2].look='held';
 const original=structuredClone(p);
 for(const mood of ['balanced','energetic']){
  const cues=movingCues(p,'auto',mood),groove=cues.filter(c=>c.reason==='groove');
  assert.ok(groove.length>=60);
  assert.ok(groove.every(c=>p.arrangement.times.includes(c.time)&&c.time<32));
  for(let i=1;i<groove.length;i++)assert.ok(Math.abs(groove[i].travel-(groove[i].time-groove[i-1].time))<1e-9);
  assert.deepEqual(movingCueAt(cues,37),movingCueAt(cues,45));
 }
 for(const mood of ['calm','atmospheric'])assert.ok(!movingCues(p,'auto',mood).some(c=>c.reason==='groove'));
 assert.deepEqual(p,original);
});
test('groove timing follows irregular audio accents and louder hits change the path',()=>{
 const p=song(['rhythmic','rhythmic','rhythmic','rhythmic']);p.sections.forEach(s=>s.look='peak');
 p.arrangement.times=p.arrangement.times.map((t,i)=>t+(i%2?.09:0));
 const a=movingCues(p,'auto'),changed=structuredClone(p);
 changed.arrangement.accents=changed.arrangement.accents.map((v,i)=>i%3===0?.3:v);
 const b=movingCues(changed,'auto');
 assert.ok(a.filter(c=>c.reason==='groove').every(c=>p.arrangement.times.includes(c.time)));
 assert.ok(a.some((c,i)=>i>1&&Math.abs((c.time-a[i-1].time)-.5)>.05));
 assert.notDeepEqual(a.map(c=>c.pose),b.map(c=>c.pose));
 let previous=movingCueAt(b,0);
 for(let t=.01;t<64;t+=.01){const next=movingCueAt(b,t);next.forEach((v,i)=>{
  assert.ok(Math.abs(v.pan-previous[i].pan)<=.700001);assert.ok(Math.abs(v.tilt-previous[i].tilt)<=.008001);
 });previous=next;}
});
