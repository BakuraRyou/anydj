import {planTransitionPair} from './musical-transition.js';
import {keptPassageRemaining,transitionCutTracks} from './track-cuts.js';
import {transitionAudioProfile} from './transition-audio.js';

// Prefer the user's region, then expand the search before shortening the overlap.
export function alignTransition(pair){
 const plans=(pair.alignmentTracks||pair.libraryTracks)?.map(track=>track.plan);
 const sources=[pair.from,pair.to],keys=['time','cue'],tracks=transitionCutTracks(pair);
 const available=(i,t)=>keptPassageRemaining(tracks[i],t)/sources[i].rate;
 const grids=plans?.map((plan,i)=>(plan?.beatGrid?.beats||plan?.beatTiming?.times||[]).filter(t=>Number.isFinite(t)&&t>=0&&t<=sources[i].duration));
 if(!grids?.every(grid=>grid?.length>1))throw Error('Für diese Anpassung werden Beatdaten beider Songs benötigt. Du kannst die Stellen weiterhin von Hand verschieben.');
 const starts=keys.map((key,i)=>{
  const source=sources[i],origin=pair.plan[key],max=source.duration-pair.plan.duration*source.rate;
  const bars=(plans[i].beatGrid?.downbeats||[]).filter(t=>Number.isFinite(t)&&t>=0&&t<=source.duration);
  const full=values=>values.filter(t=>t<=max&&available(i,t)>=pair.plan.duration);
  const nearby=values=>values.filter(t=>Math.abs(t-origin)<=2*source.rate);
  // Retain the duration whenever possible, even if this requires a wider search.
  let candidates=nearby(full(bars));
  if(!candidates.length)candidates=nearby(full(grids[i]));
  if(!candidates.length)candidates=full(grids[i]);
  // No full-length window exists: use the closest beat with a usable remainder.
  if(!candidates.length)candidates=grids[i].filter(t=>available(i,t)>=.1);
  if(!candidates.length)throw Error('Die erkannten Beats liegen am Songende; es bleibt kein abspielbarer Bereich für einen Übergang.');
  return candidates.reduce((best,t)=>Math.abs(t-origin)<Math.abs(best-origin)?t:best);
 });
 const requested=pair.plan.duration,remaining=Math.min(...sources.map((s,i)=>available(i,starts[i])),60);
 const target=Math.min(requested,remaining);
 const lengths=grids.map((grid,i)=>grid.map(t=>(t-starts[i])/sources[i].rate).filter(t=>t>=.1&&t<=remaining&&Math.abs(t-target)<=2));
 let duration=target,best=Infinity;
 for(const a of lengths[0])for(const b of lengths[1]){
  const mismatch=Math.abs(a-b);if(mismatch>.12)continue;
  const length=Math.min(a,b);
  const barEnds=plans.reduce((sum,plan,i)=>sum+Number((plan.beatGrid?.downbeats||[]).some(t=>Math.abs(t-(starts[i]+length*sources[i].rate))<.04*sources[i].rate)),0);
  const cost=Math.abs(length-target)+mismatch*4-barEnds*.15;
  if(cost<best){best=cost;duration=length;}
 }
 const computed=planTransitionPair(plans[0],plans[1],{startTime:starts[0],cue:starts[1],cueLocked:true,seconds:duration,rateA:pair.from.rate,rateB:pair.to.rate});
 const analyzed=computed.confidence==='analyzed'&&!pair.plan.points;
 return {...pair.plan,...(analyzed?{style:computed.style,label:computed.label}:{}),time:starts[0],cue:starts[1],duration,manual:true,kind:'time',audioProfile:null,confidence:computed.confidence,
  reason:`Passende Beats gesucht und Startstellen angepasst${duration<requested-.1?' · Überblenddauer verkürzt':''}.`};
}

// Keep the lightweight alignment helper for callers that only need beat snapping.
// The editor uses this deeper search in an abortable worker.
export async function optimizeTransition(pair,{signal,onProgress=()=>{},requestedDuration=null}={}){
 const {prepareTransitionOptimization,transitionOptimizationSearch}=await import('./transition-optimizer.js');
 signal?.throwIfAborted();const input=prepareTransitionOptimization(pair,{requestedDuration}),tracks=pair.alignmentTracks||pair.libraryTracks||[];
 const finishPlan=plan=>({...plan,audioProfile:plan.points?null:transitionAudioProfile(tracks[0]?.windows,tracks[1]?.windows,plan,{rateA:pair.from.rate,rateB:pair.to.rate,sameTrack:Boolean(pair.cutJoin)||tracks[0]===tracks[1]})});
 if(typeof Worker==='undefined'){
  const search=transitionOptimizationSearch(input);let step;
  do{signal?.throwIfAborted();step=search.next();if(!step.done){onProgress(step.value);await new Promise(resolve=>setTimeout(resolve,0));}}while(!step.done);
  return finishPlan(step.value);
 }
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./transition-optimizer-worker.js',import.meta.url),{type:'module'});
  let settled=false;
  const finish=(error,plan)=>{if(settled)return;settled=true;worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error){reject(error);return;}try{resolve(finishPlan(plan));}catch(error){reject(error);}};
  const abort=()=>finish(signal.reason||new DOMException('Optimierung abgebrochen.','AbortError'));
  const timer=setTimeout(()=>finish(Error('Die Suche dauert zu lange. Bitte die Songstelle eingrenzen und erneut optimieren.')),60000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=({data})=>{if(settled)return;if(data.progress)onProgress(data.progress);else finish(data.error?Error(data.error):null,data.plan);};
  worker.onerror=event=>{event.preventDefault();finish(Error(event.message||'Die Übergangssuche konnte nicht gestartet werden.'));};
  try{worker.postMessage(input);}catch(error){finish(error);}
 });
}
