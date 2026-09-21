import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLook,cleanStageSettings,resolvedLook,beatPosition,fixtureFrames,mixFixtureFrames} from '../public/dmx-show.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
const red={state:true,r:255,g:0,b:0,dimming:50};
const stream=(extra={})=>({frame:red,weight:1,beat:0,...extra});
const shared=()=>{const c=cleanStageSettings({});c.global=cleanLook({animation:'follow'});return c;};
test('old shared encoding remains identical and design can reproduce it',()=>{
  const old=decodeStage(encodeStage(red)),design=decodeStage(encodeStage(mixFixtureFrames([stream()],shared())));
  assert.deepEqual(design,old);
});
test('fixture, group and section overrides have deterministic priority',()=>{
  const c=shared();c.groups[0]=cleanLook({mode:'ocean'});c.fixtures[0]=cleanLook({mode:'fire'});
  assert.equal(resolvedLook(c,0).mode,'fire');assert.equal(resolvedLook(c,1).mode,'ocean');
  c.sections.verse={global:cleanLook({mode:'ice'}),groups:[],fixtures:[]};
  assert.equal(resolvedLook(c,0,'verse').mode,'ice');
  c.sections.verse.groups[0]=cleanLook({mode:'neon'});assert.equal(resolvedLook(c,0,'verse').mode,'neon');
  c.sections.verse.fixtures[0]=cleanLook({mode:'fixed'});assert.equal(resolvedLook(c,0,'verse').mode,'fixed');
  assert.equal(resolvedLook(c,0,'other').mode,'fire');
});
test('independent fixture palettes and fixed colors encode separately',()=>{
  const c=shared();c.fixtures[0]=cleanLook({mode:'fixed',colors:['#00ff00','#0000ff'],animation:'follow'});
  const lights=decodeStage(encodeStage(mixFixtureFrames([stream()],c)));
  assert.deepEqual(lights[0].cells[0],[0,128,0]);assert.deepEqual(lights[1].cells[0],[128,0,0]);
});
test('playback beat interpolation follows seeking and does not invent a missing grid',()=>{
  assert.equal(beatPosition([1,1.5,2],1.25),.5);assert.equal(beatPosition([1,1.5,2],2.25),2.5);
  assert.equal(beatPosition([1,1.5,2],.2),null);assert.equal(beatPosition([],10),null);assert.equal(beatPosition([1,1.5,2],3),null);
});
test('alternating groups and chase cells respond to beat period and offset',()=>{
  const c=shared();c.global=cleanLook({animation:'alternate',strength:100,period:1});
  let f=fixtureFrames(stream(),c);assert.ok(f[0][0].dimming>f[2][0].dimming);
  f=fixtureFrames(stream({beat:1}),c);assert.ok(f[0][0].dimming<f[2][0].dimming);
  c.global=cleanLook({animation:'chase',strength:100,period:8});
  f=fixtureFrames(stream({beat:3}),c);assert.ok(f[4][3].dimming>f[4][2].dimming);
  c.global.offset=1;f=fixtureFrames(stream({beat:3}),c);assert.ok(f[4][4].dimming>f[4][3].dimming);
});
test('missing rhythm follows original brightness; pause and zero weights are black',()=>{
  const c=shared();c.global.animation='pulse';
  assert.equal(fixtureFrames(stream({beat:null}),c)[0][0].dimming,50);
  for(const streams of [[],[stream({weight:0})],[stream({frame:null})]])assert.ok(encodeStage(mixFixtureFrames(streams,c)).every(v=>v===0));
});
test('crossfade mixes light per device and ignores paused sources',()=>{
  const c=shared(),blue={...red,r:0,b:255,dimming:100};
  const mixed=decodeStage(encodeStage(mixFixtureFrames([stream({weight:.5}),stream({frame:blue,weight:.5})],c)));
  assert.deepEqual(mixed[0].cells[0],[64,0,128]);
  assert.deepEqual(decodeStage(encodeStage(mixFixtureFrames([stream({weight:0}),stream({frame:blue})],c)))[0].cells[0],[0,0,255]);
});
test('quiet automatic sections become sustained and settings survive serialization safely',()=>{
  const c=cleanStageSettings();assert.equal(c.groups[1].mode,'opposite');
  assert.deepEqual(fixtureFrames(stream({look:'held',beat:0}),c),fixtureFrames(stream({look:'held',beat:1}),c));
  assert.deepEqual(cleanStageSettings(JSON.parse(JSON.stringify(c))),c);
  const invalid=cleanStageSettings({global:{brightness:500,offset:-9,colors:['bad'],period:0},members:[99]});
  assert.equal(invalid.global.brightness,100);assert.equal(invalid.global.offset,0);assert.equal(invalid.members[0],0);
});
