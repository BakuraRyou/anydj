import {dramaAt} from './instrument-activity.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
// Reuse the existing phrase, instrument and motion analysis. No filename-based
// choreography, random figures or additional audio/model processing.
export function movingDirections(plan,disco=false){
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
   design={shape,formation:!disco||quiet||shape==='focus'?'mirror':percussion>.65?'diagonal':'ribbon',width:quiet?16+10*tone:build?28:peak?25+9*energy:12+10*energy,
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
  if(design.formation==='ribbon'){
   pan=spread*(sideStep*.6+(i-1.5)*.24);
   depth+=design.depth*(i-1.5)*.3;
  }else if(design.formation==='diagonal'){
   const role=[0,2,1,3][i],angle=(phase+role)*Math.PI/2;
   pan=spread*.85*Math.cos(angle);
   depth=design.depth*Math.sin(angle);
  }
  return {pan,tilt:.8+depth+(design.formation==='mirror'||!design.formation?(outer?.04:-.04):0)};
 });
}

// Destinations sampled at actual musical accents. Phase is measured in beats,
// never wall-clock seconds; strength and instrument balance shape each gesture.
export function groovePose(beat,{energy,strength,percussion,vocals,span=1,formation='mirror',period=4}){
 const phase=beat*2*Math.PI/period;
 const width=(12+18*clamp(energy))*(.55+.45*clamp(strength))*span;
 return Array.from({length:4},(_,i)=>{
  if(formation!=='mirror'){
   const offset=formation==='diagonal'?[0,2,1,3][i]*Math.PI/2:i*.55;
   const angle=phase+offset;
   return {pan:clamp(width*.85*Math.cos(angle)+(formation==='ribbon'?(i-1.5)*3:0),-42,42),
    tilt:clamp(.8+Math.sin(angle)*(.045+.07*clamp(strength)),.55,1.15)};
  }
  const side=i<2?-1:1,outer=i===0||i===3;
  const scale=outer?.75+.25*clamp(percussion):.55-.25*clamp(vocals);
  const sweep=outer?Math.cos(phase):Math.cos(phase+Math.PI/2);
  return {pan:clamp(side*width*scale*sweep,-42,42),
   tilt:clamp(.8+(outer?.05:-.04)+Math.sin(phase)*(.025+.065*clamp(strength))*(outer?1:.6),.55,1.15)};
 });
}
