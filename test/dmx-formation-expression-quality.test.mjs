import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionPose,formationActionExit} from '../public/dmx-formation-actions.js';
import {formationSpatialPose} from '../public/dmx-strobe-choreography.js';
import {developFormationPhrase} from '../public/dmx-formation-music.js';

function fixture({shape='radial-wheel',motion='weave',texture='drums',beat=.5,drive=.85}={}){
 const beats=Array.from({length:80},(_,i)=>i*beat),events=beats.map(time=>({time,strength:.95}));
 const plan={beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)}};
 const evidence={texture,energy:.85,movementDrive:drive,tone:.35,drums:texture==='drums'?.9:.2,bass:texture==='bass'?.9:.2,density:.65,impulses:80,pitchConfidence:.2};
 const story={start:0,end:beat*32,shape,motion,musicalEvidence:evidence,opening:[{time:0,position:1},{time:beat*32,position:1}]};
 const timeline={roles:{lead:events,bass:texture==='bass'?events:[],drums:texture==='drums'?events:[]}};
 return {story,plan,timeline,action:planFormationAction(story,plan,timeline)};
}
const pose=(action,time,rank=0,row=0,count=16,groups=3)=>formationActionPose(action,time,rank,count,row,groups,formationSpatialPose,1);
const speed=(action,time)=>Math.sqrt(Array.from({length:16},(_,rank)=>{const a=pose(action,time-.0001,rank),b=pose(action,time+.0001,rank);return ((a.x-b.x)**2+(a.y-b.y)**2)/.0002**2;}).reduce((a,b)=>a+b)/16);

test('closed figures continue through bars with finite velocity instead of stopping at every statement',()=>{
 for(const shape of ['radial-wheel','spiral-shell','traveling-wave','double-helix','braided-ribbons']){
  const {action}=fixture({shape});assert.ok(action.trajectory,shape);
  for(const t of [4,6,8,10,12]){
   assert.ok(speed(action,t)>.06,`${shape} must not brake at ${t}s`);
   assert.ok(Math.abs(speed(action,t-.0001)-speed(action,t+.0001))<.001);
  }
 }
});
test('musical transport changes curve speed while light cues still require measured attacks',()=>{
 const fast=fixture({beat:.4}),slow=fixture({beat:.8});
 assert.ok(speed(fast.action,9)>speed(slow.action,18)*1.9);
 const empty=planFormationAction(fast.story,fast.plan,{roles:{lead:[],bass:[],drums:[]}});
 assert.equal(empty.kind,'hold');assert.equal(empty.trajectory,undefined);assert.equal(empty.cues.length,0);
});
test('bass openings hand full power between real mounting rows and leave other rows visibly dark',()=>{
 const {action}=fixture({shape:'nested-gates',motion:'bloom',texture:'bass'});
 assert.equal(action.grouping,'rows');assert.ok(action.trajectory);
 const seen=[];
 for(const cue of action.cues.slice(1,8)){
  const t=cue.time+action.overlap+.01,rows=[0,1,2].map(row=>pose(action,t,0,row).exposure);
  assert.equal(rows.filter(v=>v>.9).length,1);assert.equal(rows.filter(v=>v<.1).length,2);
  seen.push(rows.findIndex(v=>v>.9));
 }
 assert.deepEqual(seen.slice(0,6),[1,2,0,1,2,0],'three-row installations must not repeat row zero at the four-group wrap');
});
test('dense percussion answers on measured beats as mirrored pairs, independently of wide motor travel',()=>{
 const {action,plan}=fixture({shape:'open-fan',motion:'bloom'});
 assert.equal(action.grouping,'mirrored');assert.equal(action.cues.length,32);
 assert.deepEqual(action.cues.map(c=>c.time),plan.beatGrid.beats.slice(0,32));
 for(const cue of action.cues.slice(2,10))for(let rank=0;rank<8;rank++){
  const t=cue.time+action.overlap+.01;
  assert.equal(pose(action,t,rank).exposure,pose(action,t,15-rank).exposure);
 }
 const p=Array.from({length:16},(_,i)=>pose(action,4.2,i));
 assert.ok(p.some(v=>v.exposure>.9));assert.ok(p.filter(v=>v.exposure<.1).length>=10);
});
test('continuous fans use both horizontal and vertical travel and retain wire and seek parity',()=>{
 const {action}=fixture({shape:'open-fan',motion:'bloom',texture:'bass'});
 const samples=[4,5,6,7,8,9,10,11,12].map(t=>pose(action,t));
 assert.ok(Math.max(...samples.map(p=>p.y))-Math.min(...samples.map(p=>p.y))>.1);
 assert.ok(samples.some(p=>p.y<.25),'bass statements must reach the lower part of the shared target plane');
 const wire=JSON.parse(JSON.stringify(action));
 for(const t of [12,5,9,12])assert.deepEqual(pose(action,t),pose(wire,t));
 const next=fixture({shape:'open-fan',motion:'bloom',texture:'bass'}).action;
 next.start=action.end;next.entry=formationActionExit(action);next.continueOrbit=true;
 assert.deepEqual(pose(next,action.end),pose(action,action.end),'a matching continued orbit must not restart its movement');
});
test('straight statements carry velocity through aligned waypoints and still stop for a real reversal',()=>{
 const action={kind:'handoff',start:0,end:6,cues:[],clock:[{time:0,position:0,velocity:1/6},{time:6,position:1,velocity:1/6}],
  path:[{time:0,shape:'parallel-lines'},{time:2,shape:'diagonal-plane'},{time:4,shape:'horizontal-sheets'},{time:6,shape:'parallel-lines'}]};
 // These real figures continue downward for the centre rays across t=2.
 const a=pose(action,2-.0001,7),b=pose(action,2+.0001,7),c=pose(action,2,7);
 assert.ok(Math.abs(a.y-b.y)/.0002>.01);
 assert.ok(Math.abs((c.y-a.y)-(b.y-c.y))<1e-8);
});
test('phrase development order depends on musical character and quiet passages do not gain a drum chase',()=>{
 const decision=texture=>({motion:'relay',shape:'parallel-lines',evidence:{texture,energy:.8,impulses:20,
  drums:texture==='drums'?.9:.1,bass:texture==='bass'?.9:.1,voice:0,tone:.5,pitchConfidence:0,irregularity:0}});
 const order=texture=>Array.from({length:8},(_,i)=>developFormationPhrase(decision(texture),i).shape);
 assert.notDeepEqual(order('drums'),order('bass'));assert.ok(new Set(order('drums')).size>=6);
 const f=fixture({texture:'melody',motion:'suspend'});assert.equal(f.action.grouping,undefined);
});
