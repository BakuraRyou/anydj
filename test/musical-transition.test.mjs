import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionPoint,incomingCue,planTransitionPair,transitionProgress} from '../public/musical-transition.js';
const plan={duration:33,beatGrid:{beats:Array.from({length:66},(_,i)=>i*.5),downbeats:Array.from({length:17},(_,i)=>i*2)},sections:[{start:0},{start:22}]};
test('prefers a section boundary near the old trigger and otherwise a bar',()=>{
 assert.deepEqual(transitionPoint(plan,8),{time:22,kind:'section'});
 assert.deepEqual(transitionPoint({...plan,sections:[]},8),{time:24,kind:'bar'});
});
test('unreliable or absent grids fall back to the original time trigger',()=>{
 assert.deepEqual(transitionPoint({duration:33},8),{time:25,kind:'time'});
 assert.deepEqual(transitionPoint({...plan,beatGrid:{beats:[0,4,5],downbeats:[24]}},8),{time:25,kind:'time'});
 assert.deepEqual(transitionPoint({duration:3},8),{time:0,kind:'time'});
});
test('rate changes preserve enough actual time for the fade; do not pick distant sections',()=>{
 const p=transitionPoint(plan,8,1.25);assert.ok((plan.duration-p.time)/1.25>=8);
 assert.deepEqual(transitionPoint({...plan,sections:[{start:2}]},8),{time:24,kind:'bar'});
});
test('incoming cue uses a nearby detected downbeat and never skips a large intro',()=>{
 assert.equal(incomingCue(plan,.25),2);assert.equal(incomingCue({duration:33},.25),.25);
 assert.equal(incomingCue({...plan,beatGrid:{...plan.beatGrid,downbeats:[10]}},1),1);
 assert.equal(incomingCue(plan,32.9),32.9);
});

test('musical selection can be disabled independently of fade duration and manual tempo',()=>{
 assert.deepEqual(transitionPoint(plan,8,1,false),{time:25,kind:'time'});
 assert.deepEqual(transitionPoint(plan,8,1.25,false),{time:23,kind:'time'});
 assert.deepEqual(transitionPoint(plan,8,1,true),{time:22,kind:'section'});
});

const instruments=(duration,{vocals=.05,bass=.6,drums=.1,other=.1}={})=>({version:1,source:'htdemucs',step:.1,...Object.fromEntries(Object.entries({vocals,bass,drums,other}).map(([k,v])=>[k,Array(Math.ceil(duration*10)).fill(v)]))});
test('pair fallback preserves existing timing and caps overlap for short incoming songs',()=>{
 const result=planTransitionPair(plan,{duration:3},{seconds:8});
 assert.equal(result.time,22);assert.equal(result.duration,3);assert.equal(result.confidence,'fallback');
 assert.equal(planTransitionPair(plan,plan,{seconds:8,musical:false}).time,25);
});
test('bass-heavy pair chooses a bass handover, vocal pair reduces overlap',()=>{
 const a={...plan,structure:{instruments:instruments(33)}};
 const bass=planTransitionPair(a,a,{seconds:8});assert.equal(bass.style,'bass');assert.ok(bass.duration<=8);assert.equal(bass.confidence,'analyzed');
 const vocal={...a,structure:{instruments:instruments(33,{vocals:.8,bass:.05})}};
 assert.equal(planTransitionPair(vocal,vocal,{seconds:8}).style,'handover');
});
test('candidate comparison prefers a nearby vocal-free entry and respects the cue',()=>{
 const a={...plan,structure:{instruments:instruments(33,{vocals:.8,bass:.05})}};
 const b={...plan,structure:{instruments:instruments(33,{vocals:.05,bass:.05})}};b.structure.instruments.vocals.fill(.8,0,20);
 const p=planTransitionPair(a,b,{seconds:4,cue:0});assert.equal(p.cue,2);assert.ok(p.time+p.duration<=a.duration);
 assert.ok(planTransitionPair(a,b,{seconds:4,cue:5}).cue>=5);
});
test('handover gain curve is bounded, monotonic and keeps endpoints',()=>{
 let previous=0;for(let i=0;i<=100;i++){const p=transitionProgress(i/100,'handover');assert.ok(p>=previous&&p<=1);previous=p;}
 assert.equal(transitionProgress(0,'handover'),0);assert.equal(transitionProgress(1,'handover'),1);assert.equal(transitionProgress(.2,'smooth'),.2);
});

test('manual transitions stay at the current exit and respect actual time at manual rates',()=>{
 const a={...plan,structure:{instruments:instruments(33)}};
 const result=planTransitionPair(a,a,{seconds:8,startTime:30.5,rateA:1.25,rateB:.8});
 assert.equal(result.time,30.5);assert.equal(result.kind,'time');assert.equal(result.duration,2);
 const early=planTransitionPair(a,a,{seconds:4,startTime:7.6});
 assert.equal(early.time,7.6);assert.equal(early.duration,4);
});

const longPlan=(period=.5,beatsPerBar=4)=>({duration:120,
 beatGrid:{beats:Array.from({length:Math.ceil(120/period)},(_,i)=>i*period),downbeats:Array.from({length:Math.ceil(120/period/beatsPerBar)},(_,i)=>i*period*beatsPerBar)},
 sections:[],structure:{instruments:instruments(120,{vocals:.7,bass:.3,drums:.4})}});
test('automatic pair finds a vocal-free section outside the old narrow window',()=>{
 const a=longPlan(),b=longPlan();a.sections=[{start:96}];a.structure.instruments.vocals.fill(0,960,1120);
 const p=planTransitionPair(a,b,{adaptive:true});
 assert.equal(p.time,96);assert.equal(p.kind,'section');assert.equal(p.style,'bass');
 assert.ok(p.time>=90&&p.time+p.duration<=120);assert.ok(p.cue>=0&&p.cue<=2);
 assert.ok(planTransitionPair(a,b,{seconds:8}).time>=108);
});
test('automatic duration follows actual three-beat bars instead of assuming four beats',()=>{
 const a=longPlan(.6,3);a.structure.instruments=instruments(120,{vocals:.01,bass:.01,drums:.5});
 const p=planTransitionPair(a,a,{adaptive:true});
 assert.ok(Math.abs(p.duration-7.2)<1e-6);assert.equal(p.style,'smooth');
});
test('automatic planning respects late loading, rates, cue window and immediate manual starts',()=>{
 const a=longPlan(),b=longPlan(.6);
 for(const notBefore of [0,103,117,119.8,120]){
  const p=planTransitionPair(a,b,{adaptive:true,notBefore,rateA:1.25,rateB:.8,cue:5});
  assert.ok(p.time>=notBefore);assert.ok(p.time+p.duration*1.25<=120+1e-6);
  assert.ok(p.cue>=5&&p.cue<=7);assert.ok(p.cue+p.duration*.8<=120+1e-6);
 }
 assert.equal(planTransitionPair(a,b,{adaptive:true,startTime:53.4}).time,53.4);
});
test('automatic option keeps fallback and disabled musical timing predictable',()=>{
 assert.deepEqual(planTransitionPair(plan,plan,{adaptive:true}),planTransitionPair(plan,plan));
 const a=longPlan();assert.deepEqual(planTransitionPair(a,a,{adaptive:true,musical:false}),planTransitionPair(a,a,{musical:false}));
 const broken={...a,beatGrid:{beats:[],downbeats:[]}};
 assert.ok(!planTransitionPair(broken,broken,{adaptive:true}).adaptive);
});
test('different rhythms favor a shorter audible overlap without changing tempo data',()=>{
 const a=longPlan(),b=longPlan(.6);a.sections=[{start:96}];a.structure.instruments.vocals.fill(0,960,1120);
 const before=JSON.stringify([a,b]);const p=planTransitionPair(a,b,{adaptive:true});
 assert.equal(p.style,'handover');assert.equal(JSON.stringify([a,b]),before);
});
