import test from 'node:test';
import assert from 'node:assert/strict';
import {createVRScene,roomToXRMatrix,vrEyeBasis,vrBeamBounds} from '../public/dmx-vr-scene.js';
import {worldToXR} from '../public/dmx-stage-vr.js';
import {largeClubRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan} from '../public/dmx-ar-model.js';
const scene=()=>({layout:{width:8,depth:12,height:5,positions:{},room:true},lights:[{id:'head',type:'moving',position:{x:0,y:6,height:4},target:{x:0,y:3,z:0},power:1,color:'#ff4000'}],crowd:[],motion:0});
const projection=new Float32Array([1,0,0,0,0,1,0,0,.1,-.15,-1.002,-1,0,0,-.1,0]);
const eye={projectionMatrix:projection,transform:{inverse:{matrix:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,-.032,-1.7,0,1])}}};
test('GPU room matrix agrees with worldToXR including rotation and floor calibration',()=>{
 for(const yaw of [0,.7,-2]){
  const origin={x:3,y:-2,yaw,floorOffset:.4},p=[2,5,1.7],m=roomToXRMatrix(origin);
  const actual=[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
  actual.forEach((v,i)=>assert.ok(Math.abs(v-worldToXR(p,origin)[i])<1e-6));
 }
});
test('eye basis preserves stereo displacement and room axes after navigation',()=>{
 const b=vrEyeBasis(eye,{x:0,y:1,yaw:0});
 assert.ok(Math.abs(b.position[0]-.032)<1e-6);assert.ok(Math.abs(b.position[2]-1.7)<1e-6);
 assert.deepEqual(b.forward.map(v=>v||0),[0,1,0]);
 const rotated=vrEyeBasis(eye,{x:3,y:4,yaw:Math.PI/2,floorOffset:.2});
 assert.ok(Math.abs(rotated.position[1]-4.032)<1e-6);assert.ok(Math.abs(rotated.forward[0]+1)<1e-6);
});
test('beam bounds keep near-plane intersections and cull volumes outside either eye',()=>{
 const b=vrEyeBasis(eye,{x:0,y:0,yaw:0});
 assert.equal(vrBeamBounds([[0,-3,1],[1,-2,2]],b,projection),null);
 assert.equal(vrBeamBounds([[100,3,1],[101,4,2]],b,projection),null);
 assert.deepEqual(vrBeamBounds([[0,-1,1],[1,2,2]],b,projection),[-1,-1,1,1]);
 const bounds=vrBeamBounds([[-.5,3,1],[.5,3,2]],b,projection);assert.ok(bounds&&bounds.every(Number.isFinite));
});
test('VR uses a single smooth receiver layer and volumetric beams, with finite streams',()=>{
 const s=scene(),frame=createVRScene().build(s,[0,1,1.7]);
 assert.equal(frame.beams.length,1);assert.ok(frame.add.length>0);
 for(const name of ['solid','lines','alpha','add'])assert.ok(frame[name].data.subarray(0,frame[name].length).every(Number.isFinite));
 for(let i=10;i<frame.add.length;i+=11)assert.equal(frame.add.data[i],1);
});
test('projection cache invalidates aiming and room changes but keeps live color and power',()=>{
 const build=createVRScene(),s=scene();
 const first=Array.from(build.build(s,[0,1,1.7]).add.data.subarray(0,66));
 s.lights[0].color='#0040ff';const color=build.build(s,[0,1,1.7]).add.data;
 assert.notEqual(color[3],first[3]);assert.equal(color[0],first[0]);
 s.lights[0].target.x=2;const aimed=Array.from(build.build(s,[0,1,1.7]).add.data.subarray(0,66));assert.notDeepEqual(aimed.slice(0,3),first.slice(0,3));
 s.layout.width=3;const resized=Array.from(build.build(s,[0,1,1.7]).add.data.subarray(0,66));assert.notDeepEqual(resized,aimed);
 s.lights[0].power=0;const dark=build.build(s,[0,1,1.7]);assert.equal(dark.beams.length,0);assert.equal(dark.add.length,0);
});
test('192-light preset keeps every optical beam and stable haze resolution across blackout',()=>{
 const plan=largeClubRoom(),s=applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:['moving','spot','bar'].map(type=>({id:type,type,position:{x:0,y:2,height:3},target:{x:0,y:3},power:1,color:'#00aaff'})),crowd:[]},plan),builder=createVRScene();
 assert.equal(new Set(s.lights.filter(l=>!['stand','truss'].includes(l.type)).map(l=>l.id)).size,192);
 const lit=builder.build(s,[0,1,1.7]);const beams=lit.beams.length;assert.ok(beams>=192);assert.equal(lit.volumeScale,1/3);
 const powers=s.lights.map(l=>l.power);
 for(const l of s.lights)l.power=0;
 const dark=builder.build(s,[0,1,1.7]);assert.equal(dark.volumeScale,1/3);assert.equal(dark.beams.length,0);
 s.lights.forEach((l,i)=>l.power=powers[i]);
 assert.equal(builder.build(s,[0,1,1.7]).beams.length,beams);
});
test('distant devices lose geometric detail while retaining their light effects',()=>{
 const s=scene(),builder=createVRScene(),near=builder.build(s,[0,5,1.7]);const vertices=near.solid.length,beams=near.beams.length;
 const far=builder.build(s,[0,-20,1.7]);assert.ok(far.solid.length<vertices);assert.equal(far.beams.length,beams);
});

test('quality responds to sustained missed deadlines and recovers slowly without reacting to pauses',async()=>{
 const {createVRQuality}=await import('../public/dmx-vr-quality.js');
 const q=createVRQuality();let time=0;
 for(let i=0;i<80;i++)q.sample(time+=1000/45,90,12);
 assert.equal(q.state.level,1);assert.equal(q.scale(1/3),.25);
 q.sample(time+=3000,90,0);assert.equal(q.state.level,1);
 for(let i=0;i<400;i++)q.sample(time+=1000/90,90,2);
 assert.equal(q.state.level,0);assert.equal(q.scale(1/3),1/3);
 const unknown=createVRQuality();for(let i=0;i<200;i++)unknown.sample(i*30,undefined,20);
 assert.equal(unknown.state.level,0,'no invented refresh-rate budget');
});
