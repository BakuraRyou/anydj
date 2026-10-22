import test from 'node:test';
import assert from 'node:assert/strict';
import {formationSpatialPose,formationStoryPose} from '../public/dmx-strobe-choreography.js';
import {planFormationAction} from '../public/dmx-formation-actions.js';
import {groupComposition} from '../public/dmx-group-motion.js';

test('fans and the lattice crossing keep mirrored elevation throughout each picture',()=>{
 for(const shape of ['open-fan','twin-fans','crossed-fans','lattice','crossed-sheets'])for(const count of [2,9,16,32])for(const row of [0,1,2])for(const progress of [0,.23,.71,1]){
  const rays=Array.from({length:count},(_,rank)=>formationSpatialPose(shape,rank,count,row,3,progress));
  rays.forEach((a,rank)=>{const b=rays[count-1-rank];
   assert.ok(Math.abs(a.x+b.x-1)<1e-10,`${shape}: mirrored pan`);
   assert.ok(Math.abs(a.y-b.y)<1e-10,`${shape}: mirrored elevation`);
  });
 }
});
test('open and twin fans spread in mount order without folding their inner rays or clipping their outer rays',()=>{
 for(const shape of ['open-fan','twin-fans'])for(const count of [16,32])for(const progress of [0,.3,.8,1]){
  const rays=Array.from({length:count},(_,rank)=>formationSpatialPose(shape,rank,count,1,3,progress));
  assert.ok(rays.every(p=>p.x>0&&p.x<1));
  for(let i=1;i<rays.length;i++)assert.ok(rays[i].x>rays[i-1].x,`${shape}: each consecutive ray has its own ordered direction`);
 }
});

const beats=Array.from({length:40},(_,i)=>i*.5),timeline={roles:{lead:beats.map(time=>({time,strength:.8})),drums:[],bass:[]}};
const plan={beatGrid:{beats},score:{notes:[8.2,10.3,12.4,14.5].map(start=>({start,end:start+.6,confidence:.9}))}};
const makeStory=(shape,motion,start,end,evidence)=>{
 const story={start,end,arcStart:start,arcEnd:end,shape,motion,direction:1,energy:.5,
  musicalEvidence:evidence,knots:[{time:start,position:0},{time:end,position:1}]};
 return {...story,action:planFormationAction(story,plan,timeline)};
};
test('a newly leading fan bank develops from its own frame pose rather than the other familys pan endpoint',()=>{
 const old=makeStory('horizontal-sheets','relay',0,8,{texture:'drums',energy:.5});
 const next=makeStory('split-wings','suspend',8,16,{texture:'sustain',energy:.5});
 next.action.entry={shape:'horizontal-sheets',progress:1};next.action.entryShape=old.shape;
 const figure=time=>({presentation:'strobe',flicker:53,rigFamily:'banks',rigRow:0,rigGroups:3,music:{sequence:{
  start:8,end:16,time,age:time-8,role:'held',sharedPassage:{},formationId:next.shape,formationProgram:{kind:'sculpture'},formationStory:next,
  previous:{end:8,formationId:old.shape,formationProgram:{kind:'sweep'},formationStory:old}}}});
 for(const time of [8.00001,9.9,11,13,15]){
  const f=figure(time),wire=JSON.parse(JSON.stringify(f));
  for(let rank=0;rank<16;rank++){
   const a=groupComposition(f,rank,32,0,3),b=groupComposition(f,31-rank,32,0,3);
   assert.ok(Math.abs(a.x+b.x-1)<1e-9,'the incoming bank must stay centred');
   assert.ok(Math.abs(a.y-b.y)<1e-9);
   const transferred=groupComposition(wire,rank,32,0,3);
   for(const key of ['x','y','level','beamFocus'])assert.ok(Math.abs(a[key]-transferred[key])<1e-9);
  }
 }
 assert.deepEqual(next.action.entry,{shape:'horizontal-sheets',progress:1},'rig-specific evaluation does not mutate the shared story');
});

const audioFrame=(pitch,confidence)=>({rows:[0,8].map(time=>({time,energy:.7,tone:.5,pitch,pitchConfidence:confidence})),
 clock:[{time:0,position:0,velocity:1},{time:8,position:8,velocity:1}],roles:timeline.roles});
test('pitch-estimator fluctuations cannot wobble a percussive picture while reliable melodic motion still works',()=>{
 const story=makeStory('open-fan','relay',0,8,{texture:'drums',energy:.7,pitchConfidence:.9});
 for(const time of [1.13,2.47,4.19,6.31])for(const rank of [0,7,16,31]){
  const low=formationStoryPose({...story,audioFrame:audioFrame(.1,.9)},time,rank,32,1,3);
  const high=formationStoryPose({...story,audioFrame:audioFrame(.9,.9)},time,rank,32,1,3);
  assert.equal(low.x,high.x);assert.equal(low.y,high.y);
 }
 const melody={...story,musicalEvidence:{...story.musicalEvidence,texture:'melody'}};
 const a=formationStoryPose({...melody,audioFrame:audioFrame(.1,.9)},3,0,32,1,3);
 const b=formationStoryPose({...melody,audioFrame:audioFrame(.9,.9)},3,0,32,1,3);
 assert.ok(b.y-a.y>.05,'reliable pitch retains its musical role');
});
test('a crossing illuminates mirrored rays together instead of breaking its picture into unrelated wings',()=>{
 const story=makeStory('lattice','weave',0,8,{texture:'drums',energy:.8,movementDrive:.9});
 const figure=time=>({presentation:'strobe',flicker:53,music:{sequence:{time,age:time,role:'flow',sharedPassage:{},
  formationId:story.shape,formationProgram:{kind:'sweep'},formationStory:story}}});
 for(let time=.1;time<8;time+=.13)for(let rank=0;rank<16;rank++){
  const a=groupComposition(figure(time),rank,32,1,3),b=groupComposition(figure(time),31-rank,32,1,3);
  assert.ok(Math.abs(a.level-b.level)<1e-10);assert.ok(Math.abs(a.x+b.x-1)<1e-10);assert.ok(Math.abs(a.y-b.y)<1e-10);
 }
});
test('sustained melodic development chooses a fan spanning the centre instead of a parallel outward wing',()=>{
 const story=makeStory('radial-wheel','suspend',8,16,{texture:'sustain',energy:.5,tone:.8});
 assert.equal(story.action.kind,'develop');assert.equal(story.action.to,'crossed-fans');
 const rays=Array.from({length:32},(_,rank)=>formationSpatialPose(story.action.to,rank,32,0,3,1));
 assert.ok(rays.slice(0,16).every(p=>p.x>.5));assert.ok(rays.slice(16).every(p=>p.x<.5));
 assert.equal(new Set(rays.map(p=>p.x)).size,32,'every ray contributes to the fan');
});
