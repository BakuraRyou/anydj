import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeConductor,strobeMusicAt,strobeMusicalIntent} from '../public/dmx-strobe-conductor.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {automaticStage} from '../public/dmx-auto.js';

function song(drumTimes=[1,1.5,2,2.5],bassTimes=[1.25,2.25]){
 const step=.05,length=80;
 const envelope=times=>Array.from({length},(_,i)=>Math.max(0,...times.map(t=>{
  const age=i*step-t;return age>=-1e-8&&age<.2?1-age/.2:0;
 })));
 return {duration:4,showProfile:'strobe',showScore:[{start:0,end:4,role:'groove',rhythmic:true,energy:.8,tone:.5}],
  sections:[{start:0,end:4,look:'peak'}],beatGrid:{beats:[0,.5,1,1.5,2,2.5,3,3.5]},
  arrangement:{times:[...drumTimes,1.25,1.75,2.25].sort((a,b)=>a-b),
   eventSources:Array(7).fill('onset'),accents:Array(7).fill(.6)},
  structure:{instruments:{step,drums:envelope(drumTimes),bass:envelope(bassTimes),vocals:Array(length).fill(0),other:Array(length).fill(.1)}}};
}
const levels=(p,time,count=8)=>Array.from({length:count},(_,rank)=>strobeComposition(strobeScoreAt(p,time),rank,count));
const roleLevel=(p,time,role)=>Math.max(...levels(p,time).filter(f=>f.fixtureRole===role).map(f=>f.level));

test('drum and bass evidence own different fixture roles, rather than advancing a mixed onset run',()=>{
 const p=song(),events=strobeConductor(p).events;
 assert.deepEqual(events.filter(e=>e.role==='lead').map(e=>e.time),[1,1.5,2,2.5]);
 assert.deepEqual(events.filter(e=>e.role==='support').map(e=>e.time),[1.25,2.25]);
 assert.equal(strobeMusicAt(p,1.3).sequence.step,0,'the bass note cannot advance the drum bank');
 assert.ok(roleLevel(p,1.08,'lead')>0);
 assert.equal(roleLevel(p,1.3,'lead'),0,'the actual short drum release ends the beam');
 assert.ok(roleLevel(p,1.3,'support')>roleLevel(p,1.08,'support'));
});
test('changing the music while keeping the beat grid changes the beam sentence',()=>{
 const a=song(),b=song([1.25,1.75,2.25,2.75],[1,2]);
 assert.deepEqual(a.beatGrid,b.beatGrid);
 assert.ok(roleLevel(a,1.08,'lead')>0);
 assert.equal(roleLevel(b,1.08,'lead'),0);
 assert.notDeepEqual(levels(a,1.3),levels(b,1.3));
 const saved=levels(a,1.3);levels(a,3);assert.deepEqual(levels(a,1.3),saved,'seeking preserves musical roles');
});
test('mixed onsets without measured drums do not fabricate a percussion sequence',()=>{
 const p=song([],[1.25]);
 assert.equal(strobeConductor(p).sequences[0].entrances.length,0);
 assert.equal(roleLevel(p,1.08,'lead'),0);
 assert.ok(roleLevel(p,1.3,'support')>0);
});
test('fixed spots and bar pixels respond to the bass accompaniment of the same song',()=>{
 const p=song(),equipment={devices:[{id:'head',type:'moving',cells:1},{id:'spot',type:'spot',cells:1},{id:'bar',type:'bar',cells:4}]};
 const render=time=>automaticStage([{movingPlan:p,songTime:time,look:'peak',weight:1,flicker:53,
  frame:{state:true,dimming:80,r:255,g:30,b:0},washDimming:80}],2,equipment,'strobe').frames;
 const before=render(1.08),bass=render(1.3);
 assert.ok(bass[1][0].dimming>before[1][0].dimming);
 assert.ok(Math.max(...bass[2].map(c=>c.dimming))>Math.max(...before[2].map(c=>c.dimming)));
});
test('one to three heads retain the bass role, and silent stems do not leave a rhythmic lamp on',()=>{
 const bass=song([],[1.25]);
 for(const count of [1,2,3])assert.ok(levels(bass,1.3,count).some(f=>f.level>0));
 const silent=song([],[]);silent.structure.instruments.other.fill(0);
 for(const count of [1,2,3,4,16])assert.ok(levels(silent,1.3,count).every(f=>f.level===0));
});
test('a few melodic notes cannot displace the percussion, and held music stays held',()=>{
 const events=[{time:0,kind:'attack',role:'lead'},{time:.5,kind:'attack',role:'lead'},
  {time:.2,kind:'melody',role:'answer'},{time:.7,kind:'melody',role:'answer'}];
 assert.equal(strobeMusicalIntent({role:'groove',rhythmic:true},events).pattern,'chase');
 assert.equal(strobeMusicalIntent({role:'held'},events).pattern,'hold');
 assert.equal(strobeMusicalIntent({role:'flow',rhythmic:false},events.filter(e=>e.role==='answer')).pattern,'echo');
});
