// Offline per-head trace, no lamp commands. Uses the preset room and generated
// colors/exposure; saved UI overrides, render frames and GPU timing are not replayed.
// node scripts/review-show-visibility.mjs prepared-plan.json trace.json [start=36] [end=45] [profile=show]
import {readFileSync,writeFileSync} from 'node:fs';
import {applyShowProfile,movingMoodForProfile} from '../public/dj-show-profile.js';
import {showFrameAt} from '../public/show-plan.js';
import {showScoreAt} from '../public/show-score.js';
import {automaticStage} from '../public/dmx-auto.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
import {movingCues,movingCueAt,movingCueExposure} from '../public/dmx-moving-cues.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
import {projectMovingHeads,movingDevicePoses} from '../public/dmx-layout-model.js';
import {applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
const [input,output,startArg='36',endArg='45',profile='show']=process.argv.slice(2),start=Number(startArg),end=Number(endArg);
if(!input||!output||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Expected plan.json trace.json start end');
const plan=applyShowProfile(JSON.parse(readFileSync(input)),profile),mood=movingMoodForProfile(profile);
if(end>plan.duration)throw Error('Interval exceeds song duration');
const room=clubStageRoom(),preview=createRoomPreview(),cues=movingCues(plan,'auto',mood);
const layout={width:8,depth:6,positions:{}},devices=Array.from({length:4},(_,i)=>({id:'h'+i}));
const equipment={devices:devices.map(d=>({...d,type:'spot',cells:1}))};
const samples=[],previous=new Map(),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const angle=(a,b,position)=>{
 const vector=t=>[t.x-position.x,t.y-position.y,(t.z??0)-(position.height??0)];
 const u=vector(a),v=vector(b),length=Math.hypot(...u)*Math.hypot(...v);
 return length?Math.acos(Math.max(-1,Math.min(1,u.reduce((sum,x,i)=>sum+x*v[i],0)/length)))*180/Math.PI:0;
};
let relights=0,maxRelightStep=0,maxStep=0,maxAngle=0,maxRelightAngle=0,darkTrackingSamples=0;
for(let tick=0;tick<=Math.floor(end*30);tick++){
 const time=tick/30,frame=showFrameAt(plan,time),source={movingPlan:plan,songTime:time,frame,weight:1};
 const presence=movingPresenceAt({...source,movingMood:mood}),exposure=movingCueExposure(cues,time);
 const colors=decodeStage(encodeStage(automaticStage([source],2,equipment,'auto',{movingSource:true}).frames,equipment),equipment).flatMap(f=>f.cells);
 const lights=projectMovingHeads(layout,movingDevicePoses(movingCueAt(cues,time),devices,{formation:'designed',layout}),devices).map((l,i)=>{
  const rgb=colors[i],power=Math.max(...rgb)/255;
  return {...l,type:'moving',color:`rgb(${rgb.join(',')})`,power,movingPresenceBasePower:power,movingPresence:presence,movingShutter:exposure.level,cueTransit:exposure.transfer,motionPresentation:mood==='show'?'show':mood==='balanced'?'auto':undefined};
 });
 const scene={layout,crowd:[],lights},result=preview(scene,room,false,time);
 if(time<start)continue;
 const authored=new Map(applyRoomPlan(scene,room).lights.map(l=>[l.id,l]));
 const heads=result.lights.filter(l=>l.type==='moving').map(l=>{
  const last=previous.get(l.id),step=last?distance(last.target,l.target):0,relit=!!last&&last.power<=.001&&l.power>.001;
  const angleDegrees=last?angle(last.target,l.target,l.position):0;
  if(relit){relights++;maxRelightStep=Math.max(maxRelightStep,step);maxRelightAngle=Math.max(maxRelightAngle,angleDegrees);}
  maxStep=Math.max(maxStep,step);maxAngle=Math.max(maxAngle,angleDegrees);
  if(l.power<=.001&&l.movingGroupActive)darkTrackingSamples++;
  previous.set(l.id,l);
  return {id:l.id,power:l.power,sceneLead:l.sceneLead,sceneGain:l.sceneGain,surfaceGain:l.surfaceGain,surfaceOverlap:l.surfaceOverlap,trackMotion:!!l.movingGroupActive,zoneTransit:!!l.zoneTransit,authoredTarget:authored.get(l.id)?.target,target:l.target,step,angleDegrees,relit};
 });
 const picture=showScoreAt(plan,time);
 samples.push({time,role:picture?.role,form:picture?.form,mask:presence.mask,action:presence.action,shutter:exposure.level,heads});
}
const summary={interval:[start,end],sampleHz:30,heads:samples[0]?.heads.length,relights,maxRelightStep,maxStep,maxAngle,maxRelightAngle,darkTrackingSamples};
writeFileSync(output,JSON.stringify({room:room.name,profile,method:'Offline preset replay; source colors and shutters, room targets, zones and motors. No saved UI overrides, source follow filter, prediction or GPU rendering.',summary,samples}));
console.log(JSON.stringify(summary,null,2));
