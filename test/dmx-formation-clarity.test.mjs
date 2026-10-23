import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction,formationActionPose} from '../public/dmx-formation-actions.js';
import {formationSpatialPose} from '../public/dmx-strobe-choreography.js';
import {developFormationPhrase} from '../public/dmx-formation-music.js';
import {catalogSpatialPose,catalogFormation,catalogCandidates,catalogMatchScore} from '../public/dmx-formation-catalog.js';

const beats=Array.from({length:40},(_,i)=>i*.5);
const plan={beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)}};
const events=beats.map(time=>({time,strength:.9}));
const evidence={texture:'drums',energy:.8,tone:.5,drums:.9,bass:.2,movementDrive:.85,density:.7,impulses:40,pitchConfidence:.2};
const actionFor=(shape='geometry-span-arch',extra={})=>planFormationAction(
 {start:0,end:16,motion:'relay',shape,musicalEvidence:{...evidence,...extra}},plan,{roles:{lead:events,drums:events,bass:events}});
const poses=(action,time,count=24,row=0,groups=3)=>Array.from({length:count},(_,rank)=>formationActionPose(action,time,rank,count,row,groups,formationSpatialPose,1));

test('percussive contour pictures stay legible across their width through every group answer',()=>{
 const action=actionFor();
 for(const cue of action.cues.slice(1,12)){
  const picture=poses(action,cue.time+action.overlap+.01),lit=picture.filter(p=>p.exposure>.9);
  assert.equal(lit.length,6,'retain a sparse quarter of the rig at full strength');
  assert.ok(Math.max(...lit.map(p=>p.x))-Math.min(...lit.map(p=>p.x))>.6,'every answer must draw the contour across the stage');
  picture.forEach((p,i)=>assert.equal(p.exposure,picture[23-i].exposure,'mirrored partners enter together'));
  assert.deepEqual(poses(JSON.parse(JSON.stringify(action)),cue.time+.2),poses(action,cue.time+.2));
 }
});

test('small rigs and bass row handovers retain complete existing groups',()=>{
 const action=actionFor();
 for(const count of [1,2,3,4,8,12])for(const cue of action.cues.slice(1,8)){
  const t=cue.time+.2;
  assert.deepEqual(poses(action,t,count),poses({...action,groupOrder:undefined},t,count));
 }
 const bass=actionFor('geometry-span-arch',{texture:'bass',bass:.9,drums:.2});
 assert.equal(bass.grouping,'rows');
 for(const cue of bass.cues.slice(1,8)){
  const rows=[0,1,2].map(row=>poses(bass,cue.time+.2,24,row));
  assert.equal(rows.filter(row=>row.every(p=>p.exposure>.9)).length,1);
 }
 const quiet=actionFor('geometry-span-arch',{texture:'voice',energy:.2,movementDrive:.1});
 assert.equal(quiet.groupOrder,undefined);
});

const signature=id=>[.25,.75].flatMap(progress=>[0,1,2].flatMap(row=>Array.from({length:12},(_,rank)=>{
 const p=catalogSpatialPose(id,rank,12,row,3,progress);return [p.x,p.y];
}).flat()));
const distance=(a,b)=>{const x=signature(a),y=signature(b);return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-y[i])**2,0)/(x.length/2));};

test('successive musical pictures vary their silhouette rather than just their catalogue name',()=>{
 const music={...evidence,texture:'melody',drums:.15,bass:.15,pitchConfidence:.8,density:.65};
 const history=[],contrasts=[];
 for(let phrase=0;phrase<10;phrase++){
  const next=developFormationPhrase({motion:'relay',shape:'open-fan',evidence:music},phrase,null,{history});
  if(catalogFormation(next.shape)){
   const recent=history.slice(-3).filter(p=>catalogFormation(p.shape));
   if(recent.length)contrasts.push(Math.min(...recent.map(p=>distance(next.shape,p.shape))));
   const candidates=catalogCandidates('relay',music);
   assert.ok(catalogMatchScore(candidates[0],'relay',music)-catalogMatchScore(catalogFormation(next.shape),'relay',music)<=.75+1e-12,'visual contrast stays inside the musical fit budget');
  }
  history.push({shape:next.shape,layout:next.scene.layout});
 }
 assert.ok(contrasts.reduce((sum,v)=>sum+v,0)/contrasts.length>.17,'near-identical recent contours should not dominate the sequence');
});
