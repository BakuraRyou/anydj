import {lightingScenes} from './dmx-light-scenes.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const cache=new WeakMap();
export const SHOW_SCORE_VERSION=1;
export const SHOW_FORMS=['parallel','fan','converge','cross','wings','tiers'];
// A phrase owns a picture. Beat accents can articulate it without replacing it.
// Plans are immutable; no wall clock, filename or random state enters the score.
export function planShowScore(plan){
 if(cache.has(plan))return cache.get(plan);
 const scenes=lightingScenes(plan),phrases=plan.arrangement?.patterns?.phrases||[];
 const bars=plan.beatGrid?.downbeats||[],attacks=plan.arrangement?.times||[];
 const spans=[];
 for(const scene of scenes){
  const rhythmic=scene.drive>=.45&&attacks.some(t=>t>=scene.start&&t<scene.end);
  const envelope=(plan.arrangement?.motionEnvelope||[]).filter(p=>p.time>=scene.start&&p.time<scene.end),first=envelope[0];
  const expressive=scene.motion?.length>1||envelope.some(p=>Math.abs(p.energy-first.energy)>=.08||Math.abs(p.tone-first.tone)>=.12||Number.isFinite(p.pitch)&&Number.isFinite(first.pitch)&&Math.abs(p.pitch-first.pitch)>=2);
  const role=scene.kind==='silence'?'silence':scene.kind==='build'?'build':rhythmic?'groove':expressive&&(scene.kind==='sweep'||scene.cinematic)?'flow':'held';
  const prior=spans.at(-1);
  const phraseBoundary=phrases.some(p=>Math.abs(p.start-scene.start)<.05);
  // Loudness fragments are not new entrances. Keep real rests/builds and
  // measured changes; long grooves develop on phrase or detected bar boundaries.
  if(prior&&prior.role===role&&prior.end===scene.start&&!phraseBoundary&&Math.abs(prior.energy-scene.energy)<.18&&Math.abs(prior.tone-scene.tone)<.18){
   prior.end=scene.end;continue;
  }
  spans.push({...scene,role,rhythmic});
 }
 const phrasesWithRoom=spans.flatMap(span=>{
  const local=bars.filter(t=>t>span.start+.05&&t<span.end-.05),cuts=[span.start];
  if(span.rhythmic)for(let i=3;i<local.length;i+=4)if(local[i]-cuts.at(-1)>=4&&span.end-local[i]>=2)cuts.push(local[i]);
  cuts.push(span.end);
  return cuts.slice(0,-1).map((start,i)=>({...span,start,end:cuts[i+1]}));
 });
 const uses=new Map(),motifs=new Map();let previous=null;
 const score=phrasesWithRoom.map((span,index)=>{
  const salient=attacks.flatMap((t,i)=>t>=span.start&&t<span.end?[plan.arrangement.eventSalience?.[i]??0]:[]);
  const contrast=previous?span.energy-previous.energy:0;
  const featured=span.rhythmic&&span.energy>=.7&&contrast>.16;
  const role=featured?'arrival':span.role;
  const key=span.motif==null?null:`${span.motif}:${role}`;
  const recalled=key&&previous?.key!==key?motifs.get(key):null;
  let form;
  if(role==='silence'||role==='held')form=previous?.role===role?previous.form:'tiers';
  else if(recalled&&previous?.form!==recalled.form)form=recalled.form;
  else{
   const preferred=role==='build'?'fan':featured?'cross':span.vocals>.5?'converge':span.tone>.65?'wings':span.energy<.5?'tiers':'parallel';
   form=SHOW_FORMS.map((form,i)=>({form,cost:(form===preferred?-.65:0)+(form===previous?.form?2.5:0)+(uses.get(form)||0)*.45+
    (form==='cross'&&!featured ? .35 : 0)+(form==='parallel'&&span.texture>.5?-.3:0)+i*.001})).sort((a,b)=>a.cost-b.cost)[0].form;
  }
  const direction=recalled?.direction??(span.tone>=.5?1:-1);
  const picture={...span,index,role,form,key,direction,featured,
   occupancy:role==='silence'?0:role==='held'?.3:role==='arrival'?1:role==='build'?.7:role==='flow'?.5:span.vocals>.55?.5:.7,
   color:recalled?.color??index%2,
   // A single exceptional attack can be a hit; a uniformly strong grid is groove.
   accentThreshold:Math.max(.55,(salient.sort((a,b)=>a-b)[Math.floor(salient.length*.5)]??0)+.12),
   reason:recalled?'Musikalisches Motiv wiederaufgenommen':featured?'Kontrastreicher Einsatz':role==='build'?'Gemessener Aufbau':span.rhythmic?'Phrasenbild mit rhythmischen Akzenten':'Gehaltenes Klangbild'};
  if(key&&!motifs.has(key))motifs.set(key,picture);
  uses.set(form,(uses.get(form)||0)+1);previous=picture;return picture;
 });
 cache.set(plan,score);return score;
}
export function showScoreAt(plan,time){
 const score=plan?.showScore|| (plan?planShowScore(plan):[]);
 let lo=0,hi=score.length;
 while(lo<hi){const m=(lo+hi)>>>1;if(score[m].start<=time)lo=m+1;else hi=m;}
 const picture=score[lo-1];return picture&&time<picture.end?picture:null;
}
export function showScorePose(picture,time){
 const p=clamp((time-picture.start)/Math.max(.001,picture.end-picture.start));
 const energy=clamp(picture.energy),side=picture.direction,held=picture.role==='held'||picture.role==='silence';
 const develop=held?0:picture.role==='build'?p:p<.5?p*2:1;
 const spread=(held?9:16+10*energy)*(picture.role==='build'?.35+.65*p:1);
 const drift=held?side*4:side*(-7+14*develop);
 return [-1,-1/3,1/3,1].map((r,i)=>{
  const outer=i===0||i===3,sign=r<0?-1:1;
  let pan,tilt;
  switch(picture.form){
   case 'fan':pan=r*spread+drift*.3;tilt=.7+(1-Math.abs(r))*.24;break;
   case 'converge':pan=-r*(14+energy*5);tilt=.79;break;
   case 'cross':pan=-sign*(outer?23:13);tilt=outer?.96:.66;break;
   case 'wings':pan=sign*(17+develop*12);tilt=outer?.68:.98;break;
   case 'tiers':pan=held?r*8:r*12+drift*.4;tilt=held?(outer?.65:.76):(outer?.69:.96);break;
   default:pan=drift*(1+energy*.9);tilt=.73+(held?0:.2*develop);
  }
  return {pan:clamp(pan,-38,38),tilt:clamp(tilt,.57,1.06),focus:picture.form==='converge'?1:0};
 });
}
