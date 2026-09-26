import {musicalAttention,bassAttackEvents} from './musical-attention.js';
import {instrumentRests} from './instrument-activity.js';
// Shared musical scene plan for geometry, occupancy and intensity. No fixture
// count, filename, random choice or wall clock enters the artistic decision.
const cache=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const quiet=look=>['held','quiet','break','outro'].includes(look);
// Each family has five authored geometries. Targets describe musical affinity,
// not genre labels. Recent use is penalized only within the appropriate family.
export const sceneVariants={
 sculpture:['parallel','open','gates','terraces','diagonal'],
 groove:['banks','steps','wide','roof','rails'],
 build:['fan','rise','wings','unfold','arch'],
 impact:['crown','wall','split','tiers','horizon'],
 sweep:['parallel','fan','ribbon','wings','lift']
};
const affinities=[
 [.3,.2,.7,.6,.4], [.6,.8,.1,.1,.3], [.5,.4,.2,.8,.7],
 [.7,.6,.4,.2,.8], [.4,.3,.6,.5,.9]
];
function directSong(scenes){
 const active=scenes.filter(s=>s.kind!=='silence');
 const peak=Math.max(0,...active.map(s=>s.energy));
 const average=active.reduce((v,s)=>v+s.energy*(s.end-s.start),0)/Math.max(1,active.reduce((v,s)=>v+s.end-s.start,0));
 const uses=new Map(),motifs=new Map();let last=null;
 for(const scene of scenes){
  if(scene.kind==='silence'){scene.variant='dark';last=scene;continue;}
  const key=scene.motif==null?null:String(scene.motif)+':'+scene.kind;
  const recalled=key===null?null:motifs.get(key);
  scene.climax=scene.kind==='impact'&&scene.energy>=peak-.035;
  scene.scale=.82+.18*clamp((scene.energy-average+.3)/.6);
  const candidates=sceneVariants[scene.kind];
  // Sparse/uncertain analysis holds an established image instead of inventing
  // diversity. Strong musical repetition intentionally recalls its motif.
  if(recalled){scene.variant=recalled.variant==='crown'&&!scene.climax?'tiers':recalled.variant;scene.direction=recalled.direction;scene.recalled=true;}
  else if(!scene.evidence){scene.variant=candidates[0];}
  else{
   const features=[scene.energy,scene.drive,scene.vocals,scene.texture,scene.tone];
   const ranked=candidates.map((variant,i)=>{
    const id=scene.kind+':'+variant;
    const affinity=features.reduce((sum,v,j)=>sum+Math.abs(v-affinities[i][j]),0);
    const recent=last?.kind===scene.kind&&last.variant===variant?2:0;
    // The widest impact is reserved for the song's strongest section(s).
    const reserve=scene.kind==='impact'&&variant==='crown'?(scene.climax?-1:10):0;
    return {variant,score:affinity+recent+.55*(uses.get(id)||0)+reserve};
   }).sort((a,b)=>a.score-b.score);
   scene.variant=ranked[0].variant;
  }
  scene.presentation=scene.kind==='groove'?(scene.drive>.75?'answer':'breathe'):scene.kind==='build'&&scene.texture>.5?'outside':'inside';
  scene.selection=scene.recalled?'Motiv wiederaufgenommen':!scene.evidence?'Zurückhaltend bei fehlender Analyse':'Musikalische Eignung, bisherige Verwendung und Songhöhepunkt';
  const id=scene.kind+':'+scene.variant;uses.set(id,(uses.get(id)||0)+1);
  if(key!==null&&!recalled)motifs.set(key,scene);
  last=scene;
 }
 return scenes;
}
// Soundtrack is often a hybrid of orchestra, synthesizers and rock. Require
// repeated style evidence AND sustained acoustic material; one tag is not a
// command to run a generic "epic" animation.
function cinematicEvidence(plan,start,end){
 const envelope=plan.arrangement?.motionEnvelope||[];
 const local=envelope.filter(p=>p.time>=start&&p.time<end);
 if(!local.length||local.reduce((s,p)=>s+p.sustain,0)/local.length<.65)return false;
 let support=0,total=0,hints=0;
 for(const segment of plan.musicStyle?.segments||[]){
  const weight=Math.max(0,Math.min(end+10,segment.end)-Math.max(start-10,segment.start));
  if(!weight)continue;total+=weight;
  const orchestral=(segment.scores?.orchestral??0)>=.12;
  const soundtrack=segment.tags?.some(t=>/Soundtrack|Score|Symphonic|Orchestral/i.test(t.label)&&t.score>=.07);
  if(orchestral||soundtrack){support+=weight;hints++;}
 }
 return hints>=2&&support>=total*.2;
}
function cinematicFrames(plan,start,end){
 const source=plan.arrangement.motionEnvelope.filter(p=>p.time>=start&&p.time<end);
 if(!source.length)return [];
 const points=[{...source[0],time:start}];
 for(const p of source.slice(1)){
  const last=points.at(-1);
  if(p.time-last.time<.8)continue;
  const pitch=Number.isFinite(p.pitch)&&Number.isFinite(last.pitch)?Math.abs(p.pitch-last.pitch)/12:0;
  if(Math.max(Math.abs(p.energy-last.energy)/.055,Math.abs(p.tone-last.tone)/.08,pitch/.14)<1)continue;
  points.push(p);
 }
 return points;
}
function cinematicSample(scene,time){
 const points=scene.motion;let i=0;while(i+1<points.length&&points[i+1].time<=time)i++;
 const a=points[i],b=points[i+1]||a,t=a===b?0:clamp((time-a.time)/(b.time-a.time));
 return {energy:a.energy+(b.energy-a.energy)*t,tone:a.tone+(b.tone-a.tone)*t,pitch:Number.isFinite(a.pitch)&&Number.isFinite(b.pitch)?a.pitch+(b.pitch-a.pitch)*t:a.pitch};
}
function cinematicPose(scene,time){
 const sample=cinematicSample(scene,time),opening=sample.energy;
 const pitch=Number.isFinite(sample.pitch)&&Number.isFinite(scene.motion[0].pitch)?Math.max(-1,Math.min(1,(sample.pitch-scene.motion[0].pitch)/12)):0;
 const texture=Math.max(-1,Math.min(1,(sample.tone-scene.motion[0].tone)*3));
 return [-1,-1/3,1/3,1].map((role,i)=>{
  const outer=i===0||i===3;
  return {pan:role*(7+opening*25)+(outer?2:5)*texture,
   tilt:Math.max(.55,Math.min(1.08,.6+opening*.28+(outer?-.03:.04)+pitch*(outer?.045:.1)))};
 });
}

export function lightingScenes(plan){
 if(!plan)return [];
 if(cache.has(plan))return cache.get(plan);
 const phrases=plan.arrangement?.patterns?.phrases||[],drama=plan.arrangement?.drama,memory=new Map();
 // Relative energy describes contrast, not silence. Only measured withdrawals
 // can turn an entire picture off, and phrase boundaries let a returning groove
 // recover inside a long structural section.
 const withdrawals=[...(plan.arrangement?.blackouts||[]),...instrumentRests(plan.structure?.instruments)];
 const spans=(plan.sections||[]).flatMap((section,sectionIndex)=>{
  const boundaries=[section.start,section.end,...phrases.flatMap(p=>[p.start,p.end]),...withdrawals.flatMap(p=>[p.start,p.end])]
   .filter(t=>Number.isFinite(t)&&t>=section.start&&t<=section.end);
  const points=[...new Set(boundaries)].sort((a,b)=>a-b);
  return points.slice(0,-1).map((start,i)=>({...section,start,end:points[i+1],sectionIndex,sectionStart:section.start,sectionEnd:section.end}));
 });
 let previousEnergy=0;
 const scenes=spans.map((section,index)=>{
  const local=phrases.filter(p=>p.start<section.end&&p.end>section.start);
  const average=(read,fallback)=>{
   const values=local.map(p=>({v:read(p),w:Math.min(p.end,section.end)-Math.max(p.start,section.start)})).filter(p=>Number.isFinite(p.v));
   return values.length?values.reduce((n,p)=>n+p.v*p.w,0)/values.reduce((n,p)=>n+p.w,0):fallback;
  };
  const samples=key=>drama?.step>0?(drama[key]||[]).slice(Math.floor(section.start/drama.step),Math.ceil(section.end/drama.step)).filter(Number.isFinite):[];
  const mean=(xs,fallback)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
  const energies=samples('intensity');
  const energy=clamp(mean(energies,average(p=>p.energy,section.intensity??.4)));
  const percussion=clamp(mean(samples('percussion'),average(p=>p.movement?.driving,0)));
  const rhythmic=average(p=>p.movement?.character==='rhythmic'?p.movement.driving:0,0);
  const onsets=(plan.arrangement?.times||[]).filter((t,i)=>t>=section.start&&t<section.end&&plan.arrangement.eventSources?.[i]==='onset').length;
  // Drum share is not rhythmic drive: guitar-led passages can have a strong
  // measured pulse while drums occupy a small part of the mix. Require both
  // phrase evidence and actual audio attacks before recovering that pulse.
  const recovered=rhythmic>=.65&&percussion>=.15&&energy>=.15&&onsets>=Math.max(2,(section.end-section.start)*.3);
  const drive=recovered?Math.max(percussion,.55+.2*rhythmic):percussion;
  const vocals=clamp(mean(samples('vocalShare'),average(p=>p.attention?.leader==='vocals'&&p.attention.confidence>=.5?1:0,0)));
  const texture=average(p=>p.movement?.character==='atmospheric'?1:0,0);
  const tone=clamp(average(p=>p.tone,.5));
  const third=Math.max(1,Math.floor(energies.length/3));
  const allEvidence=section.buildEvidence?.levels||[];
  const evidenceStep=section.buildEvidence?.step||(section.sectionEnd-section.sectionStart)/allEvidence.length;
  const evidence=allEvidence.slice(Math.floor((section.start-section.sectionStart)/evidenceStep),Math.ceil((section.end-section.sectionStart)/evidenceStep));
  const rise=energies.length?mean(energies.slice(-third),energy)-mean(energies.slice(0,third),energy):evidence.length?evidence.at(-1)-evidence[0]:local.length>1?(local.at(-1).energy??energy)-(local[0].energy??energy):0;
  const developments=(plan.arrangement?.developments||[]).filter(e=>e.time>=section.start&&e.time<section.end&&Number.isFinite(e.progress));
  const measuredBuild=developments.length>=2&&developments.at(-1).progress-developments[0].progress>=.2;
  let kind,reason;
  if(withdrawals.some(p=>p.start<=section.start&&p.end>=section.end)){kind='silence';reason='Gemessener musikalischer Rückzug';}
  else if(measuredBuild||rise>=.18&&energy>=.25){kind='build';reason='Gemessener Energieaufbau';}
  else if(energy>=.7&&drive>=.45&&(section.look==='peak'||energy-previousEnergy>=.18)){kind='impact';reason='Kräftiger Einsatz nach Kontrast oder Höhepunkt';}
  else if(drive>=.45){kind='groove';reason='Stabiler rhythmischer Antrieb';}
  else if(quiet(section.look)||vocals>=.55||energy<.35){kind='sculpture';reason=vocals>=.55?'Gesang bekommt Raum':'Reduzierte, stehende Beleuchtung';}
  else if(!local.length&&!energies.length){kind='sculpture';reason='Fehlende Analyse: stabiles Bild';}
  else {kind='sweep';reason='Getragene flächige Entwicklung';}
  const key=section.motif===undefined?null:String(section.motif)+':'+kind;
  const prior=key===null?null:memory.get(key);
  // Repeated musical motifs return to the same orientation, while energy may
  // change reach/occupancy. New motifs follow their measured spectral balance.
  const direction=prior?.direction??(tone>=.5?1:-1);
  const scene={start:section.start,end:section.end,index,sectionIndex:section.sectionIndex,kind,reason,energy,drive,vocals,tone,texture,evidence:local.length>0||energies.length>0,direction,motif:section.motif,recalled:!!prior};
  if(kind!=='silence'&&cinematicEvidence(plan,scene.start,scene.end)){scene.motion=cinematicFrames(plan,scene.start,scene.end);scene.cinematic=scene.motion.length>0;}
  if(key!==null)memory.set(key,scene);previousEnergy=energy;return scene;
 });
 directSong(scenes);
 let anchor=null,group=0;
 for(const scene of scenes){
  if(anchor&&(scene.sectionIndex!==anchor.sectionIndex||scene.kind!==anchor.kind||
    Math.abs(scene.energy-anchor.energy)>=.06||Math.abs(scene.tone-anchor.tone)>=.07||
    Math.abs(scene.vocals-anchor.vocals)>=.1||Math.abs(scene.drive-anchor.drive)>=.12)){group++;anchor=scene;}
  if(!anchor)anchor=scene;
  scene.groupIndex=group;
 }
 cache.set(plan,scenes);return scenes;
}
export function lightingSceneAt(plan,time){return lightingScenes(plan).find(s=>time>=s.start&&time<s.end)||null;}
export function scenePose(scene,time){
 if(scene.cinematic)return cinematicPose(scene,time);
 const p=clamp((time-scene.start)/Math.max(.001,scene.end-scene.start)),side=scene.direction;
 const variant=scene.variant||sceneVariants[scene.kind]?.[0],scale=scene.scale??1;
 return [-1,-1/3,1/3,1].map((role,i)=>{
  const outer=i===0||i===3,sign=role<0?-1:1;
  let pan=0,tilt=.72;
  switch(scene.kind){
   case 'silence':pan=role*8;break;
   case 'sculpture':
    if(variant==='open'){pan=role*20;tilt=.72;}
    else if(variant==='gates'){pan=sign*12;tilt=outer?.78:.6;}
    else if(variant==='terraces'){pan=0;tilt=outer?.58:.84;}
    else if(variant==='diagonal'){pan=side*14;tilt=.7+role*.12;}
    else {pan=side*8;tilt=.66;}break;
   case 'groove':
    if(variant==='steps'){pan=role*14;tilt=outer?.85:.63;}
    else if(variant==='wide'){pan=sign*28;tilt=.74;}
    else if(variant==='roof'){pan=role*24;tilt=.88-Math.abs(role)*.2;}
    else if(variant==='rails'){pan=side*12;tilt=outer?.62:.86;}
    else {pan=sign*18;tilt=outer?.7:.86;}break;
   case 'build':
    if(variant==='rise'){pan=role*22;tilt=.5+.4*p;}
    else if(variant==='wings'){pan=sign*(10+20*p);tilt=outer?.65+.2*p:.8;}
    else if(variant==='unfold'){pan=role*(4+32*p);tilt=outer?.68:.88;}
    else if(variant==='arch'){pan=role*(12+16*p);tilt=.6+.28*p-.14*Math.abs(role);}
    else {pan=role*(8+24*p);tilt=.65+.28*p;}break;
   case 'impact':
    if(variant==='wall'){pan=0;tilt=.9;}
    else if(variant==='split'){pan=sign*32;tilt=outer?.86:.7;}
    else if(variant==='tiers'){pan=role*16;tilt=outer?.95:.66;}
    else if(variant==='horizon'){pan=role*38;tilt=.74;}
    else {pan=role*(26+8*scene.energy);tilt=outer?.92:.8;}break;
   default:
    if(variant==='fan'){pan=role*18+side*(-12+24*p);tilt=.77;}
    else if(variant==='ribbon'){pan=side*(-16+32*p);tilt=.68+role*.1+.1*p;}
    else if(variant==='wings'){pan=sign*(12+16*p);tilt=.78-.12*p;}
    else if(variant==='lift'){pan=role*14;tilt=.56+.28*p;}
    else {pan=side*(-22+44*p);tilt=.73+.16*Math.sin(Math.PI*p);}
  }
  return {pan:Math.max(-40,Math.min(40,pan*scale)),tilt:Math.max(.45,Math.min(.98,tilt))};
 });
}

const bassCache=new WeakMap();
export function bassPresence(scene,plan,time){
 if(scene?.cinematic)return null;
 const rhythm=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end)?.rhythm;
 if(rhythm&&rhythm!=='auto')return null;
 if(!['groove','impact'].includes(scene?.kind)||scene.energy<.7||scene.drive<.55)return null;
 let events=bassCache.get(plan);
 if(!events){
  const stems=plan.structure?.instruments;
  const measured=stems?.bass?.length?bassAttackEvents(stems.bass,stems.step):plan.arrangement?.bassAttacks||[];
  const phrases=plan.arrangement?.patterns?.phrases||plan.sections||[];
  // Quiet bass decorations must not change the group assigned to the next
  // main note. Compare attacks within their own musical phrase.
  const thresholds=phrases.map(p=>Math.max(.55,...measured.filter(e=>e.time>=p.start&&e.time<p.end).map(e=>e.strength*.7)));
  events=measured.filter(e=>{
   const index=phrases.findIndex(p=>e.time>=p.start&&e.time<p.end);
   return e.strength>=(thresholds[index]??.55);
  });
  const bars=plan.beatGrid?.downbeats||[];
  let anchor=null,ordinal=0;
  events=events.map((event,i)=>{
   const phrase=phrases.find(p=>event.time>=p.start&&event.time<p.end);
   let lo=0,hi=bars.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(bars[mid]<=event.time+.025)lo=mid+1;else hi=mid;}
   const start=Math.max(phrase?.start??0,bars[lo-1]??0);
   // Repeat the same rhythmic figure with the same heads. Long gaps end an
   // unmetered figure; unrelated earlier notes cannot invert a later phrase.
   if(start!==anchor||i&&event.time-events[i-1].time>1.25){anchor=start;ordinal=0;}
   const unison=event.strength>=.85&&(event.time-(phrase?.start??-Infinity)<.12||i>0&&event.time-events[i-1].time>1.25);
   return {...event,phase:ordinal++%2,unison};
  });
  bassCache.set(plan,events);
 }
 let lo=0,hi=events.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].time<=time)lo=mid+1;else hi=mid;}
 const event=events[lo-1];
 if(!event||event.time<scene.start||time-event.time>.55)return null;
 const gap=events[lo]?events[lo].time-event.time:.5;
 const duration=Math.max(.18,Math.min(.55,gap*.85,event.duration??.42));
 const age=time-event.time;
 if(age>duration)return null;
 if(event.unison)return {level:.85+.15*event.strength,spread:1,mask:'all'};
 return {level:.85+.15*event.strength,spread:1,mask:'bass-chase',phase:event.phase,age,duration};
}

export function scenePresence(scene,plan,time){
 const progress=clamp((time-scene.start)/Math.max(.001,scene.end-scene.start));
 const edit=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end);
 const rhythm=edit?.rhythm;
 if(scene.cinematic){const energy=cinematicSample(scene,time).energy;return {level:.5+.45*energy,spread:energy,mask:'expand'};}
 const bass=(!rhythm||rhythm==='auto')&&bassPresence(scene,plan,time);
 if(bass)return bass;
 const events=rhythm==='none'?[]:rhythm==='strong'?edit.events||[]:plan.beatGrid?.downbeats||[];
 const bars=events.filter(t=>t>=Math.max(scene.start,edit?.start??0)&&t<=time);
 const latest=bars.at(-1),bar=bars.length?bars.length-1:0;
 const age=Number.isFinite(latest)?time-latest:Infinity;
 const t=clamp(age/.16),fade=t*t*(3-2*t);
 const gesture=rhythm&&rhythm!=='auto'?null:lightingGestureAt(plan,time);
 if(gesture&&['groove','impact'].includes(scene.kind)){
  const elapsed=time-gesture.time,emphasis=1-clamp(elapsed/.6);
  const levels=[0,1,2,3].map(i=>gesture.lead.includes(i)?1:.66);
  return {level:scene.kind==='impact'?.9:.75+.1*emphasis,spread:1,mask:'roles',roles:levels};
 }
 switch(scene.kind){
  case 'silence':return {level:0,spread:0,mask:'center'};
  case 'sculpture':return {level:.4,spread:0,mask:['gates','open'].includes(scene.variant)?'edges':'center'};
  case 'groove':return scene.presentation==='breathe'?{level:.55+.25*(1-fade),spread:1,mask:'all'}:{level:.8,spread:0,mask:'answer',pairMix:bar%2===0?fade:1-fade};
  case 'build':return {level:.45+.4*progress,spread:progress,mask:scene.presentation==='outside'?'gather':'expand'};
  case 'impact':return {level:.95,spread:1,mask:'all'};
  default:return {level:.55,spread:1,mask:'all'};
 }
}

export function musicalMovementEvents(plan,bars){
 const arrangement=plan.arrangement||{},phrases=arrangement.patterns?.phrases||plan.sections||[];
 const selected=[];
 for(const phrase of phrases){
  const local=(arrangement.times||[]).flatMap((time,i)=>time>=phrase.start&&time<phrase.end&&Number.isFinite(arrangement.eventSalience?.[i])?[{time,salience:arrangement.eventSalience[i],source:arrangement.eventSources?.[i]}]:[]);
  const values=local.map(e=>e.salience).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)]??0;
  const candidates=local.filter(e=>e.salience>=.55&&e.salience>=median*1.5&&e.salience-median>=.15).sort((a,b)=>b.salience-a.salience);
  let count=0;
  for(const event of candidates){
   if(count>=Math.max(1,Math.ceil((phrase.end-phrase.start)/3)))break;
   if(selected.some(e=>Math.abs(e.time-event.time)<.8))continue;
   selected.push({...event,kind:'accent'});count++;
  }
 }
 // Recovered drum attacks already have acoustic evidence. They need not be
 // exceptional relative to one another to sustain motion when bars are missing.
 let lastRecovered=-Infinity;
 for(let i=0;i<(arrangement.times?.length||0);i++){
  const time=arrangement.times[i];
  if(arrangement.eventSources?.[i]!=='instrument'||time-lastRecovered<.8||bars.some(t=>Math.abs(t-time)<.8))continue;
  if(selected.some(e=>Math.abs(e.time-time)<.65)){lastRecovered=time;continue;}
  selected.push({time,kind:'recovered'});lastRecovered=time;
 }
 // A sustained, confidently measured pitch change is also a movement arrival.
 // Keep its actual onset, rather than waiting for the next bar or chasing every
 // short pitch estimate. The same events feed cue planning and target sampling.
 const notes=plan.score?.notes||[],track=plan.score?.track||[];
 for(let i=1;i<notes.length;i++){
  const note=notes[i];
  if(note.end-note.start<.24||Math.abs(note.midi-notes[i-1].midi)<2||selected.some(e=>Math.abs(e.time-note.start)<.8))continue;
  let lo=0,hi=track.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(track[mid].time<note.start)lo=mid+1;else hi=mid;}
  if(track.slice(lo,lo+3).filter(p=>p.time<note.end&&p.confidence>=.35).length<2)continue;
  selected.push({time:note.start,kind:'melody'});
 }
 for(const event of arrangement.developments||[]){
  if(!Number.isFinite(event.time)||!Number.isFinite(event.progress)||selected.some(e=>Math.abs(e.time-event.time)<1.5))continue;
  selected.push({...event,kind:'development'});
 }
 for(const scene of lightingScenes(plan))if(scene.cinematic)for(const point of scene.motion.slice(1))selected.push({time:point.time,kind:'expression'});
 const ordinals=new Map();
 const regular=bars.map(time=>{
  const index=(plan.sections||[]).findIndex(s=>time>=s.start&&time<s.end),bar=ordinals.get(index)||0;
  ordinals.set(index,bar+1);return {time,kind:'bar',bar};
 }).filter(e=>!selected.some(s=>Math.abs(s.time-e.time)<.65));
 return [...regular,...selected].filter(e=>e.time>=0&&e.time<=plan.duration).sort((a,b)=>a.time-b.time);
}

// Keep one spatial idea through a musical phrase. Its measured contour and
// accents change the pose; a variety quota must never rotate the choreography.
const gestureCache=new WeakMap();
const gestureGroups=[[0,1],[2,3],[0,3],[1,2]];
export function lightingGestures(plan){
 if(!plan)return [];
 if(gestureCache.has(plan))return gestureCache.get(plan);
 const scenes=lightingScenes(plan),bars=(plan.beatGrid?.downbeats||[]).filter(Number.isFinite);
 const entries=scenes.filter(s=>['groove','impact'].includes(s.kind)&&s.drive>=.45&&!s.cinematic).map(s=>({time:s.start,kind:'entry'}));
 const events=[...musicalMovementEvents(plan,bars).filter(e=>!entries.some(s=>Math.abs(s.time-e.time)<.01)),...entries].sort((a,b)=>a.time-b.time);
 const gestures=[];
 for(const event of events){
  const scene=scenes.find(s=>event.time>=s.start&&event.time<s.end);
  if(!scene||scene.cinematic||!['groove','impact'].includes(scene.kind)||scene.drive<.45||event.kind==='development')continue;
  const edit=plan.sectionLighting?.find(s=>event.time>=s.start&&event.time<s.end);
  if(edit?.movement===0)continue;
  const previous=gestures.at(-1);
  if(previous&&event.time-previous.time<.65)continue;
  const local=plan.arrangement?.patterns?.phrases?.find(p=>event.time>=p.start&&event.time<p.end);
  const d=plan.arrangement?.drama,at=d?.step>0?Math.max(0,Math.floor(event.time/d.step)):-1;
  const drama={intensity:d?.intensity?.[at],percussion:d?.percussion?.[at],vocalShare:d?.vocalShare?.[at]};
  const attention=plan.structure?.instruments?musicalAttention(plan.structure.instruments,Math.max(scene.start,event.time-.35),Math.min(scene.end,event.time+.35)):local?.attention;
  const leader=attention?.confidence>=.5?attention.leader:'mixed';
  const energy=clamp(drama?.intensity??local?.energy??scene.energy),drive=Math.max(scene.drive,clamp(drama?.percussion??scene.drive));
  const vocals=clamp(drama?.vocalShare??scene.vocals),tone=clamp(local?.tone??scene.tone);
  const accent=event.kind==='accent'?clamp(event.salience):0;
  const group=leader==='vocals'||leader==='other'?3:2;
  const name=leader==='vocals'?'focus':leader==='bass'?'fold':leader==='other'?'diagonal':'strike';
  const points=plan.score?.track||[];
  let a=0,b=points.length;
  while(a<b){const mid=(a+b)>>>1;if(points[mid].time<event.time-.08)a=mid+1;else b=mid;}
  const pitched=[];
  for(let i=a;i<points.length&&points[i].time<=event.time+.2;i++)if(points[i].confidence>=.35&&Number.isFinite(points[i].position))pitched.push(points[i]);
  const contour=pitched.length>=2?pitched.reduce((sum,p)=>sum+p.position,0)/pitched.length:null;
  // Ordinary measured percussion gets only a small breathing motion. Large
  // strokes need a standout attack, not merely the next number on the grid.
  const phraseStart=local?.start??scene.start;
  const bar=events.filter(e=>['bar','recovered'].includes(e.kind)&&e.time>=phraseStart&&e.time<=event.time).length-1;
  const breathing=.06*clamp((drive-.45)/.4)*(1-vocals*.7);
  const stroke=accent?1:event.kind==='entry'?.5:.5+(bar%2===0?breathing:-breathing);
  const nextBar=bars.find(t=>t>event.time+.01);
  const previousBar=bars.filter(t=>t<event.time-.01).at(-1);
  const interval=nextBar!==undefined&&previousBar!==undefined?(nextBar-previousBar)/(bars.includes(event.time)?2:1):nextBar!==undefined?nextBar-event.time:2;
  // A percussion accent settles quickly; sustained/melodic material gets a
  // longer connected move. All durations scale with the measured musical grid.
  const seconds=Math.max(.45,Math.min(1.6,interval*(accent?.28:contour!==null||leader==='vocals'||leader==='other'?.7:.45)));
  const formation=scene.kind==='impact'?(scene.climax?'cross':'parallel'):'fan';
  const coordinated=formation!=='fan'||scene.energy>=.75;
  const gesture={formation,coordinated,time:event.time,scene:scene.index,kind:event.kind,name,group,direction:0,energy,drive,vocals,tone,leader,accent,contour,stroke,
   seconds,lead:gestureGroups[group],strength:.6+.4*Math.max(energy,drive*.8)};
  gestures.push(gesture);
 }
 gestureCache.set(plan,gestures);return gestures;
}
export function lightingGestureAt(plan,time){
 const gestures=lightingGestures(plan);let lo=0,hi=gestures.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(gestures[mid].time<=time)lo=mid+1;else hi=mid;}
 const gesture=gestures[lo-1];
 return gesture&&lightingSceneAt(plan,time)?.index===gesture.scene?gesture:null;
}
export function gesturePose(gesture){
 const {group,energy,drive,accent,contour,stroke,leader}=gesture;
 const melodic=contour!==null&&Number.isFinite(contour);
 const pitch=melodic?contour-.5:0;
 const opening=melodic?.5:stroke;
 const span=8+energy*12+opening*(4+drive*6)+accent*4;
 // Ordered, non-crossing roles retain a readable picture. The audible melodic
 // contour moves the lead pair vertically; support follows at lower amplitude.
 return [-1,-1/3,1/3,1].map((role,i)=>{
  const lead=gestureGroups[group].includes(i),outer=i===0||i===3;
  let pan=role*span*(leader==='bass'?.85:1)*(leader==='vocals'&&!outer?.65:1)+pitch*(lead?10:4);
  let tilt=.76+energy*.06+(melodic?pitch*(lead?.24:.1):(opening-.5)*(lead?.12:.045))+(outer?-.035:.035)+accent*(lead?.04:0);
  // Whole-rig figures share a plane and one arrival. Their identity changes
  // with musical contrast, never with an arbitrary effect counter.
  if(gesture.coordinated)tilt=.76+energy*.06+pitch*.16+(opening-.5)*.08+accent*.04;
  if(gesture.formation==='parallel')pan=pitch*14;
  else if(gesture.formation==='cross')pan=-role*span*.7+pitch*6;
  else if(gesture.formation==='wings'){pan=role*span*.85+pitch*6;tilt+=Math.abs(role)*.14-.07;}
  else if(gesture.formation==='tiers'){pan=role*span*.45+pitch*6;tilt+=(Math.abs(role)<.5?.1:-.07);}
  return {pan:Math.max(-40,Math.min(40,pan)),tilt:Math.max(.55,Math.min(1.08,tilt))};
 });
}
