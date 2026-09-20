import {musicStyleAt} from './music-style.js';
const clamp=value=>Math.max(0,Math.min(1,value));
const step=.125;
const looks={held:'Ruhige Passage',flow:'Klangbewegung',lift:'Aufbau',peak:'Rhythmische Akzente'};
function style(section,energy) {
  // Labels describe form, not intensity: an energetic intro need not be ambient.
  if(['start','break','end'].includes(section.label))return energy>.55?'flow':'held';
  if(['intro','outro'].includes(section.label))return energy>.5?'flow':'held';
  if(['chorus','solo'].includes(section.label))return energy>.35?'peak':'flow';
  if(section.label==='bridge')return 'lift';
  if(['verse','inst'].includes(section.label))return 'flow';
  return {Ruhig:'held',Aufbau:'lift',Intensiv:'peak',Fließend:'flow'}[section.kind]||'flow';
}
export function arrangeShow(windows,duration,sections,beats,downbeats=[],musicStyle=null) {
  const prefix=[0];for(const window of windows)prefix.push(prefix.at(-1)+window.rms);
  const rms=(start,end)=>{
    const a=Math.max(0,Math.floor(start/.02)),b=Math.min(windows.length,Math.ceil(end/.02));
    return b>a?(prefix[b]-prefix[a])/(b-a):0;
  };
  const sorted=windows.map(w=>w.rms).sort((a,b)=>a-b);
  const ceiling=Math.max(.015,sorted[Math.floor((sorted.length-1)*.95)]||0);
  const evidence=beats.map(time=>{
    const a=Math.max(1,Math.floor((time-.08)/.02)),b=Math.min(windows.length,Math.ceil((time+.1)/.02));
    let attack=0,flux=0;
    for(let i=a;i<b;i++) {
      const now=windows[i],prior=windows[i-1];
      attack=Math.max(attack,(now.rms-prior.rms)/ceiling,((now.bass??0)-(prior.bass??0))/ceiling);
      flux=Math.max(flux,now.flux??0);
    }
    return {attack:clamp(attack),flux};
  });
  const fluxes=evidence.map(e=>e.flux).sort((a,b)=>a-b);
  const fluxLow=fluxes[Math.floor(fluxes.length*.25)]||0,fluxHigh=fluxes[Math.floor(fluxes.length*.9)]||0;
  const impacts=evidence.map(({attack,flux},i)=>{
    const time=beats[i];
    const rise=time>=.35?clamp((rms(time,time+.25)-rms(time-.35,time-.1))/ceiling):0;
    const spectral=fluxHigh-fluxLow>.015?clamp((flux-fluxLow)/(fluxHigh-fluxLow)):0;
    return clamp(Math.max(attack*4,rise*2,spectral*.75));
  });
  // A run of audible attacks establishes a groove. Weaker beats within that
  // run carry motion too; a model grid over a sustained pad does not qualify.
  const grooves=beats.map((time,i)=>{
    const nearby=impacts.slice(Math.max(0,i-2),i+3).filter((_,j)=>Math.abs(beats[Math.max(0,i-2)+j]-time)<=1.25);
    return nearby.filter(value=>value>=.22).length>=3;
  });
  const passages=sections.map(section=>{let look=style(section,rms(section.start,section.end)/ceiling);
    const local=beats.map((time,i)=>({time,groove:grooves[i]})).filter(b=>b.time>=section.start&&b.time<section.end);
    if(look==='held'&&rms(section.start,section.end)/ceiling>.35&&local.filter(b=>b.groove).length>local.length*.5)look='flow';
    return {...section,look,lookLabel:looks[look]};});
  const bases=[],lookTrack=[];let index=0,base=0;
  for(let time=0;time<duration;time+=step) {
    while(index+1<passages.length&&passages[index+1].start<=time)index++;
    const section=passages[index],look=section.look;
    const energy=clamp(rms(time-.25,time+.25)/ceiling);
    const audible=rms(time-.08,time+.08)>.001;
    const progress=clamp((time-section.start)/Math.max(1,section.end-section.start));
    const profile=musicStyleAt(musicStyle,time);
    const target=audible?profile.base*{
      held:.12+energy*.16,
      flow:.14+energy*.18,
      lift:.16+progress*.24+energy*.12,
      peak:.16+energy*.17,
    }[look]:0;
    base=audible?base+(target-base)*(1-Math.exp(-step/(target>base?.35:.7))):0;
    bases.push(base);lookTrack.push(look);
  }
  const times=[],accents=[],decays=[];let last=-Infinity,barIndex=0;index=0;
  for(const [i,time] of beats.entries()) {
    while(index+1<passages.length&&passages[index+1].start<=time)index++;
    while(barIndex<downbeats.length&&downbeats[barIndex]<time-.03)barIndex++;
    const onBar=Math.abs((downbeats[barIndex]??Infinity)-time)<=.03;
    const section=passages[index],look=section.look;
    if(rms(time-.08,time+.08)<=.003)continue;
    const energy=clamp(rms(time-.25,time+.25)/ceiling);
    const impact=impacts[i],groove=look!=='held'&&grooves[i];
    const threshold=look==='held'?.75:look==='flow'?(onBar?.16:.3):look==='lift'?.22:.14;
    const spacing=look==='held'?1.5:look==='flow'?.28:look==='lift'?.24:.22;
    if((impact<threshold&&!groove)||time-last<spacing||energy<.15)continue;
    // Accent hierarchy, not an identical flash on every beat. A weak beat
    // keeps the groove alive without competing with a downbeat or strong hit.
    const weight=clamp(Math.max(impact,groove?.32:0));
    const profile=musicStyleAt(musicStyle,time);
    const strength=profile.drive*(look==='held'?.12:look==='flow'?.15+weight*.27:look==='lift'?.2+weight*.3:.27+weight*.36);
    times.push(time);accents.push(Math.min(.7,strength*(onBar?1.14:look==='flow'&&i%2===1?.72:1)));decays.push(profile.decay*(look==='held'?.5:look==='flow'?.17:look==='lift'?.16:.13));last=time;
  }
  return {version:3,step,bases,lookTrack,passages,times,accents,decays,decay:.25};
}
function eventAt(arrangement,time) {
  let lo=0,hi=arrangement.times.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(arrangement.times[mid]<=time)lo=mid+1;else hi=mid;}
  return lo-1;
}
export function arrangementMotionAt(arrangement,time) {
  const index=eventAt(arrangement,time);
  return index<0?0:clamp(arrangement.accents[index]/.55)*Math.exp(-(time-arrangement.times[index])/(arrangement.decays?.[index]??.22));
}
export function arrangementLevelAt(arrangement,time) {
  const position=Math.max(0,time)/arrangement.step;
  const index=Math.min(arrangement.bases.length-1,Math.floor(position));
  const interpolated=arrangement.bases[index]+(arrangement.bases[Math.min(index+1,arrangement.bases.length-1)]-arrangement.bases[index])*(position-Math.floor(position));
  if(interpolated===0)return 0;
  const event=eventAt(arrangement,time);
  const accent=event<0?0:arrangement.accents[event]*Math.exp(-(time-arrangement.times[event])/(arrangement.decays?.[event]??arrangement.decay));
  return clamp(interpolated+accent);
}
