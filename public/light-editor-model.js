import {validateSectionEdits} from './section-lighting.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function isolateLightMoment(edits,time,duration,length=1){
  const index=edits.findIndex(e=>time>=e.start&&time<e.end),source=edits[index];
  const start=clamp(time,0,duration),end=Math.min(duration,start+length,source?.end??duration);
  if(end<=start)throw Error('Wähle eine Position vor dem Songende.');
  const phase={...(source||{name:'Moment',motif:'',rhythm:'auto',movement:1,colors:'auto',colorA:'#ff7700',colorB:'#7400ff'}),id:crypto.randomUUID(),start,end};
  const result=edits.flatMap((e,i)=>i!==index?[e]:[...(e.start<start?[{...e,end:start}]:[]),phase,...(end<e.end?[{...e,id:crypto.randomUUID(),start:end}]:[])]);
  if(index<0){const next=edits.find(e=>e.start>start);phase.end=Math.min(end,next?.start??duration);result.push(phase);result.sort((a,b)=>a.start-b.start);}
  return {edits:validateSectionEdits(result,duration),index:result.indexOf(phase)};
}
export function editPhaseTime(edits,index,kind,value,plan,snap='beat') {
  if(!Number.isFinite(value))throw Error('Bitte eine gültige Zeit eingeben.');
  const result=structuredClone(edits),phase=result[index];
  if(!phase||!['move','start','end'].includes(kind))throw Error('Ungültige Phase.');
  const grid=snap==='bar'?plan.beatGrid?.downbeats:snap==='beat'?(plan.beatGrid?.beats??plan.beatTiming?.times):[];
  if(grid?.length)value=grid.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a);
  const previous=result[index-1],next=result[index+1],duration=phase.end-phase.start;
  const minimum=Math.min(.1,duration);
  if(kind==='move'){
    phase.start=clamp(value,previous?.end??0,(next?.start??plan.duration)-duration);phase.end=phase.start+duration;
  } else if(kind==='start'){
    const shared=previous&&Math.abs(previous.end-phase.start)<1e-6;
    phase.start=clamp(value,shared?previous.start+Math.min(.1,previous.end-previous.start):previous?.end??0,phase.end-minimum);
    if(shared)previous.end=phase.start;
  } else {
    const shared=next&&Math.abs(next.start-phase.end)<1e-6;
    phase.end=clamp(value,phase.start+minimum,shared?next.end-Math.min(.1,next.end-next.start):next?.start??plan.duration);
    if(shared)next.start=phase.end;
  }
  return validateSectionEdits(result,plan.duration);
}
