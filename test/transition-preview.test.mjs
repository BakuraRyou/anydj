import test from 'node:test';
import assert from 'node:assert/strict';
import {editTransitionPlan} from '../public/transition-preview.js';
const pair={from:{duration:100,rate:1},to:{duration:60,rate:1},plan:{time:90,cue:0,duration:8,style:'smooth',audioProfile:{a:.2,b:.1}}};
test('manual transition updates a copy and clears stale audio curve analysis',()=>{
 const result=editTransitionPlan(pair,{time:85,cue:4,duration:10,style:'bass'});
 assert.equal(result.time,85);assert.equal(result.cue,4);assert.equal(result.duration,10);assert.equal(result.style,'bass');assert.equal(result.manual,true);assert.equal(result.audioProfile,null);
 assert.equal(pair.plan.time,90);assert.notEqual(pair.plan.audioProfile,null);
});
test('edits validate both track ends and playback rates',()=>{
 for(const extra of [{time:-1},{cue:Infinity},{duration:0},{duration:61},{time:95,duration:8},{cue:55,duration:8},{style:'invalid'}])assert.throws(()=>editTransitionPlan(pair,{time:80,cue:0,duration:8,style:'smooth',...extra}));
 assert.throws(()=>editTransitionPlan({...pair,from:{duration:100,rate:2}},{time:90,cue:0,duration:8,style:'smooth'}));
 assert.equal(editTransitionPlan(pair,{time:90,cue:50,duration:10,style:'cut'}).duration,10);
});

test('time edits retain own control points; choosing another style resets them',()=>{
 const points=[[[0,1],[.4,.8],[1,0]],[[0,0],[.6,.3],[1,1]]];
 const edited={...pair,plan:{...pair.plan,points}};
 assert.deepEqual(editTransitionPlan(edited,{time:80,cue:0,duration:8,style:'smooth'}).points,points);
 assert.equal(editTransitionPlan(edited,{time:80,cue:0,duration:8,style:'cut'}).points,null);
});
