import test from 'node:test';
import assert from 'node:assert/strict';
import {nextShowWake,startShowClock} from '../public/show-clock.js';
import {showFrameAt} from '../public/show-plan.js';
const key={};
const stream=time=>({key,time,playing:true,weight:1,beats:[.44,.92,1.4,1.88]});
test('Show-Uhr reserviert den nächsten Sendetermin für den Beat',()=>{
  assert.equal(nextShowWake([stream(0)]).delay,110);
  assert.equal(nextShowWake([stream(.33)]).time,.44);
  assert.equal(nextShowWake([stream(.44)]).delay,110);
  assert.equal(nextShowWake([{...stream(.33),playing:false}]).delay,110);
  assert.equal(nextShowWake([{...stream(.33),weight:0}]).delay,110);
});
test('Beattermine bleiben über einen ganzen Track erhalten, auch bei nicht-rasterförmigem Tempo',()=>{
  const beats=Array.from({length:500},(_,i)=>.333+i*.487);
  let time=0;const sent=[];
  while(time<245){sent.push(time);time+=Math.max(4,Math.ceil(nextShowWake([{...stream(time),beats}]).delay))/1000;}
  for(const beat of beats)assert.ok(sent.find(t=>t>=beat)-beat<.00101);
});
test('Show-Uhr wartet auf die tatsächliche Audiozeit und beendet Timer beim Stoppen',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let time=.43;const sent=[];
  const stop=startShowClock(()=>[stream(time)],async()=>sent.push(time));
  t.mock.timers.tick(0);await Promise.resolve();await Promise.resolve();
  time=.435;t.mock.timers.tick(10);await Promise.resolve();await Promise.resolve();
  assert.deepEqual(sent,[.43]);
  time=.44;t.mock.timers.tick(5);await Promise.resolve();await Promise.resolve();
  assert.deepEqual(sent,[.43,.44]);
  stop();time=.92;t.mock.timers.tick(1000);await Promise.resolve();
  assert.deepEqual(sent,[.43,.44]);
});
test('preview captures a short off-grid pulse and its decay at double playback speed',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const plan={duration:2,step:.125,frames:Array.from({length:16},()=>({state:true,r:255,g:0,b:0,dimming:5})),
    beatTiming:{times:[.44,.927],decay:.03,exponent:1,intensity:1.5,minimum:5,maximum:100}};
  let time=.4;const sent=[];
  const stop=startShowClock(()=>[{...stream(time),rate:2,beats:plan.beatTiming.times}],()=>sent.push({time,frame:showFrameAt(plan,time)}),16);
  const flush=async()=>{await Promise.resolve();await Promise.resolve();};
  t.mock.timers.tick(0);await flush();
  time=.439;t.mock.timers.tick(20);await flush();
  assert.equal(sent.length,1);
  time=.44;t.mock.timers.tick(4);await flush();
  assert.equal(sent.at(-1).frame.dimming,100);
  time=.472;t.mock.timers.tick(16);await flush();
  assert.ok(sent.at(-1).frame.dimming<50);
  assert.ok(showFrameAt(plan,.5).dimming<20,'a 100 ms refresh misses almost all of this peak');
  stop();t.mock.timers.tick(1000);await flush();
  assert.equal(sent.length,3);
});
