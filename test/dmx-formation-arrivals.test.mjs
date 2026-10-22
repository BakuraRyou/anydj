import test from 'node:test';
import assert from 'node:assert/strict';
import {formationAudioTimeline,formationAudioAt,formationArrivalEnvelope} from '../public/dmx-formation-music.js';
import {planFormationScenes,formationSceneStateAt,formationStoryPose,strobeChoreography} from '../public/dmx-strobe-choreography.js';

function fixture(offset=.17){
 const times=Array.from({length:48},(_,i)=>i*.5+offset),plan={duration:24,
  beatGrid:{beats:Array.from({length:48},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10,12,14,16,18,20,22]},
  arrangement:{times,accents:times.map(()=>.9),motionEnvelope:[0,8,16,24].map(time=>({time,energy:.8,tone:.5})),
   patterns:{phrases:[0,8,16].map(start=>({start,end:start+8}))}}};
 const sequences=[['build',0,8],['arrival',8,16],['arrival',16,24]].map(([role,start,end])=>({
  role,start,end,energy:.8,formationId:'open-fan',sharedPassage:{motif:'riff'},
  entrances:times.filter(t=>t>=start&&t<end).map(time=>({time,strength:.9})),phraseArt:{function:'chorus'}}));
 const scenes=planFormationScenes(sequences,plan);
 const at=time=>{const s=sequences.find(s=>time>=s.start&&time<s.end);return {presentation:'strobe',flicker:53,kind:'groove',music:{sequence:{...s,...formationSceneStateAt(s,time),time}}};};
 return {plan,scenes,at};
}
test('spatial accents reach the actual prepared attack within one display frame without anticipation',()=>{
 const {plan}=fixture(),timeline=formationAudioTimeline(plan),time=8.17;
 assert.equal(formationAudioAt(timeline,time-.001).accent<.5,true);
 const isolated={...timeline,roles:{lead:[{time,strength:1}],bass:[],drums:[]}};
 assert.equal(formationAudioAt(isolated,time-.001).accent,0);
 assert.ok(formationAudioAt(isolated,time+1/60).accent>.95);
});
test('an arrival is attached to the exact off-grid source hit and not repeated for each chorus phrase',()=>{
 const {scenes}=fixture();
 const arrivals=scenes.filter(s=>s.formationStory.arrivalCue);
 assert.equal(arrivals.length,1);assert.equal(arrivals[0].formationStory.arrivalCue.time,8.17);
 const shifted=fixture(.29).scenes.find(s=>s.formationStory.arrivalCue);
 assert.equal(shifted.formationStory.arrivalCue.time,8.29);
});
test('the climax opens the picture on its hit without being smeared by the preceding build',()=>{
 const {at}=fixture(),time=8.17,figure=at(time+1/60);
 const levels=Array.from({length:12},(_,rank)=>strobeChoreography(figure,rank,12,1,3).level);
 assert.ok(levels.every(v=>v>.9),'a complete plane must land on the measured hit');
 const story=figure.music.sequence.formationStory;
 assert.equal(formationArrivalEnvelope(story,time-.001),0);
 assert.ok(formationArrivalEnvelope(story,time+1.1)<.04,'arrival emphasis must release instead of staying on throughout the chorus');
});
test('the incoming formation reaches its own moving path promptly at an arrival',()=>{
 const {at}=fixture(),figure=at(8.35),s=figure.music.sequence;
 for(const rank of [0,3,8,11]){
  const result=strobeChoreography(figure,rank,12,1,3),pose=formationStoryPose(s.formationStory,s.time,rank,12,1,3);
  assert.ok(Math.abs(result.x-pose.x)<1e-9&&Math.abs(result.y-pose.y)<1e-9);
 }
});
test('manual rhythm-off and silence retain their explicit control over the new arrival emphasis',()=>{
 const {at}=fixture(),figure=at(8.19),off={...figure,music:{sequence:{...figure.music.sequence,rhythm:'none'}}};
 const without={...off,music:{sequence:{...off.music.sequence,formationStory:{...off.music.sequence.formationStory,arrivalCue:null}}}};
 for(const rank of [0,5,11])assert.equal(strobeChoreography(off,rank,12,1,3).level,strobeChoreography(without,rank,12,1,3).level);
 assert.equal(strobeChoreography({...figure,kind:'silence'},0,12,1,3).level,0);
});
