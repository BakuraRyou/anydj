import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationStoryProgress,formationStoryPose,FORMATION_NAMES} from '../public/dmx-strobe-choreography.js';
import {formationExpressionAt} from '../public/dmx-formation-variations.js';

function song(energy=()=>.7,phrases=[0]){
 const duration=32,beats=Array.from({length:64},(_,i)=>i*.5);
 const sequence={start:0,end:duration,role:'groove',formationId:'open-fan',energy:.7,
  sharedPassage:{motif:'theme',intent:{motionDrive:.7}},phraseArt:{function:'development'},
  entrances:beats.map(time=>({time,strength:.8,duration:.5}))};
 const plan={beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)},arrangement:{
  motionEnvelope:Array.from({length:129},(_,i)=>({time:i*.25,energy:energy(i*.25),tone:.5})),
  drama:{step:.25,intensity:Array(129).fill(.7),percussion:Array(129).fill(.7),vocalShare:Array(129).fill(.1)},
  patterns:{phrases:phrases.map((start,i)=>({start,end:phrases[i+1]??duration}))}}};
 return {sequence,plan};
}
test('measured phrase boundaries replace the competing regular scene timer',()=>{
 const {sequence,plan}=song(()=>.7,[0,6.3,15.7,24.8]);
 const scenes=planFormationScenes([sequence],plan);
 assert.deepEqual(scenes.map(s=>s.start),[0,6.3,15.7,24.8]);
 assert.ok(scenes.slice(1).every(s=>s.formationStory.act==='interlace'),'constant music does not force a resolve every fourth scene');
});
test('changing the audio contour changes travel timing with identical beats and entrances',()=>{
 const run=energy=>{const {sequence,plan}=song(energy);return planFormationScenes([sequence],plan)[0].formationStory;};
 const rise=run(t=>t<4?.1:.9),fall=run(t=>t<4?.9:.1);
 assert.ok(formationStoryProgress(rise,4)<formationStoryProgress(fall,4)-.2);
 for(const story of [rise,fall]){
  let previous=0;
  for(let t=0;t<8;t+=.02){const p=formationStoryProgress(story,t);assert.ok(p>=previous&&p<=1);previous=p;}
 }
});
test('the audible energy contour changes the live picture breadth without changing its shape or clock',()=>{
 const {sequence,plan}=song(t=>t<4?.05:.95),base=planFormationScenes([sequence],plan)[0].formationStory;
 const story={...base,motion:'suspend',shape:'vertical-curtain',variation:null};
 const quiet=formationStoryPose(story,1,15,16,0,3),loud=formationStoryPose(story,6,15,16,0,3);
 assert.ok(Math.abs(loud.x-.5)>Math.abs(quiet.x-.5)+.1);
 assert.ok(formationExpressionAt(story.expression,1).energy<.1);
 assert.ok(formationExpressionAt(story.expression,6).energy>.9);
});
test('a continuous musical expression survives scene boundaries and manual holds freeze it',()=>{
 const {sequence,plan}=song(t=>.15+t/40),scenes=planFormationScenes([sequence],plan);
 const a=scenes[0].formationStory,b=scenes[1].formationStory;
 assert.equal(a.expression,b.expression);
 assert.deepEqual(formationExpressionAt(a.expression,8),formationExpressionAt(b.expression,8));
 assert.deepEqual(formationStoryPose(b,9,5,16,1,3,true),formationStoryPose(b,14,5,16,1,3,true));
});
test('interweaving preserves visibly different geometries after the complete story renderer',()=>{
 const {sequence,plan}=song(),base=planFormationScenes([sequence],plan)[0].formationStory;
 const trace=shape=>[.2,.5,.8].flatMap(p=>[0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>{
  const c=formationStoryPose({...base,motion:'weave',shape,variation:null},base.start+p*(base.end-base.start),rank,16,row,3);
  return [c.x,c.y,c.beamFocus];
 })));
 const shapes=Object.keys(FORMATION_NAMES),traces=shapes.map(trace);
 assert.equal(new Set(traces.map(v=>JSON.stringify(v))).size,shapes.length);
 const a=trace('radial-wheel'),b=trace('horizontal-sheets');
 assert.ok(a.reduce((sum,c,i)=>sum+Math.hypot(c[0]-b[i][0],c[1]-b[i][1]),0)/a.length>.2);
 for(const trace of traces)for(const point of trace)assert.ok(point.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
});
