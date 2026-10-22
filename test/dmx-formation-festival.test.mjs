import test from 'node:test';
import assert from 'node:assert/strict';
import {festivalStageRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
import {blockedSegment,zoneObstacles} from '../public/dmx-zone-motion.js';
import {footprintClearance} from '../public/dmx-light-geometry.js';

function source(time){
 const story={start:0,end:8,arcStart:0,arcEnd:8,motion:'relay',shape:'parallel-lines',act:'introduce',energy:.8,
  musicalEvidence:{movementDrive:.9},variation:{path:'traverse',gesture:'carry',spread:1},knots:[{time:0,position:0},{time:8,position:1}],
  audioFrame:{rows:[0,8].map(time=>({time,energy:.8,tone:.5,pitch:.5,pitchConfidence:0,movementDrive:.9})),
   clock:[{time:0,position:0,velocity:2},{time:8,position:16,velocity:2}],
   beatClock:[{time:0,position:0,velocity:2},{time:8,position:16,velocity:2}],roles:{lead:[],drums:[],bass:[]}}};
 const groupMotion={presentation:'strobe',flicker:53,music:{sequence:{role:'groove',sharedPassage:{},time,age:time,
  formationId:story.shape,formationProgram:{kind:'sweep'},formationStory:story}}};
 return {layout:{width:8,depth:6,positions:{}},crowd:[],lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
  motionPresentation:'strobe',power:1,color:'#fff',movingShutter:1,movingPresenceBasePower:1,
  movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,groupMotion}}]};
}
const movement=(room)=>{
 const preview=createRoomPreview(),previous=new Map();let travel=0;
 for(let i=0;i<180;i++){
  const scene=preview(source(i/30),room,false,i/30);
  for(const l of scene.lights.filter(l=>l.type==='moving')){
   const old=previous.get(l.id);
   if(old&&i>30)travel+=Math.hypot(l.target.x-old.x,l.target.y-old.y,(l.target.z??0)-(old.z??0));
   if(l.power>.05){
    const boxes=zoneObstacles(scene.layout,room.zones,footprintClearance(l));
    assert.equal(blockedSegment(l.target,l.target,boxes),false,'displayed lit targets must respect FOH clearance');
   }
   previous.set(l.id,l.target);
  }
 }
 return travel;
};
test('festival FOH protection preserves visible formation travel on free paths without changing the room',()=>{
 const room=festivalStageRoom(),saved=JSON.stringify(room);
 const withFOH=movement(room),withoutFOH=movement({...room,zones:[]});
 assert.ok(withFOH>withoutFOH*.35,`FOH must not swallow the formation: ${withFOH} / ${withoutFOH}`);
 assert.equal(JSON.stringify(room),saved,'saved positions, motion areas and exclusion zones stay intact');
 assert.equal(applyRoomPlan(source(2),room).lights.filter(l=>l.type==='moving').length,80);
});
