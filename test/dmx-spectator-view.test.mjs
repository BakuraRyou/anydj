import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSpectatorView,choreographyArenaRoom,largeClubRoom,largeHallRoomWithDJQuietZone,clubStageRoom,clubStageRoomWithoutQuietZones,villageBarnRoom,festivalStageRoom,strobeStageRoom,formationArenaRoom,combinedFormationRoom} from '../public/dmx-room-presets.js';
import {roomPlanLayout,insideRoom,newRoomPlan} from '../public/dmx-ar-model.js';
import {stageCamera} from '../public/dmx-stage-3d-renderer.js';

const stages=[
 [largeClubRoom,[0,21],[0,2]],
 [largeHallRoomWithDJQuietZone,[0,21],[0,2]],
 [clubStageRoom,[0,20],[0,42]],
 [clubStageRoomWithoutQuietZones,[0,20],[0,42]],
 [villageBarnRoom,[-2.5,7],[3.5,8]],
 [festivalStageRoom,[0,22],[0,48]],
 [strobeStageRoom,[0,10],[0,30]],
 [formationArenaRoom,[0,5.5],[0,24]],
 [combinedFormationRoom,[0,2.5],[0,30]],
 [choreographyArenaRoom,[0,7],[0,36]]
];
for(const [create,point,stage]of stages)test(`${create.name}: central spectator is on the audience floor and faces the stage`,()=>{
 const plan=create(),original=JSON.stringify(plan),layout=roomPlanLayout(plan),view=roomSpectatorView(layout);
 assert.deepEqual([view.x,view.y],point);
 assert.equal(view.eyeHeight,1.7);assert.equal(view.zoom,1);
 assert.ok(insideRoom(point,plan.boundary));
 assert.ok(!plan.zones.some(z=>view.x>=(z.x-.5)*plan.width&&view.x<=(z.x+z.width-.5)*plan.width&&view.y>=z.y*plan.depth&&view.y<=(z.y+z.depth)*plan.depth));
 const projected=stageCamera(layout,view,1200,700)([...stage,1.7]);
 assert.ok(projected.depth>1);assert.ok(Math.abs(projected.x-600)<80,'stage centre is directly ahead');
 assert.equal(JSON.stringify(plan),original,'fitting never rewrites room, lighting or exclusion zones');
});
test('renaming or duplicating a map keeps its intended audience view',()=>{
 const plan=villageBarnRoom(),expected=roomSpectatorView(roomPlanLayout(plan));
 const copy={...plan,id:'renamed-copy',name:'Meine Party'};
 assert.deepEqual(roomSpectatorView(roomPlanLayout(copy)),expected);
});
test('the combined-stage spectator can see both complete forward beam banks',()=>{
 const plan=combinedFormationRoom(),layout=roomPlanLayout(plan),view=roomSpectatorView(layout),project=stageCamera(layout,view,1200,700);
 const banks=Object.entries(plan.positions).filter(([id])=>id.startsWith('combined-formation-arena-0-'));
 assert.equal(banks.length,32);
 for(const [,p]of banks){const point=project([p.x,p.y,p.height]);
  assert.ok(point.depth>0&&point.x>15&&point.x<1185,'front banks must fit inside the field of view');
 }
});
test('fitting an edited map avoids excluded audience areas without changing the plan',()=>{
 const plan=festivalStageRoom();plan.zones.push({id:'audience-closed',name:'Gesperrt',x:.4,y:20/56,width:.2,depth:4/56});
 const original=JSON.stringify(plan),view=roomSpectatorView(roomPlanLayout(plan));
 assert.ok(view.x< -4||view.x>4||view.y<20||view.y>24);
 assert.ok(insideRoom([view.x,view.y],plan.boundary));assert.equal(JSON.stringify(plan),original);
});
test('imported concave maps get an interior fallback rather than a position outside their floor',()=>{
 const plan=newRoomPlan(10,10,3);
 plan.boundary=[[-5,0],[5,0],[5,3],[-2,3],[-2,10],[-5,10]];
 const view=roomSpectatorView(roomPlanLayout(plan));
 assert.ok(insideRoom([view.x,view.y],plan.boundary));
});
test('plain rooms use their centre and the legacy stage retains its audience coordinates',()=>{
 assert.equal(roomSpectatorView({room:true,width:8,depth:12,positions:{}}).y,6);
 assert.equal(roomSpectatorView({width:8,depth:6,positions:{}}).y,-3);
});
