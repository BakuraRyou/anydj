import {planShowScore,showScorePose} from './show-score.js';
import {lightingScenes,scenePose,lightingGestures,gesturePose,musicalMovementEvents} from './dmx-light-scenes.js';
import {movingDirections,directedPose,groovePose,spatialPose} from './dmx-moving-direction.js';
import {beatPosition} from './dmx-show.js';
import {restingHeads,motionTangent,motionQuintic,motionDuration,motionReach} from './dmx-moving-model.js';
import {dramaAt} from './instrument-activity.js';
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
const continuous=cue=>cue?.continuous||cue?.reason==='groove';
// Choose destinations from acoustically selected events, never every grid beat.
// Travel ends ON the event. Quiet gaps hold the last destination.
export function movingCues(plan,mode,mood='balanced'){
  if(mode==='auto'&&movingMood(mood)==='show')return showMovingCues(plan);
  if(mode==='auto'&&movingMood(mood)==='balanced'){const conducted=barMovingCues(plan);if(conducted)return conducted;}
  return patternMovingCues(plan,mode,mood);
}
// Pattern engine retained for the explicitly selected alternative moods/modes.
export function patternMovingCues(plan,mode,mood='balanced'){
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
    const atmospheric=!event?.development&&mode==='auto'&&mood==='balanced'&&(directionDesign?.category==='atmospheric'||['held','quiet','break','outro'].includes(section?.look));
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
      (event?.driving||phrase.movement.driving>=.5||phrase.movement.percussive);

    const flowing=directed&&design&&!groove&&!event?.development&&!['held','break'].includes(section?.look)&&energy>=.2;
    const prominence=clamp((finite(arrangement.eventSalience?.[index],0)-(motives[phraseIndex]?.salience??.35))/.4);
    let drive=1;
    let reason;
    if(directed){
      while(barIndex<downbeats.length&&downbeats[barIndex]<time-.04)barIndex++;
      const onBar=Math.abs((downbeats[barIndex]??Infinity)-time)<=.04;
      const motive=motives[phraseIndex];
      const entrance=(design?phraseIndex===0||phrases[phraseIndex-1]?.section!==phrase.section:motive.changed)&&lastEntry!==phraseIndex;
      const standout=finite(arrangement.accents?.[index],0)>=motive.threshold;
      const rise=(dramaAt(arrangement.drama,time)?.intensity??0)-(dramaAt(arrangement.drama,Math.max(section?.start??0,time-2))?.intensity??0);
      const building=section?.look==='lift'&&event?.kind==='build'&&(event.development||onBar&&rise>=.08);
      if(!entrance&&!standout&&!building&&!groove&&!flowing)continue;
      reason=event?.development?'build-development':groove?'groove':entrance?'musical-change':building?'build':standout?'strong-accent':'section-flow';
    }
    const previous=cues.at(-1),gap=time-previous.time;
    const featured=directed&&!calm&&(reason==='strong-accent'||prominence>.65);
    if(gap<(featured?.38:groove?.65:flowing&&reason==='section-flow'?1:Math.max(profile.spacing,design?.spacing??0,atmospheric?4:0,calm?1.5:kind==='sweep'?.75:.38)))continue;
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
          const phraseEnergy=directionDesign?.energy??dramaAt(arrangement.drama,phrase.start+.5)?.intensity??phrase.energy??energy;
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
      const phraseBeat=(beatPosition(motionGrid,time)??time*2)-(beatPosition(motionGrid,section?.start??phrase.start)??(section?.start??phrase.start)*2);
      pose=(flowing?groovePose(phraseBeat,{energy,strength,percussion,vocals,span:1,formation:design.formation,shape:design.shape,period:design.period,progress:sectionProgress}):directedPose(design,Math.floor(phraseBeat/4),sectionProgress)).map(p=>({pan:clamp(p.pan*profile.span,-42,42),tilt:clamp(.8+(p.tilt-.8)*Math.min(1,profile.span),.55,1.15)}));
    }
    if(directed&&(design||groove)){
      const spatialBeat=beatPosition(motionGrid,time)??time*2;
      pose=spatialPose(pose,spatialBeat,{energy,span:profile.span,coherent:calm,asymmetry:clamp((directionDesign?.asymmetry??.3)+(mood==='disco'?.2:0))});
      // Keep the section's figure, but let its current musical articulation
      // change the reach and depth. This is part of the planned cue, before
      // motor limits, never an extra wall-clock oscillator or brightness pulse.
      const sectionEnergy=directionDesign?.energy??energy;
      const lift=clamp((energy-sectionEnergy)*1.8,-.35,.35);
      const emphasis=featured?prominence*.12:0;
      const reach=clamp(.82+.18*strength+lift*.3+emphasis,.65,1.12);
      pose=pose.map((p,i)=>({pan:clamp(p.pan*reach,-42,42),
        tilt:clamp(p.tilt+lift*(calm?.08:i===0||i===3?.13:.08)+emphasis*(i===0||i===3?.2:-.1),.55,1.15)}));
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
    const available=directed?Math.min(gap,event?.development?2:flowing?Math.min(calm?4:2,time-(section?.start??0)):calm?1.5:groove?(connected?gap:1.2):.6):gap;
    const fraction=motionReach(previous.pose,pose,available,speed);
    const reachable=pose.map((p,i)=>({pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*fraction,tilt:previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*fraction}));
    cues.push({time,...(flowing?{continuous:true,settle:prominence>.75?.6:0}:{}),...(reason?{reason}:{}),...(directed?{shape:directionDesign?.shape||'sweep'}:{}),...(groove&&mood!=='disco'?{drive,settle:prominence>.75?.95:prominence*.7}:{}),travel:groove||flowing?available:Math.min(available,Math.max(profile.travel,design?.travel??0,atmospheric?3:0,calm?.8:.2,motionDuration(previous.pose,reachable,speed))),pose:reachable});
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
  if(!continuous(next)){
    // Zero velocity AND acceleration at an isolated move's endpoints.
    return previous.pose.map((p,i)=>{
      const t=next.headTravel?clamp((time-(next.time-next.headTravel[i]))/next.headTravel[i]):phase;
      const ease=t*t*t*(t*(t*6-15)+10);
      return {pan:p.pan+(next.pose[i].pan-p.pan)*ease,tilt:p.tilt+(next.pose[i].tilt-p.tilt)*ease,...(p.focus!==undefined||next.pose[i].focus!==undefined?{focus:(p.focus??0)+((next.pose[i].focus??0)-(p.focus??0))*ease}:{})};
    });
  }
  const tangent=(index,head,key)=>{
    const a=cues[index-1],b=cues[index],c=cues[index+1];
    if(!a||!c||!continuous(b)||!continuous(c)||
      Math.abs(b.travel-(b.time-a.time))>1e-6||Math.abs(c.travel-(c.time-b.time))>1e-6)return 0;
    const u=(b.pose[head][key]-a.pose[head][key])/(b.time-a.time),v=(c.pose[head][key]-b.pose[head][key])/(c.time-b.time);
    return motionTangent(a.pose[head][key],b.pose[head][key],c.pose[head][key],b.time-a.time,c.time-b.time)?2*u*v/(u+v)*(1-(b.settle??0)):0;
  };
  const curvature=(index,head,key)=>{
    const a=cues[index-1],b=cues[index],c=cues[index+1];
    if(!a||!c||!continuous(b)||!continuous(c)||Math.abs(b.travel-(b.time-a.time))>1e-6||Math.abs(c.travel-(c.time-b.time))>1e-6)return 0;
    const left=b.time-a.time,right=c.time-b.time,u=(b.pose[head][key]-a.pose[head][key])/left,v=(c.pose[head][key]-b.pose[head][key])/right;
    if(Math.abs(u)<1e-9||Math.abs(v)<1e-9)return 0;
    return 2*(v-u)/(left+right)*(1-(b.settle??0));
  };
  return previous.pose.map((p,i)=>Object.fromEntries(['pan','tilt'].map(key=>[key,
    motionQuintic(p[key],next.pose[i][key],tangent(lo-1,i,key),tangent(lo,i,key),next.travel,phase,curvature(lo-1,i,key),curvature(lo,i,key))])));
}

// Shared musical events drive short authored gestures. Quiet scenes keep
// their existing movement path; each rhythmic role gets its own start time.
export {musicalMovementEvents} from './dmx-light-scenes.js';
export function barMovingCues(plan){
 const scenes=lightingScenes(plan);if(!scenes.length)return null;
 const bars=(plan.beatGrid?.downbeats||[]).filter(t=>Number.isFinite(t)&&t>=0&&t<=plan.duration);
 const gestures=lightingGestures(plan),gestureByTime=new Map(gestures.map(g=>[g.time,g]));
 const initial=gestureByTime.has(0)?gesturePose(gestureByTime.get(0)):scenes[0].start===0?scenePose(scenes[0],0):restingHeads();
 const cues=[{time:0,travel:0,pose:initial,reason:'scene-entry',scene:scenes[0].kind,section:0}];
 // Phrases establish images; rhythmic pictures develop on measured downbeats
 // with short holds instead of staying frozen for an entire verse or chorus.
 const entries=scenes.filter(s=>s.start>0).map(s=>({time:s.start,kind:'entry'}));
 const events=musicalMovementEvents(plan,bars).filter(e=>!entries.some(s=>Math.abs(s.time-e.time)<.01));
 for(const event of [...events,...entries].sort((a,b)=>a.time-b.time)){
  const time=event.time,scene=scenes.find(s=>time>=s.start&&time<s.end);if(!scene)continue;
  if(scene.kind==='silence')continue;
  const edit=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end);
  const movement=edit?.movement??1;if(movement<=0)continue;
  const entry=event.kind==='entry',cinematic=scene.cinematic,rhythmic=!cinematic&&['groove','impact'].includes(scene.kind)&&scene.drive>=.45;
  if(cinematic&&!entry&&!['expression','accent'].includes(event.kind))continue;
  if(!entry&&!rhythmic&&!cinematic&&!['build','sweep'].includes(scene.kind))continue;
  if(!entry&&event.kind==='accent'&&!rhythmic&&!cinematic)continue;
  if(!entry&&event.kind==='development'&&scene.kind!=='build')continue;
  const authored=rhythmic?gestureByTime.get(time):null;
  if(rhythmic&&!authored)continue;
  if(!entry&&!rhythmic&&event.kind==='bar'&&event.bar%2)continue;
  const poseTime=event.kind==='development'&&scene.kind==='build'?scene.start+event.progress*(scene.end-scene.start):time;
  const previous=cues.at(-1),gap=time-previous.time;
  const desired=authored?gesturePose(authored):scenePose(scene,poseTime);
  const target=desired.map((p,i)=>({pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*Math.min(1.6,movement),tilt:clamp(previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*Math.min(1.6,movement))}));
  if(gap<=0)continue;
  const distance=Math.max(...target.map((p,i)=>Math.max(Math.abs(p.pan-previous.pose[i].pan),Math.abs(p.tilt-previous.pose[i].tilt)*90)));
  if(distance<.01)continue;
  const frozenUntil=Math.max(0,...(plan.sectionLighting||[]).filter(s=>s.movement===0&&s.end<=time).map(s=>s.end));
  const available=Math.min(time-frozenUntil,authored?Math.min(gap*.82,authored.seconds):cinematic?Math.min(gap,2.8):entry?Math.min(gap,Math.max(.5,motionDuration(previous.pose,target,.65))):Math.min(gap*.85,3,time-scene.start));
  if(available<=0)continue;
  const headTravel=authored?target.map((_,i)=>available*(authored.coordinated||authored.lead.includes(i)?1:.8)):null;
  const sharedReach=authored?.coordinated?motionReach(previous.pose,target,available,.85):null;
  const pose=target.map((p,i)=>{
   const reach=sharedReach??motionReach([previous.pose[i]],[p],headTravel?.[i]??available,authored ? .85 : .65);
   return {pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*reach,tilt:previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*reach};
  });
  cues.push({time,travel:available,pose,...(authored?{headTravel,formation:authored.formation,coordinated:authored.coordinated,gesture:authored.name,leader:authored.leader,group:authored.group}:{}),scene:scene.kind,shape:scene.kind,section:scene.sectionIndex,
   reason:entry?'scene-entry':cinematic?'cinematic-development':event.kind==='development'?'build-development':rhythmic?'scene-rhythm':'scene-development',
   ...(entry&&!cinematic&&distance>18&&scene.drive<.45?{darkTravel:true}:{}),purpose:entry?'establish':scene.kind==='build'?'build':rhythmic?'groove':'sweep'});
 }
 return cues;
}

// Fade out before a relocation starts, travel dark, then reveal the arrival.
// Ordinary expressive movement keeps its light; this is not a beat blackout.
export function movingCueExposure(cues,time){
 if(!cues?.length||!Number.isFinite(time))return {level:1,transfer:false};
 let lo=0,hi=cues.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].time<=time)lo=mid+1;else hi=mid;}
 const previous=cues[Math.max(0,lo-1)],next=cues[lo];
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 let level=1,transfer=false;
 if(previous.darkTravel&&time<previous.time+.3){level=smooth((time-previous.time)/.3);transfer=true;}
 if(next?.darkTravel){
  const start=next.time-next.travel;
  if(time>=start-.18){level=Math.min(level,1-smooth((time-(start-.18))/.18));transfer=time>=start||transfer;}
 }
 return {level,transfer};
}


// Develop a shared formation on measured musical time. Repositioning between surfaces is
// revealed with the next musical/color cue, rather than sweeping lit through
// unrelated parts of the room. Manual movement holds remain authoritative.
export function showMovingCues(plan){
 const score=plan.showScore||planShowScore(plan),beats=plan.beatGrid?.beats||[],bars=plan.beatGrid?.downbeats||[];
 if(!score.length)return [{time:0,travel:0,pose:restingHeads(),reason:'show-entry'}];
 const cues=[{time:0,travel:0,pose:showScorePose(score[0],0),formation:score[0].form,surface:'floor',role:score[0].role,picture:score[0].index,reason:'show-entry'}];
 const holds=(plan.sectionLighting||[]).filter(s=>s.movement===0);
 // Unmetered developments use measured acoustic changes, never a synthetic grid.
 const expression=(plan.arrangement?.developments||[]).map(e=>e.time);
 let anchor;
 for(const sample of plan.arrangement?.motionEnvelope||[]){
  if(!anchor){anchor=sample;continue;}
  if(sample.time-anchor.time<1.6)continue;
  if(Math.abs(sample.energy-anchor.energy)>=.08||Math.abs(sample.tone-anchor.tone)>=.12||Number.isFinite(sample.pitch)&&Number.isFinite(anchor.pitch)&&Math.abs(sample.pitch-anchor.pitch)>=2){expression.push(sample.time);anchor=sample;}
 }
 const expressionTimes=new Set(expression);
 const candidates=[...new Set([...score.map(s=>s.start),...bars,...beats,...expression])].sort((a,b)=>a-b);
 for(const time of candidates){
  if(time<=0||time>plan.duration||holds.some(s=>time>=s.start&&time<s.end))continue;
  const picture=score.find(s=>time>=s.start&&time<s.end);if(!picture||picture.role==='silence')continue;
  const previous=cues.at(-1),entry=previous.picture!==picture.index;
  if(picture.role==='held'&&!entry)continue;
  // Motor arrivals are phrase/bar events. Other beats are available only to
  // establish a picture whose full target could not be reached at its entrance.
  if(!entry&&!bars.some(t=>Math.abs(t-time)<.001)&&!(['flow','build'].includes(picture.role)&&expressionTimes.has(time)))continue;
  if(!entry&&time-previous.time<(picture.role==='build'?1.5:2.5))continue;
  const edit=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end);
  const desired=showScorePose(picture,time);
  const pose=desired.map((p,i)=>({pan:previous.pose[i].pan+(p.pan-previous.pose[i].pan)*Math.min(1,edit?.movement??1),tilt:previous.pose[i].tilt+(p.tilt-previous.pose[i].tilt)*Math.min(1,edit?.movement??1),focus:(previous.pose[i].focus??0)+((p.focus??0)-(previous.pose[i].focus??0))*Math.min(1,edit?.movement??1)}));
  const required=Math.max(motionDuration(previous.pose,pose,.8),Math.abs((pose[0].focus??0)-(previous.pose[0].focus??0))*1.8);
  if(required<.08)continue;
  // A scheduled dark transfer may prepare the next entrance during a rest.
  // Explicit movement holds remain authoritative, including their endpoints.
  const blocked=holds.filter(s=>s.start<time&&s.end>previous.time);
  const earliest=Math.max(previous.time,...blocked.map(s=>Math.min(time,s.end)));
  const available=time-earliest;
  if(available+1e-8<required)continue;
  const surface=picture.role==='held'?'floor':picture.featured?'ceiling':'wall';
  const travel=Math.min(available,Math.max(required,picture.role==='held'?1.4:picture.role==='build'?2.2:1.1));
  cues.push({time,travel,pose,surface,role:picture.role,formation:picture.form,picture:picture.index,coordinated:true,
   reason:entry?'show-picture':'show-motion',...(surface!==previous.surface&&(picture.role==='held'||previous.role==='held')?{darkTravel:true}:{})});
 }
 return cues;
}
