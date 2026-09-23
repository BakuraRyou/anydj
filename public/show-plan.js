import {planColorDirection,applyColorDirection} from './color-direction.js';
import {songPalettes} from './song-palette.js';
import {choreographColors,colorFrameAt} from './color-choreography.js';
import {sectionFrameAt} from './section-lighting.js';
import {validateMusicStyle,musicStyleAt} from './music-style.js';
import {arrangeShow,arrangementLevelAt,arrangementMotionAt} from './show-arrangement.js';
import { analyzeMood, MOOD_PALETTES } from './mood-analysis.js';
import { musicalScore } from './melody-analysis.js';
import { validateBeatGrid } from './beat-grid.js';
import { automaticSettings } from './automatic-settings.js';
import { validateStructure, structureTheme, STRUCTURE_LABELS } from './song-structure.js';
// Bump whenever generated show data or its interpretation changes.
export const SHOW_PLAN_VERSION = 22;
const clamp = v => Math.max(0, Math.min(1, v));
const quantile = (sorted, p) => sorted[Math.floor((sorted.length - 1) * p)] || 0;
const colors = {
  sunset: ['#ff7700','#ff3300','#ff0080','#9d00ff'], rainbow: ['#ff2400','#ffbf00','#36ff00','#00dfff','#3333ff','#ff00cc'],
  neon: ['#ff0080','#7400ff','#00e5ff','#b5ff00'], fire: ['#ff1800','#ff6500','#ffc000','#ff0070'], ocean: ['#003cff','#00aaff','#00ffd0','#6600ff'],
};
// A stable passage keeps its color identity. Phrase boundaries permit changes
// only when the measured sound changes; beats alone are brightness events.
export function colorCuesFor(arrangement,sections,downbeats=[]) {
  if(!arrangement)return [];
  const cues=[];
  for(const [sectionIndex,section] of sections.entries()){
    if(section.look==='held')continue;
    const end=section.end??sections[sectionIndex+1]?.start??Infinity;
    const events=arrangement.times.filter(time=>time>=section.start&&time<end);
    if(!events.length)continue;
    cues.push({time:events[0],section:sectionIndex,offset:0,reason:'section'});
    const phrases=(arrangement.patterns?.phrases||[]).filter(p=>p.section===sectionIndex);
    let reference=phrases[0],offset=0,last=events[0];
    for(const phrase of phrases.slice(1)){
      const changed=Math.abs(phrase.energy-reference.energy)>=.14||Math.abs(phrase.tone-reference.tone)>=.16;
      if(!changed)continue;
      const eligible=events.filter(time=>time>=phrase.start&&time<phrase.end);
      const time=eligible.find(time=>downbeats.some(bar=>Math.abs(bar-time)<=.03))??eligible[0];
      if(time===undefined||time-last<4)continue;
      offset++;cues.push({time,section:sectionIndex,offset,reason:'sound-change'});
      reference=phrase;last=time;
    }
  }
  return cues;
}
export function compileShow(windows, duration, options, beatGrid = null, structure = null, musicStyle = null) {
  if (!windows.length || !Number.isFinite(duration) || duration <= 0) throw Error('Keine auswertbaren Audiodaten.');
  if(musicStyle!==null)musicStyle=validateMusicStyle(musicStyle,duration);
  let automatic=null;
  if(structure!==null)structure=validateStructure(structure,duration);
  if(options.arrangement==='auto') {
    const times=beatGrid?validateBeatGrid(beatGrid,duration).beats:windows.flatMap((w,i)=>w.beatSeq>(windows[i-1]?.beatSeq??0)?[i*.02]:[]);
    const chosen=options.palette==='custom'?{palette:'custom',colorA:options.colorA,colorB:options.colorB}:{};
    automatic=automaticSettings(windows,options,times);options={...options,...automatic.options,...chosen};
  }
  const sorted = windows.map(l => l.rms).sort((a,b)=>a-b);
  const ceiling = Math.max(0.015, quantile(sorted, 0.95));
  const prefix = [0]; for (const l of windows) prefix.push(prefix.at(-1) + l.rms);
  const average = (start,end) => {
    const a = Math.max(0,Math.floor(start/0.02)), b = Math.min(windows.length,Math.max(a+1,Math.ceil(end/0.02)));
    return b > a ? (prefix[b]-prefix[a])/(b-a)/ceiling : 0;
  };
  const toneTrack=windows.map(l=>(l.melodyConfidence??0)>0.08 ? l.melodyTone*0.7+(l.tone??0)*0.3 : (l.tone??0.5));
  const toneSorted=[...toneTrack].sort((a,b)=>a-b),toneLow=quantile(toneSorted,0.1),toneHigh=quantile(toneSorted,0.9);
  const tonePrefix=[0];for(const value of toneTrack)tonePrefix.push(tonePrefix.at(-1)+value);
  const contour=t=>{
    const a=Math.max(0,Math.floor((t-0.16)/0.02)),b=Math.min(windows.length,Math.ceil((t+0.16)/0.02));
    return clamp(((tonePrefix[b]-tonePrefix[a])/Math.max(1,b-a)-toneLow)/Math.max(0.12,toneHigh-toneLow));
  };
  // Smooth independent sound dimensions on a common time grid. The lighting
  // envelope is arranged independently from fast spectral changes.
  const dimension = read => {
    const prefix=[0];for(const l of windows)prefix.push(prefix.at(-1)+read(l));
    return (t,radius=0.2)=>{const a=Math.max(0,Math.floor((t-radius)/0.02)),b=Math.min(windows.length,Math.ceil((t+radius)/0.02));return (prefix[b]-prefix[a])/Math.max(1,b-a);};
  };
  const bassShare=dimension(l=>l.bands?.[0]??0.2),midShare=dimension(l=>l.bands?.[2]??0.2);
  const highShare=dimension(l=>(l.bands?.[3]??0)+(l.bands?.[4]??0));
  const texture=dimension(l=>l.flatness??0),edge=dimension(l=>l.flux??0),width=dimension(l=>l.rolloff??l.tone??0.5);
  const harmonicX=dimension(l=>Math.cos((l.harmonicHue??0)*2*Math.PI)*(l.harmonicConfidence??0));
  const harmonicY=dimension(l=>Math.sin((l.harmonicHue??0)*2*Math.PI)*(l.harmonicConfidence??0));
  if(beatGrid!==null)beatGrid=validateBeatGrid(beatGrid,duration);
  const beats = beatGrid ? beatGrid.beats : []; let previousBeat=0;
  if(!beatGrid)windows.forEach((l,i)=>{if(l.beatSeq>previousBeat) beats.push(i*0.02);previousBeat=l.beatSeq;});
  const score=musicalScore(windows,duration,beats);
  const blocks=[];
  for(let t=0;t<duration;t+=2) {
    const samples=windows.slice(Math.floor(t/0.02),Math.min(windows.length,Math.ceil((t+2)/0.02)));
    const mean=key=>samples.reduce((sum,l)=>sum+(l[key]??0),0)/Math.max(1,samples.length);
    blocks.push({start:t,end:Math.min(duration,t+2),energy:average(t,t+2),tone:mean('tone'),bass:mean('bass')/ceiling,flatness:mean('flatness'),rolloff:mean('rolloff'),chroma:Array.from({length:12},(_,k)=>samples.reduce((sum,l)=>sum+(l.chroma?.[k]??0),0)/Math.max(1,samples.length))});
  }
  const energyDistribution=blocks.map(b=>b.energy).sort((a,b)=>a-b);
  const lowEnergy=quantile(energyDistribution,0.2),highEnergy=quantile(energyDistribution,0.8);
  const distance=(a,b)=>Math.abs(a.energy-b.energy)*0.5+Math.abs(a.tone-b.tone)+Math.abs(a.bass-b.bass)*0.3+Math.abs(a.flatness-b.flatness)*0.15+a.chroma.reduce((sum,v,i)=>sum+Math.abs(v-b.chroma[i]),0)*0.18;
  const typicalBass=quantile(blocks.map(b=>b.bass).sort((a,b)=>a-b),0.5);
  const rawKinds=blocks.map((block,i)=>{
    const future=blocks[i+1]?.energy??block.energy;
    return block.energy<Math.max(0.14,lowEnergy*0.8)?'Ruhig':future>block.energy+0.12?'Aufbau':typicalBass>0.05&&block.bass<typicalBass*0.7&&block.energy<highEnergy*0.9?'Ruhig':block.energy>=Math.max(0.4,highEnergy*0.92)?'Intensiv':'Fließend';
  });
  const sections=[];
  for(let i=0;i<blocks.length;i++) {
    const block=blocks[i],last=sections.at(-1);
    let kind=rawKinds[i];
    // A single two-second excursion across a loudness threshold must not
    // recolor a whole passage. Keep genuinely strong breaks and short builds.
    const nextKind=rawKinds[i+1];
    const strongChange=last&&(Math.abs(block.energy-last.energy)>0.14||Math.abs(block.tone-last.tone)>0.18);
    const strongBuild=kind==='Aufbau'&&(blocks[i+1]?.energy??block.energy)-block.energy>0.14;
    if(last&&kind!==last.kind&&kind!==nextKind&&!strongChange&&!strongBuild&&kind!=='Ruhig')kind=last.kind;
    if(last&&last.kind===kind&&distance(last,block)<0.22) {
      const length=last.end-last.start,added=block.end-block.start;
      for(const key of ['energy','tone','bass','flatness','rolloff'])last[key]=(last[key]*length+block[key]*added)/(length+added);
      last.chroma=last.chroma.map((v,k)=>(v*length+block.chroma[k]*added)/(length+added));
      last.end=block.end;
    } else sections.push({...block,kind});
  }
  // Repeated sonic sections get the same color family, rather than another
  // arbitrary turn of a color wheel. These are similarities, not verse labels.
  const motifs=[];
  for(const section of sections) {
    let motif=motifs.findIndex(m=>m.kind===section.kind&&distance(m,section)<0.2);
    if(motif<0){motif=motifs.length;motifs.push({...section});}
    section.motif=motif;
    section.arc=clamp((section.energy-lowEnergy)/Math.max(0.15,highEnergy-lowEnergy));
  }
  if(structure&&automatic) {
    const kinds={start:'Ruhig',intro:'Ruhig',verse:'Fließend',chorus:'Intensiv',bridge:'Aufbau',break:'Ruhig',inst:'Fließend',solo:'Intensiv',outro:'Ruhig',end:'Ruhig'};
    sections.splice(0,sections.length,...structure.segments.map(s=>({...s,kind:kinds[s.label],title:STRUCTURE_LABELS[s.label],motif:Object.keys(STRUCTURE_LABELS).indexOf(s.label),estimated:true})));
  }
  const arrangement=automatic?arrangeShow(windows,duration,sections,beats,beatGrid?.downbeats,musicStyle,structure?.instruments):null;
  if(arrangement)sections.forEach((section,i)=>{section.role=arrangement.passages[i].role;section.emphasis=arrangement.passages[i].emphasis;section.look=arrangement.passages[i].look;section.lookLabel=arrangement.passages[i].lookLabel;});
  const palette=(options.palette==='custom'?[options.colorA,options.colorB]:colors[options.palette]||colors.sunset).map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  // Calibrate the combined, already smoothed sound trajectory against this
  // song. Normalizing individual inputs before averaging compressed all songs
  // into the middle of the palette, especially with the default sunset colors.
  const moods=options.mood==='auto'?analyzeMood(windows,duration):[];
  const moodColors=Object.fromEntries(Object.entries(MOOD_PALETTES).map(([key,values])=>[key,values.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)))]));
  const sectionPalettes=automatic&&options.palette!=='custom'?songPalettes(windows,sections,palette):null;
  const soundPalettes=[];
  let blendedPalette=(sectionPalettes?.[0]||palette).map(rgb=>[...rgb]);
  const soundTrack=[];
  for(let t=0;t<duration;t+=0.125) {
    const hx=harmonicX(t,0.4),hy=harmonicY(t,0.4),confidence=Math.min(1,Math.hypot(hx,hy)*2);
    const harmony=(Math.atan2(hy,hx)/(2*Math.PI)+1)%1;
    const balance=clamp(0.5+(highShare(t)-bassShare(t))*0.5);
    const tonal=contour(t)*0.6+balance*0.2+width(t)*0.2;
    soundTrack.push(tonal*(1-confidence*0.3)+harmony*confidence*0.3);
  }
  const distribution=[...soundTrack].sort((a,b)=>a-b);
  const soundLow=quantile(distribution,0.08),soundHigh=quantile(distribution,0.92);
  const soundRange=soundHigh-soundLow;
  const colorDrivers=[];let melodyMix=0,lastClearTone=-Infinity;
  const decay=automatic?{calm:.38,flow:.25,pulse:.14}[automatic.kind]:.17;
  const exponent={balanced:1,sensitive:0.65,punchy:1.8}[options.dynamics]||1;
  // Use model-provided bar accents, never assume four beats per bar.
  let downbeatIndex=0;
  const accents=beats.map(time=>{
    if(!automatic || !beatGrid || beatGrid.downbeats.length<2)return 1;
    while(downbeatIndex<beatGrid.downbeats.length && beatGrid.downbeats[downbeatIndex]<time-.03)downbeatIndex++;
    return Math.abs((beatGrid.downbeats[downbeatIndex]??Infinity)-time)<=.03?1:.7;
  });
  const beatTiming={times:arrangement?arrangement.times:beats,accents:arrangement?arrangement.accents:accents,decay,exponent,intensity:options.intensity,minimum:options.minimum,maximum:options.maximum};
  const colorCues=colorCuesFor(arrangement,sections,beatGrid?.downbeats);
  let colorCueIndex=-1;
  const frames=[];let beatIndex=-1, sectionIndex=0, previousPosition, previousSaturation;
  for(let t=0;t<duration;t+=0.125) {
    while(beatIndex+1<beats.length&&beats[beatIndex+1]<=t) beatIndex++;
    while(sectionIndex+1<sections.length&&sections[sectionIndex+1].start<=t) sectionIndex++;
    const pulse=beatIndex<0?0:accents[beatIndex]*Math.exp(-Math.max(0,t-beats[beatIndex])/decay);
    const section=sections[sectionIndex],kind=section.kind;
    const theme=structure&&automatic?structureTheme(section.label):null;
    const strength=arrangement?arrangementLevelAt(arrangement,t):clamp(pulse*options.intensity/1.5)**exponent;
    const style=musicStyleAt(automatic?musicStyle:null,t);
    const toneWeight=options.toneFollow??0.8;
    const raw=soundTrack[frames.length];
    // Keep static sounds static: a near-zero range must not amplify FFT noise.
    const soundColor=soundRange>0.06?clamp((raw-soundLow)/soundRange):clamp(raw);
    // Blend the section identity into the contour without losing its endpoints.
    const motif=(section.motif%palette.length)/Math.max(1,palette.length-1);
    const shaped=clamp(soundColor+(motif-0.5)*(1-toneWeight)*4*soundColor*(1-soundColor));
    const follow=clamp(toneWeight/0.8);
    const musical=score?.track[Math.min(score.track.length-1,Math.floor(t/score.step))];
    // A melody estimate is additional evidence, not a replacement for the
    // whole mix. Bridge short detection gaps; fade back to spectral color for
    // longer uncertain passages instead of freezing through audible music.
    if(musical?.confidence>=.35)lastClearTone=t;
    const desiredMix=musical?.confidence>=.35?clamp((musical.confidence-.18)/.52):t-lastClearTone<.3?melodyMix:0;
    melodyMix+=(desiredMix-melodyMix)*(1-Math.exp(-.125/(desiredMix > melodyMix ? .25 : .5)));
    const contourPosition=musical?musical.position*melodyMix+shaped*(1-melodyMix):shaped;
    const audible=average(Math.max(0,t-.08),t+.08)*ceiling>.003;
    const look=section.look;
    while(colorCueIndex+1<colorCues.length&&colorCues[colorCueIndex+1].time<=t)colorCueIndex++;
    const cue=colorCues[colorCueIndex];
    const offset=cue?.section===sectionIndex?cue.offset:0;
    const order=palette.length===4?[0,2,1,3]:Array.from({length:palette.length},(_,i)=>i);
    const anchor=(section.motif+order[offset%order.length])%palette.length;
    const partner=(anchor+(look==='peak'?2:1))%palette.length;
    const motion=arrangement?arrangementMotionAt(arrangement,t):0;
    const progress=clamp((t-section.start)/Math.max(1,section.end-section.start));
    const span=look==='held'?.14:look==='peak'?.45:look==='lift'?.2+progress*.25:.28;
    const movement=clamp((contourPosition*.85+(look==='lift'?progress:average(t-.4,t+.4))*.15)*span*style.colorSpan+motion*(look==='peak'?.04:.015));
    const automaticPosition=anchor*(1-movement)+partner*movement;
    const target=arrangement&&audible?automaticPosition:!audible&&previousPosition!==undefined?previousPosition:(motif*(1-follow)+contourPosition*follow)*(palette.length-1);
    colorDrivers.push(!audible?'pause':arrangement?(look==='held'?'hold':'passage'):melodyMix>.7?'melody':melodyMix>.2?'blend':'spectrum');
    const transition=arrangement?1-Math.exp(-.125*style.colorSpeed/(look==='held'?1.2:look==='peak'?.35:.65)):1-Math.exp(-0.125*Math.max(0.2,options.speed*(theme?.speed??1))*(1+edge(t,0.08)*3)/(0.10+(options.smoothing??0.5)*0.45));
    // This is an ordered tonal contour, not a cyclic hue wheel: a falling note
    // must retrace the palette rather than wrap from its end to its beginning.
    previousPosition=previousPosition===undefined?target:previousPosition+(target-previousPosition)*transition;
    const huePosition=Math.max(0,Math.min(palette.length-1,previousPosition));
    const i=Math.floor(huePosition),f=huePosition%1;
    const mood=moods[Math.min(moods.length-1,Math.floor(t/2))];
    const moodPalette=moodColors[mood?.mood];
    // Blend palette anchors over seconds while preserving the independent
    // melody position and beat envelope. Uncertain estimates keep the palette.
    let targetPalette=theme?(moodPalette??palette).map((_,k)=>(moodPalette??palette)[(k+theme.rotation)%(moodPalette??palette).length]):moodPalette;
    // A narrow mood family must not erase every contrasting anchor from the
    // automatically selected palette during an energetic passage.
    if(arrangement&&look==='peak'&&targetPalette&&options.palette!=='custom'&&!sectionPalettes) {
      const center=[0,1,2].map(c=>targetPalette.reduce((sum,color)=>sum+color[c],0)/targetPalette.length);
      const distance=color=>color.reduce((sum,value,c)=>sum+(value-center[c])**2,0);
      const contrast=palette.reduce((best,color)=>distance(color)>distance(best)?color:best,palette[0]);
      targetPalette=targetPalette.map((color,k)=>k===targetPalette.length-1?contrast:color);
    }
    if(sectionPalettes)targetPalette=sectionPalettes[sectionIndex];
    else if(options.palette==='custom')targetPalette=null;
    if(targetPalette && audible)for(let k=0;k<palette.length;k++) {
      const pos=k/(palette.length-1)*(targetPalette.length-1),lo=Math.floor(pos),part=pos-lo;
      for(let c=0;c<3;c++) {
        const value=targetPalette[lo][c]*(1-part)+targetPalette[Math.min(lo+1,targetPalette.length-1)][c]*part;
        blendedPalette[k][c]+=(value-blendedPalette[k][c])*(1-Math.exp(-.125/2));
      }
    }
    const rgb=blendedPalette[i].map((v,c)=>v+(blendedPalette[Math.min(i+1,palette.length-1)][c]-v)*f);
    // Preserve the chosen saturation. Texture provides only a small accent,
    // rather than adding a large white component to every musical passage.
    const richness=clamp(0.95+midShare(t)*0.1-texture(t)*0.12);
    const targetSaturation=options.saturation/100*richness*(theme?.saturation??1);
    previousSaturation=previousSaturation===undefined?targetSaturation:previousSaturation+(targetSaturation-previousSaturation)*transition;
    const saturation=previousSaturation, top=Math.max(1,...rgb);
    const [r,g,b]=rgb.map(v=>Math.max(1,Math.round(v/top*255*saturation+255*(1-saturation))));
    if(sectionPalettes)soundPalettes.push(blendedPalette.map(color=>{const peak=Math.max(1,...color);return color.map(v=>Math.round(v/peak*255*saturation+255*(1-saturation)));}));
    frames.push({state:true,dimming:Math.round(options.minimum+strength*(options.maximum-options.minimum)),r,g,b});
  }
  const legacy=choreographColors({version: SHOW_PLAN_VERSION,colorPalette:palette,soundPalettes,colorCues,arrangement,beatTiming,moods,score,colorDrivers,duration,step:0.125,frames,sections,beats:beats.length,beatGrid,automatic,effectiveOptions:options,structure,musicStyle});
  if(!automatic||options.palette==='custom')return legacy;
  const colorDirection=planColorDirection(windows,legacy);
  return applyColorDirection({...legacy,colorDirection,legacyColors:{frames:legacy.frames,choreographyBaseFrames:legacy.choreographyBaseFrames,colorEvents:legacy.colorEvents,soundPalettes:legacy.soundPalettes}});
}
export function showFrameAt(plan,time) {
  if(!Number.isFinite(time)) throw Error('Ungültige Wiedergabezeit.');
  const index=Math.max(0,Math.min(plan.frames.length-1,Math.floor(time/plan.step)));
  const frame=sectionFrameAt(plan,Math.max(0,Math.min(time,plan.duration-1e-6)),colorFrameAt(plan,Math.max(0,Math.min(time,plan.duration-1e-6)),plan.frames[index]));
  if(!plan.beatTiming)return frame; // Saved plans from older versions retain their rendering.
  const t=time>=plan.duration?index*plan.step:Math.max(0,time);
  const {times,accents,decay,exponent,intensity,minimum,maximum}=plan.beatTiming;
  if(plan.arrangement)return {...frame,dimming:Math.round(minimum+arrangementLevelAt(plan.arrangement,t)*(maximum-minimum))};
  let lo=0,hi=times.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(times[mid]<=t)lo=mid+1;else hi=mid;}
  const pulse=lo===0?0:(accents?.[lo-1]??1)*Math.exp(-(t-times[lo-1])/decay);
  return {...frame,dimming:Math.round(minimum+clamp(pulse*intensity/1.5)**exponent*(maximum-minimum))};
}
export function transitionFrame(from,to,time,progress) {
  const next=showFrameAt(to,time),previous=showFrameAt(from,time),f=clamp(progress);
  return {...next,...Object.fromEntries(['r','g','b','dimming'].map(key=>[key,Math.round(previous[key]*(1-f)+next[key]*f)]))};
}
