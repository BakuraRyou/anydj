import {dramaAt} from './instrument-activity.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
// Reuse the existing phrase, instrument and motion analysis. No filename-based
// choreography, random figures or additional audio/model processing.
export function movingDirections(plan){
 const phrases=plan.arrangement?.patterns?.phrases||[],memory=[];
 return phrases.map(phrase=>{
  if(!phrase.movement)return null; // Older plans retain their previous rendering.
  const section=plan.sections?.[phrase.section]||{};
  let percussion=0,vocals=0,samples=0;
  for(let t=phrase.start;t<phrase.end;t+=.5){const d=dramaAt(plan.arrangement.drama,t);if(d){percussion+=d.percussion;vocals+=d.vocalShare;samples++;}}
  percussion=samples?percussion/samples:finite(phrase.movement.driving,0);
  vocals=samples?vocals/samples:0;
  const energy=clamp(finite(phrase.energy,.4)),tone=clamp(finite(phrase.tone,.5));
  const quiet=phrase.movement.character==='atmospheric'||['held','quiet','break','outro'].includes(section.look);
  const build=!quiet&&section.look==='lift',peak=!quiet&&section.look==='peak';
  const motionScale=phrase.attention?.motionScale??1;
  const evidence=[energy,tone,percussion,vocals,motionScale];
  const category=quiet?'atmospheric':build?'build':peak?'peak':phrase.movement.character;
  const prior=section.motif===undefined?null:memory.find(m=>m.motif===section.motif&&m.category===category&&m.evidence.every((v,i)=>Math.abs(v-evidence[i])<.2));
  let design=prior?.design;
  if(!design){
   const shape=quiet?'arc':build?'fan':phrase.attention?.leader==='vocals'||vocals>.5?'focus':percussion>.65?'pulse':tone>.6?'cross':'sweep';
   // Width, travel speed and cue density are independent controls. An ambient
   // arc can cover a wide area while taking several seconds to get there.
   design={shape,width:quiet?16+10*tone:build?28:peak?25+9*energy:12+10*energy,
    speed:quiet?.22:build?.5:peak?.8:percussion>.65?.65:.4,
    spacing:quiet?4:build?1:peak?.5:percussion>.65?.6:1.5,
    travel:quiet?3:build?1.1:peak?.3:percussion>.65?.45:1.2,
    inner: .6-.25*vocals,depth:.06+.09*tone};
   design.speed*=motionScale;design.spacing/=motionScale;design.travel/=motionScale;
   if(section.motif!==undefined)memory.push({motif:section.motif,category,evidence,design});
  }
  return {...design,start:phrase.start,end:phrase.end,motif:section.motif,category,recalled:Boolean(prior)};
 });
}
export function directedPose(design,ordinal,progress=0){
 const phase=ordinal%4,sideStep=[-1,0,1,0][phase];
 const spread=design.width*(design.category==='build'?.3+.7*clamp(progress):1);
 return Array.from({length:4},(_,i)=>{
  const side=i<2?-1:1,outer=i===0||i===3,scale=outer?1:design.inner;
  let pan,depth=design.depth;
  switch(design.shape){
   case 'arc':pan=side*spread*scale*sideStep;depth*=phase===1?1:phase===3?-1:0;break;
   case 'fan':pan=side*spread*scale;depth*=clamp(progress);break;
   case 'focus':pan=side*spread*(outer?[.45,.8,1,.8][phase]:design.inner*.4);depth*=outer?.5:0;break;
   case 'pulse':pan=side*spread*scale*[.4,1,.7,1][phase];depth*=phase%2?1:.25;break;
   case 'cross':pan=side*spread*scale*sideStep*(outer?1:-1);depth*=phase%2?1:-.5;break;
   default:pan=side*spread*scale*sideStep;depth*=phase%2?.6:-.6;
  }
  return {pan,tilt:.8+depth+(outer?.04:-.04)};
 });
}
