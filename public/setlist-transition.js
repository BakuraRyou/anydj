import {fileIdentity} from './dj-model.js';
import {validTransitionPoints} from './transition-audio.js';
export function copySetTransition(value){
 if(!value||typeof value.fromEntryId!=='string'||typeof value.fromTrackId!=='string'||typeof value.toTrackId!=='string')return null;
 const {plan}=value;const rateA=value.libraryId?value.rateA:1,rateB=value.libraryId?value.rateB:1;
 if(![rateA,rateB].every(r=>Number.isFinite(r)&&r>=.25&&r<=4))return null;
 if(!plan||![plan.time,plan.cue,plan.duration,value.fromDuration,value.toDuration].every(Number.isFinite)||plan.time<0||plan.cue<0||plan.duration<.1||plan.duration>60||!['smooth','bass','handover','cut'].includes(plan.style)||plan.time+plan.duration*rateA>value.fromDuration+.001||plan.cue+plan.duration*rateB>value.toDuration+.001||plan.points!=null&&!validTransitionPoints(plan.points))return null;
 return {...(value.libraryId?{libraryId:value.libraryId,variantName:value.variantName,fromIdentity:value.fromIdentity,toIdentity:value.toIdentity,rateA:value.rateA,rateB:value.rateB}:{}),fromEntryId:value.fromEntryId,fromTrackId:value.fromTrackId,toTrackId:value.toTrackId,fromDuration:value.fromDuration,toDuration:value.toDuration,
  plan:{time:plan.time,cue:plan.cue,duration:plan.duration,style:plan.style,points:plan.points?structuredClone(plan.points):null,kind:'time',manual:true,audioProfile:null,label:value.libraryId?(value.variantName||'Gespeicherter Übergang'):'Gespeicherter Set-Übergang',reason:value.libraryId?'Aus der persönlichen Übergangsbibliothek.':'In der festen Setliste vorbereitet.'}};
}
export function matchingSetTransition(entry,previous,from,to,rateA=1,rateB=1,fromTrack=null,toTrack=null){
 const saved=copySetTransition(entry?.transition);
 if(saved?.libraryId&&(!fromTrack||!toTrack||fromTrack.missing||toTrack.missing||fromTrack.pendingChange||toTrack.pendingChange||saved.fromIdentity!==fileIdentity(fromTrack)||saved.toIdentity!==fileIdentity(toTrack)||rateA!==saved.rateA||rateB!==saved.rateB))return null;
 if(!saved||!previous||saved.fromEntryId!==(previous.sourceEntryId||previous.id)||saved.fromTrackId!==previous.trackId||saved.toTrackId!==entry.trackId||Math.abs(saved.fromDuration-from.duration)>.01||Math.abs(saved.toDuration-to.duration)>.01)return null;
 if(saved.plan.time+saved.plan.duration*rateA>from.duration+.001||saved.plan.cue+saved.plan.duration*rateB>to.duration+.001)return null;
 return saved.plan;
}
