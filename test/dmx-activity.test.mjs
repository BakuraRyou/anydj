import test from 'node:test';
import assert from 'node:assert/strict';
import {activityAt} from '../public/dmx-activity.js';
import {automaticStage} from '../public/dmx-auto.js';
const plan={sections:[{start:0,end:12,look:'flow',intensity:.65},{start:12,end:20,look:'held',intensity:.2},{start:20,end:30,look:'peak',intensity:.8}],arrangement:{times:[1,1.2,2.73,6.1,13,15,20.4,20.85],accents:[.4,.1,.45,.5,.6,.6,.3,.4]}};
const source=(time,more={})=>({movingPlan:plan,songTime:time,look:time<12?'flow':time<20?'held':'peak',frame:{state:true,r:255,g:40,b:0,dimming:60},weight:1,...more});
test('normal grooves and peaks keep every lamp active regardless of beat or accent',()=>{
 for(const t of [0,.9,1,1.3,3,6.2,11.9,20,20.4,21,29])for(const accentStrength of [0,.5,1])assert.deepEqual(activityAt(source(t,{accentStrength}),4),[1,1,1,1]);
});
test('a measured sustained withdrawal fades a symmetric pair out and back in',()=>{
 const at=t=>activityAt(source(t),4);
 assert.deepEqual(at(12),[1,1,1,1]);
 assert.deepEqual(at(12.4).map(v=>Math.round(v*10)/10),[.5,1,1,.5]);
 assert.deepEqual(at(13),[0,1,1,0]);assert.deepEqual(at(13),at(19));
 assert.ok(at(19.7)[0]>0&&at(19.7)[0]<1);
 assert.deepEqual(at(20),[1,1,1,1]);
 assert.deepEqual(activityAt(source(14,{accentStrength:1}),4),at(14));
 at(25);assert.deepEqual(at(13),[0,1,1,0]);
});
test('quiet labels, atmospheric character, missing analysis and brief dips do not manufacture pauses',()=>{
 for(const mutate of [p=>p.sections.forEach(s=>delete s.intensity),p=>p.sections[0].intensity=.3,p=>p.sections[1].end=14,p=>p.sections[1].intensity=.5]){
  const p=structuredClone(plan);mutate(p);
  assert.deepEqual(activityAt(source(13,{movingPlan:p}),4),[1,1,1,1]);
 }
 assert.deepEqual(activityAt({look:'held',motionCharacter:'atmospheric'},4),[1,1,1,1]);
 assert.deepEqual(activityAt(source(3,{motionCharacter:'atmospheric'}),4),[1,1,1,1]);
 assert.deepEqual(activityAt(source(13,{look:'flow'}),4),[1,1,1,1]);
 const p=structuredClone(plan);p.arrangement.passages=p.sections.map(s=>({intensity:s.intensity}));p.sections.forEach(s=>delete s.intensity);
 assert.deepEqual(activityAt(source(13,{movingPlan:p}),4),[0,1,1,0]);
});
test('rests remain symmetric on different rigs, through crossfades and seeks',()=>{
 for(const units of [0,1,2,3,4,5,8,40])for(const t of [0,12,12.2,13,19.8,20,21]){
  const levels=activityAt(source(t),units);
  levels.forEach((v,i)=>{assert.equal(v,levels[units-1-i]);assert.ok(v>=0&&v<=1);});
  if(units)assert.ok(levels.some(v=>v===1));
 }
 assert.deepEqual(activityAt(source(13),2),[1,1]);
 const equipment={devices:[...Array.from({length:4},(_,i)=>({id:`s${i}`,type:'spot',cells:1})),{id:'bar',type:'bar',cells:40}]};
 const render=s=>automaticStage(s,2,equipment).frames.flat();
 const a=source(13,{weight:.25}),b=source(3,{weight:.75}),left=render([a]),right=render([b]),mixed=render([a,b]);
 assert.equal(left.slice(0,4).filter(f=>f.dimming===0).length,2);
 assert.equal(left.slice(4).filter(f=>f.dimming===0).length,20);
 assert.ok(right.every(f=>f.dimming>0));
 mixed.forEach((f,i)=>assert.ok(Math.abs(f.dimming-(left[i].dimming*.25+right[i].dimming*.75))<1e-9));
});
test('a measured build stages individual fixtures progressively and holds on energy plateaus',()=>{
 const make=values=>({sections:[{start:0,end:values.length*.5,look:'lift'}],arrangement:{drama:{step:.5,intensity:values}}});
 const rising=[.1,.1,.1,.2,.3,.4,.4,.4,.4,.4,.5,.6,.7,.8,.9,.9,.9,.9,.9,.9];
 for(const falling of [false,true]){
  const p=make(rising.map(v=>falling?1-v:v));
  const at=t=>activityAt({movingPlan:p,songTime:t,look:'lift'},8);
  assert.deepEqual(at(0),Array(8).fill(1));
  const first=at(1),middle=at(3),last=at(8);
  assert.deepEqual(at(3.5),at(4));
  for(let i=0;i<8;i++){
   assert.ok(falling?first[i]>=middle[i]&&middle[i]>=last[i]:first[i]<=middle[i]&&middle[i]<=last[i]);
  }
  assert.notDeepEqual(first,last);
  assert.equal(middle[3],1);assert.equal(middle[4],1);
  at(9);assert.deepEqual(at(3),middle);
 }
 for(const values of [Array(20).fill(.5),Array.from({length:20},(_,i)=>i%2?.8:.2)]){
  const p=make(values);assert.deepEqual(activityAt({movingPlan:p,songTime:3,look:'lift'},8),Array(8).fill(1));
 }
});
test('developments inside verses and choruses work without an Aufbau label',()=>{
 const ramp=Array.from({length:20},(_,i)=>.1+.8*Math.min(1,Math.max(0,(i-2)/14)));
 const p={sections:[{start:0,end:20,look:'peak'}],arrangement:{drama:{step:.5,intensity:[...ramp,...ramp.map(v=>1-v)]},patterns:{phrases:[{start:0,end:10},{start:10,end:20}]}}};
 const at=t=>activityAt({movingPlan:p,songTime:t,look:'peak'},4);
 assert.equal(at(1).filter(v=>v===1).length,1);
 assert.ok(at(3).some(v=>v>0&&v<1));
 assert.deepEqual(at(9),[1,1,1,1]);
 assert.ok(at(18).filter(v=>v===0).length>=2);
 assert.deepEqual(at(20),[1,1,1,1]);
 const first=at(3);at(18);assert.deepEqual(at(3),first);
});
test('instrument focus changes entrances and standout events briefly feature a single head',()=>{
 const make=leader=>({sections:[{start:0,end:10,look:'flow'}],arrangement:{drama:{step:.5,intensity:[.1,.1,.1,.2,.3,.4,.4,.4,.4,.4,.5,.6,.7,.8,.9,.9,.9,.9,.9,.9]},patterns:{phrases:[{start:0,end:10,attention:{leader}}]},times:[3,5],eventSalience:[.2,.8]}});
 const vocal=make('vocals'),drums=make('drums');
 const at=(p,t)=>activityAt({movingPlan:p,songTime:t,look:'flow'},4);
 assert.notDeepEqual(at(vocal,1),at(drums,1));
 const noHit=structuredClone(vocal);noHit.arrangement.eventSalience=[.2,.2];
 assert.deepEqual(at(vocal,4.99),at(noHit,4.99));
 assert.notDeepEqual(at(vocal,5.12),at(noHit,5.12));
 assert.deepEqual(at(vocal,5.81),at(noHit,5.81));
 assert.deepEqual(at(vocal,9),[1,1,1,1]);
});
test('cached instrument levels reveal a quiet riser even while normalized drama stays zero',()=>{
 const intensity=Array(120).fill(0),other=Array.from({length:120},(_,i)=>i<25?.08-i*.001:i<40?.055:i<90?.055+(i-40)*.004:.255);
 const instruments={step:.1,drums:[...intensity],bass:[...intensity],vocals:[...intensity],other};
 const p={sections:[{start:0,end:12,look:'lift'}],arrangement:{drama:{step:.1,intensity},patterns:{phrases:[{start:0,end:12,attention:{leader:'other'}}]}},structure:{instruments}};
 const original=structuredClone(p),old=structuredClone(p);delete old.structure;
 const at=(plan,time)=>activityAt({movingPlan:plan,songTime:time,look:'lift'},4);
 assert.deepEqual(at(old,5),[1,1,1,1]);
 const total=v=>v.reduce((a,b)=>a+b,0);
 assert.ok(total(at(p,5))>total(at(p,3))+.2);
 assert.ok(total(at(p,8))>total(at(p,5))+.5);
 assert.deepEqual(at(p,11),[1,1,1,1]);
 const saved=at(p,5);at(p,11);assert.deepEqual(at(p,5),saved);assert.deepEqual(p,original);
 for(const value of [0,.0001,.08]){
  const steady=structuredClone(p);steady.structure.instruments.other.fill(value);
  assert.deepEqual(at(steady,5),[1,1,1,1],'silence or a sustained pad must not manufacture a build');
 }
});
