import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage,STAGE_PRESETS} from '../public/dmx-auto.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
const equipment={devices:[{id:'spot',type:'spot',cells:1},{id:'bar',type:'bar',cells:4},{id:'head',type:'moving',cells:1}]};
const source=(more={})=>({frame:{state:true,r:255,g:20,b:0,dimming:60},weight:1,look:'peak',beat:0,washDimming:70,...more});
const render=(more={})=>automaticStage([source(more)],4,equipment,'strobe');
test('Strobo flashes all fixtures and pixels white twice per absolute beat',()=>{
  assert.equal(STAGE_PRESETS.strobe.name,'Strobo');
  for(const beat of [0,.5,1,1.5,15.5]){
    const result=render({beat,motionBeat:.3});
    assert.deepEqual(result.palette,[[255,255,255]]);
    assert.equal(result.frames.flat().length,6);
    for(const f of result.frames.flat())assert.deepEqual(f,{state:true,r:255,g:255,b:255,dimming:70});
  }
  for(const beat of [.25,.49,.75,.99,-.1]){
    const result=render({beat});
    assert.ok(result.frames.flat().every(f=>f.dimming===0));
    assert.ok(decodeStage(encodeStage(result.frames,equipment),equipment).flatMap(f=>f.cells).flat().every(v=>v===0));
  }
});
test('Strobo respects the flicker ceiling and falls back to steady light without beats',()=>{
  for(const beat of [0,.3])assert.equal(render({beat,flicker:0}).frames[0][0].dimming,70);
  assert.equal(render({beat:.3,flicker:50}).frames[0][0].dimming,35);
  for(const beat of [null,undefined,NaN])assert.equal(render({beat}).frames[0][0].dimming,70);
});
test('Strobo preserves darkness, inactive sources and empty patches',()=>{
  assert.ok(render({frame:{state:true,r:255,g:0,b:0,dimming:0}}).frames.flat().every(f=>f.dimming===0));
  for(const streams of [[],[source({weight:0})],[source({frame:{state:false}})]])
    assert.ok(automaticStage(streams,2,equipment,'strobe').frames.flat().every(f=>f===null));
  assert.deepEqual(automaticStage([source()],2,{devices:[]},'strobe').frames,[]);
});
test('crossfades keep one common flash phase and weighted brightness',()=>{
  const a=source({weight:.75,beat:.3}),b=source({weight:.25,beat:0,washDimming:30});
  assert.ok(automaticStage([a,b],2,equipment,'strobe').frames.flat().every(f=>f.dimming===0));
  a.beat=0;b.beat=.3;
  assert.ok(automaticStage([a,b],2,equipment,'strobe').frames.flat().every(f=>f.dimming===60));
  assert.deepEqual(render({beat:12.3}),render({beat:12.3,motionBeat:0}));
});
