import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationStoryPose} from '../public/dmx-strobe-choreography.js';
import {FORMATION_PATHS} from '../public/dmx-formation-variations.js';

function song({duration=64,bpm=120,downbeats=true,voice=.2,percussion=.7}={}){
 const beat=60/bpm,beats=Array.from({length:Math.ceil(duration/beat)},(_,i)=>i*beat);
 const series=value=>Array.from({length:duration},(_,i)=>Array.isArray(value)?value[Math.floor(i/8)]??value.at(-1):value);
 const plan={duration,beatGrid:{beats,...(downbeats?{downbeats:beats.filter((_,i)=>i%4===0)}:{})},
  arrangement:{drama:{step:1,intensity:series(.7),vocalShare:series(voice),percussion:series(percussion)}}};
 const sequence={start:0,end:duration,role:'groove',energy:.7,formationId:'open-fan',
  sharedPassage:{motif:'theme',sequence:'sweep'},phraseArt:{function:'development'},
  entrances:beats.map(time=>({time,strength:.8,duration:beat}))};
 return {plan,sequence};
}

test('paths cover the available fixtures across small, single-row and multi-row rigs',()=>{
 const {plan,sequence}=song({duration:8}),base=planFormationScenes([sequence],plan)[0].formationStory;
 for(const motion of ['relay','dialogue','weave','suspend','bloom','gather'])
 for(const path of FORMATION_PATHS)for(const count of [1,2,3,4,8,16])for(const groups of [1,2,3]){
  const story={...base,motion,variation:{...base.variation,path}};
  // Exclude the deliberate opening fade; the rest of an active line must not
  // disappear because an authored path assumes nonexistent rows or pairs.
  for(let tick=30;tick<800;tick+=13){
   const poses=Array.from({length:groups},(_,row)=>Array.from({length:count},(_,rank)=>formationStoryPose(story,tick/100,rank,count,row,groups))).flat();
   assert.ok(poses.some(p=>p.exposure>.05),`${motion}, ${count} fixtures, ${groups} rows, path ${path}, ${tick/100}s`);
   assert.ok(poses.every(p=>[p.x,p.y,p.exposure].every(v=>Number.isFinite(v)&&v>=0&&v<=1)));
  }
 }
});

test('a one-row travelling line reaches its final fixtures at the end of the sentence',()=>{
 const {plan,sequence}=song({duration:8}),story=planFormationScenes([sequence],plan)[0].formationStory;
 const exposures=time=>Array.from({length:8},(_,rank)=>formationStoryPose(story,time,rank,8).exposure);
 assert.ok(exposures(.3)[0]>.8);
 assert.ok(exposures(7.9)[7]>.5,'the stroke does not leave the installed rig before its phrase ends');
 assert.ok(exposures(7.9)[0]<.1);
});

test('brief changes in vocal share retain a musical line; a clear vocal entrance and exit change it',()=>{
 const {plan,sequence}=song({percussion:.6,voice:[.52,.57,.54,.58,.7,.56,.48,.4]});
 const scenes=planFormationScenes([sequence],plan);
 assert.deepEqual(scenes.map(s=>s.formationStory.motion),['relay','relay','relay','relay','dialogue','dialogue','dialogue','relay']);
});

test('beat-only analyses preserve phrase timing across slow, regular and fast music',()=>{
 for(const bpm of [60,90,120,180]){
  const a=song({bpm}),b=song({bpm,downbeats:false});
  const cuts=({plan,sequence})=>planFormationScenes([sequence],plan).map(s=>[s.start,s.end]);
  assert.deepEqual(cuts(a),cuts(b),`${bpm} BPM without downbeat markers`);
 }
});

test('a long pause later in the beat analysis does not slow earlier musical development',()=>{
 const a=song(),b=song();b.plan.beatGrid.beats.push(200);
 const cuts=({plan,sequence})=>planFormationScenes([sequence],plan).map(s=>[s.start,s.end]);
 assert.deepEqual(cuts(a),cuts(b));
});

test('a faster passage uses its local tempo after a long slow introduction',()=>{
 const slow=song({duration:80,bpm:60}),fast=song({duration:16,bpm:180});
 slow.sequence.role='held';fast.sequence.start=80;fast.sequence.end=96;
 fast.sequence.entrances=fast.sequence.entrances.map(e=>({...e,time:e.time+80}));
 const plan={beatGrid:{beats:[...slow.plan.beatGrid.beats,...fast.plan.beatGrid.beats.map(t=>t+80)],
  downbeats:[...slow.plan.beatGrid.downbeats,...fast.plan.beatGrid.downbeats.map(t=>t+80)]}};
 const scenes=planFormationScenes([slow.sequence,fast.sequence],plan).filter(s=>s.start>=80);
 assert.ok(scenes.length>=2,'a slow introduction must not suppress the faster passage’s phrase development');
});

test('missing or invalid optional timbre data retains finite usable choreography',()=>{
 const {plan,sequence}=song();plan.arrangement.motionEnvelope=[{time:2,energy:NaN,tone:Infinity}];
 const scenes=planFormationScenes([sequence],plan);
 for(const scene of scenes){
  assert.ok(Number.isFinite(scene.formationStory.energy));
  const pose=formationStoryPose(scene.formationStory,(scene.start+scene.end)/2,1,4);
  assert.ok([pose.x,pose.y,pose.exposure].every(Number.isFinite));
 }
});
