import {arrangementMotionAt} from './show-arrangement.js';

// Reuse the show's selected attacks and their existing decay. This is only
// spatial emphasis, never a new pulse or a gate on the source brightness.
export function stageAccentStrength(plan,time){
  if(!plan?.arrangement||!Number.isFinite(time))return 0;
  return Math.max(0,Math.min(1,arrangementMotionAt(plan.arrangement,time)));
}
// A seek-stable, two-second trailing average of the prepared base lighting.
// Older shows without an arrangement use their stored brightness frames.
export function stageWashDimming(plan,time){
  if(!plan?.frames?.length||!Number.isFinite(time))return null;
  const arrangement=plan.arrangement,timing=plan.beatTiming;
  const base=arrangement?.bases?.length&&timing;
  const length=base?arrangement.bases.length:plan.frames.length;
  const value=index=>base?arrangement.bases[index]:plan.frames[index].dimming;
  const step=(base?arrangement.step:plan.step)||.125;
  let sum=0;
  for(let i=0;i<=16;i++){
    const position=Math.min(length-1,Math.max(0,time-i*.125)/step);
    const index=Math.floor(position),fraction=position-index;
    sum+=value(index)*(1-fraction)+value(Math.min(index+1,length-1))*fraction;
  }
  const level=sum/17;
  return Math.max(0,Math.min(timing?.maximum??100,base?timing.minimum+level*(timing.maximum-timing.minimum):level));
}
// Small per-track index derived from the prepared show; no new audio analysis.
export function prepareStageMotifs(plan){
  const first=new Map();
  return (plan.sections||[]).map(section=>{
    const key=section.motif;
    if(key===undefined||key===null||!plan.frames?.length)return null;
    if(!first.has(key)){
      const frame=plan.frames[Math.min(plan.frames.length-1,Math.max(0,Math.floor((section.start+.2)/(plan.step||.125))))];
      if(!frame)return null;
      first.set(key,{r:frame.r,g:frame.g,b:frame.b});
    }
    return {color:first.get(key),start:section.start};
  });
}
export function passageIntensity(look,progress=0){
  if(['held','quiet','break','outro'].includes(look))return .5;
  if(look==='flow')return .85;
  if(look==='lift')return .55+.45*Math.max(0,Math.min(1,progress||0));
  return 1;
}
