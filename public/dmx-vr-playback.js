import {mixMovingPresence} from './dmx-activity.js';
// Short jitter buffer for network scenes. Head/controller tracking remains immediate.
export function createVRPlayback({delay=120}={}){
  let frames=[];
  return {
    push(scene,time){
      if(frames.length&&time-frames.at(-1).time>1000)frames=[];
      frames.push({scene,time});if(frames.length>32)frames.shift();
    },
    sample(now){
      if(!frames.length)return null;
      const latest=frames.at(-1).scene,time=now-delay;
      while(frames.length>2&&frames[1].time<=time)frames.shift();
      const a=frames[0],b=frames[1]||a,t=Math.max(0,Math.min(1,(time-a.time)/Math.max(1,b.time-a.time)));
      const mix=(x,y)=>x+(y-x)*t,old=new Map(a.scene.lights.map(l=>[l.id,l]));
      // Do not interpolate a room edit or changed fixture topology through old geometry.
      const compatible=a.scene.layout.width===b.scene.layout.width&&a.scene.layout.depth===b.scene.layout.depth;
      const scene=compatible?{...b.scene,motion:mix(a.scene.motion||0,b.scene.motion||0),lights:b.scene.lights.map(light=>{
        const prev=old.get(light.id);if(!prev||prev.type!==light.type)return light;
        const motionFocus=prev.motionFocus!==undefined||light.motionFocus!==undefined?mix(prev.motionFocus??0,light.motionFocus??0):undefined;
        const motionUV=prev.motionUV&&light.motionUV?{x:mix(prev.motionUV.x,light.motionUV.x),y:mix(prev.motionUV.y,light.motionUV.y)}:light.motionUV;
        const pa=prev.motionAhead,la=light.motionAhead;
        const motionAhead=pa&&la?{seconds:mix(pa.seconds,la.seconds),motionFocus:mix(pa.motionFocus??0,la.motionFocus??0),target:{x:mix(pa.target.x,la.target.x),y:mix(pa.target.y,la.target.y),...((pa.target.z!==undefined||la.target.z!==undefined)?{z:mix(pa.target.z||0,la.target.z||0)}:{})},...(pa.motionUV&&la.motionUV?{motionUV:{x:mix(pa.motionUV.x,la.motionUV.x),y:mix(pa.motionUV.y,la.motionUV.y)}}:{})}:undefined;
        const presence=prev.movingPresence&&light.movingPresence?{
          movingPresence:mixMovingPresence([{presence:prev.movingPresence,weight:1-t},{presence:light.movingPresence,weight:t}]),
          movingPresenceBasePower:mix(prev.movingPresenceBasePower,light.movingPresenceBasePower),
        }:{};
        return {...light,...presence,motionAhead,...(motionFocus!==undefined?{motionFocus}:{}),...(motionUV?{motionUV}:{}),power:mix(prev.power,light.power),target:{x:mix(prev.target.x,light.target.x),y:mix(prev.target.y,light.target.y),...((prev.target.z!==undefined||light.target.z!==undefined)?{z:mix(prev.target.z||0,light.target.z||0)}:{})}};
      })}:b.scene;
      // Controls use the latest confirmed state, independent of visual buffering.
      return {...scene,transport:latest.transport,controlMessage:latest.controlMessage,controlMessageId:latest.controlMessageId};
    },
  };
}

// Local scene updates arrive at 20 Hz. Buffer just over one update so display
// and XR frames can interpolate without extrapolating across protected areas.
// Brightness, blackout, fixture edits and membership remain immediate.
export function createMovingPreview({delay=60}={}){
 const playback=createVRPlayback({delay});let latest=[],until=0,receivedAt=0;
 return {
  push(lights,layout,now){
   const prior=new Map(latest.map(l=>[l.id,l]));
   if(lights.some(l=>{const p=prior.get(l.id);return p&&['x','y','z'].some(k=>(p.target[k]||0)!==(l.target[k]||0))||p&&['x','y'].some(k=>p.motionUV?.[k]!==l.motionUV?.[k])||p&&p.motionFocus!==l.motionFocus;}))until=now+delay+50;
   latest=lights;receivedAt=now;playback.push({lights,layout},now);
  },
  active(now){return now<until;},
  sample(now){
   const buffered=playback.sample(now);if(!buffered)return latest;
   const poses=new Map(buffered.lights.map(l=>[l.id,l]));
   return latest.map(light=>{
    const ahead=light.motionAhead;
    if(ahead?.seconds>0){
     // Prepared samples allow interpolation at the audible time instead of
     // adding the fallback jitter buffer's delay. Bound stalled-source travel.
     const age=Math.max(0,Math.min(.05,(now-receivedAt)/1000)),t=Math.min(1,age/ahead.seconds);
     const mix=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+((b[k]??a[k])-a[k])*t]));
     return {...light,...(light.motionFocus!==undefined?{motionFocus:light.motionFocus+((ahead.motionFocus??light.motionFocus)-light.motionFocus)*t}:{}),target:mix(light.target,ahead.target),...(light.motionUV&&ahead.motionUV?{motionUV:mix(light.motionUV,ahead.motionUV)}:{}),motionAhead:now-receivedAt<=150?{...ahead,seconds:Math.max(.001,ahead.seconds-age)}:undefined};
    }
    const pose=poses.get(light.id);return pose?{...light,...(pose.motionFocus!==undefined?{motionFocus:pose.motionFocus}:{}),target:pose.target,...(pose.motionUV?{motionUV:pose.motionUV}:{})}:light;
   });
  },
 };
}
