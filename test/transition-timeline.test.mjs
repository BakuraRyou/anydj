import test from 'node:test';
import assert from 'node:assert/strict';
import {timelineEdit} from '../public/transition-timeline.js';
const pair={from:{duration:100,rate:2},to:{duration:80,rate:1},plan:{time:80,cue:65,duration:8}};
test('timeline start positions preserve overlap and cannot cross either file boundary',()=>{
 assert.equal(timelineEdit(pair,'time',99),84);
 assert.equal(timelineEdit(pair,'cue',99),72);
 assert.equal(timelineEdit(pair,'cue',-3),0);
 assert.equal(timelineEdit(pair,'time',30),30);
 assert.equal(pair.plan.time,80);
});
test('shared overlap length respects both source rates and duration limits',()=>{
 assert.equal(timelineEdit(pair,'duration',Infinity),10);
 assert.equal(timelineEdit(pair,'duration',-1),.1);
 assert.equal(timelineEdit({...pair,plan:{...pair.plan,cue:78}},'duration',8),2);
});
