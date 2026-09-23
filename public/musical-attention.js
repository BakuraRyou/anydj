// Shared, conservative focus for automatic lighting. Stem shares describe
// activity, not semantic certainty; ambiguous mixtures keep the existing show.
const names=['drums','bass','vocals','other'];
export function musicalAttention(instruments,start,end){
 const neutral={leader:'mixed',confidence:0,accentScale:1,motionScale:1,colorScale:1};
 if(!instruments||!(end>start))return neutral;
 const a=Math.max(0,Math.floor(start/instruments.step));
 const b=Math.min(instruments.drums.length,Math.ceil(end/instruments.step));
 if(b<=a)return neutral;
 const levels=names.map(name=>{
  let sum=0;for(let i=a;i<b;i++)sum+=instruments[name][i]**2;
  return Math.sqrt(sum/(b-a));
 });
 const total=levels.reduce((sum,v)=>sum+v,0);
 if(total<.008)return neutral;
 const shares=levels.map(v=>v/total),rank=shares.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
 const margin=rank[0].v-rank[1].v;
 if(rank[0].v<.5||margin<.2)return neutral;
 const confidence=Math.min(1,margin/.6),leader=names[rank[0].i];
 // A lead voice gets room without erasing the underlying groove. Bass and
 // drums retain their drive; sustained accompaniment has gentler movement.
 const soft=leader==='vocals'?confidence:leader==='other'?confidence*.65:0;
 return {leader,confidence,accentScale:1-.18*soft,motionScale:1-.35*soft,colorScale:1-.3*soft};
}

// Detect short, measured attacks at the 20 ms analysis resolution. Spectral
// frames repeat every 80 ms, so flux alone must never fabricate an onset.
export function offbeatAttacks(windows,duration,reference){
 const result=[];
 for(let i=2;i<Math.min(windows.length-7,Math.ceil(duration/.02));i++){
  const now=windows[i],prior=windows[i-1],before=windows[i-2];
  if(now.rms<.008)continue;
  const rise=Math.max(now.rms-Math.max(prior.rms,before.rms),
   (now.bass||0)-Math.max(prior.bass||0,before.bass||0));
  const impact=Math.min(1,rise/Math.max(.015,reference)*4);
  if(impact<.55||now.rms<prior.rms*1.18)continue;
  // A lasting level change is a texture transition, not a percussion flash.
  if(!windows.slice(i+2,i+8).some(w=>w.rms<now.rms*.85))continue;
  const event={time:i*.02,impact};
  const previous=result.at(-1);
  if(previous&&event.time-previous.time<.18){if(event.impact>previous.impact)result[result.length-1]=event;}
  else result.push(event);
 }
 return result;
}
