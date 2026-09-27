import {musicalAttention,offbeatAttacks,bassAttackEvents} from './musical-attention.js';
import {lightingScenes} from './dmx-light-scenes.js';
export const SONG_MOVEMENT_VERSION=8;
export const GROUP_COMPOSITIONS=['curtain','mirror-pairs','traveling-group','frame-center','question-answer','gather','diagonal-sweep','depth-wave','rotating-fan','crossed-banks','parallel-sweep','breathing-arch','hinged-lines','opening-lines','rising-fan'];
const compositionFor={'counter-fans':'mirror-pairs','traveling-wave':'traveling-group','opening-arch':'rotating-fan','diagonal-curtain':'curtain','braided-pairs':'crossed-banks',orbit:'frame-center','folding-gates':'diagonal-sweep','rising-steps':'depth-wave',ripple:'gather','crossing-ribbons':'question-answer','unison-sweep':'parallel-sweep','breathing-arch':'breathing-arch','hinged-lines':'hinged-lines','opening-lines':'opening-lines','rising-fan':'rising-fan'};
export const GROUP_MOTIONS=['counter-fans','traveling-wave','opening-arch','diagonal-curtain','braided-pairs','orbit','folding-gates','rising-steps','ripple','crossing-ribbons','unison-sweep','breathing-arch','hinged-lines','opening-lines','rising-fan'];
// Affinities: energy, rhythmic drive, vocals, spectral brightness. Selection is
// made once per musical passage, never per rendered frame or fixture count.
const affinities=[[.7,.8,.2,.4],[.5,.6,.4,.6],[.5,.3,.6,.5],[.6,.5,.3,.8],[.8,.8,.2,.6],[.5,.3,.4,.7],[.8,.7,.2,.3],[.6,.6,.3,.5],[.4,.4,.6,.7],[.9,.9,.1,.5],[.8,.85,.3,.5],[.5,.4,.6,.5],[.7,.65,.3,.65],[.55,.4,.4,.5],[.65,.5,.3,.6]];

const coordination=p=>p.kind==='build'?'build':p.developing||p.kind==='sweep'||p.kind==='groove'&&p.energy<.65?'ordered':'layered';
const family=name=>['opening-arch','counter-fans','opening-lines'].includes(name)?'fan':['diagonal-curtain','traveling-wave','unison-sweep'].includes(name)?'line':['orbit','ripple'].includes(name)?'frame':['breathing-arch','rising-fan'].includes(name)?'arch':'crossing';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
// An immutable, serializable interpretation prepared with the audio analysis.
// Room dimensions, fixture count and playback time never choose the song style.
export function planSongMovement(plan,windows=[]){
 const scenes=movementPassages(plan),attacks=measuredAttacks(plan,windows),active=scenes.filter(s=>s.kind!=='silence');
 const duration=active.reduce((n,s)=>n+s.end-s.start,0);
 const mean=key=>active.reduce((n,s)=>n+clamp(s[key])*(s.end-s.start),0)/Math.max(.001,duration);
 const energy=mean('energy'),drive=mean('drive'),vocals=mean('vocals');
 const character=drive>=.6&&energy>=.55?'driving':drive>=.45?'rhythmic':energy>=.4?'flowing':'restrained';
 const preferred=character==='driving'?['diagonal-sweep','crossed-banks','depth-wave','rotating-fan','parallel-sweep','hinged-lines']:character==='rhythmic'?['mirror-pairs','traveling-group','question-answer','parallel-sweep']:['frame-center','gather','curtain','breathing-arch'];
 const result={version:SONG_MOVEMENT_VERSION,character,energy,drive,vocals,preferred,passages:scenes.map(s=>{
  const still=s.kind==='silence'||s.kind==='sculpture'&&!s.developing;
  const intensity=clamp(.3*energy+.7*s.energy),rhythm=clamp(s.drive);
  const local=attacks.filter(e=>e.time>=s.start&&e.time<s.end);
  const seconds=Math.max(.1,s.end-s.start),rate=local.length/seconds;
  const beats=(plan.beatGrid?.beats||[]).filter(t=>t>=s.start&&t<s.end);
  const beatRate=beats.length>=2?(beats.length-1)/(beats.at(-1)-beats[0]):0;
  const density=clamp(rate/4),confidence=clamp(local.length/6);
  const subdivisions=beatRate?rate/beatRate:null;
  const rhythmKind=rate<.4?'sparse':subdivisions!==null&&subdivisions>1.35?'subdivided':density>.65?'dense':'steady';
  const attention=musicalAttention(plan.structure?.instruments,s.start,s.end);
  const accents=local.map(e=>({...e}));
  // Attack activity is independent of loudness and dimmer strength.
  const motionDrive=still||s.developing?0:Math.max(rhythm*clamp((s.energy-.35)/.4),density*confidence);
  const preferredForms=density>.65&&confidence>.5?['depth-wave','crossed-banks','diagonal-sweep','parallel-sweep','hinged-lines']:preferred;
  return {start:s.start,end:s.end,developing:!!s.developing,coordination:coordination(s),symmetry:'paired',role:s.kind,character:still?'restrained':character,
   extent:still?1:1+.4*intensity*rhythm+.15*density*confidence,
   pace:still?1:1+.25*intensity*rhythm+.15*density*confidence,
   articulation:still||coordination(s)==='build'?0:coordination(s)==='ordered'?.08:.15+.3*intensity*rhythm,
   rhythm:{rate,density,subdivisions,confidence,kind:rhythmKind},motionDrive,
   attention:{leader:attention.leader,confidence:attention.confidence},accents:still?[]:accents,
   preferred:still?[]:s.developing?['curtain','frame-center','breathing-arch']:preferredForms};
 })};
 // Persist the chosen trajectories as well as the musical intent. Playback
 // only evaluates these gestures and fits them into the installed room.
 result.passages=selectGroupScore({...plan,songMovement:result}).map(({intent,...passage})=>({...intent,...passage}));
 // Evidence at the incoming boundary decides whether a quicker handover is
 // justified. A section label alone never causes a hard direction change.
 for(let i=1;i<result.passages.length;i++){
  const p=result.passages[i],previous=result.passages[i-1];
  const contrast=clamp((p.energy-previous.energy)/.35);
  const arrival=attacks.filter(e=>Math.abs(e.time-p.start)<=.3).reduce((m,e)=>Math.max(m,e.strength),0);
  const confidence=Math.min(contrast,arrival),importance=contrast*arrival;
  p.transition={importance,confidence,overlap:p.development?.index?3:confidence>.65? .7:1.8};
  if(previous.motion&&p.motion&&confidence>.65){
   const lead=Math.min(1.2,(previous.end-previous.start)*.2);
   previous.anticipation={start:p.start-lead,end:p.start,strength:importance};
  }
 }
 return result;
}
export function songMovementAt(plan,time){
 const score=plan?.songMovement;
 if(score?.version!==SONG_MOVEMENT_VERSION||!Number.isFinite(time))return null;
 const passages=score.passages;let lo=0,hi=passages.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(passages[mid].start<=time)lo=mid+1;else hi=mid;}
 const p=passages[lo-1];return p&&time<p.end?p:null;
}

export function selectGroupScore(plan){
 if(!plan)return [];
 const passages=movementPassages(plan);
 const history=[],motifs=new Map();let last=null;
 const score=passages.map(p=>{
  const active=p.kind!=='silence'&&(p.kind!=='sculpture'||p.developing);
  const features=[p.energy,p.drive,p.vocals,p.tone],intent=songMovementAt(plan,p.start);
  const motifKey=p.motif==null?null:String(p.motif)+':'+p.kind;
  const recalled=motifs.get(motifKey);
  // Recently exposed geometry should not dominate merely because the motif
  // repeats. History is computed on the song timeline, never during playback.
  const exposure=name=>history.reduce((sum,h)=>sum+(h.motion===name?(h.end-h.start)*clamp(1-(p.start-h.end)/72):0),0);
  const compatible=recalled&&last!==recalled.motion&&exposure(recalled.motion)<24&&motionFits(p,recalled.motion)&&Math.abs(recalled.energy-p.energy)<.18&&Math.abs(recalled.drive-p.drive)<.18&&Math.abs(recalled.tone-p.tone)<.18&&Math.abs((recalled.density??0)-(intent?.rhythm.density??0))<.2;
  const motion=active?compatible?recalled.motion:GROUP_MOTIONS.map((name,i)=>({name,cost:features.reduce((s,v,j)=>s+Math.abs(v-affinities[i][j]),0)+
   (intent?.preferred.length&&!intent.preferred.includes(compositionFor[name])?.8:0)+exposure(name)/18+history.reduce((sum,h)=>sum+(family(h.motion)===family(name)?(h.end-h.start)*clamp(1-(p.start-h.end)/48)/48:0),0)+(last===name?1.2:0)})).filter(({name})=>motionFits(p,name)&&(!p.development?.index||name!==last)).sort((a,b)=>a.cost-b.cost)[0].name:null;
  if(motion&&motifKey!==null&&!recalled)motifs.set(motifKey,{...p,motion,density:intent?.rhythm.density??0});
  if(motion){history.push({motion,start:p.start,end:p.end});last=motion;}
  while(history.length&&history[0].end<p.start-72)history.shift();
  return {start:p.start,end:p.end,...(p.development?{development:p.development}:{}),motion,composition:compositionFor[motion]??null,coordination:coordination(p),intent,energy:p.energy,drive:p.drive,direction:p.direction??1,groupIndex:p.groupIndex,motif:p.motif??null,recalled:!!(active&&compatible)};
 });
 return score;
}

function movementPassages(plan){
 const passages=[];
 for(const original of lightingScenes(plan)){
  const section=plan.sections?.[original.sectionIndex];
  // Reduced energy is not a motor hold. Preserve a small shared gesture only
  // with measured activity and an active authored look; missing analysis and
  // explicit quiet/held passages still remain stationary.
  const developing=original.kind==='sculpture'&&original.evidence&&original.energy>=.18&&original.drive>=.15&&['flow','lift','peak'].includes(section?.look);
  const scene={...original,developing};
  const previous=passages.at(-1);
  if(previous&&previous.groupIndex===scene.groupIndex&&previous.developing===developing&&previous.end===scene.start){previous.end=scene.end;continue;}
  passages.push({...scene});
 }
 return passages.flatMap(p=>developPassage(plan,p));
}

// Long unchanging material gets an authored arc. Prefer phrase/arrangement
// events near a useful dwell time; without events a slow handover is still
// possible. This is not a playback timer or a fixed number of bars.
function developPassage(plan,passage){
 const duration=passage.end-passage.start;
 if(duration<=36||passage.kind==='build'||passage.kind==='silence'||passage.kind==='sculpture'&&!passage.developing)return [passage];
 const phrases=plan.arrangement?.patterns?.phrases||[];
 const candidates=phrases.slice(1).map((p,i)=>({time:p.start,kind:'phrase',salience:clamp(Math.abs((p.energy??0)-(phrases[i].energy??0))+Math.abs((p.tone??0)-(phrases[i].tone??0)))}));
 for(const event of plan.arrangement?.developments||[])candidates.push({time:event.time,kind:'development',salience:clamp(event.progress??0)});
 const parts=[];let start=passage.start,boundary='passage';
 while(passage.end-start>30){
  const progress=(start-passage.start)/duration;
  const dwell=(18+8*(1-passage.drive)+4*(1-passage.energy))*(.85+.3*Math.sin(progress*Math.PI));
  const preferred=start+dwell;
  const available=candidates.filter(c=>Number.isFinite(c.time)&&c.time>=start+12&&c.time<=Math.min(start+30,passage.end-10));
  available.sort((a,b)=>(Math.abs(a.time-preferred)-a.salience*4)-(Math.abs(b.time-preferred)-b.salience*4)||a.time-b.time);
  const next=available[0]??{time:Math.min(preferred,passage.end-12),kind:'gradual'};
  parts.push({...passage,start,end:next.time,development:{index:parts.length,boundary}});
  start=next.time;boundary=next.kind;
 }
 parts.push({...passage,start,development:{index:parts.length,boundary}});
 return parts;
}

function measuredAttacks(plan,windows){
 const levels=windows.map(w=>w.rms||0).filter(Number.isFinite).sort((a,b)=>a-b);
 const reference=Math.max(.015,levels[Math.floor(levels.length*.95)]??0);
 const bass=plan.arrangement?.bassAttacks??bassAttackEvents(windows.map(w=>w.bass||0),.02);
 const instruments=plan.structure?.instruments;
 const drums=instruments?bassAttackEvents(instruments.drums,instruments.step):[];
 const candidates=[...drums,...bass].map(e=>({time:e.time,strength:clamp(e.strength)}));
 candidates.push(...offbeatAttacks(windows,plan.duration,reference).map(e=>({time:e.time,strength:clamp(e.impact)})));
 candidates.sort((a,b)=>a.time-b.time);
 const result=[];
 for(const e of candidates){
  if(!Number.isFinite(e.time)||e.time<0||e.time>=plan.duration||e.strength<.15)continue;
  const previous=result.at(-1);
  if(previous&&e.time-previous.time<.08){if(e.strength>previous.strength)result[result.length-1]=e;}
  else result.push(e);
 }
 return result;
}

// A bounded, temporary accent changes reach, never the shared movement clock.
// Dense percussion cannot accumulate phase drift or unlimited acceleration.
export function movementAccentEnvelope(intent,time){
 const events=intent?.accents;if(!events?.length)return 0;
 let lo=0,hi=events.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].time<=time)lo=mid+1;else hi=mid;}
 let value=0;
 for(let i=lo-1;i>=0&&time-events[i].time<.6;i--){
  const t=clamp((time-events[i].time)/.6);
  value+=events[i].strength*64*t*t*t*(1-t)**3;
 }
 return value/(1+value);
}

function motionFits(p,name){
 if(coordination(p)==='build')return ['opening-lines','rising-fan'].includes(name);
 if(['opening-lines','rising-fan'].includes(name))return false;
 if(coordination(p)==='ordered'&&!p.developing)return ['diagonal-curtain','orbit','counter-fans','opening-arch','unison-sweep','breathing-arch','hinged-lines'].includes(name);
 if(p.developing)return ['diagonal-curtain','orbit','breathing-arch'].includes(name);
 if(['diagonal-curtain','orbit','traveling-wave'].includes(name)&&p.energy>=.65&&p.drive>=.6)return false;
 return name!=='ripple'||p.kind==='build'||p.energy<.65;
}
