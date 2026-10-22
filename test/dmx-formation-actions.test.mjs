import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionProgress,formationActionPose} from '../public/dmx-formation-actions.js';
import {formationSpatialPose,formationStoryPose} from '../public/dmx-strobe-choreography.js';
const plan={beatGrid:{beats:Array.from({length:24},(_,i)=>i*.5)}};
const base={start:0,end:12,arcStart:0,arcEnd:12,motion:'relay',shape:'parallel-lines',direction:1,energy:.8,
 musicalEvidence:{texture:'drums',energy:.8,movementDrive:.8},knots:[{time:0,position:0},{time:12,position:1}]};
const timeline={roles:{lead:[],bass:[],drums:Array.from({length:24},(_,i)=>({time:i*.5+.13,strength:.9}))}};
const actionFor=motion=>planFormationAction({...base,motion},plan,timeline);
const picture=(action,time,count=16,row=0,groups=3)=>Array.from({length:count},(_,rank)=>formationActionPose(action,time,rank,count,row,groups,formationSpatialPose,.7));

test('each musical action owns an explicit picture pair and measured group entrance cues',()=>{
 for(const [motion,kind]of [['relay','handoff'],['dialogue','answer'],['weave','crossing'],['bloom','opening'],['gather','closing'],['suspend','develop'],['rest','rest']]){
  const action=actionFor(motion);assert.equal(action.kind,kind);
  assert.ok(action.cues.every(c=>timeline.roles.drums.some(e=>e.time===c.time)));
  if(!['hold','rest'].includes(kind))assert.notEqual(action.from,action.to);
 }
});
test('an action follows a finite musical statement with continuous forward progress',()=>{
 const action=actionFor('weave');let previous=0;
 for(let t=0;t<=12;t+=.003){const p=formationActionProgress(action,t);assert.ok(p>=previous-1e-10);previous=p;}
 for(const cue of action.clock.slice(2,-2)){
  const d=.00001,left=(formationActionProgress(action,cue.time)-formationActionProgress(action,cue.time-d))/d;
  const right=(formationActionProgress(action,cue.time+d)-formationActionProgress(action,cue.time))/d;
  assert.ok(left>0&&right>0);assert.ok(Math.abs(left-right)<.001);
 }
 assert.equal(formationActionProgress(action,12),1);
});
test('handoff groups share light through the actual source entrance without a master blackout',()=>{
 const action=actionFor('relay'),cue=action.cues[1];
 const before=picture(action,cue.time-.001),after=picture(action,cue.time+action.overlap),during=picture(action,cue.time+action.overlap/2);
 assert.ok(before[0].exposure>.9&&before[5].exposure<.2);
 assert.ok(after[0].exposure<.2&&after[5].exposure>.9);
 assert.ok(during[0].exposure>.65&&during[5].exposure>.65);
 assert.ok(during.every(p=>p.exposure>=.12));
});
test('an answer changes the participating wing on its measured cue',()=>{
 const action=actionFor('dialogue'),cue=action.cues[1];
 const a=picture(action,cue.time-.001),b=picture(action,cue.time+action.overlap);
 assert.ok(a[1].exposure>.9&&a[14].exposure<.2);
 assert.ok(b[1].exposure<.2&&b[14].exposure>.9);
});
test('a complete crossing retains evenly spaced rays across the plane',()=>{
 const action=actionFor('weave');
 for(let t=.2;t<12;t+=.13){const p=picture(action,t);
  for(let i=1;i<15;i++)for(const axis of ['x','y'])assert.ok(Math.abs(p[i+1][axis]-2*p[i][axis]+p[i-1][axis])<1e-10);
 }
 assert.notDeepEqual(picture(action,.3).map(p=>[p.x,p.y]),picture(action,11.7).map(p=>[p.x,p.y]));
});
test('complete actions replace the former independent variation, layout mask and swing overlays',()=>{
 const action=actionFor('weave'),story={...base,action};
 const altered={...story,variation:{gesture:'scissor',path:'zigzag',amplitude:.9},scene:{layout:'islands'}};
 for(const time of [1,3,7,10])for(const rank of [0,3,7,12,15])
  assert.deepEqual(formationStoryPose(story,time,rank,16,1,3),formationStoryPose(altered,time,rank,16,1,3));
});
test('small and irregular rigs hand light only to groups that actually exist',()=>{
 for(const texture of ['drums','bass'])for(const count of [1,2,3,4,16])for(const groups of [1,2,3,24])for(const motion of ['relay','dialogue','weave']){
  const action=planFormationAction({...base,motion,musicalEvidence:{...base.musicalEvidence,texture}},plan,{roles:{...timeline.roles,bass:timeline.roles.drums}});
  for(let time=1;time<10;time+=.17){const poses=Array.from({length:groups},(_,row)=>picture(action,time,count,row,groups)).flat();
   assert.ok(poses.every(p=>[p.x,p.y,p.exposure].every(v=>Number.isFinite(v)&&v>=0&&v<=1)));
   assert.ok(poses.some(p=>p.exposure>.65),`${motion}: ${count} heads / ${groups} groups at ${time}`);
  }
 }
});

test('reliable melodic entrances can lead an answer while uncertain notes cannot invent one',()=>{
 const story={...base,motion:'dialogue',musicalEvidence:{texture:'melody'}};
 const score=confidence=>({...plan,score:{notes:[1.17,3.29,5.41].map(start=>({start,end:start+.4,confidence}))}});
 const none={roles:{lead:[],bass:[],drums:[]}};
 const uncertain=planFormationAction(story,score(.2),none),measured=planFormationAction(story,score(.9),none);
 assert.equal(uncertain.kind,'hold');assert.equal(uncertain.cues.length,0);
 assert.equal(measured.kind,'answer');assert.deepEqual(measured.cues.map(c=>c.time),[1.17,3.29,5.41]);
});
