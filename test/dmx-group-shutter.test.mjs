import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCueExposure} from '../public/dmx-moving-cues.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
test('only explicitly eligible source transfers can keep a room group lit',()=>{
 const cues=[{time:0},{time:10,travel:1,darkTravel:true,groupTravel:true}];
 for(const time of [8.9,9.5,10.1]){
  assert.ok(movingCueExposure(cues,time).level<1);
  assert.equal(movingCueExposure(cues,time,{groupMotion:true}).level,1);
 }
 const ordinary=[{time:0},{time:10,travel:1,darkTravel:true}];
 assert.equal(movingCueExposure(ordinary,9.5,{groupMotion:true}).level,0);
});
test('room exposure replacement requires actual group geometry and preserves blackouts',()=>{
 const room=newRoomPlan(8,6,4);
 const lights=Array.from({length:4},(_,i)=>{const position={x:i-1.5,y:3,height:3};room.positions['h'+i]={...position,type:'moving',rotation:0};return {id:'h'+i,type:'moving',position,target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'auto',movingShutter:0,movingGroupShutter:1,movingPresenceBasePower:1,power:0,movingPresence:{level:1,mask:'all',rowFraction:1,groupMotion:{composition:'parallel-sweep',progress:.5,phase:1,amount:1,intent:{symmetry:'paired'}}}};});
 const render=change=>applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:lights.map(l=>({...l,...change(l)}))},room).lights;
 assert.ok(render(()=>({})).some(l=>l.power>0));
 for(const changes of [()=>({movingPresenceBasePower:0}),()=>({movingGroupShutter:undefined}),()=>({motionRange:0}),()=>({motionPresentation:'show'}),l=>({movingPresence:{...l.movingPresence,groupMotion:null}}),l=>({movingPresence:{...l.movingPresence,level:0}})]){
  assert.ok(render(changes).every(l=>l.power===0));
 }
 const partial=render(()=>({motionRange:.5}));assert.ok(partial.every(l=>l.movingShutter===.5));
});
