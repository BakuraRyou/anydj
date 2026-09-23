import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangementLevelAt,arrangementMotionAt} from '../public/show-arrangement.js';
import {activityAt} from '../public/dmx-activity.js';
const make=(character='atmospheric',more={})=>({step:.125,bases:Array(160).fill(.25),times:[1,1.5,2,2.5,3,3.5,4],accents:Array(7).fill(.45),decays:Array(7).fill(.13),eventSalience:Array(7).fill(.15),patterns:{events:Array.from({length:7},()=>({kind:'punch'})),phrases:[{start:0,end:20,kind:'bounce',movement:{character,contrast:.5},...more}]}});
test('atmospheric music holds light despite a dense event grid',()=>{
 const a=make();
 for(let t=.5;t<5;t+=.025){assert.equal(arrangementLevelAt(a,t),.25);assert.equal(arrangementMotionAt(a,t),0);}
});
test('flowing and voice-led music swells continuously instead of flashing on each event',()=>{
 for(const a of [make('flowing'),make('rhythmic',{attention:{leader:'vocals',confidence:.8}})]){
  assert.equal(arrangementLevelAt(a,1),.25);
  assert.ok(arrangementLevelAt(a,1.2)>.25);
  let previous=arrangementLevelAt(a,.9),maxJump=0;
  for(let t=.905;t<5;t+=.005){const level=arrangementLevelAt(a,t);maxJump=Math.max(maxJump,Math.abs(level-previous));previous=level;assert.ok(level<.4);}
  assert.ok(maxJump<.01);
  const before=arrangementLevelAt(a,2.2);arrangementLevelAt(a,4);assert.equal(arrangementLevelAt(a,2.2),before);
 }
});
test('percussive grooves and exceptional quiet hits remain clear',()=>{
 const rhythmic=make('rhythmic');assert.ok(arrangementLevelAt(rhythmic,1)>.65);
 const held=make();held.eventSalience[2]=.8;
 assert.ok(arrangementLevelAt(held,2)>.65);
 assert.ok(arrangementLevelAt(held,2.5)>.25,'a suppressed event must not cut the previous tail');
 assert.equal(arrangementLevelAt(held,4.1),.25);
});
test('soft swells do not trigger abrupt group switches, silence stays dark',()=>{
 const a=make('flowing'),plan={sections:[{start:0,end:20,look:'flow'}],arrangement:a};
 const at=songTime=>activityAt({movingPlan:plan,songTime,look:'flow'},4);
 assert.deepEqual(at(.5),at(3.8));
 a.bases.fill(0);assert.equal(arrangementLevelAt(a,1.2),0);
});
test('a rhythmic build swells, a supporting verse is softer, a feature retains punch',()=>{
 const section=(look,role)=>{const a=make('rhythmic');a.patterns.phrases[0].section=0;a.passages=[{look,role}];return a;};
 const build=section('lift','build'),verse=section('peak','support'),feature=section('peak','feature');
 assert.equal(arrangementLevelAt(build,1),.25);
 assert.ok(arrangementLevelAt(build,1.2)>.4);
 assert.ok(arrangementLevelAt(verse,1)<arrangementLevelAt(feature,1));
 assert.ok(arrangementLevelAt(verse,1.4)>arrangementLevelAt(feature,1.4));
 assert.ok(arrangementLevelAt(feature,1)>.65);
});
