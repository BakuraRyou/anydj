import test from 'node:test';
import assert from 'node:assert/strict';
import {stageLayout,rotateAssembly} from '../public/dmx-layout-model.js';
import {stageEquipment,stagePatch,encodeStage,decodeStage} from '../public/dmx-model.js';
import {FIXTURE_LIBRARY} from '../public/dmx-fixture-library.js';
const rig=()=>stageLayout({positions:{a:{x:-1,y:3,height:2},b:{x:1,y:3,height:4}},targets:{a:{x:0,y:1}},assemblies:[{id:'rig',name:'Viererbar',members:['a','b'],rotation:0}]});
test('persistent assemblies rotate rigidly around their center, preserving heights and floor targets',()=>{
  let layout=rig();for(const angle of [30,90,180,270,360]){
    layout=rotateAssembly(layout,'rig',angle);assert.ok(layout);
    const {a,b}=layout.positions;assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-2)<1e-10);
    assert.equal(a.height,2);assert.equal(b.height,4);assert.deepEqual(layout.targets,rig().targets);
  }
  assert.ok(Math.abs(layout.positions.a.x+1)<1e-10);
  assert.deepEqual(stageLayout(JSON.parse(JSON.stringify(layout))),layout);
});
test('out-of-room rotation is rejected atomically and malformed membership is cleaned',()=>{
  const layout=rig();layout.positions.a.y=layout.positions.b.y=.1;const before=stageLayout(layout);
  assert.equal(rotateAssembly(layout,'rig',90),null);assert.deepEqual(layout,before);
  assert.equal(rotateAssembly(layout,'rig',NaN),null);
  assert.equal(stageLayout({...layout,assemblies:[...layout.assemblies,{id:'other',members:['a','b']},{id:'invalid',members:['missing']}]}).assemblies.length,1);
});
test('catalog profiles encode documented channels and preserve RGB preview and blackout',()=>{
  const equipment=stageEquipment({devices:FIXTURE_LIBRARY.map(p=>({id:p.id,type:p.type,cells:1,modelId:p.id}))});
  assert.deepEqual(stageEquipment(JSON.parse(JSON.stringify(equipment))),equipment);
  const frame={state:true,dimming:50,r:200,g:100,b:50},universe=encodeStage(frame,equipment);
  for(const f of stagePatch(equipment)){
    const bytes=Array.from(universe.slice(f.address-1,f.address-1+f.channels));
    if(f.modelId==='adj-mega-tripar-plus-4')assert.deepEqual(bytes,[100,50,25,0]);
    if(f.modelId.startsWith('stairville'))assert.deepEqual(bytes,[200,100,50,0,0,0,128]);
    if(f.channels===3)assert.deepEqual(bytes,[100,50,25]);
  }
  for(const f of decodeStage(universe,equipment))assert.deepEqual(f.cells,[[100,50,25]]);
  assert.ok(encodeStage({...frame,state:false},equipment).every(v=>v===0));
  assert.throws(()=>stageEquipment({devices:[{id:'x',type:'spot',modelId:'unknown'}]}),/Geräteprofil/);
  assert.throws(()=>stageEquipment({devices:Array.from({length:74},(_,i)=>({id:String(i),type:'spot',modelId:'stairville-par56-7'}))}),/512/);
});
