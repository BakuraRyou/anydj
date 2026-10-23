import test from 'node:test';
import assert from 'node:assert/strict';
import {pickStageLight,reformFixtureCues} from '../public/dmx-stage-edit.js';
import {cleanLook} from '../public/dmx-show.js';
const boundary=[[-5,0],[5,0],[5,10],[-5,10]];
const members=[{targetId:'room:r:b',position:{x:2,y:1},target:{x:2,y:3}},{targetId:'room:r:a',position:{x:-2,y:1},target:{x:-2,y:3}}];
test('picking includes dark lamps, rejects behind-camera fixtures and ignores rig parts',()=>{
 const light=(id,x,type='moving',depth=1)=>({id,type,power:0,position:{x,y:0,height:depth}});
 const project=([x,y,z])=>({x,y,depth:z});
 assert.equal(pickStageLight([light('truss',0,'truss'),light('back',0,'spot',-.1),light('off',3)],project,0,0),'off');
 assert.equal(pickStageLight([light('far',30)],project,0,0),null);
 assert.equal(pickStageLight([light('b',1,'spot',3),light('a',1,'spot',1)],project,0,0),'a');
});
test('moving the current formation freezes member offsets and keeps independent looks',()=>{
 const phase={fixtures:[{target:'room-group:r:0',look:cleanLook({brightness:60})},{target:'room:r:a',look:cleanLook({brightness:0})}]},copy=structuredClone(phase);
 const cues=reformFixtureCues(phase,'room-group:r:0',members,{x:1,y:6},'keep',2,boundary);
 assert.deepEqual(cues.find(c=>c.target==='room:r:a').aim,{x:-1,y:6});
 assert.deepEqual(cues.find(c=>c.target==='room:r:b').aim,{x:3,y:6});
 assert.equal(cues.find(c=>c.target==='room:r:b').look.brightness,60);
 assert.equal(cues.find(c=>c.target==='room:r:a').look.brightness,0);
 assert.deepEqual(phase,copy);
});
test('line, focus and fan use spatial order, deduplicate bar cells and validate the entire formation',()=>{
 const line=reformFixtureCues({},'group',[...members,members[0]],{x:0,y:5},'line',4,boundary);
 assert.equal(line.length,2);assert.deepEqual(line.map(c=>c.aim),[{x:-2,y:5},{x:2,y:5}]);
 const focus=reformFixtureCues({},'group',members,{x:0,y:5},'focus',4,boundary);
 assert.deepEqual(focus.map(c=>c.aim),[{x:0,y:5},{x:0,y:5}]);
 const fan=reformFixtureCues({},'group',members,{x:0,y:5},'fan',4,boundary);
 assert.deepEqual(fan.map(c=>c.aim),[{x:-2,y:7},{x:2,y:7}]);
 assert.throws(()=>reformFixtureCues({},'group',members,{x:4,y:5},'line',4,boundary),/außerhalb/);
 assert.throws(()=>reformFixtureCues({},'group',members,{x:0,y:5},'line',NaN,boundary));
});
