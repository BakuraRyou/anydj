// Offline per-head trace, no lamp commands. Uses the preset room and generated
// colors/exposure; saved UI overrides, render frames and GPU timing are not replayed.
// node scripts/review-lightshow-quality.mjs prepared-plan.json trace.json start end [profile=show]
// Samples the whole interval at 15 Hz; detailed moving-head snapshots every 2 s.
// Static devices reuse four representative source roles, not saved UI equipment.
import {readFileSync,writeFileSync} from 'node:fs';
import {applyShowProfile,movingMoodForProfile} from '../public/dj-show-profile.js';
import {showFrameAt} from '../public/show-plan.js';
import {showScoreAt} from '../public/show-score.js';
import {automaticStage} from '../public/dmx-auto.js';
import {encodeStage,decodeStage} from '../public/dmx-model.js';
import {movingCues,movingCueAt,movingCueExposure} from '../public/dmx-moving-cues.js';
import {activityAt,movingPresenceAt} from '../public/dmx-activity.js';
import {projectMovingHeads,movingDevicePoses} from '../public/dmx-layout-model.js';
import {applyRoomPlan,createRoomPreview} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
const [input,output,startArg='36',endArg='45',profile='show']=process.argv.slice(2),start=Number(startArg),end=Number(endArg);
if(!input||!output||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Expected plan.json trace.json start end');
const saved=JSON.parse(readFileSync(input));
const original=saved.format==='anydj-light-review'?saved.plan:saved;
if(original.showProfile&&original.showProfile!==profile)throw Error('Export profile differs; use the matching profile or an unprofiled base plan.');
const plan=original.showProfile===profile?original:applyShowProfile(original,profile),mood=movingMoodForProfile(profile);
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
for(let tick=0;tick<=Math.floor(end*15);tick++){
 const time=tick/15,frame=showFrameAt(plan,time),section=plan.sections?.find(s=>time>=s.start&&time<s.end);
 const source={movingPlan:plan,movingMood:mood,songTime:time,frame,weight:1,look:section?.look,sectionProgress:section?(time-section.start)/(section.end-section.start):0};
 const presence=movingPresenceAt({...source,movingMood:mood}),exposure=movingCueExposure(cues,time);
 const colors=decodeStage(encodeStage(automaticStage([source],2,equipment,'auto',{movingSource:true}).frames,equipment),equipment).flatMap(f=>f.cells);
 const lights=projectMovingHeads(layout,movingDevicePoses(movingCueAt(cues,time),devices,{formation:'designed',layout}),devices).map((l,i)=>{
  const rgb=colors[i],power=Math.max(...rgb)/255,color=power?rgb.map(v=>Math.round(v/power)):rgb;
  return {...l,type:'moving',color:`rgb(${color.join(',')})`,power,movingPresenceBasePower:power,movingPresence:presence,movingShutter:exposure.level,movingGroupShutter:profile==='auto'?movingCueExposure(cues,time,{groupMotion:true}).level:undefined,cueTransit:exposure.transfer,motionPresentation:mood==='show'?'show':mood==='balanced'?'auto':undefined};
 });
 const staticFrames=automaticStage([source],2,equipment,'auto').frames.flat();
 const support=staticFrames.map((f,i)=>({id:'support-'+i,type:'spot',position:{x:i-1.5,y:3,height:3},target:{x:i-1.5,y:1},power:f.state===false?0:f.dimming/100*Math.max(f.r,f.g,f.b)/255,color:`rgb(${f.r},${f.g},${f.b})`}));
 const scene={layout,crowd:[],lights:[...lights,...support]},result=preview(scene,room,false,time);
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
 let mirrorError=0;
 for(const l of heads){const pos=room.positions[l.id];if(pos.x>=0||l.power<=.01)continue;const other=heads.find(q=>{const p=room.positions[q.id];return p.x===-pos.x&&p.y===pos.y;});if(other?.power>.01)mirrorError=Math.max(mirrorError,Math.hypot(l.target.x+other.target.x,l.target.y-other.target.y,(l.target.z??0)-(other.target.z??0)));}
 const picture=showScoreAt(plan,time);
 const lit=heads.filter(l=>l.power>.01), allPower=result.lights.filter(l=>['moving','spot','bar'].includes(l.type));
 samples.push({time,mirrorError,lit:lit.length,allLit:allPower.filter(l=>l.power>.01).length,totalPower:allPower.reduce((n,l)=>n+l.power,0),movingPower:lit.reduce((n,l)=>n+l.power,0),meanAngle:lit.reduce((n,l)=>n+l.angleDegrees,0)/Math.max(1,lit.length),maxLitAngle:Math.max(0,...lit.map(l=>l.angleDegrees)),wallHeads:lit.filter(l=>l.target.z>.05).length,sourceDimming:frame.dimming,musicalExposure:activityAt(source,1)[0],presenceLayers:(presence.layers||[presence]).map(p=>({weight:p.weight??1,level:p.level,mask:p.mask,action:p.action,progress:p.progress,occupancy:p.occupancy,rowFraction:p.rowFraction,rowSelection:p.rowSelection})),role:picture?.role,form:picture?.form,mask:presence.mask,action:presence.action,shutter:exposure.level,...(tick%30===0?{heads}: {})});
}
const summary={interval:[start,end],sampleHz:15,heads:samples[0]?.heads.length,relights,maxRelightStep,maxStep,maxAngle,maxRelightAngle,darkTrackingSamples};
writeFileSync(output,JSON.stringify({room:room.name,profile,method:'Offline 15 Hz preset replay with four representative source roles and static support; room targets, zones and motors. No saved UI overrides, source follow filter, prediction, GPU rendering or acoustic listening assessment.',summary,samples}));
console.log(JSON.stringify(summary,null,2));
