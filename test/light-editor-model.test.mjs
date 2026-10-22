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

test('isolating a moment preserves adjacent lighting and independent fixture edits',async()=>{
 const {isolateLightMoment}=await import('../public/light-editor-model.js');
 const {cleanLook}=await import('../public/dmx-show.js');
 const edits=[{id:'phase',name:'Chorus',start:0,end:10,motif:'chorus',rhythm:'auto',movement:1,colors:'auto',colorA:'#ff0000',colorB:'#0000ff',profile:'show',fixtures:[{target:'patch:a',look:cleanLook()}]}];
 const result=isolateLightMoment(edits,3.25,10,1);
 assert.deepEqual(result.edits.map(e=>[e.start,e.end]),[[0,3.25],[3.25,4.25],[4.25,10]]);
 assert.equal(result.index,1);assert.equal(result.edits[1].profile,'show');
 result.edits[1].fixtures[0].look.brightness=0;
 assert.equal(result.edits[0].fixtures[0].look.brightness,100);assert.equal(result.edits[2].fixtures[0].look.brightness,100);assert.equal(edits[0].end,10);
 assert.throws(()=>isolateLightMoment(edits,10,10));
});
