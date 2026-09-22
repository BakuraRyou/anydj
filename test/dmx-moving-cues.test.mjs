import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
import {followMovingHeads,movingHeadTargets} from '../public/dmx-moving-model.js';
const song=(times=[2,4,6])=>({duration:12,sections:[{start:0,end:12,look:'peak'}],beatGrid:{beats:Array.from({length:25},(_,i)=>i/2)},arrangement:{times,accents:times.map(()=>.6),patterns:{phrases:[{start:0,end:12,energy:.8,tone:.5}],events:times.map((_,i)=>({kind:'bounce',alternate:i%2}))}}});
const compile=p=>{const job=movingPlanJob(p);while(!job.done)job.advance();return job.result;};
const symmetric=pose=>{for(const [a,b] of [[0,3],[1,2]]){assert.ok(Math.abs(pose[a].pan+pose[b].pan)<1e-5);assert.ok(Math.abs(pose[a].tilt-pose[b].tilt)<1e-5);}};
test('destinations arrive on selected audio events and hold between moves',()=>{
  const cues=movingCues(song(),'auto'),plan=compile(song());
  for(const cue of cues){
    assert.deepEqual(movingCueAt(cues,cue.time),cue.pose);
    movingPlanAt(plan,cue.time).forEach((p,i)=>assert.ok(Math.abs(p.pan-cue.pose[i].pan)<1e-5));
  }
  assert.deepEqual(movingCueAt(cues,8),movingCueAt(cues,11));
  assert.notDeepEqual(compile(song([3,5,7])).values,plan.values);
  assert.deepEqual(movingCueAt(movingCues(song([]),'auto'),8),movingCueAt(movingCues(song([]),'auto'),0));
});
test('all formations and transitions coordinate mirrored outer and inner pairs',()=>{
  for(const kind of ['punch','build','sweep','bounce','wash'])for(const mode of ['auto','wash','follow','alternate']){
    const p=song();p.arrangement.patterns.events=p.arrangement.times.map((_,i)=>({kind,alternate:i%2,progress:i/2}));
    const cues=movingCues(p,mode);
    for(let t=0;t<=12;t+=.025)symmetric(movingCueAt(cues,t));
  }
  for(const look of ['held','flow','lift','peak'])for(let beat=0;beat<16;beat+=.25)symmetric(movingHeadTargets([{frame:{dimming:80},weight:1,look,beat}], 'auto'));
});
test('audio energy and vocal presence shape formation width',()=>{
  const p=song(),low=structuredClone(p);low.arrangement.patterns.phrases[0].energy=.1;
  assert.ok(Math.abs(movingCues(p,'auto')[1].pose[0].pan)>Math.abs(movingCues(low,'auto')[1].pose[0].pan));
  const vocal=structuredClone(p);vocal.arrangement.drama={step:1,intensity:Array(13).fill(.8),percussion:Array(13).fill(.6),vocalShare:Array(13).fill(1),attacks:Array(13).fill(0)};
  const instrumental=structuredClone(vocal);instrumental.arrangement.drama.vocalShare.fill(0);
  assert.ok(Math.abs(movingCues(vocal,'auto')[1].pose[1].pan)<Math.abs(movingCues(instrumental,'auto')[1].pose[1].pan));
});
test('dense cues respect motor speed; prepared playback adds no smoothing delay',()=>{
  const cues=movingCues(song(Array.from({length:30},(_,i)=>(i+1)*.4)),'auto');
  let prior=movingCueAt(cues,0);
  for(let time=.01;time<12;time+=.01){
    const next=movingCueAt(cues,time);
    next.forEach((p,i)=>{assert.ok(Math.abs(p.pan-prior[i].pan)<=.70001);assert.ok(Math.abs(p.tilt-prior[i].tilt)<=.00801);});
    const rendered=followMovingHeads(prior,next,.01);
    rendered.forEach((p,i)=>assert.ok(Math.abs(p.pan-next[i].pan)<1e-9));
    prior=next;
  }
});
