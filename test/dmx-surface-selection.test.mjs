import test from 'node:test';
import assert from 'node:assert/strict';
import {assignMovementSurfaces} from '../public/song-movement-plan.js';
import {applyRoomPlan,wallChoreography} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
const passages=()=>Array.from({length:12},(_,i)=>({start:i*8,end:(i+1)*8,role:'impact',motion:'breathing-arch',composition:i%3===0?'frame-center':'parallel-sweep',coordination:'ordered'}));
test('surface selection follows figures and recent exposure rather than peak labels',()=>{
 const p=passages(),a=assignMovementSurfaces(p),b=assignMovementSurfaces(p.map(x=>({...x,role:'groove'})));
 assert.deepEqual(a.map(x=>x.surface),b.map(x=>x.surface));
 assert.ok(a.some(x=>x.surface==='wall'));
 assert.ok(a.filter(x=>x.surface==='floor').length>a.length/2);
 assert.ok(a.filter(x=>x.composition==='parallel-sweep').every(x=>x.surface==='floor'));
 assert.ok(p.every(x=>!('surface' in x)),'planning does not mutate source data');
});
test('repeated wall-friendly figures do not monopolize the receiving surface',()=>{
 const p=assignMovementSurfaces(passages().map(x=>({...x,composition:'frame-center'})));
 assert.ok(p.some(x=>x.surface==='wall')&&p.some(x=>x.surface==='floor'));
 assert.ok(p.every((x,i)=>!i||x.surface!=='wall'||p[i-1].surface!=='wall'));
});
test('held show and automatic figures do not fall back to a wall because of their tilt',()=>{
 const room=clubStageRoom();
 for(const motionPresentation of ['show','auto']){
  const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},crowd:[],lights:[{id:'source',type:'moving',position:{x:0,y:3,height:3},target:{x:0,y:4},motionUV:{x:.5,y:.95},motionPresentation,power:1}]},room);
  const heads=scene.lights.filter(l=>l.type==='moving'&&room.positions[l.id].wallTarget);
  assert.ok(heads.length>0);
  for(const light of heads){assert.equal(light.motionWallBlend,0);assert.deepEqual(wallChoreography(light,room).target,light.target);}
 }
});
test('long unbroken passages are not assigned an extended wall hold just to use a wall-friendly form',()=>{
 const p=assignMovementSurfaces([{start:0,end:20,motion:'opening-lines',composition:'parallel-sweep',role:'groove'},
 {start:20,end:50,motion:'orbit',composition:'frame-center',role:'impact'}]);
 assert.equal(p[1].surface,'floor');
 assert.deepEqual(p.map(x=>[x.start,x.end]),[[0,20],[20,50]],'no artificial timed subdivisions are added');
});
