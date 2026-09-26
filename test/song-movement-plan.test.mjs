import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement,songMovementAt,SONG_MOVEMENT_VERSION,movementAccentEnvelope} from '../public/song-movement-plan.js';
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

test('measured rhythm changes movement with identical energy and does not invent attacks from beats',()=>{
 const make=interval=>{const p=music(.8,.5);p.arrangement.bassAttacks=Array.from({length:Math.floor(32/interval)},(_,i)=>({time:i*interval,strength:.9}));p.songMovement=planSongMovement(p);return p;};
 const sparse=make(2),dense=make(.25),a=dense.songMovement.passages[0],b=sparse.songMovement.passages[0];
 assert.equal(a.energy,b.energy);assert.ok(a.rhythm.density>b.rhythm.density);assert.ok(a.motionDrive>b.motionDrive);
 const phaseTravel=p=>automaticGroupMotionAt(p,6).phase-automaticGroupMotionAt(p,2).phase;
 assert.ok(phaseTravel(dense)>phaseTravel(sparse));
 const noAttacks=planSongMovement(music(.8,.5));
 assert.ok(noAttacks.passages.every(p=>p.accents.length===0&&p.rhythm.confidence===0));
});

test('constant overall level can still contain measured rhythmic activity',()=>{
 const p=music(.8,.5),windows=Array.from({length:1600},(_,i)=>({rms:.2,bass:i%25<3?.15:.02}));
 const steady=windows.map(w=>({...w,bass:.02}));
 assert.ok(planSongMovement(p,windows).passages[0].rhythm.rate>planSongMovement(p,steady).passages[0].rhythm.rate);
});

function transitionPlan(attacks=true){
 const p={duration:16,sections:[{start:0,end:8,look:'flow'},{start:8,end:16,look:'peak'}],arrangement:{patterns:{phrases:[{start:0,end:8,energy:.45,tone:.5,movement:{driving:.65}},{start:8,end:16,energy:.95,tone:.5,movement:{driving:.9}}]},bassAttacks:attacks?[{time:8,strength:1}]:[]}};
 p.songMovement=planSongMovement(p);return p;
}
test('only supported arrivals prepare faster handovers, and targets remain continuous',()=>{
 const strong=transitionPlan(),uncertain=transitionPlan(false),before=strong.songMovement.passages[0],incoming=strong.songMovement.passages[1];
 assert.ok(before.anticipation);assert.ok(incoming.transition.confidence>.65);
 assert.equal(uncertain.songMovement.passages[0].anticipation,undefined);
 assert.ok(incoming.transition.overlap<uncertain.songMovement.passages[1].transition.overlap);
 for(const time of [before.anticipation.start,8,8+incoming.transition.overlap])for(let rank=0;rank<8;rank++){
  const a=groupComposition(automaticGroupMotionAt(strong,time-.00001),rank,8,0,6),b=groupComposition(automaticGroupMotionAt(strong,time+.00001),rank,8,0,6);
  for(const key of ['x','y','weight','level'])assert.ok(Math.abs(a[key]-b[key])<.001,key+' at '+time);
 }
});

test('recurring motifs with the same musical role recall their group geometry',()=>{
 const p=music(.8,.7);p.sections=[0,8,16,24].map((start,i)=>({start,end:start+8,look:'peak',motif:i%2}));
 const score=planSongMovement(p);
 assert.equal(score.passages[0].composition,score.passages[2].composition);
 assert.equal(score.passages[2].recalled,true);
});

test('confident instrument leadership affects supporting rows, ambiguous mixes do not',()=>{
 const make=level=>{const p=music(.8,.7);p.structure={instruments:{step:1,drums:Array(32).fill(.04),bass:Array(32).fill(.04),vocals:Array(32).fill(level),other:Array(32).fill(.04)}};p.songMovement=planSongMovement(p);return p;};
 const vocal=make(.5),mixed=make(.04);
 assert.equal(vocal.songMovement.passages[0].attention.leader,'vocals');
 assert.equal(mixed.songMovement.passages[0].attention.confidence,0);
 const motion=automaticGroupMotionAt(vocal,5);
 const neutral={...motion,intent:{...motion.intent,attention:{leader:'mixed',confidence:0}}};
 assert.deepEqual(groupComposition(motion,0,8,0,6),groupComposition(neutral,0,8,0,6));
 assert.notDeepEqual(groupComposition(motion,0,8,2,6),groupComposition(neutral,0,8,2,6));
});


test('accent reach stays bounded, returns to neutral and survives seeking',()=>{
 const p=music(.8,.7);p.arrangement.bassAttacks=[{time:1,strength:1},{time:1.2,strength:.6},{time:2,strength:.8}];
 const intent=planSongMovement(p).passages[0];
 let previous=0;
 for(let t=0;t<4;t+=.005){const phase=movementAccentEnvelope(intent,t);assert.ok(phase>=0&&phase<1);assert.ok(Math.abs(phase-previous)<.03);previous=phase;}
 assert.equal(movementAccentEnvelope(intent,4),0);
 const at=movementAccentEnvelope(intent,1.35);movementAccentEnvelope(intent,5);assert.equal(movementAccentEnvelope(intent,1.35),at);
 for(const t of [1,1.2,1.45,1.65,2,2.45])assert.ok(Math.abs(movementAccentEnvelope(intent,t+.00001)-movementAccentEnvelope(intent,t-.00001))<.0001);
});

test('subdivision evidence is relative to measured beats and duplicate attack sources count once',()=>{
 const p=music(.8,.7);p.beatGrid.beats=Array.from({length:64},(_,i)=>i*.5);
 p.arrangement.bassAttacks=Array.from({length:128},(_,i)=>({time:i*.25,strength:1}));
 const windows=Array.from({length:1600},(_,i)=>({rms:i%25<3?.2:.03,bass:.01}));
 const score=planSongMovement(p,windows),first=score.passages[0];
 assert.equal(first.rhythm.kind,'subdivided');assert.ok(first.rhythm.subdivisions>1.35);
 assert.ok(first.accents.every((e,i)=>!i||e.time-first.accents[i-1].time>=.08-1e-9));
});

test('lead rows keep the shared cycle across many repetitions',()=>{
 const motion={composition:'crossed-banks',progress:.4,phase:0,energy:.8,amount:1,intent:{extent:1.2,attention:{leader:'vocals',confidence:1}}};
 for(const row of [0,2,5])for(let rank=0;rank<8;rank++){
  const a=groupComposition(motion,rank,8,row,6);
  for(const cycles of [1,7,20]){
   const b=groupComposition({...motion,phase:cycles*2*Math.PI},rank,8,row,6);
   assert.ok(Math.abs(a.x-b.x)<1e-10&&Math.abs(a.y-b.y)<1e-10,'support rows must not develop a separate clock');
  }
 }
});

test('accents do not accumulate extra rotation in automatic or show group movement',async()=>{
 const {showGroupMotionAt}=await import('../public/dmx-group-motion.js');
 const p=music(.8,.7);p.arrangement.bassAttacks=Array.from({length:128},(_,i)=>({time:i*.25,strength:1}));p.songMovement=planSongMovement(p);
 const neutral=structuredClone(p);neutral.songMovement.passages.forEach(s=>s.accents=[]);
 for(const time of [3,10,23,30]){
  assert.equal(automaticGroupMotionAt(p,time).phase,automaticGroupMotionAt(neutral,time).phase);
  assert.equal(showGroupMotionAt(p,time,{role:'groove'}).phase,showGroupMotionAt(neutral,time,{role:'groove'}).phase);
 }
});
