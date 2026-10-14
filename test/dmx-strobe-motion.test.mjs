import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
import {strobeGestureExposure} from '../public/dmx-strobe.js';
const song=()=>({duration:32,sections:[{start:0,end:16,look:'flow'},{start:16,end:32,look:'peak'}],beatGrid:{beats:Array.from({length:65},(_,i)=>i*.5),downbeats:Array.from({length:16},(_,i)=>i*2)},arrangement:{times:Array.from({length:31},(_,i)=>i+1),accents:Array(31).fill(.7),eventSalience:Array(31).fill(.8),patterns:{phrases:Array.from({length:4},(_,i)=>({start:i*8,end:i*8+8,energy:.7+i*.05,tone:.2+i*.2,movement:{driving:.8,character:'rhythmic'}}))},drama:{step:1,intensity:Array(32).fill(.8),percussion:Array(32).fill(.8),vocalShare:Array(32).fill(0)}}});
test('Strobo owns a separate musical figure timeline',()=>{
 const plan=song(),automatic=movingCues(plan,'auto','balanced'),strobe=movingCues(plan,'strobe');
 assert.ok(strobe.length>3);
 assert.notDeepEqual(strobe.map(c=>c.time),automatic.map(c=>c.time));
 assert.notDeepEqual(strobe.map(c=>c.pose),automatic.map(c=>c.pose));
 assert.ok(new Set(strobe.map(c=>c.formation)).size>1);
 const before=movingCueAt(strobe,13.2);movingCueAt(strobe,30);assert.deepEqual(movingCueAt(strobe,13.2),before);
 assert.deepEqual(movingCues(structuredClone(plan),'strobe'),strobe);
});
test('prepared Strobo is a distinct timeline with bounded motor speed',()=>{
 const plan=song(),job=movingPlanJob(plan,'strobe');while(!job.done)job.advance();
 assert.equal(job.result.mode,'strobe');
 let previous=movingPlanAt(job.result,0);
 for(let t=.05;t<32;t+=.05){
  const pose=movingPlanAt(job.result,t);
  pose.forEach((p,i)=>{assert.ok(Number.isFinite(p.pan)&&Number.isFinite(p.tilt));assert.ok(Math.abs(p.pan-previous[i].pan)<=70*.05+1e-4);assert.ok(Math.abs(p.tilt-previous[i].tilt)<=.8*.05+1e-4);});previous=pose;
 }
});
test('light follows continuous room groups, and ends outside the song',()=>{
 const plan=song(),cues=movingCues(plan,'strobe');
 let visible=0,dark=0;
 for(let t=0;t<32;t+=.05){const level=strobeGestureExposure(plan,t);assert.ok(level>=0&&level<=1);if(level>.2)visible++;if(level===0)dark++;}
 assert.ok(visible>0);
 assert.equal(strobeGestureExposure(plan,plan.duration+1),0);
});
