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
  const event={time:i*.02,impact,salience:rise/Math.max(.015,reference)};
  const previous=result.at(-1);
  if(previous&&event.time-previous.time<.18){if(event.salience>previous.salience)result[result.length-1]=event;}
  else result.push(event);
 }
 return result;
}

// Preserve the uncompressed attack strength for ranking. Capped display gains
// cannot distinguish a prominent hit from several medium attacks.
export function acousticSalience(windows,time,reference){
 let strength=0;
 for(let i=Math.max(2,Math.floor((time-.06)/.02));i<Math.min(windows.length,Math.ceil((time+.06)/.02));i++){
  const now=windows[i],a=windows[i-1],b=windows[i-2];
  strength=Math.max(strength,now.rms-Math.max(a.rms,b.rms),(now.bass||0)-Math.max(a.bass||0,b.bass||0));
 }
 return strength/Math.max(.015,reference);
}
export function selectAccentEvents(events){
 // Strongest first: an earlier weak event must not reserve a quiet passage's
 // entire refractory interval. Restore chronological order for playback.
 const selected=[];
 for(const event of [...events].sort((a,b)=>b.priority-a.priority||a.time-b.time)){
  if(selected.some(other=>Math.abs(event.time-other.time)<(event.section===other.section?Math.max(event.spacing,other.spacing):Math.min(event.spacing,other.spacing))-1e-8))continue;
  selected.push(event);
 }
 return selected.sort((a,b)=>a.time-b.time);
}

// Measured low-frequency rises, independent of the beat grid. The short lookback
// preserves syncopation; a refractory interval prevents one attack becoming a chase.
export function bassAttackEvents(levels,step){
 if(!(step>0)||!levels?.length)return [];
 const sorted=Array.from(levels).filter(Number.isFinite).sort((a,b)=>a-b);
 const reference=Math.max(.008,sorted[Math.floor((sorted.length-1)*.95)]||0);
 const events=[],lookback=Math.max(1,Math.round(.12/step));
 for(let i=1;i<levels.length;i++){
  const value=levels[i];if(!Number.isFinite(value)||value<reference*.3)continue;
  let low=value;for(let j=Math.max(0,i-lookback);j<i;j++)low=Math.min(low,levels[j]);
  const rise=(value-low)/reference;
  if(rise<.24||value<=levels[i-1])continue;
  const previous=events.at(-1);
  if(previous&&i*step-previous.time<.18)continue;
  events.push({time:i*step,strength:Math.min(1,rise*2),baseline:low});
 }
 return events.map((event,index)=>{
  const start=Math.round(event.time/step),end=Math.min(levels.length,Math.round((events[index+1]?.time??event.time+1)/step));
  let peak=levels[start],peakIndex=start;
  for(let i=start+1;i<Math.min(end,start+Math.ceil(.12/step));i++)if(levels[i]>peak){peak=levels[i];peakIndex=i;}
  let release=peakIndex+1;
  while(release<end&&levels[release]>event.baseline+(peak-event.baseline)*.35)release++;
  return {time:event.time,strength:Math.min(1,(peak-event.baseline)/reference*2),duration:Math.max(step,(release-start)*step)};
 });
}
