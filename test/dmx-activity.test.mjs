import test from 'node:test';
import assert from 'node:assert/strict';
import {activityAt} from '../public/dmx-activity.js';
import {automaticStage} from '../public/dmx-auto.js';
const plan={sections:[{start:0,end:12,look:'flow',intensity:.65},{start:12,end:20,look:'held',intensity:.2},{start:20,end:30,look:'peak',intensity:.8}],arrangement:{times:[1,1.2,2.73,6.1,13,15,20.4,20.85],accents:[.4,.1,.45,.5,.6,.6,.3,.4]}};
const source=(time,more={})=>({movingPlan:plan,songTime:time,look:time<12?'flow':time<20?'held':'peak',frame:{state:true,r:255,g:40,b:0,dimming:60},weight:1,...more});
test('normal grooves and peaks keep every lamp active regardless of beat or accent',()=>{
 for(const t of [0,.9,1,1.3,3,6.2,11.9,20,20.4,21,29])for(const accentStrength of [0,.5,1])assert.deepEqual(activityAt(source(t,{accentStrength}),4),[1,1,1,1]);
});
test('a measured rest dims every fixture together without a protected lamp',()=>{
 const at=t=>activityAt(source(t),4).map(v=>Math.round(v*1000)/1000);
 assert.deepEqual(at(12),[1,1,1,1]);
 assert.deepEqual(at(12.4).map(v=>Math.round(v*10)/10),[.6,.6,.6,.6]);
 assert.deepEqual(at(13),[.15,.15,.15,.15]);assert.deepEqual(at(13),at(19));
 assert.ok(at(19.7)[0]>0&&at(19.7)[0]<1);
 assert.deepEqual(at(20),[1,1,1,1]);
 assert.ok(activityAt(source(14,{accentStrength:1}),4).every(v=>Math.abs(v-.15)<1e-9));
 at(25);assert.deepEqual(at(13),[.15,.15,.15,.15]);
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
 assert.ok(activityAt(source(13,{movingPlan:p}),4).every(v=>Math.abs(v-.15)<1e-9));
});
test('rests remain symmetric on different rigs, through crossfades and seeks',()=>{
 for(const units of [0,1,2,3,4,5,8,40])for(const t of [0,12,12.2,13,19.8,20,21]){
  const levels=activityAt(source(t),units);
  levels.forEach((v,i)=>{assert.equal(v,levels[units-1-i]);assert.ok(v>=0&&v<=1);});
  if(units)assert.ok(levels.every(v=>v===levels[0]));
 }
 assert.ok(activityAt(source(13),2).every(v=>Math.abs(v-.15)<1e-9));
 const equipment={devices:[...Array.from({length:4},(_,i)=>({id:`s${i}`,type:'spot',cells:1})),{id:'bar',type:'bar',cells:40}]};
 const render=s=>automaticStage(s,2,equipment).frames.flat();
 const a=source(13,{weight:.25}),b=source(3,{weight:.75}),left=render([a]),right=render([b]),mixed=render([a,b]);
 assert.ok(left.slice(0,4).every(f=>Math.abs(f.dimming-4.5)<1e-9));
 assert.ok(left.slice(4).every(f=>Math.abs(f.dimming-4.5)<1e-9));
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
 assert.ok(at(1).every(v=>v>=.12&&v<1));
 assert.ok(at(3).some(v=>v>0&&v<1));
 assert.deepEqual(at(9),[1,1,1,1]);
 assert.ok(at(18).every(v=>v>=.12));
 assert.ok(at(18).filter(v=>Math.abs(v-.12)<1e-9).length>=2);
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

test('a deep measured withdrawal can extinguish the final lamp until the musical return',()=>{
 const n=160,zero=Array(n).fill(0),other=Array.from({length:n},(_,i)=>i<20?.2:i<60?.2-(i-20)*.00475:i<100?.01:.2);
 const make=()=>({sections:[{start:0,end:10,look:'flow'},{start:10,end:16,look:'peak'}],structure:{instruments:{step:.1,drums:[...zero],bass:[...zero],vocals:[...zero],other:[...other]}},arrangement:{drama:{step:.1,intensity:other.map(v=>v*4)}}});
 const p=make(),at=(p,t,n=4)=>activityAt({movingPlan:p,songTime:t,look:t<10?'flow':'peak'},n);
 for(const n of [1,2,4,8]){
  assert.ok(at(p,2,n).some(v=>v>0));assert.ok(at(p,5,n).some(v=>v>0));
  assert.deepEqual(at(p,8,n),Array(n).fill(0));assert.deepEqual(at(p,9.9,n),Array(n).fill(0));
  assert.deepEqual(at(p,10,n),Array(n).fill(1));
 }
 const old=at(p,8);at(p,12);assert.deepEqual(at(p,8),old);
 const pad=make();pad.structure.instruments.other=other.map(v=>Math.max(.1,v));
 assert.ok(at(pad,8).some(v=>v>0),'a substantial remaining pad retains light');
 const noReturn=make();noReturn.structure.instruments.other.fill(.01,100);
 assert.deepEqual(at(noReturn,8),[0,0,0,0],'a deep sustained withdrawal no longer requires an immediate return');
});


test('a sustained quiet phase stays fully dark across section boundaries until audible music returns',()=>{
 const n=220,zero=Array(n).fill(0),other=Array.from({length:n},(_,i)=>i<40||i>=180?.2:.015);
 const p={sections:[{start:0,end:4,look:'peak'},{start:4,end:10,look:'held'},{start:10,end:18,look:'held'},{start:18,end:22,look:'peak'}],structure:{instruments:{step:.1,drums:[...zero],bass:[...zero],vocals:[...zero],other}},arrangement:{}};
 const at=(plan,t)=>activityAt({movingPlan:plan,songTime:t,look:t>=4&&t<18?'held':'peak'},4);
 assert.deepEqual(at(p,3),[1,1,1,1]);assert.ok(at(p,4.3).every(v=>v>0&&v<1));
 for(const t of [5,9.9,10,17.9])assert.deepEqual(at(p,t),[0,0,0,0]);
 assert.deepEqual(at(p,18),[1,1,1,1]);assert.deepEqual(at(p,6),[0,0,0,0]);
 const pad=structuredClone(p);pad.structure.instruments.other.fill(.08,40,180);
 assert.deepEqual(at(pad,8),[1,1,1,1]);
 const beatGaps=structuredClone(p);beatGaps.structure.instruments.other=other.map((_,i)=>i%5===0?.2:.001);
 assert.deepEqual(at(beatGaps,8.2),[1,1,1,1]);
});

test('an atmospheric fade completes all four fixture stages despite an audible residual layer',()=>{
 const intensity=Array.from({length:100},(_,i)=>i<20?.4:i<75?.4-.3*(i-20)/55:.1);
 const p={sections:[{start:0,end:10,look:'flow'}],arrangement:{drama:{step:.1,intensity},patterns:{phrases:[{start:0,end:10,movement:{character:'atmospheric'}}]}}};
 const at=(plan,t)=>activityAt({movingPlan:plan,songTime:t,look:'flow'},4);
 const late=at(p,6.5);
 assert.equal(late.filter(v=>v>0).length,1,'the last fixture fades after the other three');
 assert.ok(late.some(v=>v>0&&v<1));
 assert.deepEqual(at(p,8.5),[0,0,0,0]);assert.deepEqual(at(p,9.9),[0,0,0,0]);
 assert.deepEqual(at(p,10),[1,1,1,1]);
 const groove=structuredClone(p);groove.arrangement.patterns.phrases[0].movement.character='rhythmic';
 assert.ok(at(groove,8.5).every(v=>Math.abs(v-.12)<1e-9),'a groove retains only a shared low base, never a protected single lamp');
 const held=structuredClone(p);held.arrangement.drama.intensity.fill(.1);
 assert.deepEqual(at(held,8.5),[1,1,1,1],'a quiet label or constant pad alone does not fade out');
});
