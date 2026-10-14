import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeScore,strobeScoreAt,strobeComposition,STROBE_FORMS} from '../public/dmx-strobe-score.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
import {groupComposition} from '../public/dmx-group-motion.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
const song=()=>({duration:32,showProfile:'strobe',sections:[{start:0,end:16,look:'flow'},{start:16,end:32,look:'peak'}],beatGrid:{beats:Array.from({length:65},(_,i)=>i*.5),downbeats:Array.from({length:17},(_,i)=>i*2)},arrangement:{times:[4,8,12,16,20,24,28],accents:Array(7).fill(.7),drama:{step:1,intensity:Array(32).fill(.85),percussion:Array(32).fill(.8)}}});
test('figure boundaries do not impose a master blackout',()=>{
 const plan=song();
 for(const f of strobeScore(plan)){
  for(const progress of [0,1])assert.ok(Array.from({length:8},(_,rank)=>strobeComposition({...f,progress},rank,8).level).some(v=>v>0));
  assert.ok(strobeComposition({...f,progress:.4},2,8).level>0);
  // Held formations deliberately retain their motor target while light events run.
 }
 assert.deepEqual(strobeScore(structuredClone(plan)),strobeScore(plan));
});
test('20 geometric figures trace 20 different spatial paths',()=>{
 const signatures=new Set();
 for(let form=0;form<STROBE_FORMS.length;form++){
  const trace=[];
  for(const progress of [.2,.4,.6,.8])for(let rank=0;rank<8;rank++){
   const c=strobeComposition({form,kind:'impact',ordinal:0,energy:.8,direction:1,progress},rank,8);
   assert.ok(c.x>=0&&c.x<=1&&c.y>=0&&c.y<=1);trace.push(c.x.toFixed(5),c.y.toFixed(5));
  }
  assert.ok(!signatures.has(trace.join(',')));signatures.add(trace.join(','));
 }
});
test('Strobo owns physical row geometry and exposure, without automatic group motion',()=>{
 const plan=song(),figure=strobeScore(plan)[1],time=figure.start+(figure.end-figure.start)*.4;
 const presence=movingPresenceAt({movingPlan:plan,songTime:time,frame:{state:true,dimming:100},weight:1});
 assert.equal(presence.groupMotion.presentation,'strobe');assert.equal(presence.groupMotion.from,undefined);
 const expected=strobeScoreAt(plan,time);
 assert.deepEqual(groupComposition(presence.groupMotion,2,8,0,3),strobeComposition(expected,2,8,0,3));
 const room=newRoomPlan(8,6,4);
 const lights=Array.from({length:8},(_,i)=>({id:'h'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'strobe',power:1,movingPresenceBasePower:1,movingPresence:presence,movingShutter:1}));
 lights.forEach(l=>room.positions[l.id]={...l.position,type:'moving',rotation:0});
 const render=p=>applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:lights.map(l=>({...l,movingPresence:p}))},room).lights;
 const a=render(presence),other={...presence,groupMotion:{...presence.groupMotion,form:(presence.groupMotion.form+5)%20}};
 assert.notDeepEqual(a.map(l=>l.target),render(other).map(l=>l.target));
 assert.ok(a.some(l=>l.power>0));
 const dark=render({...presence,groupMotion:{...presence.groupMotion,kind:'silence'}});
 assert.ok(dark.every(l=>l.power===0));
});
test('compact preview follows the same figure shutter as physical room groups',async()=>{
 const {movingPresenceLevel}=await import('../public/dmx-activity.js');
 const plan=song(),f=strobeScore(plan)[0];
 for(const progress of [.02,.4,.99]){
  const time=f.start+(f.end-f.start)*progress,p=movingPresenceAt({movingPlan:plan,songTime:time});
  for(let i=0;i<4;i++)assert.equal(movingPresenceLevel(p,i,4),p.level*strobeComposition(p.groupMotion,i,4).level);
 }
});
test('membership changes create formations even when motor targets are frozen',()=>{
 const base={form:0,kind:'groove',ordinal:0,energy:.8,direction:1,progress:.5,amount:0};
 const at=beat=>Array.from({length:8},(_,rank)=>strobeComposition({...base,rhythmBeat:beat},rank,8));
 const a=at(.2),b=at(1.2);
 assert.deepEqual(a.map(c=>[c.x,c.y]),b.map(c=>[c.x,c.y]));
 assert.deepEqual(a.map(c=>c.level>0),[true,false,true,false,true,false,true,false]);
 assert.deepEqual(b.map(c=>c.level>0),[false,true,false,true,false,true,false,true]);
 assert.deepEqual(at(2.2).map(c=>c.level>0),a.map(c=>c.level>0));
 assert.ok(at(.85).some(c=>c.level>0));
 assert.ok(at(.91).every(c=>c.level>0&&c.level<1));
 assert.ok(Math.abs(at(.91).reduce((sum,c)=>sum+c.level,0)-4)<1e-9);
});
test('centre, edge, side and diagonal banks all hand light between existing members',()=>{
 for(let form=0;form<20;form++)for(const count of [1,2,3,8]){
  const masks=[];
  for(let step=0;step<8;step++){
   const mask=Array.from({length:count},(_,rank)=>strobeComposition({form,kind:'groove',ordinal:0,energy:.8,direction:1,progress:.5,rhythmBeat:step+.2},rank,count).level>0);
   assert.ok(mask.some(Boolean));masks.push(mask.join(','));
  }
  if(count>2)assert.ok(new Set(masks).size>1);
 }
});
test('beam handovers use the measured beat grid, and seeks restore their membership',()=>{
 const plan=song(),at=time=>{const f=strobeScoreAt(plan,time);return Array.from({length:8},(_,rank)=>strobeComposition(f,rank,8).level>0);};
 const initial=at(.6);at(17);assert.deepEqual(at(.6),initial);
 const slower=structuredClone(plan);slower.beatGrid.beats=slower.beatGrid.beats.map(t=>t*2);
 assert.notEqual(strobeScoreAt(plan,1.2).rhythmBeat,strobeScoreAt(slower,1.2).rhythmBeat);
 const noGrid=structuredClone(plan);delete noGrid.beatGrid;
 assert.equal(strobeScoreAt(noGrid,1.2).rhythmBeat,null);
});
test('all bank and row handovers keep light present without lighting the full rig',()=>{
 for(let form=0;form<20;form++)for(const kind of ['calm','groove','impact']){
  for(let tick=0;tick<=400;tick++){
   const levels=Array.from({length:3},(_,row)=>Array.from({length:8},(_,rank)=>strobeComposition({form,kind,ordinal:0,energy:.8,direction:1,progress:tick/400,rhythmBeat:tick/50},rank,8,row,3).level)).flat();
   assert.ok(levels.some(v=>v>0),`${form}/${kind} at ${tick}: unintended blackout`);
   assert.ok(levels.some(v=>v<1),`${form}/${kind}: all fixtures at full power`);
  }
 }
});
test('a single fixture stays steady when no alternate beam exists; silence stays dark',()=>{
 for(let i=0;i<200;i++){
  const figure={form:0,kind:'groove',ordinal:0,energy:.8,progress:i/200,rhythmBeat:i/25};
  assert.equal(strobeComposition(figure,0,1).level,1);
  assert.equal(strobeComposition({...figure,kind:'silence'},0,1).level,0);
 }
});
test('unequal rows share the same handover clock',()=>{
 for(let tick=0;tick<300;tick++){
  const figure={form:4,kind:'groove',ordinal:1,energy:.8,progress:.5,rhythmBeat:tick/40};
  const levels=[1,3,8].flatMap((count,row)=>Array.from({length:count},(_,rank)=>strobeComposition(figure,rank,count,row,3).level));
  assert.ok(levels.some(v=>v>0));
 }
});
test('musical role, vocal space and rhythmic drive select the motif and density',async()=>{
 const {strobeMusicalChoice}=await import('../public/dmx-strobe-score.js');
 const driving={kind:'impact',energy:.9,drive:.9,vocals:.1,tone:.5};
 const peak=strobeMusicalChoice(driving),vocal=strobeMusicalChoice({...driving,vocals:.8});
 assert.equal(peak.motifId,'crown');assert.equal(vocal.motifId,'space');assert.notEqual(peak.form,vocal.form);
 assert.equal(strobeMusicalChoice({...driving,drive:.3}).motifId,'exchange');
 assert.notEqual(strobeMusicalChoice({...driving,kind:'build'}).form,peak.form);
});
test('bar repeats preserve their motif, beat anchor and motor endpoint',()=>{
 const plan=song(),score=strobeScore(plan);
 const same=score.filter(f=>f.scene===score[0].scene);
 assert.ok(same.length>1);assert.equal(new Set(same.map(f=>f.form)).size,1);
 assert.equal(new Set(same.map(f=>f.rhythmAnchor)).size,1);
 for(let i=1;i<same.length;i++)for(let rank=0;rank<8;rank++){
  const a=strobeComposition({...same[i-1],progress:1},rank,8),b=strobeComposition({...same[i],progress:0},rank,8);
  assert.equal(a.x,b.x);assert.equal(a.y,b.y);
 }
});
