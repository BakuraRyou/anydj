import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSettings,roomLayout,roomLights} from '../public/dmx-room.js';
test('room dimensions and light reach stay valid for edited or stored values',()=>{
  const room=roomSettings({enabled:true,width:Infinity,depth:3,height:1,reach:60});
  assert.deepEqual(room,{enabled:true,width:8,depth:3,height:2,reach:3});
  assert.equal(roomSettings(null).depth,12);
  assert.equal(roomLayout(room).lightMin,0);
  assert.equal(roomLayout(roomSettings({...room,reach:1})).lightMin,2);
});
test('all fixture types share allowed target area and resize without mutating original show',()=>{
  const source={width:8,depth:6};
  const lights=['moving','spot','bar'].map(type=>({type,position:{x:2,y:3,height:5},target:{x:-4,y:0},color:'rgb(255,0,0)',power:.8}));
  const original=structuredClone(lights),room=roomSettings({enabled:true,width:12,depth:10,height:3,reach:4});
  const output=roomLights(lights,source,room);
  for(const light of output){assert.deepEqual(light.position,{x:3,y:5,height:2.7});assert.deepEqual(light.target,{x:-6,y:6});assert.equal(light.power,.8);}
  assert.deepEqual(lights,original);
  const extremes=roomLights([{position:{x:50,y:-10,height:20},target:{x:50,y:90}}],source,room)[0];
  assert.equal(extremes.target.y,10);assert.equal(extremes.target.x,6);assert.equal(extremes.position.y,0);
});
