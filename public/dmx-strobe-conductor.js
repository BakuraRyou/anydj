import {formationFor,planFormationEntrances,formationProgramFor,planFormationScenes,formationSceneStateAt} from './dmx-strobe-choreography.js';
import {planShowScore} from './show-score.js';
import {musicalMovementEvents} from './dmx-light-scenes.js';
import {musicalAttention,bassAttackEvents} from './musical-attention.js';
import {musicalStageScore} from './dmx-musical-score.js';
import {lightingSceneAt} from './dmx-light-scenes.js';
import {automaticVisualFamily} from './song-movement-plan.js';
const cache=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function strobeSentenceFor(passage){
 if(!passage?.motion)return 'held';
 if(passage.coordination==='build')return 'reveal';
 const family=automaticVisualFamily(passage.composition??passage.motion);
 if(passage.sequence==='settle'||passage.sequence==='breath')return 'frame';
 if(passage.intent?.attention?.leader==='vocals'||passage.sequence==='exchange')return 'dialogue';
 if(family==='levels')return 'row-steps';
 if(family==='crossing')return (passage.intent?.rhythm?.density??0)>.5?'zipper':'counter-pairs';
 if(family==='fan'||family==='arch')return 'centre-out';
 if(family==='frame')return 'edge-in';
 if(passage.sequence==='wave'||family==='wave')return 'ripple';
 return 'pair-run';
}
export function planStrobePhrases(sequences,plan){
 const active=sequences.filter(s=>!['held','silence'].includes(s.role));
 const peak=Math.max(0,...active.map(s=>s.energy)),floor=Math.min(peak,...active.map(s=>s.energy)),range=peak-floor;
 const recalled=new Map();
 for(const s of sequences){
  if(!s.sharedPassage)continue;
  const p=s.sharedPassage,segment=plan.structure?.segments?.find(p=>s.start>=p.start&&s.start<p.end);
  const label=['verse','chorus','bridge','intro','outro'].includes(segment?.label)?segment.label:null;
  const scale=range>=.18?clamp((s.energy-floor)/range):.5;
  const functionName=s.role==='silence'?'rest':s.role==='held'?'held':s.role==='build'?'build':label??(scale>.75?'strong':scale<.3?'restrained':'development');
  const key=p.theme?.key??(p.motif!=null?String(p.motif):null);
  const recallKey=key==null?null:`${key}:${functionName}:${p.coordination}`;
  let sentence=s.strobeSentence;
  if(functionName==='verse'&&p.intent?.attention?.leader==='vocals')sentence='dialogue';
  if(functionName==='chorus'&&s.rhythmic)sentence=(p.intent?.rhythm?.density??0)>.5?'ripple':'counter-pairs';
  const prior=recallKey?recalled.get(recallKey):null;
  if(prior)sentence=prior.sentence;
  const rowDensity=['held','rest'].includes(functionName)?.35:functionName==='verse'||functionName==='restrained'?.4:functionName==='chorus'||functionName==='strong'?.8:.6;
  const values=s.entrances.map(e=>Number.isFinite(e.salience)?e.salience:e.strength).sort((a,b)=>a-b);
  const median=values[Math.floor(values.length/2)]??0;
  const threshold=Math.max(.4,median*1.4,median+.15);
  // Relative prominence distinguishes an exceptional hit from a loud grid.
  for(const e of s.entrances)e.prominent=(e.salience??e.strength)>threshold;
  s.formationId=prior?.formationId??formationFor(p);
  s.phraseArt={function:functionName,label,scale,rowDensity,sentence,formationId:s.formationId,recalled:!!prior,motif:recallKey};
  s.formationProgram=prior?.formationProgram??formationProgramFor(s);
  s.phraseArt.formationProgram=s.formationProgram;
  s.strobeSentence=sentence;
  if(recallKey&&!prior)recalled.set(recallKey,s.phraseArt);
 }
 for(let i=1;i<sequences.length;i++){
  const incoming=sequences[i],before=sequences[i-1];
  if(!before.phraseArt||!incoming.phraseArt||['silence','held'].includes(incoming.role)||before.role==='silence')continue;
  const contrast=incoming.energy-before.energy;
  const attack=incoming.entrances.filter(e=>e.time-incoming.start<=.3).reduce((m,e)=>Math.max(m,e.strength),0);
  if(contrast<.18||attack<.65)continue;
  const importance=Math.min(1,contrast/.35)*attack;
  const length=Math.min(1.2,(before.end-before.start)*.2);
  before.phraseArt.anticipation={start:incoming.start-length,end:incoming.start,strength:importance};
  incoming.phraseArt.arrival=importance;
 }
 return sequences;
}
export function strobeMusicalIntent(picture,events,attention={leader:'mixed',confidence:0}){
 const melody=events.filter(e=>e.role==='answer').length;
 const hits=events.filter(e=>e.role==='lead'&&['bass','attack'].includes(e.kind));
 const vocal=attention.leader==='vocals'&&attention.confidence>=.5||picture.vocals>.55;
 if(picture.role==='silence')return {pattern:'hold',layout:0,rolePhase:0,motion:'hold',reason:'Musikalische Pause'};
 if(picture.role==='build')return {pattern:'build',layout:1,rolePhase:0,motion:'open',reason:'Gemessener Aufbau'};
 if(picture.climax||picture.role==='arrival')return {pattern:'pairs',layout:1,rolePhase:2,motion:'hold',reason:'Musikalischer Höhepunkt'};
 if(picture.role==='held')return {pattern:'hold',layout:0,rolePhase:0,motion:'hold',reason:'Gehaltenes Klangbild'};
 // Notes complement a driving groove. Two detected pitch changes alone must
 // not replace the drum sentence with the same melodic picture in every verse.
 if(melody>=2&&!picture.rhythmic&&hits.length<2||attention.leader==='other'&&attention.confidence>=.5)return {pattern:'echo',layout:2,rolePhase:1,motion:melody>=2?'contour':'hold',reason:'Melodische Einsätze'};
 if(vocal)return {pattern:'pairs',layout:0,rolePhase:1,motion:'hold',reason:'Raum für die führende Stimme'};
 if(hits.length>=2){
  const gaps=hits.slice(1).map((e,i)=>e.time-hits[i].time).filter(t=>t>.08);
  const mean=gaps.reduce((s,v)=>s+v,0)/Math.max(1,gaps.length);
  const variation=mean?Math.sqrt(gaps.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,gaps.length))/mean:0;
  const levels=hits.map(e=>e.strength??.6),contrast=Math.max(...levels)-Math.min(...levels);
  if(variation>.3)return {pattern:'syncopated',layout:1,rolePhase:0,motion:'hold',reason:'Unregelmäßige perkussive Figur'};
  if(mean<.4&&contrast>.18)return {pattern:'zipper',layout:1,rolePhase:0,motion:'hold',reason:'Dichte perkussive Wechsel'};
  if(mean>.65)return {pattern:'pendulum',layout:0,rolePhase:0,motion:'hold',reason:'Getragene perkussive Figur'};
  return {pattern:'chase',layout:1,rolePhase:0,motion:'hold',reason:'Gemessene perkussive Figur'};
 }
 return {pattern:'pairs',layout:0,rolePhase:0,motion:'hold',reason:'Zurückhaltendes Phrasenbild'};
}
export function strobeConductor(plan){
 if(cache.has(plan))return cache.get(plan);
 const shared=!!(plan.songMovement?.passages?.length||plan.frames?.length&&plan.arrangement?.patterns?.phrases?.length);
 const pictures=shared?musicalStageScore(plan).map((p,index)=>{
  const scene=lightingSceneAt(plan,p.start),kind=p.intent?.role??scene?.kind;
  const role=kind==='silence'?'silence':!p.motion?'held':p.coordination==='build'?'build':kind==='impact'||p.intent?.staging?.climax?'arrival':p.coordination==='ordered'?'flow':'groove';
  return {...scene,...p,index,role,rhythmic:(p.intent?.motionDrive??p.drive??0)>=.35,
   sharedPassage:p,motif:p.theme?.key??p.motif,character:p.intent?.character,climax:!!p.intent?.staging?.climax};
 }):plan.showScore||planShowScore(plan),arr=plan.arrangement||{};
 const pictureAt=time=>{const i=indexAt(pictures,time,'start'),p=pictures[i];return p&&time<p.end?p:null;};
 const instruments=plan.structure?.instruments;
 const instrumentDriven=!!(instruments?.step>0&&instruments.drums?.length&&instruments.bass?.length);
 // The shared conductor supplies melody changes, expression and developments.
 // Passing no bars deliberately excludes regular metronomic arrivals.
 const candidates=musicalMovementEvents(plan,[]).filter(e=>!['bar','recovered'].includes(e.kind));
 if(instrumentDriven){
  // Separate instruments before assigning fixtures. Mixed audio attacks can
  // originate from a voice or bass note, and must not all become drum steps.
  const onsets=(arr.times||[]).filter((time,i)=>['onset','instrument'].includes(arr.eventSources?.[i]));
  for(const name of ['drums','bass'])for(const e of bassAttackEvents(instruments[name],instruments.step)){
   if(e.strength<(name==='drums'?.55:.65))continue;
   const onset=name==='drums'?onsets.filter(time=>Math.abs(time-e.time)<=Math.min(.12,instruments.step*1.2))
    .sort((a,b)=>Math.abs(a-e.time)-Math.abs(b-e.time))[0]:undefined;
   candidates.push({...e,time:onset??e.time,kind:name==='drums'?'attack':'bass',instrument:name,role:name==='drums'?'lead':'support'});
  }
 }else{
  for(const e of arr.bassAttacks||[])if(e.strength>=.65)candidates.push({time:e.time,kind:'bass',strength:e.strength,duration:e.duration});
  for(let i=0;i<(arr.times||[]).length;i++)if(['onset','instrument'].includes(arr.eventSources?.[i]))
   candidates.push({time:arr.times[i],kind:'attack',strength:arr.accents?.[i]??.6});
 }
 if(shared){
  // Primary group entrances use the SAME prepared impulse timeline as the
  // source dimmer. Stem attacks can add spatial answers, not another master.
  for(let i=candidates.length-1;i>=0;i--)if(candidates[i].role==='lead'||['attack','bass'].includes(candidates[i].kind)&&candidates[i].role!=='support')candidates.splice(i,1);
  const times=arr.times||plan.beatTiming?.times||[];
  for(let i=0;i<times.length;i++){
   const strength=arr.accents?.[i]??plan.beatTiming?.accents?.[i]??1;
   if(strength>0)candidates.push({time:times[i],kind:'source',role:'lead',strength,salience:arr.eventSalience?.[i],duration:arr.decays?.[i]??arr.decay??plan.beatTiming?.decay??.25});
  }
 }
 candidates.sort((a,b)=>a.time-b.time);
 const events=[],last=new Map(),ordinals=new Map(),entrances=new Map(),observed=new Map();
 const bars=plan.beatGrid?.downbeats||[],barPoints=bars.map(time=>({time}));
 for(const e of candidates){
  const picture=pictureAt(e.time);
  if(!picture||picture.role==='silence')continue;
  const role=e.role||(e.kind==='melody'?'answer':e.kind==='accent'||instrumentDriven&&['expression','development'].includes(e.kind)?'accent':'lead');
  const restrained=picture.role==='held'||picture.character==='vocal'||picture.vocals>.55;
  const percussion=['bass','attack'].includes(e.kind);
  const spacing=shared&&role==='lead'?0:role==='lead'?(restrained?.65:picture.climax?.18:instrumentDriven?.18:.38):role==='support'?.18:role==='answer'?.6:.5;
  const key=`${picture.start}:${role}`,previous=entrances.get(key),previousObserved=observed.get(key);
  observed.set(key,e.time);
  if(e.time-(last.get(role)??-Infinity)<spacing)continue;
  // A repeated bass hit articulates the current unit. Only a new entrance
  // after a real gap, or a melodic/expressive decision, advances the picture.
  const advance=!previous||role==='support'||!percussion||e.time-(previousObserved??previous.time)>=.9;
  const ordinal=previous?(ordinals.get(key)||0)+(advance?1:0):0;
  ordinals.set(key,ordinal);last.set(role,e.time);entrances.set(key,e);
  const note=e.kind==='melody'?(plan.score?.notes||[]).find(n=>Math.abs(n.start-e.time)<.02):null;
  const duration=Math.max(.12,Math.min(e.kind==='melody'?1.8:.9,note?note.end-note.start:e.duration??(['expression','development'].includes(e.kind)?.8:role==='accent'?.18:.3)));
  const bar=indexAt(barPoints,e.time+.025);
  const barStart=bars[bar],barEnd=bars[bar+1]??(bar>0?barStart+barStart-bars[bar-1]:NaN);
  const slot=(e.time-barStart)/(barEnd-barStart)*4,nearest=Math.round(slot);
  // The grid labels a measured entrance; it never creates one. Repeated
  // rhythmic positions recall the same bank even after a missing detection.
  const phraseStep=Number.isFinite(slot)&&Math.abs(slot-nearest)<=.25?((nearest%4)+4)%4:null;
  events.push({...e,role,ordinal,advance,phraseStep,pitch:note?.midi,gain:percussion?(restrained?.45:picture.climax?1:.75):1,duration:Math.min(duration,picture.end-e.time),strength:clamp(e.strength??e.salience??.8),pictureStart:picture.start});
 }
 // Store continuous travel, not a sequence of independent shutter pulses.
 // Each measured entrance is a waypoint; light passes between neighbours.
 const transfers={};
 for(const role of ['lead','answer','solo']){
  const points=[];let position=0;
  for(const e of events.filter(e=>e.role===role||role==='solo'&&['lead','answer'].includes(e.role)))points.push({time:e.time,position:++position,gain:e.gain});
  transfers[role]=points;
 }
 // Phrase choices follow musical evidence and recall, never a variety cycle.
 const recalled=new Map();let prior=null;
 const sequences=pictures.map((picture,index)=>{
  const selected=events.filter(e=>e.pictureStart===picture.start);
  // Melodic answers own their own timing; they cannot advance the drum run.
  const steps=selected.filter(e=>e.role==='lead'&&['bass','attack','recovered','source'].includes(e.kind));
  steps.sort((a,b)=>a.time-b.time);
  const entrances=shared?steps:steps.filter((e,i)=>!i||e.time-steps[i-1].time>.08);
  const anchor=(arr.motionEnvelope||[]).filter(e=>e.time<=picture.start).at(-1)||(arr.motionEnvelope||[])[0];
  const attention=musicalAttention(plan.structure?.instruments,picture.start,picture.end);
  let intent=picture.sharedPassage?{
   pattern:picture.role==='silence'||picture.role==='held'?'hold':({opening:'build',wave:'chase',exchange:'pairs',sweep:'pendulum',breath:'hold',settle:'hold'}[picture.sharedPassage.sequence]??'hold'),
   layout:0,rolePhase:0,motion:picture.role==='build'?'open':'shared',reason:'Gemeinsame musikalische Dramaturgie',
  }:strobeMusicalIntent(picture,selected.filter(e=>e.role!=='support'),attention);
  if(intent.reason==='Zurückhaltendes Phrasenbild'&&prior&&prior.role===picture.role)
   intent={pattern:prior.pattern,layout:prior.layout,rolePhase:prior.rolePhase,motion:prior.motion,reason:prior.reason};
  const theme=picture.motif??picture.movementIntent?.themeLabel;
  const key=theme==null?null:`${theme}:${intent.reason}`;
  if(!picture.sharedPassage){if(key&&recalled.has(key))intent=recalled.get(key);else if(key)recalled.set(key,intent);}
  const formation={hold:'parallel',build:'fan',pairs:'cross',echo:'diagonal',pendulum:'wings',chase:'fan',zipper:'cross',syncopated:'cross'}[intent.pattern]||'parallel';
  const continuing=prior&&prior.end===picture.start&&['pattern','layout','rolePhase','motion'].every(k=>prior[k]===intent[k])&&
   (!picture.sharedPassage||prior.sharedPassage&&['composition','sequence','coordination'].every(k=>prior.sharedPassage[k]===picture.sharedPassage[k]));
  const strengths=steps.map(e=>e.strength).sort((a,b)=>a-b),median=strengths[Math.floor(strengths.length/2)]??.6;
  const result={index,start:picture.start,end:picture.end,role:picture.role,energy:picture.energy??.5,...intent,formation,sharedPassage:picture.sharedPassage,
   ...(picture.sharedPassage?{strobeSentence:strobeSentenceFor(picture.sharedPassage)}:{}),
   chapter:picture.climax||picture.role==='arrival'?'arrival':picture.role==='build'?'build':picture.role==='held'?'held':picture.role==='silence'?'rest':'phrase',
   preparedEntrance:!!(prior&&prior.role==='silence'&&prior.end===picture.start&&prior.end-prior.start>=.8),
   continuing:!!continuing,continuityStart:continuing?prior.continuityStart:picture.start,
   carry:continuing?prior.entrances.at(-1)||prior.carry:null,
   stepBase:continuing?prior.stepBase+prior.entrances.length:0,
   accentThreshold:Math.max(.82,median+.15),
   pitch:continuing?prior.pitch:anchor?.pitch,tone:continuing?prior.tone:anchor?.tone??picture.tone??.5,
   rhythmic:picture.rhythmic,instrumentDriven,entrances};
  prior=result;return result;
 });
 planStrobePhrases(sequences,plan);
 const formationBeats=plan.beatGrid?.beats??plan.beatTiming?.times??[];
 const beatPoints=formationBeats.map(time=>({time}));
 for(let i=0;i<sequences.length;i++){
  const s=sequences[i];
  if(!s.sharedPassage)continue;
  const at=indexAt(beatPoints,s.start);
  const beatLength=at>=0&&formationBeats[at+1]!=null?formationBeats[at+1]-formationBeats[at]:.5;
  s.minimumHold=Math.max(1.1,Math.min(2.4,beatLength*2));
  s.formationEntrances=planFormationEntrances(s,sequences[i-1]);
 }
 const formationScenes=planFormationScenes(sequences,plan);
 // Analysis fragments inside one build share its opening, rather than
 // restarting the fan at each fragment boundary.
 for(let i=0;i<sequences.length;i++){
  if(sequences[i].motion!=='open')continue;
  let last=i;while(last+1<sequences.length&&sequences[last+1].motion==='open'&&sequences[last+1].continuing)last++;
  for(let j=i;j<=last;j++){sequences[j].motionStart=sequences[i].start;sequences[j].motionEnd=sequences[last].end;}
  i=last;
 }
 // Continuing analysis fragments share one slow spatial development.
 for(let i=0;i<sequences.length;i++){
  if(!sequences[i].sharedPassage)continue;
  let last=i;
  while(last+1<sequences.length&&sequences[last+1].continuing&&sequences[last+1].formationId===sequences[i].formationId)last++;
  for(let j=i;j<=last;j++){sequences[j].motionStart=sequences[i].start;sequences[j].motionEnd=sequences[last].end;}
  i=last;
 }
 const references=instrumentDriven?Object.fromEntries(['bass','other'].map(name=>{
  const levels=Array.from(instruments[name]||[]).filter(Number.isFinite).sort((a,b)=>a-b);
  return [name,Math.max(.008,levels[Math.floor((levels.length-1)*.95)]??0)];
 })):null;
 const supportEvents=events.filter(e=>e.role==='support');
 const value={pictures,pictureAt,shared,events,transfers,sequences,envelope:arr.motionEnvelope||[],references,supportEvents,formationScenes};cache.set(plan,value);return value;
}
function indexAt(points,time,key='time'){
 let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][key]<=time)lo=mid+1;else hi=mid;}return lo-1;
}
export function strobeMusicAt(plan,time){
 const conductor=strobeConductor(plan),picture=conductor.pictureAt(time);
 const sequenceIndex=indexAt(conductor.sequences,time,'start'),sequence=conductor.sequences[sequenceIndex];
 const at=indexAt(conductor.events,time),active=[];
 for(let i=at;i>=0&&time-conductor.events[i].time<=1.8;i--){
  const e=conductor.events[i];if(time<e.time+e.duration&&(e.pictureStart===picture?.start||sequence?.continuing&&e.time>=sequence.continuityStart))active.push({...e,elapsed:time-e.time});
 }
 const points=conductor.envelope,i=indexAt(points,time),a=points[i],b=points[i+1];
 const blend=a&&b?clamp((time-a.time)/Math.max(.001,b.time-a.time)):0;
 const sample=(key,fallback)=>Number.isFinite(a?.[key])?a[key]+((Number.isFinite(b?.[key])?b[key]:a[key])-a[key])*blend:fallback;
 const transfer={};
 for(const role of ['lead','answer','solo']){
  const points=conductor.transfers[role],index=indexAt(points,time),previous=points[index],next=points[index+1];
  const start=previous??{time:0,position:0};
  // Event spacing sets travel speed. Preserve its phase across picture
  // boundaries; silence is applied separately to the final exposure.
  const from=start.time;
  const progress=next?clamp((time-from)/Math.max(.001,next.time-from)):0;
  const smooth=progress*progress*(3-2*progress);
  transfer[role]={position:start.position+(next?next.position-start.position:0)*smooth,
   enabled:role==='lead'||role==='solo'||!!previous&&previous.time>=(picture?.start??0)||!!next&&next.time<(picture?.end??0)};
 }
 const step=sequence?indexAt(sequence.entrances,time):-1;
 const entry=sequence?.entrances[step]||sequence?.carry,next=sequence?.entrances[step+1];
 const rhythm=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end)?.rhythm;
 const upcoming=conductor.sequences[sequenceIndex+1];
 const preparation=sequence?.role==='silence'&&upcoming?.preparedEntrance&&time>=upcoming.start-.8
  ?{...upcoming,...formationSceneStateAt(upcoming,upcoming.start),progress:0,previous:null}:null;
 const formationIndex=indexAt(sequence?.formationEntrances??[],time);
 const formationEntries=sequence?.formationEntrances?.slice(Math.max(0,formationIndex-1),formationIndex+1)??[];
 const visualState=formationSceneStateAt(sequence,time);
 const sequenceState=sequence&&time<sequence.end?{...sequence,time,step,entry,next,rhythm,formationEntries,
  preparation,
  progress:clamp((time-(sequence.motionStart??sequence.start))/((sequence.motionEnd??sequence.end)-(sequence.motionStart??sequence.start))),
  previous:conductor.sequences[sequenceIndex-1],age:time-sequence.start,...visualState,
  stepDuration:entry?Math.max(.15,Math.min(1.5,(next?.time??entry.time+.5)-entry.time)):.5}:null;
 let accompaniment=null;
 if(conductor.references){
  const stems=plan.structure.instruments,position=Math.max(0,time/stems.step),index=Math.floor(position),fraction=position-index;
  const level=name=>{const values=stems[name]||[];return clamp(((values[index]??0)*(1-fraction)+(values[index+1]??values[index]??0)*fraction)/conductor.references[name]);};
  const last=conductor.supportEvents[indexAt(conductor.supportEvents,time)];
  accompaniment={bass:level('bass'),other:level('other'),ordinal:last&&last.time>=(sequence?.continuityStart??Infinity)?last.ordinal:0};
 }
 return {sequence:sequenceState,transfer,active,accompaniment,evidence:conductor.events.some(e=>e.pictureStart===picture?.start),role:picture?.role??'silence',energy:sample('energy',picture?.energy??.4),tone:sample('tone',picture?.tone??.5),pitch:sample('pitch',active.find(e=>e.role==='answer')?.pitch??null)};
}
export function strobeMusicExposure(music,role,bank,banks,hasAnswer){
 if(music.role==='silence')return 0;
 const path=music.transfer?.[role==='lead'&&!hasAnswer?'solo':role];
 if(path&&role!=='accent'){
  if(!path.enabled)return 0;
  if(banks<=1)return .65+.3*clamp(music.energy);
  const period=2*(banks-1),phase=((path.position%period)+period)%period;
  const position=phase<=banks-1?phase:period-phase;
  // Complementary neighbouring weights conserve light through every handover.
  return Math.max(0,1-Math.abs(bank-position))*(.65+.3*clamp(music.energy));
 }
 // Sustained music retains a sparse picture. Missing onset evidence never
 // fabricates a pulse train from the beat grid.
 let level=role==='lead'&&bank===0&&(!music.evidence||['held','flow','build'].includes(music.role))?.2+.25*clamp(music.energy):0;
 for(const e of music.active){
  if(e.role!==role&&!(e.role==='answer'&&!hasAnswer&&role==='lead'))continue;
  if(bank!==e.ordinal%banks)continue;
  const release=Math.min(e.duration*.45,.22),attack=Math.min(.025,e.duration*.1);
  const onset=e.kind==='bass'?Math.min(.09,e.duration*.25):attack;
  const envelope=Math.min(1,e.elapsed/onset,(e.duration-e.elapsed)/release);
  level=Math.max(level,clamp(envelope)*(.55+.45*e.strength)*(e.gain??1));
 }
 return clamp(level);
}
