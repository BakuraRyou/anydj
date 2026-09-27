import test from 'node:test';
import assert from 'node:assert/strict';
import {villageBarnRoom,largeHallRoomWithDJQuietZone,largeClubRoom,clubStageRoom,clubStageRoomWithoutQuietZones} from '../public/dmx-room-presets.js';
import {applyRoomPlan,validateRoomPlan} from '../public/dmx-ar-model.js';

test('large club is a portable, independent room with 192 supported lights',()=>{
  const plan=largeClubRoom(),second=largeClubRoom();
  assert.notEqual(plan.id,second.id);
  assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
  assert.ok(Buffer.byteLength(JSON.stringify(plan))<256000);
  const counts=Object.values(plan.positions).reduce((out,p)=>(out[p.type]=(out[p.type]||0)+1,out),{});
  assert.deepEqual(counts,{truss:24,moving:72,spot:72,bar:48});
  assert.equal(plan.zones.length,4);
  for(const p of Object.values(plan.positions)){
    if(p.type==='truss')continue;
    const x=p.target.x/plan.width+.5,y=p.target.y/plan.depth;
    assert.ok(!plan.zones.some(z=>x>=z.x&&x<=z.x+z.width&&y>=z.y&&y<=z.y+z.depth),p.name);
    assert.ok(Object.values(plan.positions).some(q=>q.type===p.type&&q.x===-p.x&&q.y===p.y),`mirrored: ${p.name}`);
  }
  plan.positions['club-1'].x=0;
  assert.equal(second.positions['club-1'].x,-9);
});

test('all club lights receive live show frames without changing the source scene',()=>{
  const scene={layout:{width:8,depth:6,positions:{}},crowd:[],motion:0,lights:['moving','spot','bar'].map(type=>({id:type,type,position:{x:0,y:2,height:3},target:{x:1,y:3},power:.8,color:'#ffffff'}))};
  const original=structuredClone(scene),result=applyRoomPlan(scene,largeClubRoom());
  assert.equal(result.lights.filter(l=>l.power>0).length,192);
  assert.equal(new Set(result.lights.filter(l=>l.power>0).map(l=>l.id)).size,192);
  assert.deepEqual(scene,original);
});


test('club stage keeps its geometry and all three lighting sections when exported',()=>{
  const plan=clubStageRoom();
  assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
  assert.equal(plan.representation,'model');
  assert.ok(plan.mesh.triangles.length>250&&plan.mesh.triangles.length<5000);
  assert.ok(Buffer.byteLength(JSON.stringify(plan))<256000);
  const positions=Object.values(plan.positions);
  assert.equal(positions.filter(p=>p.type!=='truss').length,144);
  for(const section of ['Bühne','Publikum','Hintergrund'])assert.ok(positions.some(p=>p.name.startsWith(section)));
  const stage=plan.mesh.vertices.filter(p=>p[2]===.8);
  assert.ok(stage.some(p=>p[0]===-12&&p[1]===36));
  assert.ok(stage.some(p=>p[0]===12&&p[1]===46));
  for(const p of positions.filter(p=>p.type==='moving')){
    assert.ok(p.motionArea.y*plan.depth>=8);
    assert.ok((p.motionArea.y+p.motionArea.depth)*plan.depth<=32.00001);
  }
  assert.notEqual(plan.id,clubStageRoom().id);
});


test('additional stage room has no quiet zones and preserves the full stage setup',()=>{
  const original=clubStageRoom(),plan=clubStageRoomWithoutQuietZones();
  assert.notEqual(plan.id,original.id);
  assert.equal(plan.name,'Club-Bühne · ohne Ruhezonen');
  assert.deepEqual(plan.zones,[]);
  assert.equal(original.zones.length,3);
  assert.deepEqual(plan.positions,original.positions);
  assert.deepEqual(plan.mesh,original.mesh);
  assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
});


test('large hall preserves 192 lights and protects only the central DJ booth',()=>{
  const original=largeClubRoom(),plan=largeHallRoomWithDJQuietZone();
  assert.notEqual(plan.id,original.id);
  assert.deepEqual(plan.positions,original.positions);
  assert.equal(Object.values(plan.positions).filter(p=>p.type!=='truss').length,192);
  assert.equal(original.zones.length,4);
  assert.equal(plan.zones.length,1);
  const zone=plan.zones[0];
  assert.equal(zone.name,'DJ-Pult');
  assert.ok(Math.abs((zone.x-.5)*plan.width+3)<1e-9);
  assert.equal(zone.width*plan.width,6);
  assert.equal(zone.depth*plan.depth,3);
  assert.equal(zone.y,0);
  assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
});


test('village barn has a pitched roof, right platform and eight lights aimed at the left dance floor',()=>{
 const plan=villageBarnRoom();
 assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(plan.height,5);assert.equal(plan.width,10);assert.equal(plan.depth,14);
 assert.ok(Buffer.byteLength(JSON.stringify(plan))<256000);
 assert.ok(plan.mesh.vertices.some(([x,y,z])=>x===0&&z===5));
 assert.ok(plan.mesh.vertices.some(([x,y,z])=>x===5&&z===3.2));
 assert.ok(plan.mesh.vertices.some(([x,y,z])=>x===1.5&&y===6&&z===.45));
 assert.ok(plan.mesh.vertices.some(([x,y,z])=>x===5&&y===10&&z===.45));
 const positions=Object.values(plan.positions);
 assert.deepEqual(positions.reduce((c,p)=>(c[p.type]=(c[p.type]||0)+1,c),{}),{moving:2,spot:4,bar:2});
 for(const p of positions){
  assert.ok(p.target.x<0);
  assert.ok(p.height+p.size.height<5-Math.abs(p.x)*1.8/5);
  if(p.motionArea)assert.ok((p.motionArea.x+p.motionArea.width-.5)*plan.width<1.5,'moving range excludes side platform');
 }
 assert.notEqual(plan.id,villageBarnRoom().id);
});
