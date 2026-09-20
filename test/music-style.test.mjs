import test from 'node:test';
import assert from 'node:assert/strict';
import {STYLE_FAMILIES,validateMusicStyle,musicStyleAt} from '../public/music-style.js';
import {compileShow} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
const scores=values=>Object.fromEntries(STYLE_FAMILIES.map(name=>[name,values[name]||0]));
const segment=(start,end,values)=>({start,end,scores:scores(values),tags:[]});
const style=segments=>({version:1,source:'discogs-effnet',duration:segments.at(-1).end,segments});
test('simultaneous electronic and orchestral evidence stays mixed',()=>{
 const value=validateMusicStyle(style([segment(0,2,{electronic:.7,orchestral:.6})]),2);
 const profile=musicStyleAt(value,1);
 assert.ok(profile.weights.electronic>.4&&profile.weights.orchestral>.35);
 assert.ok(profile.melody>.35&&profile.melody<.6);
 assert.ok(profile.drive>1);
});
test('styles change within a song smoothly and uncertain evidence keeps neutral design',()=>{
 const value=style(Array.from({length:10},(_,i)=>segment(i*2,i*2+2,i<5?{electronic:.8}:{orchestral:.8})));
 assert.ok(musicStyleAt(value,3).colorSpeed>musicStyleAt(value,17).colorSpeed);
 const a=musicStyleAt(value,9.99),b=musicStyleAt(value,10.01);
 assert.ok(Math.abs(a.melody-b.melody)<.02);
 assert.equal(musicStyleAt(style([segment(0,2,{electronic:.02})]),1).confidence,0);
});
test('rejects missing intervals, invalid scores and mismatched audio duration',()=>{
 assert.throws(()=>validateMusicStyle(style([segment(0,2,{rock:NaN})]),3));
 assert.throws(()=>validateMusicStyle(style([segment(0,2,{rock:2})]),2));
 assert.throws(()=>validateMusicStyle(style([segment(0,2,{}),segment(3,4,{})]),4));
 assert.throws(()=>validateMusicStyle(style([segment(0,2,{})]),4));
});
test('style changes design without shifting beats or overriding manual settings',()=>{
 const duration=20,windows=Array.from({length:1000},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:.02,tone:.4,beatSeq:Math.floor(i/25)}));
 const beats=Array.from({length:40},(_,i)=>i*.5),grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
 const electronic=style(Array.from({length:10},(_,i)=>segment(i*2,i*2+2,{electronic:.8})));
 const classical=style(Array.from({length:10},(_,i)=>segment(i*2,i*2+2,{orchestral:.8})));
 const make=(musicStyle,auto=true)=>compileShow(windows,duration,settings({arrangement:auto?'auto':'manual'}),grid,null,musicStyle);
 const a=make(electronic),b=make(classical);
 assert.deepEqual(a.beatGrid,b.beatGrid);assert.deepEqual(a.arrangement.times,b.arrangement.times);
 assert.notDeepEqual(a.frames,b.frames);
 assert.ok(a.arrangement.decays[4]<b.arrangement.decays[4]);
 assert.deepEqual(make(electronic,false).frames,make(classical,false).frames);
});
