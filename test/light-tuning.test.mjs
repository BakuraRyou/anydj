import test from 'node:test';
import assert from 'node:assert/strict';
import {lightSettings,tuneLightFrame} from '../public/light-tuning.js';
const frame={state:true,r:220,g:70,b:40,dimming:80};
test('neutral controls preserve the prepared light and never mutate it',()=>{assert.deepEqual(tuneLightFrame(frame),frame);assert.equal(tuneLightFrame(null),null);tuneLightFrame(frame,{brightness:30});assert.equal(frame.dimming,80);});
test('brightness dims once and zero switches output off',()=>{assert.equal(tuneLightFrame(frame,{brightness:50}).dimming,40);assert.equal(tuneLightFrame(frame,{brightness:0}).state,false);assert.equal(tuneLightFrame({...frame,state:false}).state,false);});
test('saturation, hue and dynamics have independent bounded effects',()=>{const gray=tuneLightFrame(frame,{saturation:0});assert.equal(gray.r,gray.g);assert.equal(gray.g,gray.b);assert.equal(gray.dimming,80);const rotated=tuneLightFrame({state:true,r:255,g:0,b:0,dimming:100},{hue:120});assert.deepEqual([rotated.r,rotated.g,rotated.b],[0,255,0]);assert.equal(tuneLightFrame(frame,{dynamics:0}).dimming,50);assert.equal(tuneLightFrame({...frame,dimming:0},{dynamics:0}).dimming,0);assert.equal(lightSettings({brightness:NaN,hue:500}).brightness,100);assert.equal(lightSettings({hue:500}).hue,180);});
