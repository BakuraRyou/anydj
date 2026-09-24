import {automaticStage} from '../public/dmx-auto.js';
import {mixFixtureFrames,cleanStageSettings} from '../public/dmx-show.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {stageEquipment,stagePatch,encodeStage,decodeStage,fixtureKey} from '../public/dmx-model.js';
import {stageLayout,projectMovingHeads} from '../public/dmx-layout-model.js';
test('a mixed device list preserves common and type-specific properties',()=>{
 const equipment=stageEquipment({unified:true,devices:[{id:'a',type:'moving',name:'Decke',cells:1,gain:80,group:1,motionRange:.4},{id:'b',type:'spot',cells:1},{id:'c',type:'bar',cells:12}]});
 assert.equal(equipment.unified,true);assert.deepEqual(stageEquipment(JSON.parse(JSON.stringify(equipment))),equipment);
 const patch=stagePatch(equipment);assert.deepEqual(patch.map(f=>f.channels),[0,4,36]);assert.equal(patch[0].name,'Decke');assert.equal(patch[0].motionRange,.4);
 assert.equal(fixtureKey(patch[0]),'a');assert.equal(fixtureKey(patch[1]),'fixture-b');
});
test('virtual moving heads do not shift addresses or write motor data to hardware',()=>{
 const spot={id:'s',type:'spot',cells:1},moving={id:'m',type:'moving',cells:1},frame={state:true,r:200,g:100,b:50,dimming:80};
 const mixed=stageEquipment({unified:true,devices:[moving,spot,moving].map((d,i)=>({...d,id:d.id+i}))});
 assert.deepEqual(encodeStage(frame,mixed),encodeStage(frame,stageEquipment({devices:[spot]})));
 assert.deepEqual(decodeStage(encodeStage(frame,mixed),mixed)[0].cells,[[0,0,0]]);
});
test('any number of moving heads use their own stable positions and ranges',()=>{
 const devices=Array.from({length:7},(_,i)=>({id:`head-${i}`,motionRange:i===0?0:.5}));
 const layout=stageLayout({positions:{'head-0':{x:3,y:5,height:4}},targets:{'fixture-s':{x:1,y:2}}});
 const poses=devices.map(()=>({pan:40,tilt:1.1})),out=projectMovingHeads(layout,poses,devices);
 assert.equal(out.length,7);assert.deepEqual(out[0].position,{x:3,y:5,height:4});assert.equal(out[0].target.x,0);assert.equal(out[6].id,'head-6');
 assert.deepEqual(stageLayout(JSON.parse(JSON.stringify(layout))),layout);
 assert.equal(projectMovingHeads(layout,[],[]).length,0);
});

test('automatic and individual light models support mixed and moving-only rigs',()=>{
 for(const types of [['moving'],['moving','spot','bar']]){
  const equipment=stageEquipment({unified:true,devices:types.map((type,i)=>({id:String(i),type,cells:type==='bar'?8:1}))});
  const streams=[{frame:{state:true,r:200,g:120,b:80,dimming:75},weight:1,beat:4,look:'peak',washDimming:60}];
  for(const output of [automaticStage(streams,2,equipment,'auto').frames,mixFixtureFrames(streams,cleanStageSettings(undefined,types.length),equipment)]){
   assert.equal(output.length,types.length);for(const cells of output)for(const frame of cells)for(const key of ['r','g','b','dimming'])assert.ok(Number.isFinite(frame[key]));
  }
 }
});
