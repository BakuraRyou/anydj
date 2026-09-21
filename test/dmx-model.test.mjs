import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGE_PATCH,encodeStage,decodeStage} from '../public/dmx-model.js';

test('RGB dimmer and pixel profiles reproduce the same half-bright red',()=>{
  const universe=encodeStage({state:true,r:255,g:0,b:0,dimming:50});
  assert.equal(universe.length,512);
  assert.deepEqual([...universe.slice(0,4)],[128,255,0,0]);
  assert.deepEqual([...universe.slice(16,19)],[128,0,0]);
  for(const fixture of decodeStage(universe))for(const cell of fixture.cells)assert.deepEqual(cell,[128,0,0]);
  assert.ok(universe.slice(40).every(v=>v===0));
});
test('all fixtures turn off for stopped, disabled and zero-brightness frames',()=>{
  for(const frame of [null,{state:false,r:255,dimming:100},{state:true,r:255,g:120,b:30,dimming:0}]){
    for(const fixture of decodeStage(encodeStage(frame)))for(const cell of fixture.cells)assert.deepEqual(cell,[0,0,0]);
  }
});
test('patch addresses do not overlap and RGB segments decode independently',()=>{
  const channels=new Set();
  for(const fixture of STAGE_PATCH)for(let n=fixture.address;n<fixture.address+fixture.channels;n++){
    assert.ok(n>=1&&n<=512);assert.ok(!channels.has(n));channels.add(n);
  }
  const universe=new Uint8Array(512);universe.set([0,255,0],19);
  const bar=decodeStage(universe).at(-1);
  assert.deepEqual(bar.cells[0],[0,0,0]);assert.deepEqual(bar.cells[1],[0,255,0]);assert.deepEqual(bar.cells[2],[0,0,0]);
});
test('invalid values cannot wrap around into unintended channel values',()=>{
  assert.deepEqual([...encodeStage({r:999,g:-20,b:NaN,dimming:200}).slice(0,4)],[255,255,0,0]);
  assert.throws(()=>decodeStage(new Uint8Array(40)),/512/);
});
