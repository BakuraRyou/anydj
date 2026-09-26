import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement,songMovementAt,SONG_MOVEMENT_VERSION} from '../public/song-movement-plan.js';
import {automaticGroupScore,automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
import {compileShow} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
const music=(energy,drive)=>({duration:32,sections:[{start:0,end:32,look:'flow'}],beatGrid:{downbeats:Array.from({length:17},(_,i)=>i*2)},arrangement:{patterns:{phrases:[0,8,16,24].map(start=>({start,end:start+8,energy,tone:.5,movement:{driving:drive}}))}}});
test('analysis persists a deterministic musical movement score without room or filename input',()=>{
 const p=music(.9,.95),original=structuredClone(p),score=planSongMovement(p);
 assert.equal(score.character,'driving');assert.equal(score.version,SONG_MOVEMENT_VERSION);
 assert.ok(score.passages.some(p=>p.composition&&p.motion));
 assert.deepEqual(planSongMovement({...p,filename:'quiet.mp3',fixtureCount:192}),score);
 assert.deepEqual(p,original);
 const prepared=JSON.parse(JSON.stringify({...p,songMovement:score}));
 assert.deepEqual(automaticGroupScore(prepared).map(p=>p.composition),score.passages.map(p=>p.composition));
 for(const time of [3,10,23])assert.deepEqual(automaticGroupMotionAt(prepared,time),automaticGroupMotionAt({...p,songMovement:score},time));
 assert.equal(songMovementAt(prepared,32),null);assert.equal(songMovementAt(prepared,NaN),null);
});
test('quiet music does not inherit driving gestures and manual holds still freeze the prepared score',()=>{
 const quiet={duration:16,sections:[{start:0,end:16,look:'quiet',intensity:.1}]};
 assert.ok(planSongMovement(quiet).passages.every(p=>!p.motion&&p.pace===1));
 const p=music(.9,.95);p.songMovement=planSongMovement(p);p.sectionLighting=[{start:8,end:24,movement:0}];
 assert.deepEqual(automaticGroupMotionAt(p,9),automaticGroupMotionAt(p,20));
 for(let time=.1;time<32;time+=.2)for(let rank=0;rank<8;rank++){
  const target=groupComposition(automaticGroupMotionAt(p,time),rank,8,2,6);
  assert.ok(target.x>=0&&target.x<=1&&target.y>=0&&target.y<=1);
 }
});
test('compileShow includes the score in the cacheable analysis result',()=>{
 const windows=Array.from({length:600},(_,i)=>({rms:.2,bass:.1,beatSeq:Math.floor(i/25)}));
 const plan=compileShow(windows,12,settings());
 assert.equal(plan.songMovement.version,SONG_MOVEMENT_VERSION);
 assert.deepEqual(JSON.parse(JSON.stringify(plan.songMovement)),plan.songMovement);
 assert.ok(plan.songMovement.passages.length>0);
});
