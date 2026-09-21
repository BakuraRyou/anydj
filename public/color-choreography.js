const rgb=frame=>[frame.r,frame.g,frame.b];
const distance=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
// Color changes are held between selected musical events, rather than returning
// to the same hue after every brightness pulse. No wall-clock color oscillator.
export function choreographColors(plan,profile='auto') {
  if(!plan.arrangement)return plan;
  const frames=plan.choreographyBaseFrames||plan.frames;
  const source=plan.arrangement,events=[],bars=plan.beatGrid?.downbeats||[];
  const palette=plan.colorPalette||[rgb(frames[0])];
  const phrases=source.patterns?.phrases||plan.sections.map((s,section)=>({...s,section}));
  for(const phrase of phrases){
    const section=plan.sections[phrase.section];
    if(!section||section.look==='held')continue;
    const local=source.times.map((time,index)=>({time,index})).filter(e=>e.time>=phrase.start&&e.time<phrase.end&&source.accents[e.index]>=.12);
    if(local.length<2)continue;
    const a=palette[(section.motif||0)%palette.length];
    let b=palette.reduce((best,c)=>distance(a,c)>distance(a,best)?c:best,a);
    // Automatic palettes may be very narrow. Add a complementary anchor;
    // an explicitly chosen custom palette remains under the user's control.
    if(distance(a,b)<240&&plan.effectiveOptions?.palette!=='custom')b=a.map(v=>Math.max(10,255-v));
    if(distance(a,b)<60)continue;
    let ordinal=0,last=-Infinity;
    for(const [j,{time,index}] of local.entries()){
      const progress=(time-section.start)/Math.max(.1,section.end-section.start);
      const onBar=bars.some(t=>Math.abs(t-time)<.04);
      const look=section.look;
      const di=source.drama?Math.min(source.drama.intensity.length-1,Math.floor(time/source.drama.step)):0;
      const driving=source.patterns?.events[index]?.driving||source.drama&&source.drama.percussion[di]>.35&&source.drama.intensity[di]>.4;
      const fast=section.role!=='support'&&(section.role==='feature'||look==='peak'||driving||look==='lift'&&progress>.65);
      const stride=section.role==='support'?(profile==='disco'?4:8):profile==='disco'?(fast?1:2):profile==='party'?(fast?2:3):(fast?2:4);
      const minimum=section.role==='support'?.9:profile==='disco'?(fast?.22:.45):(fast?.45:.9);
      const eligible=j===0||onBar||j%stride===0;
      if(!eligible||time-last<minimum)continue;
      if(source.drama&&source.drama.intensity[di]<.2)continue;
      if(source.bases[Math.min(source.bases.length-1,Math.floor(time/source.step))]===0)continue;
      // Broad sweeps retain a color for a bar; driving phrases can trade it
      // on individual accents. Repeated motifs restart the same color pair.
      if(phrase.kind==='sweep'&&profile!=='disco'&&j>0&&!onBar&&bars.length)continue;
      // Supporting sections use a narrower pair; a refrain opens the full
      // contrast instead of merely reversing the same two colors.
      const partner=section.role==='support'?a.map((v,c)=>Math.round(v*.65+b[c]*.35)):b;
      const color=(ordinal++%2?partner:a).map(v=>Math.round(v));
      events.push({time,end:phrase.end,r:color[0],g:color[1],b:color[2],section:phrase.section});last=time;
    }
  }
  const result={...plan,choreographyBaseFrames:frames,colorEvents:events};
  result.frames=frames.map((frame,i)=>colorFrameAt(result,i*plan.step,frame));
  return result;
}
export function colorFrameAt(plan,time,frame) {
  const events=plan.colorEvents;
  if(!events?.length)return frame;
  let lo=0,hi=events.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].time<=time)lo=mid+1;else hi=mid;}
  const event=events[lo-1];
  if(!event||time>=event.end)return frame;
  const base=plan.arrangement.bases[Math.min(plan.arrangement.bases.length-1,Math.floor(Math.max(0,time)/plan.arrangement.step))];
  return base?{...frame,r:event.r,g:event.g,b:event.b}:frame;
}
