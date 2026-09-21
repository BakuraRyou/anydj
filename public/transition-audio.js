import {transitionProgress} from './musical-transition.js';

// Analysis windows contain absolute RMS every 20 ms, not normalized waveform bars.
function localRms(windows,start,duration,rate){
 if(!windows?.length||!Number.isFinite(start)||start<0)return null;
 const first=Math.floor(start/.02),last=Math.ceil((start+duration*rate)/.02);
 if(last> windows.length+1||last<=first)return null;
 let sum=0,count=0;
 for(let i=first;i<Math.min(last,windows.length);i++){
  const rms=windows[i]?.rms;
  if(!Number.isFinite(rms)||rms<0||rms>1)return null;
  sum+=rms*rms;count++;
 }
 return count?Math.sqrt(sum/count):null;
}

export function transitionAudioProfile(from,to,plan,{rateA=1,rateB=1,sameTrack=false}={}){
 const a=localRms(from,plan.time,plan.duration,rateA),b=localRms(to,plan.cue,plan.duration,rateB);
 // Silence, missing measurements, cuts and correlated copies keep the safe linear curve.
 if(sameTrack||plan.style==='cut'||a===null||b===null||Math.min(a,b)<.005)return null;
 return {a,b};
}

export function transitionAudioGains(progress,plan={}, {position=0,levelA=1,levelB=1}={}){
 const p=transitionProgress(progress,plan.style),b=position+(1-position)*p,a=1-b;
 const profile=plan.audioProfile;
 if(!profile||position!==0||levelA<=0||levelB<=0)return [a,b];
 const x=profile.a*levelA,y=profile.b*levelB;
 // Conservative RMS estimate for unrelated recordings. This is not LUFS or a peak prediction.
 const strength=Math.max(0,Math.min(1,(.25-Math.max(x,y))/.15));
 const expected=Math.hypot(a*x,b*y),target=a*x+b*y;
 const correction=expected>0?Math.max(1,Math.min(10**(2/20),target/expected,1/Math.max(a,b))):1;
 const scale=1+strength*(correction-1);
 return [a*scale,b*scale];
}

export function holdAudioParam(param,time){
 if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
 else {const value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}
}

export function scheduleTransitionGain(param,curve,start,duration){
 holdAudioParam(param,start);
 param.setValueCurveAtTime(curve,start,Math.max(.1,duration));
}
