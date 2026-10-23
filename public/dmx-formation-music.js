import {catalogCandidates,catalogMatchScore,catalogFormation,catalogSpatialPose} from './dmx-formation-catalog.js';
import {chooseFormationScene} from './dmx-formation-scenes.js';
import {bassAttackEvents} from './musical-attention.js';

const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const cache=new WeakMap();
const samples=new WeakMap();
const windows=new WeakMap();
const names=['drums','bass','vocals','other'];
function indexAt(points,time,key='time'){
 let lo=0,hi=points.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][key]<=time)lo=mid+1;else hi=mid;}
 return Math.max(0,lo-1);
}
const reference=values=>{
 const sorted=Array.from(values??[]).filter(Number.isFinite).sort((a,b)=>a-b);
 return Math.max(.008,sorted[Math.floor((sorted.length-1)*.9)]??0);
};

// A musical transport and audible attacks have different jobs. The transport
// carries movement through sustained notes; attacks still own all light accents.
function clockPosition(clock,time){
 if(!clock?.length)return 0;
 const i=indexAt(clock,time),a=clock[i],b=clock[Math.min(i+1,clock.length-1)];
 const length=b.time-a.time;if(length<=0)return a.position;
 const t=clamp((time-a.time)/length),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a.position+(t3-2*t2+t)*length*a.velocity
  +(-2*t3+3*t2)*b.position+(t3-t2)*length*b.velocity;
}
function clockVelocities(clock){
 const slopes=clock.slice(1).map((b,i)=>(b.position-clock[i].position)/(b.time-clock[i].time));
 clock.forEach((point,i)=>{
  const left=slopes[Math.max(0,i-1)]??0,right=slopes[Math.min(slopes.length-1,i)]??left;
  point.velocity=left>0&&right>0?2/(1/left+1/right):0;
 });
}
function movementTransport(rows,beats,roles,hasStems){
 const measured=hasStems?roles.drums:roles.lead.filter(e=>e.kind!=='beat');
 const bass=roles.bass;
 const recent=(events,time)=>{
  if(!events.length)return 0;
  const at=indexAt(events,time);let count=0;
  for(let i=at;i>=0&&events[i].time>=time-1.6;i--)if(events[i].time<=time)count++;
  return count;
 };
 const grid=(beats??[]).filter(Number.isFinite).filter((t,i,a)=>i===0||t>a[i-1]);
 const clock=[];let position=0,previousRate=0,drive=0;
 for(const row of rows){
  const activity=clamp((Math.max(recent(measured,row.time),recent(bass,row.time))-1)/2);
  const percussion=clamp((Math.max(row.drums,row.bass*.8)-.12)/.38);
  const target=activity*percussion*clamp((row.energy-.18)/.55)*(1-row.vocalsShare*.5);
  const dt=clock.length?row.time-clock.at(-1).time:0;
  drive+=(target-drive)*(1-Math.exp(-dt/.22));row.movementDrive=drive;
  const at=indexAt(grid,row.time),gap=grid[at+1]-grid[at];
  // Reject implausible or missing grids. No guessed BPM accelerates the rig.
  const interval=gap>=.22&&gap<=1.5?gap:0;
  const rate=interval?((.05+.18*row.energy)*clamp(row.energy/.15)+.18*drive)/interval:0;
  position+=(previousRate+rate)*.5*dt;
  clock.push({time:row.time,position});previousRate=rate;
 }
 clockVelocities(clock);
 const beatClock=grid.length>1?grid.map((time,i)=>({time,position:i})):[];
 clockVelocities(beatClock);
 return {motionClock:clock,beatClock};
}

// This track is compiled from audio measurements, independently of selected
// scenes, room geometry, preset history and the number of previous passages.
export function formationAudioTimeline(plan){
 if(cache.has(plan))return cache.get(plan);
 const arr=plan.arrangement,env=arr?.motionEnvelope;
 const stems=plan.structure?.instruments;
 const measured=env?.some(e=>Number.isFinite(e.energy))&&
  (arr.times?.length||stems?.step>0||plan.score?.track?.length);
 if(!measured){cache.set(plan,null);return null;}
 const duration=plan.duration??env.at(-1).time;
 const impulses=(arr.times??[]).map((time,i)=>({time,strength:clamp(arr.accents?.[i]??1),
  kind:arr.eventSources?.[i]??'prepared'})).filter(e=>Number.isFinite(e.time)&&e.strength>0).sort((a,b)=>a.time-b.time);
 const roles={lead:impulses};
 for(const name of ['drums','bass','vocals'])roles[name]=stems?.step>0?bassAttackEvents(stems[name],stems.step):[];
 roles.melody=(plan.score?.notes??[]).filter(n=>Number.isFinite(n.start)&&n.end-n.start>=.12&&
  (n.confidence==null||n.confidence>=.65)).map(n=>({time:n.start,strength:clamp(n.confidence??.7)})).sort((a,b)=>a.time-b.time);
 // Stem frames have coarser resolution. Use an agreeing prepared attack's
 // exact time for drums; bass retains its independently measured syncopation.
 roles.drums=roles.drums.map(e=>{
  const at=indexAt(impulses,e.time),nearest=[impulses[at],impulses[at+1]].filter(Boolean)
   .sort((a,b)=>Math.abs(a.time-e.time)-Math.abs(b.time-e.time))[0];
  return {...e,time:nearest&&Math.abs(nearest.time-e.time)<=.12?nearest.time:e.time};
 }).sort((a,b)=>a.time-b.time);
 if(!stems)roles.drums=impulses;
 if(!roles.bass.length)roles.bass=(arr.bassAttacks??[]).filter(e=>Number.isFinite(e.time));
 const refs=Object.fromEntries(names.map(name=>[name,reference(stems?.[name])]));
 const pitch=plan.score?.track??[],rows=[];
 let envAt=0,pitchAt=0,previous=null;
 for(let time=0;time<=duration+.05;time+=.1){
  const t=Math.min(time,duration);
  while(envAt+1<env.length&&env[envAt+1].time<=t)envAt++;
  while(pitchAt+1<pitch.length&&pitch[pitchAt+1].time<=t)pitchAt++;
  const a=env[envAt],b=env[Math.min(envAt+1,env.length-1)];
  const f=clamp((t-a.time)/Math.max(.001,b.time-a.time));
  const mix=(key,fallback)=>{
   const x=Number.isFinite(a[key])?a[key]:fallback,y=Number.isFinite(b[key])?b[key]:x;
   return x+(y-x)*f;
  };
  const sample={time:t,energy:clamp(mix('energy',0)),tone:clamp(mix('tone',.5)),pitch:.5,pitchConfidence:0};
  const stemIndex=Math.max(0,Math.floor(t/(stems?.step||1)));
  const raw=names.map(name=>Math.max(0,Number(stems?.[name]?.[stemIndex])||0)),sum=raw.reduce((s,v)=>s+v,0);
  names.forEach((name,i)=>{sample[name]=clamp(raw[i]/refs[name]);sample[name+'Share']=sum>.008?raw[i]/sum:0;});
  if(!stems){
   const j=Math.floor(t/(arr.drama?.step||1));
   sample.drums=clamp(arr.drama?.percussion?.[j]);sample.vocals=clamp(arr.drama?.vocalShare?.[j]);
   sample.vocalsShare=sample.vocals;sample.drumsShare=(1-sample.vocals)*sample.drums;
   sample.otherShare=1-sample.vocalsShare-sample.drumsShare;
  }
  const note=pitch[pitchAt];
  if(note?.audible&&note.confidence>=.65&&t-note.time<.25){sample.pitch=clamp(note.position??.5);sample.pitchConfidence=clamp(note.confidence);}
  // Causal smoothing: a future hit must not widen the picture in advance.
  if(previous)for(const key of ['energy','tone',...names,...names.map(n=>n+'Share'),'pitch','pitchConfidence']){
   const rate=1-Math.exp(-(t-previous.time)/(key==='pitch'?.3:.22));
   sample[key]=previous[key]+(sample[key]-previous[key])*rate;
  }
  rows.push(sample);previous=sample;
 }
 if(rows.at(-1).time<duration)rows.push({...rows.at(-1),time:duration});
 // Musical impulses advance an unwrapped clock. A sentence ending cannot
 // force the journey to finish, restart or reverse it.
 const clock=[{time:0,position:0}];let position=0;
 for(const event of impulses){
  if(event.time<=0||event.time<=clock.at(-1).time+.04)continue;
  position+=.12+.12*event.strength;clock.push({time:event.time,position});
 }
 if(clock.at(-1).time<duration){
  const last=clock.at(-1),before=clock.at(-2),slope=before?Math.min(.12,(last.position-before.position)/(last.time-before.time)):.025;
  clock.push({time:duration,position:position+(duration-last.time)*slope});
 }
 clockVelocities(clock);
 const {motionClock,beatClock}=movementTransport(rows,plan.beatGrid?.beats,roles,Boolean(stems?.step>0));
 const result={rows,clock,motionClock,beatClock,roles,hasStems:Boolean(stems?.step>0)};
 cache.set(plan,result);return result;
}

function impulseAt(events,time){
 if(!events?.length)return 0;
 const at=indexAt(events,time);let level=0;
 for(let i=at;i>=Math.max(0,at-8);i--){
  const e=events[i],age=time-e.time;if(age<0||age>.9)continue;
  // A visible articulation with a short attack and a sustained release,
  // never an independent shutter or a pulse invented from the beat grid.
  const attack=clamp(age/.012),release=Math.exp(-Math.max(0,age-.012)/.28);
  level=Math.max(level,attack*release*clamp(e.strength??1));
 }
 return level;
}
export function formationAudioAt(timeline,time){
 if(!timeline)return null;
 let cached=samples.get(timeline);if(!cached){cached=new Map();samples.set(timeline,cached);}
 if(cached.has(time))return cached.get(time);
 const i=indexAt(timeline.rows,time),a=timeline.rows[i],b=timeline.rows[Math.min(i+1,timeline.rows.length-1)];
 const p=clamp((time-a.time)/Math.max(.001,b.time-a.time));
 const values=Object.fromEntries(Object.keys(a).filter(k=>k!=='time').map(k=>[k,a[k]+(b[k]-a[k])*p]));
 const travel=clockPosition(timeline.clock,time)+clockPosition(timeline.motionClock,time);
 const result={...values,travel,beatTravel:timeline.beatClock?.length?clockPosition(timeline.beatClock,time):null,accent:impulseAt(timeline.roles.lead,time),
  drumAccent:impulseAt(timeline.roles.drums,time),bassAccent:impulseAt(timeline.roles.bass,time),
  vocalAccent:impulseAt(timeline.roles.vocals,time),melodyAccent:impulseAt(timeline.roles.melody,time)};
 if(cached.size>=128)cached.clear();cached.set(time,result);return result;
}

// XR receives current cues, never a copy of the whole analysis per light.
// Include the short handover lookback and the neighbours needed by Hermite
// interpolation, retaining the original clock velocities at the window edges.
export function formationAudioWindow(timeline,time){
 if(!timeline)return null;
 let saved=windows.get(timeline);if(!saved){saved=new Map();windows.set(timeline,saved);}
 if(saved.has(time))return saved.get(time);
 const subset=(points,start,end)=>{
  if(!points.length)return [];
  const a=indexAt(points,start),b=Math.min(points.length,indexAt(points,end)+2);
  return points.slice(a,b);
 };
 const result={rows:subset(timeline.rows,time-1.2,time+.1),clock:subset(timeline.clock,time-1.2,time+.1),
  motionClock:subset(timeline.motionClock??[],time-1.2,time+.1),
  beatClock:subset(timeline.beatClock??[],time-1.2,time+.1),
  roles:Object.fromEntries(Object.entries(timeline.roles).map(([role,events])=>[role,subset(events,time-2.2,time+.1)])),hasStems:timeline.hasStems};
 if(saved.size>=128)saved.clear();saved.set(time,result);return result;
}

export function formationBuildTrack(timeline,start,end,closing=false){
 if(!timeline)return null;
 const rows=timeline.rows.filter(e=>e.time>=start&&e.time<=end);
 if(rows.length<2)return null;
 const first=rows[0],sign=closing?-1:1;let highest=0;
 const points=rows.map(e=>{highest=Math.max(highest,sign*((e.energy-first.energy)*.65+(e.tone-first.tone)*.35));return {time:e.time,position:highest};});
 if(highest>.06)for(const p of points)p.position/=highest;
 else{
  const a=formationAudioAt(timeline,start).travel,b=formationAudioAt(timeline,end).travel;
  for(const p of points)p.position=b>a?clamp((formationAudioAt(timeline,p.time).travel-a)/(b-a)):clamp((p.time-start)/(end-start));
 }
 return points;
}
export function formationBuildProgress(points,time,fallback){
 if(!points?.length)return fallback;
 const i=indexAt(points,time),a=points[i],b=points[Math.min(i+1,points.length-1)];
 return a.position+(b.position-a.position)*clamp((time-a.time)/Math.max(.001,b.time-a.time));
}

// The musical evidence chooses the picture directly. Novelty is deliberately
// absent from this decision: the same musical figure may return visibly.
export function formationMusicalDecision(timeline,start,end,role='groove',passage=null){
 if(!timeline)return null;
 const rows=timeline.rows.filter(e=>e.time>=start&&e.time<end),mean=key=>rows.length?rows.reduce((s,e)=>s+e[key],0)/rows.length:0;
 const movementDrive=mean('movementDrive'),energy=mean('energy'),tone=mean('tone'),drums=mean('drums'),bass=mean('bass'),voice=mean('vocalsShare');
 const hits=timeline.roles.lead.filter(e=>e.time>=start&&e.time<end);
 const gaps=hits.slice(1).map((e,i)=>e.time-hits[i].time),gap=gaps.reduce((s,v)=>s+v,0)/Math.max(1,gaps.length);
 const irregularity=gaps.length>2&&gap?clamp(Math.sqrt(gaps.reduce((s,v)=>s+(v-gap)**2,0)/gaps.length)/gap):0;
 const density=clamp(hits.length/Math.max(.1,end-start)/3);
 const pitchConfidence=mean('pitchConfidence'),mid=Math.max(1,Math.floor(rows.length/2));
 const pitchMean=values=>values.reduce((s,e)=>s+e.pitch,0)/Math.max(1,values.length);
 const pitchRise=pitchConfidence>.35?pitchMean(rows.slice(mid))-pitchMean(rows.slice(0,mid)):0;
 const texture=voice>.42&&mean('vocals')>.2?'voice':mean('bassShare')>.38&&bass>.3&&drums<.6?'bass'
  :mean('drumsShare')>.32&&drums>.4?'drums':pitchConfidence>.45?'melody':'sustain';
 const energyMean=values=>values.reduce((sum,e)=>sum+e.energy,0)/Math.max(1,values.length);
 const withdrawal=energyMean(rows.slice(0,mid))-energyMean(rows.slice(mid))>.2&&drums<.4;
 // Automatic/Show's authored musical gesture remains authoritative. Local
 // stem averages refine its picture, rather than replacing an exchange with
 // another unrelated weave or swallowing a brief sweep under one texture.
 const sharedMotion=({opening:'bloom',settle:'gather',exchange:'dialogue',wave:'relay',sweep:'weave',breath:'suspend'})[passage?.sequence];
 const motion=role==='silence'?'rest':role==='build'?'bloom':role==='held'?'suspend':sharedMotion??(withdrawal?'gather'
  :texture==='voice'?'dialogue':texture==='drums'?'relay':'weave');
 let shape;
 if(motion==='rest')shape='parallel-lines';
 else if(motion==='gather')shape='converging-lines';
 else if(motion==='bloom')shape=texture==='bass'?'nested-gates':tone>.6?'crown':'open-fan';
 else if(motion==='suspend')shape=texture==='voice'?'split-foci':texture==='bass'?'converging-lines':texture==='melody'?'rising-arch':tone>.6?'radial-wheel':'horizontal-sheets';
 else if(motion==='dialogue')shape='split-foci';
 else if(motion==='relay')shape=bass>.55&&drums>.6?'crossed-fans':irregularity>.45?'folding-blades':density>.7?'lattice':tone>.6?'crossed-sheets':'vertical-curtain';
 else shape=texture==='bass'?'twin-fans':pitchRise>.1?'rising-arch':pitchRise<-.1?'traveling-wave':tone>.62?'radial-wheel':'braided-ribbons';
 const path=motion==='bloom'||motion==='gather'||motion==='suspend'||texture==='bass'?'radial':motion==='dialogue'?'split'
  :texture==='drums'?(irregularity>.45?'zigzag':'traverse'):pitchRise>.1?'diagonal':'depth';
 const gesture=motion==='suspend'?'carry':motion==='bloom'?'rise':motion==='gather'?'hinge':texture==='voice'?'carry'
  :texture==='bass'?'hinge':texture==='drums'?(irregularity>.45?'scissor':'sweep'):pitchConfidence>.45?'ribbon':'orbit';
 const articulation=motion==='suspend'||motion==='bloom'||motion==='gather'?'stroke':texture==='voice'?'reveal':texture==='drums'&&irregularity>.45?'echo':'stroke';
 const variation={path,gesture,articulation,key:`${path}/${gesture}/${articulation}`,
  spread:.85+.15*energy,amplitude:motion==='suspend'?.02:.025+.04*energy,phaseSpan:1};
 const act=motion==='gather'?'resolve':motion==='dialogue'?'answer':motion==='weave'||motion==='relay'&&irregularity>.45?'interlace':'introduce';
 const reason=role==='silence'?'Musikalische Pause':withdrawal?'Gemessene Rücknahme':role==='build'?'Gemessener Aufbau':texture==='voice'?'Führende Stimme':texture==='bass'?'Tragende Bassfigur'
  :texture==='drums'?'Perkussive Figur':texture==='melody'?'Gemessene Tonhöhenbewegung':'Gehaltenes Klangbild';
 return {motion,shape,variation,act,direction:pitchRise<-.1?-1:1,
  evidence:{reason,texture,movementDrive,energy,tone,drums,bass,voice,pitchConfidence,pitchRise,density,irregularity,impulses:hits.length,
   ...(sharedMotion?{sharedSequence:passage.sequence}:{})}};
}

// A texture describes a musical role, not one immutable geometry. Develop a
// small authored vocabulary at musical sentence boundaries, sharing the audio
// clock and direction throughout. No additional per-light motor is introduced.
const phrasePictures={
 relay:['parallel-lines','open-fan','crossed-sheets','split-wings','diagonal-plane','layered-steps','nested-gates','opposed-diagonals','rake','split-curtain','folding-blades','lattice','crossed-fans'],
 dialogue:['split-wings','twin-fans','nested-gates','rising-arch','diamond','parallel-lines','portal-rows','hourglass','chevron-stack','split-foci','crown'],
 weave:['twin-fans','traveling-wave','rising-arch','radial-wheel','diamond','double-helix','split-wings','concentric-fans','folded-roof','opposed-diagonals','spiral-shell','braided-ribbons'],
 suspend:['horizontal-sheets','vaulted-roof','parallel-lines','rising-arch','vertical-curtain','folded-roof','portal-rows']
};
const pictureSignatures=new Map();
function pictureSimilarity(a,b){
 const signature=id=>{
  if(!pictureSignatures.has(id))pictureSignatures.set(id,[.25,.75].flatMap(progress=>[0,1,2].flatMap(row=>
   Array.from({length:12},(_,rank)=>{const p=catalogSpatialPose(id,rank,12,row,3,progress);return [p.x,p.y];}).flat())));
  return pictureSignatures.get(id);
 };
 const left=signature(a),right=signature(b);
 const distance=Math.sqrt(left.reduce((sum,v,i)=>sum+(v-right[i])**2,0)/(left.length/2));
 return clamp(1-distance/.16)**2;
}
export function developFormationPhrase(decision,phrase=0,preferredShape=null,context=null){
 const evidence=decision?.evidence,pictures=phrasePictures[decision?.motion]??
  (decision?.motion==='bloom'&&context?.allowOpening?['open-fan','crown','nested-gates','concentric-fans']:null);
 // A pad or a grid alone cannot demand new pictures; a measured rhythmic or
 // melodic line must actually be present. Builds and withdrawals keep one arc.
 if(!decision)return decision;
 if(!pictures||evidence.impulses<2||evidence.energy<.06){
  return {...decision,scene:chooseFormationScene(decision.shape,decision.motion,evidence,0)};
 }
 const anchor=decision.motion==='bloom'&&!context?.anchorLocked?decision.shape:preferredShape??decision.shape;
 // Related figures remain eligible, but their order follows the sound.
 // A fixed catalogue order made unrelated songs repeat the same sentences.
 const angular=new Set(['parallel-lines','crossed-sheets','diagonal-plane','layered-steps','lattice','opposed-diagonals','rake','folding-blades']);
 const curved=new Set(['traveling-wave','rising-arch','radial-wheel','double-helix','concentric-fans','spiral-shell','braided-ribbons']);
 const spacious=new Set(['split-wings','twin-fans','nested-gates','portal-rows','hourglass','split-foci','horizontal-sheets']);
 const score=shape=>(angular.has(shape)?(evidence.drums??0)*1.4+(evidence.irregularity??0)*.5:0)
  +(curved.has(shape)?(evidence.pitchConfidence??0)+(evidence.tone??.5)*.5:0)
  +(spacious.has(shape)?(evidence.bass??0)+(evidence.voice??0)+(1-(evidence.energy??.5))*.5:0);
 const familiar=pictures.filter(shape=>shape!==anchor).sort((a,b)=>score(b)-score(a));
 const candidates=catalogCandidates(decision.motion,evidence),expansion=candidates.map(f=>f.id);
 const choices=[anchor,...expansion.flatMap((shape,i)=>i<familiar.length?[shape,familiar[i]]:[shape])];
 const step=Math.max(0,Math.floor(phrase));
 let shape=choices[step%choices.length],selection='phrase';
 const history=context?.history??[];
 if(context?.anchorLocked&&step===0){shape=anchor;selection='authored-opening';}
 else if(context?.recalled){shape=context.recalled;selection='motif-recall';}
 else if(context&&history.length&&candidates.length){
  // Stay within a narrow musical fit budget. Recency decides among suitable
  // pictures, rather than walking farther down a whole-song catalogue timer.
  const best=catalogMatchScore(candidates[0],decision.motion,evidence);
  const suitable=candidates.filter(f=>best-catalogMatchScore(f,decision.motion,evidence)<=.75);
  const recent=history.slice(-12);
  const score=f=>{
   let value=catalogMatchScore(f,decision.motion,evidence);
   recent.forEach((used,i)=>{const weight=(i+1)/recent.length,old=catalogFormation(used.shape);
    if(used.shape===f.id)value-=2.5*weight;
    else if(old?.structure.id===f.structure.id&&old?.contour.id===f.contour.id)value-=2.5*weight;
    else if(old?.structure.id===f.structure.id)value-=.18*weight;
    else if(old?.contour.id===f.contour.id)value-=.1*weight;
    // Different catalogue IDs can draw almost the same silhouette. Prefer
    // a visible contrast among equally suitable musical pictures, evaluating
    // whole rows at two phases rather than counting names as variety.
    if(old&&i>=recent.length-4)value-=1.1*weight*pictureSimilarity(f.id,old.id);
   });
   return value;
  };
  shape=suitable.map(f=>({id:f.id,score:score(f)})).sort((a,b)=>b.score-a.score)[0].id;selection='musical-development';
 }
 const sceneStep=step+history.filter(used=>used.shape===shape).length;
 const act=['introduce','answer','interlace','resolve'][step%4];
 return {...decision,shape,act,scene:chooseFormationScene(shape,decision.motion,evidence,sceneStep),evidence:{...evidence,phrase:step,selection,
  development:step===0?'Musikalisches Grundbild':act==='answer'?'Antwort der nächsten Phrase':act==='interlace'?'Verflechtung der Phrase':act==='resolve'?'Auflösung der Phrase':'Erneute Entfaltung'}};
}

// An exceptional arrival uses the exact prepared source attack. It is a
// sustained reveal of a complete picture, not another periodic master flash.
export function formationArrivalEnvelope(story,time){
 const cue=story?.arrivalCue;if(!cue)return 0;
 const age=time-cue.time;if(age<0||age>1.2)return 0;
 return clamp(age/.012)*Math.exp(-Math.max(0,age-.12)/.28)*Math.sqrt(clamp(cue.strength));
}
