import {songMovementAt,movementAccentEnvelope} from './song-movement-plan.js';
import {lightingScenes} from './dmx-light-scenes.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const cache=new WeakMap();
export const SHOW_SCORE_VERSION=11;
export const SHOW_FORMS=['parallel','fan','converge','cross','wings','tiers','arc','ribbon'];
// Compare every passage with the whole song before assigning visual scale.
// Uniform loud material has no artificial climax; a peak needs real contrast.
function songDirection(spans){
 const active=spans.filter(s=>s.role!=='silence');
 const peak=Math.max(0,...active.map(s=>s.energy));
 const floor=Math.min(peak,...active.map(s=>s.energy));
 const range=peak-floor;
 return spans.map((s,i)=>{
  const before=spans[i-1],after=spans[i+1];
  const strength=range>=.22?clamp((s.energy-floor)/range):.55;
  const climax=range>=.22&&s.energy>=Math.max(.65,peak-.035)&&s.role!=='silence'&&s.role!=='held';
  const rising=before&&after&&s.energy-before.energy>=.07&&after.energy-s.energy>=.07;
  const chapter=s.role==='silence'?'rest':s.role==='build'||rising?'build':climax?'climax':
   before&&before.energy-s.energy>=.18?'release':
   after&&after.energy-s.energy>=.18?'anticipation':
   strength<.3?'restrained':'development';
  const character=s.cinematic?'cinematic':s.vocals>.55?'vocal':s.drive>=.45?'rhythmic':'sustained';
  return {chapter,character,climax,scale:climax?1:.45+.4*strength,
   rowFraction:climax?1:chapter==='build'?.67:strength<.3||character==='vocal'?.34:.5,
   rowSelection:s.sectionIndex??i};
 });
}
// A phrase owns a picture. Beat accents can articulate it without replacing it.
// Plans are immutable; no wall clock, filename or random state enters the score.
export function planShowScore(plan){
 if(cache.has(plan))return cache.get(plan);
 const scenes=lightingScenes(plan),phrases=plan.arrangement?.patterns?.phrases||[];
 const attacks=plan.arrangement?.times||[];
 const spans=[];
 for(const scene of scenes){
  const movementIntent=songMovementAt(plan,scene.start);
  const rhythmic=scene.drive>=.45&&attacks.some(t=>t>=scene.start&&t<scene.end)||!!(movementIntent?.motionDrive>=.45&&movementIntent.rhythm.confidence>=.5);
  const envelope=(plan.arrangement?.motionEnvelope||[]).filter(p=>p.time>=scene.start&&p.time<scene.end),first=envelope[0];
  const expressive=scene.motion?.length>1||envelope.some(p=>Math.abs(p.energy-first.energy)>=.08||Math.abs(p.tone-first.tone)>=.12||Number.isFinite(p.pitch)&&Number.isFinite(first.pitch)&&Math.abs(p.pitch-first.pitch)>=2);
  const role=scene.kind==='silence'?'silence':scene.kind==='build'?'build':rhythmic?'groove':expressive&&(scene.kind==='sweep'||scene.cinematic)?'flow':'held';
  const prior=spans.at(-1);
  const phraseBoundary=phrases.some(p=>Math.abs(p.start-scene.start)<.05);
  // Loudness fragments are not new entrances. Keep real rests/builds and
  // measured changes; long grooves develop at analysed phrase boundaries.
  if(prior&&prior.sectionIndex===scene.sectionIndex&&prior.role===role&&prior.end===scene.start&&!phraseBoundary&&Math.abs(prior.energy-scene.energy)<.18&&Math.abs(prior.tone-scene.tone)<.18){
   prior.end=scene.end;continue;
  }
  spans.push({...scene,role,rhythmic,movementIntent});
 }
 const directionPlan=songDirection(spans);
 const uses=new Map(),motifs=new Map();let previous=null;
 const score=spans.map((span,index)=>{
  const direction=directionPlan[index];
  const salient=attacks.flatMap((t,i)=>t>=span.start&&t<span.end?[plan.arrangement.eventSalience?.[i]??0]:[]);
  const contrast=previous?span.energy-previous.energy:0;
  const featured=span.rhythmic&&span.energy>=.7&&contrast>.16;
  const role=featured?'arrival':direction.chapter==='build'?'build':span.role;
  const key=span.motif==null?null:`${span.motif}:${role}:${direction.chapter}`;
  const recalled=key&&previous?.key!==key?motifs.get(key):null;
  let form;
  if(role==='silence'||role==='held')form=previous?.role===role?previous.form:'tiers';
  // A phrase boundary alone is not a reason to replace a working picture.
  // Keep its form when the musical role and measured character continue.
  else if(role==='flow'&&previous?.role==='flow'&&span.drive<.3&&span.energy<.4&&
    ['arc','fan','tiers'].includes(previous.form)&&Math.abs(span.energy-previous.energy)<.25&&Math.abs(span.tone-previous.tone)<.25)form=previous.form;
  else if(previous&&previous.role===role&&previous.key===key&&previous.chapter===direction.chapter&&
    ['energy','drive','vocals','tone','texture'].every(k=>Math.abs((span[k]??0)-(previous[k]??0))<.08))form=previous.form;
  else if(recalled)form=recalled.form;
  else{
   const preferred=role==='build'?'fan':featured?'cross':span.vocals>.5?'arc':span.tone>.65?'wings':span.energy<.5?'arc':span.drive>.65?'ribbon':'parallel';
   form=SHOW_FORMS.map((form,i)=>({form,cost:(form===preferred?-.65:0)+(form===previous?.form?2.5:0)+(uses.get(form)||0)*.45+
    (form==='cross'&&!featured ? .35 : 0)+(form==='parallel'&&span.texture>.5?-.3:0)+i*.001})).filter(({form})=>(form!=='converge'||['arrival','build'].includes(role))&&(role!=='flow'||span.drive>=.3||span.energy>=.4||['arc','fan','tiers'].includes(form))).sort((a,b)=>a.cost-b.cost)[0].form;
  }
  const side=recalled?.direction??(span.tone>=.5?1:-1);
  const picture={...span,index,role,form,key,...direction,direction:side,featured,
   occupancy:role==='silence'?0:role==='held'?.3:direction.climax?1:role==='arrival'?.8:role==='build'?.7:role==='flow'?.5:span.vocals>.55?.45:.5+.25*direction.scale,
   color:recalled?.color??index%2,
   // A single exceptional attack can be a hit; a uniformly strong grid is groove.
   accentThreshold:Math.max(.55,(salient.sort((a,b)=>a-b)[Math.floor(salient.length*.5)]??0)+.12),
   reason:direction.climax?'Höhepunkt im gesamten Song':direction.chapter==='anticipation'?'Reserve vor stärkerem Abschnitt':recalled?'Musikalisches Motiv wiederaufgenommen':featured?'Kontrastreicher Einsatz':role==='build'?'Gemessener Aufbau':span.rhythmic?'Phrasenbild mit rhythmischen Akzenten':'Gehaltenes Klangbild'};
  if(key&&!motifs.has(key))motifs.set(key,picture);
  uses.set(form,(uses.get(form)||0)+1);previous=picture;return picture;
 });
 // Adjacent sustained pictures may have different analysis labels but belong
 // to one continuing gesture. Do not restart its opening at each boundary.
 let run=[];
 const finish=()=>{if(run.length>1)for(const p of run){p.motionStart=run[0].start;p.motionEnd=run.at(-1).end;}run=[];};
 for(const p of score){
  const prior=run.at(-1),gentle=p.role==='flow'&&p.drive<.3&&p.energy<.4;
  if(!gentle||prior&&(prior.end!==p.start||prior.form!==p.form||prior.direction!==p.direction))finish();
  if(gentle)run.push(p);
 }
 finish();
 cache.set(plan,score);return score;
}
export function showScoreAt(plan,time){
 const score=plan?.showScore|| (plan?planShowScore(plan):[]);
 let lo=0,hi=score.length;
 while(lo<hi){const m=(lo+hi)>>>1;if(score[m].start<=time)lo=m+1;else hi=m;}
 const picture=score[lo-1];return picture&&time<picture.end?picture:null;
}
// Use the same picture handover for pair membership.
// Silence remains authoritative; only a measured arrival permits a quick cut.
export function showPictureLayers(plan,time){
 const picture=showScoreAt(plan,time);if(!picture)return [];
 const previous=showScoreAt(plan,picture.start-.00001);
 if(!previous||picture.role==='silence'||previous.role==='silence')return [{picture,weight:1}];
 const duration=Math.min((picture.end-picture.start)*.4,picture.featured ? .25 : 1.8);
 const x=clamp((time-picture.start)/Math.max(.001,duration)),blend=x*x*(3-2*x);
 return blend>=1?[{picture,weight:1}]:[{picture:previous,weight:1-blend},{picture,weight:blend}];
}
export function showScorePose(picture,time){
 const start=picture.motionStart??picture.start,end=picture.motionEnd??picture.end;
 const p=clamp((time-start)/Math.max(.001,end-start));
 const energy=clamp(picture.energy),side=picture.direction,held=picture.role==='held'||picture.role==='silence';
 const intent=picture.movementIntent;
 const phase=p*Math.PI*2*(intent?.pace??1);
 const gentle=p*p*p*(p*(p*6-15)+10);
 const develop=held?0:picture.role==='flow'&&picture.drive<.3?gentle:picture.role==='build'?p:intent?.motionDrive>0?.5-.5*Math.cos(phase):p<.5?p*2:1;
 const scale=picture.scale??1;
 const spread=(held?9:16+10*energy)*(1+(held?0:.04*movementAccentEnvelope(intent,time)))*(picture.role==='build'?.35+.65*p:1);
 const drift=held?side*4:side*(-7+14*develop);
 return [-1,-1/3,1/3,1].map((r,i)=>{
  const mirrored=intent?.symmetry!=='evaluating'&&r>0;
  if(mirrored){const left=showScorePose({...picture,movementIntent:{...intent,symmetry:'evaluating'}},time)[3-i];return {...left,pan:-left.pan};}
  const outer=i===0||i===3,sign=r<0?-1:1;
  let pan,tilt;
  switch(picture.form){
   case 'arc':pan=r*(16+6*develop);tilt=.7+.22*(1-r*r)+.04*develop;break;
   case 'ribbon':pan=r*21+drift*.55;tilt=.81+r*.12+Math.sin(phase)*.045;break;
   case 'fan':pan=r*spread+drift*.3;tilt=.7+(1-Math.abs(r))*.24;break;
   case 'converge':pan=-r*(14+energy*5);tilt=.79;break;
   case 'cross':pan=-sign*(outer?23:13);tilt=outer?.96:.66;break;
   case 'wings':pan=sign*(17+develop*12);tilt=outer?.68:.98;break;
   case 'tiers':pan=held?r*8:r*12+drift*.4;tilt=held?(outer?.65:.76):(outer?.69:.96);break;
   default:pan=intent?.symmetry?sign*(10+6*develop):drift*(1+energy*.9);tilt=.73+(held?0:.2*develop);
  }
  return {pan:clamp(pan*(.65+.35*scale),-38,38),tilt:clamp(tilt,.57,1.06),focus:picture.form==='converge'?1:0};
 });
}
