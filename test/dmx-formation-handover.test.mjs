import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationSceneStateAt,formationStoryPose,strobeChoreography} from '../public/dmx-strobe-choreography.js';

function fixture({bassAttacks=[]}={}){
 const times=Array.from({length:80},(_,i)=>i*.25+.03);
 const plan={duration:20,beatGrid:{beats:times.filter((_,i)=>i%2===0)},arrangement:{times,bassAttacks,accents:times.map(()=>.8),
  motionEnvelope:[0,10,20].map(time=>({time,energy:.7,tone:.5})),patterns:{phrases:[{start:0,end:8},{start:8,end:16},{start:16,end:20}]}}};
 const sequences=[[0,10,'breath','box-frame'],[10,12,'sweep','side-columns'],[12,20,'breath','auto-sails-opposed']]
  .map(([start,end,sequence,composition])=>({start,end,role:'flow',energy:.7,formationId:'open-fan',
   sharedPassage:{motif:'same-riff',sequence,composition,coordination:'ordered',intent:{transition:{overlap:1.8}}},
   entrances:times.filter(t=>t>=start&&t<end).map(time=>({time,strength:.8}))}));
 const scenes=planFormationScenes(sequences,plan);
 const at=time=>{const s=sequences.find(s=>time>=s.start&&time<s.end);return {presentation:'strobe',flicker:53,kind:'groove',music:{sequence:{...s,...formationSceneStateAt(s,time),time}}};};
 return {scenes,sequences,at};
}
test('short shared musical gestures cannot be swallowed by a longer same-motif formation scene',()=>{
 const {scenes,sequences}=fixture();
 for(const s of sequences){
  assert.ok(scenes.some(scene=>scene.start===s.start),'shared show boundary must be present');
  assert.ok(s.formationScenes.every(scene=>scene.start>=s.start&&scene.end<=s.end));
 }
 assert.ok(scenes.some(scene=>scene.start===10&&scene.end===12),'the complete short sweep must survive');
});
test('shared transition overlap leaves a short phrase room to develop instead of blending throughout it',()=>{
 const {scenes}=fixture(),sweep=scenes.find(s=>s.start===10);
 assert.equal(sweep.formationStory.transitionDuration,.5);
 const next=scenes.find(s=>s.start===12);
 assert.equal(next.formationStory.transitionDuration,.5,'the outgoing short phrase also limits the overlap');
});
test('measured handovers carry the outgoing live light envelope instead of a frozen boundary snapshot',()=>{
 const {at}=fixture({bassAttacks:[{time:10.13,strength:.9}]});let changing=0;
 for(const time of [10.1,10.2,10.3,10.4]){
 const figure=at(time),s=figure.music.sequence,duration=s.formationStory.transitionDuration;
 const mix=(s.age/duration)**2*(3-2*s.age/duration);
 for(let rank=0;rank<12;rank++){
  const old=formationStoryPose(s.previous.formationStory,s.time,rank,12,0,3);
  const frozen=formationStoryPose(s.previous.formationStory,s.previous.end,rank,12,0,3);
  const incoming=formationStoryPose(s.formationStory,s.time,rank,12,0,3);
  const result=strobeChoreography(figure,rank,12,0,3);
  const expected=Math.sqrt(old.exposure**2*(1-mix)+incoming.exposure**2*mix);
  assert.ok(Math.abs(result.level-expected)<1e-9);
  if(Math.abs(old.exposure-frozen.exposure)>.01)changing++;
 }
 }
 assert.ok(changing>0,'exercise a real musical change during the handover');
});
test('shared musical handovers retain continuous position and velocity at both ends',()=>{
 const {at}=fixture(),dt=.00001;
 for(const time of [10,10.5,12,12.5])for(const rank of [2,5,9])for(const key of ['x','y']){
  const sample=t=>strobeChoreography(at(t),rank,12,0,3)[key];
  assert.ok(Math.abs(sample(time+dt)-sample(time-dt))<.001);
  const left=(sample(time-dt)-sample(time-2*dt))/dt,right=(sample(time+2*dt)-sample(time+dt))/dt;
  assert.ok(Math.abs(left-right)<.02,`${time}: ${key} velocity discontinuity ${left} / ${right}`);
 }
});

test('shared musical gesture types remain authoritative over similar local audio textures',()=>{
 const {scenes}=fixture();
 assert.ok(scenes.filter(s=>s.start<10||s.start>=12).every(s=>s.formationStory.motion==='suspend'),'shared breathing passages retain their restrained gesture');
 const sweep=scenes.find(s=>s.start===10);
 assert.equal(sweep.formationStory.motion,'weave');
 assert.equal(sweep.formationStory.musicalEvidence.sharedSequence,'sweep');
});
