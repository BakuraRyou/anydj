import test from 'node:test';
import assert from 'node:assert/strict';
import {nextShowWake,startShowClock,startPreviewClock} from '../public/show-clock.js';
import {showFrameAt} from '../public/show-plan.js';
const key={};
const stream=time=>({key,time,playing:true,weight:1,beats:[.44,.92,1.4,1.88]});
function displayFrames(){
  let id=0;const callbacks=new Map();
  return {
    requestFrame(fn){callbacks.set(++id,fn);return id;},
    cancelFrame(id){callbacks.delete(id);},
    draw(now){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(now));},
    get pending(){return callbacks.size;},
  };
}

test('local preview keeps display cadence when stage processing consumes part of each frame',()=>{
  const display=displayFrames(),sampled=[];let wall=0;
  const stop=startPreviewClock(()=>{sampled.push(wall);wall+=10;},display);
  // A 10ms render must not add another 16ms wait after it completes.
  for(let frame=0;frame<180;frame++){
    wall=Math.max(wall,frame*1000/60);display.draw(wall);
  }
  assert.equal(sampled.length,180);
  assert.ok(Math.abs(sampled.at(-1)-179*1000/60)<1e-6);
  stop();assert.equal(display.pending,0);
});

test('local preview samples current audio across consecutive songs, tempo changes and a long stall',()=>{
  const display=displayFrames(),sampled=[];let audioTime=0,track=0;
  const stop=startPreviewClock(()=>sampled.push({track,time:audioTime}),display);
  let wall=0;
  for(track=0;track<12;track++)for(let frame=0;frame<120;frame++){
    audioTime=frame/60*(track%2?1.2:1);display.draw(wall);wall+=1000/60;
    assert.deepEqual(sampled.at(-1),{track,time:audioTime},'each song uses its current media position');
  }
  audioTime=57.25;display.draw(wall+5000);
  assert.deepEqual(sampled.at(-1),{track:12,time:57.25},'resume immediately samples current audio without catching up old frames');
  assert.equal(display.pending,1);
  stop();
});

test('local preview bounds work on high refresh displays and cancels cleanly during a callback',()=>{
  const display=displayFrames();let sent=0,stop;
  stop=startPreviewClock(()=>{if(++sent===3)stop();},display);
  for(let now=0;now<100;now+=1000/120)display.draw(now);
  assert.equal(sent,3);
  assert.equal(display.pending,0);
});

test('local preview preserves background output and resumes current display frames without duplicate loops',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const display=displayFrames(),page=new EventTarget();page.hidden=false;
  let sent=0;const stop=startPreviewClock(()=>sent++,{...display,page});
  display.draw(0);assert.equal(sent,1);
  page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(display.pending,0);
  t.mock.timers.tick(16);assert.equal(sent,2,'output continues when animation frames are suspended');
  page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(100);assert.equal(sent,2,'background timer was cancelled');
  display.draw(200);assert.equal(sent,3);
  assert.equal(display.pending,1);
  stop();page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(100);assert.equal(sent,3);
  assert.equal(display.pending,0);
});
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
