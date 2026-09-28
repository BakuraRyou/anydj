import {planTransitionPair} from './musical-transition.js';

// Prefer the user's region, then expand the search before shortening the overlap.
export function alignTransition(pair){
 const plans=pair.libraryTracks?.map(track=>track.plan);
 const sources=[pair.from,pair.to],keys=['time','cue'];
 const grids=plans?.map((plan,i)=>(plan?.beatGrid?.beats||plan?.beatTiming?.times||[]).filter(t=>Number.isFinite(t)&&t>=0&&t<=sources[i].duration));
 if(!grids?.every(grid=>grid?.length>1))throw Error('Für diese Anpassung werden Beatdaten beider Songs benötigt. Du kannst die Stellen weiterhin von Hand verschieben.');
 const starts=keys.map((key,i)=>{
  const source=sources[i],origin=pair.plan[key],max=source.duration-pair.plan.duration*source.rate;
  const bars=(plans[i].beatGrid?.downbeats||[]).filter(t=>Number.isFinite(t)&&t>=0&&t<=source.duration);
  const full=values=>values.filter(t=>t<=max);
  const nearby=values=>values.filter(t=>Math.abs(t-origin)<=2*source.rate);
  // Retain the duration whenever possible, even if this requires a wider search.
  let candidates=nearby(full(bars));
  if(!candidates.length)candidates=nearby(full(grids[i]));
  if(!candidates.length)candidates=full(grids[i]);
  // No full-length window exists: use the closest beat with a usable remainder.
  if(!candidates.length)candidates=grids[i].filter(t=>(source.duration-t)/source.rate>=.1);
  if(!candidates.length)throw Error('Die erkannten Beats liegen am Songende; es bleibt kein abspielbarer Bereich für einen Übergang.');
  return candidates.reduce((best,t)=>Math.abs(t-origin)<Math.abs(best-origin)?t:best);
 });
 const requested=pair.plan.duration,remaining=Math.min(...sources.map((s,i)=>(s.duration-starts[i])/s.rate),60);
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
