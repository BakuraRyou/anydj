import {movingDirections,directedPose} from './dmx-moving-direction.js';
import {restingHeads} from './dmx-moving-model.js';
import {dramaAt} from './instrument-activity.js';
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
const distance=(a,b)=>Math.max(...a.flatMap((p,i)=>[Math.abs(p.pan-b[i].pan)/70,Math.abs(p.tilt-b[i].tilt)/.8]));
// Choose destinations from acoustically selected events, never every grid beat.
// Travel ends ON the event. Quiet gaps hold the last destination.
export function movingCues(plan,mode,mood='balanced'){
  mood=movingMood(mood);const profile=MOVING_MOODS[mood];
  const arrangement=plan.arrangement;
  if(!Array.isArray(arrangement?.times))return null;
  const cues=[{time:0,travel:0,pose:restingHeads()}];
  const phrases=arrangement.patterns?.phrases||[],sections=plan.sections||[];
  const directions=mode==='auto'&&mood==='balanced'?movingDirections(plan):[];
  let phraseIndex=0,sectionIndex=0,ordinal=0,phraseOrdinal=0,lastPhrase=-1;
  for(let index=0;index<arrangement.times.length;index++){
    const time=arrangement.times[index];
    if(!Number.isFinite(time)||time<=0||time>plan.duration)continue;
    while(phraseIndex+1<phrases.length&&phrases[phraseIndex+1].start<=time)phraseIndex++;
    while(sectionIndex+1<sections.length&&sections[sectionIndex+1].start<=time)sectionIndex++;
    const phrase=phrases[phraseIndex],section=sections[sectionIndex];
    const design=directions[phraseIndex];
    if(phraseIndex!==lastPhrase){phraseOrdinal=0;lastPhrase=phraseIndex;}
    const event=arrangement.patterns?.events?.[index];
    const atmospheric=mode==='auto'&&mood==='balanced'&&(phrase?.movement?.character==='atmospheric'||['held','quiet','break','outro'].includes(section?.look));
    const kind=atmospheric?'sweep':mode==='wash'?'wash':mood==='atmospheric'?'sweep':event?.kind||phrase?.kind||'bounce';
    const calm=atmospheric||kind==='wash'||['held','quiet','break','outro'].includes(section?.look);
    const strength=clamp(finite(arrangement.accents?.[index],0)/.7);
    if(strength<(calm?.08:.22))continue;
    const previous=cues.at(-1),gap=time-previous.time;
    if(gap<Math.max(profile.spacing,design?.spacing??0,atmospheric?4:0,calm?1.5:kind==='sweep'?.75:.38))continue;
    const drama=dramaAt(arrangement.drama,time);
    const energy=clamp(finite(drama?.intensity,finite(phrase?.energy,strength)));
    const percussion=clamp(finite(drama?.percussion,strength));
    const vocals=clamp(finite(drama?.vocalShare,0));
    const tone=clamp(finite(phrase?.tone,.5));
    const progress=clamp(finite(event?.progress,0));
    const spread=calm?5+energy*6:kind==='build'?8+24*progress:12+energy*20;
    const direction=(atmospheric?ordinal%2:(event?.alternate??ordinal%2))?-1:1;
    let pose=Array.from({length:4},(_,i)=>{
      const side=i<2?-1:1,outer=i===0||i===3;
      // Vocal-led inner pair stays focused; percussion opens the outside pair.
      const scale=outer?.75+.25*percussion:.6-.3*vocals;
      let pan;
      if(kind==='punch')pan=side*spread*scale*(direction>0?1:.35);
      else if(kind==='build')pan=side*spread*scale;
      else if(kind==='sweep')pan=side*direction*spread*scale*(outer?1:-1);
      else if(kind==='wash')pan=(i-1.5)*(4+energy*3);
      else pan=direction*side*spread*scale;
      if(mode==='follow')pan=side*spread*(direction>0?.8:.35);
      if(mode==='alternate')pan=(i%2?direction:-direction)*spread*scale;
      return {pan:clamp(pan*profile.span,-42,42),tilt:clamp(.8+(.65+tone*.2+energy*.15+(outer?.05:-.05)-.8)*Math.min(1,profile.span),.55,1.15)};
    });
    if(design){
      const sectionProgress=section?clamp((time-section.start)/Math.max(.1,section.end-section.start)):progress;
      pose=directedPose(design,phraseOrdinal++,sectionProgress).map(p=>({pan:clamp(p.pan*profile.span,-42,42),tilt:clamp(.8+(p.tilt-.8)*Math.min(1,profile.span),.55,1.15)}));
    }
    // A smoothstep has peak speed 1.5 × distance / duration. Short intervals
    // reduce travel distance so a target is reachable exactly at its cue.
    const speed=Math.min(profile.speed,design?.speed??1,atmospheric?.3:1);
    const required=1.5*distance(previous.pose,pose)/speed,fraction=required>gap?gap/required:1;
    const reachable=pose.map((p,i)=>({pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*fraction,tilt:previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*fraction}));
    cues.push({time,travel:Math.min(gap,Math.max(profile.travel,design?.travel??0,atmospheric?3:0,calm?.8:.2,1.5*distance(previous.pose,reachable)/speed)),pose:reachable});
    ordinal++;
  }
  return cues;
}
export function movingCueAt(cues,time){
  let lo=0,hi=cues.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].time<=time)lo=mid+1;else hi=mid;}
  const previous=cues[Math.max(0,lo-1)],next=cues[lo];
  if(!next||time<=next.time-next.travel)return previous.pose;
  const phase=clamp((time-(next.time-next.travel))/next.travel),ease=phase*phase*(3-2*phase);
  return previous.pose.map((p,i)=>({pan:p.pan+(next.pose[i].pan-p.pan)*ease,tilt:p.tilt+(next.pose[i].tilt-p.tilt)*ease}));
}
