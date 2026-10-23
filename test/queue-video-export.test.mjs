import test from 'node:test';
import assert from 'node:assert/strict';
import {planQueueExport} from '../public/queue-export-plan.js';
import {queueVideoSources,queueVideoStreams} from '../public/queue-video-timeline.js';
import {compileShow} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
const track=(id,cuts=[])=>({id,name:id,audioCuts:cuts,plan:compileShow(Array.from({length:500},(_,i)=>({rms:.1+.08*Math.sin(i/9),bass:.02,beatSeq:Math.floor(i/25)})),10,settings())});
const entries=(...ids)=>ids.map((trackId,i)=>({id:String(i),trackId}));
test('video timestamps follow source cuts and both sides of a playlist transition',()=>{
 const a=track('a',[[2,4]]),b=track('b'),schedule=planQueueExport(entries('a','b'),[a,b],{seconds:2,musical:false});
 assert.equal(queueVideoSources(schedule,2.1)[0].songTime,4.1);
 const middle=schedule.rows[1].start+1,sources=queueVideoSources(schedule,middle);
 assert.deepEqual(sources.map(s=>s.track.id),['a','b']);assert.equal(sources[1].songTime,1);
 assert.ok(sources.every(s=>s.weight>0&&s.weight<1));
 assert.equal(queueVideoSources(schedule,schedule.duration).length,0);
 const streams=queueVideoStreams(schedule,middle,50);
 assert.equal(streams[1].songTime,1);assert.equal(streams[1].movingPlan,b.plan);assert.equal(streams[1].flicker,50);assert.equal(streams[1].playing,true);
});
test('duplicate songs keep distinct source identities and export streams are repeatable',()=>{
 const schedule=planQueueExport(entries('a','a'),[track('a')],{seconds:2,musical:false});
 const streams=queueVideoStreams(schedule,9);
 assert.equal(new Set(streams.map(s=>s.source)).size,2);
 assert.deepEqual(streams,queueVideoStreams(schedule,9));
});
