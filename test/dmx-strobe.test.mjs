import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage,STAGE_PRESETS} from '../public/dmx-auto.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
const equipment={devices:[{id:'spot',type:'spot',cells:1},{id:'bar',type:'bar',cells:4},{id:'head',type:'moving',cells:1}]};
const source=(more={})=>({frame:{state:true,r:255,g:20,b:0,dimming:60},weight:1,look:'peak',beat:0,washDimming:70,...more});
const render=(more={})=>automaticStage([source(more)],4,equipment,'strobe');
test('formation preview retains its palette and sustained brightness at the default flicker setting',()=>{
 assert.equal(STAGE_PRESETS.strobe.name,'Formationen');
 for(const beat of [.6,1,1.6,2]){
  const result=render({beat,flicker:53});
  assert.equal(result.palette.length,4);
  assert.equal(result.frames[2][0].dimming,70,'active moving source retains full brightness');
  assert.ok(result.frames[0][0].dimming>0&&result.frames[0][0].dimming<70,'the fixed light carries a separate supporting line');
  assert.ok(result.frames.flat().every(f=>result.palette.some(c=>c.every((v,i)=>v===[f.r,f.g,f.b][i]))));
 }
 assert.notDeepEqual(render({beat:.6,flicker:53}).frames,render({beat:20,flicker:53}).frames,
  'the answering phrase changes the LED line while the moving source stays bright');
});
test('formation preview stays steady without a clock and zero flicker freezes its selection',()=>{
 for(const beat of [.6,1])assert.equal(render({beat,flicker:0}).frames[0][0].dimming,70);
 for(const beat of [null,undefined,NaN])assert.equal(render({beat}).frames[0][0].dimming,70);
});
test('Strobo preserves darkness, inactive sources and empty patches',()=>{
  assert.ok(render({frame:{state:true,r:255,g:0,b:0,dimming:0}}).frames.flat().every(f=>f.dimming===0));
  for(const streams of [[],[source({weight:0})],[source({frame:{state:false}})]])
    assert.ok(automaticStage(streams,2,equipment,'strobe').frames.flat().every(f=>f===null));
  assert.deepEqual(automaticStage([source()],2,{devices:[]},'strobe').frames,[]);
});
test('deck crossfades use one sustained formation and weighted source brightness',()=>{
 const a=source({weight:.75,beat:.6}),b=source({weight:.25,beat:0,washDimming:30});
 const first=automaticStage([a,b],2,equipment,'strobe').frames;
 assert.equal(first[2][0].dimming,60);
 b.beat=200;
 assert.deepEqual(automaticStage([a,b],2,equipment,'strobe').frames,first);
});
