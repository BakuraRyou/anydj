import {validTransitionPoints} from './transition-audio.js';
export function copySetTransition(value){
 if(!value||typeof value.fromEntryId!=='string'||typeof value.fromTrackId!=='string'||typeof value.toTrackId!=='string')return null;
 const {plan}=value;
 if(!plan||![plan.time,plan.cue,plan.duration,value.fromDuration,value.toDuration].every(Number.isFinite)||plan.time<0||plan.cue<0||plan.duration<.1||plan.duration>60||!['smooth','bass','handover','cut'].includes(plan.style)||plan.time+plan.duration>value.fromDuration+.001||plan.cue+plan.duration>value.toDuration+.001||plan.points!=null&&!validTransitionPoints(plan.points))return null;
 return {fromEntryId:value.fromEntryId,fromTrackId:value.fromTrackId,toTrackId:value.toTrackId,fromDuration:value.fromDuration,toDuration:value.toDuration,
  plan:{time:plan.time,cue:plan.cue,duration:plan.duration,style:plan.style,points:plan.points?structuredClone(plan.points):null,kind:'time',manual:true,audioProfile:null,label:'Gespeicherter Set-Übergang',reason:'In der festen Setliste vorbereitet.'}};
}
export function matchingSetTransition(entry,previous,from,to,rateA=1,rateB=1){
 const saved=copySetTransition(entry?.transition);
 if(!saved||!previous||saved.fromEntryId!==(previous.sourceEntryId||previous.id)||saved.fromTrackId!==previous.trackId||saved.toTrackId!==entry.trackId||Math.abs(saved.fromDuration-from.duration)>.01||Math.abs(saved.toDuration-to.duration)>.01)return null;
 if(saved.plan.time+saved.plan.duration*rateA>from.duration+.001||saved.plan.cue+saved.plan.duration*rateB>to.duration+.001)return null;
 return saved.plan;
}
