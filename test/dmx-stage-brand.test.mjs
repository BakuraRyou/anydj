import test from 'node:test';
import assert from 'node:assert/strict';
import {stageBrandRects} from '../public/dmx-stage-brand-data.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
import {drawStageBrand} from '../public/dmx-stage-brand.js';
import {largeClubRoom,clubStageRoom,clubStageRoomWithoutQuietZones,largeHallRoomWithDJQuietZone} from '../public/dmx-room-presets.js';
import {roomPlanLayout} from '../public/dmx-ar-model.js';

test('all existing room variants receive a readable sign within their back wall without data changes',()=>{
  for(const make of [largeClubRoom,clubStageRoom,clubStageRoomWithoutQuietZones,largeHallRoomWithDJQuietZone]){
    const plan=make(),original=JSON.stringify(plan),faces=[];
    drawStageBrand(roomPlanLayout(plan),{polygon:(points,color)=>faces.push({points,color}),eye:[0,0,2]});
    assert.equal(faces.length,stageBrandRects.length);
    assert.ok(faces.length>0);
    assert.ok(!faces.some(face=>face.color==='#101923')); 
    for(const face of faces)for(const [x,y,z] of face.points){
      assert.ok(Math.abs(x)<plan.width/2);assert.ok(y<plan.depth&&y>plan.depth-2.1);assert.ok(z>0&&z<=plan.height*.68);
    }
    assert.ok(faces[0].points[0][0]<faces[0].points[1][0],'wordmark reads left to right');
    assert.equal(JSON.stringify(plan),original);
    const hidden=[];
    for(const options of [{eye:[0,plan.depth+1,2]},{wallVisible:()=>false}])drawStageBrand(roomPlanLayout(plan),{polygon:p=>hidden.push(p),...options});
    drawStageBrand({...roomPlanLayout(plan),ar:true},{polygon:p=>hidden.push(p)});
    assert.equal(hidden.length,0);
  }
});

test('standard stages and reversed room boundaries share the same inward facing logo',()=>{
  const layout={width:8,depth:6,height:3},normal=[],reversed=[];
  drawStageBrand(layout,{polygon:p=>normal.push(p)});
  drawStageBrand({...layout,roomPlan:{boundary:[[-4,0],[-4,6],[4,6],[4,0]]}},{polygon:p=>reversed.push(p)});
  assert.deepEqual(reversed,normal);
});


test('lowered A sits in front of the stage backdrop panels',()=>{
  const plan=clubStageRoom(),faces=[];
  drawStageBrand(roomPlanLayout(plan),{polygon:p=>faces.push(p)});
  assert.ok(faces.flat().every(p=>p[1]<48.5&&p[1]>48.4));
});


test('background A follows room lighting and has no self illumination',()=>{
  const plan=clubStageRoom();
  for(const brightness of [0,18]){
    plan.environmentBrightness=brightness;
    const colors=[];
    drawStageGeometry(roomPlanLayout(plan),[],[],0,{polygon:(points,color)=>{
      if(points.length===4&&points.every(p=>Math.abs(p[1]-48.45)<1e-6))colors.push(color);
    }});
    assert.equal(colors.length,stageBrandRects.length);
    assert.ok(colors.every(c=>[1,3,5].every(i=>parseInt(c.slice(i,i+2),16)<=Math.ceil(255*brightness/100))));
    if(brightness>0)assert.ok(colors.some(c=>c!=='#000000'));
  }
});


test('A stays subdued in a dim club while remaining responsive to ambient light',()=>{
  const plan=clubStageRoom(),peaks=[];
  for(const brightness of [0,5,18,100]){
    plan.environmentBrightness=brightness;
    const colors=[];
    drawStageGeometry(roomPlanLayout(plan),[],[],0,{polygon:(points,color)=>{
      if(points.length===4&&points.every(p=>Math.abs(p[1]-48.45)<1e-6))colors.push(color);
    }});
    peaks.push(Math.max(...colors.flatMap(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)))));
  }
  assert.equal(peaks[0],0);
  assert.ok(peaks[1]<=4,'almost dark room: the sign must not stand out as a lamp');
  assert.ok(peaks[2]<=14,'default club brightness: subdued background material');
  assert.ok(peaks[3]>peaks[2]&&peaks[3]<80,'daylight reveals matte paint instead of display white');
});
