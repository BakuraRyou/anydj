import test from 'node:test';
import assert from 'node:assert/strict';
import {largeClubRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan,createRoomPreview,newRoomPlan} from '../public/dmx-ar-model.js';
const source=(x=.5,y=.5,focus=0)=>({layout:{width:8,depth:6,positions:{}},crowd:[],lights:Array.from({length:8},(_,i)=>({id:'head-'+i,type:'moving',position:{x:-3.5+i,y:2,height:3},target:{x:0,y:3},motionUV:{x,y},motionFormation:'designed',motionPresentation:'show',motionFocus:focus,power:.8,color:'#00cccc'}))});
const heads=scene=>scene.lights.filter(l=>l.type==='moving');
const span=(lights,k)=>Math.max(...lights.map(l=>l.target[k]))-Math.min(...lights.map(l=>l.target[k]));
test('large club spreads a shared gesture over all six mounting rows and both sides',()=>{
 const scene=source(),saved=structuredClone(scene),lights=heads(applyRoomPlan(scene,largeClubRoom()));
 assert.equal(lights.length,72);assert.ok(span(lights,'y')>18);assert.ok(span(lights,'x')>5);
 assert.equal(new Set(lights.map(l=>l.target.y.toFixed(5))).size,6);
 for(const l of lights){const partner=lights.find(p=>p.position.y===l.position.y&&p.position.x===-l.position.x);assert.ok(Math.abs(l.target.x+partner.target.x)<1e-8);assert.equal(l.power,.8);assert.equal(l.color,'#00cccc');}
 assert.deepEqual(scene,saved);
});
test('an explicit focus still converges and blends continuously from distributed targets',()=>{
 const plan=largeClubRoom(),spread=heads(applyRoomPlan(source(),plan)),half=heads(applyRoomPlan(source(.5,.5,.5),plan)),focus=heads(applyRoomPlan(source(.5,.5,1),plan));
 assert.ok(span(focus,'x')<1e-8&&span(focus,'y')<1e-8);
 assert.ok(Math.abs(span(half,'y')-span(spread,'y')*.5)<1e-8);
 const small=heads(applyRoomPlan(source(.5001,.5001),plan));
 spread.forEach((l,i)=>assert.ok(Math.hypot(l.target.x-small[i].target.x,l.target.y-small[i].target.y)<.01));
});
test('prediction uses the same regional mapping as the future frame',()=>{
 const plan=largeClubRoom(),current=source();
 current.lights.forEach(l=>l.motionAhead={seconds:.2,target:{x:1,y:4},motionUV:{x:.6,y:.7},motionFocus:0});
 const mapped=heads(applyRoomPlan(current,plan)),future=heads(applyRoomPlan(source(.6,.7),plan));
 mapped.forEach((l,i)=>assert.deepEqual(l.motionAhead.target,future[i].target));
});
test('room routing and motors retain distributed targets instead of pulling them back to center',()=>{
 const plan=largeClubRoom(),preview=createRoomPreview();let result;
 for(let i=0;i<90;i++)result=preview(source(),plan,false,i/60);
 const lights=heads(result);assert.ok(span(lights,'y')>12);assert.ok(span(lights,'x')>3);
});
test('small single-row rooms keep their authored shared focus',()=>{
 const plan=newRoomPlan(8,6,3),template=Object.values(largeClubRoom().positions).find(p=>p.type==='moving');
 for(let i=0;i<8;i++)plan.positions['head-'+i]={...template,x:-3.5+i,y:4,motionArea:{x:0,y:0,width:1,depth:1}};
 const lights=heads(applyRoomPlan(source(),plan));assert.ok(span(lights,'x')<1e-8&&span(lights,'y')<1e-8);
});
test('show reserves spatial rows for the climax and preserves blackout, shutter and manual control',()=>{
 const scene=source(),room=largeClubRoom();
 function render(rowFraction,selection=0,extra={}){
  const presence={mask:'show-score',level:1,spread:1,occupancy:1,rowFraction,rowSelection:selection};
  return heads(applyRoomPlan({...scene,lights:scene.lights.map(l=>({...l,movingPresence:presence,movingPresenceBasePower:.8,...extra}))},room));
 }
 const partial=render(.5),full=render(1),next=render(.5,3);
 assert.equal(partial.filter(l=>l.power>0).length,36);
 assert.equal(new Set(partial.filter(l=>l.power>0).map(l=>l.position.y)).size,3);
 assert.equal(full.filter(l=>l.power>0).length,72);
 assert.ok(partial.every((l,i)=>(l.power>0)!==(next[i].power>0)));
 for(const l of partial){
  const partner=partial.find(p=>p.position.y===l.position.y&&p.position.x===-l.position.x);
  assert.equal(l.power,partner.power);
 }
 assert.ok(render(1,0,{movingPresenceBasePower:0}).every(l=>l.power===0));
 assert.ok(render(1,0,{movingShutter:0}).every(l=>l.power===0));
 assert.ok(render(.5,0,{movingPresence:{mask:'all',level:1}}).every(l=>l.power===.8));
 const mixed=render(.5,0,{movingPresence:{layers:[{mask:'show-score',level:1,occupancy:1,rowFraction:.5,rowSelection:0,weight:.5},{mask:'show-score',level:1,occupancy:1,rowFraction:.5,rowSelection:3,weight:.5}]}});
 assert.ok(mixed.every(l=>l.power===.4),'deck blends retain independent row selections');
 assert.deepEqual(render(.5),partial,'seeking does not depend on previous frames');
});
