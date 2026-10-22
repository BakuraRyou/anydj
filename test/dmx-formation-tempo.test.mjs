import test from 'node:test';
import assert from 'node:assert/strict';
import {formationAudioTimeline,formationAudioAt,formationAudioWindow} from '../public/dmx-formation-music.js';
import {formationStoryPose} from '../public/dmx-strobe-choreography.js';

function track({bpm=140,rhythmic=true,energy=.78,grid=true}={}){
 const duration=24,beat=60/bpm,step=.025;
 const beats=Array.from({length:Math.ceil(duration/beat)},(_,i)=>i*beat);
 // Deliberately sparse prepared cues: the percussion analysis carries the
 // ongoing kick pattern between these editorial events.
 const times=beats.filter((_,i)=>i%4===0).map(t=>t+.03);
 const drums=Array.from({length:duration/step+1},(_,i)=>rhythmic?.002+.25*Math.exp(-((i*step)%beat)/.05):.002);
 const constant=value=>Array(drums.length).fill(value);
 const plan={duration,beatGrid:{beats:grid?beats:[]},arrangement:{times,accents:times.map(()=>.8),eventSources:times.map(()=>'beat'),
  motionEnvelope:[0,duration].map(time=>({time,energy,tone:.4}))},
  structure:{instruments:{step,drums,bass:constant(rhythmic?.08:.002),vocals:constant(.002),other:constant(.08)}}};
 const audioTimeline=formationAudioTimeline(plan);
 const story={start:0,end:duration,arcStart:0,arcEnd:duration,shape:'lattice',motion:'relay',act:'introduce',energy,
  knots:[{time:0,position:0},{time:duration,position:1}],variation:{path:'traverse',gesture:'carry',spread:1},audioTimeline};
 return {plan,audioTimeline,story};
}
function speed(story,start=6,end=10){
 let distance=0,count=0;
 for(const rank of [1,4,7,10,13]){
  let previous=formationStoryPose(story,start,rank,16,1,3);
  for(let time=start+1/60;time<=end;time+=1/60){
   const p=formationStoryPose(story,time,rank,16,1,3);
   distance+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;count++;
  }
 }
 return distance/count*60;
}

test('fast audible percussion drives substantially faster movement than a slow or sustained passage',()=>{
 const fast=track(),slow=track({bpm:70}),pad=track({rhythmic:false});
 const fastSpeed=speed(fast.story),slowSpeed=speed(slow.story),padSpeed=speed(pad.story);
 assert.ok(fastSpeed>.04&&fastSpeed<.12,`techno movement stays visible within a restrained motor budget: ${fastSpeed}`);
 assert.ok(fastSpeed>slowSpeed*1.7,`${fastSpeed} vs slow ${slowSpeed}`);
 assert.ok(fastSpeed>padSpeed*3,`${fastSpeed} vs sustained ${padSpeed}`);
 assert.ok(formationAudioAt(fast.audioTimeline,8).movementDrive>.3);
 assert.equal(formationAudioAt(pad.audioTimeline,8).movementDrive,0,'a grid cannot fabricate audible percussion');
});
test('a completed build retains rhythmic movement instead of parking until the next scene',()=>{
 const {story}=track();story.motion='bloom';story.shape='nested-gates';
 story.opening=[{time:0,position:0},{time:2,position:1},{time:24,position:1}];
 const movement=speed(story,6,10);
 assert.ok(movement>.025&&movement<.09,'the completed opening keeps a restrained rhythmic figure');
 const poses=[6,6.4,6.8,7.2,7.6].map(t=>formationStoryPose(story,t,4,16,1,3));
 assert.ok(poses.some(a=>poses.some(b=>Math.hypot(a.x-b.x,a.y-b.y)>.025)),'the open picture continues moving within its smaller reach');
});
test('sustained music continues developing even when selected source cues disappear for ten seconds',()=>{
 const plan=structuredClone(track({rhythmic:false}).plan);plan.arrangement.times=[];plan.arrangement.accents=[];
 const timeline=formationAudioTimeline(plan),story={...track({rhythmic:false}).story,motion:'suspend',audioTimeline:timeline,shape:'split-foci'};
 const a=formationAudioAt(timeline,5),b=formationAudioAt(timeline,15);
 assert.ok(b.travel-a.travel>1,'a held melody cannot be parked behind a distant selected onset');
 assert.ok(speed(story,5,15)>.015);
 for(let t=5;t<15;t+=.13)assert.equal(formationAudioAt(timeline,t).accent,0,'movement does not add shutter attacks');
});
test('the complete moving fan preserves even ray spacing without clipping individual heads',()=>{
 const {story}=track();story.shape='crossed-fans';
 for(let t=4;t<10;t+=.031){
  const rays=Array.from({length:16},(_,rank)=>formationStoryPose(story,t,rank,16,1,3));
  assert.ok(rays.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
  for(let i=1;i<15;i++){
   assert.ok(Math.abs(rays[i+1].x-2*rays[i].x+rays[i-1].x)<1e-10);
   assert.ok(Math.abs(rays[i+1].y-2*rays[i].y+rays[i-1].y)<1e-10);
  }
 }
});
test('tempo-driven movement preserves exact source accents, seeking and compact transfer',()=>{
 const a=track(),b=track({grid:false});
 for(const t of [8,1.9,13,8]){
  const local=formationAudioAt(a.audioTimeline,t),withoutGrid=formationAudioAt(b.audioTimeline,t);
  for(const key of ['accent','drumAccent','bassAccent'])assert.equal(local[key],withoutGrid[key]);
  const frame=JSON.parse(JSON.stringify(formationAudioWindow(a.audioTimeline,t)));
  assert.equal(formationAudioAt(frame,t).travel,local.travel);
  const wire={...a.story,audioTimeline:undefined,audioFrame:frame};
  for(const rank of [0,3,7,12,15])assert.deepEqual(formationStoryPose(wire,t,rank,16,1,3),formationStoryPose(a.story,t,rank,16,1,3));
 }
});
test('manual holds and musical silence remain authoritative over the movement engine',()=>{
 const {story}=track();
 assert.deepEqual(formationStoryPose(story,5,3,16,1,3,true),formationStoryPose(story,15,3,16,1,3,true));
 for(let t=4;t<12;t+=.17)assert.equal(formationStoryPose({...story,motion:'rest'},t,3,16,1,3).exposure,0);
});

test('light transfers retain the beat while the complete picture sweeps over two bars',()=>{
 const {plan,story}=track();story.shape='vertical-curtain';story.musicalEvidence={movementDrive:.8};
 for(const [index,beat] of plan.beatGrid.beats.entries()){
  if(beat<6||beat>12)continue;
  const pose=formationStoryPose(story,beat,7,15,1,3);
  assert.ok(Math.abs(pose.storyPhase-(index%2))<1e-10,'the light transfer still follows each beat');
  if(index%4===0)assert.ok(Math.abs(pose.x-.5)<1e-10,'the whole rig crosses its centre every four beats');
 }
 const between=formationStoryPose(story,plan.beatGrid.beats[16]+60/140*2,7,15,1,3);
 assert.ok(Math.abs(between.x-.5)>.025&&Math.abs(between.x-.5)<.06,'the two-bar sweep stays visible with a smaller reach');
});
