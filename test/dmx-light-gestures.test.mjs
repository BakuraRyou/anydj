import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingGestures,lightingGestureAt,gesturePose} from '../public/dmx-light-scenes.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {MOVING_LIMITS} from '../public/dmx-moving-model.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {movingDevicePoses} from '../public/dmx-layout-model.js';

const song=(leader='drums')=>{
 const duration=48,step=.1,phrase=8;
 const sections=[{start:0,end:48,look:'flow',intensity:.65}];
 const times=Array.from({length:96},(_,i)=>i*.5);
 const salience=times.map((_,i)=>i%11===5?.9:.15);
 return {duration,sections,beatGrid:{downbeats:Array.from({length:25},(_,i)=>i*2)},arrangement:{
  times,eventSalience:salience,eventSources:times.map((_,i)=>i%11===5?'onset':'beat'),
  patterns:{phrases:Array.from({length:6},(_,i)=>({start:i*phrase,end:(i+1)*phrase,energy:.5+i%3*.17,tone:[.2,.7,.4,.8,.3,.6][i],movement:{driving:.8,character:'rhythmic'},attention:{leader,confidence:.85}}))},
  drama:{step,intensity:Array.from({length:duration/step},(_,i)=>.5+Math.floor(i/80)%3*.17),percussion:Array(duration/step).fill(.8),vocalShare:Array(duration/step).fill(leader==='vocals'?.7:.1)}
 }};
};

test('local instruments choose stable roles instead of cycling a gesture catalogue',()=>{
 const plans=['drums','vocals','bass','other'].map(song);
 const sequences=plans.map(p=>lightingGestures(p).map(g=>g.name+':'+g.group));
 assert.equal(new Set(sequences.map(JSON.stringify)).size,4,'the song content changes the choreography, not just amplitude');
 for(const plan of plans){
  const gestures=lightingGestures(plan);
  assert.equal(new Set(gestures.map(g=>g.name)).size,1);
  assert.ok(gestures.every(g=>g.seconds<=1.6));
  assert.equal(new Set(gestures.map(g=>g.group)).size,1,'unchanged instrument focus keeps its group');
 }
});

test('prominent offbeat arrivals retain their measured time and change when the sound moves',()=>{
 const plan=song(),cues=movingCues(plan,'auto');
 const salient=plan.arrangement.times.filter((_,i)=>plan.arrangement.eventSalience[i]>.8);
 assert.ok(salient.some(t=>!plan.beatGrid.downbeats.includes(t)&&cues.some(c=>c.time===t&&c.gesture)));
 const shifted=structuredClone(plan);shifted.arrangement.times=shifted.arrangement.times.map((t,i)=>shifted.arrangement.eventSalience[i]>.8?t+.17:t);
 assert.notDeepEqual(movingCues(shifted,'auto').map(c=>c.time),cues.map(c=>c.time));
 assert.deepEqual(lightingGestures(structuredClone(plan)),lightingGestures(plan),'reload and seek remain reproducible');
});

test('heads have separate movement starts and independent directions, retained for seven devices',()=>{
 const plan=song(),cues=movingCues(plan,'auto'),devices=Array.from({length:7},(_,i)=>({id:'h'+i}));
 const cue=cues.find((c,i)=>i>0&&c.headTravel&&c.headTravel.some(d=>d<c.travel));
 const before=cues[cues.indexOf(cue)-1];
 const at=movingCueAt(cues,cue.time-cue.travel*.9);
 assert.ok(at.some((p,i)=>p.pan===before.pose[i].pan&&p.tilt===before.pose[i].tilt),'supporting heads wait for their turn');
 assert.ok(at.some((p,i)=>p.pan!==before.pose[i].pan||p.tilt!==before.pose[i].tilt),'leading heads begin first');
 const gesture=lightingGestures(plan).find(g=>g.accent>0);assert.ok(gesture);
 const physical=movingDevicePoses(gesturePose(gesture),devices,{formation:'designed'});
 assert.ok(new Set(physical.map(p=>p.tilt.toFixed(3))).size>=3);
 assert.ok(physical.every((p,i)=>!i||p.pan>physical[i-1].pan),'physical roles remain ordered instead of crossing arbitrarily');
});

test('shortened and staggered moves remain within velocity, acceleration and jerk bounds',()=>{
 const cues=movingCues(song(),'auto'),dt=.002;
 for(const cue of cues.filter(c=>c.headTravel).slice(0,12)){
  let previous=null,velocity=null,acceleration=null;
  for(let t=cue.time-cue.travel-.02;t<=cue.time+.02;t+=dt){
   const pose=movingCueAt(cues,t);
   if(previous){
    const v=pose.map((p,i)=>Object.fromEntries(['pan','tilt'].map(key=>[key,(p[key]-previous[i][key])/dt])));
    for(const [i,p] of v.entries())for(const key of ['pan','tilt'])assert.ok(Math.abs(p[key])<=MOVING_LIMITS[key].speed+.01);
    if(velocity){
     const a=v.map((p,i)=>Object.fromEntries(['pan','tilt'].map(key=>[key,(p[key]-velocity[i][key])/dt])));
     for(const [i,p] of a.entries())for(const key of ['pan','tilt']){
      assert.ok(Math.abs(p[key])<=MOVING_LIMITS[key].acceleration+.05);
      if(acceleration)assert.ok(Math.abs((p[key]-acceleration[i][key])/dt)<=MOVING_LIMITS[key].jerk+1);
     }
     acceleration=a;
    }
    velocity=v;
   }
   previous=pose;
  }
 }
});

test('leading roles change their emphasis without concealing every supporting head',()=>{
 const plan=song(),gestures=lightingGestures(plan);
 const groups=new Set();
 for(const gesture of gestures){
  const time=gesture.time+(gesture.time===0?1:.3),p=movingPresenceAt({movingPlan:plan,songTime:time,look:'flow'});
  const levels=Array.from({length:7},(_,i)=>movingPresenceLevel(p,i,7));
  assert.ok(levels.every(v=>v>=.4));
  if(gesture.kind!=='entry')assert.ok(Math.max(...levels)-Math.min(...levels)>.15);
  groups.add(gesture.group);
 }
 assert.equal(groups.size,1);
 const picked=lightingGestureAt(plan,9);lightingGestureAt(plan,42);assert.deepEqual(lightingGestureAt(plan,9),picked);
});

test('explicit bar-only and strong-only lighting keep their selected rhythm',()=>{
 for(const rhythm of ['bars','strong','none']){
  const plan=song();plan.sectionLighting=[{start:0,end:48,movement:1,rhythm,events:[1,6]}];
  const at=time=>movingPresenceAt({movingPlan:plan,songTime:time,look:'flow'});
  assert.deepEqual(at(2.3),at(2.8),`${rhythm} does not acquire the automatic offbeat emphasis at 2.5s`);
 }
});


test('a confident melodic contour moves leading heads with the music and uncertain pitch cannot invent motion',()=>{
 const base=song('vocals');
 const withPitch=position=>({...structuredClone(base),score:{track:Array.from({length:600},(_,i)=>({time:i*.08,position,confidence:.8}))}});
 const low=withPitch(.2),high=withPitch(.8);
 const a=gesturePose(lightingGestureAt(low,4)),b=gesturePose(lightingGestureAt(high,4));
 assert.ok(b.every((p,i)=>p.tilt>a[i].tilt));
 assert.ok(b[1].tilt-a[1].tilt>b[0].tilt-a[0].tilt,'lead follows more strongly than support');
 const unknown=withPitch(.8);unknown.score.track.forEach(p=>p.confidence=.1);
 assert.deepEqual(lightingGestures(unknown),lightingGestures(base));
});

test('sustained offbeat melody changes get their own arrival rather than a bar-delayed response',()=>{
 const plan=song('vocals');plan.arrangement.eventSalience.fill(.1);
 plan.score={notes:[{start:0,end:1.3,midi:60},{start:1.3,end:2.7,midi:64}],track:Array.from({length:40},(_,i)=>({time:i*.08,confidence:.8,position:i*.08<1.3?.3:.7}))};
 assert.ok(movingCues(plan,'auto').some(c=>c.time===1.3));
 const shifted=structuredClone(plan);shifted.score.notes[1].start=1.47;
 assert.ok(movingCues(shifted,'auto').some(c=>c.time===1.47));
});

test('rhythmic gesture timing scales with the measured tempo',()=>{
 const slow=song(),fast=song();fast.beatGrid.downbeats=Array.from({length:49},(_,i)=>i);
 const a=lightingGestures(slow).find(g=>g.time===4),b=lightingGestures(fast).find(g=>g.time===4);
 assert.ok(a.seconds>b.seconds);
});

test('musical contrast builds fan, parallel and crossing figures without rotating a catalogue',()=>{
 const plan=song();plan.sections=[{start:0,end:48,look:'peak',intensity:.8}];
 const gestures=lightingGestures(plan),forms=new Set(gestures.map(g=>g.formation));
 assert.ok(forms.has('fan')&&forms.has('cross'));
 const highest=gestures.find(g=>g.formation==='cross'),pose=gesturePose(highest);
 assert.ok(pose.every((p,i)=>!i||p.pan<pose[i-1].pan));
 assert.equal(new Set(pose.map(p=>p.tilt)).size,1,'crossing beams share a plane');
 const parallel=gesturePose({...highest,formation:'parallel'});
 assert.equal(new Set(parallel.map(p=>p.pan)).size,1);
 assert.equal(new Set(parallel.map(p=>p.tilt)).size,1);
});
test('coordinated formations share their start, progress and arrival under motor constraints',()=>{
 const plan=song();plan.sections[0].look='peak';const cues=movingCues(plan,'auto');
 const shared=cues.filter(c=>c.coordinated);assert.ok(shared.length);
 for(const cue of shared){
  assert.equal(new Set(cue.headTravel).size,1);
  const before=cues[cues.indexOf(cue)-1],mid=movingCueAt(cues,cue.time-cue.travel*.5);
  mid.forEach((p,i)=>{for(const key of ['pan','tilt'])assert.ok(Math.abs(p[key]-(before.pose[i][key]+cue.pose[i][key])*.5)<1e-7);});
 }
});
