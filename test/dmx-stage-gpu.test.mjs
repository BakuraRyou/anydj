import test from 'node:test';
import assert from 'node:assert/strict';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';
import {stageCamera} from '../public/dmx-stage-3d-renderer.js';
const layout={width:8,depth:6,height:3,room:true,positions:{},environmentBrightness:35};
const lights=Array.from({length:20},(_,i)=>({id:`head-${i}`,type:'moving',power:.8,color:'#20eecc',position:{x:-3.5+i*7/19,y:5,height:2.5},target:{x:Math.sin(i)*3,y:1,z:i%3}}));
const dot=(v,c,start)=>v.reduce((n,x,i)=>n+x*c[start+i],0);
test('GPU camera uniforms reproduce Canvas projection for orbit, dolly and ego views',()=>{
  const scene=createStageGpuScene();
  for(const camera of [{yaw:.32,pitch:.55,zoom:1},{yaw:-.7,pitch:-.1,zoom:2,eye:[2,-2,1.7]},{mode:'dancer',x:1,y:.4,eyeHeight:1.7,yaw:.2,pitch:.1,zoom:1}]){
    const frame=scene.build(1280,720,layout,[],camera),project=stageCamera(layout,camera,1280,720),c=frame.camera;
    for(const p of [[0,3,0],[2,5,2.5],[-3,4,1]]){
      const v=p.map((x,i)=>x-c[i]),z=dot(v,c,12),x=(dot(v,c,4)*c[7]/z+1)*640,y=(1-dot(v,c,8)*c[11]/z)*360;
      assert.ok(Math.abs(x-project(p).x)<.001);assert.ok(Math.abs(y-project(p).y)<.001);
    }
  }
});
test('20 fixtures produce finite contiguous GPU batches and reuse storage',()=>{
  const scene=createStageGpuScene(),camera={yaw:.32,pitch:.55,zoom:1};
  const frame=scene.build(1280,720,layout,lights,camera),buffer=frame.vertices.buffer;
  assert.ok(frame.vertices.every(Number.isFinite));let first=0;
  for(const batch of frame.batches){assert.equal(batch.first,first);assert.equal(batch.count%(batch.mode==='lines'?2:3),0);first+=batch.count;}
  assert.equal(first*11,frame.vertices.length);
  assert.ok(frame.batches.some(b=>b.mode==='add'));
  const dark=scene.build(1280,720,layout,lights.map(l=>({...l,power:0})),camera);
  assert.equal(dark.vertices.buffer,buffer);assert.ok(!dark.batches.some(b=>b.mode==='add'));
});
test('GPU stream remains finite when the camera crosses the fixtures and near plane',()=>{
  const scene=createStageGpuScene();
  for(const y of [4.9,5,5.1]){
    const frame=scene.build(800,600,layout,lights,{mode:'dancer',x:0,y,eyeHeight:2.5,yaw:0,pitch:0,zoom:1});
    assert.ok(frame.vertices.every(Number.isFinite));assert.ok(frame.camera.every(Number.isFinite));
  }
});
