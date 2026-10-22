// Offline room/motor replay of an exported song analysis. No lamp commands.
// node scripts/review-strobe-roles.mjs export.json report.json [start=0] [end=duration] [flicker=100]
import {readFileSync,writeFileSync} from 'node:fs';
import {showFrameAt} from '../public/show-plan.js';
import {songPaletteAt} from '../public/song-palette.js';
import {automaticStage} from '../public/dmx-auto.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {createRoomPreview} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
import {stageWashDimming} from '../public/stage-motifs.js';
const [input,output,startValue='0',endValue,flickerValue='100']=process.argv.slice(2);
if(!input||!output)throw Error('Expected export.json report.json [start] [end]');
const saved=JSON.parse(readFileSync(input)),original=saved.plan||saved;
// Retain the exported musical analysis and dimmer/color frames. This evaluates
// the new shutter/geometry routing, not a reanalysis of the original audio.
const plan={...original,showProfile:'strobe',movingMood:'balanced'};
const start=Number(startValue),end=endValue===undefined?plan.duration:Number(endValue);
const flicker=Number(flickerValue);
if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>plan.duration)throw Error('Invalid interval');
if(!Number.isFinite(flicker)||flicker<0||flicker>100)throw Error('Invalid flicker limit');
const room=clubStageRoom(),preview=createRoomPreview();
const layout={width:8,depth:6,positions:{}},equipment={devices:Array.from({length:4},(_,i)=>({id:'h'+i,type:'spot',cells:1}))};
const samples=[],previous=new Map(),decisions=new Map();let litMoving=0,litSamples=0,visibleMoving=0,allLit=0,empty=0;
for(let tick=0;tick<Math.floor(end*30);tick++){
 const time=tick/30,frame=showFrameAt(plan,time,flicker),section=plan.sections?.find(s=>time>=s.start&&time<s.end);
 const source={frame,washDimming:stageWashDimming(plan,time),weight:1,movingPlan:plan,songTime:time,stageMode:'strobe',movingMood:'balanced',flicker,
  look:section?.look,sectionProgress:section?(time-section.start)/(section.end-section.start):0,palette:songPaletteAt(plan,time)};
 const colors=automaticStage([source],2,equipment,'strobe',{movingSource:true});
 const palette=colors.palette.map(rgb=>{const peak=Math.max(...rgb);return rgb.map(v=>peak?Math.round(v*255/peak):0);});
 const presence=movingPresenceAt(source),figure=strobeScoreAt(plan,time);
 const intention=figure?.music?.sequence;
 if(time>=start&&intention&&!decisions.has(intention.index))decisions.set(intention.index,
  {start:intention.start,end:intention.end,pattern:intention.pattern,reason:intention.reason,motion:intention.motion,
   ...(intention.sharedPassage?{sharedComposition:intention.sharedPassage.composition,sharedSequence:intention.sharedPassage.sequence,strobeSentence:intention.strobeSentence}:{}),
   rolePhase:intention.rolePhase,measuredEntrances:intention.entrances.length});
 const lights=colors.frames.map((cells,i)=>{
  const f=cells[0],pose=figure?strobeComposition(figure,i,4):{x:.5,y:.5},power=f.dimming/100*Math.max(f.r,f.g,f.b)/255;
  return {id:'h'+i,type:'moving',position:{x:i-1.5,y:4,height:3},target:{x:0,y:2},motionUV:{x:pose.x,y:pose.y},
   motionPresentation:'strobe',motionFormation:'strobe-roles',movingPresence:presence,movingPresenceBasePower:power,
   strobePalette:palette,color:`rgb(${palette[i%palette.length].join(',')})`,power,movingShutter:1};
 });
 const result=preview({layout,lights,crowd:[]},room,false,time);
 const heads=result.lights.filter(l=>l.type==='moving');let visible=0,travel=0;
 for(const head of heads){
  const before=previous.get(head.id),vector=l=>[l.target.x-l.position.x,l.target.y-l.position.y,(l.target.z??0)-l.position.height];
  let angle=0;
  if(before){const a=vector(before),b=vector(head),n=Math.hypot(...a)*Math.hypot(...b);
   angle=n?Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/n)))*180/Math.PI:0;}
  if(head.power>.01){visible++;if(angle>.15)travel++;}
  previous.set(head.id,head);
 }
 if(time<start)continue;
 litMoving+=visible;litSamples+=heads.length;visibleMoving+=travel;
 if(visible===heads.length)allLit++;if(!visible)empty++;
 samples.push({time,visible,heads:heads.length,visibleMoving:travel,totalPower:heads.reduce((s,l)=>s+l.power,0),
  ...(tick%15===0?{fixtures:heads.map(l=>({id:l.id,power:l.power,color:l.color,target:l.target}))}:{})});
}
const report={method:'Offline 30 Hz replay through physical room roles, routing and motors. Uses the exported analysis and frames; no source prediction, GPU timing, live audio or hardware evaluation.',
 sourceProfile:original.showProfile,title:saved.title,profile:'strobe',flicker,interval:[start,end],
 summary:{samples:samples.length,meanVisibleFraction:litMoving/Math.max(1,litSamples),allLitFrames:allLit,emptyFrames:empty,
  visibleMotionFraction:visibleMoving/Math.max(1,litMoving)},decisions:[...decisions.values()],samples};
writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify(report.summary,null,2));
