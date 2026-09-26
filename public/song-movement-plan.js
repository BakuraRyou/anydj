import {lightingScenes} from './dmx-light-scenes.js';
export const SONG_MOVEMENT_VERSION=1;
export const GROUP_COMPOSITIONS=['curtain','mirror-pairs','traveling-group','frame-center','question-answer','gather','diagonal-sweep','depth-wave','rotating-fan','crossed-banks'];
const compositionFor={'counter-fans':'mirror-pairs','traveling-wave':'traveling-group','opening-arch':'rotating-fan','diagonal-curtain':'curtain','braided-pairs':'crossed-banks',orbit:'frame-center','folding-gates':'diagonal-sweep','rising-steps':'depth-wave',ripple:'gather','crossing-ribbons':'question-answer'};
export const GROUP_MOTIONS=['counter-fans','traveling-wave','opening-arch','diagonal-curtain','braided-pairs','orbit','folding-gates','rising-steps','ripple','crossing-ribbons'];
// Affinities: energy, rhythmic drive, vocals, spectral brightness. Selection is
// made once per musical passage, never per rendered frame or fixture count.
const affinities=[[.7,.8,.2,.4],[.5,.6,.4,.6],[.5,.3,.6,.5],[.6,.5,.3,.8],[.8,.8,.2,.6],[.5,.3,.4,.7],[.8,.7,.2,.3],[.6,.6,.3,.5],[.4,.4,.6,.7],[.9,.9,.1,.5]];

const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
// An immutable, serializable interpretation prepared with the audio analysis.
// Room dimensions, fixture count and playback time never choose the song style.
export function planSongMovement(plan){
 const scenes=lightingScenes(plan),active=scenes.filter(s=>s.kind!=='silence');
 const duration=active.reduce((n,s)=>n+s.end-s.start,0);
 const mean=key=>active.reduce((n,s)=>n+clamp(s[key])*(s.end-s.start),0)/Math.max(.001,duration);
 const energy=mean('energy'),drive=mean('drive'),vocals=mean('vocals');
 const character=drive>=.6&&energy>=.55?'driving':drive>=.45?'rhythmic':energy>=.4?'flowing':'restrained';
 const preferred=character==='driving'?['diagonal-sweep','crossed-banks','depth-wave','rotating-fan']:character==='rhythmic'?['mirror-pairs','traveling-group','question-answer']:['frame-center','gather','curtain'];
 const result={version:SONG_MOVEMENT_VERSION,character,energy,drive,vocals,preferred,passages:scenes.map(s=>{
  const still=s.kind==='silence'||s.kind==='sculpture';
  const intensity=clamp(.3*energy+.7*s.energy),rhythm=clamp(s.drive);
  return {start:s.start,end:s.end,role:s.kind,character:still?'restrained':character,
   extent:still?1:1+.5*intensity*rhythm,
   pace:still?1:1+.4*intensity*rhythm,
   articulation:still?0:.15+.3*intensity*rhythm,
   preferred:still?[]:preferred};
 })};
 // Persist the chosen trajectories as well as the musical intent. Playback
 // only evaluates these gestures and fits them into the installed room.
 result.passages=selectGroupScore({...plan,songMovement:result}).map(({intent,...passage})=>({...intent,...passage}));
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
 const passages=[];
 for(const scene of lightingScenes(plan)){
  const previous=passages.at(-1);
  if(previous&&previous.groupIndex===scene.groupIndex&&previous.end===scene.start){previous.end=scene.end;continue;}
  passages.push({...scene});
 }
 const uses=new Map();let last=null;
 const score=passages.map(p=>{
  const active=p.kind!=='silence'&&p.kind!=='sculpture';
  const features=[p.energy,p.drive,p.vocals,p.tone],intent=songMovementAt(plan,p.start);
  const motion=active?GROUP_MOTIONS.map((name,i)=>({name,cost:features.reduce((s,v,j)=>s+Math.abs(v-affinities[i][j]),0)+
   (intent?.preferred.length&&!intent.preferred.includes(compositionFor[name])?.8:0)+(uses.get(name)||0)*.3+(last===name?.7:0)+(p.kind==='build'&&['opening-arch','rising-steps'].includes(name)?-.7:0)})).sort((a,b)=>a.cost-b.cost)[0].name:null;
  if(motion){uses.set(motion,(uses.get(motion)||0)+1);last=motion;}
  return {start:p.start,end:p.end,motion,composition:compositionFor[motion]??null,intent,energy:p.energy,drive:p.drive,direction:p.direction??1,groupIndex:p.groupIndex};
 });
 return score;
}
