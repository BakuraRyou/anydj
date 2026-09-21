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
 assert.ok(['handover','cut'].includes(p.style));assert.equal(JSON.stringify([a,b]),before);
});

test('automatic choice compares a short boundary handoff against blending without changing songs',()=>{
 const a=longPlan(.5),b=longPlan(.7);
 for(const p of [a,b])p.structure.instruments=instruments(120,{drums:1,bass:.01,vocals:0,other:.01});
 a.sections=[{start:116}];
 const short=planTransitionPair(a,b,{adaptive:true});
 assert.equal(short.style,'cut');assert.equal(short.time,116);assert.equal(short.duration,.25);
 const blend=planTransitionPair(a,a,{adaptive:true});
 assert.equal(blend.style,'smooth');assert.ok(blend.duration>=2);
 assert.notEqual(planTransitionPair(a,b,{seconds:8}).style,'cut');
});

test('sustained vocal endings differ from syllable gaps; context detects energy builds and drops',async()=>{
 const {transitionContext}=await import('../public/musical-transition.js');
 const a=longPlan(),b=longPlan();
 a.structure.instruments.vocals.fill(0,1000,1020);
 const end=transitionContext(a,b,99.875,0,.25);
 assert.equal(end.vocalEnd,true);
 a.structure.instruments.vocals.fill(.7,1002,1020);
 assert.equal(transitionContext(a,b,99.875,0,.25).vocalEnd,false);
 const flat=longPlan();flat.structure.instruments=instruments(120,{vocals:0,bass:0,drums:0,other:.2});
 const rising=structuredClone(flat);rising.structure.instruments.other.fill(.4,980,1000);rising.structure.instruments.other.fill(.8,1000,1020);
 assert.equal(transitionContext(rising,flat,100,0,4).build,true);
 assert.ok(transitionContext(rising,flat,100,0,4).cost>transitionContext(flat,flat,100,0,4).cost);
 flat.structure.instruments.other.fill(0,40,70);
 assert.ok(transitionContext(rising,flat,100,0,4).energyJump>1);
});
test('phrase estimates require an actual section anchor and absent context supplies no evidence',async()=>{
 const {transitionContext}=await import('../public/musical-transition.js');
 const a=longPlan();a.structure.segments=[{start:80,end:120,label:'outro'}];
 assert.equal(transitionContext(a,a,95.875,0,.25).phrase,true);
 assert.equal(transitionContext({...a,structure:{...a.structure,segments:[]}},a,95.875,0,.25).phrase,false);
 assert.equal(transitionContext({duration:120},{duration:120},95,0,4).cost,0);
});
test('extended entry search is opt-in, bounded and never shifts an explicit cue',()=>{
 const a=longPlan(),b=longPlan();b.structure.instruments.vocals.fill(0,60);
 const ordinary=planTransitionPair(a,b,{adaptive:true});assert.ok(ordinary.cue<=2);
 const extended=planTransitionPair(a,b,{adaptive:true,entryWindow:16});
 assert.ok(extended.alternatives.some(p=>p.cue>2));assert.ok(extended.cue<=16);
 for(const adaptive of [false,true])for(const cue of [0,.6,5]){
  const p=planTransitionPair(a,b,{adaptive,cue,cueLocked:true,entryWindow:30});assert.equal(p.cue,cue);
  for(const alternative of p.alternatives||[])assert.equal(alternative.cue,cue);
 }
});
test('tonal estimates use existing chroma, ignore silence and uncertain keys',async()=>{
 const {transitionTonalSegments,harmonicCompatibility}=await import('../public/musical-transition.js');
 const chroma=Array(12).fill(0);for(const n of [0,2,4,5,7,9,11])chroma[n]=n===0?3:n===4||n===7?2:1;
 const windows=Array.from({length:1000},(_,i)=>({rms:i<500?.1:0,chroma}));
 const keys=transitionTonalSegments(windows);assert.equal(keys[0].root,0);assert.equal(keys[0].mode,'major');assert.equal(keys[1].mode,null);
 assert.equal(transitionTonalSegments(windows),keys);
 const unrelated=[{start:0,end:10,mode:'major',root:1,confidence:1}];
 assert.ok(harmonicCompatibility(keys,unrelated,1,1).cost>0);
 assert.equal(harmonicCompatibility(keys,keys,1,1).cost,0);
 assert.equal(harmonicCompatibility(keys,[{...unrelated[0],confidence:.1}],1,1).cost,0);
 assert.equal(harmonicCompatibility([],[],1,1).cost,0);
});
test('alternatives are finite, distinct, serializable and preserve musical bounds',()=>{
 const a=longPlan(),b=longPlan(.6),p=planTransitionPair(a,b,{adaptive:true,entryWindow:16,notBefore:100});
 assert.equal(p.alternatives.length,3);assert.equal(p.score,p.alternatives[0].score);
 for(const candidate of p.alternatives){assert.ok(Number.isFinite(candidate.score));assert.ok(candidate.time>=100);assert.ok(candidate.time+candidate.duration<=120);assert.ok(candidate.cue<=16);assert.ok(!candidate.alternatives);}
 assert.doesNotThrow(()=>JSON.stringify(p));
 const preferred=planTransitionPair(a,b,{adaptive:true,preferredStyle:'cut'});assert.ok(preferred.duration>0);
});
