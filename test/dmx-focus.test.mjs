import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimationFocus,focusAnimation} from '../public/dmx-focus.js';
import {stageCamera,stageFloorPoint} from '../public/dmx-stage-3d-renderer.js';
import {createRoomPreview,newRoomPlan} from '../public/dmx-ar-model.js';
const layout={width:12,depth:10,height:4,room:true,positions:{}};
test('screen picking recovers the floor point in orbit, top and room cameras',()=>{
 for(const camera of [{yaw:.32,pitch:.55,zoom:1},{yaw:0,pitch:Math.PI/2-.01,zoom:1},{mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:0,pitch:.2,zoom:1}]){
  const project=stageCamera(layout,camera,900,600),screen=project([1,5,0]);
  const picked=stageFloorPoint(layout,camera,900,600,screen.x,screen.y);
  assert.ok(picked);assert.ok(Math.hypot(picked.x-1,picked.y-5)<1e-8);
 }
 const camera={mode:'dancer',x:0,y:1,eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
 assert.equal(stageFloorPoint(layout,camera,900,600,450,100),null,'sky does not create a target');
});
test('focus shifts a formation without convergence or changing colors and presence',()=>{
 const heads=Array.from({length:4},(_,i)=>({id:`h${i}`,type:'moving',target:{x:i-1.5,y:4+i*.2},color:'#ff8800',power:i%2?.8:0}));
 const fixed={id:'spot',type:'spot',target:{x:0,y:2},power:.7};
 const input=[...heads,fixed],saved=structuredClone(input);
 const output=focusAnimation(input,layout,{x:2,y:6,weight:1});
 assert.deepEqual(input,saved);
 assert.equal(output.at(-1),fixed);
 assert.equal(new Set(output.slice(0,4).map(l=>JSON.stringify(l.target))).size,4);
 assert.ok(Math.abs(output.slice(0,4).reduce((s,l)=>s+l.target.x,0)/4-2)<1e-8);
 output.forEach((l,i)=>{assert.equal(l.power,input[i].power);assert.equal(l.color,input[i].color);});
 const edge=focusAnimation(heads,layout,{x:5.8,y:9.8,weight:1});
 assert.ok(edge.every(l=>Math.abs(l.target.x)<6&&l.target.y<10));
 assert.equal(focusAnimation(input,layout,null),input);
 const shifted=focusAnimation(heads.map(l=>({...l,target:{...l.target,x:l.target.x+1}})),layout,{x:2,y:6,weight:1});
 assert.ok(shifted[0].target.x>output[0].target.x,'shared sweep still moves around the chosen centre');
});
test('hold, drag and release blend smoothly back to live animation',()=>{
 const focus=createAnimationFocus();focus.sample(0);focus.hold({x:1,y:4});
 for(let i=1;i<=90;i++)focus.sample(i/60);
 assert.ok(focus.sample(1.5).weight>.98);
 focus.hold({x:4,y:7});const moved=focus.sample(1.52);assert.ok(moved.x>1&&moved.x<4);
 focus.release();const released=focus.sample(1.54);assert.ok(released.weight>0&&released.weight<moved.weight);
 for(let i=94;i<=300;i++)focus.sample(i/60);
 assert.equal(focus.sample(5),null);assert.equal(focus.active,false);
});
test('focus remains upstream of room motors and protected-zone routing',()=>{
 const room=newRoomPlan(12,10,4),preview=createRoomPreview();
 const lights=Array.from({length:4},(_,i)=>({id:`h${i}`,type:'moving',position:{x:i-1.5,y:8,height:3},target:{x:i-1.5,y:4},color:'#ff8800',power:i%2?.8:0}));
 lights.forEach(l=>room.positions[l.id]={...l.position,type:'moving',rotation:0});
 let result;
 for(let tick=0;tick<120;tick++)result=preview({layout,lights,crowd:[],previewFocus:{x:2,y:6,weight:1}},room,false,tick/60);
 assert.ok(result.lights.every(l=>Number.isFinite(l.target.x)&&l.power<=.8));
 assert.ok(result.lights.filter(l=>l.id==='h0'||l.id==='h2').every(l=>l.power===0));
 assert.ok(new Set(result.lights.map(l=>l.target.x.toFixed(2))).size>1);
});
test('released focus cannot leave motor, wall or zone history in the normal choreography',()=>{
 for(const withZones of [false,true]){
  const room=newRoomPlan(12,10,4),ordinary=createRoomPreview(),interactive=createRoomPreview();
  if(withZones)room.zones=[{id:'quiet',name:'Quiet',x:.44,y:.4,width:.12,depth:.12}];
  const focus=createAnimationFocus();
  for(let tick=0;tick<600;tick++){
   const now=tick/60;
   if(tick===90)focus.hold({x:3,y:6});
   if(tick===210)focus.release();
   const lights=Array.from({length:4},(_,i)=>({id:`h${i}`,type:'moving',position:{x:(i-1.5)*2,y:8,height:3},target:{x:(i-1.5)*(1+.2*Math.sin(now)),y:2+.4*Math.cos(now)},color:'#ff8800',power:i%2?.8:0}));
   lights.forEach(l=>room.positions[l.id]={...l.position,type:'moving',rotation:0});
   const scene={layout,lights,crowd:[]},saved=structuredClone(scene);
   const reference=ordinary(scene,room,false,now);
   const previewFocus=focus.sample(now);
   const result=interactive({...scene,previewFocus},room,false,now);
   assert.deepEqual(scene,saved,'temporary preview cannot mutate source lights');
   if(!previewFocus)assert.deepEqual(result.lights,reference.lights,`normal playback matches at ${now}, zones=${withZones}`);
  }
 }
});
