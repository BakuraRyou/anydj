import test from 'node:test';
import assert from 'node:assert/strict';
import {formationRigRoles,formationRigPresence,formationRigFixtureRole} from '../public/dmx-formation-rig.js';
import {combinedFormationRoom,strobeStageRoom,formationArenaRoom} from '../public/dmx-room-presets.js';
import {automaticFixtureGroups,groupComposition} from '../public/dmx-group-motion.js';
import {formationSpatialPose,FORMATION_NAMES,formationFor} from '../public/dmx-strobe-choreography.js';
import {developFormationPhrase} from '../public/dmx-formation-music.js';
import {strobeScoreAt} from '../public/dmx-strobe-score.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';
import {applyRoomPlan} from '../public/dmx-ar-model.js';
const rolesFor=plan=>formationRigRoles(automaticFixtureGroups(Object.entries(plan.positions).filter(([,p])=>p.type==='moving').map(([id,position])=>({id,position}))),plan.positions);

test('mixed installations discover compact banks and wide rows from geometry with independent physical layers',()=>{
 const plan=combinedFormationRoom(),roles=rolesFor(plan);
 assert.equal(roles.size,144);
 for(const [id,role] of roles){
  assert.equal(role.family,id.startsWith('combined-strobe-head-')?'rows':'banks');
  assert.equal(role.groups,3);assert.ok(role.row>=0&&role.row<3);
 }
 const renamed={...plan,positions:Object.fromEntries(Object.values(plan.positions).map((p,i)=>['renamed-'+i,p]))};
 assert.deepEqual([...rolesFor(renamed).values()],[...roles.values()]);
 assert.equal(rolesFor(strobeStageRoom()),null);assert.equal(rolesFor(formationArenaRoom()),null);
});
test('wide planes and focused fans alternate the lead while retaining sparse accompaniment',()=>{
 const base=strobeScoreAt(varietySong(),12);
 for(const [shape,leader] of [['open-fan','banks'],['parallel-lines','rows'],['portal-rows','banks'],['opposed-diagonals','rows']]){
  const story={...base.music.sequence.formationStory,shape},figure={...base,music:{...base.music,sequence:{...base.music.sequence,formationStory:story}}};
  for(const family of ['rows','banks']){
   const role=formationRigFixtureRole(family,story);assert.equal(role,family===leader?'lead':'frame');
   const presence=formationRigPresence({groupMotion:figure},{family,row:1,groups:3});
   const pictures=Array.from({length:16},(_,rank)=>groupComposition(presence.groupMotion,rank,16,5,6));
   assert.ok(pictures.every(p=>p.fixtureRole===role));
   if(role==='frame'){
    assert.ok(pictures.every(p=>p.beamFocus===0));
    assert.ok(pictures.filter(p=>p.level>.01).length<=4,'the background cannot duplicate the whole foreground picture');
   }
  }
 }
});
test('room target routing and dimmer membership use the same mixed-rig roles without changing saved placement',()=>{
 const plan=combinedFormationRoom(),saved=JSON.stringify(plan),figure=strobeScoreAt(varietySong(),12);
 figure.music.sequence.formationStory={...figure.music.sequence.formationStory,shape:'parallel-lines'};
 const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},
  motionUV:{x:.5,y:.5},motionPresentation:'strobe',power:1,color:'#fff',movingShutter:1,movingPresenceBasePower:1,
  movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure}}]},plan);
 const banks=scene.lights.filter(l=>l.movingPresence?.groupMotion?.rigFamily==='banks'&&l.type==='moving');
 assert.equal(banks.length,96);assert.ok(banks.filter(l=>l.power>.01).length<=12);
 assert.ok(banks.every(l=>l.motionUV.beamFocus===0));assert.equal(JSON.stringify(plan),saved);
});
test('eight added shapes have distinct bounded geometry and are reachable through musical phrase development',()=>{
 const added=['chevron-stack','hourglass','portal-rows','folded-roof','opposed-diagonals','rake','split-curtain','concentric-fans'];
 const traces=added.map(id=>{
  assert.ok(FORMATION_NAMES[id]);return JSON.stringify([.2,.7].flatMap(t=>[0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>{
   const p=formationSpatialPose(id,rank,16,row,3,t);assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);return [p.x,p.y,p.beamFocus];
  }))));
 });assert.equal(new Set(traces).size,added.length);
 const reachable=new Set();
 for(const motion of ['relay','dialogue','weave','suspend'])for(let phrase=0;phrase<24;phrase++)reachable.add(developFormationPhrase({motion,shape:'open-fan',evidence:{impulses:16,energy:.7}},phrase).shape);
 added.forEach(id=>assert.ok(reachable.has(id),id+' must reach playback selection'));
 assert.equal(formationFor({composition:'auto-sails-opposed'}),'rake');
 assert.equal(formationFor({composition:'rising-columns'}),'chevron-stack');
});

test('swapping the leading installation preserves geometry and light at the handover boundary',()=>{
 const old={start:0,end:8,arcStart:0,arcEnd:8,motion:'relay',act:'introduce',shape:'parallel-lines',energy:.7,
  knots:[{time:0,position:0},{time:8,position:1}],variation:{path:'traverse',gesture:'carry',spread:1}};
 const next={...old,start:8,end:16,arcStart:8,arcEnd:16,shape:'open-fan',knots:[{time:8,position:0},{time:16,position:1}]};
 const picture=(time,family)=>{
  const story=time<8?old:next;
  return {presentation:'strobe',rigFamily:family,rigRow:1,rigGroups:3,flicker:53,music:{sequence:{
   role:'groove',sharedPassage:{},time,age:time-story.start,formationId:story.shape,formationProgram:{kind:'sweep'},formationStory:story,
   ...(time>=8?{previous:{end:8,formationId:old.shape,formationProgram:{kind:'sweep'},formationStory:old}}:{})}}};
 };
 for(const family of ['rows','banks'])for(const rank of [0,2,8,15]){
  const a=groupComposition(picture(8-.00001,family),rank,16,1,3),b=groupComposition(picture(8+.00001,family),rank,16,1,3);
  for(const key of ['x','y','level','beamFocus'])assert.ok(Math.abs(a[key]-b[key])<.001,`${family}: ${key} jumped during role exchange ${a[key]} / ${b[key]}`);
 }
});
