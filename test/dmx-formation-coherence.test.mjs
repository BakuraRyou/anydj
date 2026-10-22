import test from 'node:test';
import assert from 'node:assert/strict';
import {formationStoryPose} from '../public/dmx-strobe-choreography.js';

const frame=({bass=.2,drums=.8,energy=.7,accent=0}={})=>({
 rows:[0,16].map(time=>({time,energy,tone:.5,bass,drums,pitch:.5,pitchConfidence:0})),
 clock:[{time:0,position:0,velocity:.2},{time:16,position:3.2,velocity:.2}],
 roles:{lead:accent?[{time:2,strength:accent}]:[],bass:[],drums:[]}
});
const story=(shape='crossed-fans',motion='relay',audioFrame=frame())=>({
 start:0,end:16,arcStart:0,arcEnd:16,knots:[{time:0,position:0},{time:16,position:1}],shape,motion,act:'interlace',direction:1,
 energy:.7,variation:{path:'traverse',gesture:'sweep',amplitude:.07,spread:1},audioFrame
});
const poses=(s,t,row=0)=>Array.from({length:12},(_,rank)=>formationStoryPose(s,t,rank,12,row,3));

test('a measured crossed fan retains evenly spaced rays while the light stroke travels across it',()=>{
 const s=story();
 for(let time=.3;time<15;time+=.17){
  const p=poses(s,time);
  for(let rank=1;rank<p.length-1;rank++)assert.ok(Math.abs(p[rank+1].x-2*p[rank].x+p[rank-1].x)<1e-10,
   `fan bent by a per-fixture stroke at ${time}s, fixture ${rank}`);
 }
});
test('mounting rows share the same horizontal gesture despite different bass and drum activity',()=>{
 const s=story('vertical-curtain');
 for(const time of [.8,2.07,4.3,7.8,12.1]){
  const a=poses(s,time,0),b=poses(s,time,2);
  a.forEach((p,i)=>assert.ok(Math.abs(p.x-b[i].x)<1e-10,'stem levels must not pull mounting rows apart'));
 }
});
test('light handovers change exposure without dragging individual beams out of their shared plane',()=>{
 const s=story('vertical-curtain'),samples=[1,2,3,4,5].map(t=>poses(s,t));
 for(const p of samples)assert.ok(Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y))<1e-10,'a curtain must stay a plane');
 assert.ok(new Set(samples.map(p=>JSON.stringify(p.map(v=>v.exposure)))).size>=4,'the rhythm still travels through the rig');
});
test('actual measured attacks still articulate exposure, without inventing an independent motor kick',()=>{
 const a=story('vertical-curtain','relay',frame()),b=story('vertical-curtain','relay',frame({accent:1}));
 const p=poses(a,2.09,1),q=poses(b,2.09,1);
 assert.ok(q.some((v,i)=>v.exposure>p[i].exposure+.02));
 q.forEach((v,i)=>{assert.equal(v.x,p[i].x);assert.equal(v.y,p[i].y);});
});
