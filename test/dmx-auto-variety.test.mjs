import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCues} from '../public/dmx-moving-cues.js';
import {movingDevicePoses} from '../public/dmx-layout-model.js';
const song=(tempo=120)=>{
 const beat=60/tempo,duration=128*beat;
 return {duration,sections:[{start:0,end:duration,look:'flow',intensity:.82}],beatGrid:{beats:Array.from({length:129},(_,i)=>i*beat),downbeats:Array.from({length:33},(_,i)=>i*4*beat)},arrangement:{times:Array.from({length:128},(_,i)=>i*beat),accents:Array(128).fill(.6),patterns:{phrases:[{start:0,end:duration,energy:.82,tone:.5,movement:{driving:.85,character:'rhythmic'}}]},drama:{step:beat,intensity:Array(128).fill(.82),percussion:Array(128).fill(.85),vocalShare:Array(128).fill(.1)}}};
};
const changes=plan=>{let last;return movingCues(plan,'auto').filter(c=>{if(!c.formation||c.formation===last)return false;last=c.formation;return true;});};
test('unchanged audio does not cycle formations after a fixed number of bars',()=>{
 const plan=song(),cues=movingCues(plan,'auto');
 assert.equal(new Set(cues.filter(c=>c.formation).map(c=>c.formation)).size,1);
 assert.ok(cues.every(c=>!c.variation));
});
test('exceptional irregular audio accents can develop the picture at their actual times',()=>{
 const plan=song(),accents=[5.5,17,28.5,43];
 plan.arrangement.eventSalience=plan.arrangement.times.map(t=>accents.includes(t)?.95:.1);
 plan.arrangement.eventSources=plan.arrangement.times.map(t=>accents.includes(t)?'onset':'beat');
 const transitions=changes(plan);
 assert.ok(transitions.length>=3);
 assert.ok(transitions.slice(1).every(c=>accents.includes(c.time)));
 const eight=Array.from({length:8},(_,i)=>({id:'moving-'+i}));
 const pictures=new Set(transitions.map(c=>JSON.stringify(movingDevicePoses(c.pose,eight,{formation:'designed'}).map(p=>[Math.round(p.pan),Number(p.tilt.toFixed(2))]))));
 assert.ok(pictures.size>=2,'eight heads change their actual geometry');
 assert.deepEqual(movingCues(structuredClone(plan),'auto'),movingCues(plan,'auto'));
 const shifted=structuredClone(plan);shifted.arrangement.times=shifted.arrangement.times.map(t=>accents.includes(t)?t+.13:t);
 assert.ok(changes(shifted).slice(1).every(c=>accents.some(t=>Math.abs(c.time-t-.13)<1e-8)));
});
test('local instrument balance changes a formation without a standout beat',()=>{
 const plan=song();
 plan.arrangement.drama.vocalShare=plan.arrangement.drama.vocalShare.map((_,i)=>i>=13&&i<37?.85:.1);
 const transitions=changes(plan);
 assert.ok(transitions.length>1);
 assert.ok(transitions.slice(1).some(c=>c.time>=6.5&&c.time<=10));
});
test('manual movement holds and quiet passages remain authoritative',()=>{
 const held=song();held.sectionLighting=[{start:12,end:28,movement:0}];
 assert.ok(movingCues(held,'auto').every(c=>c.time<12||c.time>=28));
 const quiet=song();quiet.sections[0].look='held';quiet.arrangement.drama.intensity.fill(.1);quiet.arrangement.drama.percussion.fill(0);quiet.arrangement.patterns.phrases[0].movement.driving=0;
 assert.ok(movingCues(quiet,'auto').every(c=>!c.variation));
});
