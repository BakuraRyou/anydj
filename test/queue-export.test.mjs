import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {cleanCuts,keptRanges,editedDuration,nextKeptTime,keptTimeBetween,fitCutTransition,cleanCutJoins,cutAudioClips,cutClock,cutTransitionFits} from '../public/track-cuts.js';
import {planQueueExport} from '../public/queue-export-plan.js';
import {exportGainAt,exportBassAt} from '../public/queue-audio-export.js';
import {copySetTransition,matchingSetTransition} from '../public/setlist-transition.js';

const track=(id,duration=30,audioCuts=[])=>({id,name:id,audioCuts,plan:{duration}});
const entries=(...ids)=>ids.map((trackId,i)=>({id:String(i),trackId}));
test('cuts are clamped, merged and mapped through original source time',()=>{
 const cuts=cleanCuts([[10,20],[15,25],[-1,2],[29,40],[5,4],[NaN,6]],30);
 assert.deepEqual(cuts,[[0,2],[10,25],[29,30]]);
 assert.deepEqual(keptRanges(cuts,30),[[2,10],[25,29]]);
 assert.equal(editedDuration(cuts,30),12);
 assert.equal(nextKeptTime(cuts,30,15),25);
 assert.equal(nextKeptTime(cuts,30,29),30);
 assert.equal(keptTimeBetween(cuts,30,5,27),7);
});
test('all queue entries, including duplicates, appear in order with an overlapped duration',()=>{
 const schedule=planQueueExport(entries('a','b','a'),[track('a'),track('b')],{seconds:4,musical:false});
 assert.equal(schedule.rows.length,3);assert.equal(schedule.duration,82);
 assert.deepEqual(schedule.clips.map(c=>[c.index,c.start,c.end,c.sourceStart]),[[0,0,30,0],[1,26,56,0],[2,52,82,0]]);
});
test('internal edits and trimmed intro/outro remove their audio without timeline gaps',()=>{
 const schedule=planQueueExport(entries('a','b'),[track('a',30,[[0,2],[5,10],[28,30]]),track('b',30,[[0,3]])],{seconds:4,musical:false});
 assert.equal(schedule.duration,44);
 assert.deepEqual(schedule.clips.map(c=>[c.start,c.end,c.sourceStart]),[[0,3,2],[3,21,10],[17,44,3]]);
 assert.equal(schedule.clips[0].fadeOut,true);assert.equal(schedule.clips[1].fadeIn,true);
});
test('saved times, curves and styles survive export planning',()=>{
 const list=entries('a','b'),points=[[[0,1],[.5,.8],[1,0]],[[0,0],[.5,.3],[1,1]]];
 list[1].transition=copySetTransition({fromEntryId:'0',fromTrackId:'a',toTrackId:'b',fromDuration:30,toDuration:30,plan:{time:20,cue:3,duration:4,style:'bass',points}});
 const schedule=planQueueExport(list,[track('a'),track('b')]);
 assert.equal(schedule.duration,47);assert.equal(schedule.rows[1].cue,3);
 assert.deepEqual(schedule.rows[0].outgoing.plan.points,points);
 const clip=schedule.clips[0];assert.equal(exportGainAt(clip,22),.8);assert.equal(exportBassAt(clip,22),-18);
 assert.equal(exportGainAt(schedule.clips[1],22),.3);assert.equal(exportBassAt(schedule.clips[1],25),0);
});
test('cuts invalidate saved transitions that include deleted material',()=>{
 const list=entries('a','b'),a=track('a',30,[[21,23]]),b=track('b');
 list[1].transition=copySetTransition({fromEntryId:'0',fromTrackId:'a',toTrackId:'b',fromDuration:30,toDuration:30,plan:{time:20,cue:0,duration:4,style:'smooth'}});
 assert.equal(matchingSetTransition(list[1],list[0],a.plan,b.plan,1,1,a,b),null);
 assert.throws(()=>planQueueExport(list,[a,b]),/gespeicherter Übergang/);
});
test('fades fit within retained source passages and never cross a cut',()=>{
 const a=track('a',30,[[20,25]]),b=track('b',30,[[0,3],[5,8]]);
 assert.deepEqual(fitCutTransition({time:22,cue:0,duration:8,style:'smooth'},a,b),{time:25,cue:3,duration:2,style:'smooth',alternatives:undefined,audioProfile:null,reason:'An die hörbaren Liedteile angepasst.'});
});
test('short middle tracks cannot create three overlapping decks',()=>{
 assert.throws(()=>planQueueExport(entries('a','b','c'),[track('a'),track('b',2),track('c')],{seconds:4,musical:false}),/überschneiden/);
});
test('invalid inputs fail before encoding and input lists remain unchanged',()=>{
 assert.throws(()=>planQueueExport([],[]),/leer/);
 assert.throws(()=>planQueueExport([{provider:'spotify'}],[]),/Streaming/);
 assert.throws(()=>planQueueExport(entries('missing'),[]),/fehlt/);
 assert.throws(()=>planQueueExport(entries('a'),[track('a',30,[[0,30]])]),/hörbarer/);
 const list=entries('a','a'),tracks=[track('a',30,[[10,15]])],before=JSON.stringify({list,tracks});
 planQueueExport(list,tracks,{seconds:4,musical:false});assert.equal(JSON.stringify({list,tracks}),before);
});
test('a single edited song retains its entire kept duration',()=>{
 const schedule=planQueueExport(entries('a'),[track('a',30,[[5,10],[20,25]])]);
 assert.equal(schedule.duration,20);assert.deepEqual(schedule.clips.map(c=>c.sourceStart),[0,10,25]);
 const middle=schedule.clips[1];assert.equal(exportGainAt(middle,middle.start),0);assert.equal(exportGainAt(middle,middle.start+.1),1);assert.equal(exportGainAt(middle,middle.end),0);
});
test('internal transitions overlap retained passages, shorten the mix and use saved gain curves',()=>{
 const points=[[[0,1],[.5,.75],[1,0]],[[0,0],[.5,.25],[1,1]]];
 const a={...track('a',12,[[4,8]]),audioCutJoins:[{cut:[4,8],duration:1,style:'bass',points}]};
 const schedule=planQueueExport(entries('a'),[a]);
 assert.equal(schedule.duration,7);assert.equal(editedDuration(a.audioCuts,12,a.audioCutJoins),7);
 assert.deepEqual(schedule.clips.map(c=>[c.sourceStart,c.start,c.end]),[[0,0,4],[8,3,7]]);
 assert.equal(exportGainAt(schedule.clips[0],3.5),.75);assert.equal(exportGainAt(schedule.clips[1],3.5),.25);
 assert.equal(exportBassAt(schedule.clips[0],3.5),-18);assert.equal(exportBassAt(schedule.clips[1],4.1),0);
 assert.equal(cutTransitionFits({time:3,cue:0,duration:.5},a,track('b')),false,'a song handover cannot interrupt the internal join');
});
test('multiple cut joins retain a continuous clock and stop invalidating unrelated valid joins',()=>{
 const cuts=[[4,6],[10,12]],joins=[{cut:[4,6],duration:1,style:'smooth'},{cut:[10,12],duration:1,style:'smooth'}];
 const clips=cutAudioClips(cuts,16,joins);
 assert.deepEqual(clips.map(c=>[c.sourceStart,c.start,c.end]),[[0,0,4],[6,3,7],[12,6,10]]);
 assert.equal(clips[1].cutIncoming.start,3);assert.equal(clips[1].cutOutgoing.start,6);
 assert.equal(editedDuration(cuts,16,joins),10);
 assert.equal(cleanCutJoins(joins,[[4,7],[10,12]],16).length,1);
 assert.equal(cleanCutJoins([{cut:[4,6],duration:3,style:'smooth'},{cut:[10,12],duration:2,style:'smooth'}],cuts,16).length,1,'joins must not overlap inside a retained middle passage');
 assert.equal(cutClock(65.08),'1:05,08');assert.equal(cutClock(59.999),'1:00,00');assert.equal(cutClock(210,0),'3:30');
});
test('the real bundled MP3 worker encodes successive PCM chunks into a continuous stream',async()=>{
 const encoder=await readFile(new URL('../public/lame.min.js',import.meta.url),'utf8'),worker=await readFile(new URL('../public/audio-export-worker.js',import.meta.url),'utf8'),messages=[];
 const sandbox={postMessage:message=>messages.push(message),importScripts:()=>{},console,Int16Array,Uint8Array,Float32Array};
 runInNewContext(encoder+'\n'+worker,sandbox);
 sandbox.onmessage({data:{type:'start',bitrate:192}});assert.equal(messages.pop().ready,true);
 let bytes=0;
 for(let block=0;block<2;block++){
  const samples=Float32Array.from({length:44100},(_,i)=>.3*Math.sin((i+block*44100)*2*Math.PI*440/44100));
  sandbox.onmessage({data:{type:'chunk',left:samples,right:samples}});
  const reply=messages.pop();assert.equal(reply.error,undefined);bytes+=reply.parts.reduce((n,b)=>n+b.length,0);
 }
 sandbox.onmessage({data:{type:'finish'}});const reply=messages.pop();assert.equal(reply.done,true);bytes+=reply.bytes.length;
 assert.ok(bytes>45000&&bytes<52000,`two seconds of 192k MP3: ${bytes} bytes`);
});
