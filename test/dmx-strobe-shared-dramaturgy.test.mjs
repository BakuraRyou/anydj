import {planFormationEntrances} from '../public/dmx-strobe-choreography.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {musicalStageScore} from '../public/dmx-musical-score.js';
import {automaticGroupScore,automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
import {strobeConductor} from '../public/dmx-strobe-conductor.js';
import {strobeSentenceFor} from '../public/dmx-strobe-conductor.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {movingCues} from '../public/dmx-moving-cues.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {automaticStage,automaticDimming} from '../public/dmx-auto.js';
import {showFrameAt} from '../public/show-plan.js';
import {strobeBaseDimming} from '../public/dmx-strobe.js';

function song(){
 const duration=24,beats=Array.from({length:48},(_,i)=>i*.5);
 const looks=['held','flow','lift','peak','flow','held'];
 const energy=[.15,.5,.65,.95,.5,.15],drive=[.05,.35,.55,.9,.35,.05];
 const phrases=looks.map((look,i)=>({start:i*4,end:(i+1)*4,energy:energy[i],tone:.5,
  kind:look==='lift'?'build':look==='peak'?'bounce':look==='held'?'wash':'sweep',
  movement:{driving:drive[i],character:drive[i]>=.45?'rhythmic':'atmospheric'}}));
 const p={duration,showProfile:'strobe',step:.125,frames:Array.from({length:192},()=>({state:true,dimming:70,r:255,g:30,b:0})),
  sections:looks.map((look,i)=>({start:i*4,end:(i+1)*4,look,motif:i===4?1:i})),
  beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)},beatTiming:{minimum:5,maximum:100,times:beats},
  arrangement:{step:.125,times:beats,accents:beats.map(()=>.65),eventSources:beats.map(()=>'onset'),
   eventSalience:beats.map(()=>.4),decays:beats.map(()=>.25),bases:Array(192).fill(.4),
   patterns:{phrases},lookTrack:Array.from({length:192},(_,i)=>looks[Math.floor(i/32)]),
   drama:{step:.125,intensity:Array.from({length:192},(_,i)=>energy[Math.floor(i/32)]),
    percussion:Array.from({length:192},(_,i)=>drive[Math.floor(i/32)]),vocalShare:Array(192).fill(0)}}};
 p.songMovement=planSongMovement(p);return p;
}
test('Strobo retains musical passage boundaries and supplies its own formation and motor timeline',()=>{
 const p=song(),automatic=automaticGroupScore(p,true),conductor=strobeConductor(p);
 assert.deepEqual(conductor.sequences.map(s=>[s.start,s.end]),automatic.map(s=>[s.start,s.end]));
 let distinct=false;
 for(const t of [6,10,14,18]){
  const figure=strobeScoreAt(p,t),motion=automaticGroupMotionAt(p,t,true);
  for(let rank=0;rank<8;rank++){
   const a=groupComposition(motion,rank,8),b=strobeComposition(figure,rank,8);
   distinct ||= Math.hypot(a.x-b.x,a.y-b.y)>.05;
  }
 }
 assert.ok(distinct,'Strobo draws independent beam pictures');
 const cues=movingCues(p,'strobe');
 assert.ok(cues.length>1&&cues.every(c=>c.pose.every(p=>Number.isFinite(p.pan)&&Number.isFinite(p.tilt))));
 assert.notEqual(JSON.stringify(cues),JSON.stringify(movingCues(p,'auto','balanced')));
});
test('light runs remain visible with stationary motors and repeat on measured entrances',()=>{
 const base=strobeScoreAt(song(),14),sequence={...base.music.sequence,formationProgram:undefined,strobeSentence:'pair-run',continuing:true,role:'groove'};
 const at=beat=>{const event={time:0,duration:.2,strength:1,formationStep:Math.floor(beat),holdEnd:2,releaseEnd:2.4};return {...base,music:{...base.music,sequence:{...sequence,formationId:'crossed-fans',time:.5,formationEntries:[event],formationEntrances:[event]}}};};
 const trace=beat=>Array.from({length:16},(_,rank)=>strobeComposition(at(beat),rank,16));
 const a=trace(0),b=trace(1),again=trace(8);
 assert.deepEqual(a.map(p=>[p.x,p.y]),b.map(p=>[p.x,p.y]),'shutter changes do not restart motors');
 assert.notDeepEqual(a.map(p=>p.level),b.map(p=>p.level),'light transfers to a different pair');
 assert.deepEqual(a.map(p=>p.level),again.map(p=>p.level));
 for(const row of [a,b])for(let i=0;i<16;i++)assert.equal(row[i].level,row[15-i].level);
});
test('all pair and row sequences visit the complete rig, including small and odd installations',()=>{
 const base=strobeScoreAt(song(),14);
 for(const sentence of ['pair-run','centre-out','zipper','row-steps','edge-in','ripple'])
 for(const count of [1,2,3,8,16])for(const groups of [1,3,12]){
  const maxima=Array.from({length:groups},()=>Array(count).fill(0));
  for(let tick=0;tick<256;tick++){
   const beat=tick/32+.03;
   const figure={...base,rhythmBeat:beat,music:{...base.music,sequence:{...base.music.sequence,strobeSentence:sentence,formationProgram:undefined,continuing:true,role:'groove',time:.5,formationEntries:[{time:0,strength:1,formationStep:tick,holdEnd:2,releaseEnd:2.4}],formationEntrances:[{time:0}]}}};
   for(let row=0;row<groups;row++)for(let rank=0;rank<count;rank++){
    const c=strobeComposition(figure,rank,count,row,groups);
    assert.ok(Number.isFinite(c.level)&&c.level>=0&&c.level<=1);
    maxima[row][rank]=Math.max(maxima[row][rank],c.level);
   }
  }
  assert.ok(maxima.flat().every(v=>v>.5),`${sentence}: ${count} heads / ${groups} rows all receive an entrance`);
 }
});
test('blackouts, manual movement holds, rhythm none and zero flicker remain authoritative',()=>{
 const p=song();p.arrangement.blackouts=[{start:13,end:14}];
 const presence=movingPresenceAt({movingPlan:p,songTime:13.5,stageMode:'strobe',flicker:53});
 assert.ok(Array.from({length:8},(_,i)=>movingPresenceLevel(presence,i,8)).every(v=>v===0));
 p.sectionLighting=[{start:4,end:8,movement:0,rhythm:'none'}];
 const poses=t=>Array.from({length:8},(_,i)=>strobeComposition(strobeScoreAt(p,t),i,8));
 assert.deepEqual(poses(5),poses(7));
 const steady=t=>Array.from({length:8},(_,i)=>strobeComposition({...strobeScoreAt(p,t),flicker:0},i,8).level);
 assert.deepEqual(steady(14),steady(15));
});
test('source brightness does not extinguish offbeat answers with a second master pulse',()=>{
 const p=song();
 const source=time=>({movingPlan:p,songTime:time,frame:{state:true,dimming:12,r:255,g:0,b:0},washDimming:35,flicker:100});
 assert.equal(strobeBaseDimming(source(14.05)),strobeBaseDimming(source(14.3)));
 const ceiling=structuredClone(p);ceiling.effectiveOptions={maximum:40};
 assert.equal(strobeBaseDimming({...source(14),washDimming:90,movingPlan:ceiling}),40);
 assert.equal(strobeBaseDimming({...source(14),frame:{state:false,dimming:0}}),0);
});
