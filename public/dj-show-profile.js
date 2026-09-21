import {choreographColors} from './color-choreography.js';
import {arrangementLevelAt} from './show-arrangement.js';
export const SHOW_PROFILES=['auto','party','disco'];
const clamp=value=>Math.max(0,Math.min(1,value));
// Apply to the original plan, never to the previous preset's output. This is
// a lighting interpretation of selected accents, not another beat detector.
export function applyShowProfile(plan,profile='auto') {
  if(!SHOW_PROFILES.includes(profile))throw Error('Unbekannte Lichtshow.');
  if(profile==='auto'||!plan.arrangement)return plan;
  const source=plan.arrangement,disco=profile==='disco';
  const lookAt=time=>source.lookTrack[Math.min(source.lookTrack.length-1,Math.floor(time/source.step))];
  const active=time=>['flow','lift','peak'].includes(lookAt(time));
  const arrangement={...source,
    bases:source.bases.map((value,i)=>active(i*source.step)&&value>0?(disco?Math.min(.6,value+.10):value*.92):value),
    accents:source.accents.map((value,i)=>active(source.times[i])?Math.min(.85,value*(disco?.85:1.2)):value),
    decays:source.times.map((time,i)=>(source.decays?.[i]??source.decay)*(active(time)?disco?1.25:.92:1)),
  };
  const {minimum,maximum}=plan.beatTiming;
  let event=-1,previous;
  const frames=plan.frames.map((frame,i)=>{
    const time=i*plan.step;
    while(event+1<source.times.length&&source.times[event+1]<=time)event++;
    let rgb=[frame.r,frame.g,frame.b];
    // Do not turn silence, held passages or a sustained pad into a color chase.
    const moving=active(time)&&source.bases[Math.min(source.bases.length-1,Math.floor(time/source.step))]>0&&event>=0&&time-source.times[event]<1;
    if(moving) {
      // Saturate the underlying contour; beat-aligned color pairs are
      // applied separately below and held between their selected events.
      const top=Math.max(...rgb),bottom=Math.min(...rgb);
      const amount=disco?(lookAt(time)==='peak'?.55:.4):.25;
      rgb=rgb.map(value=>clamp((value-bottom*amount)/Math.max(1,top-bottom*amount))*255);
    }
    const rate=1-Math.exp(-plan.step/(disco?.09:.16));
    previous=!previous||!moving?rgb:previous.map((value,c)=>value+(rgb[c]-value)*rate);
    return {...frame,r:Math.round(previous[0]),g:Math.round(previous[1]),b:Math.round(previous[2]),
      dimming:Math.round(minimum+arrangementLevelAt(arrangement,time)*(maximum-minimum))};
  });
  return choreographColors({...plan,choreographyBaseFrames:frames,showProfile:profile,arrangement,frames,beatTiming:{...plan.beatTiming,accents:arrangement.accents}},profile);
}
