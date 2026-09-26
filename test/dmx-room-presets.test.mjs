import test from 'node:test';
import assert from 'node:assert/strict';
import {largeClubRoom,clubStageRoom} from '../public/dmx-room-presets.js';
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
