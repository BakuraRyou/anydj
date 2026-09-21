import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStageMotifs,passageIntensity} from '../public/stage-motifs.js';
import {automaticStage} from '../public/dmx-auto.js';
const red={r:255,g:0,b:0,dimming:80,state:true},blue={...red,r:0,b:255};
test('repeated motifs share their first color, distinct and unknown motifs stay separate',()=>{
 const m=prepareStageMotifs({step:1,frames:[red,red,blue,blue,blue],sections:[{start:0,motif:1},{start:2,motif:2},{start:4,motif:1},{start:4}]});
 assert.deepEqual(m[0].color,m[2].color);assert.notDeepEqual(m[0].color,m[1].color);assert.equal(m[3],null);
});
test('repeated chorus starts repeat color and movement despite a different absolute beat',()=>{
 const a={frame:red,weight:1,beat:20,motionBeat:0,look:'peak',motifColor:red};
 const b={...a,frame:blue,beat:60};
 assert.deepEqual(automaticStage([a],4).frames,automaticStage([b],4).frames);
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
