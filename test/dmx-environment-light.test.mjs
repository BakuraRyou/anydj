import test from 'node:test';
import assert from 'node:assert/strict';
import {environmentBrightness,environmentColor,sceneEnvironmentBrightness} from '../public/dmx-room-style.js';
import {roomSettings,roomLayout} from '../public/dmx-room.js';
import {newRoomPlan,validateRoomPlan,roomPlanLayout,roomFromFloor} from '../public/dmx-ar-model.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
import {importRoomModel} from '../public/dmx-room-mesh.js';
import {roomGLB} from './room-model-fixture.mjs';
const geometry=(layout,lights=[])=>{const result=[];drawStageGeometry(layout,lights,[],0,{polygon:(points,fill,alpha,stroke,width,emissive)=>result.push({points,fill,alpha,stroke,emissive})});return result;};

test('environment values default to dark and survive storage, layout mapping and scan capture',()=>{
  assert.equal(environmentBrightness(undefined),30);assert.equal(environmentBrightness(Infinity),30);
  assert.equal(environmentBrightness(-1),0);assert.equal(environmentBrightness(200),100);
  for(const value of [0,12,100]){
    const plan=validateRoomPlan({...newRoomPlan(),environmentBrightness:value});
    assert.equal(validateRoomPlan(JSON.parse(JSON.stringify(plan))).environmentBrightness,value);
    assert.equal(sceneEnvironmentBrightness(roomPlanLayout(plan)),value);
    assert.equal(sceneEnvironmentBrightness(roomLayout(roomSettings({environmentBrightness:value}))),value);
    const scan=roomFromFloor([[0,0,0],[4,0,0],[4,0,-6],[0,0,-6]],[],plan);
    assert.equal(scan.plan.environmentBrightness,value);
  }
  assert.equal(environmentColor('#ffffff',0),'#000000');assert.equal(environmentColor('#505050',50),'#282828');
});
test('styles, scans and GLB geometry become black at zero environment light',()=>{
  const imported=importRoomModel(roomGLB(),'room.glb');
  const plans=[newRoomPlan(),validateRoomPlan({...newRoomPlan(),representation:'scan',surfaces:[{kind:'wall',points:[[-4,6,0],[4,6,0],[4,6,3],[-4,6,3]]}]}),validateRoomPlan({...newRoomPlan(imported.width,imported.depth,imported.height),mesh:imported.mesh,representation:'model'})];
  for(const plan of plans){
    const dark=geometry(roomPlanLayout({...plan,environmentBrightness:0}));
    const bright=geometry(roomPlanLayout({...plan,environmentBrightness:100}));
    assert.ok(dark.some(p=>p.fill));assert.ok(dark.every(p=>(!p.fill||p.fill==='#000000')&&(!p.stroke||p.stroke==='#000000')));
    assert.ok(bright.some(p=>p.fill&&p.fill!=='#000000'));
  }
});
test('environment dimming preserves beams, footprints, luminous lenses and input light power',()=>{
  const layout=roomLayout(roomSettings({enabled:true})),lights=[{id:'spot',type:'spot',position:{x:0,y:5,height:3},target:{x:0,y:2},power:.8,color:'rgb(255,0,0)'}],original=structuredClone(lights);
  const lightFaces=value=>geometry({...layout,environmentBrightness:value},lights).filter(p=>p.emissive||p.fill===lights[0].color);
  const dark=lightFaces(0),bright=lightFaces(100);
  assert.ok(dark.length>10);assert.deepEqual(dark,bright);assert.deepEqual(lights,original);
  const ar=value=>geometry({...layout,ar:true,environmentBrightness:value},lights);
  assert.deepEqual(ar(0),ar(100),'AR virtual devices stay readable and passthrough is not dimmed');
});
