import test from 'node:test';
import assert from 'node:assert/strict';
import {previewLightExposure,previewLightSample,beamHaloScale,previewBeamResponse,previewLensVisibility} from '../public/dmx-stage-3d-renderer.js';
import {createStageGpuScene} from '../public/dmx-stage-gpu-scene.js';

test('preview exposure preserves blackout and continuous ordered dimming',()=>{
  assert.equal(previewLightExposure(0),0);
  assert.equal(previewLightExposure(1),1);
  assert.ok(previewLightExposure(.22)>.3,'dim beams remain visible in the preview');
  let previous=0;
  for(let i=1;i<=1000;i++){
    const value=previewLightExposure(i/1000);
    assert.ok(value>previous&&value<=1);previous=value;
  }
  assert.ok(previewLightExposure(.00001)<.0001,'no minimum brightness that defeats fades');
});

test('soft cone preserves colour and limits haze to a thin edge',()=>{
  const along=.5,physicalRadius=.035+.965*along;
  const core=previewLightSample('beam',0,along);
  const edge=previewLightSample('beam',physicalRadius*1.04/beamHaloScale,along);
  assert.ok(core.alpha>edge.alpha*100);
  assert.ok(edge.alpha>0&&edge.white===0);
  assert.equal(previewLightSample('beam',physicalRadius,along).alpha,0);
  for(const kind of ['beam','lens'])for(let y=0;y<=1;y+=.01)for(let x=-1;x<=1;x+=.05){
    const sample=previewLightSample(kind,x,y);
    assert.ok(sample.alpha>=0&&sample.alpha<=1&&sample.white>=0&&sample.white<=1);
    assert.deepEqual(sample,previewLightSample(kind,-x,y));
    if(kind==='beam')assert.equal(sample.white,0);
  }
  assert.equal(previewLightSample('beam',0,0).alpha,0);
  assert.equal(previewLightSample('beam',0,1).alpha,0);
});

test('haze favours forward scattering, weakens with distance and stays bounded on axis',()=>{
  const start=[0,0,2],end=[0,6,2];
  const forward=previewBeamResponse(start,end,[0,9,2],.27);
  const backward=previewBeamResponse(start,end,[0,-3,2],.27);
  assert.ok(forward>backward*2);
  assert.ok(previewBeamResponse(start,end,[8,3,2],.27)>previewBeamResponse(start,end,[24,3,2],.27));
  assert.ok(previewBeamResponse(start,end,[8,3,2],.27)>previewBeamResponse(start,end,[8,3,2],.8));
  for(const eye of [start,end,[0,3,2],[.00001,3,2]]){
    const value=previewBeamResponse(start,end,eye,.27);
    assert.ok(Number.isFinite(value)&&value>=0&&value<=1.8);
  }
  assert.equal(previewBeamResponse(start,start,end,.1),0);
});

test('lens glare disappears behind the head and changes continuously with the viewing angle',()=>{
  const center=[0,0,2],axis=[0,1,0];
  assert.equal(previewLensVisibility(center,axis,[0,-2,2]),0);
  assert.equal(previewLensVisibility(center,axis,[0,2,2]),1);
  let previous=0;
  for(let angle=0;angle<=Math.PI/2;angle+=.01){
    const value=previewLensVisibility(center,axis,[Math.cos(angle),Math.sin(angle),2]);
    assert.ok(value>=previous&&value-previous<.04);previous=value;
  }
});

test('visible optics still use one quad per beam and lens, and add nothing during blackout',()=>{
  const scene=createStageGpuScene(),layout={width:8,depth:6,height:3,room:true,positions:{}};
  const camera={mode:'dancer',x:0,y:0,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
  const lights=Array.from({length:20},(_,i)=>({id:String(i),type:'moving',power:.22,color:'#20eecc',position:{x:-3.5+i*7/19,y:5,height:2.5},target:{x:0,y:2,z:0}}));
  const original=structuredClone(lights);
  const count=(frame,kind)=>{let n=0;for(let i=9;i<frame.vertices.length;i+=10)if(frame.vertices[i]===kind)n++;return n;};
  const frame=scene.build(640,360,layout,lights,camera);
  assert.equal(count(frame,1),20*6);assert.equal(count(frame,2),20*6);
  assert.deepEqual(lights,original,'preview exposure does not modify fixture output');
  const dark=scene.build(640,360,layout,lights.map(l=>({...l,power:0})),camera);
  assert.equal(count(dark,1),0);assert.equal(count(dark,2),0);
});
