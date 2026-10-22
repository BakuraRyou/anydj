import test from 'node:test';
import assert from 'node:assert/strict';
import {choreographyArenaRoom,roomSpectatorView} from '../public/dmx-room-presets.js';
import {validateRoomPlan,roomPlanLayout,applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
import {automaticFixtureGroups} from '../public/dmx-group-motion.js';
import {formationRigRoles} from '../public/dmx-formation-rig.js';
import {stageCamera} from '../public/dmx-stage-3d-renderer.js';
import {strobeScoreAt} from '../public/dmx-strobe-score.js';
import {varietySong} from './fixtures/formation-variety-song.mjs';

test('the choreography arena exports an independent, mirrored rig with beam, wash, accent and LED optics',()=>{
 const room=choreographyArenaRoom(),other=choreographyArenaRoom();
 assert.notEqual(room.id,other.id);assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(room))),room);
 const counts=Object.values(room.positions).reduce((out,p)=>(out[p.type]=(out[p.type]??0)+1,out),{});
 assert.deepEqual(counts,{moving:90,spot:28,bar:36});assert.deepEqual(room.zones,[]);
 assert.ok(JSON.stringify(room).length<256000);assert.ok(room.mesh.triangles.length<3000);
 for(const p of Object.values(room.positions))assert.ok(Object.values(room.positions).some(q=>q.type===p.type&&Math.abs(p.x+q.x)<1e-8&&p.y===q.y&&p.height===q.height));
 assert.ok(new Set(Object.values(room.positions).map(p=>p.beamAngle)).size>=6);
 const heads=Object.values(room.positions).filter(p=>p.type==='moving');
 for(const p of heads)for(const q of heads)if(p!==q)assert.ok(Math.abs(p.x-q.x)>=(p.size.width+q.size.width)/2-.001||Math.abs(p.y-q.y)>=(p.size.depth+q.size.depth)/2-.001||Math.abs(p.height-q.height)>=(p.size.height+q.size.height)/2-.001);
});
test('broad rows and compact banks are discovered as separate three-layer installations',()=>{
 const room=choreographyArenaRoom(),groups=automaticFixtureGroups(Object.entries(room.positions).filter(([,p])=>p.type==='moving').map(([id,position])=>({id,position})));
 const roles=formationRigRoles(groups,room.positions);assert.equal(roles.size,90);
 for(const [id,role]of roles){assert.equal(role.family,id.startsWith('choreo-fan-')?'banks':'rows');assert.equal(role.groups,3);}
 const layout=roomPlanLayout(room),view=roomSpectatorView(layout),project=stageCamera(layout,view,1200,700);
 for(const [id,p]of Object.entries(room.positions).filter(([id])=>id.startsWith('choreo-fan-0-'))){
  const point=project([p.x,p.y,p.height]);assert.ok(point.depth>0&&point.x>40&&point.x<1160,id+' remains visible from the intended spectator');
 }
});
function source(plan,time){
 const figure={...strobeScoreAt(plan,time),flicker:53};
 return {layout:{width:8,depth:6,positions:{}},crowd:[],lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
  motionPresentation:'strobe',power:1,color:'#28c8ff',strobePalette:[[40,200,255],[255,90,35]],movingShutter:1,movingPresenceBasePower:1,
  movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion:figure}}]};
}
test('one live moving source drives all three light types while washes and LEDs retain their authored targets',()=>{
 const room=choreographyArenaRoom(),saved=JSON.stringify(room),plan=varietySong(),patterns={moving:new Set(),spot:new Set(),bar:new Set()};
 for(const time of [1,5,12,20,28,36,44,52,60]){
  const scene=source(plan,time),original=structuredClone(scene),result=applyRoomPlan(scene,room);
  assert.equal(result.lights.length,154);
  for(const type of Object.keys(patterns)){
   const lights=result.lights.filter(l=>l.type===type);assert.ok(lights.some(l=>l.power>.01),`${type} participates at ${time}`);
   patterns[type].add(JSON.stringify(lights.map(l=>[l.power,l.motionUV?.x,l.motionUV?.y])));
   for(const light of lights)if(type!=='moving')assert.deepEqual(light.target,room.positions[light.id].target,'fixed support stays on the stage/backdrop');
  }
  assert.deepEqual(scene,original);assert.equal(JSON.stringify(room),saved);
 }
 for(const [type,seen]of Object.entries(patterns))assert.ok(seen.size>=4,type+' responds to musical development');
});
test('real room rendering preserves the whole rig and keeps all surface targets finite',()=>{
 const room=choreographyArenaRoom(),preview=createRoomPreview(),plan=varietySong();
 for(let i=0;i<90;i++){
  const time=18+i/30,result=preview(source(plan,time),room,false,time);
  assert.equal(result.lights.length,154);
  for(const l of result.lights)assert.ok([l.target.x,l.target.y,l.target.z??0,l.power].every(Number.isFinite));
 }
});
