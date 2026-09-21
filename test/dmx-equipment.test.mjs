import test from 'node:test';
import assert from 'node:assert/strict';
import {stageEquipment,stagePatch,encodeStage,decodeStage} from '../public/dmx-model.js';
import {automaticStage} from '../public/dmx-auto.js';
import {cleanStageSettings,mixFixtureFrames} from '../public/dmx-show.js';
const frame={state:true,r:255,g:20,b:0,dimming:80},streams=[{frame,weight:1,beat:0,look:'peak'}];
const rig=()=>stageEquipment({devices:[{id:'a',type:'spot'},{id:'b',type:'bar',cells:12},{id:'c',type:'spot'},{id:'d',type:'bar',cells:3}]});
test('migrates old equipment and supports more than four spots or eight segments',()=>{
 assert.equal(stageEquipment().devices.length,4);
 assert.equal(stageEquipment({type:'bar',segments:3}).devices[0].cells,3);
 assert.equal(stageEquipment({type:'spots',spots:2}).devices.length,2);
 assert.equal(stageEquipment({devices:Array.from({length:10},(_,i)=>({id:String(i),type:'spot'}))}).devices.length,10);
 assert.equal(rig().devices[1].cells,12);
});
test('mixed patch allocates channels without overlaps and clears unused data',()=>{
 const equipment=rig(),patch=stagePatch(equipment);
 assert.deepEqual(patch.map(f=>f.address),[1,5,41,45]);
 for(const output of [frame,automaticStage(streams,4,equipment).frames,mixFixtureFrames(streams,cleanStageSettings(undefined,4),equipment)]){
  const data=encodeStage(output,equipment);assert.ok(data.slice(53).every(v=>v===0));
  assert.deepEqual(decodeStage(data,equipment).map(f=>f.cells.length),[1,12,1,3]);
 }
});
test('empty stage stays dark and has no invented palette',()=>{
 const equipment=stageEquipment({devices:[]});assert.deepEqual(automaticStage(streams,4,equipment).palette,[]);
 assert.ok(encodeStage(frame,equipment).every(v=>v===0));assert.deepEqual(mixFixtureFrames(streams,cleanStageSettings({},0),equipment),[]);
});
test('universe capacity and invalid segment counts fail explicitly',()=>{
 assert.equal(stagePatch(stageEquipment({devices:[{type:'bar',id:'x',cells:170}]}))[0].channels,510);
 assert.throws(()=>stageEquipment({devices:[{type:'bar',id:'x',cells:170},{type:'spot',id:'y'}]}),/512/);
 for(const cells of [0,-1,2.5,171,NaN])assert.throws(()=>stageEquipment({devices:[{type:'bar',id:'x',cells}]}),/Segmente/);
 assert.throws(()=>stageEquipment({devices:[{type:'spot',id:'x'},{type:'spot',id:'x'}]}),/Doppelte/);
});
test('each bar chase uses its own length',()=>{
 const equipment=rig(),config=cleanStageSettings({},4);config.global.animation='chase';config.global.strength=100;config.global.period=4;
 const output=mixFixtureFrames([{...streams[0],beat:2}],config,equipment);
 assert.ok(output[1][6].r>output[1][0].r);assert.ok(output[3][1].r>output[3][0].r);
});
