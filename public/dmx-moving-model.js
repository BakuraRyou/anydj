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
  const quiet=mode==='auto'&&source.motionCharacter==='atmospheric'||['held','quiet','break','outro'].includes(source.look)||mode==='wash';
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
  // Blend motion using the slow lighting base when available. Fast flashes
  // must not pull the heads between two deck positions on every transient.
  const weights=active.map(s=>s.weight*(s.frame.dimming>0?clamp(finite(s.washDimming,finite(s.frame.dimming)),0,100):0));
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

// A shared tangent keeps velocity continuous without overshooting either
// neighbouring destination. At a reversal the head naturally slows to zero.
export function motionTangent(before,value,after,left,right){
  if(!(left>0&&right>0))return 0;
  const a=(value-before)/left,b=(after-value)/right;
  return a*b>0?Math.sign(a)*Math.min(Math.abs(a),Math.abs(b)):0;
}
export function motionHermite(a,b,va,vb,duration,t){
  const t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a+(t3-2*t2+t)*duration*va+(-2*t3+3*t2)*b+(t3-t2)*duration*vb;
}

// Generic preview motor envelope, not manufacturer DMX specifications.
// Tilt is the preview's normalized projection coordinate, not degrees.
export const MOVING_LIMITS={pan:{speed:70,acceleration:280,jerk:2800},tilt:{speed:.8,acceleration:3.2,jerk:32}};
export function motionDuration(a,b,scale=1){
  let duration=0;
  a.forEach((p,i)=>{for(const key of ['pan','tilt']){
    const d=Math.abs(b[i][key]-p[key]),limit=MOVING_LIMITS[key];
    duration=Math.max(duration,1.875*d/(limit.speed*scale),Math.sqrt(6*d/(limit.acceleration*scale)),Math.cbrt(60*d/(limit.jerk*scale)));
  }});
  return duration;
}
export function motionReach(a,b,time,scale=1){
  let fraction=1;
  a.forEach((p,i)=>{for(const key of ['pan','tilt']){
    const d=Math.abs(b[i][key]-p[key]),limit=MOVING_LIMITS[key];
    if(d)fraction=Math.min(fraction,limit.speed*scale*time/(1.875*d),limit.acceleration*scale*time*time/(6*d),limit.jerk*scale*time*time*time/(60*d));
  }});
  return fraction;
}
// Quintic Hermite: shared velocity and optional shared curvature. Isolated
// gestures retain zero endpoint acceleration by default.
export function motionQuintic(a,b,va,vb,duration,t,aa=0,ab=0){
  const d=b-a,u=va*duration,v=vb*duration,A=aa*duration*duration,B=ab*duration*duration;
  return a+u*t+A*t*t/2+t*t*t*((10*d-6*u-4*v-1.5*A+.5*B)+t*((-15*d+8*u+7*v+1.5*A-B)+t*(6*d-3*u-3*v-.5*A+.5*B)));
}
