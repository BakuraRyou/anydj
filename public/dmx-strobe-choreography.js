import {planFormationAction,formationActionPose,formationActionGeometry,formationActionExit,formationGeometryPose} from './dmx-formation-actions.js';
import {formationScenePose} from './dmx-formation-scenes.js';
import {formationRigFixtureRole} from './dmx-formation-rig.js';
import {chooseFormationVariation,formationRoute,formationRadialPosition as radialPosition,varyFormationPose,formationExpressionTrack,formationExpressionAt} from './dmx-formation-variations.js';
import {formationAudioTimeline,formationAudioAt,formationAudioWindow,formationMusicalDecision,formationArrivalEnvelope,developFormationPhrase,formationBuildTrack,formationBuildProgress} from './dmx-formation-music.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const mod=(v,n)=>((v%n)+n)%n;
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};

export const FORMATION_NAMES=Object.freeze({
 'parallel-lines':'Parallele Ebenen','open-fan':'Offener Fächer','crossed-fans':'Gekreuzte Fächer',
 'split-wings':'Flügel','diagonal-plane':'Diagonale Ebene','rising-arch':'Bogen',
 crown:'Krone','vaulted-roof':'Gewölbe','layered-steps':'Staffelung',lattice:'Strahlengitter',
 'braided-ribbons':'Verflochtene Bänder','twin-fans':'Doppelfächer',diamond:'Diamant',
 'nested-gates':'Verschachtelte Tore','traveling-wave':'Wellenband','converging-lines':'Konvergenz',
 'radial-wheel':'Strahlenrad','double-helix':'Doppelhelix','folding-blades':'Faltende Lamellen',
 'horizontal-sheets':'Horizontale Lichtdecken','vertical-curtain':'Vertikaler Vorhang',
 'crossed-sheets':'Gekreuzte Ebenen','spiral-shell':'Spiralkegel','split-foci':'Geteilte Brennpunkte',
 'chevron-stack':'Gestaffelte Winkel','hourglass':'Sanduhr','portal-rows':'Lichtportale','folded-roof':'Gefaltetes Dach',
 'opposed-diagonals':'Gegenläufige Diagonalen','rake':'Strahlenrechen','split-curtain':'Geteilter Vorhang','concentric-fans':'Konzentrische Fächer'
});
export const FORMATION_STORY_NAMES=Object.freeze({relay:'Wandernde Lichtbewegung',dialogue:'Frage und Antwort',
 weave:'Verflochtene Bewegung',bloom:'Entfaltung',gather:'Zusammenführung',suspend:'Ruhendes Lichtbild',rest:'Musikalische Pause'});
export const FORMATION_ACT_NAMES=Object.freeze({introduce:'Einführung',answer:'Antwort',interlace:'Verflechtung',resolve:'Auflösung'});
export function formationFor(passage={}){
 const name=passage.composition??passage.motion??'';
 if(Object.hasOwn(FORMATION_NAMES,name))return name;
 const mappings={petals:'crown',vaults:'vaulted-roof',gates:'open-fan',terraces:'layered-steps',
  polygons:'diamond',chains:'traveling-wave',sails:'diagonal-plane',comets:'converging-lines',
  lattice:'lattice',crowns:'rising-arch',helices:'braided-ribbons'};
 if(name.startsWith('auto-')){
  const [,family,layout]=name.split('-');
  if(layout==='braided'&&family==='gates')return 'hourglass';
  if(layout==='opposed'&&family==='sails')return 'rake';
  if(layout==='lanes'&&family==='gates')return 'split-curtain';
  if(layout==='nested'&&family==='gates')return 'nested-gates';
  if(layout==='opposed'&&family==='gates')return 'split-wings';
  if(layout==='opposed'&&family==='petals')return 'twin-fans';
  if(layout==='braided'&&family==='lattice')return 'crossed-fans';
  if(layout==='unison'&&family==='sails')return 'parallel-lines';
  return mappings[family]??'open-fan';
 }
 return ({'counter-fans':'twin-fans','stacked-fans':'twin-fans','crossed-banks':'crossed-fans',
  'braided-pairs':'braided-ribbons','scissors':'crossed-fans','bow-tie':'crossed-fans',
  'diamond-frame':'diamond','ellipse-frame':'crown','box-frame':'nested-gates',
  'nested-frames':'nested-gates','folding-gates':'split-wings','side-columns':'portal-rows',
  'split-levels':'layered-steps','staggered-columns':'layered-steps','slanted-bands':'opposed-diagonals',
  'diagonal-sweep':'diagonal-plane','diagonal-curtain':'diagonal-plane','traveling-wave':'traveling-wave','depth-wave':'traveling-wave',
  'wide-ribbons':'braided-ribbons','opening-arch':'rising-arch','breathing-arch':'vaulted-roof',
  'unison-sweep':'parallel-lines','parallel-sweep':'parallel-lines','rising-fan':'open-fan',
  'opening-lines':'concentric-fans','pendulum-lines':'hourglass','rising-columns':'chevron-stack',
  'chevron':'rising-arch','inverted-chevron':'vaulted-roof','orbit':'diamond'})[name]??'open-fan';
}
export function formationPose(id,rank,count,row=0,groups=1,progress=.5){
 const r=count>1?rank/(count-1)*2-1:0,a=Math.abs(r),side=Math.sign(r),layer=row/Math.max(1,groups-1);
 const p=ease(progress),travel=Math.sin(p*Math.PI),sway=Math.sin((p-.5)*Math.PI);
 let x=.5+r*.34,y=.36;
 switch(id){
  case 'parallel-lines':x=.5+sway*.16;y=.22+layer*.32;break;
  case 'open-fan':x=.5+r*(.2+.22*p);y=.28+(1-a)*.18;break;
  case 'crossed-fans':x=.5-r*(row%2?-.34:.34);y=.24+a*.25+layer*.08;break;
  case 'split-wings':x=.5+side*(.18+.2*p);y=.3+a*.18;break;
  case 'diagonal-plane':x=.3+.3*p;y=.18+(r+1)*.25;break;
  case 'rising-arch':x=.5+r*.35;y=.25+(1-r*r)*(.15+.25*p);break;
  case 'crown':x=.5+r*.4;y=.23+a*.42;break;
  case 'vaulted-roof':x=.5+r*.23;y=.65-a*.38;break;
  case 'layered-steps':x=.5+r*.16;y=.2+Math.floor((r+1)*1.49)/3*.42+layer*.1;break;
  case 'lattice':x=.5+r*(row%2?-.38:.38);y=.25+(rank%2)*.24+layer*.07;break;
  case 'braided-ribbons':x=.5+r*.32*Math.cos(p*Math.PI*.7);y=.42+Math.sin(r*Math.PI+layer*Math.PI)*.18;break;
  case 'twin-fans':x=.5+side*.19+r*.17;y=.3+(1-Math.abs(a-.5)*2)*.25;break;
  case 'diamond':x=.5+r*(.2+.12*travel);y=.25+(1-a)*.42;break;
  case 'nested-gates':x=.5+side*(.12+Math.floor(a*2.9)*.1);y=.22+(1-a)*.23+layer*.15;break;
  case 'traveling-wave':x=.5+r*.36;y=.43+Math.sin(r*Math.PI-sway)*.21;break;
  case 'converging-lines':x=.5-r*(.12+.25*p);y=.33+layer*.17;break;
  case 'radial-wheel':case 'double-helix':case 'folding-blades':case 'horizontal-sheets':
  case 'vertical-curtain':case 'crossed-sheets':case 'spiral-shell':case 'split-foci':
  case 'chevron-stack':case 'hourglass':case 'portal-rows':case 'folded-roof':
  case 'opposed-diagonals':case 'rake':case 'split-curtain':case 'concentric-fans':
   return formationSpatialPose(id,rank,count,row,groups,progress);
 }
 return {x:clamp(x),y:clamp(y)};
}

const counterForms={
 'parallel-lines':'crossed-fans','open-fan':'converging-lines','crossed-fans':'parallel-lines',
 'split-wings':'rising-arch','diagonal-plane':'twin-fans','rising-arch':'split-wings',
 crown:'nested-gates','vaulted-roof':'diagonal-plane','layered-steps':'open-fan',
 lattice:'vaulted-roof','braided-ribbons':'parallel-lines','twin-fans':'converging-lines',
 diamond:'open-fan','nested-gates':'crown','traveling-wave':'split-wings','converging-lines':'twin-fans'
};
function relatedFormation(theme,chapter){
 const relatives={
  'open-fan':['twin-fans','rising-arch','crossed-fans','crown'],
  'parallel-lines':['diagonal-plane','layered-steps','traveling-wave'],
  'crossed-fans':['lattice','braided-ribbons','diamond'],
  'converging-lines':['diamond','nested-gates','crossed-fans'],
  'rising-arch':['vaulted-roof','crown','twin-fans'],
  'traveling-wave':['braided-ribbons','diagonal-plane','layered-steps']
 };
 const choices=relatives[theme]??[counterForms[theme]??'crossed-fans',theme];
 return choices[chapter%choices.length];
}

const spatialFamilies={
 relay:['vertical-curtain','folding-blades','crossed-sheets','lattice','split-wings','layered-steps'],
 dialogue:['split-foci','twin-fans','nested-gates','converging-lines','diamond','crossed-fans'],
 weave:['double-helix','radial-wheel','spiral-shell','braided-ribbons','traveling-wave','crossed-sheets'],
 suspend:['horizontal-sheets','rising-arch','vertical-curtain','split-foci','vaulted-roof','radial-wheel'],
 bloom:['radial-wheel','crown','open-fan','spiral-shell'],gather:['split-foci','nested-gates','diamond']
};
function developedFormation(preferred,motion,history,features){
 const pool=[preferred,...spatialFamilies[motion]??spatialFamilies.weave];
 let selected=preferred,best=Infinity;
 for(const id of new Set(pool)){
  let cost=id===preferred?0:1;
  history.slice(-12).forEach((used,i,all)=>{if(used===id)cost+=2+5*(i+1)/all.length;});
  // Bright sustained music favours open volumes; a percussive line favours
  // clearly separated sheets. Recent use only decides between suitable forms.
  if(['radial-wheel','spiral-shell'].includes(id))cost+=features[3]<.4?.6:0;
  if(['vertical-curtain','folding-blades'].includes(id))cost+=features[1]<.4?.8:0;
  if(cost<best){best=cost;selected=id;}
 }
 return selected;
}
export function formationProgramFor(sequence){
 const passage=sequence.sharedPassage??{},role=sequence.role,functionName=sequence.phraseArt?.function;
 const kind=role==='held'?'sculpture':role==='silence'?'rest':role==='build'?'unfold'
  :role==='arrival'?'arrival':passage.sequence==='settle'?'resolve'
  :passage.sequence==='exchange'||passage.intent?.attention?.leader==='vocals'?'dialogue'
  :passage.sequence==='wave'?'cascade':passage.sequence==='breath'?'sculpture':'sweep';
 return {kind,lead:sequence.formationId??'open-fan',
  counter:counterForms[sequence.formationId]??'crossed-fans',bridge:kind==='cascade'?'traveling-wave':'parallel-lines',
  breadth:['chorus','strong'].includes(functionName)||role==='arrival'?.9:functionName==='restrained'||functionName==='verse'?.5:.7};
}

function sceneFeatures(plan,sequence,start,end){
 const p=sequence.sharedPassage??{},drama=plan.arrangement?.drama;
 const average=(values,step,fallback)=>{
  if(!values?.length||!(step>0))return fallback;
  const a=Math.max(0,Math.floor(start/step)),b=Math.min(values.length,Math.ceil(end/step));
  let sum=0,n=0;for(let i=a;i<b;i++)if(Number.isFinite(values[i])){sum+=values[i];n++;}
  return n?sum/n:fallback;
 };
 const local=(plan.arrangement?.motionEnvelope??[]).filter(e=>e.time>=start&&e.time<end);
 const mean=(key,fallback)=>local.length?local.reduce((sum,e)=>sum+(Number.isFinite(e[key])?e[key]:fallback),0)/local.length:fallback;
 return [clamp(mean('energy',average(drama?.intensity,drama?.step,sequence.energy??.5))),
  clamp(average(drama?.percussion,drama?.step,p.intent?.motionDrive??p.intent?.rhythm?.density??.5)),
  clamp(average(drama?.vocalShare,drama?.step,p.intent?.attention?.leader==='vocals'?.8:.25)),
  clamp(mean('tone',sequence.tone??.5))];
}

function musicalMotion(features,previous){
 const percussion=features[1],voice=features[2];
 // A brief change around a threshold should not replace an established line.
 if(previous==='dialogue')return voice>=.45?'dialogue':percussion>.55?'relay':'weave';
 if(voice>.62)return 'dialogue';
 if((previous==='relay'&&percussion>=.45)||percussion>.62)return 'relay';
 if(!previous)return voice>.55?'dialogue':percussion>.55?'relay':'weave';
 return 'weave';
}

// Compose several visual sentences inside one musical passage. A motif recalls
// its opening, not an immutable animation for the entire verse or chorus.
export function planFormationScenes(sequences,plan){
 const groups=[],motifs=new Map(),scenes=[],variationHistory=[],shapeHistory=[],musicalPhrases=new Map();let variationOrdinal=0,phaseCursor=0;
 const audioTimeline=formationAudioTimeline(plan);
 const beats=plan.beatGrid?.beats??plan.beatTiming?.times??[];
 const measuredBars=plan.beatGrid?.downbeats??[];
 // Without downbeat markers, use four-beat groups as a conservative fallback.
 // Sparse onsets are accents, not a replacement tempo.
 const bars=measuredBars.length?measuredBars:beats.filter((_,i)=>i%4===0);
 const intervals=beats.slice(1).map((t,i)=>t-beats[i]).filter(v=>v>0&&Number.isFinite(v)).sort((a,b)=>a-b);
 const beatDuration=(start,end)=>{
  const local=beats.slice(1).flatMap((t,i)=>t<=end&&beats[i]>=start&&t>beats[i]?[t-beats[i]]:[]).sort((a,b)=>a-b);
  const values=local.length>=2?local:intervals;
  return values.length?Math.max(.2,Math.min(2.5,values[Math.floor(values.length/2)])):.5;
 };
 for(const s of sequences){
  if(!s.sharedPassage)continue;
  const motif=s.sharedPassage.motif??s.phraseArt?.motif??s.sharedPassage.theme?.key??null;
  const state=['held','silence','build'].includes(s.role)?s.role:s.sharedPassage.sequence==='settle'?'resolve':'active';
  const previous=groups.at(-1);
  const arrival=(s.phraseArt?.arrival??0)>0&&previous?.sequences.at(-1).role!=='arrival';
  const authoredBoundary=!!(audioTimeline&&s.sharedPassage.intent?.transition&&
   !(state==='build'&&s.sharedPassage.development?.index));
  // Preserve the shared show's actual gesture boundaries. Matching texture
  // and motif alone previously swallowed short exchanges and sweeps whole.
  const preceding=previous?.sequences.at(-1).sharedPassage;
  const sameGesture=!audioTimeline||preceding&&['sequence','coordination',...(state==='build'?[]:['composition'])]
   .every(key=>preceding[key]===s.sharedPassage[key]);
  const compatible=previous&&!arrival&&!authoredBoundary&&sameGesture&&Math.abs(previous.end-s.start)<1e-6&&previous.state===state&&previous.motif===motif;
  if(compatible){previous.end=s.end;previous.sequences.push(s);}
  else groups.push({start:s.start,end:s.end,role:s.role,state,function:s.phraseArt?.function,motif,sequences:[s]});
 }
 for(const group of groups){
  const base=group.sequences[0],quiet=['held','silence'].includes(group.role);
  const beatLength=beatDuration(group.start,group.end);
  // Compile once over the musical group before choosing any visual cuts.
  const events=planFormationEntrances({end:group.end,minimumHold:base.minimumHold??1.1,
   entrances:group.sequences.flatMap(s=>s.entrances??[]).sort((a,b)=>a.time-b.time)});
  const steps=quiet?8:4,minimum=beatLength*(quiet?16:8);
  const measured=(plan.arrangement?.patterns?.phrases??[]).filter(p=>p.start>group.start+.05&&p.start<group.end-.05);
  // Measured musical sentences take precedence over a parallel four-bar timer.
  const candidates=measured.length?measured.map(p=>p.start)
   :bars.filter(t=>t>group.start+.05&&t<group.end-.05).filter((_,i)=>(i+1)%steps===0);
  if(!bars.length&&!measured.length){
   events.forEach((e,i)=>{if(i>0&&i%(quiet?16:8)===0)candidates.push(e.time);});
  }
  const cuts=[group.start];
  if(group.role!=='silence')for(const t of [...new Set(candidates)].sort((a,b)=>a-b))
   if(t-cuts.at(-1)>=minimum&&group.end-t>=minimum)cuts.push(t);
  cuts.push(group.end);
  const motifKey=group.motif==null?null:`${group.motif}:${group.role}`;
  const remembered=motifKey?motifs.get(motifKey):null;
  const groupTheme=remembered?.formationId??base.formationId??formationFor(base.sharedPassage);
  const expression=formationExpressionTrack(plan,group.start,group.end,sceneFeatures(plan,base,group.start,group.end));
  const opening=group.role==='build'||base.sharedPassage.sequence==='opening'?formationBuildTrack(audioTimeline,group.start,group.end):null;
  const local=[],groupPhase=phaseCursor;let previousMotion=null,previousFeatures=null,lockedVariation,lockedShape,lockedMotion,lockedScene;
  for(let i=0;i<cuts.length-1;i++){
   const start=cuts[i],end=cuts[i+1],source=group.sequences.find(s=>start>=s.start&&start<s.end)??base;
   const features=sceneFeatures(plan,source,start,end);
   const decision=formationMusicalDecision(audioTimeline,start,end,group.role,source.sharedPassage);
   // Phrase development is local to a recurring musical role and motif. An
   // unrelated intro or another song cannot consume this figure's variations.
   const phraseKey=decision?`${group.motif??'unmarked'}:${group.role}:${decision.motion}:${decision.evidence.texture}`:null;
   const phrase=musicalPhrases.get(phraseKey)??0;
   const musical=developFormationPhrase(decision,phrase,source.sharedPassage.composition?formationFor(source.sharedPassage):null);
   if(musical?.evidence.phrase!=null)musicalPhrases.set(phraseKey,phrase+1);
   // A passage keeps one visual theme. Musical sentences develop that theme
   // through an entrance, an answer, an interweaving and a resolution. They do
   // not consume a catalogue of unrelated forms just to avoid repetition.
   const theme=groupTheme;
   const delta=previousFeatures?features[0]-previousFeatures[0]:0;
   const act=musical?.act??(expression&&i>0?(delta<-.12?'resolve':delta>.12?'introduce':features[2]>.55?'answer':'interlace')
    :['introduce','answer','interlace','resolve'][i%4]);
   const returning=!!remembered&&i===0;
   const motion=musical?.motion??(group.role==='silence'?'rest':quiet?'suspend':group.role==='build'?'bloom'
    :source.sharedPassage.sequence==='settle'||group.function==='outro'?'gather'
    :musicalMotion(features,previousMotion));
   if(['relay','dialogue','weave'].includes(motion))previousMotion=motion;
   if(lockedMotion&&lockedMotion!==motion){lockedVariation=undefined;lockedShape=undefined;lockedMotion=undefined;lockedScene=undefined;}
   const direction=musical?.direction??(i%2===0?1:-1);
   const globalGesture=motion==='bloom'||motion==='gather';
   const variation=motion==='rest'?null:lockedVariation??musical?.variation??chooseFormationVariation({motion,act,energy:features[0],tone:features[3],voice:features[2],
    history:variationHistory,ordinal:variationOrdinal,previous:local.at(-1)?.formationStory.variation});
   if(variation&&!lockedVariation){
    variationHistory.push(variation);if(variationHistory.length>64)variationHistory.shift();variationOrdinal++;
    if(globalGesture){lockedVariation=variation;lockedMotion=motion;}
   }
   const preferred=globalGesture?theme:act==='answer'?(counterForms[theme]??'crossed-fans')
    :act==='interlace'?relatedFormation(theme,Math.floor(i/4)):theme;
   const formationId=lockedShape??musical?.shape??((!scenes.length||returning)&&i===0?theme
    :developedFormation(preferred,motion,shapeHistory,features));
   const scenePicture=lockedScene??musical?.scene??null;
   if(globalGesture){lockedShape=formationId;lockedScene=scenePicture;}
   shapeHistory.push(formationId);previousFeatures=features;
   const kind=motion==='rest'?'rest':motion==='suspend'?'sculpture':motion==='bloom'?'unfold'
    :motion==='gather'?'resolve':motion==='dialogue'?'dialogue':motion==='relay'?'cascade':'sweep';
   const formationProgram={...formationProgramFor({...source,formationId}),kind};
   const knots=[{time:start,position:0},...events.filter(e=>e.time>start&&e.time<end)
    .map(e=>({time:e.time,strength:clamp(e.strength??.5)})),{time:end,position:1}];
   const weights=knots.slice(1).map((k,j)=>{
    const e=formationExpressionAt(expression,(k.time+knots[j].time)/2);
    const flow=e?e.energy*(.35+.65*e.percussion):0;
    return Math.sqrt(k.time-knots[j].time)*(.65+.35*(k.strength??.5))*(e ? .25+.75*Math.sqrt(flow) : 1);
   });
   const total=weights.reduce((sum,w)=>sum+w,0);let position=0;
   for(let j=1;j<knots.length;j++){position+=weights[j-1]/total;knots[j].position=position;}
   prepareStoryClock(knots);
   const precedingScene=scenes.at(-1),shared=source.sharedPassage.intent;
   const climax=!!shared?.staging?.climax;
   // A new authored climax is an arrival even when the surrounding chorus
   // never stopped being an impact section. A sustained climax is one event.
   const arrivalEntry=i===0&&((source.phraseArt?.arrival??0)>0||
    climax&&precedingScene?.formationStory.climax!==true||
    group.role==='arrival'&&precedingScene?.formationStory.arrival!==true);
   const arrivalCue=arrivalEntry?audioTimeline?.roles.lead.find(e=>e.time>=start&&e.time<=Math.min(end,start+.3)):null;
   const sharedOverlap=Math.abs(start-source.start)<1e-6?shared?.transition?.overlap:undefined;
   const transitionDuration=arrivalCue?.18:Number.isFinite(sharedOverlap)&&sharedOverlap>0&&precedingScene
    ?Math.min(sharedOverlap,(end-start)*.25,(precedingScene.end-precedingScene.start)*.25):undefined;
   // An impact's opening is the arrival picture, not another build starting
   // after the drop. True build passages keep their measured long arc.
   const impactOpening=arrivalEntry&&motion==='bloom'&&group.role!=='build'
    ?[{time:start,position:1},{time:end,position:1}]:null;
   const formationStory={start,end,motion,act,direction,theme,shape:formationId,scene:scenePicture,chapter:Math.floor(i/4),returning,knots,variation,
    phaseStart:quiet||globalGesture?groupPhase:phaseCursor,phaseSpan:variation?.phaseSpan??1,
    energy:features[0],voice:features[2],breadth:formationProgram.breadth,
    expression,opening:impactOpening??(motion==='gather'?formationBuildTrack(audioTimeline,start,end,true):opening),musicalEvidence:musical?.evidence??null,
    arcStart:group.start,arcEnd:group.end,arrival:source.role==='arrival',climax,
    ...(shared?.anticipation?{anticipation:{...shared.anticipation}}:{}),
    ...(arrivalCue?{arrivalCue:{time:arrivalCue.time,strength:arrivalCue.strength}}:{}),
    ...(transitionDuration!==undefined?{transitionDuration}:{})};
   if(audioTimeline){
    Object.defineProperty(formationStory,'audioTimeline',{value:audioTimeline});
    formationStory.action=planFormationAction(formationStory,plan,audioTimeline);
    const previous=precedingScene?.formationStory,action=formationStory.action;
    if(previous?.action&&previous.motion!=='rest'&&motion!=='rest'){
     // A later phrase of the same completed arc continues the outgoing
     // picture. A new arrival still prepares its own full opening below.
     const continuingOpening=action.movingOpening&&action.path[0].time===start&&
      previous.motion==='bloom'&&previous.arcStart===formationStory.arcStart&&!arrivalCue;
     if(action.kind!=='opening'||continuingOpening){
      const previousOpening=formationBuildProgress(previous.opening,start,clamp((start-previous.arcStart)/Math.max(.001,previous.arcEnd-previous.arcStart)));
      action.entry=formationActionExit(previous.action,previousOpening);
      action.entryShape=previous.shape;
      const beforeTravel=previous.action.trajectory,travel=action.trajectory;
      if(travel&&beforeTravel&&travel.shape===beforeTravel.shape&&travel.period===beforeTravel.period&&
       travel.direction===beforeTravel.direction&&travel.low===beforeTravel.low)action.continueOrbit=true;
      if(action.kind==='develop'&&action.entry.shape===action.to&&action.from!==action.to)action.to=action.from;
      if(action.path?.length>1&&action.entry.shape===action.path[1].shape&&action.path[0].shape!==action.path[1].shape){
       const origin=action.path[0].shape,target=action.path[1].shape;
       action.path.slice(1).forEach(p=>{p.shape=p.shape===target?origin:p.shape===origin?target:p.shape;});
      }
      if((previous.action.cueSource??previous.action.source)===(action.cueSource??action.source)){
       const last=previous.action.cues.at(-1),ordinal=last?.ordinal??Math.max(0,previous.action.cues.length-1);
       action.entryGroup=last?.group??previous.action.entryGroup??0;
       action.cues.forEach((cue,j)=>{cue.ordinal=ordinal+j+1;cue.group=cue.ordinal%4;});
      }
     }else if(arrivalCue){
      // Prepare the arrival picture before the source hit. Do not make the
      // motors traverse the whole stage during the short brightness attack.
      const anticipation=previous.anticipation;
      const span=Math.min(1.2,sharedOverlap??.7,(previous.end-previous.start)*.25);
      previous.departure={start:anticipation?.start??start-span,end:start,
       geometry:formationActionGeometry(action,start,1)};
     }
    }
   }
   if(!quiet&&!globalGesture&&variation)phaseCursor+=variation.phaseSpan;
   const before=scenes.at(-1);
   const scene={start,end,musicalStart:group.start,musicalEnd:group.end,formationId,formationProgram,formationStory,motif:motifKey,
    strobeSentence:source.strobeSentence,reason:i===0?'motif-opening':'musical-story-development',
    previousFormation:before?{end:before.end,formationId:before.formationId,formationProgram:before.formationProgram,formationStory:before.formationStory,
     formationEntrances:before.exitEntrances}:null,
    exitEntrances:events.filter(e=>e.time<end).slice(-2)};
   local.push(scene);scenes.push(scene);
   if(motifKey&&!motifs.has(motifKey))motifs.set(motifKey,{formationId:theme,kind});
  }
  if(quiet||lockedVariation)phaseCursor=groupPhase+(lockedVariation?.phaseSpan??.5);
  for(const s of group.sequences){
   s.formationEntrances=events.filter(e=>e.time<s.end&&e.releaseEnd>s.start);
   s.formationScenes=local.filter(v=>v.start<s.end&&v.end>s.start);
  }
 }
 return scenes;
}
export function formationSceneStateAt(sequence,time){
 const scenes=sequence?.formationScenes??[];let lo=0,hi=scenes.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(scenes[mid].start<=time)lo=mid+1;else hi=mid;}
 const visual=scenes[lo-1];if(!visual||time>=visual.end)return {};
 const previous=visual.previousFormation;
 return {formationId:visual.formationId,formationProgram:visual.formationProgram,formationStory:formationFrameStory(visual.formationStory,time),
  visualStart:visual.start,visualEnd:visual.end,visualReason:visual.reason,
  previous:previous?{...previous,formationStory:formationFrameStory(previous.formationStory,time)}:null,age:time-visual.start,continuing:!visual.previousFormation,
  progress:sequence.role==='build'?clamp((time-visual.musicalStart)/(visual.musicalEnd-visual.musicalStart)):clamp((time-visual.start)/(visual.end-visual.start))};
}
function formationFrameStory(story,time){
 if(!story?.audioTimeline)return story;
 const frame={...story};
 Object.defineProperties(frame,{
  audioTimeline:{value:story.audioTimeline},
  toJSON:{value:()=>({...frame,audioFrame:formationAudioWindow(story.audioTimeline,time)})}
 });
 return frame;
}
function layerFor(row,groups){return groups>1?Math.round(row*2/(groups-1)):0;}

function prepareStoryClock(knots){
 const slopes=knots.slice(1).map((b,i)=>(b.position-knots[i].position)/(b.time-knots[i].time));
 for(let i=0;i<knots.length;i++){
  if(i===0)knots[i].velocity=slopes[0];
  else if(i===knots.length-1)knots[i].velocity=slopes.at(-1);
  else{
   const a=slopes[i-1],b=slopes[i],left=knots[i].time-knots[i-1].time,right=knots[i+1].time-knots[i].time;
   const w1=2*right+left,w2=right+2*left;
   knots[i].velocity=a>0&&b>0?(w1+w2)/(w1/a+w2/b):0;
  }
 }
}
export function formationStoryProgress(story,time){
 const knots=story.knots;let lo=0,hi=knots.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(knots[mid].time<=time)lo=mid+1;else hi=mid;}
 const a=knots[Math.max(0,lo-1)],b=knots[Math.min(knots.length-1,lo)];
 const duration=b.time-a.time;if(duration<=0)return a.position;
 const t=clamp((time-a.time)/duration),t2=t*t,t3=t2*t;
 const slope=(b.position-a.position)/duration;
 // Monotone Hermite interpolation passes acoustic anchors with a shared,
 // nonzero velocity. Easing each interval separately stopped the whole rig
 // at every detected entrance, even during an uninterrupted musical line.
 return (2*t3-3*t2+1)*a.position+(t3-2*t2+t)*duration*(a.velocity??slope)
  +(-2*t3+3*t2)*b.position+(t3-t2)*duration*(b.velocity??slope);
}

// Move the complete picture after layout composition. Shrinking a scene into
// tiers or islands must not shrink its motor travel into an invisible tremble.
function formationLightTravel(story,audio){
 // The detected beat phase anchors driving passages. The free-flowing audio
 // journey carries softer passages without forcing every note into a chase.
 return story.musicalEvidence?.movementDrive>.2&&audio.beatTravel!=null?audio.beatTravel:audio.travel;
}
function formationMotorTravel(story,audio){
 // Light can travel on each beat while the physical picture develops over
 // two bars. Both share the same grid; fast kicks do not swing the whole rig.
 const drive=story.musicalEvidence?.movementDrive??audio.movementDrive??0;
 return drive>.2&&audio.beatTravel!=null?audio.beatTravel*.25:audio.travel*.6;
}
function kineticFormationPose(pose,story,audio,frozen){
 if(!audio||frozen||story.motion==='rest')return pose;
 const drive=audio.movementDrive??0;
 const amplitude=.025*Math.sqrt(audio.energy)+.025*drive;
 const phase=formationMotorTravel(story,audio)*Math.PI,s=Math.sin(phase),c=Math.cos(phase);
 const dx=pose.x-.5,dy=pose.y-.5;
 let xx=1,xy=0,yx=0,yy=1,tx=amplitude*s,ty=amplitude*.7*c;
 if(story.motion==='dialogue'){
  // Both wings open and answer together; all heads share the same clock.
  xx=1+drive*.12*s;tx=0;ty=amplitude*c;
 }else if(story.motion==='bloom'||story.motion==='gather'){
  // Keep the long build/withdrawal arc, with a rhythmic figure inside it.
  xx=1+drive*.08*s;tx=amplitude*.45*s;ty=amplitude*.65*c;
 }else{
  const angle=drive*(story.motion==='weave'?.12:.06)*s;
  xx=yy=Math.cos(angle);xy=-Math.sin(angle);yx=-xy;
 }
 // Reserve shared travel space before translating the picture. Clipping
 // individual rays against the room edge bends an otherwise coherent plane.
 const global=story.motion==='bloom'||story.motion==='gather';
 const maxAngle=drive*(story.motion==='weave'?.12:.06);
 const radius=.5*(story.motion==='dialogue'?1+drive*.12:global?1+drive*.08:Math.cos(maxAngle)+Math.sin(maxAngle));
 const scale=Math.min(1,(.49-amplitude*(global?.65:1))/radius);
 const x=.5+(dx*xx+dy*xy)*scale+tx,y=.5+(dx*yx+dy*yy)*scale+ty;
 return {...pose,x:clamp(x),y:clamp(y)};
}

function actionStoryPose(story,time,rank,count,row,groups,frozen,fixtureRole,audio,storyPhase){
 const elapsed=clamp((time-story.arcStart)/Math.max(.001,story.arcEnd-story.arcStart));
 const opening=formationBuildProgress(story.opening,time,elapsed);
 const value=formationActionPose(story.action,time,rank,count,row,groups,formationSpatialPose,opening);
 let {x,y,exposure,beamFocus}=value;
 // The action is the complete choreography. Source accents articulate its
 // participating groups; no travelling mask or global swing is added here.
 if(audio&&story.motion!=='rest'&&story.motion!=='bloom'){
  const source=groups===1?story.action.source:row/Math.max(1,groups-1)<.3?'bass':row/Math.max(1,groups-1)>.7?'drums':story.action.source;
  const accent=source==='bass'?audio.bassAccent:source==='drums'?audio.drumAccent:audio.accent;
  exposure*=.7+.3*accent;
 }
 if(story.departure&&!frozen){
  const cue=story.departure,p=ease((time-cue.start)/Math.max(.001,cue.end-cue.start));
  if(p>0){const target=formationGeometryPose(cue.geometry,rank,count,row,groups,formationSpatialPose);
   x+=(target.x-x)*p;y+=(target.y-y)*p;beamFocus+=(target.beamFocus-beamFocus)*p;
  }
 }
 // A reliable melodic line may bend the shared picture. Percussion and
 // sustained textures must not inherit small, unrelated pitch-estimator moves.
 const melodic=['melody','voice'].includes(story.musicalEvidence?.texture);
 const pitchWeight=melodic?ease(((story.musicalEvidence?.pitchConfidence??0)-.65)/.25):0;
 if(audio&&story.motion!=='rest'&&pitchWeight>0)y+=(audio.pitch-.5)*audio.pitchConfidence*.12*pitchWeight;
 if(fixtureRole==='support')exposure*=.45;
 if(story.anticipation&&!story.departure&&!frozen&&story.motion!=='rest'){
  const cue=story.anticipation,prepare=ease((time-cue.start)/Math.max(.001,cue.end-cue.start))*clamp(cue.strength);
  x=.5+(x-.5)*(1-.32*prepare);y=.5+(y-.5)*(1-.2*prepare);exposure*=1-.25*prepare;
 }
 if(fixtureRole==='frame'){
  x=.5;y=.24+row/Math.max(1,groups-1)*.5;beamFocus=0;
  exposure=story.motion==='rest'?0:Math.min(rank,count-1-rank)<2?.38*(story.action?.grouping?value.exposure:1):0;
 }
 return {x:clamp(x),y:clamp(y),exposure:clamp(exposure),beamFocus,id:story.shape,layer:layerFor(row,groups),
  moving:!frozen&&story.motion!=='rest',storyPhase,storyMotion:story.motion,storyAct:story.act,
  formationAction:story.action.kind,actionProgress:value.progress};
}

// A travelling stroke owns both its light envelope and its target gesture.
// Adjacent fixtures overlap while carrying the same motion into the next row.
// The beat carries the shared motor; source attacks retain the light accents.
export function formationStoryPose(story,time,rank,count,row=0,groups=1,frozen=false,fixtureRole='lead'){
 const storyTime=frozen?(story.start+story.end)/2:time;
 const audio=formationAudioAt(story.audioTimeline??story.audioFrame,storyTime);
 const globalGesture=['bloom','gather','suspend'].includes(story.motion);
 const storyProgress=frozen||story.motion==='rest'?.5:formationStoryProgress(story,time);
 const p=audio&&!globalGesture ? .5-.5*Math.cos(formationLightTravel(story,audio)*Math.PI) : storyProgress,u=count>1?rank/(count-1):.5;
 const layer=row/Math.max(1,groups-1),r=u*2-1,radial=Math.abs(r),pairPosition=radialPosition(rank,count);
 if(story.action)return actionStoryPose(story,storyTime,rank,count,row,groups,frozen,fixtureRole,audio,p);
 const reversed=story.direction<0;
 const requestedAxis=(story.chapter??0)%3;
 const axis=requestedAxis===1&&count===2?0:requestedAxis;
 const path=formationRoute(story.variation?.path??['traverse','radial','depth'][axis],rank,count,row,groups,reversed);
 const route=path.position,front=p*1.24-.12;
 const width=Math.max((.22+.08*story.energy)*(story.variation?.spread??1),path.gap*.8);
 const ribbon=(distance,w=width)=>1-ease((Math.abs(distance)-w*.55)/(w*.45));
 const stroke=ribbon(route-front),trail=ribbon(route-front+.17,width*.85)*.65;
 const counterpart=ribbon(1-route-front);
 const shape=story.shape??story.theme;
 const elapsed=clamp((storyTime-story.arcStart)/Math.max(.001,story.arcEnd-story.arcStart));
 const arc=story.motion==='bloom'||story.motion==='gather'?formationBuildProgress(story.opening,storyTime,elapsed):elapsed;
 const phase=audio?formationMotorTravel(story,audio)*.5:(story.phaseStart??0)+(story.phaseSpan??1)*(globalGesture?arc:p);
 const motorProgress=audio&&!globalGesture ? .5-.5*Math.cos(formationMotorTravel(story,audio)*Math.PI):p;
 const pose=formationSpatialPose(shape,rank,count,row,groups,globalGesture?arc:motorProgress);
 let exposure=Math.max(stroke,trail),x=pose.x,y=pose.y;
 const head=.12+.76*clamp(front);
 if(story.motion==='rest')exposure=0;
 else if(story.motion==='suspend'){
  // Quiet music can develop a sparse line without being mistaken for a
  // forty-second manual hold. One slow arc spans the complete quiet passage.
  const drift=audio ? .5-.5*Math.cos(formationMotorTravel(story,audio)*Math.PI*.5) : arc;
  const centre=.1+.45*ease(drift),quiet=formationSpatialPose(shape,rank,count,row,groups,.35+.3*drift);
  const quietWidth=Math.max(.22,count>2?.8/Math.floor((count-1)/2):.22);
  exposure=count<=2?(layer<.1?1:layer>.9?.6:0)
   :layer<.1?ribbon(pairPosition-centre,quietWidth):layer>.9?ribbon(pairPosition-(1-centre),quietWidth):0;
  x=quiet.x;y=quiet.y;
 }else if(story.motion==='bloom'){
  const unfolding=arc;
  exposure=ease((unfolding-(pairPosition*.65+layer*.35)*.8)/.17);
  x=.5+(pose.x-.5)*(.15+.85*ease(unfolding));y=.28+pose.y*.65*ease(unfolding);
 }else if(story.motion==='gather'){
  const closing=arc;
  exposure=Math.max(1-ease((closing-(1-pairPosition)*.7-layer*.1)/.2),layer<.1&&pairPosition<.18?1:0);
  x=pose.x+(.5-pose.x)*ease(closing);y=pose.y+(.5-pose.y)*ease(closing);
 }else if(story.motion==='dialogue'){
  // One phrase leaves a held outline for the answering phrase. The answer
  // travels in the opposite depth order rather than toggling whole rows.
  const foundation=story.act==='answer'&&layer<.1&&radial>.85?1:0;
  exposure=Math.max(exposure,foundation,story.act==='interlace'?counterpart:0);
  if(!audio){x=pose.x+(head-pose.x)*stroke*.5;y=clamp(pose.y+Math.sin((front-route)*Math.PI)*.18);}
 }else if(story.motion==='weave'){
  exposure=Math.max(stroke,counterpart,trail);
  // Interweave the authored picture. Replacing it with one sine curve made
  // every selected shape turn into the same pair of moving ribbons.
  if(!audio){
   x=pose.x+Math.sin((phase-layer*.3)*Math.PI)*.1;
   y=pose.y+Math.sin(r*Math.PI+phase*Math.PI*2-layer*Math.PI)*(.05+.07*story.energy);
  }
 }else{
  exposure=Math.max(exposure,story.act==='interlace'?counterpart:0);
  // The measured show has one authored picture and one shared gesture.
  // The travelling stroke selects light, not a second per-fixture motor path.
  if(!audio){x=pose.x+(head-pose.x)*stroke*.45;y=clamp(pose.y+Math.sin((front-route)*Math.PI)*.18);}
 }
 if(!globalGesture&&story.motion!=='rest'){
  if(story.variation?.articulation==='echo')exposure=Math.max(exposure,ribbon(route-front+.3)*.85);
  if(story.variation?.articulation==='counterflow')exposure=Math.max(exposure,counterpart);
  if(story.variation?.articulation==='reveal')exposure=Math.max(exposure,ease((front-route)/width)*.7);
 }
 const varied=varyFormationPose({x,y,beamFocus:pose.beamFocus},story.variation,phase,rank,count,row,groups);
 x=varied.x;y=varied.y;
 if(story.act==='resolve'&&!['rest','suspend','bloom','gather'].includes(story.motion)){
  const join=ease(((audio?storyProgress:p)-.5)/.35);
  const centreX=.5+Math.sin(phase*Math.PI*2)*.06,centreY=.5+Math.cos(phase*Math.PI*2)*.04;
  x+=(centreX-.5)*join;y+=(centreY-.5)*join;
  x=.5+(x-.5)*(1-.25*join);y=.5+(y-.5)*(1-.25*join);
  exposure=Math.max(exposure,join*(1-ease((radial-.45)/.35)));
 }
 if(!audio&&story.arrival&&story.act==='introduce')exposure=Math.max(exposure,ease(p/.1)*(1-ease((p-.3)/.25)));
 if(fixtureRole==='support'&&!['rest','bloom','gather'].includes(story.motion)){
  // Fixed lights retain an outline and carry the answering stroke. They do
  // not copy the foreground beam's shutter into every other fixture type.
  exposure=story.motion==='suspend'?radial>.65?.5:0
   :story.act==='answer'?Math.max(.45,counterpart)
   :story.act==='interlace'?counterpart:radial>.7?.3:0;
 }
 // A lone light cannot hand a stroke to a neighbour. Keep its musical line
 // present while its target develops, instead of waiting for a virtual bank.
 if(count===1&&groups===1&&story.motion!=='rest'&&fixtureRole!=='support')exposure=1;
 if(count===1&&groups===1&&fixtureRole==='support'&&!['rest','bloom','gather'].includes(story.motion))
  exposure=story.motion==='suspend'?.5:story.act==='answer'?1:.45;
 const expression=formationExpressionAt(story.expression,storyTime);
 if(expression){
  const breadth=.55+.45*Math.sqrt(expression.energy);
  x=.5+(x-.5)*breadth;y=.5+(y-.5)*breadth+(expression.tone-.5)*.12;
 }
 if(audio&&story.motion!=='rest'){
  // Each mounting layer articulates an actual source in the music. The
  // musical dimmer still owns the total brightness; these are spatial accents
  // over a sustained floor, never additional master flashes.
  const layerRole=groups===1?story.musicalEvidence?.texture:layer<.3?'bass':layer>.7?'drums':'melody';
  const accent=layerRole==='bass'?audio.bassAccent:layerRole==='drums'?audio.drumAccent:audio.accent;
  if(story.motion!=='bloom')exposure*=.7+.3*accent;
  if(!globalGesture){
   // Stem accents belong to the dimmer above. Scaling each row by its own
   // stem envelope tears a shared fan into independently breathing fragments.
   y+=(audio.pitch-.5)*audio.pitchConfidence*.16;
  }
 }
 const composed=formationScenePose(story.scene,{x,y},rank,count,row,groups);
 const kinetic=kineticFormationPose(composed,story,audio,frozen);
 x=kinetic.x;y=kinetic.y;exposure*=composed.membership;
 if(story.anticipation&&!frozen&&story.motion!=='rest'){
  const cue=story.anticipation;
  const preparing=ease((storyTime-cue.start)/Math.max(.001,cue.end-cue.start))*clamp(cue.strength);
  // Focus the outgoing picture before the authored arrival. Keep the common
  // motor moving; the incoming source hit owns the reveal and brightness.
  x=.5+(x-.5)*(1-.32*preparing);y=.5+(y-.5)*(1-.2*preparing);
  exposure*=1-.25*preparing;
 }
 // The accompanying installation frames the main picture with sparse, steady
 // outer lines. It does not run a second full formation over the foreground.
 if(fixtureRole==='frame'){
  x=.5;y=.24+layer*.5;
  exposure=story.motion==='rest'?0:Math.min(rank,count-1-rank)<2?.38*(story.action?.grouping?value.exposure:1):0;
 }
 return {x:clamp(x),y:clamp(y),beamFocus:fixtureRole==='frame'?0:pose.beamFocus,exposure:clamp(exposure),
  id:shape,layer:layerFor(row,groups),moving:!frozen&&story.motion!=='rest',
  storyPhase:p,storyMotion:story.motion,storyAct:story.act};
}

function programMembership(program,step,phase,bank,banks,layer,groups,progress,prominent=false){
 const stage=mod(step,4),reply=stage>=2;
 const frame=bank===0||banks===1,center=bank>=banks-Math.max(1,Math.ceil(banks*.3));
 const broad=bank>=banks-Math.max(1,Math.ceil(banks*program.breadth));
 const band=(position,width=2)=>Math.abs(bank-mod(position,banks))<Math.max(1,width);
 if(program.kind==='rest')return false;
 if(prominent&&!['sculpture','unfold'].includes(program.kind)&&layer!==1)return true;
 if(program.kind==='sculpture')return layer===0?center:layer===2?frame:false;
 if(program.kind==='unfold'){
  const rowsReady=groups===1||progress>=layer*.26;
  return rowsReady&&bank>=banks-Math.max(1,Math.ceil(banks*(.2+.8*progress)));
 }
 if(program.kind==='arrival'){
  if(stage<2)return layer!==1||center;
  return layer===0?broad:layer===2?bank<Math.max(1,Math.ceil(banks*.65)):band(step+phase);
 }
 if(program.kind==='dialogue'){
  if(groups===1)return reply?bank<Math.max(1,Math.ceil(banks*program.breadth)):broad;
  return layer===0?reply?frame:broad:layer===2?reply?broad:frame:band(step+phase,1);
 }
 if(program.kind==='cascade')return layer===0?broad:band(step+phase+layer*2,2);
 if(program.kind==='resolve')return layer===0?bank>=Math.floor(progress*(banks-1)):layer===2&&frame&&progress<.7;
 return layer===0?broad:layer===2?frame||reply&&center:band(step+phase,1.5);
}
function programPose(program,sequence,rank,count,row,groups,progress,frozen){
 if(sequence.formationStory)return formationStoryPose(sequence.formationStory,sequence.time,rank,count,row,groups,frozen,sequence.fixtureRole);
 const layer=layerFor(row,groups),events=sequence.formationEntries??[];
 const latest=events.at(-1),step=latest?.formationStep??0;
 const phase=latest?ease((sequence.time-latest.time)/Math.max(1.1,latest.holdEnd-latest.time)):0;
 // Motor travel unfolds over eight measured statements. It cannot speed up
 // merely because a dense drum roll contains more detected onsets.
 const position=mod(step+phase,8),travel=position<=4?position/4:(8-position)/4;
 const moving=!frozen&&!['sculpture','rest'].includes(program.kind);
 const p=program.kind==='unfold'||program.kind==='resolve'?progress:moving?travel:.5;
 const id=layer===0?program.lead:layer===2?program.counter:program.bridge;
 const pose=formationSpatialPose(id,rank,count,row,groups,p);
 if(moving){
  const direction=layer===2?-1:1;
  pose.x=clamp(pose.x+direction*Math.sin((p-.5)*Math.PI)*.1);
  if(layer===1)pose.y=clamp(pose.y+.08*Math.sin(p*Math.PI));
 }
 return {...pose,id,layer,step,phase,moving};
}

// These coordinates describe a shared plane through the room. A fan opens
// outwards, a crossing passes through its opposite side, and a curtain shares
// one height. They must not be interpreted as steep, mount-relative tilts.
export function formationSpatialPose(id,rank,count,row=0,groups=1,progress=.5){
 const r=count>1?rank/(count-1)*2-1:0,a=Math.abs(r),side=Math.sign(r);
 const p=clamp(progress),layer=row/Math.max(1,groups-1),sweep=p*2-1;
 let x=.5+r*.42,y=.5,beamFocus=1;
 switch(id){
  case 'parallel-lines':x=.5+sweep*.22;y=.48+sweep*.06;beamFocus=0;break;
  case 'open-fan':x=.5+r*(.24+.24*p);y=.35+(1-a)*.25+layer*.1;break;
  case 'crossed-fans':x=.5-r*(.22+.26*p);y=.4+layer*.2;break;
  case 'split-wings':x=.5+side*(.22+.26*p);y=.22+a*.55;break;
  case 'diagonal-plane':x=.5+r*.46;y=.5+r*(.16+.2*p);break;
  case 'rising-arch':x=.5+r*.45;y=.22+(1-r*r)*(.24+.4*p);break;
  case 'crown':x=.5+r*.46;y=.25+a*(.3+.3*p);break;
  case 'vaulted-roof':x=.5+r*.42;y=.82-a*(.22+.3*p);break;
  case 'layered-steps':x=.5+r*.44;y=.22+Math.floor((r+1)*1.49)*.22+sweep*.08;break;
  case 'lattice':x=.5-r*.46;y=Math.min(rank,count-1-rank)%2?.72:.28;break;
  case 'braided-ribbons':x=.5+r*.44*Math.cos(p*Math.PI);y=.5+Math.sin(r*Math.PI+layer*Math.PI)*.3;break;
  case 'twin-fans':x=.5+side*.24+(r-side*.5)*(.28+.16*p);y=.35+(1-Math.abs(a-.5)*2)*.38;break;
  case 'diamond':x=.5-r*(.25+.2*p);y=.2+(1-a)*.62;break;
  case 'nested-gates':x=.5+side*(.15+Math.floor(a*2.9)*.14);y=.22+(1-a)*.55;break;
  case 'traveling-wave':x=.5+r*.46;y=.5+Math.sin(r*Math.PI-sweep*Math.PI)*.3;break;
  case 'converging-lines':x=.5-r*.06;y=.4+layer*.2;break;
  case 'radial-wheel':{const angle=uAngle(rank,count)+layer*Math.PI*.25+p*Math.PI*.4;x=.5+Math.cos(angle)*.4;y=.5+Math.sin(angle)*.36;break;}
  case 'double-helix':x=.5+r*.43;y=.5+Math.sin(r*Math.PI*2+p*Math.PI*2+row*Math.PI)*.32;break;
  case 'folding-blades':{const blade=rank%4/3-.5;x=.5+r*.32+blade*.2*Math.sin(p*Math.PI);y=.5+blade*.65;beamFocus=.35;break;}
  case 'horizontal-sheets':x=.5+sweep*.15;y=.24+layer*.5;beamFocus=0;break;
  case 'vertical-curtain':x=.5+r*.46;y=.5+sweep*.1;beamFocus=.15;break;
  case 'crossed-sheets':x=.5+side*(row%2?-.28:.28);y=.3+a*.4;beamFocus=.2;break;
  case 'spiral-shell':{const angle=uAngle(rank,count)+p*Math.PI;const radius=.12+.28*(r+1)/2;x=.5+Math.cos(angle)*radius;y=.5+Math.sin(angle)*radius;break;}
  case 'split-foci':x=.5+side*(.22+.08*Math.sin(p*Math.PI));y=.32+layer*.32;break;
  case 'chevron-stack':x=.5+r*.44;y=.22+(1-a)*.35+layer*.14;break;
  case 'hourglass':x=.5+r*.42;y=.5+side*(1-a)*(.2+.12*p);break;
  case 'portal-rows':x=.5+side*(.18+layer*.12);y=.22+(1-a)*.5;break;
  case 'folded-roof':x=.5+r*.45;y=.76-(1-a)*(.15+.32*p);break;
  case 'opposed-diagonals':x=.5+r*.43;y=.5+r*(row%2?-.28:.28);beamFocus=.25;break;
  case 'rake':x=.5+(row%2?1:-1)*(.12+.22*p);y=.25+(r+1)*.25;beamFocus=0;break;
  case 'split-curtain':x=.5+r*.43;y=.5+side*.22*(.4+.6*p);beamFocus=.15;break;
  case 'concentric-fans':x=.5+r*(.22+layer*.18);y=.28+(1-a)*(.22+.18*p)+layer*.12;break;
 }
 return {x:clamp(x),y:clamp(y),beamFocus};
}

const uAngle=(rank,count)=>count>1?rank/count*Math.PI*2:0;

// Entrance selection happens once per musical passage. Dense percussion is
// grouped into sustained statements, never translated into a train of flashes.
export function planFormationEntrances(sequence,previous=null){
 const minimumHold=sequence.minimumHold??1.1,selected=[];
 const carry=sequence.continuing?previous?.formationEntrances?.at(-1):null;
 let last=carry?.time??-Infinity;
 for(const event of sequence.entrances??[]){
  if(event.time-last<minimumHold-1e-6)continue;
  selected.push({...event,formationStep:(carry?.formationStep??-1)+selected.length+1});last=event.time;
 }
 if(carry)selected.unshift({...carry});
 return selected.map((e,i)=>{
  const holdEnd=selected[i+1]?.time??Math.min(sequence.end,e.time+Math.max(minimumHold,e.duration??0));
  return {...e,holdEnd,releaseEnd:Math.min(sequence.end,holdEnd+.4)};
 });
}

// The music-free preview uses the same sustained handovers as prepared songs.
let previewSequence;
export function formationPreviewAt(time){
 if(!previewSequence){
  previewSequence={start:0,end:64,role:'groove',formationId:'open-fan',strobeSentence:'centre-out',
   sharedPassage:{composition:'Formationen · Vorschau',intent:{motionDrive:.7}},phraseArt:{function:'verse'},
   entrances:Array.from({length:43},(_,i)=>({time:i*1.5,strength:1,duration:1.5}))};
  planFormationScenes([previewSequence],{beatGrid:{beats:Array.from({length:128},(_,i)=>i*.5),downbeats:Array.from({length:32},(_,i)=>i*2)}});
 }
 time=mod(Math.max(0,time),64);
 return {presentation:'strobe',kind:'groove',music:{sequence:{...previewSequence,time,
  ...formationSceneStateAt(previewSequence,time)}}};
}

export function strobeChoreography(figure,rank,count,row=0,groups=1){
 const s=figure.music.sequence,geometry=figure.geometrySequence??s.preparation??s;
 const sentence=geometry.strobeSentence??'pair-run';
 const fallback={'counter-pairs':'crossed-fans',zipper:'lattice',dialogue:'split-wings',
  'centre-out':'open-fan','edge-in':'converging-lines',reveal:'open-fan',ripple:'traveling-wave',
  'row-steps':'layered-steps',frame:'nested-gates'};
 const roleFor=story=>figure.fixtureRole??formationRigFixtureRole(figure.rigFamily,story);
 const storyForRig=story=>{
  if(!figure.rigFamily||!story?.action?.entry||!story.action.entryShape||roleFor(story)!=='lead'||
   roleFor({shape:story.action.entryShape})!=='frame')return story;
  // A newly leading bank starts at its own displayed accompaniment pose,
  // not at the outgoing row family's unilateral sweep endpoint.
  return {...story,audioTimeline:story.audioTimeline,action:{...story.action,entry:{frame:true}}};
 };
 const fixtureRole=roleFor(geometry.formationStory);
 const program=geometry.formationProgram;
 const id=geometry.formationId??fallback[sentence]??'parallel-lines';
 const progress=geometry.progress??figure.motionProgress??.5,amount=figure.amount??1;
 const directed=program?programPose(program,{...s,formationStory:storyForRig(geometry.formationStory),fixtureRole},rank,count,row,groups,progress,!!figure.geometrySequence||figure.flicker===0||amount===0||s.rhythm==='none'):null;
 const pose=directed??formationPose(id,rank,count,row,groups,progress);
 let current={x:.5+(pose.x-.5)*amount,y:.5+(pose.y-.5)*amount,...(program?{beamFocus:pose.beamFocus}: {})};
 let previousExposure,entranceBlend=1;
 if(s.previous&&!s.continuing&&!s.preparedEntrance&&!s.preparation&&!figure.geometrySequence){
  const before=s.previous.formationProgram?programPose(s.previous.formationProgram,{...s.previous,formationStory:storyForRig(s.previous.formationStory),fixtureRole:roleFor(s.previous.formationStory),time:geometry.formationStory?.audioTimeline||geometry.formationStory?.audioFrame?s.time:s.previous.end,formationEntries:s.previous.formationEntrances?.slice(-1)},rank,count,row,groups,1,false)
   :formationPose(s.previous.formationId??fallback[s.previous.strobeSentence]??'parallel-lines',rank,count,row,groups,1);
  const duration=geometry.formationStory&&s.previous.formationStory?Math.min(geometry.formationStory.transitionDuration??(geometry.formationStory.arrivalCue?.18:.9),(geometry.formationStory.end-geometry.formationStory.start)*.4):.9;
  const delay=geometry.formationStory&&s.previous.formationStory?0:row/Math.max(1,groups)*.2;
  const blend=ease(((s.age??1)-delay)/duration);
  previousExposure=before.exposure;entranceBlend=blend;
  current={x:.5+(before.x+(pose.x-before.x)*blend-.5)*amount,y:.5+(before.y+(pose.y-before.y)*blend-.5)*amount,
   ...(program?{beamFocus:(before.beamFocus??1)+(pose.beamFocus-(before.beamFocus??1))*blend}: {})};
  if(geometry.formationStory&&s.previous.formationStory&&(s.age??1)<duration&&figure.flicker!==0&&s.rhythm!=='none'&&amount>0){
   const story=geometry.formationStory,previous=s.previous.formationStory;
   const sample=(value,time)=>formationStoryPose(storyForRig(value),time,rank,count,row,groups,false,roleFor(value));
   const dt=Math.min(.001,(previous.end-previous.start)/10,(story.end-story.start)/10);
   const old=sample(previous,previous.end),oldBefore=sample(previous,previous.end-dt);
   const initial=sample(story,story.start),next=sample(story,story.start+dt);
   const t=clamp((s.age??duration)/duration);
   const h0=2*t*t*t-3*t*t+1,h1=t*t*t-2*t*t+t;
   // Preserve outgoing velocity while the incoming path takes over. Blending
   // from a frozen endpoint imposed another full stop at every phrase cut.
   for(const key of ['x','y','beamFocus']){
    const velocity=(old[key]-oldBefore[key])/dt-(next[key]-initial[key])/dt;
    const value=pose[key]+(old[key]-initial[key])*h0+velocity*duration*h1;
    current[key]=key==='beamFocus'?clamp(value):clamp(.5+(value-.5)*amount);
   }
  }
 }
 const pairs=Math.ceil(count/2),banks=Math.max(1,Math.min(8,pairs));
 const bank=Math.min(banks-1,Math.floor(Math.min(rank,count-1-rank)*banks/pairs));
 const held=s.role==='held'&&!geometry.formationStory||s.rhythm==='none'||figure.flicker===0;
 const support=fixtureRole==='support'||fixtureRole==='frame';
 let level=0;
 if(held)level=program?(programMembership({...program,kind:'sculpture'},0,0,bank,banks,layerFor(row,groups),groups,.5)?1:0):bank===banks-1?1:0;
 else if(Number.isFinite(directed?.exposure)){
  level=directed.exposure;
  if(Number.isFinite(previousExposure))level=Math.sqrt(previousExposure**2*(1-entranceBlend)+level**2*entranceBlend);
 }else{
  const events=s.formationEntries??[];
  for(const event of events){
   const elapsed=s.time-event.time;if(!Number.isFinite(elapsed)||elapsed<0||s.time>=event.releaseEnd)continue;
   const step=event.formationStep??0,phase=clamp(elapsed/Math.max(1.1,event.holdEnd-event.time));
   let wanted=mod(step,banks);
   if(sentence==='centre-out'||sentence==='reveal')wanted=banks-1-wanted;
   else if(sentence==='zipper')wanted=step%2===0?mod(Math.floor(step/2),banks):banks-1-mod(Math.floor(step/2),banks);
   else if(sentence==='counter-pairs')wanted=step%2===0?0:banks-1;
   else if(sentence==='dialogue'&&row%2)wanted=banks-1-wanted;
   if(support)wanted=mod(wanted+Math.ceil(banks/2),banks);
   let selected=bank===wanted;
   if(sentence==='edge-in')selected=bank<=wanted;
   if(sentence==='frame')selected=bank===(step%2===0?0:banks-1);
   if(sentence==='row-steps')selected=mod(step,groups)===row;
   if(sentence==='ripple')selected=Math.abs(bank-(mod(step,banks)+phase))<1;
   if(sentence==='reveal')selected=bank>=banks-Math.max(1,Math.ceil(banks*progress));
   if(program)selected=programMembership(program,step,phase,bank,banks,support?2:layerFor(row,groups),groups,progress,event.prominent);
   if(event.prominent&&!selected&&!program)selected=bank===mod(wanted+1,banks);
   const anticipation=s.phraseArt?.anticipation;
   const preparing=anticipation?ease((s.time-anticipation.start)/(anticipation.end-anticipation.start))*anticipation.strength:0;
   if(program&&preparing>.4&&layerFor(row,groups)===1)selected=false;
   if(!program&&groups>1&&s.phraseArt&&sentence!=='row-steps'){
    const budget=Math.max(1,Math.ceil(groups*(s.phraseArt.rowDensity??.6)*(1-preparing*.8)));
    selected&&=mod(row-Math.floor(step/banks),groups)<budget;
   }
   // The outgoing formation stays visible through the incoming handover.
   // Flicker settings do not attenuate the brightness of sustained beams.
   const envelope=ease(elapsed/.18)*(1-ease((s.time-event.holdEnd)/.4));
   const gain=.75+.25*clamp(event.strength??1);
   level=Math.max(level,selected?envelope*gain:0);
  }
  if(!s.formationEntrances?.length&&!events.length)level=program?(programMembership({...program,kind:'sculpture'},0,0,bank,banks,layerFor(row,groups),groups,.5)?1:0):bank===banks-1?.7:0;
 }
 // Apply the measured arrival AFTER the spatial crossfade, so an outgoing
 // quiet/build picture cannot smear its onset over the next 900 milliseconds.
 if(!held&&!figure.geometrySequence)level=Math.max(level,formationArrivalEnvelope(geometry.formationStory,s.time)*(support?.55:1));
 if(s.role==='silence'||figure.kind==='silence')level=0;
 return {...current,level,weight:1,wallBlend:0,paired:program||['diagonal-plane','traveling-wave','lattice'].includes(id)?0:1,
  articulation:0,beamPicture:true,visibleMotion:amount>0&&(!held||!!(program&&s.previous&&s.age<1.2&&s.rhythm!=='none')),formationId:directed?.id??id,
  ...(program?{paletteIndex:support||layerFor(row,groups)===2?1:0,formationProgram:program.kind}:{}),
  ...(directed?.storyMotion?{storyMotion:directed.storyMotion,storyAct:directed.storyAct,storyPhase:directed.storyPhase}:{}),
  fixtureRole:fixtureRole??(row%2?'answer':'lead'),dramaturgy:s.sharedPassage?.composition,strobeSentence:sentence};
}
