import test from 'node:test';
import assert from 'node:assert/strict';
import {formationSpatialPose} from '../public/dmx-strobe-choreography.js';
import {strobeSpaceTarget} from '../public/dmx-strobe-space.js';
import {formationArenaRoom} from '../public/dmx-room-presets.js';
import {validateRoomPlan,roomPlanLayout,roomSurfaceChoreography,applyRoomPlan} from '../public/dmx-ar-model.js';
import {beamVolume,sampleBeamVolume} from '../public/dmx-beam-volume.js';

test('authored planes join different mounting heights without reversing their elevation',()=>{
 const plan=formationArenaRoom(),layout=roomPlanLayout(plan);
 const targets=[];
 for(const row of [0,1,2]){
  const id=`formation-arena-${row}--1-0`,position=plan.positions[id];
  const light={id,type:'moving',position,motionPresentation:'strobe',power:1,
   motionUV:{x:.5,y:.5,beamFocus:1},target:{x:0,y:8}};
  targets.push(strobeSpaceTarget(light,layout));
  const routed=roomSurfaceChoreography(light,layout);
  assert.equal(routed.power,1);
  assert.ok(Math.hypot(routed.target.x-position.x,routed.target.y-position.y,(routed.target.z??0)-position.height)>10,
   'crossings extend through the room instead of terminating just above the mount');
 }
 assert.deepEqual(targets[0],targets[1]);assert.deepEqual(targets[1],targets[2]);
});

test('parallel curtains remain parallel across both floor and upper mounts',()=>{
 const plan=formationArenaRoom(),layout=roomPlanLayout(plan),pose=formationSpatialPose('parallel-lines',0,16,0,3,.5);
 const directions=[0,2].map(row=>{
  const position=plan.positions[`formation-arena-${row}--1-0`];
  const t=strobeSpaceTarget({position,motionUV:pose},layout);
  const d=[t.x-position.x,t.y-position.y,t.z-position.height],n=Math.hypot(...d);
  return d.map(v=>v/n);
 });
 directions[0].forEach((v,i)=>assert.ok(Math.abs(v-directions[1][i])<1e-9));
});

test('crossed beams pass through opposite sides and a curtain shares one height',()=>{
 const left=formationSpatialPose('crossed-fans',0,32,0,3,.8);
 const right=formationSpatialPose('crossed-fans',31,32,0,3,.8);
 assert.ok(left.x>.8&&right.x<.2);
 const curtains=Array.from({length:32},(_,i)=>formationSpatialPose('parallel-lines',i,32,0,3,.5));
 assert.ok(curtains.every(p=>p.y===curtains[0].y&&p.x===curtains[0].x));
});

test('the spatial arena round-trips with six distinct banks and ninety-six editable heads',()=>{
 const plan=formationArenaRoom(),positions=Object.values(plan.positions);
 assert.deepEqual(validateRoomPlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(positions.length,96);assert.ok(positions.every(p=>p.type==='moving'));
 assert.equal(new Set(positions.map(p=>`${p.y}:${p.height}:${Math.sign(p.x)}`)).size,6);
 assert.ok(positions.every(p=>p.x< -6||p.x>6),'banks leave space between their origins');
 const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:[{
  id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},power:1,color:'#fff'}]},plan);
 assert.ok(scene.lights.every(l=>l.beamAngle===2),'the preset uses real narrow beam optics');
 const invalid=structuredClone(plan);Object.values(invalid.positions)[0].beamAngle=.1;
 assert.throws(()=>validateRoomPlan(invalid),'laser-like apertures cannot be assigned to these moving heads');
});

test('long narrow beams retain visible haze and remain bounded near their source',()=>{
 const layout={width:30,depth:36,height:10,room:true};
 const sample=angle=>{
  const v=beamVolume({type:'moving',beamAngle:angle,position:{x:0,y:30,height:5},target:{x:0,y:0,z:5}},layout);
  return sampleBeamVolume(v.data,[10,10,5],[-1,0,0],16);
 };
 assert.ok(sample(2)>.1,'a long concentrated beam stays readable across the room');
 assert.ok(sample(2)>sample(12),'optical concentration increases radiance');
 assert.ok(sample(2)<1&&sample(12)<1);
});
