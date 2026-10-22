import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage} from '../public/dmx-auto.js';
import {strobeComposition} from '../public/dmx-strobe-score.js';
import {strobeSpaceTarget} from '../public/dmx-strobe-space.js';
import {applyRoomPlan,newRoomPlan,roomPlanLayout,roomSurfaceChoreography} from '../public/dmx-ar-model.js';

const palette=[[255,30,0],[0,80,255],[0,255,30],[255,0,200]];
const music=position=>({role:'groove',tone:.5,energy:.8,active:[],transfer:{lead:{position,enabled:true},solo:{position,enabled:true}}});
const figure=(form,position)=>({form,kind:'groove',energy:.8,motifId:'exchange',music:music(position),presentation:'strobe'});
test('Strobo honors color ceilings and custom palettes across fixture counts and crossfades',()=>{
 for(const units of [1,2,4,7,16])for(const count of [1,2,3,4]){
  const equipment={devices:Array.from({length:units},(_,i)=>({id:String(i),type:'moving',cells:1}))};
  const source={frame:{state:true,r:255,g:30,b:0,dimming:75},weight:1,look:'peak',beat:1,palette};
  for(const sources of [[source],[{...source,weight:.4},{...source,weight:.6}]]){
   const result=automaticStage(sources,count,equipment,'strobe');
   assert.equal(result.palette.length,Math.min(count,units));
   const used=new Set(result.frames.flat().map(f=>[f.r,f.g,f.b].join(',')));
   assert.ok(used.size>=1&&used.size<=Math.min(count,units),'a coherent plane may use fewer colors than the ceiling');
   assert.ok(result.frames.flat().every(f=>result.palette.some(rgb=>rgb.every((v,k)=>v===[f.r,f.g,f.b][k]))));
   assert.ok(result.palette.every(rgb=>palette.some(p=>p.every((v,k)=>v===rgb[k]))));
   assert.equal(result.strobeColor,undefined,'no downstream forced contrast or white');
  }
 }
});
test('musical runs retain light, obey the flicker percentage and remain smooth on small rigs',()=>{
 for(const count of [1,2,4,7,32]){
  let previous;
  for(let i=0;i<=300;i++){
   const f=figure(2,i/100),values=Array.from({length:count},(_,rank)=>strobeComposition(f,rank,count));
   assert.ok(values.every(c=>c.level>=.12&&c.level<=1));
   if(previous)assert.ok(values.every((c,k)=>Math.abs(c.level-previous[k].level)<.02));
   for(const flicker of [0,1,25,50,100])for(let rank=0;rank<count;rank++){
    const limited=strobeComposition({...f,flicker},rank,count);
    assert.ok(Math.abs(limited.level-(1-flicker/100+values[rank].level*flicker/100))<1e-9);
   }
   previous=values;
  }
 }
 assert.notDeepEqual(strobeComposition(figure(2,0),0,4),strobeComposition(figure(2,3),0,4));
});
test('expanding virtual heads into room rows cannot invent colors beyond the configured palette',()=>{
 const plan=newRoomPlan(10,10,4);
 const lights=Array.from({length:12},(_,i)=>{
  const position={x:i%4-1.5,y:2+Math.floor(i/4)*2,height:3,rotation:0,type:'moving',group:'row'+Math.floor(i/4)};
  plan.positions['h'+i]=position;
  return {id:'h'+i,type:'moving',position,target:{x:0,y:1},motionUV:{x:.5,y:.5},motionPresentation:'strobe',
   strobeColor:[255,255,255],color:'rgb(255,255,255)',power:1,movingPresenceBasePower:1,
   movingPresence:{level:1,mask:'all',groupMotion:figure(3,1)}};
 });
 for(const count of [1,2,3,4]){
  const selected=palette.slice(0,count),scene={layout:{width:10,depth:10,positions:{}},lights:lights.map(l=>({...l,strobePalette:selected}))};
  const colors=applyRoomPlan(scene,plan).lights.map(l=>l.color);
  assert.equal(new Set(colors).size,count);
  assert.ok(colors.every(c=>selected.some(rgb=>c===`rgb(${rgb.join(',')})`)));
 }
});
test('parallel beams share directions and opposing beams intersect inside the room',()=>{
 const plan=newRoomPlan(10,10,4);
 plan.positions.a={type:'moving',x:-1,y:8,height:3};
 plan.positions.b={type:'moving',x:1,y:8,height:3};
 const layout=roomPlanLayout(plan);
 const light=(id,uv)=>({id,type:'moving',position:layout.positions[id],motionUV:uv,motionPresentation:'strobe',target:{x:0,y:0},power:1});
 const direction=l=>{const t=strobeSpaceTarget(l,layout);return [t.x-l.position.x,t.y-l.position.y,t.z-l.position.height];};
 const parallel=strobeComposition(figure(3,2),0,2);
 const other=strobeComposition(figure(3,2),1,2);
 assert.equal(parallel.x,other.x);assert.equal(parallel.y,other.y);
 direction(light('a',parallel)).forEach((v,k)=>assert.ok(Math.abs(v-direction(light('b',parallel))[k])<1e-9));
 const a=light('a',{x:.8,y:.1}),b=light('b',{x:.2,y:.1}),da=direction(a),db=direction(b);
 const t=2/(da[0]-db[0]);
 assert.ok(t>0&&t<1);
 assert.ok(Math.abs(a.position.x+t*da[0]-(b.position.x+t*db[0]))<1e-9);
 assert.ok(a.position.height+t*da[2]>0,'crossing is above the floor');
 for(const l of [a,b])assert.equal(roomSurfaceChoreography(l,layout).power,1);
});
