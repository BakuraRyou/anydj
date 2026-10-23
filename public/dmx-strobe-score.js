import {strobeConductor,strobeMusicAt} from './dmx-strobe-conductor.js';
import {STROBE_MOTIFS,chooseStrobeMotif,motifExposure} from './dmx-strobe-motifs.js';
import {beatPosition} from './dmx-show.js';
import {strobeChoreography} from './dmx-strobe-choreography.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const cache=new WeakMap();
const endingCache=new WeakMap();
// A terminal analysis pause is a release of the last picture, not a new
// all-rig blackout. Internal musical rests retain their authored shutters.
export function strobeEndingAt(plan,time){
 if(!plan||!Number.isFinite(time))return null;
 if(!endingCache.has(plan)){
  const sequences=strobeConductor(plan).sequences;
  let index=sequences.length-1;
  while(index>=0&&sequences[index].role==='silence')index--;
  const previous=sequences[index],first=sequences[index+1];
  endingCache.set(plan,previous&&first?{start:first.start,end:Math.min(plan.duration??sequences.at(-1).end,first.start+1.8),sampleTime:previous.end-1e-6}:null);
 }
 const ending=endingCache.get(plan);
 if(!ending||time<ending.start||time>=ending.end)return null;
 return {...ending,level:1-ease((time-ending.start)/(ending.end-ending.start))};
}
export const STROBE_FORMS=['fan-open','fan-close','cross-through','parallel-rise','parallel-fall','opposing-wings','arch-open','diagonal-pass','ribbon-left','ribbon-right','centre-out','edges-in','scissor','staircase','curtain','orbit-open','braid','double-fan','roof-fold','wave-pass'];
function family(scene){return scene.kind==='silence'?'silence':scene.kind==='sculpture'?'calm':scene.kind==='sweep'?'flow':scene.kind==='impact'?'impact':scene.kind==='build'?'build':'groove';}
// Choose geometry from musical roles, not the ordinal position in a playlist.
export function strobeMusicalChoice(scene,kind=family(scene)){
 const motifId=chooseStrobeMotif(scene,kind);
 return {form:STROBE_MOTIFS[motifId].form,motifId};
}
// Repetition lives inside one musical passage. A new bar alone is not a reason
// to replace the motif, restart its beat clock, or jump back to its first pose.
// One passage spans adjacent analysis scenes that use the same light motif.
// Local feature changes must not restart its rhythm or its motor development.
export function strobePassages(scenes,plan){
 const passages=[],recall=new Map();
 for(const scene of scenes){
  const kind=plan.sections?.[scene.sectionIndex]?.look==='outro'?'outro':family(scene);
  const key=scene.motif==null?null:`${kind}:${scene.motif}`;
  const choice=scene.strobeChoice||(key&&recall.get(key))||strobeMusicalChoice(scene,kind),previous=passages.at(-1);
  if(key)recall.set(key,choice);
  const compatible=previous&&Math.abs(previous.end-scene.start)<1e-6&&previous.motifId===choice.motifId&&previous.form===choice.form
   &&previous.silent===(kind==='silence')&&previous.outro===(kind==='outro');
  if(compatible){
   previous.energySum+=(scene.energy??.4)*(scene.end-scene.start);
   previous.end=scene.end;previous.scenes.push(scene);
  }else passages.push({...choice,start:scene.start,end:scene.end,silent:kind==='silence',outro:kind==='outro',
   geometryKind:kind,direction:scene.direction??1,energySum:(scene.energy??.4)*(scene.end-scene.start),scenes:[scene]});
 }
 return passages.map(p=>({...p,energy:p.energySum/Math.max(.001,p.end-p.start)}));
}
export function strobeScore(plan){
 if(!plan)return [];
 if(cache.has(plan))return cache.get(plan);
 const figures=[],bars=plan.beatGrid?.downbeats||[];let ordinal=0;
 const forms={parallel:3,fan:0,converge:11,cross:2,wings:5,tiers:13,arc:6,ribbon:19};
 const scenes=strobeConductor(plan).pictures.map((p,index)=>{
  const kind=p.role==='silence'?'silence':p.role==='held'?'sculpture':p.role==='build'?'build':p.role==='arrival'?'impact':p.role==='flow'?'sweep':'groove';
  return {...p,index,kind,strobeChoice:{...strobeMusicalChoice({...p,kind}),form:forms[p.form]??6}};
 });
 const passages=strobePassages(scenes,plan);
 for(const passage of passages){
 const previous=figures.at(-1);
 const previousFigure=previous?{music:strobeMusicAt(plan,passage.start-1e-7),form:previous.form,motifId:previous.motifId,kind:previous.kind,geometryKind:previous.geometryKind,energy:previous.energy,direction:previous.direction,progress:1,motionProgress:1}:null;
 for(const scene of passage.scenes){
  const kind=plan.sections?.[scene.sectionIndex]?.look==='outro'?'outro':family(scene);
  const inside=bars.filter(t=>t>scene.start+.05&&t<scene.end-.05);
  const stride=['calm','outro'].includes(kind)?4:kind==='impact'?1:2;
  const boundaries=[scene.start,...inside.filter((_,i)=>(i+1)%stride===0),scene.end];
  const choice={form:passage.form,motifId:passage.motifId,rhythmAnchor:passage.start,rowOrdinal:scene.groupIndex??scene.index};
  const grid=plan.beatGrid?.beats||plan.beatTiming?.times;
  const anchor=beatPosition(grid,choice.rhythmAnchor);
  const attackBeats=anchor===null?[]:(plan.arrangement?.bassAttacks||[])
   .filter(e=>e.time>=passage.start&&e.time<passage.end&&e.strength>=.7)
   .map(e=>beatPosition(grid,e.time)-anchor);
  const accentEvents=[];
  const arrangement=plan.arrangement||{};
  for(let i=0;i<(arrangement.times||[]).length;i++){
   const time=arrangement.times[i],strength=arrangement.accents?.[i]??0;
   if(time<passage.start||time>=passage.end||strength<.6||(accentEvents.length&&time-accentEvents.at(-1).time<.65))continue;
   accentEvents.push({time,strength});
  }
  for(let i=0;i<boundaries.length-1;i++){
   const start=boundaries[i],end=boundaries[i+1];
   if(end-start<.4&&figures.length&&figures.at(-1).scene===scene.index){figures.at(-1).end=end;continue;}
   const {form,rhythmAnchor,rowOrdinal,motifId}=choice;
   figures.push({attackBeats,accentEvents,motifId,previousFigure,geometryKind:passage.geometryKind,motionStart:passage.start,motionEnd:passage.end,start,end,scene:scene.index,kind,form,rhythmAnchor,rowOrdinal,motionReverse:false,id:`${kind}-${STROBE_FORMS[form]}`,ordinal:ordinal++,energy:passage.energy,drive:scene.drive,direction:passage.direction});
  }
 }
 }
 cache.set(plan,figures);return figures;
}
export function strobeScoreAt(plan,time){
 const ending=strobeEndingAt(plan,time);
 if(ending){const held=strobeScoreAt(plan,ending.sampleTime);return held?{...held,endingLevel:ending.level}:null;}
 const score=strobeScore(plan);let lo=0,hi=score.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(score[mid].start<=time)lo=mid+1;else hi=mid;}
 const figure=score[lo-1];if(!figure||time>=figure.end)return null;
 const edit=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end);
 const grid=plan.beatGrid?.beats||plan.beatTiming?.times;
 const beat=beatPosition(grid,time),anchor=beatPosition(grid,figure.rhythmAnchor??figure.start);
 const rhythmBeat=beat===null||anchor===null?null:beat-anchor;
 const events=figure.accentEvents||[];
 let accentLevel=0;
 const phrasePhase=rhythmBeat===null?null:((rhythmBeat%8)+8)%8;
 if(phrasePhase!==null&&(phrasePhase<.35||phrasePhase>=6)&&!['calm','outro','silence'].includes(figure.kind))for(let i=0;i<events.length;i++){
  const elapsed=time-events[i].time;
  if(elapsed>=0&&elapsed<.22&&events[i].strength>=.6)accentLevel=Math.max(accentLevel,(1-elapsed/.22)*events[i].strength);
 }
 const passageBeat=beatPosition(grid,figure.motionStart);
 const endBeat=beatPosition(grid,figure.motionEnd);
 const transitionProgress=figure.previousFigure?clamp(beat===null||passageBeat===null||endBeat===null
  ?(time-figure.motionStart)/Math.max(.001,Math.min(.8,(figure.motionEnd-figure.motionStart)/2))
  :(beat-passageBeat)/Math.max(.001,Math.min(2,(endBeat-passageBeat)/2))):1;
 const music=strobeMusicAt(plan,time);
 return {...figure,music,...(edit?.movement===0?{geometrySequence:strobeMusicAt(plan,edit.start).sequence}:{}),transitionProgress,accentLevel,rhythmBeat,presentation:'strobe',composition:STROBE_FORMS[figure.form],progress:clamp((time-figure.start)/(figure.end-figure.start)),motionProgress:clamp((time-figure.motionStart)/(figure.motionEnd-figure.motionStart)),amount:Number.isFinite(edit?.movement)?clamp(edit.movement):1};
}
export function strobeComposition(figure,rank,count,row=0,groups=1){
 const result=strobeCompositionPose(figure,rank,count,row,groups);
 return Number.isFinite(figure.endingLevel)?{...result,level:result.level*figure.endingLevel}:result;
}
function strobeCompositionPose(figure,rank,count,row=0,groups=1){
 if(figure.music?.sequence?.sharedPassage)return strobeDramaticComposition(figure,rank,count,row,groups);
 if(figure.music?.sequence)return strobeStageComposition(figure,rank,count,row,groups);
 const motif=STROBE_MOTIFS[figure.motifId];
 const path=figure.music?.transfer?.solo?.position??figure.music?.transfer?.lead?.position;
 // Motors develop over several measured entrances, while shutters pass light
 // between neighbours faster. Held passages never acquire a free-running sweep.
 const motorPhase=Number.isFinite(path)?path/6:0;
 const travel=figure.music?(['calm','outro','silence'].includes(figure.kind)?.5:Number.isFinite(path)?(1-Math.cos(motorPhase*Math.PI))/2:.65)
  :motif?(motif.motion==='hold'?.65:ease(figure.motionProgress??figure.progress)):ease((figure.progress-.08)/.78),p=motif?travel:figure.motionReverse?1-travel:travel,u=count>1?rank/(count-1):.5,r=2*u-1,side=r<0?-1:1;
 const direction=figure.direction??1,q=direction>0?p:1-p;
 let x=.5,y=.5;
 switch(figure.form){
  case 0:x=.5+r*(.06+.38*p);y=.25+.5*p;break;
  case 1:x=.5+r*(.44-.38*p);y=.75-.5*p;break;
  case 2:x=.5+r*.42*(1-2*p);y=.25+.5*p;break;
  case 3:x=figure.music?.5+.18*Math.sin(motorPhase*Math.PI):.5+r*.35;y=.15+.7*p;break;
  case 4:x=figure.music?.5-.18*Math.sin(motorPhase*Math.PI):.5+r*.35;y=.85-.7*p;break;
  case 5:x=.5+side*(.08+.35*p);y=.5+r*.28*(1-p);break;
  case 6:x=.5+r*(.12+.3*p);y=.25+(1-r*r)*.45*p;break;
  case 7:x=.15+.7*q;y=.5+r*.3;break;
  case 8:x=.18+.62*p;y=.5+.2*Math.sin(r*2+p*Math.PI);break;
  case 9:x=.82-.62*p;y=.5-.2*Math.sin(r*2+p*Math.PI);break;
  case 10:x=.5+r*.43*p;y=.5+Math.abs(r)*.3*p;break;
  case 11:x=.5+r*.43*(1-p);y=.5-Math.abs(r)*.3*p;break;
  case 12:x=.5+r*.36*Math.cos(p*Math.PI);y=.5+side*.25*Math.sin(p*Math.PI);break;
  case 13:x=.2+.6*u;y=figure.music?.25+.5*(direction>0?u:1-u):.2+.6*ease(p*1.6-u*.6);break;
  case 14:x=.5+r*.4;y=.2+.6*ease(p*1.6-Math.abs(r)*.6);break;
  case 15:x=.5+.36*Math.cos(u*Math.PI+p*Math.PI);y=.5+.3*Math.sin(u*Math.PI+p*Math.PI);break;
  case 16:x=.5+r*.35*Math.cos(p*Math.PI);y=.5+side*.24*Math.sin(p*Math.PI+u);break;
  case 17:x=.5+side*.2+r*.2*p;y=.3+.4*p;break;
  case 18:x=.5+r*(.4-.25*p);y=.75-Math.abs(r)*.45*(1-p);break;
  case 19:x=.5+r*.35;y=.5+.28*Math.sin(r*2-p*Math.PI);break;
 }
 const gentle=['calm','outro'].includes(figure.kind),width=['calm','outro'].includes(figure.geometryKind??figure.kind)?.55:.7+.3*figure.energy;
 x=.5+(x-.5)*width*(figure.amount??1);y=.5+(y-.5)*width*(figure.amount??1);
 // Measured timbre and melodic height shape the picture between entrances.
 if(figure.music){
  const pitch=figure.music.pitch;
  y+=((Number.isFinite(pitch)?Math.max(-1,Math.min(1,(pitch-60)/24)):0)*.12+(figure.music.tone-.5)*.08)*(figure.amount??1);
 }
 // Carry the previous spatial picture into the next one over two measured
 // beats. Exposure still follows the authored events, independently of travel.
 if(figure.previousFigure&&Number.isFinite(figure.transitionProgress)&&figure.transitionProgress<1){
  const previous=strobeComposition({...figure.previousFigure,amount:figure.amount},rank,count,row,groups);
  const blend=ease(figure.transitionProgress);
  x=previous.x+(x-previous.x)*blend;y=previous.y+(y-previous.y)*blend;
 }
 // Membership, rather than a shared dimmer, draws the rhythmic figure.
 // A motif repeats on the song beat while the slower target path develops.
 const rhythmic=Number.isFinite(figure.rhythmBeat);
 const period=figure.stepBeats??(gentle?2:figure.kind==='impact'?.5:1);
 const position=rhythmic?Math.max(0,figure.rhythmBeat)/period:0;
 const step=Math.floor(position+1e-8),phase=position-step;
 const pairs=Math.ceil(count/2),pair=Math.min(rank,count-1-rank);
 let bank,banks;
 switch(figure.form%6){
  case 0:banks=Math.min(2,count);bank=rank%banks;break;
  case 1:banks=pairs;bank=pairs-1-pair;break;
  case 2:banks=Math.min(2,count);bank=rank<count/2?0:banks-1;break;
  case 3:banks=Math.min(3,count);bank=rank%banks;break;
  case 4:banks=pairs;bank=pair;break;
  case 5:banks=Math.min(4,count);bank=(rank+row)%banks;break;
 }
 banks=Math.max(1,banks);
 const budget=figure.kind==='impact'?Math.max(1,Math.ceil(groups*.67)):Math.max(1,Math.ceil(groups*.5));
 const membership=step=>{
  // Row handover uses one clock even when rows have different fixture counts.
  const activeRow=(row-((figure.rowOrdinal??figure.ordinal)+Math.floor(step/2))%groups+groups)%groups<budget;
  return activeRow&&(!rhythmic||bank===(step+row)%banks)?1:0;
 };
 // Transfer light between banks. Never close a master shutter on every beat:
 // the outgoing picture stays visible until the incoming one takes over.
 const handover=rhythmic?ease((phase-(gentle?.6:figure.kind==='impact'?.9:.82))/(gentle?.4:figure.kind==='impact'?.1:.18)):0;
 const level=figure.music?strobeBeamExposure(figure,rank,count,row,groups):motif?motifExposure(figure,rank,count,row,groups):membership(step)*(1-handover)+membership(step+1)*handover;
 const strength=Number.isFinite(figure.flicker)?clamp(figure.flicker/100):1;
 return {x:clamp(x),y:clamp(y),level:figure.kind==='silence'?0:1-strength+strength*level,weight:1,wallBlend:figure.music?0:motif?1:0,paired:[0,1,2,5,6,10,11,12,14,17,18].includes(figure.form)?1:0,articulation:0};
}

// Musical section decisions remain shared; Strobo owns its spatial pictures
// and the shutter sequence that reveals them.
export function strobeDramaticComposition(figure,rank,count,row=0,groups=1){
 return strobeChoreography(figure,rank,count,row,groups);
}

export function strobeFixtureRole(rank,count,row=0,chapter=0){
 if(count===1)return 'solo';
 if(count===2)return 'lead';
 // A musical role owns a whole mirrored unit. Interleaving four independent
 // roles across a row breaks every crossing/fan into isolated, unrelated rays.
 const pair=Math.min(rank,count-1-rank);
 const roles=['lead','answer','accent','support'].slice(0,Math.min(4,Math.ceil(count/2)));
 return roles[(pair+row+chapter)%roles.length];
}
function stagePose(sequence,rank,count,row,role,amount=1){
 const u=count>1?rank/(count-1):.5,r=u*2-1;
 let x=.5,y=.5;
 const formation=sequence?.formation??(sequence?.layout===2?'diagonal':sequence?.layout===1?'cross':'parallel');
 // These are complete beam pictures. Instrument roles articulate the same
 // picture at different heights, rather than defining unrelated directions.
 if(formation==='cross'){x=.5-r*.36;y=.38+.12*(1-Math.abs(r));}
 else if(formation==='fan'){x=.5+r*.38;y=.3+.25*(1-Math.abs(r));}
 else if(formation==='wings'){x=.5+Math.sign(r)*.28;y=.4;}
 else if(formation==='diagonal'){x=.35;y=.25+.45*u;}
 else {x=.5;y=.38;}
 const height={lead:0,solo:0,answer:.16,accent:.32,support:-.12}[role];
 y+=height;
 if(sequence?.motion==='open'&&(role==='lead'||role==='solo')){
  const progress=sequence.progress??1;
  x=.5+r*(.08+.3*progress);y=.25+.4*progress;
 }
 const contour=(Number.isFinite(sequence?.pitch)?Math.max(-1,Math.min(1,(sequence.pitch-60)/24))*.1:0)+((sequence?.tone??.5)-.5)*.08;
 return {x:.5+(x-.5)*amount,y:clamp(.5+(y-.5+contour)*amount)};
}
export function strobeStageComposition(figure,rank,count,row=0,groups=1){
 const sequence=figure.music.sequence,geometry=figure.geometrySequence||sequence.preparation||sequence;
 const role=figure.fixtureRole||strobeFixtureRole(rank,count,row,geometry.rolePhase??0),amount=figure.geometrySequence?1:figure.amount??1;
 const contour=geometry.motion==='contour'&&role==='answer'&&Number.isFinite(figure.music.pitch);
 const visibleMotion=!figure.geometrySequence&&(geometry.motion==='open'&&(role==='lead'||role==='solo')||contour);
 let pose=stagePose(contour?{...geometry,pitch:figure.music.pitch}:geometry,rank,count,row,role,amount);
 const offset={lead:0,solo:0,answer:.22,accent:.44,support:.66}[role];
 let ready=1;
 if(geometry.previous&&!geometry.continuing&&!geometry.preparedEntrance&&!figure.geometrySequence){
  const before=stagePose(geometry.previous,rank,count,row,strobeFixtureRole(rank,count,row,geometry.previous.rolePhase??0),amount);
  if(Math.hypot(before.x-pose.x,before.y-pose.y)>.001){
   const travel=ease((sequence.age-offset)/.5);
   pose={x:before.x+(pose.x-before.x)*travel,y:before.y+(pose.y-before.y)*travel};
   // Staggered dark repositioning leaves other roles visible during transfer.
   ready=sequence.age<offset?1:sequence.age<offset+.55?0:ease((sequence.age-offset-.55)/.08);
  }
 }
 const members=Array.from({length:count},(_,i)=>i).filter(i=>figure.fixtureRole||strobeFixtureRole(i,count,row,geometry.rolePhase??0)===role);
 const index=members.indexOf(rank),units=members.length;
 const entry=sequence.entry,step=Number.isFinite(entry?.phraseStep)?entry.phraseStep:Math.max(0,(sequence.stepBase??0)+sequence.step);
 const elapsed=entry?sequence.time-entry.time:0,span=sequence.stepDuration;
 const restrained=sequence.role==='held'||figure.kind==='calm'||figure.kind==='outro';
 const musical=!!entry&&!restrained&&sequence.rhythm!=='none';
 const duration=entry?Math.min(span*.85,entry.duration??.3):.3;
 const gain=entry?(.4+.6*(entry.strength??.6))*(entry.gain??1):1;
 const pulse=musical?Math.min(1,elapsed/.018,Math.max(0,(duration-elapsed)/.055))*gain:0;
 const selected=(position,reverse=false)=>{
  if(units<=1)return 1;
  const pairs=Math.ceil(units/2),banks=Math.min(4,pairs);
  const bank=Math.min(banks-1,Math.floor(Math.min(index,units-1-index)*banks/pairs));
  const p=((position%banks)+banks)%banks;
  return bank===(reverse?banks-1-p:p)?1:0;
 };
 const variant=sequence.pattern;
 const paired=(position)=>{
  const pairs=Math.ceil(units/2),banks=Math.max(1,Math.min(4,pairs));
  const bank=Math.min(banks-1,Math.floor(Math.min(index,units-1-index)*banks/pairs));
  return bank===((position%banks)+banks)%banks?1:0;
 };
 const bassLevel=()=>{
  const bass=(figure.music.active||[]).filter(e=>e.role==='support');
  let level=selected(figure.music.accompaniment?.ordinal??0)*(.4*(figure.music.accompaniment?.bass??0)+.15*(figure.music.accompaniment?.other??0));
  for(const e of bass)level=Math.max(level,selected(e.ordinal)*clamp(Math.min(e.elapsed/.025,(e.duration-e.elapsed)/.06))*(.45+.25*e.strength));
  return level;
 };
 let level=0;
 if(role==='support'){
  if(sequence.instrumentDriven&&sequence.rhythm!=='none'&&!restrained){
   // The accompaniment follows actual bass/bed activity, rather than being
   // the inverse of every drum pulse. Bass entrances own their own banks.
   level=bassLevel();
  }else{
  // Accompaniment takes over in the lead's release, instead of keeping the
  // same fixtures permanently on throughout every rhythmic passage.
  const handover=musical?1-clamp(pulse/Math.max(.001,gain)):1;
  level=selected(musical?Math.floor(step/4):0)*(.3+.25*clamp(sequence.energy))*handover;
  }
 }
 else if(role==='accent'){
  const accents=sequence.rhythm==='none'?[]:(figure.music.active||[]).filter(e=>e.role==='accent'||e.strength>=(sequence.accentThreshold??.97));
  for(const e of accents){const t=e.elapsed/e.duration;
   if(t<.65)level=Math.max(level,selected(e.ordinal??step)*Math.min(1,e.elapsed/.015,(e.duration*.65-e.elapsed)/.035));
  }
 }
 else if(role==='answer'){
  if(restrained||sequence.rhythm==='none')level=selected(0)*.15;
  // A response needs an actual melodic entrance, never an automatic delay
  // after every drum hit. Sustained responses follow their measured duration.
  if(sequence.rhythm!=='none')for(const e of figure.music.active||[])if(e.role==='answer')level=Math.max(level,selected(e.ordinal??step)*Math.min(1,e.elapsed/.025,(e.duration-e.elapsed)/.08));
 }
 else if(!musical)level=sequence.instrumentDriven&&!restrained&&sequence.rhythm!=='none'
  ?sequence.role==='build'?selected(0)*(.2+.35*(sequence.progress??0))*Math.max(figure.music.accompaniment?.bass??0,figure.music.accompaniment?.other??0):0:selected(0)*.6;
 else if(role==='lead'||role==='solo'){
  // Percussive runs advance neighbour by neighbour. Paired pictures reveal
  // complete mirrored units. A melodic dialogue holds its rhythmic anchor
  // until a real new entrance, rather than chasing under every note.
  const position=variant==='echo'?(entry?.ordinal??0)+row:variant==='centre'?Math.floor(step/2):step+row;
  const banks=Math.max(1,Math.min(4,units)),swing=2*Math.max(1,banks-1),phase=position%swing;
  const pendulum=phase<=banks-1?phase:swing-phase;
  const mask=variant==='pairs'?paired(Math.floor(position/2)):variant==='pendulum'?selected(pendulum):variant==='syncopated'?selected(step+row,span>.65)
   :variant==='wings'?((rank<count/2?0:1)===(step%2)?1:0):selected(position,variant==='zipper'&&step%2===1);
  level=mask*Math.max(0,pulse);
  // An authored arrival opens the leading role as a complete statement.
  // It is distinct from both the preceding build and the ordinary run.
  if(sequence.chapter==='arrival'&&elapsed>=0&&elapsed<Math.min(.45,span))level=Math.max(level,Math.max(0,pulse));
 }
 if(sequence.role==='build'&&musical&&role!=='accent'){
  const progress=sequence.progress??clamp((sequence.time-sequence.start)/(sequence.end-sequence.start));
  const budget=Math.max(1,Math.ceil(units*(.2+.45*progress)));
  if((index-step%Math.max(1,units)+units)%Math.max(1,units)<budget)level=Math.max(level,role==='support'?.38:Math.max(0,pulse)*.8);
 }
 // Small rigs combine responsibilities instead of losing the bass entirely.
 if(!figure.fixtureRole&&count<7&&(role==='solo'||count===2&&role==='lead'||role==='answer')){
  if(sequence.instrumentDriven&&!restrained&&sequence.rhythm!=='none')level=Math.max(level,bassLevel());
  else if(!restrained&&sequence.rhythm!=='none'&&role==='answer'&&pulse<=.01)level=Math.max(level,selected(0)*(.3+.25*clamp(sequence.energy)));
  if(role==='solo'||count===2)for(const e of figure.music.active||[])if(e.role==='answer'&&sequence.rhythm!=='none')
   level=Math.max(level,clamp(Math.min(e.elapsed/.025,(e.duration-e.elapsed)/.08)));
 }
 const strength=Number.isFinite(figure.flicker)?clamp(figure.flicker/100):1;
 const steady=selected(0)*(role==='accent'?0:role==='support'?.38:.65);
 // A positive impulse ceiling caps emitted light; it must not turn an
 // inactive role into a permanently glowing minimum. Zero disables pulses.
 level=(strength>0?clamp(level)*strength:steady)*ready;
 return {...pose,beamPicture:true,visibleMotion,level:sequence.role==='silence'||figure.kind==='silence'?0:clamp(level),weight:1,wallBlend:0,paired:0,articulation:0,fixtureRole:role};
}

export function strobeBeamExposure(figure,rank,count,row=0,groups=1){
 const music=figure.music;
 if(!music||music.role==='silence')return 0;
 const gentle=['held','calm','outro'].includes(music.role)||['calm','outro'].includes(figure.kind);
 const floor=gentle?.5:.12;
 const pair=Math.min(rank,count-1-rank),pairs=Math.ceil(count/2);
 // Alternate complete pairs, linear runs, wings and staggered rows. Normalize
 // bank size to the rig, retaining neighbouring support even on four fixtures.
 const paired=[0,1,2,5,6,10,11,12,16,17,18].includes(figure.form);
 const style=paired?0:figure.form%4;
 const banks=Math.max(1,Math.min(style===0?pairs:style===2?2:count,4));
 const bank=style===0?Math.min(banks-1,Math.floor(pair*banks/pairs))
  :style===2?(rank<count/2?0:banks-1)
  :Math.min(banks-1,Math.floor(rank*banks/Math.max(1,count)));
 const path=music.transfer?.[row%2?'answer':'lead'];
 const position=(path?.enabled?path.position:music.transfer?.solo?.position??0)+(groups>1?row*.5:0);
 const period=Math.max(1,2*(banks-1)),phase=((position%period)+period)%period;
 const at=phase<=banks-1?phase:period-phase;
 const run=banks===1?1:Math.max(0,1-Math.abs(bank-at));
 let accent=0,answer=0;
 for(const e of music.active||[]){
  const t=e.elapsed/Math.max(.001,e.duration);
  const envelope=Math.sin(Math.PI*clamp(t))*(e.strength??1)*(e.gain??1);
  if(e.role==='answer'&&bank===(e.ordinal??0)%banks)answer=Math.max(answer,envelope);
  else if(['bass','attack','accent'].includes(e.kind))accent=Math.max(accent,envelope);
 }
 // Measured attacks articulate the travelling beam, rather than flashing every
 // fixture together. No forced white, and no invented pulse without evidence.
 return clamp(floor+(1-floor)*Math.max(run*(gentle?.7:.65+.35*accent),answer*.7));
}
