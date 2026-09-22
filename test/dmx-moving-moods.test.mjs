import test from 'node:test';
import assert from 'node:assert/strict';
import {MOVING_MOODS,movingMood} from '../public/dmx-moving-moods.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,createMovingPreparation} from '../public/dmx-moving-plan.js';
import {movingHeadTargets} from '../public/dmx-moving-model.js';
const times=Array.from({length:64},(_,i)=>(i+1)*.5);
const plan={duration:32,beatGrid:{beats:[0,...times]},sections:[{start:0,end:32,look:'peak'}],arrangement:{times,accents:times.map(()=>.6),patterns:{phrases:[{start:0,end:32,energy:.8,tone:.5}],events:times.map((_,i)=>({kind:'bounce',alternate:i%2}))}}};
test('moods change spacing and range without inventing accents or breaking symmetry',()=>{
  const balanced=movingCues(plan,'auto'),calm=movingCues(plan,'auto','calm'),air=movingCues(plan,'auto','atmospheric');
  assert.ok(calm.length<balanced.length);assert.ok(air.length<calm.length);
  const width=cues=>Math.max(...cues.slice(1).flatMap(c=>c.pose.map(p=>Math.abs(p.pan))));
  assert.ok(width(calm)<width(balanced));
  for(const mood of Object.keys(MOVING_MOODS)){
    const cues=movingCues(plan,'auto',mood);
    assert.ok(cues.slice(1).every(c=>times.includes(c.time)));
    let previous=movingCueAt(cues,0);
    for(let time=.025;time<=32;time+=.025){
      const pose=movingCueAt(cues,time);
      for(const [a,b] of [[0,3],[1,2]])assert.ok(Math.abs(pose[a].pan+pose[b].pan)<1e-9);
      pose.forEach((p,i)=>assert.ok(Math.abs(p.pan-previous[i].pan)<=70*MOVING_MOODS[mood].speed*.025+1e-8));previous=pose;
    }
  }
});
test('fallback and demo use the same mood; invalid saved values use balanced',()=>{
  assert.equal(movingMood('unknown'),'balanced');assert.equal(movingMood(null),'balanced');
  const source={frame:{state:true,dimming:80},weight:1,beat:4,look:'peak'};
  assert.notDeepEqual(movingHeadTargets([{...source,movingMood:'calm'}]),movingHeadTargets([source]));
  const traces=[];
  for(const mood of Object.keys(MOVING_MOODS)){
    const job=movingPlanJob({...plan,arrangement:null},'auto',mood);while(!job.done)job.advance();traces.push(job.result.values);
  }
  for(let i=1;i<traces.length;i++)assert.notDeepEqual(traces[0],traces[i]);
});
test('cached moods remain separate and unfinished variants resume correctly',()=>{
  let task=null;
  const preparation=createMovingPreparation({schedule:fn=>{task=fn;return 1;},cancel:()=>{task=null;}});
  const drain=()=>{while(task){const next=task;task=null;next();}};
  preparation.setEnabled(true);preparation.prepare([plan],'auto','calm');
  const first=task;task=null;first();
  preparation.prepare([plan],'auto','atmospheric');drain();const air=preparation.read(plan,14,'auto','atmospheric');
  assert.equal(preparation.read(plan,14,'auto','calm'),null);
  preparation.prepare([plan],'auto','calm');drain();assert.notDeepEqual(preparation.read(plan,14,'auto','calm'),air);
  preparation.prepare([plan],'auto','atmospheric');assert.equal(task,null);assert.deepEqual(preparation.read(plan,14,'auto','atmospheric'),air);
  preparation.destroy();
});
