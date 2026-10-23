import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionPose,formationActionProgress} from '../public/dmx-formation-actions.js';
import {formationSpatialPose,formationStoryPose} from '../public/dmx-strobe-choreography.js';
const roles={lead:[],drums:[],bass:[]};
const picture=(action,time,opening=1)=>Array.from({length:16},(_,rank)=>formationActionPose(action,time,rank,16,0,3,formationSpatialPose,opening));
const travel=(a,b)=>Math.sqrt(a.reduce((sum,p,i)=>sum+(p.x-b[i].x)**2+(p.y-b[i].y)**2,0)/a.length);
function sustainedNote(){
 const story={start:0,end:16,arcStart:0,arcEnd:16,motion:'suspend',shape:'horizontal-sheets',
  musicalEvidence:{texture:'melody',energy:.45,tone:.45}};
 const plan={score:{notes:[{start:1,end:3,confidence:.9},{start:3,end:16,confidence:.9}]}};
 return {...story,action:planFormationAction(story,plan,{roles})};
}

test('a planned melodic development continues through the sustained last note instead of exhausting its clock',()=>{
 const story=sustainedNote(),action=story.action;
 assert.equal(action.kind,'develop');assert.equal(action.source,'melody');
 assert.ok(formationActionProgress(action,3)<1,'last attack does not mean the phrase is over');
 assert.ok(travel(picture(action,7),picture(action,14))>.01,'the final sustained note still carries the planned development');
 assert.equal(formationActionProgress(action,16),1);
 for(const cue of action.clock.slice(1,-1)){
  const dt=.0001,left=(formationActionProgress(action,cue.time)-formationActionProgress(action,cue.time-dt))/dt,
   right=(formationActionProgress(action,cue.time+dt)-formationActionProgress(action,cue.time))/dt;
  assert.ok(left>0&&right>0);assert.ok(Math.abs(left-right)<.001);
 }
});

test('a completed withdrawal retains a compact moving picture until the musical handover',()=>{
 const story={start:0,end:16,arcStart:0,arcEnd:16,motion:'gather',shape:'open-fan',
  musicalEvidence:{texture:'sustain',energy:.35,tone:.4},opening:[{time:0,position:0},{time:4,position:1},{time:16,position:1}]};
 const timeline={roles:{...roles,lead:[1,3,5,7,9,11,13,15].map(time=>({time,strength:.7}))}};
 const action=planFormationAction(story,{},timeline);
 assert.equal(action.kind,'closing');
 for(const time of [5,8,12,15.9]){
  const p=picture(action,time);
  assert.ok(p.some(v=>v.exposure>.5),'a relative withdrawal cannot close every shutter');
  assert.equal(p[7].exposure,p[8].exposure);
 }
 assert.ok(travel(picture(action,8),picture(action,14))>.0001,'the settled energy contour cannot freeze the complete picture');
 for(const count of [1,2,3,4,9,16,24])for(const groups of [1,3,24]){
  const p=Array.from({length:groups},(_,row)=>Array.from({length:count},(_,rank)=>formationActionPose(action,15,rank,count,row,groups,formationSpatialPose,1))).flat();
  assert.ok(p.some(p=>p.exposure>.5),`${count} devices / ${groups} groups lost its compact picture`);
 }
 for(const time of [5,10,15])assert.deepEqual(picture(action,time),picture(JSON.parse(JSON.stringify(action)),time));
});

test('explicit holds and actual rest actions remain authoritative over the continued development',()=>{
 const story=sustainedNote();story.knots=[{time:0,position:0},{time:16,position:1}];
 for(let rank=0;rank<16;rank++)assert.deepEqual(formationStoryPose(story,4,rank,16,0,3,true),formationStoryPose(story,14,rank,16,0,3,true));
 const rest=planFormationAction({...story,motion:'rest'}, {},{roles});
 assert.ok(picture(rest,8).every(p=>p.exposure===0));
 const hold=planFormationAction({...story,motion:'suspend',musicalEvidence:{energy:.2}}, {},{roles});
 assert.equal(hold.kind,'hold');assert.equal(hold.cues.length,0);
});

test('measured source entrances carry partial opening plateaus without advancing aperture or adding flashes',()=>{
 const beats=Array.from({length:24},(_,i)=>i*.5),timeline={roles:{...roles,lead:beats.map(time=>({time,strength:.8}))}};
 for(const shape of ['nested-gates','open-fan']){
  const story={start:0,end:12,arcStart:0,arcEnd:12,motion:'bloom',shape,direction:1,
   musicalEvidence:{texture:'bass',energy:.5,bass:.5,movementDrive:.4},
   opening:[{time:0,position:0},{time:3,position:.25},{time:9,position:.25},{time:11,position:1},{time:12,position:1}]};
  const action=planFormationAction(story,{beatGrid:{beats}},timeline);
  const a=picture(action,4,.25),b=picture(action,5,.25);
  assert.ok(travel(a,b)>.0001,`${shape}: partial opening cannot impose a collective hold`);
  assert.deepEqual(a.map(p=>p.exposure),b.map(p=>p.exposure),'source-carried motion cannot force the build open or add pulses');
  assert.deepEqual(picture(action,5,.25),picture(JSON.parse(JSON.stringify(action)),5,.25));
  const value={...story,action,knots:[{time:0,position:0},{time:12,position:1}]};
  assert.deepEqual(formationStoryPose(value,4,0,16,0,3,true),formationStoryPose(value,8,0,16,0,3,true));
 }
});
