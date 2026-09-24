import test from 'node:test';
import assert from 'node:assert/strict';
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
   assert.ok(Number.isFinite(next.power));samples.push(next);velocity=v;p=next.target;
  }return samples;
 };
 const samples=run();assert.deepEqual(samples,run());assert.ok(samples.some(s=>Math.abs(s.target.y-5)>1.25),'route must go around, not only smooth a crossing');
});
test('unavoidable crossings fade gently without snapping or losing original intensity',()=>{
 const motion=createZoneMotion(),covered={zones:[{x:0,y:0,width:1,depth:1}]};let prev=1;
 for(let i=0;i<100;i++){const out=motion.update([light({x:0,y:5})],layout,covered,i*.02)[0];assert.ok(Math.abs(out.power-prev)<.16);prev=out.power;}
 assert.ok(prev<.1);
});
test('without zones choreography is untouched and fixed fixtures are never rerouted',()=>{
 const motion=createZoneMotion(),fixed={...light({x:0,y:5}),type:'spot'},moving=light({x:1,y:3});
 assert.deepEqual(motion.update([fixed,moving],layout,{zones:[]},0),[fixed,moving]);
 assert.deepEqual(motion.update([fixed],layout,settings,1),[fixed]);
});
