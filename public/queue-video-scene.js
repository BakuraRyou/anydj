import {automaticStage,STAGE_PRESETS,stageModeForStreams} from './dmx-auto.js';
import {mixFixtureFrames,songFixtureMix} from './dmx-show.js';
import {stagePatch,encodeStage,decodeStage,fixtureKey} from './dmx-model.js';
import {fixturePosition} from './dmx-layout-model.js';
import {createMovingHeads} from './dmx-moving-heads.js';
import {createRoomPreview,roomMusicalAim,respectRoomVolumes,alignRoomFormation} from './dmx-ar-model.js';
import {createZoneMotion} from './dmx-zone-motion.js';
import {zoneLights} from './dmx-zone-plan.js';
import {roomLights} from './dmx-room.js';
import {createRoomMotors} from './dmx-light-geometry.js';
import {mixDeckFrames} from './dj-model.js';
import {createCrowdMotion} from './dmx-stage-3d-renderer.js';

// Isolated preview instances: no live transport, layout editor or DMX writes.
export function createQueueVideoScene({equipment,config,count=2,layout,view,adjustFrame=frame=>frame}){
 const scene=document.createElement('div'),controls=document.createElement('div'),patch=stagePatch(equipment);
 const room=createRoomPreview(),motors=createRoomMotors(),zoneMotion=createZoneMotion(),crowdMotion=createCrowdMotion();let heads=[],activePlans=[];
 const devices=patch.map((f,i)=>({...f,group:config.members[i]})).filter(f=>f.type==='moving');
 const moving=createMovingHeads(scene,controls,{getPlans:()=>activePlans,getLayout:()=>layout,getDevices:()=>devices,getPreviewEnabled:()=>true,onPreview:value=>{heads=value;},adjustFrame,offline:true});
 return {
  camera:view.camera,
  async sample(streams,time,signal){
   signal?.throwIfAborted();const mode=stageModeForStreams(streams,'auto'),frame=mixDeckFrames(streams.map(s=>s.frame),streams.map(s=>s.weight));
   const automatic=Object.hasOwn(STAGE_PRESETS,mode)?automaticStage(streams,count,equipment,mode):null;
   const raw=automatic?automatic.frames:mode==='design'?mixFixtureFrames(streams,config,equipment):frame;
   const output=patch.map((f,i)=>Array.from({length:f.cells},(_,j)=>{
    const value=Array.isArray(raw)?raw[i]?.[j]:raw,edited=songFixtureMix(value,streams,[`patch:${fixtureKey(f)}`,`patch-group:${config.members[i]}`],{group:config.members[i],position:j,units:f.cells});
    const adjusted=adjustFrame(edited);return adjusted?{...adjusted,dimming:(adjusted.dimming??0)*(f.gain??100)/100}:adjusted;
   }));
   const fixtures=decodeStage(encodeStage(output,equipment),equipment);
   fixtures.forEach((f,i)=>{if(f.type==='moving')f.cells=output[i].map(value=>!value||value.state===false?[0,0,0]:['r','g','b'].map(k=>Math.round(Math.max(0,Math.min(255,value[k]||0))*(value.dimming||0)/100)));});
   // Prepare only the currently audible songs, including both sides of a fade.
   // Do not advance the motor state while waiting for a choreography.
   const nextPlans=[...new Set(streams.map(s=>s.movingPlan).filter(Boolean))];
   if(nextPlans.length!==activePlans.length||nextPlans.some((plan,i)=>plan!==activePlans[i])){
    activePlans=nextPlans;moving.prepare();
   }
   moving.prepareStreams(streams,mode);
   while(moving.preparationStatus.ready+moving.preparationStatus.failed<moving.preparationStatus.total){signal?.throwIfAborted();await new Promise(resolve=>setTimeout(resolve,10));}
   if(moving.preparationStatus.failed)throw Error('Die Moving-Head-Choreografie konnte nicht vorbereitet werden.');
   moving.update(fixtures,adjustFrame(frame),time,false,streams,mode,count);
   const counts=new Map(),indices=new Map();for(const f of fixtures)if(f.type!=='moving')counts.set(f.type,(counts.get(f.type)||0)+1);
   const lights=fixtures.filter(f=>f.type!=='moving').flatMap(f=>{
    const index=indices.get(f.type)||0,id=`fixture-${f.id}`;indices.set(f.type,index+1);
    const p=layout.positions[id]||{...fixturePosition(layout,id,index,counts.get(f.type)),y:layout.depth*(f.type==='bar'?.25:.55)};
    return f.cells.map((rgb,i)=>{const power=Math.max(...rgb)/255,color=power?rgb.map(v=>Math.round(v/power)):[0,0,0],x=p.x+(f.type==='bar'?(i-(f.cells.length-1)/2)*.22:0);return {id,type:f.type,position:{...p,x},target:{x,y:layout.depth*.1},color:`rgb(${color.join(',')})`,power};});
   });
   let result={layout:view.layout,lights:[...lights,...heads.map(h=>({...h,type:'moving'}))],streams,crowd:view.crowd,motion:view.animateCrowd?crowdMotion({streams},time):0};
   if(view.roomPlan)return room(result,view.roomPlan,false,time);
   if(view.room.enabled)result.lights=roomLights(result.lights,layout,view.room);
   else if(view.dancerAim)result.lights=result.lights.map(l=>l.type==='moving'?{...l,target:{x:l.target.x,y:-Math.max(4,layout.depth)*(.1+.8*l.target.y/layout.depth)}}:l);
   result.lights=zoneMotion.update(result.lights.map(l=>l.type==='moving'?l:zoneLights([l],view.layout,view.zones)[0]),view.layout,view.zones,time);
   result.lights=alignRoomFormation(result.lights.map(l=>view.dancerAim?l:roomMusicalAim(l,result.layout)),result.layout).map(l=>respectRoomVolumes(motors(l,result.layout,time),result.layout));
   return result;
  },
  destroy(){moving.destroy();motors.reset();zoneMotion.reset();}
 };
}
