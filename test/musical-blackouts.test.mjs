import test from 'node:test';
import assert from 'node:assert/strict';
import {musicalBlackouts,arrangeShow} from '../public/show-arrangement.js';
import {activityAt} from '../public/dmx-activity.js';
import {automaticStage} from '../public/dmx-auto.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
const signal=(gaps=[[3,3.6]],quiet=.001)=>Array.from({length:600},(_,i)=>({rms:gaps.some(([a,b])=>i*.02>=a&&i*.02<b)?quiet:.2,bass:.05,tone:.5}));
const make=()=>({sections:[{start:0,end:12,look:'flow'}],arrangement:arrangeShow(signal(),12,[{start:0,end:12,label:'verse'}],[],[])});
const source=(p,t)=>({movingPlan:p,songTime:t,look:'flow',frame:{state:true,r:255,g:60,b:0,dimming:50},weight:1});
test('an isolated musical stop reaches full darkness and returns on the audible entrance',()=>{
 const p=make();assert.deepEqual(p.arrangement.blackouts,[{start:3,end:3.6}]);
 for(const n of [1,2,4,8]){
  const at=t=>activityAt(source(p,t),n);
  assert.deepEqual(at(3),Array(n).fill(1));assert.ok(at(3.03).every(v=>v>0&&v<1));
  assert.deepEqual(at(3.1),Array(n).fill(0));assert.deepEqual(at(3.59),Array(n).fill(0));
  assert.deepEqual(at(3.6),Array(n).fill(1));at(10);assert.deepEqual(at(3.1),Array(n).fill(0));
 }
});
test('quiet passages, pads, ordinary beat gaps, repeated stops and track edges stay out',()=>{
 for(const windows of [signal([[3,3.6]],.03),signal([[3,3.12]]),signal([[3,6]]),signal([[0,.6]]),signal([[11.4,12]]),
  signal([[3,3.6],[5,5.6]]),Array.from({length:600},(_,i)=>({rms:i%25<5?.2:0})),signal().map(()=>({rms:.002}))])
  assert.deepEqual(musicalBlackouts(windows),[]);
 assert.deepEqual(activityAt({movingPlan:{arrangement:{}},songTime:3.2},4),[1,1,1,1]);
});
test('blackout reaches spots and bars without darkening a second playing deck or explicit presets',()=>{
 const p=make(),stop=source(p,3.2),playing=source(p,2);
 const output=automaticStage([stop],2);
 assert.ok(decodeStage(encodeStage(output.frames)).every(f=>f.cells.every(c=>c.every(v=>v===0))));
 assert.ok(automaticStage([stop,playing],2).frames.flat().every(f=>f.dimming>0));
 for(const mode of ['follow','wash','alternate','chase'])assert.ok(automaticStage([stop],2,undefined,mode).frames.flat().some(f=>f.dimming>0));
});
