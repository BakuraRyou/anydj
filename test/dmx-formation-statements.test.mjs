import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionPose} from '../public/dmx-formation-actions.js';
import {planFormationScenes,formationStoryPose,formationSpatialPose,formationSceneStateAt,strobeChoreography} from '../public/dmx-strobe-choreography.js';

function drop(offset=.17){
 const beats=Array.from({length:60},(_,i)=>i*.4),times=beats.map(t=>t+offset);
 const plan={duration:24,beatGrid:{beats},arrangement:{times,accents:times.map(()=>.95),eventSources:times.map(()=>'onset'),
  bassAttacks:times.filter(t=>t>=8).map(time=>({time,strength:1})),
  motionEnvelope:[0,8,16,24].map(time=>({time,energy:time<8?.4:.85,tone:.4}))},
  score:{notes:Array.from({length:8},(_,i)=>({start:i+.2,end:i+.7,confidence:.9}))}};
 const sequences=[['held','breath','horizontal-sheets'],['arrival','opening','nested-gates'],['flow','wave','opposed-diagonals']]
  .map(([role,sequence,composition],i)=>({start:i*8,end:(i+1)*8,role,energy:i?.85:.4,
   sharedPassage:{motif:'riff',sequence,composition,intent:{transition:{overlap:.7},staging:{climax:i===1}}},
   entrances:times.filter(t=>t>=i*8&&t<(i+1)*8).map(time=>({time,strength:.95}))}));
 return {scenes:planFormationScenes(sequences,plan),sequences,plan};
}
const picture=(story,time,count=16,groups=3)=>Array.from({length:groups},(_,row)=>Array.from({length:count},(_,rank)=>
 formationActionPose(story.action,time,rank,count,row,groups,formationSpatialPose,1))).flat();

test('an impact keeps its full arrival picture but continues moving during the following musical statements',()=>{
 const {scenes}=drop(),story=scenes.find(s=>s.start===8).formationStory;
 assert.equal(story.action.kind,'opening');assert.equal(story.action.movingOpening,true);
 assert.ok(story.action.path.length>=3,'a full opening must continue through complete moving statements');
 for(const [count,groups]of [[16,3],[2,24]])for(let t=8.3;t<15;t+=.7){
  const a=picture(story,t,count,groups),samples=[.2,.4,.6].map(dt=>picture(story,t+dt,count,groups));
  // Include the middle of a turn: its two endpoints can legitimately match.
  assert.ok(samples.some(b=>a.some((p,i)=>Math.hypot(p.x-b[i].x,p.y-b[i].y)>.01)),`visible geometry must move at ${t}, ${count}/${groups}`);
  assert.ok(a.every(p=>p.exposure>=.65),'the ongoing picture stays lit between accents');
 }
});
test('movement statements land on measured source entrances and follow their offset',()=>{
 const a=drop(.17),b=drop(.29),x=a.scenes.find(s=>s.start===8).formationStory.action,y=b.scenes.find(s=>s.start===8).formationStory.action;
 assert.deepEqual(a.plan.beatGrid,b.plan.beatGrid);
 for(const p of x.path.slice(1,-1))assert.ok(a.plan.arrangement.times.some(t=>Math.abs(t-p.time)<1e-9));
 assert.ok(Math.abs(y.path[1].time-x.path[1].time-.12)<1e-9);
});
test('connected passages retain their geometry, including a prepared arrival on a sparse festival rig',()=>{
 const {scenes}=drop();
 assert.ok(scenes[0].formationStory.departure.start<8);
 for(let i=1;i<scenes.length;i++)for(let row=0;row<24;row++)for(let rank=0;rank<2;rank++){
  const a=formationStoryPose(scenes[i-1].formationStory,scenes[i].start,rank,2,row,24),b=formationStoryPose(scenes[i].formationStory,scenes[i].start,rank,2,row,24);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,'a new passage must not teleport the rays');
 }
});
test('many opposing pairs jointly draw the interior of a formation instead of duplicating only its outer rays',()=>{
 const story={action:planFormationAction({start:0,end:8,motion:'bloom',shape:'nested-gates',opening:[{position:1}],musicalEvidence:{energy:.8}},
  {beatGrid:{beats:[0,.4,.8,1.2]}},{roles:{lead:[.17,1.17,2.17].map(time=>({time})),bass:[],drums:[]}})};
 const rays=picture(story,0,2,24);
 assert.ok(new Set(rays.map(p=>p.y.toFixed(3))).size>=16);
 for(let i=0;i<rays.length;i+=2){assert.ok(Math.abs(rays[i].x+rays[i+1].x-1)<1e-9);assert.ok(Math.abs(rays[i].y-rays[i+1].y)<1e-9);}
});
test('a missing dominant source does not hold an otherwise measured rhythmic passage',()=>{
 const story={start:0,end:8,motion:'dialogue',shape:'split-wings',musicalEvidence:{texture:'voice',energy:.8}};
 const action=planFormationAction(story,{}, {roles:{lead:[],bass:[],drums:[.2,1.3,2.4,3.5].map(time=>({time,strength:.8}))}});
 assert.equal(action.kind,'answer');assert.equal(action.source,'drums');
 const quiet=planFormationAction({...story,motion:'suspend'}, {}, {roles:{lead:[],bass:[],drums:[]}});
 assert.equal(quiet.kind,'hold','actual quietness still permits a held image');
});
test('a connected first statement chooses a different destination from its inherited picture',()=>{
 const {plan,sequences}=drop();
 const passages=sequences.slice(0,2).map((s,i)=>({...s,role:'flow',sharedPassage:{motif:`riff-${i}`,sequence:'wave',composition:'parallel-lines',intent:{transition:{overlap:.7}}}}));
 const scenes=planFormationScenes(passages,structuredClone(plan)),action=scenes[1].formationStory.action;
 assert.equal(action.from,'parallel-lines');assert.equal(action.to,'diagonal-plane');
 assert.equal(action.entry.shape,'diagonal-plane');
 assert.equal(action.path[1].shape,'parallel-lines','the first statement must move away from the inherited diagonal');
});
test('connected moving passages remain deterministic, transferable and manually freezable',()=>{
 const {scenes,sequences}=drop();
 for(const time of [7.7,8.03,9.2,12.5,16.2,19.4]){
  const sequence=sequences.find(s=>time>=s.start&&time<s.end),state=formationSceneStateAt(sequence,time);
  const figure={presentation:'strobe',flicker:53,music:{sequence:{...sequence,...state,time}}},wire=JSON.parse(JSON.stringify(figure));
  for(const rank of [0,1])for(const row of [0,7,23])for(const key of ['x','y','level'])
   assert.ok(Math.abs(strobeChoreography(figure,rank,2,row,24)[key]-strobeChoreography(wire,rank,2,row,24)[key])<1e-9);
 }
 const story=scenes.find(s=>s.start===8).formationStory;
 assert.deepEqual(formationStoryPose(story,9,0,2,7,24,true),formationStoryPose(story,14,0,2,7,24,true));
});


test('a bank that becomes the next leader can prepare its arrival while it is still accompaniment',()=>{
 const {scenes,sequences}=drop(),outgoing=scenes[0].formationStory,incoming=scenes[1].formationStory;
 assert.ok(outgoing.departure);
 const target=formationStoryPose(incoming,8,0,16,0,3,false,'lead');
 const frame=formationStoryPose(outgoing,8,0,16,0,3,false,'frame');
 assert.ok(Math.hypot(frame.x-target.x,frame.y-target.y)<1e-9,'the formerly supporting bank must be ready on the hit');
 const early=formationStoryPose(outgoing,outgoing.departure.start-.01,0,16,0,3,false,'frame');
 assert.equal(early.x,.5);assert.equal(early.y,.24);
 for(const time of [7.5,7.9,8,8.02]){
  const sequence=sequences.find(s=>time>=s.start&&time<s.end),state=formationSceneStateAt(sequence,time);
  const figure={presentation:'strobe',flicker:53,rigFamily:'banks',music:{sequence:{...sequence,...state,time}}};
  const wire=JSON.parse(JSON.stringify(figure));
  assert.deepEqual(strobeChoreography(figure,0,16,0,3),strobeChoreography(wire,0,16,0,3));
 }
});

test('both incoming and retiring rig families reach their own prepared pose before an arrival',()=>{
 const {sequences}=drop();
 const at=(time,family)=>{
  const sequence=sequences.find(s=>time>=s.start&&time<s.end),state=formationSceneStateAt(sequence,time);
  return {presentation:'strobe',flicker:53,rigFamily:family,music:{sequence:{...sequence,...state,time}}};
 };
 const dt=.00001;
 for(const family of ['rows','banks'])for(const rank of [0,4,11,15])for(const row of [0,1,2]){
  const before=strobeChoreography(at(8-dt,family),rank,16,row,3),on=strobeChoreography(at(8,family),rank,16,row,3),after=strobeChoreography(at(8+dt,family),rank,16,row,3);
  assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<1e-7,'switching the leader must not demand an immediate return stroke');
  if(family==='rows'){
   assert.ok(Math.abs(on.x-.5)<1e-9);assert.ok(Math.abs(on.y-(.24+row*.25))<1e-9);
   assert.equal(on.beamFocus,0,'the retiring plane must already be in its own frame');
  }
  assert.deepEqual(strobeChoreography(at(7.8,family),rank,16,row,3),strobeChoreography(JSON.parse(JSON.stringify(at(7.8,family))),rank,16,row,3));
 }
});
