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
