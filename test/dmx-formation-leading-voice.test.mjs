import test from 'node:test';
import assert from 'node:assert/strict';
import {formationAudioTimeline,formationAudioAt,formationAudioWindow} from '../public/dmx-formation-music.js';
import {planFormationAction} from '../public/dmx-formation-actions.js';
import {planFormationScenes,formationStoryPose} from '../public/dmx-strobe-choreography.js';

function vocalSong(){
 const duration=16,step=.05,times=Array.from({length:32},(_,i)=>i*.5);
 const vocals=Array.from({length:321},(_,i)=>i%40<5?.3:.12);
 return {duration,beatGrid:{beats:times,downbeats:times.filter((_,i)=>i%4===0)},
  structure:{instruments:{step,vocals,drums:times.flatMap(()=>Array(10).fill(.02)),bass:Array(321).fill(.015),other:Array(321).fill(.025)}},
  arrangement:{times,accents:times.map(()=>.9),motionEnvelope:[{time:0,energy:.6,tone:.4},{time:16,energy:.6,tone:.4}]},
  score:{notes:times.map(start=>({start:start+.12,end:start+.4,confidence:.9}))}};
}
test('a voice-led action follows vocal entrances despite denser percussion and mixed-signal notes',()=>{
 const plan=vocalSong(),timeline=formationAudioTimeline(plan);
 const story={start:0,end:16,arcStart:0,arcEnd:16,motion:'dialogue',shape:'split-foci',
  musicalEvidence:{texture:'voice',energy:.6,movementDrive:.9,voice:.7}};
 const action=planFormationAction(story,plan,timeline);
 assert.ok(timeline.roles.vocals.length>=2);
 assert.equal(action.source,'vocals');assert.equal(action.cueSource,'vocals');
 assert.ok(action.cues.every(c=>timeline.roles.vocals.some(e=>e.time===c.time)));
 const scenes=planFormationScenes([{start:0,end:16,role:'flow',energy:.6,formationId:'split-foci',
  sharedPassage:{motif:'voice',sequence:'exchange'}}],plan);
 assert.equal(scenes[0].formationStory.musicalEvidence.texture,'voice');
 assert.equal(scenes[0].formationStory.action.source,'vocals');
 const empty={...timeline,roles:{...timeline.roles,vocals:[]}};
 assert.equal(planFormationAction(story,plan,empty).source,'melody','missing stem entrances retain the measured-note fallback');
 const bass=planFormationAction({...story,musicalEvidence:{...story.musicalEvidence,texture:'bass'}},plan,timeline);
 assert.notEqual(bass.source,'vocals','a vocal stem cannot take over a bass-led phrase');
});
test('vocal and melodic accents retain exact source timing, causality and transferred audio windows',()=>{
 const timeline=formationAudioTimeline(vocalSong()),cue=timeline.roles.vocals[1];
 const isolated={...timeline,roles:{lead:[],bass:[],drums:[],vocals:[cue],melody:[]}};
 assert.equal(formationAudioAt(isolated,cue.time-.001).vocalAccent,0);
 assert.ok(formationAudioAt(isolated,cue.time+1/60).vocalAccent>.5);
 const time=cue.time+.04,wire=JSON.parse(JSON.stringify(formationAudioWindow(timeline,time)));
 for(const key of ['vocalAccent','melodyAccent'])assert.equal(formationAudioAt(timeline,time)[key],formationAudioAt(wire,time)[key]);
 const story={start:0,end:16,arcStart:0,arcEnd:16,motion:'dialogue',shape:'split-foci',
  knots:[{time:0,position:0},{time:16,position:1}],musicalEvidence:{texture:'voice',energy:.6,movementDrive:.9}};
 story.action=planFormationAction(story,vocalSong(),timeline);
 const a={...story,audioTimeline:{...timeline,roles:{lead:[],drums:[],bass:[],vocals:[cue]}}};
 const b={...a,audioTimeline:{...a.audioTimeline,roles:{lead:[{time,strength:1}],drums:[],bass:[],vocals:[]}}};
 assert.ok(formationStoryPose(a,time,0,16,0,1).exposure>formationStoryPose(b,time,0,16,0,1).exposure,
  'the actual leading layer responds to its voice rather than an unrelated mix hit');
});

function transition({authored=null,arrival=true,build=true,attacks=true}={}){
 const times=attacks?Array.from({length:32},(_,i)=>i*.5+.07):[];
 const plan={duration:16,beatGrid:{beats:Array.from({length:32},(_,i)=>i*.5)},arrangement:{times,accents:times.map(()=>.9),
  motionEnvelope:[{time:0,energy:.3,tone:.4},{time:8,energy:.8,tone:.5},{time:16,energy:.8,tone:.5}]}};
 const sequences=[{start:0,end:8,role:build?'build':'flow',sharedPassage:{motif:'build',sequence:'opening',intent:authored?{anticipation:authored}:{}}},
  {start:8,end:16,role:arrival?'arrival':'flow',sharedPassage:{motif:'chorus',sequence:'exchange',intent:{}}}]
  .map(s=>({...s,formationId:'open-fan',energy:.7,entrances:times.filter(t=>t>=s.start&&t<s.end).map(time=>({time,strength:.9}))}));
 return planFormationScenes(sequences,plan);
}
test('a measured build-to-arrival focuses the final two beats without inventing light attacks',()=>{
 const scenes=transition(),story=scenes[0].formationStory,arrival=scenes[1].formationStory;
 assert.deepEqual(story.anticipation,{start:7,end:8,strength:.65});
 assert.equal(arrival.arrivalCue.time,8.07);assert.equal(story.departure,undefined);
 for(const time of [6.9,7.5,7.95]){
  const p=formationStoryPose(story,time,0,16,0,3),q=formationStoryPose({...story,audioTimeline:story.audioTimeline,anticipation:null},time,0,16,0,3);
  if(time<7)assert.deepEqual(p,q);
  else {assert.ok(Math.abs(p.x-.5)<=Math.abs(q.x-.5));assert.ok(p.exposure>=q.exposure*.75);}
 }
 assert.deepEqual(scenes.map(s=>s.formationStory.action.cues),transition().map(s=>s.formationStory.action.cues));
});
test('authored preparations, missing source attacks and non-build changes keep their authority',()=>{
 const authored={start:5,end:8,strength:.9};
 assert.deepEqual(transition({authored})[0].formationStory.anticipation,authored);
 for(const options of [{arrival:false},{build:false},{attacks:false}])
  assert.equal(transition(options)[0].formationStory.anticipation,undefined);
 const scenes=transition(),wire=JSON.parse(JSON.stringify(scenes[0].formationStory));
 wire.audioFrame=JSON.parse(JSON.stringify(formationAudioWindow(scenes[0].formationStory.audioTimeline,7.5)));
 assert.deepEqual(formationStoryPose(scenes[0].formationStory,7.5,0,16,0,3),formationStoryPose(wire,7.5,0,16,0,3));
});
