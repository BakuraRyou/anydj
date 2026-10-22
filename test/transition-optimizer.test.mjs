import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTransitionOptimization,computeTransitionOptimization,cutOptimizationPair,transitionOptimizationSearch} from '../public/transition-optimizer.js';
import {cleanCuts,cleanCutJoins,cutTransitionFits,transitionCutTracks} from '../public/track-cuts.js';
import {optimizeTransition} from '../public/transition-align.js';
const song=(vocal=()=>0,duration=120)=>({plan:{duration,beatGrid:{beats:Array.from({length:duration*2+1},(_,i)=>i/2),downbeats:Array.from({length:Math.floor(duration/2)+1},(_,i)=>i*2)},sections:[{start:0,end:60},{start:60,end:duration}],structure:{instruments:{step:.25,drums:Array(duration*4).fill(.25),bass:Array(duration*4).fill(.3),other:Array(duration*4).fill(.25),vocals:Array.from({length:duration*4},(_,i)=>vocal(i/4))},segments:[{start:0,end:60},{start:60,end:duration}]}},audioCuts:[],audioCutJoins:[]});
const pair=(a,b)=>({libraryTracks:[a,b],from:{duration:a.plan.duration,rate:1,audioCuts:a.audioCuts,audioCutJoins:a.audioCutJoins},to:{duration:b.plan.duration,rate:1,audioCuts:b.audioCuts,audioCutJoins:b.audioCutJoins},plan:{time:90,cue:4,duration:8,style:'smooth',points:null}});

test('deep search finds a vocal-compatible outgoing phase beyond the nearest beats',()=>{
 const input=pair(song(t=>t>=60&&t<78?0:2),song(t=>t>=20&&t<40?0:2)),before=structuredClone(input),started=performance.now();
 const result=computeTransitionOptimization(prepareTransitionOptimization(input));
 assert.ok(result.time>=60&&result.time+result.duration<=78,JSON.stringify(result));
 assert.ok(result.cue>=0&&result.cue+result.duration<=120);assert.notEqual(result.style,'cut');assert.ok(result.duration>=2);assert.ok(result.optimization.evaluated>1000);
 assert.equal(result.confidence,'analyzed');assert.deepEqual(input,before);assert.ok(performance.now()-started<15000);
});
test('three retained phases optimize each adjacent join without resurrecting removed material or crossing another join',()=>{
 const track=song(),cuts=[[20,50],[70,90]];let joins=[];let current=cuts;
 for(const range of cuts){
  const input=cutOptimizationPair(track,current,joins,range),result=computeTransitionOptimization(prepareTransitionOptimization(input));
  assert.ok(cutTransitionFits(result,...transitionCutTracks(input)));
  const boundary=[result.time+result.duration,result.cue];assert.ok(boundary[0]<=range[0]+.00001&&boundary[1]>=range[1]-.00001);
  current=cleanCuts([...current.filter(c=>c[0]!==range[0]||c[1]!==range[1]),boundary],120);
  joins=cleanCutJoins([...joins,{cut:boundary,duration:result.duration,style:result.style,points:null}],current,120);
  assert.ok(result.duration>=1);assert.notEqual(result.style,'cut');
 }
 assert.equal(joins.length,2);
});
test('search respects rates, deleted passages and custom gain curves',()=>{
 const a=song(),b=song();a.audioCuts=[[45,80],[105,120]];b.audioCuts=[[0,12],[30,50]];
 const input=pair(a,b);input.from.rate=1.25;input.to.rate=.8;input.plan.points=[[[0,1],[.4,.6],[1,0]],[[0,0],[.7,.3],[1,1]]];input.plan.style='bass';
 const result=computeTransitionOptimization(prepareTransitionOptimization(input));
 assert.ok(cutTransitionFits(result,...transitionCutTracks(input),1.25,.8));assert.deepEqual(result.points,input.plan.points);assert.equal(result.style,'bass');
});
test('waveform-only analysis remains usable and exposes its missing instrument data',()=>{
 const a={plan:{duration:30},waveform:{rms:Array(300).fill(.2)},audioCuts:[]},b={...a,plan:{duration:30}},input=pair(a,b);input.plan.time=20;input.plan.duration=4;
 const result=computeTransitionOptimization(prepareTransitionOptimization(input));
 assert.equal(result.confidence,'partial');assert.match(result.reason,/Ohne vollständige Instrumentenanalyse/);assert.ok(result.duration>=1);
 assert.ok(result.time+result.duration<=30&&result.cue+result.duration<=30);
});
test('payload excludes files, light frames and raw windows; unsupported input fails clearly',()=>{
 const a=song(),input=pair(a,song());a.plan.frames=[{secret:'lighting'}];a.file={notForWorker:true};a.windows=Array.from({length:6000},()=>({rms:.2,bands:[.1],irrelevant:'omitted'}));
 const prepared=prepareTransitionOptimization(input);assert.equal(prepared.data[0].features.rms.length,1200);assert.ok(!JSON.stringify(prepared).includes('notForWorker'));assert.ok(!JSON.stringify(prepared).includes('lighting'));assert.ok(!JSON.stringify(prepared).includes('omitted'));
 const empty=pair({plan:{duration:20}},{plan:{duration:20}});empty.plan.time=10;assert.throws(()=>computeTransitionOptimization(prepareTransitionOptimization(empty)),/fehlen/);
});
test('search yields progress and asynchronous fallback can be aborted',async()=>{
 const input=pair(song(),song()),search=transitionOptimizationSearch(prepareTransitionOptimization(input));assert.equal(search.next().done,false);
 const controller=new AbortController();let updates=0;
 await assert.rejects(optimizeTransition(input,{signal:controller.signal,onProgress:()=>{updates++;controller.abort();}}),{name:'AbortError'});assert.ok(updates>0);
});
test('live planning never selects an exit behind the captured deck position',()=>{
 const input=pair(song(),song());input.source={audio:{currentTime:99.5}};
 const result=computeTransitionOptimization(prepareTransitionOptimization(input));
 assert.ok(result.time>=99.5);assert.ok(result.time+result.duration<=120);
});
test('a cut keeps the original waveform time scale when no raw windows exist',()=>{
 const track=song();track.waveform={rms:Array(1200).fill(.2)};
 const input=cutOptimizationPair(track,[[20,50]],[],[20,50]),prepared=prepareTransitionOptimization(input);
 assert.equal(prepared.data[0].features.step,.1);assert.equal(prepared.data[1].features.step,.1);
});
test('explicit duration remains exact at an internal cut and through repeated optimization',async()=>{
 const track=song(),input=cutOptimizationPair(track,[[20,50]],[],[20,50]),before=structuredClone(input),requestedDuration=3.75;
 const result=await optimizeTransition(input,{requestedDuration});
 assert.equal(result.duration,requestedDuration);
 assert.ok(cutTransitionFits(result,...transitionCutTracks(input)));
 assert.equal(computeTransitionOptimization(prepareTransitionOptimization({...input,plan:result},{requestedDuration})).duration,requestedDuration);
 assert.deepEqual(input,before);
});
test('explicit duration supports long overlaps and different playback rates between songs',()=>{
 const input=pair(song(),song());input.from.rate=1.25;input.to.rate=.8;
 const result=computeTransitionOptimization(prepareTransitionOptimization(input,{requestedDuration:30.5}));
 assert.equal(result.duration,30.5);
 assert.ok(cutTransitionFits(result,...transitionCutTracks(input),1.25,.8));
});
test('an infeasible duration reports the limitation instead of silently shortening it',()=>{
 const input=cutOptimizationPair(song(),[[2,110]],[],[2,110]),before=structuredClone(input);
 assert.throws(()=>computeTransitionOptimization(prepareTransitionOptimization(input,{requestedDuration:3.5})),/nicht genug Platz.*höchstens 2 Sekunden.*nicht geändert/);
 assert.deepEqual(input,before);
 for(const requestedDuration of [0,-1,61,NaN,Infinity])assert.throws(()=>computeTransitionOptimization(prepareTransitionOptimization(input,{requestedDuration})),/zwischen 0,1 und 60/);
});
