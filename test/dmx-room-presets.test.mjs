import {beamSurfacePatches,roomBeamHit} from '../public/dmx-light-geometry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeFestivalLighting,festivalStageRoom,villageBarnRoom,largeHallRoomWithDJQuietZone,largeClubRoom,clubStageRoom,clubStageRoomWithoutQuietZones} from '../public/dmx-room-presets.js';
import {createRoomPreview,applyRoomPlan,validateRoomPlan} from '../public/dmx-ar-model.js';

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


test('festival stage is open-air with a fantasy facade and 160 lights',()=>{
 const plan=festivalStageRoom();
 assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(plan.name,'Festival-Bühne');assert.equal(plan.width,40);assert.equal(plan.depth,56);
 assert.ok(Buffer.byteLength(JSON.stringify(plan))<256000);
 const positions=Object.values(plan.positions);
 assert.deepEqual(positions.reduce((c,p)=>(c[p.type]=(c[p.type]||0)+1,c),{}),{moving:80,spot:56,bar:24});
 for(const tri of plan.mesh.triangles){
   const p=tri.map(i=>plan.mesh.vertices[i]);
   assert.ok(!p.every(v=>v[2]>3&&Math.abs(v[0])<7&&v[1]>40&&v[1]<54),'no roof above the central stage');
   assert.ok(!p.every(v=>v[2]>3&&v[1]<37),'no roof above the audience');
 }
 assert.ok(plan.mesh.vertices.some(p=>p[2]>11));
 assert.notEqual(plan.id,festivalStageRoom().id);
});


test('festival lighting uses distinct facade and beam layers, with real elevated wash targets',()=>{
 const plan=festivalStageRoom(),positions=Object.values(plan.positions);
 for(const label of ['Bühnenkante','Innenturm','Außenturm','Kulissenfächer','Sonnenring','Fassadenlicht','Konturlicht','Flügel-Wash','Zentrale Fassade','Publikum'])assert.ok(positions.some(p=>p.name.includes(label)),label);
 const raised=Object.entries(plan.positions).filter(([,p])=>p.target?.z>0);
 assert.equal(raised.length,52);
 const scene={layout:{width:8,depth:6,positions:{}},crowd:[],motion:0,lights:['moving','spot','bar'].map(type=>({id:type,type,position:{x:0,y:2,height:3},target:{x:1,y:3},power:.8,color:'#ffffff'}))};
 const result=createRoomPreview()(scene,plan,false,0);
 for(const [id,p] of raised){const light=result.lights.find(l=>l.id===id);assert.equal(light.target.z,p.target.z,p.name);assert.ok(light.power>0,p.name);}
 const invalid=structuredClone(plan);invalid.positions[raised[0][0]].target.z=13;assert.throws(()=>validateRoomPlan(invalid));
});

test('original festival rig upgrades in place without resetting custom rooms',()=>{
 const original=festivalStageRoom({legacyLighting:true});original.name='Mein Festival';
 const updated=upgradeFestivalLighting(original);
 assert.equal(updated.id,original.id);assert.equal(updated.name,original.name);
 assert.deepEqual(updated.mesh,original.mesh);assert.deepEqual(updated.zones,original.zones);
 assert.equal(Object.keys(updated.positions).length,160);
 assert.equal(upgradeFestivalLighting(updated),updated);
 original.positions['festival-2'].height=7;
 assert.equal(upgradeFestivalLighting(original),original);
});


test('festival sky and site edges receive no imaginary ceiling or wall projections',()=>{
 const plan=festivalStageRoom(),layout={width:40,depth:56,height:12,roomPlan:plan};
 assert.equal(validateRoomPlan(plan).outdoor,true);
 assert.equal(roomBeamHit(layout,[0,40,2],[0,0,1]),null);
 assert.equal(roomBeamHit(layout,[0,40,2],[1,0,0]),null);
 const light={id:'uplight',type:'spot',position:{x:0,y:50,height:1},target:{x:0,y:55,z:9},modelSize:{height:.3},power:1};
 assert.deepEqual(beamSurfacePatches(light,layout,[[[-20,0],[20,0],[20,56]],[[-20,0],[20,56],[-20,56]]]),[]);
});


test('saved festival rooms acquire outdoor mode even with current or edited rigs',()=>{
 for(const legacyLighting of [false,true]){
  const saved=festivalStageRoom({legacyLighting});delete saved.outdoor;saved.name='Eigene Festival-Kopie';
  const id=Object.keys(saved.positions)[0];saved.positions[id].height=.75;
  const before=JSON.stringify(saved),updated=upgradeFestivalLighting(saved);
  assert.equal(updated.outdoor,true);
  assert.equal(JSON.stringify(saved),before,'migration does not mutate the input');
  assert.deepEqual(updated,validateRoomPlan({...saved,outdoor:true}),'all custom room data remains unchanged');
  assert.equal(upgradeFestivalLighting(updated),updated,'migration runs only once');
  assert.equal(roomBeamHit({width:updated.width,depth:updated.depth,height:updated.height,roomPlan:updated},[0,40,2],[0,0,1]),null);
 }
 const indoor=clubStageRoom();assert.equal(upgradeFestivalLighting(indoor),indoor);
});
