import test from 'node:test';
import assert from 'node:assert/strict';
import {roomGLB} from './room-model-fixture.mjs';
import {importRoomModel,validateRoomMesh,surfaceTriangles} from '../public/dmx-room-mesh.js';
import {newRoomPlan,validateRoomPlan,roomFromFloor,applyRoomPlan} from '../public/dmx-ar-model.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
const imported=()=>importRoomModel(roomGLB(),'Raum.glb');
const plan=()=>{const m=imported();return validateRoomPlan({...newRoomPlan(m.width,m.depth,m.height),mesh:m.mesh,representation:'model'});};

test('GLB imports selected scene, hierarchy transforms, indexed geometry, and material colors',()=>{
  const result=imported();assert.equal(result.width,8);assert.equal(result.depth,6);assert.equal(result.height,3);
  assert.equal(result.mesh.triangles.length,12);assert.equal(result.mesh.vertices.length,8);
  assert.deepEqual(result.mesh.vertices[0],[-4,0,0]);assert.equal(result.mesh.colors[0],'#89bce1');
  const scaled=importRoomModel(roomGLB(j=>{j.nodes[0].scale=[100,100,100];}),'room.glb',{scale:.01,rotation:90});
  assert.equal(scaled.width,6);assert.equal(scaled.depth,8);assert.equal(scaled.height,3);
  assert.deepEqual(importRoomModel(roomGLB(j=>{j.nodes[1].rotation=[0,Math.SQRT1_2,0,Math.SQRT1_2];}),'room.glb').mesh.vertices.length,8);
});
test('glTF supports embedded buffers without fetching external resources',()=>{
  const bytes=roomGLB(),view=new DataView(bytes.buffer),length=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));
  json.buffers[0].uri='data:application/octet-stream;base64,'+Buffer.from(bytes.subarray(28+length)).toString('base64');
  assert.equal(importRoomModel(new TextEncoder().encode(JSON.stringify(json)),'room.gltf').mesh.triangles.length,12);
  json.buffers[0].uri='https://example.com/model.bin';assert.throws(()=>importRoomModel(new TextEncoder().encode(JSON.stringify(json)),'room.gltf'),/externe Dateien/);
});
test('OBJ supports polygon triangulation, negative indices, Z-up and millimetres',()=>{
  const obj='v 0 0 0\nv 8000 0 0\nv 8000 6000 0\nv 0 6000 0\nv 0 0 3000\nf 1 2 3 4\nf -5 -4 -1';
  const result=importRoomModel(new TextEncoder().encode(obj),'room.obj',{up:'z',scale:.001});
  assert.deepEqual([result.width,result.depth,result.height],[8,6,3]);assert.equal(result.mesh.triangles.length,3);
});
test('malformed, oversized, compressed, animated and cyclic assets fail before committing',()=>{
  for(const change of [j=>{j.accessors[0].count=1e9;},j=>{j.accessors[0].byteOffset=-2;},j=>{j.bufferViews[0].byteLength=4;},j=>{j.nodes[1].children=[0];},j=>{j.meshes[0].primitives[0].indices=99;},j=>{j.accessors[0].sparse={};},(j,b)=>new DataView(b.buffer).setUint16(96,1000,true),j=>{j.nodes[0].translation=[Infinity,0,0];}])assert.throws(()=>importRoomModel(roomGLB(change),'room.glb'));
  assert.throws(()=>importRoomModel(roomGLB(j=>{j.extensionsRequired=['KHR_draco_mesh_compression'];}),'room.glb'),/Draco/);
  assert.throws(()=>importRoomModel(roomGLB(j=>{j.animations=[{}];}),'room.glb'),/statisches/);
  assert.throws(()=>importRoomModel(roomGLB(j=>{j.scenes[0].nodes=Array(500).fill(0);}),'room.glb'),/Dreiecke/);
  assert.throws(()=>importRoomModel(new Uint8Array(11*1024*1024),'room.glb'),/10 MB/);
  assert.throws(()=>importRoomModel(roomGLB(),'room.glb',{scale:.001}),/Einheit/);
  assert.throws(()=>importRoomModel(new Uint8Array([1,2,3]),'room.glb'));
});
test('textured assets retain geometry and report material fallback',()=>{
  const result=importRoomModel(roomGLB(j=>{j.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};}),'room.glb');
  assert.equal(result.mesh.triangles.length,12);assert.match(result.warnings.join(' '),/Bildtexturen/);
});
test('mesh and representation survive room exports; invalid imported plans are rejected',()=>{
  const original=plan();assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(original))),original);
  for(const mutation of [m=>{m.vertices[0][0]=NaN;},m=>{m.triangles[0][0]=9000;},m=>{m.colors[0]='url(x)';}]){const mesh=structuredClone(original.mesh);mutation(mesh);assert.throws(()=>validateRoomMesh(mesh));}
  assert.throws(()=>validateRoomPlan({...original,width:2}));
  assert.equal(validateRoomPlan({...original,representation:'style'}).representation,'style');
  assert.equal(validateRoomPlan(newRoomPlan()).representation,'style');
});
test('concave scan walls triangulate in 3D and captured rooms choose scan automatically',()=>{
  const points=[[0,0,0],[3,0,0],[3,0,1],[1,0,1],[1,0,3],[0,0,3]],triangles=surfaceTriangles(points);
  assert.equal(triangles.length,4);
  assert.equal(triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2,0),5);
  const capture=roomFromFloor([[0,0,0],[4,0,0],[4,0,-6],[0,0,-6]],[{kind:'wall',points:[[0,0,0],[4,0,0],[4,3,0],[0,3,0]]}]);
  assert.equal(capture.plan.representation,'scan');
});
test('models and scans render as filled geometry in desktop/VR and remain hidden in AR',()=>{
  const source={layout:{positions:{}},lights:[],crowd:[]};
  for(const room of [plan(),validateRoomPlan({...newRoomPlan(),representation:'scan',surfaces:[{kind:'wall',points:[[-4,6,0],[4,6,0],[4,6,3],[-4,6,3]]}]})]){
    for(const ar of [false,true]){
      const scene=applyRoomPlan(source,room,ar),faces=[];drawStageGeometry(scene.layout,[],[],0,{polygon(p,fill){if(fill)faces.push(p);}});
      assert.equal(faces.length,ar?0:room.mesh?12:2);
    }
  }
});
