import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoomPlan,validateRoomPlan,insideRoom,roomPlanLayout} from '../public/dmx-ar-model.js';
import {roomSettings,roomLayout} from '../public/dmx-room.js';
import {drawStageGeometry,stageCamera} from '../public/dmx-stage-3d-renderer.js';
import {roomStyles} from '../public/dmx-room-style.js';

const wallArea=faces=>faces.reduce((sum,p)=>sum+Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])*(p[3][2]-p[0][2]),0);

test('styles survive room validation and serialization, with legacy fallback',()=>{
  for(const style of Object.keys(roomStyles)){
    const plan=validateRoomPlan({...newRoomPlan(),style});
    assert.equal(validateRoomPlan(JSON.parse(JSON.stringify(plan))).style,style);
    assert.equal(roomPlanLayout(plan).roomPlan.style,style);
    assert.equal(roomLayout(roomSettings({style})).style,style);
  }
  for(const style of [undefined,'missing','__proto__'])assert.equal(validateRoomPlan({...newRoomPlan(),style}).style,'club');
});
test('materials cover concave floors without filling recesses, AR emits no materials',()=>{
  const plan=newRoomPlan();plan.boundary=[[-4,0],[4,0],[4,3],[0,3],[0,6],[-4,6]];
  for(const style of Object.keys(roomStyles))for(const ar of [false,true]){
    plan.style=style;plan.environmentBrightness=100;const floors=[],walls=[];
    drawStageGeometry({...roomPlanLayout(plan),ar},[],[],0,{polygon(points,fill){
      assert.ok(points.flat().every(Number.isFinite));
      if(fill===roomStyles[style].tile)floors.push(points);
      if(fill===roomStyles[style].wall)walls.push(points);
    }});
    const perimeter=plan.boundary.reduce((n,p,i)=>{const q=plan.boundary[(i+1)%plan.boundary.length];return n+Math.hypot(q[0]-p[0],q[1]-p[1]);},0);assert.ok(Math.abs(wallArea(walls)-(ar?0:perimeter*(plan.height-.15)))<1e-8);assert.equal(floors.length>0,!ar);
    for(const face of floors)for(const p of face)assert.ok(insideRoom(p,plan.boundary));
  }
});
test('material covers unlit club floor and cutaway removes near-facing exterior walls',()=>{
  const layout=roomLayout(roomSettings({enabled:true,depth:12,reach:2,environmentBrightness:100}));
  const project=stageCamera(layout,{mode:'orbit',yaw:0,pitch:.3,zoom:1},800,600),floors=[],walls=[];
  drawStageGeometry(layout,[],[],0,{wallVisible:(a,b,w)=>w*((b[0]-a[0])*(project.eye[1]-a[1])-(b[1]-a[1])*(project.eye[0]-a[0]))>=0,polygon(points,fill){
    if(fill===roomStyles.club.tile)floors.push(points);
    if(fill===roomStyles.club.wall)walls.push(points);
  }});
  assert.ok(floors.some(face=>face.some(p=>p[1]<layout.lightMin)));
  assert.ok(Math.abs(wallArea(walls)-(layout.width+2*layout.depth)*(layout.height-.15))<1e-8);
  assert.ok(walls.every(face=>!face.every(p=>p[1]===0)));
});
