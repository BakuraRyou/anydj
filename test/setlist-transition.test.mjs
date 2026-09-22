import test from 'node:test';
import assert from 'node:assert/strict';
import {copySetTransition,matchingSetTransition} from '../public/setlist-transition.js';
import {copyQueueEntry} from '../public/provider-queue.js';
const saved={fromEntryId:'one',fromTrackId:'a',toTrackId:'b',fromDuration:100,toDuration:80,plan:{time:80,cue:2,duration:8,style:'smooth',points:[[[0,1],[.5,.7],[1,0]],[[0,0],[.5,.4],[1,1]]]}};
test('saved set entries keep independent curve data when copied to the live queue',()=>{
 const source={id:'two',trackId:'b',transition:saved};
 const runtime=copyQueueEntry(source,'runtime-two');runtime.sourceEntryId=source.id;
 assert.deepEqual(runtime.transition.plan.points,saved.plan.points);
 runtime.transition.plan.points[0][1][1]=.1;assert.equal(saved.plan.points[0][1][1],.7);
 assert.ok(matchingSetTransition(runtime,{id:'runtime-one',sourceEntryId:'one',trackId:'a'},{duration:100},{duration:80}));
 assert.equal(source.id,'two');
});
test('changed neighbours, files and impossible playback rates reject stale set transitions',()=>{
 const entry={id:'two',trackId:'b',transition:saved},previous={id:'one',trackId:'a'};
 assert.equal(matchingSetTransition(entry,{...previous,id:'different'},{duration:100},{duration:80}),null);
 assert.equal(matchingSetTransition(entry,{...previous,trackId:'c'},{duration:100},{duration:80}),null);
 assert.equal(matchingSetTransition(entry,previous,{duration:99},{duration:80}),null);
 assert.equal(matchingSetTransition(entry,previous,{duration:100},{duration:80},3),null);
 assert.equal(copySetTransition({...saved,plan:{...saved.plan,time:99}}),null);
});
test('legacy entries still load and broken persisted curves are ignored',()=>{
 assert.deepEqual(copyQueueEntry({id:'one',trackId:'a'}),{id:'one',trackId:'a'});
 assert.equal(copyQueueEntry({id:'two',trackId:'b',transition:{...saved,plan:{...saved.plan,points:[]}}}).transition,undefined);
});
