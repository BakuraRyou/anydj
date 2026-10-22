import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage} from '../public/dmx-auto.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {strobeConductor,strobeMusicalIntent} from '../public/dmx-strobe-conductor.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
const song=()=>({duration:8,showProfile:'strobe',showScore:[
 {start:0,end:4,role:'groove',rhythmic:true,energy:.8,tone:.5},
 {start:4,end:5,role:'silence',energy:0},
 {start:5,end:8,role:'arrival',rhythmic:true,energy:.9,tone:.5}],
 sections:[{start:0,end:8,look:'peak'}],beatGrid:{beats:Array.from({length:17},(_,i)=>i*.5)},
 arrangement:{times:[0,.5,1,1.5,2,2.5,3,3.5,5,5.5,6,6.5,7,7.5],accents:Array(14).fill(.6),eventSources:Array(14).fill('onset')}});
const source=(plan,time,flicker=53)=>({movingPlan:plan,songTime:time,flicker,look:'peak',weight:1,
 frame:{state:true,r:255,g:30,b:0,dimming:80},washDimming:80,palette:[[255,30,0],[0,80,255]]});
const mixed={devices:[...Array.from({length:4},(_,i)=>({id:'h'+i,type:'moving',cells:1})),
 ...Array.from({length:4},(_,i)=>({id:'s'+i,type:'spot',cells:1})),{id:'bar',type:'bar',cells:8}]};
test('the real 53 percent setting leaves unselected moving-head roles completely dark',()=>{
 const plan=song(),min=Array(8).fill(1),max=Array(8).fill(0);
 for(let tick=0;tick<240;tick++){
  const f={...strobeScoreAt(plan,tick/60),flicker:53};
  for(let rank=0;rank<8;rank++){
   const level=strobeComposition(f,rank,8).level;min[rank]=Math.min(min[rank],level);max[rank]=Math.max(max[rank],level);
   assert.ok(level<=.53);
  }
 }
 assert.ok(min.every(v=>v===0),'every rhythmic fixture can really switch off');
 assert.ok(max.some(v=>v>0));
});
test('spots and bar pixels accompany the lead release and punctuate the same arrival',()=>{
 const plan=song(),render=time=>automaticStage([source(plan,time)],2,mixed,'strobe').frames;
 const attack=render(1.05),release=render(1.4),arrival=render(5.05);
 assert.ok(attack.slice(4).flat().every(f=>f.dimming===0),'companions leave room for the moving lead');
 assert.ok(release.slice(4,8).flat().some(f=>f.dimming>0));
 assert.ok(release.at(-1).some(f=>f.dimming>0),'bar answers in the same release');
 assert.ok(arrival.slice(4,8).flat().every(f=>f.dimming>0),'fixed spots reinforce the authored entrance');
 assert.ok(attack.slice(4).flat().every(f=>f.dimming<=80*.53));
 const noFlash=automaticStage([source(plan,1.05,0)],2,mixed,'strobe').frames;
 assert.ok(noFlash.flat().every(f=>f.dimming===80),'zero explicitly disables rhythmic shutters');
});
test('a musical pause prepares the next directions before the first arrival pulse',()=>{
 const plan=song(),parts=strobeConductor(plan).sequences;
 assert.equal(parts[2].preparedEntrance,true);
 const before=strobeScoreAt(plan,4.99),hit=strobeScoreAt(plan,5.05);
 for(let rank=0;rank<8;rank++){
  const a=strobeComposition(before,rank,8),b=strobeComposition(hit,rank,8);
  assert.equal(a.level,0);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9);
 }
 assert.ok(Array.from({length:8},(_,rank)=>strobeComposition(hit,rank,8)).some(c=>c.level>0));
});
test('pairs, neighbour runs and melodic anchors produce distinct activation sentences',()=>{
 const base=strobeScoreAt(song(),1.05),sequence=base.music.sequence;
 const trace=pattern=>Array.from({length:4},(_,step)=>Array.from({length:16},(_,rank)=>strobeComposition(
  {...base,music:{...base.music,sequence:{...sequence,pattern,step,time:step*.5+.05,entry:{...sequence.entry,time:step*.5,ordinal:0},stepBase:0}}},rank,16).level));
 assert.notDeepEqual(trace('pairs'),trace('chase'));
 assert.notDeepEqual(trace('chase'),trace('echo'));
 const events=gaps=>{let time=0;return gaps.map(gap=>({time:time+=gap,kind:'bass',role:'lead',strength:.7}));};
 const picture={role:'groove'};
 assert.equal(strobeMusicalIntent(picture,events([.8,.8,.8])).pattern,'pendulum');
 assert.equal(strobeMusicalIntent(picture,events([.5,.5,.5])).pattern,'chase');
 assert.equal(strobeMusicalIntent(picture,events([.5,.15,.9,.2])).pattern,'syncopated');
});
test('room spots borrowed from unmasked moving sources follow the same companion shutters',()=>{
 const room=newRoomPlan(10,8,4),plan=song();
 room.positions.head={type:'moving',x:0,y:6,height:3,rotation:0};
 for(let i=0;i<4;i++)room.positions['spot'+i]={type:'spot',x:i-1.5,y:5,height:3,rotation:0};
 const render=time=>{
  const stream=source(plan,time),presence=movingPresenceAt({...stream,stageMode:'strobe'});
  const light={id:'head',type:'moving',position:{x:0,y:6,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
   motionPresentation:'strobe',color:'rgb(255,30,0)',power:.8,movingPresenceBasePower:.8,movingPresence:presence,
   strobePalette:[[255,30,0],[0,80,255]]};
  return applyRoomPlan({layout:{width:10,depth:8,positions:{}},lights:[light]},room).lights.filter(l=>l.type==='spot');
 };
 const attack=render(1.05),release=render(1.4),hit=render(5.05);
 assert.ok(attack.every(l=>l.power===0),'virtual spots do not inherit the unmasked moving brightness');
 assert.ok(release.some(l=>l.power>0));
 assert.ok(hit.every(l=>l.power>0));
 assert.ok(new Set(hit.map(l=>l.color)).size===2);
});
