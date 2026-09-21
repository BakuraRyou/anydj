import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage,automaticPalette,automaticColorCount} from '../public/dmx-auto.js';
const frame={state:true,r:255,g:40,b:0,dimming:60};
const source=(look='peak',more={})=>({frame,weight:1,beat:3,look,...more});
const hues=result=>new Set(result.frames.flat().filter(Boolean).map(f=>[f.r,f.g,f.b].join(',')));
test('color limit is adaptive: calm passages deliberately use one color on every lamp',()=>{
  for(const max of [1,2,3,4]){
    const calm=automaticStage([source('held')],max);
    assert.equal(calm.palette.length,1);assert.equal(hues(calm).size,1);
    const peak=automaticStage([source()],max);assert.equal(hues(peak).size,max);
    assert.equal(peak.palette.length,max);
  }
});
test('a build increases its palette within the chosen ceiling',()=>{
  assert.equal(automaticColorCount(4,'lift',0),1);
  assert.equal(automaticColorCount(4,'lift',.7),3);
  assert.equal(automaticColorCount(4,'lift',1),4);
  assert.equal(automaticColorCount(4,'flow'),2);
});
test('crossfades preserve the palette ceiling and interpolate per color slot',()=>{
  const a=source('held',{weight:.5}),b=source('peak',{weight:.5,frame:{...frame,r:0,g:0,b:255}});
  for(const max of [1,2,3,4]){
    const result=automaticStage([a,b],max);assert.ok(hues(result).size<=max);
    assert.deepEqual(result.palette[0],[128,20,128]);
  }
});
test('animation follows music time and holds steady without beats',()=>{
  const a=automaticStage([source()],4),b=automaticStage([source('peak',{beat:3.5})],4);
  assert.notDeepEqual(a.frames,b.frames);assert.deepEqual(a,automaticStage([source()],4));
  const steady=automaticStage([source('flow',{beat:null})],4);
  assert.ok(steady.frames.flat().every(f=>f.dimming===51));
  assert.ok(a.frames.flat().every(f=>f.dimming<=60));
});
test('pause, disabled sources and zero brightness cannot light up the stage',()=>{
  for(const sources of [[],[source('peak',{weight:0})],[source('peak',{frame:{...frame,state:false}})]])assert.ok(automaticStage(sources,4).frames.flat().every(f=>f===null));
  assert.ok(automaticStage([source('peak',{frame:{...frame,dimming:0}})],4).frames.flat().every(f=>f.dimming===0));
  assert.deepEqual(automaticPalette(frame,1),[[255,40,0]]);
});
