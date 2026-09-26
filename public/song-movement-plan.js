import {musicalAttention,offbeatAttacks,bassAttackEvents} from './musical-attention.js';
import {lightingScenes} from './dmx-light-scenes.js';
export const SONG_MOVEMENT_VERSION=5;
export const GROUP_COMPOSITIONS=['curtain','mirror-pairs','traveling-group','frame-center','question-answer','gather','diagonal-sweep','depth-wave','rotating-fan','crossed-banks','parallel-sweep','breathing-arch','hinged-lines'];
const compositionFor={'counter-fans':'mirror-pairs','traveling-wave':'traveling-group','opening-arch':'rotating-fan','diagonal-curtain':'curtain','braided-pairs':'crossed-banks',orbit:'frame-center','folding-gates':'diagonal-sweep','rising-steps':'depth-wave',ripple:'gather','crossing-ribbons':'question-answer','unison-sweep':'parallel-sweep','breathing-arch':'breathing-arch','hinged-lines':'hinged-lines'};
export const GROUP_MOTIONS=['counter-fans','traveling-wave','opening-arch','diagonal-curtain','braided-pairs','orbit','folding-gates','rising-steps','ripple','crossing-ribbons','unison-sweep','breathing-arch','hinged-lines'];
// Affinities: energy, rhythmic drive, vocals, spectral brightness. Selection is
// made once per musical passage, never per rendered frame or fixture count.
const affinities=[[.7,.8,.2,.4],[.5,.6,.4,.6],[.5,.3,.6,.5],[.6,.5,.3,.8],[.8,.8,.2,.6],[.5,.3,.4,.7],[.8,.7,.2,.3],[.6,.6,.3,.5],[.4,.4,.6,.7],[.9,.9,.1,.5],[.8,.85,.3,.5],[.5,.4,.6,.5],[.7,.65,.3,.65]];

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
  const still=s.kind==='silence'||s.kind==='sculpture';
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
  const motionDrive=still?0:Math.max(rhythm*clamp((s.energy-.35)/.4),density*confidence);
  const preferredForms=density>.65&&confidence>.5?['depth-wave','crossed-banks','diagonal-sweep','parallel-sweep','hinged-lines']:preferred;
  return {start:s.start,end:s.end,symmetry:'paired',role:s.kind,character:still?'restrained':character,
   extent:still?1:1+.4*intensity*rhythm+.15*density*confidence,
   pace:still?1:1+.25*intensity*rhythm+.15*density*confidence,
   articulation:still?0:.15+.3*intensity*rhythm,
   rhythm:{rate,density,subdivisions,confidence,kind:rhythmKind},motionDrive,
   attention:{leader:attention.leader,confidence:attention.confidence},accents:still?[]:accents,
   preferred:still?[]:preferredForms};
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
  p.transition={importance,confidence,overlap:confidence>.65? .7:1.8};
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
 const uses=new Map(),motifs=new Map();let last=null;
 const score=passages.map(p=>{
  const active=p.kind!=='silence'&&p.kind!=='sculpture';
  const features=[p.energy,p.drive,p.vocals,p.tone],intent=songMovementAt(plan,p.start);
  const motifKey=p.motif==null?null:String(p.motif)+':'+p.kind;
  const recalled=motifs.get(motifKey);
  const compatible=recalled&&motionFits(p,recalled.motion)&&Math.abs(recalled.energy-p.energy)<.18&&Math.abs(recalled.drive-p.drive)<.18&&Math.abs(recalled.tone-p.tone)<.18&&Math.abs((recalled.density??0)-(intent?.rhythm.density??0))<.2;
  const motion=active?compatible?recalled.motion:GROUP_MOTIONS.map((name,i)=>({name,cost:features.reduce((s,v,j)=>s+Math.abs(v-affinities[i][j]),0)+
   (intent?.preferred.length&&!intent.preferred.includes(compositionFor[name])?.8:0)+(uses.get(name)||0)*.3+(last===name?.7:0)+(p.kind==='build'&&['opening-arch','rising-steps'].includes(name)?-.7:0)})).filter(({name})=>motionFits(p,name)).sort((a,b)=>a.cost-b.cost)[0].name:null;
  if(motion&&motifKey!==null&&!recalled)motifs.set(motifKey,{...p,motion,density:intent?.rhythm.density??0});
  if(motion){uses.set(motion,(uses.get(motion)||0)+1);last=motion;}
  return {start:p.start,end:p.end,motion,composition:compositionFor[motion]??null,intent,energy:p.energy,drive:p.drive,direction:p.direction??1,groupIndex:p.groupIndex,motif:p.motif??null,recalled:!!(active&&compatible)};
 });
 return score;
}

function movementPassages(plan){
 const passages=[];
 for(const scene of lightingScenes(plan)){
  const previous=passages.at(-1);
  if(previous&&previous.groupIndex===scene.groupIndex&&previous.end===scene.start){previous.end=scene.end;continue;}
  passages.push({...scene});
 }
 return passages;
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
 if(['diagonal-curtain','orbit','traveling-wave'].includes(name)&&p.energy>=.65&&p.drive>=.6)return false;
 return name!=='ripple'||p.kind==='build'||p.energy<.65;
}
