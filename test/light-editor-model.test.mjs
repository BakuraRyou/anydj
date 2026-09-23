import test from 'node:test';
import assert from 'node:assert/strict';
import {editPhaseTime} from '../public/light-editor-model.js';
const plan={duration:12,beatGrid:{beats:[0,1,2,3,4,5,6,7,8,9,10,11],downbeats:[0,4,8]}};
const phase=(start,end)=>({start,end,name:'Phase',rhythm:'auto',movement:1,colors:'auto',colorA:'#ffffff',colorB:'#000000'});
test('move keeps duration and stops at neighbours without mutating source',()=>{
 const source=[phase(0,2),phase(4,6),phase(9,12)],copy=structuredClone(source);
 const result=editPhaseTime(source,1,'move',10,plan,'free');
 assert.equal(result[1].start,7);assert.equal(result[1].end,9);assert.deepEqual(source,copy);
 assert.equal(editPhaseTime(source,1,'move',-2,plan,'free')[1].start,2);
});
test('shared boundary resizes both neighbours and preserves positive durations',()=>{
 const source=[phase(0,4),phase(4,8),phase(8,12)];
 const result=editPhaseTime(source,1,'start',2,plan);assert.equal(result[0].end,2);assert.equal(result[1].start,2);
 const clamped=editPhaseTime(source,1,'end',20,plan,'free');assert.equal(clamped[1].end,11.9);assert.equal(clamped[2].start,11.9);
});
test('beat, bar and free edits use the selected grid; gaps stay automatic',()=>{
 const source=[phase(2,3)];
 assert.equal(editPhaseTime(source,0,'move',4.3,plan,'beat')[0].start,4);
 assert.equal(editPhaseTime(source,0,'move',6.3,plan,'bar')[0].start,8);
 assert.equal(editPhaseTime(source,0,'start',1.3,plan,'free')[0].start,1.3);
 assert.throws(()=>editPhaseTime(source,0,'end',NaN,plan));
});
