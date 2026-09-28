import test from 'node:test';
import assert from 'node:assert/strict';
import {alignTransition} from '../public/transition-align.js';
const song=()=>({duration:210,beatGrid:{beats:Array.from({length:421},(_,i)=>i*.5),downbeats:Array.from({length:106},(_,i)=>i*2)}});
const pair=()=>({from:{duration:210,rate:1},to:{duration:210,rate:1},libraryTracks:[{plan:song()},{plan:song()}],plan:{time:186.3,cue:4.3,duration:19.7,style:'bass'}});
test('aligns locally, refines length and leaves input unchanged',()=>{
 const input=pair(),result=alignTransition(input);
 assert.equal(result.time,186);assert.equal(result.cue,4);assert.equal(result.duration,20);assert.equal(result.style,'bass');
 assert.equal(input.plan.time,186.3);assert.equal(result.audioProfile,null);
});
test('custom curves survive alignment and track boundaries remain valid at different rates',()=>{
 const input=pair();input.from.rate=1.25;input.plan.time=180.2;input.plan.points=[[[0,1],[1,0]],[[0,0],[1,1]]];
 const result=alignTransition(input);assert.deepEqual(result.points,input.plan.points);
 assert.ok(result.time+result.duration*input.from.rate<=210);assert.ok(result.cue+result.duration<=210);
 assert.ok(Math.abs(result.time-input.plan.time)/input.from.rate<=2);
});
test('missing grids remain explicit while distant beats expand the search',()=>{
 const input=pair();delete input.libraryTracks[0].plan.beatGrid;assert.throws(()=>alignTransition(input),/Beatdaten/);
 input.libraryTracks[0].plan.beatGrid={beats:[0,1]};const result=alignTransition(input);assert.equal(result.time,1);assert.ok(result.duration>0);
});

test('a long requested overlap is shortened if beats only begin late in a song',()=>{
 const input=pair();input.from={duration:30,rate:1.25};input.plan.time=2;input.plan.duration=25;
 input.libraryTracks[0].plan={duration:30,beatGrid:{beats:[24,25,26,27,28,29,30],downbeats:[24,28]}};
 const result=alignTransition(input);
 assert.equal(result.time,24);assert.ok(result.duration>=.1&&result.duration<=4.8);
 assert.ok(result.time+result.duration*input.from.rate<=30);
 assert.ok(result.cue+result.duration*input.to.rate<=210);
});
test('near-song-end selections search backwards for a full overlap',()=>{
 const input=pair();input.plan.time=209;input.plan.cue=209;input.plan.duration=20;
 const result=alignTransition(input);assert.equal(result.time,190);assert.equal(result.cue,190);assert.equal(result.duration,20);
});
