import {fileIdentity} from './dj-model.js';
import {copySetTransition} from './setlist-transition.js';
export function makeTransitionVariant(from,to,plan,{id,name='Übergang',rateA=1,rateB=1}={}){
 if(!from?.plan||!to?.plan)throw Error('Beide Titel zuerst analysieren.');
 id=id||crypto.randomUUID();
 const saved=copySetTransition({libraryId:id,rateA,rateB,fromEntryId:'library',fromTrackId:from.id,toTrackId:to.id,fromDuration:from.plan.duration,toDuration:to.plan.duration,plan});
 if(!saved)throw Error('Ungültiger Übergang oder Zeitpunkte außerhalb der Titel.');
 return {...saved,id:id||crypto.randomUUID(),version:1,name:String(name).trim().slice(0,80)||'Übergang',fromName:from.name,toName:to.name,fromIdentity:fileIdentity(from),toIdentity:fileIdentity(to),rateA,rateB};
}
export function variantProblem(value,from,to,rateA=value?.rateA,rateB=value?.rateB){
 if(!value||value.version!==1||!copySetTransition(value))return 'Übergang ungültig';
 if(!from||!to||from.deleted||to.deleted||from.missing||to.missing)return 'Datei fehlt';
 if(from.pendingChange||to.pendingChange||value.fromTrackId!==from.id||value.toTrackId!==to.id||value.fromIdentity!==fileIdentity(from)||value.toIdentity!==fileIdentity(to))return 'Datei geändert · erneut prüfen';
 if(!from.plan||!to.plan||from.failed||to.failed)return 'Analyse erforderlich';
 if(Math.abs(value.fromDuration-from.plan.duration)>.01||Math.abs(value.toDuration-to.plan.duration)>.01)return 'Titellänge geändert · erneut prüfen';
 if(rateA!==value.rateA||rateB!==value.rateB)return 'Tempo geändert · gespeichertes Tempo erforderlich';
 return '';
}
export function bindVariant(value,previous,from,to){
 const problem=variantProblem(value,from,to);if(problem)throw Error(problem);
 return copySetTransition({...value,fromEntryId:previous.sourceEntryId||previous.id,libraryId:value.id,variantName:value.name});
}
