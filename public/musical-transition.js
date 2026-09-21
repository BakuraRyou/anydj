import {beatPosition} from './beat-sync.js';
// Select a boundary just before the old trigger. Never shorten the overlap by
// waiting beyond that trigger; rates convert wall-clock fade lengths to media time.
export function transitionPoint(plan,seconds,rate=1,musical=true){
  const duration=plan?.duration;
  if(!Number.isFinite(duration)||duration<=0)return {time:0,kind:'time'};
  rate=Number.isFinite(rate)&&rate>0?rate:1;
  const fade=Math.max(.1,Number.isFinite(seconds)?seconds:8)*rate;
  const fallback=Math.max(0,duration-fade);
  if(!musical)return {time:fallback,kind:'time'};
  const earliest=Math.max(duration*.5,fallback-Math.min(4*rate,fade*.5));
  const grid=plan.beatGrid;
  const bars=(grid?.downbeats||[]).filter(t=>Number.isFinite(t)&&t>=earliest&&t<=fallback&&beatPosition(grid.beats,t));
  const section=bars.filter(t=>(plan.sections||[]).some(s=>s.start>0&&Math.abs(s.start-t)<=.15));
  if(section.length)return {time:section.at(-1),kind:'section'};
  if(bars.length)return {time:bars.at(-1),kind:'bar'};
  return {time:fallback,kind:'time'};
}
export function incomingCue(plan,cue=0){
  const bars=plan?.beatGrid?.downbeats||[];
  return bars.find(t=>Number.isFinite(t)&&t>=cue&&t<=cue+2&&t<plan.duration-.1&&beatPosition(plan.beatGrid.beats,t))??cue;
}

const clamp01=x=>Math.max(0,Math.min(1,x));
function activity(plan,time){
 const data=plan?.structure?.instruments;
 if(!data?.step)return null;
 const i=Math.max(0,Math.floor(time/data.step));
 const values=['drums','bass','vocals','other'].map(key=>Math.max(0,data[key]?.[i]||0));
 const total=values.reduce((a,b)=>a+b,0);
 return {energy:total,vocal:total>.002?values[2]/total:0,bass:total>.002?values[1]/total:0,drums:total>.002?values[0]/total:0};
}
function comparePair(a,b,start,cue,seconds,rateA,rateB){
 let vocal=0,bass=0,energy=0,drums=0,count=0;
 for(let i=0;i<24;i++){
  const t=(i+.5)/24*seconds,x=activity(a,start+t*rateA),y=activity(b,cue+t*rateB);
  if(!x||!y)continue;
  const weight=4*(i+.5)/24*(1-(i+.5)/24);
  vocal+=x.vocal*y.vocal*weight;bass+=x.bass*y.bass*weight;
  energy+=Math.abs(Math.log((x.energy+.01)/(y.energy+.01)))*weight;
  drums+=x.drums*y.drums*weight;count++;
 }
 return count?{vocal:vocal/count,bass:bass/count,energy:energy/count,drums:drums/count}:null;
}
// Compare bounded candidate pairs, never skipping beyond the user's cue window.
// Without both instrument analyses retain the established timing behavior.
export function planTransitionPair(outgoing,incoming,{seconds=8,rateA=1,rateB=1,cue=0,musical=true,startTime}={}){
 seconds=Number.isFinite(seconds)?Math.max(.1,seconds):8;
 rateA=Number.isFinite(rateA)&&rateA>0?rateA:1;rateB=Number.isFinite(rateB)&&rateB>0?rateB:1;
 cue=Math.max(0,Number.isFinite(cue)?cue:0);
 const fixedStart=Number.isFinite(startTime);
 const base=fixedStart?{time:Math.max(0,Math.min(outgoing?.duration||0,startTime)),kind:'time'}:transitionPoint(outgoing,seconds,rateA,musical);
 const entry=musical?incomingCue(incoming,cue):cue;
 const duration=Math.max(0,Math.min(seconds,((outgoing?.duration||0)-base.time)/rateA,((incoming?.duration||0)-entry)/rateB));
 const fallback={...base,cue:entry,duration,style:'smooth',label:'Sanfter Übergang',confidence:'fallback'};
 if(!musical||!outgoing?.structure?.instruments||!incoming?.structure?.instruments||!duration)return fallback;
 const latest=Math.max(0,outgoing.duration-seconds*rateA),earliest=Math.max(outgoing.duration*.5,latest-Math.min(4*rateA,seconds*rateA*.5));
 const starts=[base.time,...(fixedStart?[]:outgoing.beatGrid?.downbeats||[]).filter(t=>t>=earliest&&t<=latest&&beatPosition(outgoing.beatGrid.beats,t))];
 const cues=[entry,...(incoming.beatGrid?.downbeats||[]).filter(t=>t>=cue&&t<=cue+2&&t<incoming.duration-.1&&beatPosition(incoming.beatGrid.beats,t))];
 let best=null;
 for(const start of [...new Set(starts)].slice(-16))for(const next of [...new Set(cues)].slice(0,16)){
  const length=Math.max(0,Math.min(seconds,(outgoing.duration-start)/rateA,(incoming.duration-next)/rateB));
  if(length<Math.min(.5,seconds))continue;
  const metrics=comparePair(outgoing,incoming,start,next,length,rateA,rateB);if(!metrics)continue;
  const barA=beatPosition(outgoing.beatGrid?.beats,start),barB=beatPosition(incoming.beatGrid?.beats,next);
  const drift=barA&&barB?Math.abs(rateA/barA.period-rateB/barB.period)*length:null;
  const section=(outgoing.sections||[]).some(s=>s.start>0&&Math.abs(s.start-start)<.15);
  const score=metrics.vocal*5+metrics.bass*2+metrics.energy*.15+(drift??0)*metrics.drums*.3+(seconds-length)/seconds+Math.abs(start-base.time)*.005+(next-cue)*.01-(section ? .06 : 0);
  const style=metrics.vocal>.06||(drift!==null&&drift>.5&&metrics.drums>.03)?'handover':metrics.bass>.025?'bass':'smooth';
  if(!best||score<best.score)best={time:start,cue:next,duration:length,kind:section?'section':(outgoing.beatGrid?.downbeats||[]).includes(start)&&barA?'bar':base.kind,style,score,confidence:'analyzed',label:{smooth:'Sanfter Übergang',bass:'Bassübergabe',handover:'Kurze Überlagerung'}[style],reason:style==='handover'?'Weniger Überschneidung von Gesang oder unterschiedlichen Rhythmen':style==='bass'?'Bass des alten Titels weicht vor dem neuen Bass':'Passender Energieverlauf'};
 }
 return best||fallback;
}
export function transitionProgress(progress,style='smooth'){
 const p=clamp01(progress);
 if(style!=='handover')return p;
 const x=clamp01((p-.3)/.4);return x*x*(3-2*x);
}
