import test from 'node:test';
import assert from 'node:assert/strict';
import {clipNear,stageCamera,stickFigureSegments} from '../public/dmx-stage-3d-renderer.js';
const layout={width:8,depth:6,positions:{}};
const camera={mode:'dancer',x:0,y:-3,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
test('eye-level camera looks toward the stage and changes with viewer position and height',()=>{
  const project=stageCamera(layout,camera,800,500);
  assert.deepEqual(project([0,0,1.7]),{x:400,y:250,depth:3});
  assert.ok(project([0,0,0]).y>250);
  assert.ok(project([0,0,3]).y<250);
  assert.ok(stageCamera(layout,{...camera,x:1},800,500)([0,0,1.7]).x<400);
  assert.ok(stageCamera(layout,{...camera,eyeHeight:1.2},800,500)([0,0,1.7]).y<250);
  assert.ok(stageCamera(layout,{...camera,yaw:Math.PI},800,500)([0,0,1.7]).depth<0);
});
test('near-plane clipping retains visible floor and beam portions crossing behind the viewer',()=>{
  const depth=p=>p[1],polygon=[[-1,-1,0],[1,-1,0],[1,2,0],[-1,2,0]];
  const clipped=clipNear(polygon,depth);
  assert.equal(clipped.length,4);
  assert.ok(clipped.every(p=>p[1]>=.08-1e-10));
  assert.deepEqual(clipNear([[-1,-2,0],[1,-1,0]],depth),[]);
  const line=clipNear([[0,-1,0],[0,2,3]],depth);
  assert.equal(line.length,2);assert.ok(Math.abs(line[0][1]-.08)<1e-10);assert.deepEqual(line[1],[0,2,3]);
});
test('clipped dance floor remains finite while turning and looking up or down',()=>{
  for(const yaw of [0,.5,Math.PI,4,6])for(const pitch of [-1.2,0,1.2]){
    const project=stageCamera(layout,{...camera,yaw,pitch},390,260);
    for(const p of clipNear([[-4,-6,0],[4,-6,0],[4,6,0],[-4,6,0]],project.depth)){
      const screen=project(p);assert.ok(Number.isFinite(screen.x)&&Number.isFinite(screen.y)&&screen.depth>.079);
    }
  }
});

test('dancing guests stay inside both floors after resizing and keep their feet grounded',()=>{
  for(const room of [false,true])for(const width of [2,8,60])for(const depth of [2,6,60]){
    const floor={width,depth,room};
    for(const x of [0,.5,1])for(const y of [0,.5,1])for(const time of [0,.25,.7]){
      const segments=stickFigureSegments(floor,{x,y},time,3);
      for(const point of segments.flat()){
        assert.ok(point.every(Number.isFinite));
        assert.ok(Math.abs(point[0])<=width/2);
        assert.ok(point[1]>= (room?0:-Math.max(4,depth)) && point[1]<=(room?depth:0));
        assert.ok(point[2]>=0 && point[2]<2);
      }
      assert.equal(segments.flat().filter(p=>p[2]===0).length,2);
    }
  }
  assert.notDeepEqual(stickFigureSegments(layout,{x:.5,y:.5},0),stickFigureSegments(layout,{x:.5,y:.5},.25));
});
