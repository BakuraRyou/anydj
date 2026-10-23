import test from 'node:test';
import assert from 'node:assert/strict';
import {galaArenaRoom,roomSpectatorView} from '../public/dmx-room-presets.js';
import {validateRoomPlan,roomPlanLayout,applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
import {stageCamera} from '../public/dmx-stage-3d-renderer.js';

test('gala arena exports independently within room and model limits',()=>{
 const plan=galaArenaRoom(),other=galaArenaRoom();
 assert.notEqual(plan.id,other.id);
 assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.ok(Buffer.byteLength(JSON.stringify(plan))<256000);
 assert.ok(plan.mesh.triangles.length<=5000);
 assert.equal(plan.representation,'model');
 const devices=Object.values(plan.positions);
 assert.deepEqual(devices.reduce((c,p)=>(c[p.type]=(c[p.type]??0)+1,c),{}),{moving:144,bar:32,spot:16});
 const rings=Object.entries(plan.positions).filter(([id])=>id.startsWith('gala-ring-'));
 assert.equal(rings.length,104);
 assert.equal(new Set(rings.map(([id])=>id.split('-')[2])).size,7);
 for(const p of devices){
  assert.ok(p.height+p.size.height<plan.height);
  assert.ok(devices.some(q=>q.type===p.type&&Math.abs(q.x+p.x)<.002&&q.y===p.y&&q.height===p.height),p.name);
 }
 plan.positions['gala-ring-0-0'].height=5;
 assert.notEqual(other.positions['gala-ring-0-0'].height,5);
});

test('spectator sees every suspended ring and keeps that view after renaming',()=>{
 const plan=galaArenaRoom(),layout=roomPlanLayout(plan),view=roomSpectatorView(layout),project=stageCamera(layout,view,1200,700);
 assert.equal(view.y,4);assert.ok(view.pitch<0);
 for(const [id,p]of Object.entries(plan.positions).filter(([id])=>id.startsWith('gala-ring-'))){
  const point=project([p.x,p.y,p.height]);
  assert.ok(point.depth>0&&point.x>0&&point.x<1200&&point.y>0&&point.y<700,id);
 }
 plan.name='Meine Gala';assert.deepEqual(roomSpectatorView(roomPlanLayout(plan)),view);
});

test('gala devices receive live frames and preserve fixed targets without modifying source or plan',()=>{
 const plan=galaArenaRoom(),saved=JSON.stringify(plan);
 const scene={layout:{width:8,depth:6,positions:{}},crowd:[],lights:['moving','spot','bar'].map(type=>({id:type,type,position:{x:0,y:4,height:3},target:{x:0,y:2},power:.8,color:'#aabbff'}))};
 const before=structuredClone(scene);
 for(const result of [applyRoomPlan(scene,plan),createRoomPreview()(scene,plan,false,0)]){
  assert.equal(result.lights.length,192);
  assert.equal(new Set(result.lights.map(l=>l.id)).size,192);
  for(const l of result.lights){
   assert.ok(l.power>0,l.id);
   assert.ok([l.target.x,l.target.y,l.target.z??0].every(Number.isFinite));
   if(l.type!=='moving')assert.deepEqual(l.target,plan.positions[l.id].target);
  }
 }
 assert.deepEqual(scene,before);assert.equal(JSON.stringify(plan),saved);
});
