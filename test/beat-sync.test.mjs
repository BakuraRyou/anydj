import test from 'node:test';
import assert from 'node:assert/strict';
import {beatPosition,beatSyncTarget,alignedStart} from '../public/beat-sync.js';
const beats=period=>Array.from({length:100},(_,i)=>.13+i*period);
test('aligns fractional beat phase and tempo without changing master playback',()=>{
 const master=beats(.5),follower=beats(.6),start=alignedStart(master,2.38,1,follower,.4);
 assert.ok(start.time>=.4);assert.ok(Math.abs(start.rate-1.2)<1e-8);
 assert.ok(Math.abs(beatPosition(master,2.38).phase-beatPosition(follower,start.time).phase)<1e-8);
});
test('phase correction converges without seeking during playback',()=>{
 const master=beats(.5),follower=beats(.55);let a=2.3,b=2.7,rate=1;
 for(let i=0;i<400;i++){const target=beatSyncTarget(master,a,1,follower,b);rate+=(target.rate-rate)*.25;a+=.05;b+=rate*.05;}
 const target=beatSyncTarget(master,a,1,follower,b);assert.ok(Math.abs(target.error)<.02);assert.ok(Math.abs(rate-1.1)<.01);
});
test('missing, irregular, exhausted and excessively different grids fall back',()=>{
 assert.equal(beatPosition(null,1),null);assert.equal(beatPosition(beats(.5),100),null);
 assert.equal(beatSyncTarget(beats(.5),2,1,beats(.9),2),null);
 assert.equal(beatPosition([0,.5,1,1.1,2,2.5],.8),null);
 assert.equal(alignedStart(beats(.5),2,1,beats(.5),99),null);
});
