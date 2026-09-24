import test from 'node:test';
import assert from 'node:assert/strict';
import {clipNear,stageCamera,stickFigureSegments,createCrowdMotion} from '../public/dmx-stage-3d-renderer.js';
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

test('dancing guests stay inside both floors after resizing, including steps and hops',()=>{
  for(const room of [false,true])for(const width of [2,8,60])for(const depth of [2,6,60]){
    const floor={width,depth,room};
    for(const x of [0,.5,1])for(const y of [0,.5,1])for(const time of [0,.25,.7,16,16.25,32.7,48.25,64]){
      const segments=stickFigureSegments(floor,{x,y},time,3);
      for(const point of segments.flat()){
        assert.ok(point.every(Number.isFinite));
        assert.ok(Math.abs(point[0])<=width/2);
        assert.ok(point[1]>= (room?0:-Math.max(4,depth)) && point[1]<=(room?depth:0));
        assert.ok(point[2]>=0 && point[2]<2);
      }
      for(const foot of [segments[2][1],segments[6][1]])assert.ok(foot[2]>=0&&foot[2]<.25);
    }
  }
  assert.notDeepEqual(stickFigureSegments(layout,{x:.5,y:.5},0),stickFigureSegments(layout,{x:.5,y:.5},.25));
});

const music=(beat,extra={})=>({streams:[{source:'A',playing:true,weight:1,beat,...extra}]});
test('crowd follows interpolated audio beats, tempo changes and numeric demo beats',()=>{
  const clock=createCrowdMotion();
  assert.equal(clock(music({index:4,phase:.25}),0).beat,4.25);
  assert.equal(clock(music({index:4,phase:.45}),.1).beat,4.45);
  assert.equal(clock(music({index:4,phase:.75}),.2).beat,4.75);
  assert.equal(clock(music(5),.3).beat,5);
});
test('pause and muted decks freeze the complete pose; no grid uses idle fallback',()=>{
  const clock=createCrowdMotion();clock(music(8),0);
  const playing=clock(music(8.2),.1);
  assert.deepEqual(clock(music(8.2,{playing:false}),5),playing);
  assert.deepEqual(clock(music(8.2,{weight:0}),6),playing);
  assert.equal(clock(music(8.4),6.1).beat,8.4);
  const fallback=createCrowdMotion();fallback(music(null),0);
  assert.ok(fallback(music(null),.1).beat>0);
  const empty=createCrowdMotion();empty({},0);assert.ok(empty({},.1).beat>0);
});
test('deck handoff has hysteresis and seeks crossfade poses before locking to the new beat',()=>{
  const clock=createCrowdMotion();clock(music(4),0);
  const mixed=(a,b,beatA,beatB)=>({streams:[{source:'A',playing:true,weight:a,beat:beatA},{source:'B',playing:true,weight:b,beat:beatB}]});
  assert.equal(clock(mixed(.49,.51,4.2,20),.1).beat,4.2);
  const changed=clock(mixed(.3,.7,4.4,20.2),.2);
  assert.equal(changed.beat,20.2);assert.ok(changed.from);assert.ok(changed.blend<1);
  for(let i=3;i<=7;i++)clock(mixed(.3,.7,4+i*.2,20+i*.2),i*.1);
  const seek=clock(mixed(.3,.7,6,2),.8);assert.ok(seek.from);assert.equal(seek.beat,2);
  for(let i=9;i<=14;i++)clock(mixed(.3,.7,6,2+(i-8)*.2),i*.1);
  assert.equal(clock(mixed(.3,.7,6,3.4),1.5).from,null);
});
test('style boundaries and deck blends are continuous and share the same beat phase',()=>{
  const person={x:.5,y:.5};
  const difference=(a,b)=>Math.max(...a.flat(2).map((n,i)=>Math.abs(n-b.flat(2)[i])));
  for(let index=0;index<4;index++){
    const before=stickFigureSegments(layout,person,{beat:16-1e-6,energy:.7},index);
    const after=stickFigureSegments(layout,person,{beat:16+1e-6,energy:.7},index);
    assert.ok(difference(before,after)<.0001);
    const previous={beat:6.4,energy:.7};
    assert.deepEqual(stickFigureSegments(layout,person,{beat:40,energy:1,from:previous,blend:0},index),stickFigureSegments(layout,person,previous,index));
    assert.deepEqual(stickFigureSegments(layout,person,{beat:40,energy:1,from:previous,blend:1},index),stickFigureSegments(layout,person,{beat:40,energy:1},index));
    const onBeat=stickFigureSegments(layout,person,{beat:4,energy:.7},index);
    const offBeat=stickFigureSegments(layout,person,{beat:4.5,energy:.7},index);
    assert.ok(onBeat[0][0][2]>offBeat[0][0][2],'all hips dip together between beats');
  }
  const styles=[0,1,2,3].map(index=>stickFigureSegments(layout,person,{beat:4.25,energy:.7},index));
  for(let i=1;i<styles.length;i++)assert.notDeepEqual(styles[0],styles[i]);
});
