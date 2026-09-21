import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionAudioProfile,transitionAudioGains,holdAudioParam} from '../public/transition-audio.js';

const windows=rms=>Array.from({length:1000},()=>({rms}));
const plan={time:4,cue:1,duration:4,style:'smooth'};
test('RMS profile follows actual positions and playback rates, rejecting missing or silent audio',()=>{
 const changing=windows(.1);for(let i=300;i<500;i++)changing[i].rms=.3;
 assert.ok(transitionAudioProfile(changing,windows(.1),plan).a>.1);
 assert.ok(Math.abs(transitionAudioProfile(windows(.1),windows(.2),plan).b-.2)<1e-12);
 for(const args of [[[],windows(.1),plan],[windows(0),windows(.1),plan],[windows(.1),windows(.1),{...plan,style:'cut'}],
  [windows(.1),windows(.1),plan,{sameTrack:true}],[windows(.1),windows(.1),{...plan,time:18},{rateA:2}]])assert.equal(transitionAudioProfile(...args),null);
});
test('Dynamic curves reduce the RMS dip across arbitrary levels while preserving endpoints and gain bounds',()=>{
 for(const a of [.01,.035,.08,.16,.3])for(const b of [.01,.06,.12,.25])for(const style of ['smooth','bass','handover']){
  const p={style,audioProfile:{a,b}};
  assert.deepEqual(transitionAudioGains(0,p),[1,0]);assert.deepEqual(transitionAudioGains(1,p),[0,1]);
  for(let i=0;i<=100;i++){
   const linear=transitionAudioGains(i/100,{style}),gains=transitionAudioGains(i/100,p);
   assert.ok(gains.every(g=>Number.isFinite(g)&&g>=0&&g<=1+1e-12));
   assert.ok(gains[0]+gains[1]<=10**.1+1e-12);
   const target=linear[0]*a+linear[1]*b;
   assert.ok(Math.abs(Math.hypot(gains[0]*a,gains[1]*b)-target)<=Math.abs(Math.hypot(linear[0]*a,linear[1]*b)-target)+1e-12);
  }
 }
 assert.ok(transitionAudioGains(.5,{audioProfile:{a:.08,b:.08}})[0]>.5);
 assert.deepEqual(transitionAudioGains(.5,{audioProfile:{a:.3,b:.3}}),[.5,.5]);
});
test('Manual partial fades and muted channels preserve the linear control relationship',()=>{
 const p={audioProfile:{a:.1,b:.1}};
 assert.deepEqual(transitionAudioGains(0,p,{position:.4}),[.6,.4]);
 assert.deepEqual(transitionAudioGains(.5,p,{position:.4}),[.30000000000000004,.7]);
 assert.deepEqual(transitionAudioGains(.5,p,{levelA:0}),[.5,.5]);
});
test('Aborting automation holds the current value including on browsers without cancelAndHoldAtTime',()=>{
 const events=[];
 holdAudioParam({cancelAndHoldAtTime:t=>events.push(['hold',t])},2);
 holdAudioParam({value:.42,cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['set',v,t])},3);
 assert.deepEqual(events,[['hold',2],['cancel',3],['set',.42,3]]);
});
