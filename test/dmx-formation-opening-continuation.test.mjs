import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionGeometry,formationGeometryPose} from '../public/dmx-formation-actions.js';
import {planFormationScenes,formationStoryPose,formationSpatialPose} from '../public/dmx-strobe-choreography.js';

const opening=[{time:0,position:0},{time:2,position:.6},{time:4,position:1},{time:24,position:1}];
const times=Array.from({length:48},(_,i)=>i*.5+.06);
const plan={duration:24,beatGrid:{beats:times.map(t=>t-.06),downbeats:times.filter((_,i)=>i%4===0).map(t=>t-.06)}};
const timeline={roles:{lead:times.map(time=>({time,strength:.9})),bass:[],drums:[]}};
const story=(start=0,end=24)=>({start,end,motion:'bloom',shape:'open-fan',opening,
 musicalEvidence:{energy:.85,movementDrive:.6,texture:'sustain'}});
const pose=(action,time,progress=1)=>formationGeometryPose(formationActionGeometry(action,time,progress),0,16,0,3,formationSpatialPose);

test('a later phrase continues a completed opening despite the earlier rise in its shared track',()=>{
 const action=planFormationAction(story(8),plan,timeline);
 assert.equal(action.movingOpening,true);
 assert.equal(action.path[0].time,8);
 const a=pose(action,10),b=pose(action,12);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.05,'the inherited full opening must not freeze for the remainder of the passage');
 for(const point of action.path.slice(1,-1))assert.ok(times.includes(point.time),'turns retain actual measured source times');
});

test('an opening first follows the measured rise, then develops its completed picture',()=>{
 const action=planFormationAction(story(),plan,timeline);
 assert.equal(action.path[0].time,4);
 for(const [time,progress]of [[0,0],[1,.3],[2,.6],[3,.8]])
  assert.deepEqual(pose(action,time,progress),pose({...action,path:null},time,progress),'continuation must not replace the original build');
 const epsilon=.00001,a=pose(action,4-epsilon,1),b=pose(action,4+epsilon,1);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'completion joins the full opening without a jump');
 assert.ok(Math.abs(pose(action,5).x-pose(action,7).x)>.05);
 assert.deepEqual(pose(action,11),pose(JSON.parse(JSON.stringify(action)),11),'serialized previews follow the identical continuation');
});

test('an unfinished opening and a completed opening without source entrances retain their measured hold',()=>{
 const unfinished=planFormationAction({...story(),opening:[{time:0,position:0},{time:24,position:1}]},plan,timeline);
 assert.equal(unfinished.movingOpening,false);assert.equal(unfinished.path,undefined);
 const quiet=planFormationAction(story(8),plan,{roles:{lead:[],bass:[],drums:[]}});
 assert.equal(quiet.movingOpening,false);assert.equal(quiet.path,undefined,'a beat grid alone cannot invent movement statements');
});

test('completed opening phrases inherit the previous endpoint instead of reopening at each phrase cut',()=>{
 const input={...plan,arrangement:{times,accents:times.map(()=>.95),eventSources:times.map(()=>'onset'),
  patterns:{phrases:[{start:8}]},motionEnvelope:[0,2,4,24].map(time=>({time,energy:.2+.6*Math.min(1,time/4),tone:.4}))}};
 const sequence={start:0,end:24,role:'flow',energy:.8,formationId:'open-fan',
  sharedPassage:{motif:'sustained-opening',sequence:'opening',composition:'open-fan',intent:{motionDrive:.6}},
  entrances:times.map(time=>({time,strength:.9}))};
 const scenes=planFormationScenes([sequence],input);
 assert.equal(scenes.length,2);
 const previous=scenes[0].formationStory,current=scenes[1].formationStory;
 assert.equal(current.action.movingOpening,true);assert.ok(current.action.entry);
 for(const [count,groups]of [[16,3],[2,24]])for(let row=0;row<groups;row++)for(let rank=0;rank<count;rank++){
  const a=formationStoryPose(previous,8,rank,count,row,groups),b=formationStoryPose(current,8,rank,count,row,groups);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,'the completed opening must continue from the outgoing rays');
 }
 const a=formationStoryPose(current,10,0,16,0,3),b=formationStoryPose(current,12,0,16,0,3);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.02);
 assert.deepEqual(formationStoryPose(current,10,0,16,0,3,true),formationStoryPose(current,15,0,16,0,3,true));
});
