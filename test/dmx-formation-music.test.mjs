import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationStoryPose,formationSceneStateAt,strobeChoreography} from '../public/dmx-strobe-choreography.js';
import {formationAudioTimeline,formationAudioAt} from '../public/dmx-formation-music.js';

function song({duration=32,texture='drums',cuts=[0,8,16,24],energy=()=>.7,stems=true}={}){
 const times=Array.from({length:duration*2},(_,i)=>i*.5+.2).filter(t=>t<duration);
 const size=Math.ceil(duration*10)+1;
 const levels=typeof texture==='function'?texture:()=>texture;
 const values={drums:[.2,.025,.005,.03],bass:[.025,.2,.005,.03],voice:[.025,.03,.25,.025],pad:[.015,.015,.005,.2]};
 const instruments={step:.1,...Object.fromEntries(['drums','bass','vocals','other'].map((name,j)=>[name,Array.from({length:size},(_,i)=>values[levels(i*.1)][j])]))};
 const plan={duration,beatGrid:{beats:times,downbeats:times.filter((_,i)=>i%4===0)},arrangement:{
  times,accents:times.map(()=>.8),eventSources:times.map(()=>'onset'),
  motionEnvelope:Array.from({length:duration*4+1},(_,i)=>({time:i*.25,energy:energy(i*.25),tone:.5})),
  drama:{step:.1,percussion:Array(size).fill(.7),vocalShare:Array(size).fill(.1)},
  patterns:{phrases:cuts.filter(t=>t<duration).map((start,i)=>({start,end:cuts[i+1]??duration}))}},
  ...(stems?{structure:{instruments}}:{})};
 const sequence={start:0,end:duration,role:'groove',formationId:'open-fan',energy:.7,sharedPassage:{motif:'riff',intent:{motionDrive:.7}},
  phraseArt:{function:'development'},entrances:times.map(time=>({time,strength:.8,duration:.5}))};
 return {plan,sequence};
}
const scenes=fixture=>planFormationScenes([fixture.sequence],fixture.plan);
const storyAt=(planned,time)=>planned.find(s=>time>=s.start&&time<s.end).formationStory;
const picture=(story,time)=>[0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>{
 const p=formationStoryPose(story,time,rank,16,row,3);return [p.x,p.y,p.beamFocus,p.exposure];
}));

test('instrument changes alter real pictures even with identical beats, loudness and nominal motif',()=>{
 const drum=song({texture:'drums'}),bass=song({texture:'bass'}),voice=song({texture:'voice'});
 assert.deepEqual(drum.plan.beatGrid,bass.plan.beatGrid);
 const stories=[drum,bass,voice].map(f=>storyAt(scenes(f),12));
 assert.equal(new Set(stories.map(s=>s.musicalEvidence.texture)).size,3);
 assert.equal(new Set(stories.map(s=>s.shape)).size,3);
 assert.equal(new Set(stories.map(s=>JSON.stringify(picture(s,12)))).size,3);
});
test('a repeated analysed figure develops distinct coordinated pictures at musical phrase boundaries',()=>{
 const f=song({duration:64,cuts:Array.from({length:8},(_,i)=>i*8)}),planned=scenes(f);
 assert.equal(planned.length,8);
 assert.ok(new Set(planned.map(s=>s.formationId)).size>=6,'successive phrases use distinct related pictures');
 assert.deepEqual(planned.map(s=>s.start),[0,8,16,24,32,40,48,56]);
 assert.equal(new Set(planned.map(s=>s.formationStory.variation.key)).size,1);
 assert.equal(new Set(planned.map(s=>s.formationStory.direction)).size,1,'sentence count must not alternate the direction');
 assert.notDeepEqual(picture(planned[0].formationStory,2),picture(planned[0].formationStory,5),'the sustained figure still develops with the music');
});
test('unrelated earlier musical pictures cannot displace the matching figure later in the song',()=>{
 const a=song({texture:t=>t<8?'pad':'drums'}),b=song({texture:t=>t<8?'voice':'drums'});
 const x=storyAt(scenes(a),20),y=storyAt(scenes(b),20);
 assert.equal(x.shape,y.shape);assert.equal(x.variation.key,y.variation.key);
 assert.equal(x.musicalEvidence.reason,y.musicalEvidence.reason);
});
test('different musical phrase boundaries can change pictures without restarting the audio-driven journey',()=>{
 const a=song({cuts:[0,8,16,24]}),b=song({cuts:[0,12,24]}),x=scenes(a),y=scenes(b);
 for(const time of [6,9,14,19,26]){
  const p=formationStoryPose(storyAt(x,time),time,4,16,0,3),q=formationStoryPose(storyAt(y,time),time,4,16,0,3);
  assert.equal(p.storyPhase,q.storyPhase,'changing a sentence must not reset the common musical travel');
 }
});
test('shifting a measured bass entrance shifts its visible layer articulation without moving the beat grid',()=>{
 const run=time=>{
  const f=song({stems:false});f.sequence.role='held';f.plan.arrangement.bassAttacks=[{time,strength:1}];
  const planned=scenes(f),at=t=>{
   const story=storyAt(planned,t),timeline=story.audioTimeline;
   const baseline={...story,audioTimeline:{...timeline,roles:{...timeline.roles,bass:[]}}};
   // Compare the source accent against the same developing picture. A held
   // musical role no longer implies a constant exposure for the entire phrase.
   return formationStoryPose(story,t,0,2,0,3).exposure/formationStoryPose(baseline,t,0,2,0,3).exposure;
  };
  return {plan:f.plan,at};
 };
 const a=run(3),b=run(3.17);
 assert.deepEqual(a.plan.beatGrid,b.plan.beatGrid);
 assert.ok(a.at(3.07)>b.at(3.07)+.2);
 assert.ok(b.at(3.24)>a.at(3.24)+.1);
 assert.ok(Math.abs(a.at(3.07)-b.at(3.24))<1e-9);
});
test('a beat grid alone never fabricates layer attacks when the audio measurements contain none',()=>{
 const f=song();f.plan.arrangement.times=[];f.plan.arrangement.accents=[];
 const timeline=formationAudioTimeline(f.plan);
 for(let t=2;t<20;t+=.13){const a=formationAudioAt(timeline,t);assert.equal(a.accent,0);assert.equal(a.drumAccent,0);assert.equal(a.bassAccent,0);}
});
test('uncertain pitch estimates cannot move the show as if they were a reliable melody',()=>{
 const run=(position,confidence)=>{
  const f=song({texture:'pad'});f.plan.score={track:Array.from({length:321},(_,i)=>({time:i*.1,position,confidence,audible:true}))};
  const planned=scenes(f);return picture(storyAt(planned,12),12);
 };
 assert.deepEqual(run(.1,.2),run(.9,.2));
 assert.notDeepEqual(run(.1,.9),run(.9,.9));
});
test('an opening follows the measured rise rather than reaching the same elapsed-scene position',()=>{
 const run=delay=>{
  const f=song({cuts:[0],energy:t=>.2+.6*Math.max(0,Math.min(1,(t-delay)/6))});f.sequence.role='build';
  return scenes(f)[0].formationStory;
 };
 const early=picture(run(2),9),late=picture(run(20),9);
 const lit=p=>p.filter(v=>v[3]>.5).length;
 assert.ok(lit(early)>lit(late)+20,'the actual rise, not a 32-second timer, opens the rig');
});
test('transferred cues retain exact audio-driven room poses without copying the whole-song analysis',()=>{
 const f=song();scenes(f);
 for(const time of [7.9,8,8.4,16.2,23]){
  const state=formationSceneStateAt(f.sequence,time);
  const figure={presentation:'strobe',kind:'groove',flicker:53,music:{sequence:{...f.sequence,...state,time}}};
  const wire=JSON.parse(JSON.stringify(figure)),frame=wire.music.sequence.formationStory;
  assert.equal(frame.audioTimeline,undefined,'full analysis stays at the owning player');
  assert.ok(frame.audioFrame.rows.length<20);
  assert.ok(JSON.stringify(frame.audioFrame).length<20000);
  for(let row=0;row<3;row++)for(let rank=0;rank<16;rank++){
   const a=strobeChoreography(figure,rank,16,row,3),b=strobeChoreography(wire,rank,16,row,3);
   for(const key of ['x','y','level','beamFocus'])assert.ok(Math.abs(a[key]-b[key])<1e-10);
  }
 }
});

test('a measured repeated passage keeps its picture between sentences and retains deterministic seeking',()=>{
 const f=song({duration:64,cuts:[0,16,32,48]}),planned=scenes(f);
 for(const start of [0,16,32,48]){
  const before=storyAt(planned,start+2),after=storyAt(planned,start+14);
  assert.equal(before.shape,after.shape);assert.equal(before.act,after.act);
 }
 const fresh=song({duration:64,cuts:[0,16,32,48]}),replayed=scenes(fresh);
 for(const t of [51,3,33,17,51])assert.deepEqual(picture(storyAt(planned,t),t),picture(storyAt(replayed,t),t));
});
test('a beat grid and steady pad do not rotate through a formation catalogue',()=>{
 const f=song({duration:64,cuts:[0,8,16,24,32,40,48,56],texture:'pad'});
 f.plan.arrangement.times=[];f.plan.arrangement.accents=[];f.sequence.entrances=[];
 const planned=scenes(f);
 assert.equal(new Set(planned.map(s=>s.formationId)).size,1);
 assert.ok(planned.every(s=>s.formationStory.musicalEvidence.phrase==null));
});
