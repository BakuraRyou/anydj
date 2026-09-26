import test from 'node:test';
import assert from 'node:assert/strict';
import {roomSurfaceChoreography,newRoomPlan,roomPlanLayout,insideRoom,createRoomPreview,respectRoomVolumes} from '../public/dmx-ar-model.js';
import {drawStageGeometry} from '../public/dmx-stage-3d-renderer.js';
const light={id:'moving-0',type:'moving',position:{x:0,y:5,height:2.5},target:{x:1,y:1},motionUV:{x:.6,y:.4},color:'#ff0000',power:.8};
test('automatic room movement reaches walls and ceiling continuously without changing power',()=>{
 const layout=roomPlanLayout(newRoomPlan(8,6,3)),before=structuredClone(light);
 let previous;
 const surfaces=new Set();
 for(let i=0;i<=1000;i++){
  const value=roomSurfaceChoreography({...light,motionUV:{x:.6,y:i/1000}},layout);
  surfaces.add(value.targetSurface);assert.equal(value.power,.8);
  assert.ok(insideRoom([value.target.x,value.target.y],layout.roomPlan.boundary));
  assert.ok(value.target.z>=0&&value.target.z<=3);
  if(value.targetSurface==='ceiling')assert.equal(value.target.z,3);
  else if(value.targetSurface==='wall')assert.equal(value.target.y,0);
  if(previous)assert.ok(Math.hypot(value.target.x-previous.x,value.target.y-previous.y,value.target.z-previous.z)<.03);
  previous=value.target;
 }
 assert.deepEqual(surfaces,new Set(['floor','wall','ceiling']));assert.deepEqual(light,before);
});
test('explicit targets and exclusion areas retain their existing routing',()=>{
 const layout=roomPlanLayout(newRoomPlan(8,6,3));
 for(const config of [{wallTarget:{}},{motionArea:{}}]){
  layout.positions[light.id]=config;assert.equal(roomSurfaceChoreography(light,layout),light);
 }
 delete layout.positions[light.id];layout.zones=[{x:0,y:0,width:.2,depth:.2}];
 const wall=roomSurfaceChoreography(light,layout);
 assert.equal(wall.targetSurface,'wall');assert.ok(wall.target.z<3);
 const lifted=roomSurfaceChoreography({...light,motionUV:{x:.6,y:.9}},layout);
 assert.equal(lifted.targetSurface,'ceiling');assert.equal(lifted.target.z,3);
 assert.equal(lifted.power,light.power);
 assert.equal(roomSurfaceChoreography({...light,type:'spot'},layout).type,'spot');
});
test('concave room rays stop at the first wall; desktop/XR geometry renders elevated footprints',()=>{
 const plan=newRoomPlan(8,6,3);plan.boundary=[[-4,0],[4,0],[4,2],[0,2],[0,6],[-4,6]];
 const layout=roomPlanLayout(plan),source={...light,position:{x:-2,y:5,height:2},target:{x:3,y:1}};
 for(const y of [.3,.65,.9]){
  const value=roomSurfaceChoreography({...source,motionUV:{x:.6,y}},layout);
  assert.ok(insideRoom([value.target.x,value.target.y],plan.boundary));
  if(y<.7&&y>=.25)assert.equal(value.wallIndex,3);
  const illuminated=[];
  drawStageGeometry(layout,[value],[],0,{polygon:(points,color,alpha,stroke,width,emissive)=>{if(emissive&&color===source.color)illuminated.push(points);}});
  assert.ok(illuminated.length>0);
  assert.ok(illuminated.some(points=>points.every(p=>p[2]>=0)));
 }
});


test('room mapping carries legacy/virtual moving coordinates through to the displayed surface',()=>{
 const plan=newRoomPlan(8,6,3);plan.positions[light.id]={...light.position,rotation:0,type:'moving',size:{width:.2,depth:.2,height:.3}};
 const {motionUV,...legacy}=light;
 const preview=createRoomPreview();
 const result=preview({layout:{width:8,depth:6,positions:{}},lights:[legacy],crowd:[]},plan,false,0).lights[0];
 assert.ok(result.motionUV);assert.ok(result.target.z>0);assert.equal(result.targetSurface,'floor');
 assert.equal(result.power,legacy.power);
});

test('plain stage preview uses the actual front wall beyond the dancefloor',()=>{
 const result=roomSurfaceChoreography(light,{width:8,depth:6,positions:{}});
 assert.equal(result.target.y,-6);assert.equal(result.targetSurface,'wall');
});


test('quiet zones allow continuous wall-ceiling-wall journeys without crossing their footprint',async()=>{
 const {blockedSegment,zoneObstacles}=await import('../public/dmx-zone-motion.js');
 const layout=roomPlanLayout(newRoomPlan(8,6,3));
 layout.roomPlan.zones=[{x:.05,y:.35,width:.15,depth:.15}];
 const boxes=zoneObstacles(layout,layout.roomPlan.zones,0),surfaces=new Set();let previous;
 for(let i=0;i<=1200;i++){
  const y=.5-.45*Math.cos(i/1200*2*Math.PI);
  const value=roomSurfaceChoreography({...light,motionUV:{x:.6,y}},layout);
  surfaces.add(value.targetSurface);assert.equal(value.power,light.power);
  assert.ok(value.target.z>=0&&value.target.z<=3);
  if(previous){assert.ok(Math.hypot(value.target.x-previous.x,value.target.y-previous.y,value.target.z-previous.z)<.04);assert.equal(blockedSegment(previous,value.target,boxes),false);}
  previous=value.target;
 }
 assert.deepEqual(surfaces,new Set(['floor','wall','ceiling']));assert.ok(previous.z<3);
});

test('a blocked preferred wall uses another free wall instead of locking onto the ceiling',()=>{
 const layout=roomPlanLayout(newRoomPlan(8,6,3));layout.roomPlan.zones=[{x:.45,y:0,width:.4,depth:.15}];
 const source={...light,target:{x:1,y:3},motionUV:{x:.6,y:.3}};
 const result=roomSurfaceChoreography(source,layout);
 assert.equal(result.targetSurface,'wall');assert.ok(result.target.z<3);assert.equal(result.power,source.power);
 assert.notEqual(result.wallIndex,0);
});


test('quiet zones are full-height volumes: floor, wall and ceiling beams cannot pass through',()=>{
 const layout={width:8,depth:6,zones:[{x:.4,y:.4,width:.2,depth:.2}]};
 for(const z of [.012,1.5,3]){
  const crossing={...light,position:{x:0,y:5,height:2.5},target:{x:0,y:1,z}};
  assert.equal(respectRoomVolumes(crossing,layout).power,0);
  const free={...crossing,position:{x:3,y:5,height:2.5},target:{x:3,y:1,z}};
  assert.equal(respectRoomVolumes(free,layout).power,light.power);
 }
});

test('musical lookahead follows fixture placement and the same wall/ceiling mapping',async()=>{
 const {createRoomPreview,newRoomPlan}=await import('../public/dmx-ar-model.js');
 const plan=newRoomPlan(10,10,4);
 plan.positions.lamp={type:'moving',x:1,y:8,height:2.5,rotation:0,size:{width:.4,depth:.3,height:.4}};
 const current={id:'lamp',type:'moving',position:{x:0,y:5,height:2},target:{x:-1,y:1},motionUV:{x:.4,y:.5},power:1};
 const future={target:{x:1,y:2},motionUV:{x:.7,y:.8}};
 const scene={layout:{width:8,depth:6,positions:{}},lights:[{...current,motionAhead:{seconds:.12,...future}}]};
 const actual=createRoomPreview()(scene,plan,false,0).lights[0];
 const expected=createRoomPreview()({...scene,lights:[{...current,...future}]},plan,false,0).lights[0];
 assert.deepEqual(actual.motionAhead.target,expected.target);
 assert.equal(actual.motionAhead.seconds,.12);
 assert.equal(expected.targetSurface,'ceiling');
});

test('nine physically ordered heads preserve reflection on floor, walls and ceiling',async()=>{
 const {movingDevicePoses,projectMovingHeads}=await import('../public/dmx-layout-model.js');
 const {createRoomMotors}=await import('../public/dmx-light-geometry.js');
 const devices=Array.from({length:9},(_,i)=>({id:`head-${i}`,group:i%3}));
 const layout={width:8,depth:6,height:4,room:true,positions:Object.fromEntries(devices.map((d,i)=>[d.id,{x:(i-4)*.7,y:5,height:2.5}]))};
 // Input order and assigned group do not define the room's mirror axis.
 const order=[...devices].reverse(),motor=createRoomMotors(),surfaces=new Set();
 for(let frame=0;frame<1200;frame++){
  const time=frame/60,tilt=.55+.6*(.5-.5*Math.cos(time*Math.PI/10));
  const poses=[-22,-10,10,22].map(pan=>({pan,tilt}));
  const heads=projectMovingHeads(layout,movingDevicePoses(poses,order,{formation:'coherent',layout}),order)
   .map(l=>motor(roomSurfaceChoreography({...l,type:'moving',power:1},layout),layout,time)).sort((a,b)=>a.position.x-b.position.x);
  heads.forEach(h=>surfaces.add(h.targetSurface));
  for(let i=0;i<4;i++){
   const a=heads[i],b=heads[8-i];
   assert.ok(Math.abs(a.target.x+b.target.x)<1e-7);
   assert.ok(Math.abs(a.target.y-b.target.y)<1e-7);
   assert.ok(Math.abs(a.target.z-b.target.z)<1e-7);
  }
  assert.ok(Math.abs(heads[4].target.x)<1e-7);
 }
 assert.deepEqual(surfaces,new Set(['floor','wall','ceiling']));
});

test('the center head keeps its ceiling arc when musical depth crosses its mounting line',()=>{
 const plan=newRoomPlan(8,10,4);
 plan.positions.center={type:'moving',x:0,y:8,height:2.5,rotation:0,size:{width:.3,depth:.3,height:.4}};
 const layout=roomPlanLayout(plan);let previous;
 for(let step=0;step<=400;step++){
  const y=.7+step*.00075;
  const result=roomSurfaceChoreography({id:'center',type:'moving',motionRole:'center',position:plan.positions.center,target:{x:0,y:y*10},motionUV:{x:.5,y},power:1},layout);
  assert.equal(result.target.x,0);
  assert.ok(result.target.y<8,'the middle head stays on the same side of its mounting line');
  assert.equal(result.targetSurface,y>.7?'ceiling':'wall');
  if(previous)assert.ok(Math.hypot(result.target.y-previous.y,result.target.z-previous.z)<.04,'no jump at exact alignment or wall reversal');
  previous=result.target;
 }
});

test('virtual room fixtures resolve exactly one center after cloning source roles',async()=>{
 const {applyRoomPlan}=await import('../public/dmx-ar-model.js');
 const plan=newRoomPlan(8,6,4);
 for(let i=0;i<5;i++)plan.positions[`virtual-${i}`]={type:'moving',x:(i-2)*1.2,y:5,height:2,rotation:0,size:{width:.3,depth:.3,height:.4}};
 const source={layout:{width:8,depth:6,positions:{}},lights:[{...light,id:'source',motionRole:'center'}]};
 const result=applyRoomPlan(source,plan);
 assert.deepEqual(result.lights.filter(l=>l.motionRole==='center').map(l=>l.id),['virtual-2']);
});

test('the middle fills the spatial gap on the neighbours receiving plane',async()=>{
 const {alignRoomFormation}=await import('../public/dmx-ar-model.js');
 const layout={width:8,depth:6,height:4,room:true,positions:{}};
 for(const z of [0,2,4]){
  const heads=[-2,0,2].map((x,i)=>({id:String(i),type:'moving',position:{x,y:5,height:2.5},target:i===1?{x:3,y:2,z:0}:{x,y:0,z},power:.7}));
  const result=alignRoomFormation(heads,layout);
  assert.deepEqual(result[1].target,{x:0,y:0,z});
  assert.equal(result[0],heads[0]);assert.equal(result[2],heads[2]);assert.equal(result[1].power,.7);
 }
});

test('room coordination preserves authored outer roles and ignores obsolete global figure hints',async()=>{
 const {alignRoomFormation}=await import('../public/dmx-ar-model.js');
 const layout={width:10,depth:10,height:5,room:true,positions:{}};
 for(const count of [5,6])for(const roomFigure of ['parallel','focus']){
  const heads=Array.from({length:count},(_,i)=>({id:String(i),type:'moving',roomFigure,position:{x:i-(count-1)/2,y:2,height:2},target:{x:(i%2?1:-1)*2,y:10,z:2.5},power:.7}));
  const result=alignRoomFormation(heads,layout);
  result.forEach((light,i)=>{if(count%2&&i===Math.floor(count/2))return;assert.equal(light,heads[i],'room projection cannot replace the musical roles of the whole rig');});
 }
});

test('group coordination respects explicit fixture targets',async()=>{
 const {alignRoomFormation}=await import('../public/dmx-ar-model.js');
 const layout={width:8,depth:6,height:4,room:true,positions:{'1':{wallTarget:{wall:0}}}};
 const heads=[-2,0,2].map((x,i)=>({id:String(i),type:'moving',roomFigure:'parallel',position:{x,y:5,height:2.5},target:{x,y:0,z:2},power:1}));
 assert.equal(alignRoomFormation(heads,layout),heads);
});

test('five room heads with editor-saved target points coordinate their middle independently of four static fixtures',()=>{
 const plan=newRoomPlan(10,8,4),positions={};
 const heads=[.2,.35,.15,.65,.8].map((x,i)=>{
  const id=`moving-${i}`,position={type:'moving',x:(i-2)*1.5,y:7,height:2.5,rotation:0,size:{width:.35,depth:.3,height:.4},target:{x:-3,y:1}};
  plan.positions[id]=position;positions[id]=position;
  return {id,type:'moving',position,target:{x:(x-.5)*10,y:3.6},motionUV:{x,y:.45},power:1,color:'#ffdd33',roomFigure:'fan'};
 });
 const spots=Array.from({length:4},(_,i)=>{
  const id=`spot-${i}`,position={type:'spot',x:(i-1.5)*2,y:7,height:2.5,rotation:0,size:{width:.3,depth:.3,height:.3},target:{x:i-1.5,y:1}};
  plan.positions[id]=position;positions[id]=position;
  return {id,type:'spot',position,target:position.target,power:1,color:'#ffdd33'};
 });
 const scene={layout:{width:10,depth:8,positions},lights:[...heads,...spots]};
 const result=createRoomPreview()(scene,plan,false,0),moving=result.lights.filter(l=>l.type==='moving');
 assert.equal(moving.length,5);
 const [left,center,right]=moving.slice(1,4);
 assert.ok(Math.abs(center.target.x-(left.target.x+right.target.x)/2)<1e-8,'saved editor targets must not leave the middle following a left-hand role');
 assert.ok(Math.abs(center.target.x)<1e-8);
 assert.equal(center.targetSurface,'wall');
 assert.ok(result.lights.filter(l=>l.type==='spot').every(l=>l.target.y===1),'static fixture targets remain explicit');

});

test('coordinated room motion preserves shared angular timing across seven emitters',()=>{
 const plan=newRoomPlan(8,12,4),layout=roomPlanLayout(plan);
 const angle=light=>{
  const d=[light.target.x-light.position.x,light.target.y-light.position.y,light.target.z-light.emissionHeight];
  return {pan:Math.atan2(d[0],-d[1])*180/Math.PI,tilt:Math.atan2(d[2],Math.hypot(d[0],d[1]))*180/Math.PI};
 };
 for(let step=0;step<=100;step++){
  const y=step/100,angles=[];
  for(let i=0;i<7;i++){
   const x=.2+i*.1,position={x:i-3,y:10,height:2.5};
   const light={id:'head-'+i,type:'moving',motionFormation:'coherent',motionUV:{x,y},position,target:{x:(x-.5)*8,y:y*12},power:1};
   const actual=angle(roomSurfaceChoreography(light,layout));angles.push(actual);
   assert.ok(Math.abs(actual.pan-(x-.5)*200)<1e-7);
   assert.ok(Math.abs(actual.tilt-(-30+100*y))<1e-7);
  }
  assert.ok(angles.every(a=>Math.abs(a.tilt-angles[0].tilt)<1e-7),'shared tilt despite different receiving surfaces');
 }
});


test('designed motion reaches side and rear walls and unrelated quiet zones do not redirect it',()=>{
 const plan=newRoomPlan(12,12,5),layout=roomPlanLayout(plan);
 const source={...light,motionFormation:'designed',position:{x:0,y:6,height:2.5}};
 const sides=new Set();
 for(const x of [0,.1,.3,.5,.7,.9,1]){
  const value=roomSurfaceChoreography({...source,motionUV:{x,y:.3}},layout);
  sides.add(value.wallIndex);
  if(x===0||x===1)assert.ok(value.target.y>source.position.y,'outer angles reach behind mounting line');
 }
 assert.ok(sides.size>=3,'front and both side walls participate');
 const clear={...source,motionUV:{x:.5,y:.55}};
 const before=roomSurfaceChoreography(clear,layout);
 plan.zones=[{x:0,y:.8,width:.1,depth:.1}];
 const after=roomSurfaceChoreography(clear,layout);
 assert.deepEqual(after.target,before.target);
 assert.equal(after.power,before.power);
});
