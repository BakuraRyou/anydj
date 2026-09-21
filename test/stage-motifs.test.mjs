import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStageMotifs,passageIntensity,stageWashDimming,stageAccentStrength} from '../public/stage-motifs.js';
import {automaticStage} from '../public/dmx-auto.js';
const red={r:255,g:0,b:0,dimming:80,state:true},blue={...red,r:0,b:255};
test('repeated motifs share their first color, distinct and unknown motifs stay separate',()=>{
 const m=prepareStageMotifs({step:1,frames:[red,red,blue,blue,blue],sections:[{start:0,motif:1},{start:2,motif:2},{start:4,motif:1},{start:4}]});
 assert.deepEqual(m[0].color,m[2].color);assert.notDeepEqual(m[0].color,m[1].color);assert.equal(m[3],null);
});
test('repeated chorus starts repeat movement while retaining current song colors',()=>{
 const a={frame:red,weight:1,beat:20,motionBeat:0,look:'peak',motifColor:red};
 const b={...a,frame:blue,beat:60};
 const first=automaticStage([a],4),second=automaticStage([b],4);
 assert.deepEqual(first.frames.flat().map(f=>f.dimming),second.frames.flat().map(f=>f.dimming));
 assert.deepEqual(first.palette[0],[255,0,0]);
 assert.deepEqual(second.palette[0],[0,0,255]);
});
test('quiet passages leave headroom; builds rise without exceeding original brightness',()=>{
 assert.ok(passageIntensity('held')<passageIntensity('flow'));
 assert.ok(passageIntensity('lift',0)<passageIntensity('lift',1));
 for(const look of ['held','flow','lift','peak',undefined]){
  const r=automaticStage([{frame:red,weight:1,beat:0,look,sectionProgress:.5}],4);
  assert.ok(r.frames.flat().every(f=>f.dimming<=80));
 }
assert.equal(passageIntensity(undefined),1);
});
test('calm lighting uses the slow base without accents, preserves limits and supports old shows',()=>{
 const plan={frames:Array.from({length:100},(_,i)=>({...red,dimming:i%2?60:5})),step:.125,
  beatTiming:{minimum:5,maximum:60},arrangement:{step:.125,bases:Array(100).fill(.4)}};
 assert.ok(Math.abs(stageWashDimming(plan,3)-27)<1e-9);
 assert.ok(Math.abs(stageWashDimming(plan,3.1)-27)<1e-9);
 assert.equal(stageWashDimming(null,0),null);
 const old={...plan,arrangement:null};
 assert.ok(stageWashDimming(old,3)>5&&stageWashDimming(old,3)<60);
 const first=stageWashDimming(old,3);stageWashDimming(old,10);
 assert.equal(stageWashDimming(old,3),first);
 assert.ok(Math.abs(stageWashDimming(old,3.001)-first)<.1);
});
test('shared emphasis follows selected musical attacks without anticipating or inventing beats',()=>{
 const plan={arrangement:{times:[.333,1.27],accents:[.55,.11],decays:[.13,.13],patterns:{events:[{kind:'punch'},{kind:'punch'}]}}};
 assert.equal(stageAccentStrength(plan,.332),0);
 assert.equal(stageAccentStrength(plan,.333),1);
 assert.ok(stageAccentStrength(plan,.4)>0&&stageAccentStrength(plan,.4)<1);
 assert.ok(stageAccentStrength(plan,1)<.01);
 assert.ok(Math.abs(stageAccentStrength(plan,1.27)-.2)<1e-9);
 assert.equal(stageAccentStrength(null,.333),0);
 stageAccentStrength(plan,2);
 assert.equal(stageAccentStrength(plan,.333),1);
});
