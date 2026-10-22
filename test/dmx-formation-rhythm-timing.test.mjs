import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionPose} from '../public/dmx-formation-actions.js';
import {formationSpatialPose} from '../public/dmx-strobe-choreography.js';

function fixture({offset=0,missing=[],tempoChange=false}={}){
 let time=.02;
 const beats=Array.from({length:24},(_,i)=>{const t=time;time+=tempoChange&&i>=8?.4:.48;return t;});
 const downbeats=beats.filter((_,i)=>i%4===0),end=beats.at(-1)+.4;
 const lead=beats.map((time,i)=>({time:time+offset,strength:.9,kind:'onset',index:i})).filter(e=>!missing.includes(e.index));
 const bass=beats.filter((_,i)=>i%2===0).map(time=>({time:time+.2,strength:1}));
 const story={start:0,end,motion:'relay',shape:'parallel-lines',direction:1,
  musicalEvidence:{texture:'bass',energy:.8,movementDrive:.9}};
 const plan={beatGrid:{beats,downbeats}},timeline={roles:{lead,bass,drums:[]}};
 return {action:planFormationAction(story,plan,timeline),story,plan,timeline};
}
test('rhythmic movement follows prepared bar attacks instead of late stem energy peaks',()=>{
 const {action,plan,timeline}=fixture();
 assert.equal(action.source,'bass','the bass still defines the musical texture');
 assert.equal(action.cueSource,'rhythm');
 for(const p of action.path.slice(1,-1)){
  assert.ok(plan.beatGrid.downbeats.includes(p.time));
  assert.ok(timeline.roles.lead.some(e=>e.time===p.time));
  assert.ok(!timeline.roles.bass.some(e=>e.time===p.time));
 }
 assert.deepEqual(action.cues.map(e=>e.time),plan.beatGrid.beats.filter((_,i)=>i%2===0));
});
test('rhythmic endpoints arrive on the actual measured onset without quantizing its small timing offset away',()=>{
 const {action,plan}=fixture({offset:.03});
 assert.equal(action.cueSource,'rhythm');
 assert.deepEqual(action.path.slice(1,-1).map(p=>p.time),plan.beatGrid.downbeats.filter(t=>t>=.96&&t<action.end-.96).map(t=>t+.03));
 const cue=action.path[1],expected=formationSpatialPose(cue.shape,0,16,0,3,1);
 const pose=formationActionPose(action,cue.time,0,16,0,3,formationSpatialPose,1);
 assert.ok(Math.hypot(pose.x-expected.x,pose.y-expected.y)<1e-9);
});
test('a missing bar attack is skipped while later bars retain the same metric phase',()=>{
 const {action,plan,timeline}=fixture({missing:[8]});
 assert.equal(action.cueSource,'rhythm');
 assert.ok(!action.path.some(p=>p.time===plan.beatGrid.beats[8]));
 assert.ok(action.path.some(p=>p.time===plan.beatGrid.beats[12]));
 assert.ok(action.cues.every(c=>timeline.roles.lead.some(e=>e.time===c.time)));
});
test('measured bar positions remain authoritative through a tempo change',()=>{
 const {action,plan}=fixture({tempoChange:true});
 for(const turn of action.path.slice(1,-1))assert.ok(plan.beatGrid.downbeats.includes(turn.time));
 assert.ok(action.path.some(p=>p.time===plan.beatGrid.downbeats[3]));
});
test('the grid cannot invent attacks or erase an independently measured syncopated source',()=>{
 const {story,plan}=fixture();
 const empty=planFormationAction(story,plan,{roles:{lead:[],bass:[],drums:[]}});
 assert.equal(empty.kind,'hold');assert.equal(empty.path,undefined);assert.equal(empty.cues.length,0);
 const {action,timeline}=fixture({offset:.24});
 assert.equal(action.cueSource,'bass');
 assert.ok(action.cues.every(c=>timeline.roles.bass.some(e=>e.time===c.time)));
});
test('the answering group reaches its source hit within one video frame while the old group leaves a soft tail',()=>{
 const {action}=fixture(),cue=action.cues[1];
 const sample=(time,rank)=>formationActionPose(action,time,rank,16,0,3,formationSpatialPose,1).exposure;
 assert.ok(sample(cue.time-.001,4)<.2,'the next group cannot light before the hit');
 assert.ok(sample(cue.time+1/60,4)>.95,'a symmetric slow fade must not delay the new group');
 assert.ok(sample(cue.time+1/60,7)>.5,'the outgoing group retains its short tail');
 assert.ok(sample(cue.time+action.overlap,7)<.2);
});
