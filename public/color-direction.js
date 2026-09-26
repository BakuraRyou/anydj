// Phrase-level color design. These choices interpret musical evidence; they do
// not change the independently prepared rhythm, movement or dimmer envelopes.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const names=['drums','bass','vocals','other'];
const angle=(a,b)=>(((b-a+180)%360+360)%360)-180;
function linearRGB([l,c,h]){
 const a=c*Math.cos(h*Math.PI/180),b=c*Math.sin(h*Math.PI/180);
 const x=(l+.3963377774*a+.2158037573*b)**3,y=(l-.1055613458*a-.0638541728*b)**3,z=(l-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*x-3.3077115913*y+.2309699292*z,-1.2684380046*x+2.6097574011*y-.3413193965*z,-.0041960863*x-.7034186147*y+1.707614701*z];
}
export function directionRGB(lch){
 let low=0,high=lch[1],rgb=linearRGB(lch);
 if(rgb.some(v=>v<0||v>1)){
  for(let i=0;i<14;i++){const c=(low+high)/2;const candidate=linearRGB([lch[0],c,lch[2]]);if(candidate.every(v=>v>=0&&v<=1))low=c;else high=c;}
  rgb=linearRGB([lch[0],low,lch[2]]);
 }
 const encoded=rgb.map(v=>clamp(v<=.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-.055));
 // Keep color intensity separate from the show's existing dimmer envelope.
 const peak=Math.max(...encoded,1e-9);return encoded.map(v=>Math.round(255*v/peak));
}
const blend=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+angle(a[2],b[2])*t];
function describe(windows,start,end,instruments){
 let n=0;const sum=[0,0,0,0,0];
 for(let i=Math.max(0,Math.floor(start/.02));i<Math.min(windows.length,Math.ceil(end/.02));i++){
  const w=windows[i];if(!(w.rms>.003))continue;
  const values=[w.bands?.[0]??.2,(w.bands?.[3]??0)+(w.bands?.[4]??0),w.tone??.5,w.flatness??0,w.rms];
  values.forEach((v,k)=>sum[k]+=clamp(v));n++;
 }
 const values=sum.map(v=>v/Math.max(1,n));
 const shares=names.map(name=>{
  if(!instruments)return 0;
  const a=Math.floor(start/instruments.step),b=Math.min(instruments[name].length,Math.ceil(end/instruments.step));let energy=0;
  for(let i=a;i<b;i++)energy+=instruments[name][i]**2;
  return Math.sqrt(energy/Math.max(1,b-a));
 });
 const total=shares.reduce((a,b)=>a+b,0);
 return {values:[...values,...shares.map(v=>total?v/total:0)],audible:n>0};
}
const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])*(i===4?1.5:1)));
export function planColorDirection(windows,plan){
 const phrases=plan.arrangement?.patterns?.phrases||[];
 if(!phrases.length)return null;
 const motifs=[],events=[],decisions=[];let previous=null,held=null,heldEvidence=null;
 for(const phrase of phrases){
  const section=plan.sections[phrase.section];if(!section)continue;
  const evidence=describe(windows,phrase.start,phrase.end,plan.structure?.instruments);
  if(!evidence.audible)continue;
  const v=evidence.values,mood=plan.moods?.find(m=>phrase.start>=m.start&&phrase.start<m.end);
  const moodKey=mood?.confidence>=.4?mood.mood:'neutral';
  const change=previous?difference(heldEvidence||previous.values,v):1;
  const roleChange=Boolean(previous&&previous.role!==section.role&&section.role==='feature');
  const recalled=motifs.find(m=>m.motif===section.motif&&m.mood===moodKey&&difference(m.values,v)<.18);
  let design= recalled?.design;
  let reason=recalled?'motif-return':!previous?'opening':change>=.18?'sound-change':'hold';
  if(!design&&previous&&change<.18&&previous.mood===moodKey&&!roleChange){design=held;reason='hold';}
  if(!design){
   const bases={bright:85,gentle:45,wistful:265,dramatic:335};
   const timbre=35+190*v[2]+80*v[1]-65*v[0]+35*v[3];
   let h=moodKey==='neutral'?timbre:bases[moodKey]+clamp(timbre-180,-60,60)*.45;
   // A substantial new texture needs perceptible separation, even when the
   // individual features cancel in a weighted average. No periodic hue clock.
   if(previous&&(change>=.18||roleChange)&&held&&Math.abs(angle(held[0][2],h))<32)h=held[0][2]+(v[2]>=previous.values[2]?55:-55);
   const spread=35+55*v[1]+30*v[3];
   // Chroma is independent of texture and loudness. Gamut mapping limits it.
   design=[[.54,.28,h],[.54,.28,h+spread],[.56,.28,h+145+35*v[0]]];
   if(roleChange)reason='section-contrast';
   motifs.push({motif:section.motif,mood:moodKey,values:v,design});
  }
  const entry=plan.arrangement.times.find(t=>t>=phrase.start&&t<phrase.end)??phrase.start;
  if(held&&entry-events.at(-1).time<4){design=held;reason='minimum-hold';}
  const quiet=/held|quiet|break|outro/.test(section.look||'');
  const add=(time,role,why)=>{
   const to=[design[role],...design.filter((_,i)=>i!==role)];
   const prev=events.at(-1);if(prev&&time-prev.time<4)return;
   if(prev&&prev.to.every((c,i)=>c.every((v,k)=>v===to[i][k])))return;
   // Crossfade only the emitted endpoint colors. A hue-wheel interpolation
   // passes through unrelated green/yellow families on a red/cyan transition.
   events.push({time,transition:!prev?0:quiet?2:1,fromRGB:prev?sampleRGB(prev,time):to.map(directionRGB),to,role,reason:why});
  };
  if(!previous||reason!=='hold')add(entry,0,reason);
  // Short attacks belong to the existing dimmer/activity envelopes. They
  // never replace the whole scene palette or schedule a color-return flash.
  decisions.push({start:phrase.start,end:phrase.end,motif:section.motif,mood:moodKey,change,reason,eventTime:events.at(-1)?.time});
  if(design!==held)heldEvidence=v;
  previous={values:v,mood:moodKey,role:section.role};held=design;
 }
 return events.length?{version:2,events,phrases:decisions}:null;
}
function sampleLCH(event,time){
 const t=event.transition?clamp((time-event.time)/event.transition):1,s=t*t*(3-2*t);
 return event.to.map((c,i)=>blend(event.from[i],c,s));
}
function sampleRGB(event,time){
 // Saved version-1 plans keep their original interpretation.
 if(!event.fromRGB)return sampleLCH(event,time).map(directionRGB);
 const t=event.transition?clamp((time-event.time)/event.transition):1,s=t*t*(3-2*t);
 return event.to.map((color,i)=>directionRGB(color).map((v,c)=>Math.round(event.fromRGB[i][c]*(1-s)+v*s)));
}
export function directionAt(direction,time){
 const events=direction?.events;if(!events?.length)return null;
 let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].time<=time)lo=mid+1;else hi=mid;}
 return sampleRGB(events[Math.max(0,lo-1)],time);
}
export function applyColorDirection(plan){
 if(!plan.colorDirection||plan.effectiveOptions?.palette==='custom')return plan;
 const soundPalettes=plan.frames.map((_,i)=>directionAt(plan.colorDirection,i*plan.step));
 const frames=plan.frames.map((f,i)=>({...f,r:soundPalettes[i][0][0],g:soundPalettes[i][0][1],b:soundPalettes[i][0][2]}));
 return {...plan,directionActive:true,frames,choreographyBaseFrames:frames,soundPalettes,colorEvents:[]};
}
export function legacyColorDirection(plan){
 const old=plan.legacyColors;if(!old)return plan;
 const frames=plan.frames.map((f,i)=>({...f,r:old.frames[i].r,g:old.frames[i].g,b:old.frames[i].b}));
 return {...plan,directionActive:false,frames,choreographyBaseFrames:old.choreographyBaseFrames,soundPalettes:old.soundPalettes,colorEvents:old.colorEvents};
}
