import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedFormationRoom,strobeStageRoom,formationArenaRoom} from '../public/dmx-room-presets.js';
import {validateRoomPlan,applyRoomPlan} from '../public/dmx-ar-model.js';
import {strobeScoreAt} from '../public/dmx-strobe-score.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';

test('combined stage includes all stage rows, arena banks and LED bars in a portable independent room',()=>{
 const plan=combinedFormationRoom(),stage=strobeStageRoom(),arena=formationArenaRoom();
 assert.notEqual(plan.id,stage.id);assert.notEqual(plan.id,combinedFormationRoom().id);
 assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(Object.values(plan.positions).filter(p=>p.type==='moving').length,144);
 assert.equal(Object.values(plan.positions).filter(p=>p.type==='bar').length,8);
 for(const [id,p] of Object.entries(stage.positions))assert.deepEqual(plan.positions['combined-'+id],p);
 for(const [id,p] of Object.entries(arena.positions)){
  const actual=plan.positions['combined-'+id];assert.deepEqual({...actual,y:p.y},p);
 }
 assert.ok(JSON.stringify(plan).length<256000);assert.ok(plan.mesh.triangles.length<5000);
 for(const triangle of plan.mesh.triangles)for(const index of triangle)assert.ok(index>=0&&index<plan.mesh.vertices.length);
 assert.equal(plan.mesh.triangles.length,plan.mesh.colors.length);
});
test('combined fixtures remain mirrored and have separate mounting space',()=>{
 const heads=Object.values(combinedFormationRoom().positions).filter(p=>p.type==='moving');
 for(const p of heads){
  assert.ok(heads.some(q=>Math.abs(q.x+p.x)<1e-8&&q.y===p.y&&q.height===p.height));
  for(const q of heads)if(p!==q)assert.ok(Math.abs(p.x-q.x)>=(p.size.width+q.size.width)/2-.001||
   Math.abs(p.y-q.y)>=(p.size.depth+q.size.depth)/2-.001||Math.abs(p.height-q.height)>=(p.size.height+q.size.height)/2-.001,'fixture bodies must not overlap');
 }
});
test('both halves of the combined rig follow the live formation score without editing the stored room',()=>{
 const plan=combinedFormationRoom(),saved=JSON.stringify(plan),music=varietySong(),seen=new Set();
 for(const time of [1,5,12,20,28,36,44,52,60]){
  const figure=strobeScoreAt(music,time),source={layout:{width:8,depth:6,positions:{}},lights:[{
   id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
   motionPresentation:'strobe',power:1,color:'#fff',movingShutter:1,movingPresenceBasePower:1,
   movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure}}]};
  const scene=applyRoomPlan(source,plan),heads=scene.lights.filter(l=>l.type==='moving');
  assert.equal(heads.length,144);
  for(const l of heads){assert.ok([l.target.x,l.target.y,l.target.z??0].every(Number.isFinite));if(l.power>.1)seen.add(l.id);}
 }
 assert.ok([...seen].some(id=>id.startsWith('combined-strobe-head-')));
 assert.ok([...seen].some(id=>id.startsWith('combined-formation-arena-')));
 assert.equal(JSON.stringify(plan),saved);
});
