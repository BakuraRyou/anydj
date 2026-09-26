import test from 'node:test';
import assert from 'node:assert/strict';
import {roomBeamHit,beamSurfacePatches,createRoomMotors} from '../public/dmx-light-geometry.js';
const layout={width:8,depth:6,height:3,room:true},floor=[[[-4,0],[4,0],[4,6],[-4,6]]];
const lamp={id:'head',type:'moving',position:{x:0,y:3,height:2},target:{x:4,y:3,z:0},power:1};
test('one cone illuminates both sides of floor/wall, wall/wall and wall/ceiling corners',()=>{
 for(const [target,planes] of [[{x:4,y:3,z:0},[[0,3.994],[2,.006]]],[{x:4,y:6,z:1.5},[[0,3.994],[1,5.994]]],[{x:4,y:3,z:3},[[0,3.994],[2,2.994]]]]){
  const patches=beamSurfacePatches({...lamp,target},layout,floor);
  for(const [axis,value] of planes)assert.ok(patches.some(p=>p.points.every(v=>Math.abs(v[axis]-value)<1e-6)),JSON.stringify({target,axis,value}));
  assert.ok(patches.every(p=>p.points.flat().every(Number.isFinite)));
 }
});
test('beam stops at the first room surface',()=>{
 const hit=roomBeamHit(layout,[0,3,2],[1,0,-.1]);assert.equal(hit.wallIndex,1);assert.equal(hit.target.x,4);assert.equal(hit.target.z,1.6);
 assert.equal(roomBeamHit(layout,[0,3,2],[0,0,1]).targetSurface,'ceiling');
});
test('final spatial motors bound speed and acceleration after discontinuous targets',()=>{
 const motor=createRoomMotors(),dt=1/120,rad=Math.PI/180;
 let previous=null,velocity=null;
 for(let i=0;i<1200;i++){
  const target=i<300?{x:3,y:1,z:0}:i<600?{x:-3,y:5,z:3}:{x:3,y:5,z:0};
  const value=motor({...lamp,target},layout,i*dt),d=[value.target.x,value.target.y-3,value.target.z-2],angles=[Math.atan2(d[0],-d[1]),Math.atan2(d[2],Math.hypot(d[0],d[1]))];
  if(previous){const v=angles.map((a,j)=>Math.atan2(Math.sin(a-previous[j]),Math.cos(a-previous[j]))/dt);
   v.forEach((x,j)=>assert.ok(Math.abs(x)<[70,60][j]*rad+1e-7));
   if(velocity)v.forEach((x,j)=>assert.ok(Math.abs(x-velocity[j])/dt<[280,240][j]*rad+1e-6));velocity=v;
  }previous=angles;
 }
});
test('yaw seam uses a short continuous movement',()=>{
 const motor=createRoomMotors();motor({...lamp,target:{x:.01,y:6,z:2}},layout,0);
 const next=motor({...lamp,target:{x:-.01,y:6,z:2}},layout,.02);
 assert.ok(next.target.y>5.99);assert.ok(Math.abs(next.target.x)<.02);
});

test('prepared musical reversals stay on time while respecting the same motor envelope',()=>{
 const motor=createRoomMotors(),rad=Math.PI/180,dt=1/120;
 const target=t=>{const angle=15*rad*Math.sin(Math.PI*t);return {x:2*Math.sin(angle),y:3-2*Math.cos(angle),z:1.5};};
 let previous=0,velocity=0,peak=-Infinity,peakTime=0,error=0,count=0;
 for(let i=0;i<1200;i++){
  const t=i*dt,value=motor({...lamp,position:{x:0,y:3,height:1.5},target:target(t),motionAhead:{seconds:.12,target:target(t+.12)}},layout,t);
  const angle=Math.atan2(value.target.x,3-value.target.y)/rad,v=(angle-previous)/dt;
  if(i>1){assert.ok(Math.abs(v)<=70+1e-6);assert.ok(Math.abs(v-velocity)/dt<=280+1e-5);}
  previous=angle;velocity=v;
  if(t>=4&&t<=5&&angle>peak){peak=angle;peakTime=t;}
  if(t>2){error+=Math.abs(angle-15*Math.sin(Math.PI*t));count++;}
 }
 assert.ok(Math.abs(peakTime-4.5)<.035,`musical reversal offset: ${peakTime-4.5}s`);
 assert.ok(error/count<1,'less than one degree mean tracking error');
});

test('vertical aiming retains the current pan instead of inventing a half-turn',()=>{
 const motor=createRoomMotors(),position={x:0,y:3,height:1.5};
 motor({...lamp,position,target:{x:2,y:3,z:1.5}},layout,0);
 for(let i=1;i<=120;i++){
  const result=motor({...lamp,position,target:{x:0,y:3,z:3},motionAhead:{seconds:.12,target:{x:0,y:3,z:3}}},layout,i/120);
  assert.ok(Math.abs(result.aimRotation-90)<1e-7);
 }
});
test('a head tilts continuously across zenith and nadir without a lateral pan sweep',()=>{
 for(const upward of [true,false]){
  const motor=createRoomMotors(),origin={x:0,y:3,height:1.5},dt=1/120;
  const target=t=>{const pitch=(upward?1:-1)*(60+30*t)*Math.PI/180;return {x:1e-15,y:3-2*Math.cos(pitch),z:1.5+2*Math.sin(pitch)};};
  let previous=null,velocity=0;
  for(let i=0;i<240;i++){
   const t=i*dt,result=motor({...lamp,position:origin,target:target(t),motionAhead:{seconds:.12,target:target(t+.12)}},layout,t);
   assert.ok(Math.abs(result.target.x)<1e-6,'no half-turn through a side wall');
   const pitch=Math.atan2(result.target.z-1.5,3-result.target.y),v=previous===null?0:(pitch-previous)/dt;
   if(i>1){assert.ok(Math.abs(v)<=60*Math.PI/180+1e-6);assert.ok(Math.abs(v-velocity)/dt<=240*Math.PI/180+1e-5);}
   previous=pitch;velocity=v;
  }
 }
});

test('unlit moving heads hold their displayed pose and resume without a position jump',()=>{
 const motor=createRoomMotors();motor(lamp,layout,0);
 const previous=motor({...lamp,target:{x:-3,y:0,z:1}},layout,.1);
 for(let frame=2;frame<100;frame++){
  const dark=motor({...lamp,power:0,target:{x:Math.sin(frame)*3,y:1,z:2}},layout,frame/10);
  assert.deepEqual(dark.target,previous.target);
  assert.equal(dark.aimRotation,previous.aimRotation);assert.equal(dark.power,0);
  assert.equal(motor.active(),false);
 }
 const resumed=motor({...lamp,target:{x:-3,y:0,z:1}},layout,9.91);
 assert.ok(Math.abs(resumed.aimRotation-previous.aimRotation)<.1,'no catch-up jump after darkness');
 const moving=motor({...lamp,target:{x:-3,y:0,z:1}},layout,10.01);
 assert.notDeepEqual(moving.target,resumed.target);
});
test('an explicitly dark protected-zone transfer can still reposition',()=>{
 const motor=createRoomMotors();motor(lamp,layout,0);
 const dark=motor({...lamp,power:0,zoneTransit:true,target:{x:-3,y:0,z:1}},layout,.1);
 assert.notDeepEqual(dark.target,lamp.target);assert.equal(dark.power,0);
});

test('a temporarily shuttered group member follows the same motor path as its lit partners',()=>{
 const lit=createRoomMotors(),shuttered=createRoomMotors();
 for(let i=0;i<240;i++){
  const time=i/60,source={...lamp,target:{x:3*Math.sin(time),y:1,z:1.2},power:1};
  const a=lit(source,layout,time),b=shuttered({...source,power:i>20&&i<180?0:1,movingGroupActive:true},layout,time);
  for(const axis of ['x','y','z'])assert.ok(Math.abs(a.target[axis]-b.target[axis])<1e-7);
  if(i>20&&i<180)assert.equal(b.power,0,'motion never opens the shutter');
 }
});
