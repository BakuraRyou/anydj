import {movingDirections,directedPose,groovePose,spatialPose} from './dmx-moving-direction.js';
import {beatPosition} from './dmx-show.js';
import {restingHeads,motionTangent,motionQuintic,motionDuration,motionReach} from './dmx-moving-model.js';
import {dramaAt} from './instrument-activity.js';
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
// Choose destinations from acoustically selected events, never every grid beat.
// Travel ends ON the event. Quiet gaps hold the last destination.
export function movingCues(plan,mode,mood='balanced'){
  mood=movingMood(mood);const profile=MOVING_MOODS[mood];
  let arrangement=plan.arrangement;
  if(!Array.isArray(arrangement?.times))return null;
  if(mode==='auto'&&arrangement.developments?.length){
    const entries=arrangement.times.map((time,i)=>({time,accent:arrangement.accents[i],salience:arrangement.eventSalience?.[i],event:arrangement.patterns?.events?.[i]}));
    for(const cue of arrangement.developments){
      if(entries.some(e=>Math.abs(e.time-cue.time)<.2))continue;
      entries.push({time:cue.time,accent:.35,salience:0,event:{kind:'build',development:true,progress:cue.progress}});
    }
    entries.sort((a,b)=>a.time-b.time);
    arrangement={...arrangement,times:entries.map(e=>e.time),accents:entries.map(e=>e.accent),eventSalience:entries.map(e=>e.salience),
      patterns:{...arrangement.patterns,events:entries.map(e=>e.event)}};
  }
  const cues=[{time:0,travel:0,pose:restingHeads()}];
  const phrases=arrangement.patterns?.phrases||[],sections=plan.sections||[];
  const directions=mode==='auto'?movingDirections(plan,mood==='disco'):[];
  // Lighting accents can sustain a groove; a spatial gesture needs additional
  // evidence. A visual phrase boundary alone must not rotate the formation.
  const motives=phrases.map((phrase,i)=>{
    const previous=phrases[i-1];
    const local=arrangement.times.flatMap((t,k)=>t>=phrase.start&&t<phrase.end?[finite(arrangement.accents?.[k],0)]:[]).sort((a,b)=>a-b);
    const typical=local[Math.floor(local.length/2)]??0;
    const changed=!previous||Math.abs(finite(phrase.energy,0)-finite(previous.energy,0))>=.15||
      Math.abs(finite(phrase.tone,0)-finite(previous.tone,0))>=.15||
      phrase.movement?.character!==previous.movement?.character||
      (phrase.attention?.confidence>=.5&&previous.attention?.confidence>=.5&&phrase.attention.leader!==previous.attention.leader);
    const saliences=arrangement.times.flatMap((t,k)=>t>=phrase.start&&t<phrase.end&&Number.isFinite(arrangement.eventSalience?.[k])?[arrangement.eventSalience[k]]:[]).sort((a,b)=>a-b);
    return {changed,threshold:Math.max(.3,typical*1.3),salience:Math.max(.35,(saliences[Math.floor(saliences.length/2)]??0)*1.5)};
  });
  const downbeats=plan.beatGrid?.downbeats||[];
  let phraseIndex=0,sectionIndex=0,ordinal=0,lastEntry=-1,barIndex=0;
  let motionBeat=0,lastGrooveBeat=null,lastDrive=1,groovePhrase=-1;
  const motionGrid=arrangement.motionTimes||plan.beatGrid?.beats||arrangement.times;
  // Fill the interval only while the audio still supports a continuous groove.
  const sustained=(start,end)=>{
    if(end-start>2.4)return false;
    if(arrangement.drama){
      for(let t=start;t<=end;t+=.1){const d=dramaAt(arrangement.drama,t);if(d.intensity<.5||d.percussion<.4)return false;}
      return true;
    }
    const a=beatPosition(motionGrid,start),b=beatPosition(motionGrid,end);
    return a!==null&&b!==null&&b-a>=1&&b-a<=4;
  };
  for(let index=0;index<arrangement.times.length;index++){
    const time=arrangement.times[index];
    if(!Number.isFinite(time)||time<=0||time>plan.duration)continue;
    while(phraseIndex+1<phrases.length&&phrases[phraseIndex+1].start<=time)phraseIndex++;
    while(sectionIndex+1<sections.length&&sections[sectionIndex+1].start<=time)sectionIndex++;
    const phrase=phrases[phraseIndex],section=sections[sectionIndex];
    const directionDesign=directions[phraseIndex];
    const design=mood==='balanced'||mood==='disco'?directionDesign:null;
    const event=arrangement.patterns?.events?.[index];
    const atmospheric=!event?.development&&mode==='auto'&&mood==='balanced'&&(phrase?.movement?.character==='atmospheric'||['held','quiet','break','outro'].includes(section?.look));
    const kind=atmospheric?'sweep':mode==='wash'?'wash':mood==='atmospheric'?'sweep':event?.kind||phrase?.kind||'bounce';
    const calm=atmospheric||kind==='wash'||['held','quiet','break','outro'].includes(section?.look);
    const strength=clamp(finite(arrangement.accents?.[index],0)/.7);
    if(strength<(calm?.08:.22))continue;
    const directed=mode==='auto'&&Boolean(phrase?.movement);
    const drama=dramaAt(arrangement.drama,time);
    const energy=clamp(finite(drama?.intensity,finite(phrase?.energy,strength)));
    const percussion=clamp(finite(drama?.percussion,strength));
    const rhythmicDrive=clamp(finite(drama?.percussion,finite(phrase?.movement?.driving,0)));
    const vocals=clamp(finite(drama?.vocalShare,0));
    const groove=!event?.development&&directed&&!calm&&(mood==='balanced'||mood==='energetic'||mood==='disco')&&
      energy>=.55&&rhythmicDrive>=.45&&strength>=.3&&
      (section?.look==='peak'||energy>=.72)&&(event?.driving||phrase.movement.driving>=.5||phrase.movement.percussive);

    const prominence=clamp((finite(arrangement.eventSalience?.[index],0)-(motives[phraseIndex]?.salience??.35))/.4);
    let drive=1;
    let reason;
    if(directed){
      while(barIndex<downbeats.length&&downbeats[barIndex]<time-.04)barIndex++;
      const onBar=Math.abs((downbeats[barIndex]??Infinity)-time)<=.04;
      const motive=motives[phraseIndex];
      const entrance=motive.changed&&lastEntry!==phraseIndex;
      const standout=finite(arrangement.accents?.[index],0)>=motive.threshold;
      const rise=(dramaAt(arrangement.drama,time)?.intensity??0)-(dramaAt(arrangement.drama,Math.max(section?.start??0,time-2))?.intensity??0);
      const building=section?.look==='lift'&&event?.kind==='build'&&(event.development||onBar&&rise>=.08);
      if(!entrance&&!standout&&!building&&!groove)continue;
      reason=event?.development?'build-development':groove?'groove':entrance?'musical-change':building?'build':'strong-accent';
    }
    const previous=cues.at(-1),gap=time-previous.time;
    if(gap<(groove?.65:Math.max(profile.spacing,design?.spacing??0,atmospheric?4:0,calm?1.5:kind==='sweep'?.75:.38)))continue;
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
    if(groove){
      const beat=beatPosition(motionGrid,time)??index;
      let phaseBeat=beat;
      if(mood!=='disco'){
        // Keep turns on a musical subdivision. Energy chooses a phrase-level
        // pace, rather than shifting the phase at every individual drum hit.
        if(lastGrooveBeat===null||groovePhrase!==phraseIndex){
          const phraseEnergy=dramaAt(arrangement.drama,phrase.start+.5)?.intensity??phrase.energy??energy;
          drive=phraseEnergy>=.85?2:phraseEnergy<.65?.5:1;
        }else drive=lastDrive;
        if(lastGrooveBeat===null)motionBeat=Math.max(0,beat-(beatPosition(motionGrid,phrase.start)??beat))*drive;
        else {
          const boundary=beatPosition(motionGrid,phrase.start)??beat;
          const split=groovePhrase!==phraseIndex?clamp(boundary,lastGrooveBeat,beat):beat;
          motionBeat+=(split-lastGrooveBeat)*lastDrive+(beat-split)*drive;
        }
        lastGrooveBeat=beat;lastDrive=drive;groovePhrase=phraseIndex;phaseBeat=motionBeat;
      }
      pose=groovePose(phaseBeat,{energy,strength,percussion,vocals,span:profile.span,formation:directionDesign?.formation||(mood==='disco'?'ribbon':'pairs'),shape:directionDesign?.shape||'sweep',progress:section?clamp((time-section.start)/Math.max(.1,section.end-section.start)):progress,period:mood==='disco'?4:(directionDesign?.period||16)});
    }else if(design&&!event?.development){
      const sectionProgress=section?clamp((time-section.start)/Math.max(.1,section.end-section.start)):progress;
      const phraseBeat=(beatPosition(motionGrid,time)??time*2)-(beatPosition(motionGrid,phrase.start)??phrase.start*2);
      pose=directedPose(design,Math.floor(phraseBeat/4),sectionProgress).map(p=>({pan:clamp(p.pan*profile.span,-42,42),tilt:clamp(.8+(p.tilt-.8)*Math.min(1,profile.span),.55,1.15)}));
    }
    if(directed&&(design||groove)){
      const spatialBeat=beatPosition(motionGrid,time)??time*2;
      pose=spatialPose(pose,spatialBeat,{energy,span:profile.span});
    }
    if(!groove){lastGrooveBeat=null;groovePhrase=-1;}
    // Account for the peak speed of each interpolation curve. Short intervals
    // reduce travel distance so a target is reachable exactly at its cue.
    const speed=Math.min(profile.speed,groove?.75+.25*strength:design?.speed??1,atmospheric?.3:1);
    // Bound anticipation; a future accent must not pull the heads through an
    // unrelated quiet passage. Reduce distance when the motor cannot arrive.
    // Connected rhythmic journeys fill their interval. Isolated gestures
    // retain bounded anticipation, so genuine quiet gaps still hold.
    const connected=groove&&mood!=='disco'&&previous.reason==='groove'&&sustained(previous.time,time);
    const available=directed?Math.min(gap,event?.development?2:calm?1.5:groove?(connected?gap:1.2):.6):gap;
    const fraction=motionReach(previous.pose,pose,available,speed);
    const reachable=pose.map((p,i)=>({pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*fraction,tilt:previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*fraction}));
    cues.push({time,...(reason?{reason}:{}),...(directed?{shape:directionDesign?.shape||'sweep'}:{}),...(groove&&mood!=='disco'?{drive,settle:prominence>.75?.95:prominence*.7}:{}),travel:groove?available:Math.min(available,Math.max(profile.travel,design?.travel??0,atmospheric?3:0,calm?.8:.2,motionDuration(previous.pose,reachable,speed))),pose:reachable});
    if(directed)lastEntry=phraseIndex;
    ordinal++;
  }
  return cues;
}
export function movingCueAt(cues,time){
  let lo=0,hi=cues.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].time<=time)lo=mid+1;else hi=mid;}
  const previous=cues[Math.max(0,lo-1)],next=cues[lo];
  if(!next||time<=next.time-next.travel)return previous.pose;
  const phase=clamp((time-(next.time-next.travel))/next.travel);
  if(next.reason!=='groove'){
    // Zero velocity AND acceleration at an isolated move's endpoints.
    const ease=phase*phase*phase*(phase*(phase*6-15)+10);
    return previous.pose.map((p,i)=>({pan:p.pan+(next.pose[i].pan-p.pan)*ease,tilt:p.tilt+(next.pose[i].tilt-p.tilt)*ease}));
  }
  const tangent=(index,head,key)=>{
    const a=cues[index-1],b=cues[index],c=cues[index+1];
    if(!a||!c||b.reason!=='groove'||c.reason!=='groove'||
      Math.abs(b.travel-(b.time-a.time))>1e-6||Math.abs(c.travel-(c.time-b.time))>1e-6)return 0;
    return motionTangent(a.pose[head][key],b.pose[head][key],c.pose[head][key],b.time-a.time,c.time-b.time)*(1-(b.settle??0));
  };
  return previous.pose.map((p,i)=>Object.fromEntries(['pan','tilt'].map(key=>[key,
    motionQuintic(p[key],next.pose[i][key],tangent(lo-1,i,key),tangent(lo,i,key),next.travel,phase)])));
}
