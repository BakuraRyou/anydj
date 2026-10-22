import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationSceneStateAt,formationStoryPose,strobeChoreography} from '../public/dmx-strobe-choreography.js';
import {formationArrivalEnvelope,formationBuildProgress} from '../public/dmx-formation-music.js';

function fixture(){
 const times=Array.from({length:48},(_,i)=>i*.5+.07);
 const plan={duration:24,beatGrid:{beats:times.map(t=>t-.07)},arrangement:{times,accents:times.map(()=>.95),eventSources:times.map(()=>'onset'),
  motionEnvelope:[0,4,24].map(time=>({time,energy:time<4?.3:.8,tone:.4}))}};
 const descriptions=[['held','breath',false],['arrival','opening',true],['arrival','wave',false],['arrival','exchange',true],['arrival','exchange',true],['flow','sweep',false]];
 const sequences=descriptions.map(([role,sequence,climax],i)=>({start:i*4,end:(i+1)*4,role,energy:i?.8:.3,
  formationId:'open-fan',sharedPassage:{motif:'riff',sequence,composition:sequence==='opening'?'rising-fan':'parallel-lines',
   intent:{role:i?'impact':'sculpture',staging:{climax},transition:{importance:i===3?.5:0,overlap:1.8},
    ...(i===0?{anticipation:{start:3,end:4,strength:1}}:{})}},
  entrances:times.filter(t=>t>=i*4&&t<(i+1)*4).map(time=>({time,strength:.95}))}));
 const original=JSON.stringify(sequences.map(s=>s.sharedPassage));
 const scenes=planFormationScenes(sequences,plan);
 assert.equal(JSON.stringify(sequences.map(s=>s.sharedPassage)),original);
 const at=time=>{const s=sequences.find(s=>time>=s.start&&time<s.end);return {presentation:'strobe',flicker:53,music:{sequence:{...s,...formationSceneStateAt(s,time),time}}};};
 return {plan,sequences,scenes,at};
}
test('a renewed shared climax inside one continuous impact section lands on its own source hit',()=>{
 const {scenes,at}=fixture();
 assert.deepEqual(scenes.filter(s=>s.formationStory.arrivalCue).map(s=>s.formationStory.arrivalCue.time),[4.07,12.07]);
 const figure=at(12.07+1/60);
 for(let rank=0;rank<16;rank++)assert.ok(strobeChoreography(figure,rank,16,1,3).level>.9,'the renewed climax reaches the complete picture');
 assert.equal(formationArrivalEnvelope(figure.music.sequence.formationStory,12.069),0);
});
test('an impact opening presents the full picture instead of beginning another slow build',()=>{
 const {scenes}=fixture(),impact=scenes.find(s=>s.start===4).formationStory;
 assert.equal(impact.motion,'bloom');
 assert.equal(formationBuildProgress(impact.opening,4.07,0),1);
 const {plan,sequences}=fixture();const build={...sequences[0],role:'build',sharedPassage:{...sequences[0].sharedPassage,sequence:'opening'}};
 const story=planFormationScenes([build],structuredClone(plan))[0].formationStory;
 assert.ok(formationBuildProgress(story.opening,1,0)<.8,'a genuine build must still follow the measured rise');
});
test('authored boundaries survive even when adjacent sections use the same formation and gesture',()=>{
 const {scenes}=fixture();
 assert.ok(scenes.some(s=>s.start===16),'the shared section at 16 seconds cannot disappear under its neighbour');
 assert.equal(scenes.find(s=>s.start===16).formationStory.arrivalCue,undefined,'a sustained climax does not create another arrival');
});
test('shared preparation focuses the outgoing formation before the hit and transfers exactly',()=>{
 const {scenes,at}=fixture(),story=scenes[0].formationStory;
 assert.deepEqual(story.anticipation,{start:3,end:4,strength:1});
 for(const time of [2.9,3.5,3.95]){
  const rank=0,p=formationStoryPose(story,time,rank,16,0,3),without=formationStoryPose({...story,audioTimeline:story.audioTimeline,anticipation:null},time,rank,16,0,3);
  if(time<3)assert.deepEqual(p,without);
  else {assert.ok(Math.abs(p.x-.5)<=Math.abs(without.x-.5));assert.ok(p.exposure<=without.exposure);}
  const local=at(time),wire=JSON.parse(JSON.stringify(local));
  for(const key of ['x','y','level'])assert.ok(Math.abs(strobeChoreography(local,rank,16,0,3)[key]-strobeChoreography(wire,rank,16,0,3)[key])<1e-10);
 }
});
test('a contrasting change preserves the shared musical overlap within its phrase length',()=>{
 const {plan,sequences}=fixture();
 const incoming={...sequences[3],role:'flow',sharedPassage:{...sequences[3].sharedPassage,intent:{transition:{importance:.5,overlap:1.8}}}};
 const scenes=planFormationScenes([sequences[2],incoming],structuredClone(plan));
 assert.equal(scenes.find(s=>s.start===12).formationStory.transitionDuration,1);
});
