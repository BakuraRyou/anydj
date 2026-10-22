import {validTransitionPoints} from './transition-audio.js';
// Cuts use original-file seconds. Analysis, cues and lighting keep their source clock.
export function cleanCuts(cuts,duration){
 if(!Number.isFinite(duration)||duration<=0)return [];
 const sorted=(Array.isArray(cuts)?cuts:[]).filter(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite))
  .map(([a,b])=>[Math.max(0,a),Math.min(duration,b)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
 const merged=[];
 for(const cut of sorted){const last=merged.at(-1);if(last&&cut[0]<=last[1])last[1]=Math.max(last[1],cut[1]);else merged.push([...cut]);}
 return merged;
}
export function keptRanges(cuts,duration){
 const ranges=[];let start=0;
 for(const [a,b] of cleanCuts(cuts,duration)){if(a>start)ranges.push([start,a]);start=b;}
 if(start<duration)ranges.push([start,duration]);return ranges;
}
export function editedDuration(cuts,duration,joins=[]){return keptRanges(cuts,duration).reduce((sum,[a,b])=>sum+b-a,0)-cleanCutJoins(joins,cuts,duration).reduce((sum,j)=>sum+j.duration,0);}
export function cutClock(value,precision=2){
 const scale=10**precision,ticks=Math.round(Math.max(0,Number(value)||0)*scale),seconds=Math.floor(ticks/scale);
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}${precision?','+String(ticks%scale).padStart(precision,'0'):''}`;
}
export function parseCutPosition(value,format='seconds'){
 const text=String(value).trim().replace(',','.');let seconds;
 if(format==='time'){
  const match=/^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(text);
  if(!match)return NaN;seconds=Number(match[1])*60+Number(match[2]);
 }else{
  if(!/^\d+(?:\.\d+)?$/.test(text))return NaN;seconds=Number(text);
 }
 return Number.isFinite(seconds)?seconds:NaN;
}
export function cleanCutJoins(joins,cuts,duration){
 const ranges=keptRanges(cuts,duration),result=[];
 for(let i=0;i<ranges.length-1;i++){
  const [left,right]=[ranges[i],ranges[i+1]],a=left[1],b=right[0];
  const join=(Array.isArray(joins)?joins:[]).find(j=>Array.isArray(j?.cut)&&j.cut[0]===a&&j.cut[1]===b);
  if(!join||!Number.isFinite(join.duration)||join.duration<.1||join.duration>60||!['smooth','bass','handover','cut'].includes(join.style)||join.points!=null&&!validTransitionPoints(join.points))continue;
  const previous=result.at(-1),occupied=previous?.cut[1]===left[0]?previous.duration:0;
  if(join.duration+occupied>left[1]-left[0]+.00001||join.duration>right[1]-right[0]+.00001)continue;
  result.push({cut:[a,b],duration:join.duration,style:join.style,points:join.points?structuredClone(join.points):null});
 }
 return result;
}
export function cutJoinPlan(join){return {time:join.cut[0]-join.duration,cue:join.cut[1],duration:join.duration,style:join.style,points:join.points,audioProfile:null,manual:true,kind:'time',label:'Schnittübergang'};}
export function cutAudioClips(cuts,duration,joins=[],start=0,end=duration){
 const clips=[];let output=0;
 for(const [a,b] of keptRanges(cuts,duration)){
  const sourceStart=Math.max(a,start),sourceEnd=Math.min(b,end);if(sourceEnd<=sourceStart)continue;
  clips.push({sourceStart,start:output,end:output+sourceEnd-sourceStart,fadeIn:sourceStart===a&&a>start,fadeOut:sourceEnd===b&&b<end});output+=sourceEnd-sourceStart;
 }
 for(const join of cleanCutJoins(joins,cuts,duration)){
  const left=clips.find(c=>Math.abs(c.sourceStart+c.end-c.start-join.cut[0])<.00001),right=clips.find(c=>c.sourceStart===join.cut[1]);
  if(!left||!right||left.end-left.start<join.duration||right.end-right.start<join.duration)continue;
  const transition={start:left.end-join.duration,plan:cutJoinPlan(join)};
  left.cutOutgoing=transition;left.fadeOut=false;right.cutIncoming=transition;right.fadeIn=false;
  let shift=false;for(const clip of clips){if(clip===right)shift=true;if(!shift)continue;clip.start-=join.duration;clip.end-=join.duration;}
 }
 return clips;
}
export function cutTimeBetween(cuts,duration,joins,start,end){return cutAudioClips(cuts,duration,joins,start,end).at(-1)?.end||0;}
export function transitionSafeRanges(track){
 const duration=track?.plan?.duration,cuts=track?.audioCuts||[];
 const expanded=cleanCutJoins(track?.audioCutJoins,cuts,duration).map(j=>[j.cut[0]-j.duration,j.cut[1]+j.duration]);
 return keptRanges([...cuts,...expanded],duration);
}
export function nextKeptTime(cuts,duration,time){
 for(const [a,b] of keptRanges(cuts,duration))if(time<b)return Math.max(a,time);
 return duration;
}
export function keptPassageRemaining(track,time){
 const range=transitionSafeRanges(track).find(([a,b])=>time>=a&&time<b);
 return range?range[1]-time:0;
}
// Transition editor snapshots carry original-file duration alongside their cuts.
export function transitionCutTracks(pair){
 return [pair.from,pair.to].map((source,i)=>({plan:{duration:source.duration},audioCuts:source.audioCuts??pair.libraryTracks?.[i]?.audioCuts??[],audioCutJoins:source.audioCutJoins??pair.libraryTracks?.[i]?.audioCutJoins??[]}));
}
// Always derive restoration from the saved cuts, never from the preceding drag
// position. Moving a transition across a cut must not restore the whole drag path.
export function restoreCutRanges(cuts,duration,ranges){
 let result=cleanCuts(cuts,duration);
 for(const [a,b] of cleanCuts(ranges,duration))result=result.flatMap(([s,e])=>e<=a||s>=b?[[s,e]]:[[s,Math.min(e,a)],[Math.max(s,b),e]].filter(([s,e])=>e-s>.00001));
 return result;
}
export function restoreTransitionPair(pair,plan=pair.plan){
 if(!pair.allowCutRestore)return {...pair,plan};
 const base=pair.cutRestoreBase||transitionCutTracks(pair);
 const windows=[[plan.time,plan.time+plan.duration*pair.from.rate],[plan.cue,plan.cue+plan.duration*pair.to.rate]];
 const same=pair.libraryTracks?.[0]&&pair.libraryTracks[0]===pair.libraryTracks[1];
 const sources=[pair.from,pair.to].map((source,i)=>{
  const ranges=same?windows:[windows[i]],track=base[i],audioCuts=restoreCutRanges(track.audioCuts,source.duration,ranges);
  const joins=cleanCutJoins(track.audioCutJoins,track.audioCuts,source.duration).filter(j=>!ranges.some(([a,b])=>a<j.cut[1]+j.duration&&b>j.cut[0]-j.duration));
  return {...source,audioCuts,audioCutJoins:cleanCutJoins(joins,audioCuts,source.duration)};
 });
 return {...pair,plan,cutRestoreBase:base,from:sources[0],to:sources[1]};
}
export function transitionCutChanges(pair){
 if(!pair.allowCutRestore||!pair.cutRestoreBase)return [];
 return transitionCutTracks(pair).flatMap((track,index)=>{
  const base=pair.cutRestoreBase[index],duration=track.plan.duration,beforeCuts=cleanCuts(base.audioCuts,duration),beforeJoins=cleanCutJoins(base.audioCutJoins,base.audioCuts,duration);
  if(JSON.stringify([beforeCuts,beforeJoins])===JSON.stringify([track.audioCuts,track.audioCutJoins]))return [];
  return [{index,beforeCuts,beforeJoins,cuts:track.audioCuts,joins:track.audioCutJoins,restored:restoreCutRanges(beforeCuts,duration,track.audioCuts),removedJoins:beforeJoins.length-track.audioCutJoins.length}];
 });
}
export function fitPreviewCuts(pair,plan){
 return fitCutTransition(plan,...transitionCutTracks(pair),{rateA:pair.from.rate,rateB:pair.to.rate});
}
export function keptTimeBetween(cuts,duration,start,end){
 return keptRanges(cuts,duration).reduce((sum,[a,b])=>sum+Math.max(0,Math.min(b,end)-Math.max(a,start)),0);
}
export function cutTransitionFits(plan,from,to,rateA=1,rateB=1){
 if(!plan)return false;
 return [[from,plan.time,rateA],[to,plan.cue,rateB]].every(([track,start,rate])=>
  transitionSafeRanges(track).some(([a,b])=>start>=a-.00001&&start+plan.duration*rate<=b+.00001));
}
// A fade must stay inside one kept passage on each side; internal skips happen
// before/after the fade, so its gain and bass curves retain their original timing.
export function fitCutTransition(plan,from,to,{rateA=1,rateB=1,notBefore=0}={}){
 if(!from?.audioCuts?.length&&!to?.audioCuts?.length)return plan;
 const a=transitionSafeRanges(from),b=transitionSafeRanges(to);
 if(!a.length||!b.length)return {...plan,duration:0,alternatives:undefined,audioProfile:null,reason:'Kein freier Abschnitt für einen zusätzlichen Titelübergang. Schnittüberblendung bitte verkürzen.'};
 const next=(ranges,time,end)=>{for(const [a,b] of ranges)if(time<b)return Math.max(a,time);return end;};
 let time=next(a,Math.max(plan.time,notBefore),from.plan.duration);
 let out=a.find(([s,e])=>time>=s&&time<e);
 if(!out){out=a.at(-1);time=Math.max(out[0],out[1]-plan.duration*rateA,notBefore);}
 const cue=next(b,plan.cue,to.plan.duration),incoming=b.find(([s,e])=>cue>=s&&cue<e);
 if(!incoming)return {...plan,time,cue,duration:0,alternatives:undefined,audioProfile:null};
 const duration=Math.max(0,Math.min(plan.duration,(out[1]-time)/rateA,(incoming[1]-cue)/rateB));
 return {...plan,time,cue,duration,alternatives:undefined,...(time!==plan.time||cue!==plan.cue||duration!==plan.duration?{audioProfile:null,reason:'An die hörbaren Liedteile angepasst.'}:{})};
}
