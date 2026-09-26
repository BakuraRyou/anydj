import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRoomPlan,createRoomPreview,newRoomPlan} from '../public/dmx-ar-model.js';
function rig(count,time=0){
 const plan=newRoomPlan(8,8,3);
 // Deliberately insert right-to-left, as can happen through drag/drop or import.
 for(let i=count-1;i>=0;i--)plan.positions['room-'+i]={type:'moving',x:count===1?0:-3+6*i/(count-1),y:6,height:1.8,rotation:0,size:{width:.34,depth:.34,height:.4}};
 const pose=(i,t)=>({x:.5+[-.3,-.12,.12,.3][i]*Math.cos(t),y:.4+.08*Math.sin(t)});
 const lights=Array.from({length:4},(_,i)=>({id:'source-'+i,type:'moving',position:{x:-3+2*i,y:6,height:1.8},motionUV:pose(i,time),target:{x:(pose(i,time).x-.5)*7.2,y:(.1+.65*pose(i,time).y)*8},power:(i+1)/4,color:'#ffffff',motionAhead:{seconds:.12,motionUV:pose(i,time+.12),target:{x:(pose(i,time+.12).x-.5)*7.2,y:(.1+.65*pose(i,time+.12).y)*8}}}));
 return {plan,scene:{layout:{width:8,depth:8},lights}};
}
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label+': '+a+' / '+b);
test('room motion spans the physical rig once, including future samples',()=>{
 for(const count of [2,4,5,6,9,12]){
  const {plan,scene}=rig(count,.8),result=applyRoomPlan(scene,plan).lights.sort((a,b)=>a.position.x-b.position.x);
  for(let i=0;i<count;i++){
   const left=result[i],right=result[count-1-i];
   close(left.motionUV.x+right.motionUV.x,1,'mirrored current pan');
   close(left.motionUV.y,right.motionUV.y,'shared current phase');
   close(left.motionAhead.motionUV.x+right.motionAhead.motionUV.x,1,'mirrored future pan');
   close(left.motionAhead.motionUV.y,right.motionAhead.motionUV.y,'shared future phase');
   if(i)assert.ok(result[i-1].motionUV.x<=left.motionUV.x,'no repeated four-device cycle');
  }
 }
});
test('rendered light cones keep paired timing after room projection and motor smoothing',()=>{
 for(const count of [4,6,9]){
  const {plan}=rig(count),render=createRoomPreview();
  for(let frame=0;frame<360;frame++){
   const time=frame/60,{scene}=rig(count,time);
   const lights=render(scene,plan,false,time).lights.sort((a,b)=>a.position.x-b.position.x);
   for(let i=0;i<Math.floor(count/2);i++){
    const a=lights[i],b=lights[count-1-i];
    close(a.target.x,-b.target.x,'rendered mirrored x');
    close(a.target.y,b.target.y,'rendered shared y');
    close(a.target.z,b.target.z,'rendered shared z');
   }
  }
 }
});
test('motion redistribution preserves fixture colors, brightness and authored non-mirrored gestures',()=>{
 const {plan,scene}=rig(6);
 scene.lights.forEach((light,i)=>{light.motionUV={x:.15+i*.17,y:.2+i*.12};delete light.motionAhead;light.color=['#ff0000','#00ff00','#0000ff','#ffffff'][i];});
 const result=applyRoomPlan(scene,plan).lights;
 // Virtual-room light assignment remains unchanged, even when motion roles differ.
 Object.keys(plan.positions).forEach((id,i)=>{
  const light=result.find(l=>l.id===id),source=scene.lights[i%4];
  assert.equal(light.power,source.power);assert.equal(light.color,source.color);
 });
 const sorted=result.sort((a,b)=>a.position.x-b.position.x);
 close(sorted[0].motionUV.y,.2,'authored first phase');
 close(sorted.at(-1).motionUV.y,.56,'authored last phase');
 assert.ok(sorted[0].motionUV.y!==sorted.at(-1).motionUV.y,'intentional stagger is retained');
});
test('seven and larger odd rigs keep the center on the symmetry axis through ceiling crossings',()=>{
 for(const count of [7,15,31])for(const protectedRoom of [false,true]){
  const plan=newRoomPlan(8,12,4);
  for(let i=0;i<count;i++)plan.positions['fixture-'+i]={type:'moving',x:-3+6*i/(count-1),y:10,height:2.5,rotation:0,size:{width:.34,depth:.34,height:.4}};
  if(protectedRoom)plan.zones=[{id:'quiet',name:'Ruhezone',x:.4,y:.3,width:.2,depth:.2}];
  const render=createRoomPreview();
  for(let frame=0;frame<600;frame++){
   const time=frame/30,pose=(i,t)=>({x:.5+[-.4,-.15,.15,.4][i]*Math.cos(t*.7),y:.5+.49*Math.sin(t*.3)});
   const scene={layout:{width:8,depth:12},lights:Array.from({length:4},(_,i)=>({id:'source-'+i,type:'moving',position:{x:-3+2*i,y:10,height:2.5},target:{x:0,y:2},motionUV:pose(i,time),motionAhead:{seconds:.12,target:{x:0,y:2},motionUV:pose(i,time+.12)},power:1,color:'#ffffff'}))};
   const lights=render(scene,plan,false,time).lights.sort((a,b)=>a.position.x-b.position.x);
   close(lights[Math.floor(count/2)].target.x,0,'center stays on axis: '+count+' heads, frame '+frame);
   for(let i=0;i<Math.floor(count/2);i++){
    const left=lights[i],right=lights[count-1-i];
    close(left.target.x,-right.target.x,'paired x '+count+' '+protectedRoom+' '+frame);
    close(left.target.y,right.target.y,'paired y '+count+' '+protectedRoom+' '+frame);
    close(left.target.z,right.target.z,'paired height '+count+' '+protectedRoom+' '+frame);
   }
  }
 }
});

test('symmetric zone detours preserve independently lit partners of dark fixtures',()=>{
 const {plan,scene}=rig(7);
 plan.zones=[{id:'left',x:0,y:0,width:.04,depth:.04},{id:'right',x:.96,y:0,width:.04,depth:.04}];
 scene.lights.forEach((light,i)=>{light.power=i===2?0:.8;light.color=['#ff0000','#00ff00','#0000ff','#ffffff'][i];});
 const authored=applyRoomPlan(scene,plan).lights;
 const result=createRoomPreview()(scene,plan,false,0).lights;
 for(const light of result){
  const source=authored.find(l=>l.id===light.id);
  close(light.power,source.power,'individual brightness of '+light.id);
  assert.equal(light.color,source.color);
 }
});

test('seven-head automatic formation stays ordered through changing musical roles',async()=>{
 const {movingDevicePoses,projectMovingHeads}=await import('../public/dmx-layout-model.js');
 const {groovePose}=await import('../public/dmx-moving-direction.js');
 const {roomSurfaceChoreography}=await import('../public/dmx-ar-model.js');
 const devices=Array.from({length:7},(_,i)=>({id:'head-'+i,group:i%3})).reverse();
 const {plan}=rig(7);
 const layout={width:8,depth:8,positions:Object.fromEntries(devices.map(d=>[d.id,{x:-3+Number(d.id.slice(5)),y:6,height:1.8}]))};
 for(const formation of ['mirror','pairs','ribbon','diagonal'])for(const shape of ['arc','cross','pulse','sweep','fan']){
  for(let step=0;step<65;step++){
   const poses=groovePose(step/4,{energy:.8,strength:.9,percussion:.9,vocals:.1,formation,shape,progress:step/64});
   const mapped=movingDevicePoses(poses,devices,{formation:'coherent',layout});
   const projected=projectMovingHeads(layout,mapped,devices).map(l=>({...l,type:'moving',power:1}));
   const room=applyRoomPlan({layout,lights:projected},plan);
   const heads=room.lights.sort((a,b)=>a.position.x-b.position.x);
   const spacing=heads[1].motionUV.x-heads[0].motionUV.x;
   for(let i=0;i<heads.length;i++){
    close(heads[i].motionUV.y,heads[0].motionUV.y,'shared vertical musical phase');
    if(i)close(heads[i].motionUV.x-heads[i-1].motionUV.x,spacing,'ordered fan without alternating crossings');
    assert.equal(heads[i].motionFormation,'coherent');
    const aim=roomSurfaceChoreography(heads[i],room.layout);
    assert.ok(aim.target.y<heads[i].position.y,'all heads retain their forward bearing');
   }
  }
 }
});

test('coordinated heads keep facing forward as depth passes their mounting line',async()=>{
 const {roomSurfaceChoreography,roomPlanLayout}=await import('../public/dmx-ar-model.js');
 const {plan}=rig(7),layout=roomPlanLayout(plan);
 for(const [id,position] of Object.entries(plan.positions))for(const y of [.72,.74,.75,.76,.78,.85,.95]){
  const light={id,type:'moving',motionFormation:'coherent',position,modelSize:position.size,power:1,target:{x:position.x*.7,y:y*8},motionUV:{x:.5+position.x*.7/8,y}};
  const result=roomSurfaceChoreography(light,layout);
  assert.ok(result.target.y<position.y,`no rearward flip for ${id} at ${y}`);
 }
});
