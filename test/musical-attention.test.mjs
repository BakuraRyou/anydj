import test from 'node:test';
import assert from 'node:assert/strict';
import {musicalAttention,offbeatAttacks} from '../public/musical-attention.js';
import {arrangeShow,arrangementLevelAt} from '../public/show-arrangement.js';
import {movingDirections} from '../public/dmx-moving-direction.js';
import {planColorDirection} from '../public/color-direction.js';
const duration=8;
const beats=Array.from({length:16},(_,i)=>i*.5);
const sections=[{start:0,end:8,label:'chorus',motif:0}];
const samples=()=>Array.from({length:400},()=>({rms:.06,bass:.01,flux:0,tone:.5}));
const hit=(w,time)=>{const i=Math.round(time/.02);for(let j=0;j<2;j++)w[i+j]={...w[i+j],rms:.3,bass:.16,flux:.6};};
const stems=values=>({step:.1,...Object.fromEntries(['drums','bass','vocals','other'].map((name,i)=>[name,Array(80).fill(values[i])]))});
test('measured syncopations survive without a grid and stay deterministic and seekable',()=>{
 const w=samples();for(const t of [.24,1.24,2.24,3.24,4.24,5.24,6.24])hit(w,t);
 const before=structuredClone(w);
 for(const grid of [beats,[]]){
  const p=arrangeShow(w,duration,sections,grid);
  for(const t of [1.24,2.24,3.24,4.24,5.24]){
   const i=p.times.findIndex(x=>Math.abs(x-t)<.021);
   assert.ok(i>=0,`missing syncopation ${t}: ${p.times}`);
   assert.equal(p.eventSources[i],'onset');
   assert.ok(arrangementLevelAt(p,t+.01)>arrangementLevelAt(p,t+.4));
  }
  assert.deepEqual(p,arrangeShow(w,duration,sections,grid));
  assert.equal(p.times.length,p.patterns.events.length);
  assert.ok(p.times.every((t,i)=>!i||t>p.times[i-1]));
  const expected=arrangementLevelAt(p,2.25);arrangementLevelAt(p,7);assert.equal(arrangementLevelAt(p,2.25),expected);
 }
 assert.deepEqual(w,before);
});
test('near-grid attacks are not doubled; silence, pads and spectral-only changes do not flash',()=>{
 const w=samples();for(const t of beats.slice(1))hit(w,t+.04);
 const p=arrangeShow(w,duration,sections,beats);
 assert.equal(p.eventSources.filter(x=>x==='onset').length,0);
 for(const sample of [{rms:0,bass:0},{rms:.2,bass:.1},{rms:.001,bass:0}]){
  const steady=samples().map((_,i)=>({...sample,flux:i%4?.8:0}));
  assert.deepEqual(offbeatAttacks(steady,duration,.2),[]);
 }
 const step=samples();for(let i=100;i<step.length;i++)step[i].rms=.3;
 assert.deepEqual(offbeatAttacks(step,duration,.3),[]);
 const quiet=arrangeShow(w.map(x=>({...x,rms:x.rms*.03,bass:x.bass*.03})),duration,[{...sections[0],label:'outro'}],beats);
 assert.equal(quiet.eventSources.filter(x=>x==='onset').length,0);
});
test('ambiguous, missing and silent stems preserve neutral controls; voice focus is bounded',()=>{
 const neutral=musicalAttention(null,0,8);
 for(const x of [stems([0,0,0,0]),stems([.1,.1,.1,.1]),stems([.0001,0,.0004,0])])assert.deepEqual(musicalAttention(x,0,8),neutral);
 const voice=musicalAttention(stems([.03,.02,.3,.02]),0,8);
 assert.equal(voice.leader,'vocals');assert.ok(voice.motionScale>=.65&&voice.motionScale<1);
 assert.ok(voice.accentScale>=.82&&voice.accentScale<1);
 assert.equal(musicalAttention(stems([.3,.03,.02,.02]),0,8).motionScale,1);
});
test('shared vocal focus reduces movement and strong color interruptions, leaving ambiguous plans unchanged',()=>{
 const attention=musicalAttention(stems([.03,.02,.3,.02]),0,8);
 const plan={sections:[{look:'peak',motif:0,role:'feature'}],arrangement:{patterns:{phrases:[{start:0,end:4,section:0,energy:.7,tone:.7,movement:{character:'rhythmic',driving:1}},{start:4,end:8,section:0,energy:.7,tone:.7,movement:{character:'rhythmic',driving:1}}]},times:[0,2,4,6],accents:[.5,.5,.5,.5]}};
 const original=movingDirections(plan);
 plan.arrangement.patterns.phrases.forEach(p=>p.attention=musicalAttention(null,0,8));
 assert.deepEqual(movingDirections(plan),original);
 const w=samples().map((v,i)=>({...v,tone:i<200?.1:.9,bands:i<200?[.8,.1,.1,0,0]:[0,0,.1,.1,.8]}));
 const colors=planColorDirection(w,plan);
 plan.arrangement.patterns.phrases.forEach(p=>p.attention=attention);
 const focused=movingDirections(plan),focusedColors=planColorDirection(w,plan);
 assert.ok(focused[0].travel>original[0].travel);assert.ok(focused[0].spacing>original[0].spacing);
 assert.equal(focused[0].shape,'focus');
 assert.ok(focusedColors.events.filter(e=>e.reason==='musical-accent').length<colors.events.filter(e=>e.reason==='musical-accent').length);
 assert.ok(focusedColors.events.some(e=>e.reason==='sound-change'));
});
