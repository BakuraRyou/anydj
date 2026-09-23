// Activity follows selected acoustic events, not a repeating beat counter.
// Cache only the prepared event list; playback/seek is a stateless binary lookup.
const cache=new WeakMap();
const quiet=look=>/held|quiet|break|outro/.test(look||'');
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
function cuesFor(plan){
  if(cache.has(plan))return cache.get(plan);
  const sections=plan.sections||[],a=plan.arrangement;
  const cues=[{time:0,group:0,fade:0}];
  const phrases=a?.patterns?.phrases||[];
  let sectionIndex=0,phraseIndex=0,group=0;
  for(let i=0;i<(a?.times?.length||0);i++){
    const time=a.times[i];
    if(!Number.isFinite(time)||time<=0)continue;
    while(sectionIndex+1<sections.length&&sections[sectionIndex+1].start<=time)sectionIndex++;
    while(phraseIndex+1<phrases.length&&phrases[phraseIndex+1].start<=time)phraseIndex++;
    const section=sections[sectionIndex],calm=quiet(section?.look)||phrases[phraseIndex]?.movement?.character==='atmospheric',peak=section?.look==='peak';
    const strength=clamp(a.accents?.[i]);
    // Leave quiet passages held. Stronger selected hits answer one another;
    // minimum spacing only limits density, it never schedules a new event.
    if(calm||strength<(peak?.2:.28)||time-cues.at(-1).time<(peak?.3:.7))continue;
    cues.push({time,group:++group,fade:peak?.12:.24});
  }
  cache.set(plan,cues);return cues;
}
function mask(index,units,group,calm,peak){
  if(units<=1)return 1;
  const slot=(index+group)%units;
  const count=calm?Math.max(1,Math.floor(units/2)):peak?Math.max(1,Math.ceil(units*.75)):Math.ceil(units/2);
  // On four heads, move between outside, side and inside pairs.
  // Each pair includes both slots of a two-color palette.
  const rank=units===4?[0,2,3,1][slot]:slot;
  return rank<count?1:0;
}
export function activityAt(source,units){
  const calm=quiet(source.look)||source.motionCharacter==='atmospheric',peak=source.look==='peak'&&!calm;
  const plan=source.movingPlan,time=source.songTime;
  let group=0,previous=0,mix=1;
  if(plan&&Number.isFinite(time)){
    const cues=cuesFor(plan);
    let lo=0,hi=cues.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].time<=time)lo=mid+1;else hi=mid;}
    const index=Math.max(0,lo-1),cue=cues[index];
    group=cue.group;previous=cues[Math.max(0,index-1)].group;
    mix=cue.fade?smooth((time-cue.time)/cue.fade):1;
  }
  // Only exceptional accents open the whole rig; ordinary hits stay local.
  const all=calm?0:smooth((clamp(source.accentStrength)-.72)/.28);
  return Array.from({length:units},(_,i)=>{
    const level=mask(i,units,previous,calm,peak)*(1-mix)+mask(i,units,group,calm,peak)*mix;
    return level+(1-level)*all;
  });
}
