import test from 'node:test';
import assert from 'node:assert/strict';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {settings} from '../lib/music.mjs';
const duration=16,beats=Array.from({length:32},(_,i)=>i*.5);
const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
const windows=Array.from({length:800},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
const make=audio=>compileShow(audio,duration,settings({arrangement:'auto'}),grid);
test('party and disco change interpretation, preserve timing and brightness limits',()=>{
 const base=make(windows),snapshot=structuredClone(base);
 const party=applyShowProfile(base,'party'),disco=applyShowProfile(base,'disco');
 for(const plan of [party,disco]){assert.deepEqual(plan.beatTiming.times,base.beatTiming.times);assert.deepEqual(plan.beatGrid,base.beatGrid);assert.ok(plan.frames.every(f=>f.dimming>=5&&f.dimming<=75));}
 const contrast=plan=>showFrameAt(plan,8).dimming-showFrameAt(plan,8.4).dimming;
 assert.ok(contrast(disco)<contrast(party));
 assert.ok(disco.colorEvents.length>party.colorEvents.length);assert.ok(contrast(party)>contrast(base));
 assert.notDeepEqual(disco.frames.map(f=>[f.r,f.g,f.b]),base.frames.map(f=>[f.r,f.g,f.b]));
 assert.deepEqual(base,snapshot);assert.equal(applyShowProfile(base,'auto'),base);
});
test('disco does not invent movement over silence or a constant pad',()=>{
 for(const rms of [0,.05]){
 const base=make(windows.map(w=>({...w,rms,bass:0,flux:0}))),disco=applyShowProfile(base,'disco');
 assert.equal(disco.arrangement.times.length,0);
 assert.deepEqual(disco.frames.map(f=>[f.r,f.g,f.b]),base.frames.map(f=>[f.r,f.g,f.b]));
 }
});
test('disco holds contrasting colors between musical accents and remains seek-stable',()=>{
 const base=make(windows),disco=applyShowProfile(base,'disco');
 const a=disco.colorEvents[2],b=disco.colorEvents[3];
 assert.ok(['r','g','b'].reduce((n,c)=>n+Math.abs(a[c]-b[c]),0)>200);
 for(const c of ['r','g','b'])assert.equal(showFrameAt(disco,(a.time+b.time)/2)[c],a[c]);
 const expected=showFrameAt(disco,b.time);showFrameAt(disco,15.9);assert.deepEqual(showFrameAt(disco,b.time),expected);
 assert.deepEqual(disco.beatTiming.times,base.beatTiming.times);
});
