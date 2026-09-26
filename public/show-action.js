// Shared, seek-stable action score for color, occupancy and formation.
export function showActionAt(plan,time){
 if(plan?.showProfile!=='show'||!Number.isFinite(time))return null;
 const cues=plan.showCues||[];let lo=0,hi=cues.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].time<=time)lo=mid+1;else hi=mid;}
 const cue=cues[lo-1];
 if(!cue?.action||time>=cue.end)return null;
 const end=Math.min(cue.end,cues[lo]?.time??Infinity,cue.time+(cue.actionDuration??1));
 if(time>=end||end<=cue.time)return null;
 return {cue,progress:Math.max(0,Math.min(1,(time-cue.time)/(end-cue.time)))};
}
