import {choreographColors} from './color-choreography.js';
import {songPaletteAt} from './song-palette.js';
import {planShowScore,SHOW_SCORE_VERSION} from './show-score.js';
import {arrangementLevelAt} from './show-arrangement.js';
export const SHOW_PROFILES=['auto','show','party','disco','calm','atmospheric'];
export const movingMoodForProfile=profile=>profile==='show'||profile==='calm'||profile==='atmospheric'||profile==='disco'?profile:profile==='party'?'energetic':'balanced';
const clamp=value=>Math.max(0,Math.min(1,value));
// Apply to the original plan, never to the previous preset's output. This is
// a lighting interpretation of selected accents, not another beat detector.
export function applyShowProfile(plan,profile='auto') {
  if(!SHOW_PROFILES.includes(profile))throw Error('Unbekannte Lichtshow.');
  if(profile==='show')return showProfile(plan);
  if(profile==='calm'||profile==='atmospheric'){
    const atmospheric=profile==='atmospheric',source=plan.arrangement;
    const arrangement=source?{...source,bases:source.bases.map(v=>v*(atmospheric?.9:.75)),accents:source.accents.map(v=>v*(atmospheric?.4:.5)),decays:source.times.map((_,i)=>(source.decays?.[i]??source.decay??.25)*(atmospheric?3:2))}:null;
    const minimum=plan.beatTiming?.minimum??0,maximum=plan.beatTiming?.maximum??100;
    const frames=(plan.choreographyBaseFrames||plan.frames).map((frame,i)=>({...frame,dimming:frame.state===false||frame.dimming===0?0:Math.round(arrangement?minimum+arrangementLevelAt(arrangement,i*plan.step)*(maximum-minimum):frame.dimming*(atmospheric?.85:.7))}));
    return {...plan,showProfile:profile,frames,choreographyBaseFrames:frames,colorEvents:[],...(arrangement?{arrangement,beatTiming:{...plan.beatTiming,accents:arrangement.accents}}:{})};
  }
  if(profile==='auto'||!plan.arrangement)return plan;
  const source=plan.arrangement,disco=profile==='disco';
  const lookAt=time=>source.lookTrack[Math.min(source.lookTrack.length-1,Math.floor(time/source.step))];
  const active=time=>['flow','lift','peak'].includes(lookAt(time));
  const arrangement={...source,
    bases:source.bases.map((value,i)=>active(i*source.step)&&value>0?(disco?Math.min(.6,value+.10):value*.92):value),
    accents:source.accents.map((value,i)=>active(source.times[i])?Math.min(.85,value*(disco?.85:1.2)):value),
    decays:source.times.map((time,i)=>(source.decays?.[i]??source.decay)*(active(time)?disco?1.25:.92:1)),
  };
  const {minimum,maximum}=plan.beatTiming;
  let event=-1,previous;
  const frames=plan.frames.map((frame,i)=>{
    const time=i*plan.step;
    while(event+1<source.times.length&&source.times[event+1]<=time)event++;
    let rgb=[frame.r,frame.g,frame.b];
    // Do not turn silence, held passages or a sustained pad into a color chase.
    const moving=active(time)&&source.bases[Math.min(source.bases.length-1,Math.floor(time/source.step))]>0&&event>=0&&time-source.times[event]<1;
    if(moving) {
      // Saturate the underlying contour; beat-aligned color pairs are
      // applied separately below and held between their selected events.
      const top=Math.max(...rgb),bottom=Math.min(...rgb);
      const amount=disco?(lookAt(time)==='peak'?.55:.4):.25;
      rgb=rgb.map(value=>clamp((value-bottom*amount)/Math.max(1,top-bottom*amount))*255);
    }
    const rate=1-Math.exp(-plan.step/(disco?.09:.16));
    previous=!previous||!moving?rgb:previous.map((value,c)=>value+(rgb[c]-value)*rate);
    return {...frame,r:Math.round(previous[0]),g:Math.round(previous[1]),b:Math.round(previous[2]),
      dimming:Math.round(minimum+arrangementLevelAt(arrangement,time)*(maximum-minimum))};
  });
  return choreographColors({...plan,choreographyBaseFrames:frames,showProfile:profile,arrangement,frames,beatTiming:{...plan.beatTiming,accents:arrangement.accents}},profile);
}


// One score drives held color pictures, intensity accents and moving formations.
// Original timing and palettes survive switching back to another profile.
function showProfile(plan){
 const source=plan.arrangement;
 if(!source)return {...plan,showProfile:'show'};
 const scenes=planShowScore(plan),bars=plan.beatGrid?.downbeats||[],selected=new Set(),cues=[];
 let last=-Infinity,ordinal=0,previousScene=-1;
 for(let i=0;i<source.times.length;i++){
  const time=source.times[i],scene=scenes.find(s=>time>=s.start&&time<s.end);
  if(!scene||['silence','held'].includes(scene.role)||(source.accents[i]??0)<.18)continue;
  if(!(source.bases[Math.min(source.bases.length-1,Math.floor(time/source.step))]>0))continue;
  const prominent=(source.eventSalience?.[i]??0)>=scene.accentThreshold;
  const entrance=scene.index!==previousScene;
  const beats=plan.beatGrid?.beats||[];
  const nextIndex=beats.findIndex(t=>t>time+.045);
  const beatLength=nextIndex>0?Math.max(.2,Math.min(1.5,beats[nextIndex]-beats[nextIndex-1])):.5;
  const onBar=bars.some(t=>Math.abs(t-time)<.045);
  const drivingBeat=scene.rhythmic&&beats.some(t=>Math.abs(t-time)<.045);
  if((!prominent&&!entrance&&!onBar)||time-last<(prominent?beatLength*.8:Math.max(.7,beatLength*1.5)))continue;
  if(entrance)ordinal=0;
  const palette=songPaletteAt(plan,time)||plan.colorPalette||[[plan.frames[0].r,plan.frames[0].g,plan.frames[0].b]];
  const primary=palette[Math.abs(scene.motif??0)%palette.length];
  const distance=c=>c.reduce((sum,v,k)=>sum+Math.abs(v-primary[k]),0);
  let contrast=palette.reduce((best,c)=>distance(c)>distance(best)?c:best,primary);
  if(distance(contrast)<180&&plan.effectiveOptions?.palette!=='custom')contrast=primary.map(v=>Math.max(12,255-v));
  const phase=ordinal++%2,color=scene.color?contrast:primary;
  const actionEnd=nextIndex>=0?beats[nextIndex+(scene.role==='build'?2:drivingBeat?0:1)]:undefined;
  cues.push({time,end:scene.end,r:color[0],g:color[1],b:color[2],section:scene.sectionIndex,
   action:scene.role==='build'?'launch':entrance||prominent?'hit':'answer',phase,contrast:scene.color?primary:contrast,
   actionDuration:Math.max(.2,(actionEnd??time+beatLength*(scene.role==='build'?3:drivingBeat?1:2))-time),
   surface:scene.featured?'ceiling':'wall',formation:scene.form,picture:scene.index,strength:clamp(source.eventSalience?.[i]??source.accents[i])});
  selected.add(i);last=time;previousScene=scene.index;
 }
 const arrangement={...source,presentation:'show',
  bases:source.bases.map((value,i)=>{
   const scene=scenes.find(s=>i*source.step>=s.start&&i*source.step<s.end);
   return !value||!scene||['silence','held'].includes(scene.role)?value:value*(scene.role==='arrival'?.3:.55);
  }),
  accents:source.accents.map((value,i)=>selected.has(i)?Math.min(1,.4+value*.65):value*.55),
  decays:source.times.map((_,i)=>selected.has(i)?.18+.12*(1-clamp(source.eventSalience?.[i]??source.accents[i])):source.decays?.[i]??source.decay??.25)};
 const minimum=plan.beatTiming?.minimum??0,maximum=plan.beatTiming?.maximum??100;
 let at=-1;
 const soundPalettes=[],frames=plan.frames.map((frame,i)=>{
  const time=i*plan.step;while(at+1<cues.length&&cues[at+1].time<=time)at++;
  const cue=cues[at],active=cue&&time<cue.end;
  const color=active?[cue.r,cue.g,cue.b]:[frame.r,frame.g,frame.b];
  soundPalettes.push([color]);
  return {...frame,r:color[0],g:color[1],b:color[2],dimming:frame.state===false||frame.dimming===0?0:Math.round(minimum+arrangementLevelAt(arrangement,time)*(maximum-minimum))};
 });
 return {...plan,showProfile:'show',showScoreVersion:SHOW_SCORE_VERSION,showScore:scenes,showCues:cues,directionActive:false,arrangement,frames,choreographyBaseFrames:frames,
  soundPalettes,colorEvents:cues,beatTiming:plan.beatTiming?{...plan.beatTiming,accents:arrangement.accents}:plan.beatTiming};
}
