import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMATION_CATALOG,catalogCandidates,catalogCounterpart} from '../public/dmx-formation-catalog.js';
import {FORMATION_SCENES} from '../public/dmx-formation-scenes.js';
import {formationSpatialPose,formationStoryPose,FORMATION_NAMES,planFormationScenes,formationSceneStateAt,strobeChoreography} from '../public/dmx-strobe-choreography.js';
import {planFormationAction} from '../public/dmx-formation-actions.js';
import {developFormationPhrase} from '../public/dmx-formation-music.js';
const evidence={texture:'drums',energy:.8,tone:.5,drums:.85,bass:.3,movementDrive:.8,density:.8,impulses:30,pitchConfidence:.2};
const beats=Array.from({length:80},(_,i)=>i*.5),plan={duration:32,beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)}},timeline={roles:{lead:beats.map(time=>({time,strength:.9})),drums:[],bass:[]}};
function story(shape,layout='ensemble'){
 const value={shape,start:0,end:16,arcStart:0,arcEnd:16,motion:'weave',scene:{layout},musicalEvidence:evidence,knots:[{time:0,position:0},{time:16,position:1}]};
 return {...value,action:planFormationAction(value,plan,timeline)};
}
const trace=value=>[.3,2.7,5.9].flatMap(time=>[0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>{
 const p=formationStoryPose(value,time,rank,16,row,3);return [p.x,p.y,p.beamFocus,p.exposure].map(v=>Math.round(v*1e5));
}))).flat().join(',');

test('300 additional spatial constructions each expose six subforms in the actual action engine',()=>{
 assert.equal(FORMATION_CATALOG.length,300);assert.equal(new Set(FORMATION_CATALOG.map(f=>f.id)).size,300);
 const signatures=new Set();
 for(const form of FORMATION_CATALOG){
  assert.ok(FORMATION_NAMES[form.id]);assert.ok(FORMATION_NAMES[catalogCounterpart(form.id)]);
  const scenes=FORMATION_SCENES.filter(s=>s.shape===form.id);assert.equal(scenes.length,6);
  for(const scene of scenes)signatures.add(trace(story(form.id,scene.layout)));
 }
 assert.equal(signatures.size,1800,'all 1800 new subforms must alter real geometry or fixture membership');
});
test('new constructions remain bounded on sparse, odd and full rigs, including cyclic wraparound',()=>{
 for(const form of FORMATION_CATALOG)for(const [count,groups]of [[1,1],[2,24],[9,3],[32,3]])for(const p of [0,.23,.71,1]){
  for(const rank of [0,Math.floor((count-1)/2),count-1])for(const row of [0,groups-1]){
   const pose=formationSpatialPose(form.id,rank,count,row,groups,p);
   assert.ok([pose.x,pose.y,pose.beamFocus,pose.membership].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  }
  if(form.cyclic){const a=formationSpatialPose(form.id,0,count,0,groups,0),b=formationSpatialPose(form.id,0,count,0,groups,1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,form.id);}
 }
});
test('the complete expansion is reachable through musical phrase development, with section suitability retained',()=>{
 const reached=new Set();
 for(let phrase=0;phrase<620;phrase++)reached.add(developFormationPhrase({motion:'weave',shape:'open-fan',evidence},phrase).shape);
 assert.ok(FORMATION_CATALOG.every(f=>reached.has(f.id)));
 assert.notDeepEqual(catalogCandidates('relay',evidence).slice(0,12).map(f=>f.id),catalogCandidates('dialogue',{...evidence,texture:'voice',drums:.1,voice:.8}).slice(0,12).map(f=>f.id));
 for(const f of catalogCandidates('suspend',{energy:.2,texture:'voice'}))assert.ok(!['quarters','lanes','woven'].includes(f.structure.id));
});
test('expanded scene selection changes at measured phrases and survives playback, seeking, transfer and manual freeze',()=>{
 const times=beats.filter(t=>t<32),input={...plan,arrangement:{times,accents:times.map(()=>.9),eventSources:times.map(()=>'onset'),
  motionEnvelope:[0,32].map(time=>({time,energy:.8,tone:.5})),patterns:{phrases:[0,8,16,24].map(start=>({start}))}}};
 const sequence={start:0,end:32,role:'flow',energy:.8,sharedPassage:{motif:'catalog-riff',sequence:'wave',composition:'parallel-lines'},entrances:times.map(time=>({time,strength:.9}))};
 const scenes=planFormationScenes([sequence],input);assert.ok(scenes.some(s=>s.formationId.startsWith('geometry-')));
 for(const time of [3,9,17,25,9]){
  const state=formationSceneStateAt(sequence,time),figure={presentation:'strobe',flicker:53,music:{sequence:{...sequence,...state,time}}},wire=JSON.parse(JSON.stringify(figure));
  for(const row of [0,1,2])for(const rank of [0,3,7,12,15])assert.deepEqual(strobeChoreography(figure,rank,16,row,3),strobeChoreography(wire,rank,16,row,3));
 }
 const expanded=scenes.find(s=>s.formationId.startsWith('geometry-')).formationStory;
 assert.deepEqual(formationStoryPose(expanded,9,3,16,1,3,true),formationStoryPose(expanded,14,3,16,1,3,true));
});
