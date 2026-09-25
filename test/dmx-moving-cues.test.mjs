import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingPlanJob,movingPlanAt} from '../public/dmx-moving-plan.js';
import {followMovingHeads,movingHeadTargets,MOVING_LIMITS} from '../public/dmx-moving-model.js';
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
test('connected groove destinations keep velocity instead of stopping at every hit',()=>{
 const pose=pan=>Array.from({length:4},(_,i)=>({pan:i<2?-pan:pan,tilt:.8}));
 const cues=[{time:0,travel:0,pose:pose(0)},...[1,2,3].map(time=>({time,travel:1,reason:'groove',pose:pose(time*10)}))];
 const at=t=>movingCueAt(cues,t)[3].pan,h=.0001;
 for(const t of [1,2]){
  const left=(at(t)-at(t-h))/h,right=(at(t+h)-at(t))/h;
  assert.ok(left>9.9&&right>9.9);assert.ok(Math.abs(left-right)<.01);
 }
 for(let t=0;t<3;t+=.01)assert.ok(at(t)>=-1e-9&&at(t)<=30+1e-9);
});
test('isolated gestures start and stop with negligible acceleration and retain holds',()=>{
 const pose=pan=>Array.from({length:4},()=>({pan,tilt:.8}));
 const cues=[{time:0,travel:0,pose:pose(0)},{time:2,travel:1,pose:pose(10)}];
 const at=t=>movingCueAt(cues,t)[0].pan,h=.001;
 assert.equal(at(.9),0);assert.equal(at(2.1),10);
 for(const t of [1,2])assert.ok(Math.abs((at(t+h)-2*at(t)+at(t-h))/(h*h))<.11);
});

test('planned motion respects velocity, acceleration and jerk on both axes',()=>{
 const p=song(Array.from({length:24},(_,i)=>(i+1)*.47));
 p.arrangement.patterns.phrases[0].movement={character:'rhythmic',driving:1};
 p.arrangement.patterns.events.forEach(e=>e.driving=true);
 const prepared=compile(p),h=.001;
 let a=movingPlanAt(prepared,0),b=movingPlanAt(prepared,h),c=movingPlanAt(prepared,2*h);
 for(let t=3*h;t<11.5;t+=h){
  const d=movingPlanAt(prepared,t);
  d.forEach((v,i)=>{for(const key of ['pan','tilt']){
   const limit=MOVING_LIMITS[key];
   assert.ok(Math.abs((v[key]-c[i][key])/h)<=limit.speed*1.001);
   assert.ok(Math.abs((v[key]-2*c[i][key]+b[i][key])/(h*h))<=limit.acceleration*1.001);
   assert.ok(Math.abs((v[key]-3*c[i][key]+3*b[i][key]-a[i][key])/(h*h*h))<=limit.jerk*1.01);
  }});
  a=b;b=c;c=d;
 }
});
test('an emphasized arrival brakes continuously without stopping the whole groove',()=>{
 const pose=pan=>Array.from({length:4},()=>({pan,tilt:.8}));
 const cues=[{time:0,travel:0,pose:pose(0)},...[1,2,3].map(time=>({time,travel:1,reason:'groove',settle:time===2?.7:0,pose:pose(time*10)}))];
 const at=t=>movingCueAt(cues,t)[0].pan,h=.0001;
 const left=(at(2)-at(2-h))/h,right=(at(2+h)-at(2))/h;
 assert.ok(left>2.9&&left<3.1);assert.ok(Math.abs(left-right)<.01);
 assert.equal(at(2),20);assert.ok(at(2.1)>20);
});


const rhythmicSong=(times,energy=.8)=>{
 const p=song(times);p.duration=20;p.sections[0].end=20;
 p.beatGrid.beats=Array.from({length:41},(_,i)=>i*.5);
 Object.assign(p.arrangement.patterns.phrases[0],{end:20,energy,movement:{character:'rhythmic',driving:1}});
 p.arrangement.patterns.events.forEach(e=>e.driving=true);
 return p;
};
test('continuous rhythmic evidence bridges sparse accents without a fixed 1.2 second stop',()=>{
 const p=rhythmicSong([1,2.5,4,5.5,7,8.5]);
 const cues=movingCues(p,'auto');
 for(let i=2;i<cues.length;i++)assert.equal(cues[i].travel,cues[i].time-cues[i-1].time);
 // Removing the rhythmic evidence in a real break restores the hold.
 p.arrangement.drama={step:.1,intensity:Array(200).fill(.8),percussion:Array(200).fill(.7),vocalShare:Array(200).fill(0),attacks:Array(200).fill(0)};
 p.arrangement.drama.percussion.fill(0,29,35);
 const paused=movingCues(p,'auto'),atFour=paused.find(c=>c.time===4);
 assert.equal(atFour.travel,1.2);
});
test('ignored intermediate accents cannot reset a continuing movement phrase',()=>{
 const p=rhythmicSong([1,2,3,4,5,6,7,8]);
 const a=movingCues(p,'auto');
 p.arrangement.times.splice(2,0,2.2);p.arrangement.accents.splice(2,0,.18);
 p.arrangement.patterns.events.splice(2,0,{kind:'bounce',driving:true});
 assert.deepEqual(movingCues(p,'auto'),a);
});
test('automatic groups evolve over several bars instead of repeating a four-second mirror loop',()=>{
 const plan=rhythmicSong(Array.from({length:18},(_,i)=>i+1)),cues=movingCues(plan,'auto');
 assert.deepEqual(movingCues(plan,'auto'),cues);
 const a=movingCueAt(cues,6),b=movingCueAt(cues,10);
 assert.ok(a.some((p,i)=>Math.abs(p.pan-b[i].pan)>2));
 assert.ok(cues.some(c=>Math.abs(c.pose[0].pan+c.pose[3].pan)>2));
});
test('fast energetic phrases with irregular connected accents retain physical limits',()=>{
 const p=rhythmicSong([1,1.8,3.2,4.1,5.7,6.5,8,9.3,10.2,11.6,13,14.5,16,17.3,18.2],.96);
 p.arrangement.eventSalience=p.arrangement.times.map((_,i)=>i===5?1:0);
 const cues=movingCues(p,'auto'),h=.001;
 assert.ok(cues.some(c=>c.settle===.95),'an exceptional musical accent may brake sharply');
 let a=movingCueAt(cues,0),b=movingCueAt(cues,h),c=movingCueAt(cues,2*h);
 for(let t=3*h;t<20;t+=h){
  const d=movingCueAt(cues,t);
  d.forEach((v,i)=>{for(const key of ['pan','tilt']){
   const limit=MOVING_LIMITS[key];
   assert.ok(Math.abs((v[key]-c[i][key])/h)<=limit.speed*1.001,`speed ${t}`);
   assert.ok(Math.abs((v[key]-2*c[i][key]+b[i][key])/(h*h))<=limit.acceleration*1.001,`acceleration ${t}`);
   assert.ok(Math.abs((v[key]-3*c[i][key]+3*b[i][key]-a[i][key])/(h*h*h))<=limit.jerk*1.01,`jerk ${t}`);
  }});a=b;b=c;c=d;
 }
});

test('section-flow journeys retain velocity across intermediate targets and into grooves',()=>{
 const pose=n=>Array.from({length:4},()=>({pan:n*8,tilt:.65+n*.04}));
 const cues=[{time:0,travel:0,pose:pose(0)},
  {time:2,travel:2,continuous:true,reason:'musical-change',pose:pose(1)},
  {time:4,travel:2,continuous:true,reason:'section-flow',pose:pose(2)},
  {time:6,travel:2,reason:'groove',pose:pose(3)}];
 const h=.0001;
 for(const time of [2,4])for(const key of ['pan','tilt']){
  const at=t=>movingCueAt(cues,t)[0][key],left=(at(time)-at(time-h))/h,right=(at(time+h)-at(time))/h;
  assert.ok(left>0&&right>0,'intermediate arrival must not stop');
  assert.ok(Math.abs(left-right)<1e-5,'velocity remains continuous');
 }
 // A later isolated journey leaves a real hold, never bridges across it.
 cues.push({time:9,travel:1,pose:pose(4)});
 assert.deepEqual(movingCueAt(cues,7),pose(3));
 assert.deepEqual(movingCueAt(cues,8),pose(3));
});

test('continuous curves carry acceleration through ordinary waypoints instead of restarting an easing cycle',()=>{
 const pose=t=>Array.from({length:4},()=>({pan:t*t,tilt:.7+t*t*.01}));
 const cues=Array.from({length:5},(_,time)=>({time,travel:time?1:0,continuous:true,pose:pose(time)}));
 const h=.0001,at=t=>movingCueAt(cues,t)[0].pan;
 for(const t of [1,2,3]){
  const before=(at(t)-2*at(t-h)+at(t-2*h))/(h*h),after=(at(t+2*h)-2*at(t+h)+at(t))/(h*h);
  assert.ok(before>1.9&&after>1.9,'curvature does not reset to zero');
  assert.ok(Math.abs(before-after)<.03,'acceleration stays continuous');
 }
});
