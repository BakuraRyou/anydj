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
   const orbit=disco&&peak&&energy>.8&&tone>.72&&percussion>=.45&&percussion<.65&&vocals<.35;
   const shape=quiet?'arc':build?'fan':orbit?'orbit':phrase.attention?.leader==='vocals'||vocals>.5?'focus':percussion>.65?'pulse':tone>.6?'cross':'sweep';
   // Width, travel speed and cue density are independent controls. An ambient
   // arc can cover a wide area while taking several seconds to get there.
   design={shape,formation:quiet?'mirror':disco?(shape==='focus'?'mirror':percussion>.65?'diagonal':'ribbon'):shape==='focus'?'relay':build?'ribbon':percussion>.65?'pairs':'ribbon',width:quiet?16+10*tone:build?28:peak?25+9*energy:12+10*energy,
    speed:quiet?.22:build?.5:peak?.8:percussion>.65?.65:.4,
    spacing:quiet?4:build?1:peak?.5:percussion>.65?.6:1.5,
    travel:quiet?3:build?1.1:peak?.3:percussion>.65?.45:1.2,
    period:quiet?32:16,inner: .6-.25*vocals,depth:.06+.09*tone};
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
   case 'arc':pan=side*spread*scale*sideStep;depth*=1-sideStep*sideStep;break;
   case 'orbit':pan=side*spread*scale*Math.cos(phase*Math.PI/2);depth*=Math.sin(phase*Math.PI/2);break;
   case 'fan':pan=side*spread*scale;depth*=clamp(progress);break;
   case 'focus':pan=side*spread*(outer?[.45,.8,1,.8][phase]:design.inner*.4);depth*=outer?.5:0;break;
   case 'pulse':pan=side*spread*scale*[.4,1,.7,1][phase];depth*=phase%2?1:.25;break;
   case 'cross':pan=side*spread*scale*sideStep*(outer?1:-1);depth*=phase%2?1:-.5;break;
   default:pan=side*spread*scale*sideStep;depth*=phase%2?.6:-.6;
  }
  if(design.formation==='pairs'||design.formation==='relay'){
   const lead=design.formation==='relay'?ordinal%4:Math.floor(ordinal/2)%2;
   const active=design.formation==='relay'?i===lead:i%2===lead;
   pan=(i-1.5)*4+(active?pan:pan*.2);depth*=active?1:.25;
  }else if(design.formation==='ribbon'){
   pan=pan*.6+spread*(i-1.5)*.24;
   depth+=design.depth*(i-1.5)*.3;
  }else if(design.formation==='diagonal'){
   const role=[0,2,1,3][i];
   pan=pan*(role%2?-.85:.85)+(role-1.5)*3;
   depth+=design.depth*(role-1.5)*.3;
  }
  return {pan,tilt:.8+depth+(design.formation==='mirror'||!design.formation?(outer?.04:-.04):0)};
 });
}

// Destinations sampled at actual musical accents. Phase is measured in beats,
// never wall-clock seconds; strength and instrument balance shape each gesture.
export function groovePose(beat,{energy,strength,percussion,vocals,span=1,formation='mirror',period=4,shape='sweep',progress=0}){
 const phase=beat*2*Math.PI/period;
 const width=(12+18*clamp(energy))*(.55+.45*clamp(strength))*span;
 const depth=.045+.07*clamp(strength);
 return Array.from({length:4},(_,i)=>{
  const side=i<2?-1:1,outer=i===0||i===3;
  const role=formation==='pairs'?i%2:formation==='diagonal'?[0,2,1,3][i]:i;
  const offset=formation==='mirror'?0:formation==='pairs'?role*Math.PI*.35:formation==='ribbon'?role*.55:role*Math.PI/2;
  const wave=Math.cos(phase-offset),opening=(wave+1)/2;
  const scale=formation==='mirror'?(outer?.75+.25*clamp(percussion):.55-.25*clamp(vocals)):formation==='pairs'||formation==='relay'?.65+.35*(.5+.5*Math.sin(phase*.5-offset)):1;
  let pan=0,tilt=.8;
  // Distinct geometric paths. Formation assigns roles without replacing the path.
  switch(shape){
   case 'pulse':pan=side*width*wave*scale;tilt+=outer?.04:-.04;break;
   case 'cross':pan=side*(outer?1:-1)*width*wave*scale;tilt+=depth*pan/Math.max(1,width);break;
   case 'focus':pan=side*width*(outer?.35+.2*opening:.08);tilt+=outer?-.025:.025;break;
   case 'fan':pan=side*width*(outer?1:.4)*(.2+.8*clamp(progress));tilt+=depth*clamp(progress);break;
   case 'arc':pan=side*width*wave*scale;tilt+=depth*(1-wave*wave);break;
   case 'orbit':pan=width*Math.cos(phase-offset)*scale;tilt+=depth*Math.sin(phase-offset);break;
   default:pan=width*wave*scale;tilt+=(role-1.5)*.015;
  }
  if(formation!=='mirror')pan+=(i-1.5)*3;
  return {pan:clamp(pan,-42,42),tilt:clamp(tilt,.55,1.15)};
 });
}

// Move the gesture's working area over musical bars, independently of its local
// sweep/pulse. Each head visits the floor rather than staying an "inner" head.
// Smooth bounded anchors avoid clipping, random jumps and a permanent orbit.
export function spatialPose(poses,beat,{energy=.5,span=1}={}){
 const anchors=[[-.8,-.8],[.7,.55],[-.55,.85],[.85,-.55],[.15,.75],[-.75,-.15],[.6,-.85],[-.2,.35]];
 const spread=clamp(span,0,1),pace=beat/8;
 return poses.map((pose,i)=>{
  const phase=pace+i*2,index=Math.floor(phase),fraction=phase-index;
  const t=fraction*fraction*fraction*(fraction*(fraction*6-15)+10);
  const a=anchors[((index%anchors.length)+anchors.length)%anchors.length],b=anchors[((index+1)%anchors.length+anchors.length)%anchors.length];
  const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
  // Convex mixtures fit the legal range without flattening at its edges.
  // Energy changes the local gesture, not whether the rear floor is reachable.
  const local=.55+.1*clamp(energy);
  return {pan:pose.pan*local+x*42*(1-local)*spread,
   tilt:.85+(pose.tilt-.85)*.3+y*.23*spread};
 });
}
