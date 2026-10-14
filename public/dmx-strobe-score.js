import {strobeConductor,strobeMusicAt} from './dmx-strobe-conductor.js';
import {STROBE_MOTIFS,chooseStrobeMotif,motifExposure} from './dmx-strobe-motifs.js';
import {beatPosition} from './dmx-show.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const cache=new WeakMap();
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
 return {...figure,music:strobeMusicAt(plan,time),transitionProgress,accentLevel,rhythmBeat,presentation:'strobe',composition:STROBE_FORMS[figure.form],progress:clamp((time-figure.start)/(figure.end-figure.start)),motionProgress:clamp((time-figure.motionStart)/(figure.motionEnd-figure.motionStart)),amount:Number.isFinite(edit?.movement)?clamp(edit.movement):1};
}
export function strobeComposition(figure,rank,count,row=0,groups=1){
 const motif=STROBE_MOTIFS[figure.motifId];
 const travel=motif?(motif.motion==='hold'?.65:ease(figure.motionProgress??figure.progress)):ease((figure.progress-.08)/.78),p=motif?travel:figure.motionReverse?1-travel:travel,u=count>1?rank/(count-1):.5,r=2*u-1,side=r<0?-1:1;
 const direction=figure.direction??1,q=direction>0?p:1-p;
 let x=.5,y=.5;
 switch(figure.form){
  case 0:x=.5+r*(.06+.38*p);y=.25+.5*p;break;
  case 1:x=.5+r*(.44-.38*p);y=.75-.5*p;break;
  case 2:x=.5+r*.42*(1-2*p);y=.25+.5*p;break;
  case 3:x=.5+r*.35;y=.15+.7*p;break;
  case 4:x=.5+r*.35;y=.85-.7*p;break;
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
 const level=motif?motifExposure(figure,rank,count,row,groups):membership(step)*(1-handover)+membership(step+1)*handover;
 const strength=Number.isFinite(figure.flicker)?clamp(figure.flicker/100):1;
 return {x:clamp(x),y:clamp(y),level:figure.kind==='silence'?0:1-strength+strength*level,weight:1,wallBlend:motif?1:0,paired:[0,1,2,5,6,10,11,12,14,17,18].includes(figure.form)?1:0,articulation:0};
}
