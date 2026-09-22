// Deterministic choreography from the existing prepared show. No wall clock,
// additional beat detection or independent brightness pulses.
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const mix=(a,b,t)=>a+(b-a)*t;
export const restingHeads=()=>Array.from({length:4},(_,i)=>({pan:(i-1.5)*12,tilt:.8}));
function sourcePose(source,i,mode){
  if(source.movingPose)return source.movingPose[i];
  const rest={pan:(i-1.5)*12,tilt:.8};
  const beat=Number.isFinite(source.motionBeat)?source.motionBeat:Number.isFinite(source.beat)?source.beat:null;
  if(beat===null)return rest;
  const mood=MOVING_MOODS[movingMood(source.movingMood)];
  const progress=clamp(finite(source.sectionProgress),0,1);
  const quiet=['held','quiet','break','outro'].includes(source.look)||mode==='wash';
  const peak=source.look==='peak',build=source.look==='lift';
  const accent=quiet?0:clamp(finite(source.accentStrength),0,1);
  const phase=period=>2*Math.PI*(((beat*mood.tempo)%period)/period);
  const side=i<2?-1:1;
  const pair=Math.min(i,3-i);
  const offset=mode==='follow'?0:mode==='alternate'?pair*Math.PI:pair*Math.PI/2;
  const slow=Math.sin(phase(16)+offset),fast=Math.sin(phase(8)+offset);
  const wave=quiet?Math.sin(phase(32)+offset):build?mix(slow,fast,progress):peak?fast:slow;
  const spread=quiet?6:build?mix(12,28,progress):peak?30:16;
  // Existing attacks briefly open the fan; they never add flashes.
  const pan=rest.pan*(quiet?.8:.3)+side*(wave*spread+accent*4);
  const tilt=.8+(quiet?.04:peak?.2:build?mix(.07,.18,progress):.1)*Math.cos(phase(quiet?32:16)+offset)+accent*.04;
  return {pan:clamp(pan*mood.span,-42,42),tilt:clamp(.8+(tilt-.8)*Math.min(1,mood.span),.55,1.15)};
}
export function movingHeadTargets(streams=[],mode='auto'){
  const active=streams.filter(s=>s.frame&&s.frame.state!==false&&Number.isFinite(s.weight)&&s.weight>0);
  // A dark deck must not steer the lit deck during a transition.
  const weights=active.map(s=>s.weight*clamp(finite(s.frame.dimming),0,100));
  const total=weights.reduce((a,b)=>a+b,0);
  if(!total)return null;
  return Array.from({length:4},(_,i)=>{
    let pan=0,tilt=0;
    active.forEach((s,k)=>{const pose=sourcePose(s,i,mode);pan+=pose.pan*(weights[k]/total);tilt+=pose.tilt*(weights[k]/total);});
    return {pan,tilt};
  });
}
// Limit motor speed and ease direction changes, including seeks and section cuts.
export function advanceMovingHeads(current,target,seconds){
  const dt=clamp(finite(seconds),0,.1),ease=1-Math.exp(-dt/ .18);
  return current.map((pose,i)=>({
    pan:pose.pan+clamp((target[i].pan-pose.pan)*ease,-70*dt,70*dt),
    tilt:pose.tilt+clamp((target[i].tilt-pose.tilt)*ease,-.8*dt,.8*dt),
  }));
}
// Prepared tracks already contain eased motion. Only constrain discontinuities
// (seeks, switching tracks or crossfades), without adding a second time lag.
export function followMovingHeads(current,target,seconds){
  const dt=clamp(finite(seconds),0,.1);
  return current.map((pose,i)=>({pan:pose.pan+clamp(target[i].pan-pose.pan,-70*dt,70*dt),tilt:pose.tilt+clamp(target[i].tilt-pose.tilt,-.8*dt,.8*dt)}));
}
