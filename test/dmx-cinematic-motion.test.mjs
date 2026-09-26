import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingScenes,scenePose} from '../public/dmx-light-scenes.js';
import {movingCues,movingCueAt,movingCueExposure} from '../public/dmx-moving-cues.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {MOVING_LIMITS} from '../public/dmx-moving-model.js';
import {motionEnvelope} from '../public/show-arrangement.js';
function score(){
 const duration=16;
 return {duration,sections:[{start:0,end:16,look:'flow',intensity:.55}],musicStyle:{segments:Array.from({length:8},(_,i)=>({start:i*2,end:i*2+2,scores:{orchestral:.2},tags:[]}))},arrangement:{times:[],accents:[],patterns:{phrases:[{start:0,end:16,energy:.55,movement:{driving:.2,character:'atmospheric'}}]},motionEnvelope:Array.from({length:64},(_,i)=>({time:i*.25,energy:i<32?.25+i/64:.75-(i-32)/80,tone:.4,sustain:.95,pitch:60+i/16}))}};
}
test('sustained soundtrack develops without a beat grid, following the recorded rise and release',()=>{
 const plan=score(),scene=lightingScenes(plan)[0],cues=movingCues(plan,'auto');
 assert.equal(scene.cinematic,true);assert.ok(cues.length>6);
 const first=scenePose(scene,0),peak=scenePose(scene,8),release=scenePose(scene,15);
 assert.ok(peak[3].pan>first[3].pan&&release[3].pan<peak[3].pan);
 assert.ok(peak[1].tilt>first[1].tilt);
 assert.ok(cues.slice(1).every(c=>c.reason==='cinematic-development'));
 for(let t=0;t<16;t+=.1)assert.equal(movingCueExposure(cues,t).level,1);
});
test('a genre hint alone never starts a timed cinematic loop',()=>{
 const constant=score();constant.arrangement.motionEnvelope.forEach(p=>Object.assign(p,{energy:.5,tone:.4,pitch:60}));
 assert.equal(movingCues(constant,'auto').length,1,'unchanging material holds its image');
 const unknown=score();delete unknown.musicStyle;
 assert.ok(lightingScenes(unknown).every(s=>!s.cinematic));
 const oneHint=score();oneHint.musicStyle.segments=oneHint.musicStyle.segments.slice(0,1);
 assert.ok(lightingScenes(oneHint).every(s=>!s.cinematic));
 const percussive=score();percussive.arrangement.motionEnvelope.forEach(p=>p.sustain=.3);
 assert.ok(lightingScenes(percussive).every(s=>!s.cinematic));
});
test('hybrid soundtrack tags can establish the profile without an orchestral label',()=>{
 const plan=score();plan.musicStyle.segments.forEach(s=>{s.scores.orchestral=0;s.tags=[{label:'Stage & Screen---Soundtrack',score:.14}];});
 assert.equal(lightingScenes(plan)[0].cinematic,true);
});
test('manual holds and measured silence retain priority over soundtrack motion',()=>{
 const plan=score();plan.sectionLighting=[{start:4,end:8,movement:0,rhythm:'none'}];
 const cues=movingCues(plan,'auto');
 assert.deepEqual(movingCueAt(cues,4),movingCueAt(cues,7.99));
 plan.arrangement.blackouts=[{start:10,end:12}];
 // A new immutable plan has a fresh scene/presence cache.
 const muted=structuredClone(plan),presence=movingPresenceAt({movingPlan:muted,songTime:11});
 assert.ok(Array.from({length:7},(_,i)=>movingPresenceLevel(presence,i,7)).every(v=>v===0));
});
test('acoustic envelope ignores silence and preserves crescendos',()=>{
 const silent=motionEnvelope(Array.from({length:200},()=>({rms:0,tone:.5})));
 assert.ok(silent.every(p=>p.energy===0&&p.sustain===0&&p.pitch===null));
 const rising=motionEnvelope(Array.from({length:400},(_,i)=>({rms:.02+i*.0004,tone:.4,leadMidi:60,leadConfidence:.8})));
 assert.ok(rising.at(-1).energy>rising[0].energy+.5);
});
test('missing downbeats do not discard measured exceptional attacks',()=>{
 const plan={duration:8,sections:[{start:0,end:8,look:'flow',intensity:.8}],arrangement:{times:[1,2.3,3,5],eventSalience:[.1,.95,.1,.1],patterns:{phrases:[{start:0,end:8,energy:.8,movement:{driving:.8}}]}}};
 assert.ok(movingCues(plan,'auto').some(c=>c.time===2.3),'actual offbeat event survives without a grid');
});
test('long connected cinematic moves obey velocity, acceleration and jerk limits',()=>{
 const cues=movingCues(score(),'auto'),dt=.002;
 let pose,velocity,acceleration;
 for(let t=0;t<16;t+=dt){
  const next=movingCueAt(cues,t);
  if(pose){
   const v=next.map((p,i)=>({pan:(p.pan-pose[i].pan)/dt,tilt:(p.tilt-pose[i].tilt)/dt}));
   const a=velocity&&v.map((p,i)=>({pan:(p.pan-velocity[i].pan)/dt,tilt:(p.tilt-velocity[i].tilt)/dt}));
   for(let i=0;i<4;i++)for(const key of ['pan','tilt']){
    assert.ok(Math.abs(v[i][key])<=MOVING_LIMITS[key].speed+.02);
    if(a)assert.ok(Math.abs(a[i][key])<=MOVING_LIMITS[key].acceleration+.05);
    if(a&&acceleration)assert.ok(Math.abs((a[i][key]-acceleration[i][key])/dt)<=MOVING_LIMITS[key].jerk+1);
   }
   velocity=v;acceleration=a;
  }
  pose=next;
 }
});
