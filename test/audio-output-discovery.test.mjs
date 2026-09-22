import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverAudioOutputs} from '../public/dj-performance.js';

test('device discovery keeps permission stream open until all outputs are read',async()=>{
 let active=false,stopped=0;
 const media={getUserMedia:async constraints=>{assert.deepEqual(constraints,{audio:true});active=true;return {getTracks:()=>[{stop(){active=false;stopped++;}}]};},enumerateDevices:async()=>{
  assert.ok(active);return [{kind:'audiooutput',deviceId:'default'},{kind:'audiooutput',deviceId:'headphones'},{kind:'audioinput',deviceId:'microphone'},{kind:'videoinput',deviceId:'camera'}];
 }};
 const result=await discoverAudioOutputs(media,{requestAccess:true});
 assert.deepEqual(result.outputs.map(d=>d.deviceId),['default','headphones']);assert.equal(result.inputs,1);assert.equal(stopped,1);assert.equal(active,false);
});
test('passive refresh never opens the microphone',async()=>{
 const result=await discoverAudioOutputs({getUserMedia(){throw Error('unexpected microphone access');},enumerateDevices:async()=>[{kind:'audiooutput',deviceId:'default'}]});
 assert.equal(result.outputs.length,1);
});
test('capture tracks are closed even when enumeration fails',async()=>{
 let stopped=false;
 await assert.rejects(discoverAudioOutputs({getUserMedia:async()=>({getTracks:()=>[{stop(){stopped=true;}}]}),enumerateDevices:async()=>{throw Error('disconnected');}},{requestAccess:true}),/disconnected/);
 assert.equal(stopped,true);
});
