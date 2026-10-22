import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeSpaceTarget} from '../public/dmx-strobe-space.js';
import {newRoomPlan,roomPlanLayout,roomSurfaceChoreography,wallChoreography} from '../public/dmx-ar-model.js';
import {strobeComposition} from '../public/dmx-strobe-score.js';
const room=()=>{
 const p=newRoomPlan(10,8,4);
 for(let i=0;i<8;i++)p.positions['h'+i]={type:'moving',x:-3.5+i,y:i%2?6:7,height:3.3+(i%2)*.3};
 return roomPlanLayout(p);
};
const light=(layout,i,uv)=>({id:'h'+i,type:'moving',position:layout.positions['h'+i],target:{x:0,y:1},motionUV:uv,motionPresentation:'strobe',motionFormation:'designed',power:.8});
test('different mounting rows and heights retain parallel beam directions',()=>{
 const layout=room(),uv={x:.6,y:.7};
 const a=light(layout,0,uv),b=light(layout,1,uv);
 const direction=l=>{const t=strobeSpaceTarget(l,layout);return [t.x-l.position.x,t.y-l.position.y,t.z-l.position.height];};
 direction(a).forEach((v,i)=>assert.ok(Math.abs(v-direction(b)[i])<1e-8));
 for(const source of [a,b]){
  const point=strobeSpaceTarget(source,layout),mapped=roomSurfaceChoreography(source,layout);
  const t=(point.y-source.position.y)/(mapped.target.y-source.position.y);
  assert.ok(Math.abs(source.position.x+(mapped.target.x-source.position.x)*t-point.x)<1e-8);
  assert.ok(Math.abs(source.position.height+(mapped.target.z-source.position.height)*t-point.z)<1e-8);
  assert.equal(mapped.power,.8);assert.ok(mapped.target.z>=-1e-8);
 }
});
test('fan, crossed pairs and diagonal produce distinct spatial beam directions',()=>{
 const layout=room(),pictures=[];
 for(const form of [0,2,13]){
  const targets=[];
  for(let i=0;i<8;i++){
   const c=strobeComposition({motifId:'exchange',form,kind:'groove',energy:.8,progress:.6},i,8);
   const source=light(layout,i,c),mapped=roomSurfaceChoreography(source,layout);
   assert.ok(mapped.target.z>=-1e-8);targets.push([mapped.target.x,mapped.target.y,mapped.target.z]);
  }
  pictures.push(JSON.stringify(targets));
 }
 assert.equal(new Set(pictures).size,3);
});
test('explicit wall ranges receive the authored Strobo formation above the floor',()=>{
 const layout=room(),config={wall:0,start:.1,end:.9,minHeight:1,maxHeight:3};
 layout.positions.h0.wallTarget=config;
 const c=strobeComposition({motifId:'unfold',form:0,kind:'build',energy:.8,progress:.6},0,8);
 assert.equal(c.wallBlend,1);
 const source={...light(layout,0,c),motionWallBlend:c.wallBlend};
 const mapped=wallChoreography(roomSurfaceChoreography(source,layout),layout.roomPlan);
 assert.ok(mapped.target.z>=1&&mapped.target.z<=3);
});
test('explicit movement areas retain their own routing and other modes are unaffected',()=>{
 const layout=room(),source=light(layout,0,{x:.5,y:.5});
 layout.positions.h0.motionArea={x:0,y:0,width:.5,depth:.5};
 assert.equal(roomSurfaceChoreography(source,layout),source);
 delete layout.positions.h0.motionArea;
 const auto=roomSurfaceChoreography({...source,motionPresentation:'auto'},layout);
 const strobe=roomSurfaceChoreography(source,layout);
 assert.notDeepEqual(auto.target,strobe.target);
 assert.deepEqual(roomSurfaceChoreography({...source,motionPresentation:'auto'},layout),auto);
});
