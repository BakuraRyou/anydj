const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Interpolate only between detected beats; never invent a grid beyond them.
export function beatPosition(beats,time){
 if(!beats||beats.length<4||!Number.isFinite(time)||time<beats[0]||time>=beats.at(-1))return null;
 let lo=0,hi=beats.length;while(lo<hi){const mid=(lo+hi)>>>1;if(beats[mid]<=time)lo=mid+1;else hi=mid;}
 const index=lo-1,period=beats[index+1]-beats[index];
 const gaps=[];for(let i=Math.max(0,index-3);i<Math.min(beats.length-1,index+4);i++)gaps.push(beats[i+1]-beats[i]);
 const sorted=[...gaps].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
 if(period<.25||period>1.5||gaps.some(g=>Math.abs(g-median)>median*.22))return null;
 return {index,phase:(time-beats[index])/period,period};
}
export function beatSyncTarget(masterBeats,masterTime,masterRate,followerBeats,followerTime){
 const master=beatPosition(masterBeats,masterTime),follower=beatPosition(followerBeats,followerTime);
 if(!master||!follower)return null;
 const tempo=follower.period/master.period*masterRate;
 if(tempo<.8||tempo>1.25)return null;
 const error=((master.phase-follower.phase+.5)%1+1)%1-.5;
 return {tempo,error,rate:clamp(tempo*(1+clamp(error*.12,-.04,.04)),.768,1.3)};
}
export function alignedStart(masterBeats,masterTime,masterRate,followerBeats,cue){
 const master=beatPosition(masterBeats,masterTime);
 const index=followerBeats?.findIndex(t=>t>=cue);
 if(!master||index==null||index<0||index>=followerBeats.length-1)return null;
 const time=followerBeats[index]+master.phase*(followerBeats[index+1]-followerBeats[index]);
 const target=beatSyncTarget(masterBeats,masterTime,masterRate,followerBeats,time);
 return target?{time,rate:target.tempo}:null;
}
