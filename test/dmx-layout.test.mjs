import test from 'node:test';
import assert from 'node:assert/strict';
import {stageLayout,fixturePosition,projectMovingHeads} from '../public/dmx-layout-model.js';
import {restingHeads} from '../public/dmx-moving-model.js';
test('layout validates dimensions, device bounds and stable IDs',()=>{
  const layout=stageLayout({width:4,depth:3,positions:{a:{x:100,y:-5,height:0}}});
  assert.deepEqual(layout.positions.a,{x:2,y:0,height:.3});
  assert.deepEqual(fixturePosition(layout,'a',2,4),layout.positions.a);
  assert.equal(stageLayout({width:Infinity,depth:NaN}).width,8);
  assert.equal(stageLayout(null).depth,6);
  assert.deepEqual(stageLayout(JSON.parse(JSON.stringify(layout))),layout);
});
test('symmetric placement yields symmetric directions to common stage targets',()=>{
  const result=projectMovingHeads(stageLayout(),restingHeads());
  for(const [a,b] of [[0,3],[1,2]]){
    assert.ok(Math.abs(result[a].target.x+result[b].target.x)<1e-10);
    assert.ok(Math.abs(result[a].pan+result[b].pan)<1e-10);
    assert.equal(result[a].tilt,result[b].tilt);
  }
});
test('moving a fixture changes required angles and distance, not its choreography target',()=>{
  const layout=stageLayout(),first=projectMovingHeads(layout,restingHeads());
  layout.positions['moving-0']={x:-3.5,y:5.5,height:5};
  const next=projectMovingHeads(layout,restingHeads());
  assert.deepEqual(next[0].target,first[0].target);
  assert.notEqual(next[0].pan,first[0].pan);assert.notEqual(next[0].tilt,first[0].tilt);assert.notEqual(next[0].distance,first[0].distance);
  assert.deepEqual(next[1],first[1]);
});
test('projection is finite directly under the fixture and scales with stage size',()=>{
  const layout=stageLayout(),poses=restingHeads(),target=projectMovingHeads(layout,poses)[0].target;
  layout.positions['moving-0']={...target,height:3};
  const point=projectMovingHeads(layout,poses)[0];assert.equal(point.tilt,90);assert.equal(point.distance,3);
  const wider=projectMovingHeads(stageLayout({width:16}),poses)[0];assert.equal(wider.target.x,target.x*2);
});

test('odd rigs identify the physically middle fixture independently of device order',()=>{
 for(const count of [1,3,5,9]){
  const devices=Array.from({length:count},(_,i)=>({id:`head-${i}`})).reverse();
  const layout=stageLayout({positions:Object.fromEntries(devices.map(d=>[d.id,{x:Number(d.id.slice(5))-(count-1)/2,y:5,height:2}]))});
  const heads=projectMovingHeads(layout,devices.map(()=>({pan:0,tilt:.8})),devices);
  assert.deepEqual(heads.filter(h=>h.motionRole==='center').map(h=>h.id),[`head-${(count-1)/2}`]);
 }
 assert.ok(projectMovingHeads(stageLayout(),restingHeads()).every(h=>!h.motionRole));
});
