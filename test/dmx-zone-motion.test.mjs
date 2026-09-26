import test from 'node:test';
import assert from 'node:assert/strict';
import {motionClearance} from '../public/dmx-light-geometry.js';
import {createZoneMotion,zoneObstacles,zoneRoute,blockedSegment} from '../public/dmx-zone-motion.js';
const layout={width:10,depth:10},settings={zones:[{x:.4,y:.4,width:.2,depth:.2}]};
const light=target=>({id:'head-1',type:'moving',target,power:1});
test('routes cross-room travel around zones and all segments avoid padded areas',()=>{
 const boxes=zoneObstacles(layout,settings.zones),start={x:-3,y:5},end={x:3,y:5},route=zoneRoute(start,end,layout,boxes);
 assert.ok(route.length>=3);let previous=start;for(const point of route){assert.equal(blockedSegment(previous,point,boxes),false);previous=point;}assert.deepEqual(route.at(-1),end);
});
test('route planning handles overlapping obstacles and a fully covered floor',()=>{
 const boxes=zoneObstacles(layout,[...settings.zones,{x:.5,y:.5,width:.2,depth:.2}]);
 const start={x:-4,y:5},route=zoneRoute(start,{x:4,y:5},layout,boxes);assert.ok(route);
 let p=start;for(const next of route){assert.equal(blockedSegment(p,next,boxes),false);p=next;}
 assert.equal(zoneRoute(start,{x:4,y:5},layout,zoneObstacles(layout,[{x:0,y:0,width:1,depth:1}])),null);
});
test('detours remain continuous at zone edges, target reversals and song seeks',()=>{
 const run=()=>{
  const motion=createZoneMotion(),samples=[];let p={x:-3,y:5};motion.update([light(p)],layout,settings,0);let velocity={x:0,y:0};
  for(let i=1;i<=1200;i++){
   const t=i*.02,target=t<10?{x:-3+Math.min(6,t*.8),y:5}:t<16?{x:-3,y:7}:{x:3,y:3};
   const next=motion.update([light(target)],layout,settings,t)[0];
   const v={x:(next.target.x-p.x)/.02,y:(next.target.y-p.y)/.02};
   assert.ok(Math.hypot(v.x,v.y)<=2.00001);assert.ok(Math.hypot(v.x-velocity.x,v.y-velocity.y)<=2.5*.02+1e-6);
   assert.equal(blockedSegment(p,next.target,zoneObstacles(layout,settings.zones)),false,'every rendered movement segment avoids the zone');
   assert.ok(Number.isFinite(next.power));samples.push(next);velocity=v;p=next.target;
  }return samples;
 };
 const samples=run();assert.deepEqual(samples,run());assert.ok(samples.some(s=>Math.abs(s.target.y-5)>1.25),'route must go around, not only smooth a crossing');
});
test('a fully covered floor is off from the first frame and never moves',()=>{
 const motion=createZoneMotion(),covered={zones:[{x:0,y:0,width:1,depth:1}]};
 for(let i=0;i<100;i++){const out=motion.update([light({x:Math.sin(i)*3,y:5})],layout,covered,i*.02)[0];assert.equal(out.power,0);assert.deepEqual(out.target,{x:0,y:5});}
});
test('without zones choreography is untouched and fixed fixtures are never rerouted',()=>{
 const motion=createZoneMotion(),fixed={...light({x:0,y:5}),type:'spot'},moving=light({x:1,y:3});
 assert.deepEqual(motion.update([fixed,moving],layout,{zones:[]},0),[fixed,moving]);
 assert.deepEqual(motion.update([fixed],layout,settings,1),[fixed]);
});

test('detours in a concave room never cross the missing corner',()=>{
 const boundary=[[-4,0],[4,0],[4,3],[0,3],[0,6],[-4,6]],room={width:8,depth:6,roomPlan:{boundary}};
 const start={x:-2,y:5},end={x:2,y:2};
 // The visibility graph follows the inside corner instead of declaring the floor disconnected.
 const route=zoneRoute(start,end,room,[]);assert.ok(route.length>=2);assert.deepEqual(route.at(-1),end);
 const motion=createZoneMotion(),zones={zones:[{x:.1,y:.1,width:.1,depth:.1}]};
 motion.update([light(start)],room,zones,0);
 for(let i=1;i<200;i++){
  const p=motion.update([light(end)],room,zones,i*.02)[0].target;
  assert.ok(p.x<=0||p.y<=3,'target stays on the L-shaped floor');
 }
});

test('quiet-zone detours remain within a mover-specific allowed area',()=>{
 const motion=createZoneMotion(),layout={width:8,depth:6},settings={zones:[{x:.45,y:.4,width:.1,depth:.2}]},bounds={left:-2,right:2,bottom:1,top:5};
 for(let i=0;i<400;i++){
  const lights=[{id:'area',type:'moving',position:{x:0,y:5,height:3},target:{x:Math.sin(i/80)*1.8,y:3},power:1,color:'#ffffff',motionBounds:bounds}];
  const result=motion.update(lights,layout,settings,i*.02)[0];assert.ok(result.target.x>=bounds.left&&result.target.x<=bounds.right);assert.ok(result.target.y>=bounds.bottom&&result.target.y<=bounds.top);
 }
});

test('an impassable strip permits a delayed, fully dark transfer and fades back in only after exit',()=>{
 const motion=createZoneMotion(),strip={zones:[{x:.45,y:0,width:.1,depth:1}]},boxes=zoneObstacles(layout,strip.zones);
 let previous=motion.update([light({x:-3,y:5})],layout,strip,0)[0],crossed=false,reached=false,firstDim=null;
 for(let i=1;i<=800;i++){
  const out=motion.update([light({x:3,y:5})],layout,strip,i*.02)[0];
  if(out.power<1)firstDim??=i*.02;
  if(blockedSegment(previous.target,out.target,boxes)){crossed=true;assert.equal(previous.power,0);assert.equal(out.power,0);assert.equal(out.zoneTransit,true);}
  assert.ok(Math.hypot(out.target.x-previous.target.x,out.target.y-previous.target.y)<=.04001,'a dark transfer never teleports');
  if(out.target.x>2.5&&out.power===1)reached=true;
  previous=out;
 }
 assert.ok(firstDim>=3);assert.ok(crossed&&reached,'the transfer reaches a free destination and resumes the show');
});
test('new heads start at a free aim rather than moving through their initial zone',()=>{
 const motion=createZoneMotion(),boxes=zoneObstacles(layout,settings.zones);
 const out=motion.update([light({x:0,y:5})],layout,settings,0)[0];
 assert.equal(blockedSegment(out.target,out.target,boxes),false);assert.equal(out.power,1);
});
test('a zone edited over the current aim stops movement and light immediately',()=>{
 const motion=createZoneMotion(),start={x:-3,y:5};motion.update([light(start)],layout,settings,0);
 const edited={zones:[{x:.1,y:.4,width:.2,depth:.2}]};
 for(let i=1;i<100;i++){const out=motion.update([light({x:3,y:5})],layout,edited,i*.02)[0];assert.deepEqual(out.target,start);assert.equal(out.power,0);}
 assert.equal(motion.update([light(start)],layout,settings,2)[0].power,1,'moving the zone away permits the same head to resume');
});
test('clearance includes the rendered footprint and a long frame cannot tunnel through zones',()=>{
 const motion=createZoneMotion(),fixture={...light({x:-4,y:5}),position:{x:0,y:8,height:3}},boxes=zoneObstacles(layout,settings.zones,motionClearance(fixture,layout));
 let previous=motion.update([fixture],layout,settings,0)[0].target,reached=false;
 for(let i=1;i<600;i++){
  const frame=motion.update([{...fixture,target:{x:i<350?4:-4,y:5}}],layout,settings,i*.08)[0];
  assert.equal(blockedSegment(previous,frame.target,boxes),false);assert.equal(frame.power,1);if(frame.target.x>3)reached=true;previous=frame.target;
 }
 assert.ok(reached,'the head reaches the far side along a real detour');
 assert.ok(previous.x<-3,'the head also reaches the return destination');
});

test('adding the first zone to a running show retains the current aim and stops it if covered',()=>{
 const motion=createZoneMotion(),start={x:0,y:5};
 motion.update([light(start)],layout,{zones:[]},0);
 const out=motion.update([light({x:3,y:5})],layout,settings,.02)[0];
 assert.deepEqual(out.target,start);assert.equal(out.power,0);
});

test('choreography inside a quiet zone moves in a free area instead of sticking to its edge',()=>{
 const motion=createZoneMotion(),boxes=zoneObstacles(layout,settings.zones),points=[];
 let previous=motion.update([light({x:-3,y:5})],layout,settings,0)[0];
 for(let i=1;i<=1600;i++){
  const out=motion.update([light({x:.8*Math.sin(i/90),y:5+.8*Math.cos(i/120)})],layout,settings,i*.02)[0];
  assert.equal(blockedSegment(previous.target,out.target,boxes),false);assert.equal(out.power,1);assert.equal(out.zoneTransit,undefined);
  if(i>300)points.push(out.target);previous=out;
 }
 const extent=key=>Math.max(...points.map(p=>p[key]))-Math.min(...points.map(p=>p[key]));
 assert.ok(extent('x')>.4,'motion is not clamped to one x coordinate');assert.ok(extent('y')>1,'depth remains animated');
});
test('a dark transfer is exceptional across the entire rig and other heads keep moving',()=>{
 const motion=createZoneMotion(),strip={zones:[{x:.45,y:0,width:.1,depth:1}]},initial=[light({x:-3,y:4}),{...light({x:-3,y:6}),id:'head-2'}];
 motion.update(initial,layout,strip,0);let transfers=0,active=false;const other=[];
 for(let i=1;i<=1600;i++){
  const out=motion.update(initial.map((l,j)=>({...l,target:{x:3+.7*Math.sin(i/60+j),y:5+3*Math.sin(i/100+j)}})),layout,strip,i*.02);
  const count=out.filter(l=>l.zoneTransit).length;assert.ok(count<=1,'the rig never blacks out for simultaneous relocations');
  if(count&&!active)transfers++;active=!!count;
  if(i>600)other.push(out[1].target);
 }
 assert.equal(transfers,1,'no repeated crossings during the cooldown');
 assert.ok(Math.max(...other.map(p=>p.x))-Math.min(...other.map(p=>p.x))>.3,'waiting heads retain lateral choreography');
 assert.ok(Math.max(...other.map(p=>p.y))-Math.min(...other.map(p=>p.y))>3,'waiting heads use the free floor depth');
});
test('reachable detours never fade out, including routes around the corner of a concave room',()=>{
 const motion=createZoneMotion(),room={width:8,depth:6,roomPlan:{boundary:[[-4,0],[4,0],[4,3],[0,3],[0,6],[-4,6]]}},settings={zones:[{x:.05,y:.05,width:.05,depth:.05}]};
 let out=motion.update([light({x:-2,y:5})],room,settings,0)[0];
 for(let i=1;i<800;i++){out=motion.update([light({x:2,y:2})],room,settings,i*.02)[0];assert.equal(out.power,1);assert.equal(out.zoneTransit,undefined);}
 assert.ok(Math.hypot(out.target.x-2,out.target.y-2)<.1,'the head finishes the real corner detour');
});
