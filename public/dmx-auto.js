import {activityAt} from './dmx-activity.js';
import {passageIntensity} from './stage-motifs.js';
import {stagePatch} from './dmx-model.js';
export const colorCount=value=>[1,2,3,4].includes(value)?value:2;
export const STAGE_PRESETS={
  auto:{name:'Automatische Lichtshow',help:'Farben, Bewegung und Lichtpausen folgen der Musik. Gezielte Aufbauten und Rücknahmen gestalten besondere Passagen.'},
  chase:{name:'Lauflicht',help:'Eine weiche Lichtwelle wandert im Beat von Gerät zu Gerät. Farben und Helligkeit folgen deiner Show.'},
  wash:{name:'Ruhige Farbflächen',help:'Für Warm-up und Hintergrundlicht: Die Helligkeit folgt dem langsamen Verlauf der Show, ohne zusätzliche Beat-Impulse.'},
  follow:{name:'Musikimpulse gemeinsam',help:'Alle Geräte übernehmen die Helligkeit der vorbereiteten Show gleichzeitig, in deinen Bühnenfarben. Keine zusätzliche Blinkkurve.'},
  alternate:{name:'Gruppenwechsel',help:'Zwei verschachtelte Gerätegruppen wechseln alle vier erkannten Beats. Ruhige Passagen und Musik ohne Beat-Raster bleiben gemeinsam beleuchtet.'},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const quiet=look=>/held|quiet|break|outro/.test(look||'');
function rgbHue(rgb){
  const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
  const hue=!d?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:hue/6,s:max?d/max:0,v:max};
}
function hsv(h,s,v){
  h=((h%1)+1)%1*6;
  const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;
  return [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)].map(n=>Math.round(n+m));
}
export function automaticPalette(frame,count,look,sourcePalette=null){
  count=colorCount(count);
  const rgb=['r','g','b'].map(k=>clamp(Number.isFinite(frame?.[k])?frame[k]:0,0,255));
  if(count===1)return [rgb];
  if(Array.isArray(sourcePalette)&&sourcePalette.length&&sourcePalette.every(c=>Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))){
    const ordered=[...sourcePalette].sort((a,b)=>a.reduce((s,v,i)=>s+(v-rgb[i])**2,0)-b.reduce((s,v,i)=>s+(v-rgb[i])**2,0));
    return Array.from({length:count},(_,i)=>i===0?rgb:[...ordered[Math.round(i*(ordered.length-1)/(count-1))]]);
  }
  const {h,s,v}=rgbHue(rgb);
  // A shared harmonic palette follows the source show, never a free-running rainbow.
  const offsets=quiet(look)?[0,.08,-.08,.16]:count===2?[0,.5]:count===3?[0,1/3,2/3]:[0,.08,.5,.58];
  return offsets.slice(0,count).map((offset,i)=>i===0?rgb:hsv(h+offset,Math.max(s,.55),v));
}
// Musical density is a ceiling, not a requirement to keep every color visible.
// The existing prepared song sections decide the role before playback.
export function automaticColorCount(limit,look,progress=0){
  limit=colorCount(limit);
  if(quiet(look))return 1;
  if(look==='peak')return limit;
  if(look==='lift')return Math.min(limit,1+Math.floor(clamp(progress,0,1)*(limit-1)));
  return Math.min(limit,2);
}
const colorLayouts=new WeakMap();
function colorLayoutAt(source){
  const plan=source.movingPlan,time=source.songTime;
  if(!plan||!Number.isFinite(time))return 0;
  let times=colorLayouts.get(plan);
  if(!times){
    // Follow existing musical color decisions, never an eight-beat rotation.
    // Accent/return pairs change hue briefly, not the spatial organization.
    times=plan.colorDirection?.events?.filter(e=>!['musical-accent','return'].includes(e.reason)).map(e=>e.time);
    if(!times?.length)times=(plan.sections||[]).map(s=>s.start);
    colorLayouts.set(plan,times);
  }
  let lo=0,hi=times.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(times[mid]<=time)lo=mid+1;else hi=mid;}
  return Math.max(0,lo-1);
}
export function spatialColorSlots(source,units,count){
  return slotsForLayout(colorLayoutAt(source),units,count);
}
function slotsForLayout(layout,units,count){
  if(units<4)return Array.from({length:units},(_,i)=>(i+layout)%count);
  // Two-color base formations stay balanced. Cycle all three pairings only
  // at musical color decisions; no fixture keeps a long-lived solo color.
  if(count===2){
    const pairs=[[0,1,0,1],[0,0,1,1],[0,1,1,0]];
    return Array.from({length:units},(_,i)=>(pairs[layout%3][i%4]+Math.floor(layout/3))%2);
  }
  // Change which fixtures share a color, not just A/B within fixed pairs.
  const orders=[[0,1,2,3],[0,2,1,3],[0,1,3,2],[0,2,3,1]];
  const order=orders[layout%orders.length];
  return Array.from({length:units},(_,i)=>{
    return (Math.floor(i/4)*4+order[i%4]+Math.floor(layout/4))%count;
  });
}
function blendSpatialColor(a,b,mix){
  const rgb=a.map((v,i)=>v*(1-mix)+b[i]*mix),peak=Math.max(...rgb);
  const value=Math.max(...a)*(1-mix)+Math.max(...b)*mix;
  // Complementary colors must not produce a brightness dip while travelling.
  return rgb.map(v=>Math.round(peak?v*value/peak:0));
}
const rollingCache=new WeakMap();
const ease=x=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
// Only measured, driving bounce/sweep phrases carry a travelling palette.
// Pair selected attacks into steps; a beat grid alone never animates colors.
export function spatialColors(source,units,palette){
  const count=palette.length,slots=spatialColorSlots(source,units,count);
  let base=slots.map(i=>palette[i]);
  // A musical layout change is a short dissolve, not a simultaneous hard swap.
  const layout=colorLayoutAt(source),boundaries=colorLayouts.get(source.movingPlan);
  const age=source.songTime-(boundaries?.[layout]??-Infinity);
  if(layout>0&&age>=0&&age<.65){
    const previous=slotsForLayout(layout-1,units,count),mix=ease(age/.65);
    base=base.map((rgb,i)=>blendSpatialColor(palette[previous[i]],rgb,mix));
  }
  const plan=source.movingPlan,time=source.songTime;
  if(count<2||units<2||!plan||!Number.isFinite(time)||quiet(source.look))return base;
  let phrases=rollingCache.get(plan);
  if(!phrases){
    const a=plan.arrangement;
    phrases=(a?.patterns?.phrases||[]).filter(p=>['bounce','sweep'].includes(p.kind)&&
      p.movement?.character==='rhythmic'&&p.movement.driving>=.6&&p.movement.rate>=1.2&&
      !(p.attention?.leader==='vocals'&&p.attention.confidence>=.5)).map(p=>({...p,
        times:(a.times||[]).filter((t,i)=>t>=p.start&&t<p.end&&a.patterns.events?.[i]?.driving)}));
    rollingCache.set(plan,phrases);
  }
  const phrase=phrases.find(p=>time>=p.start&&time<p.end);
  if(!phrase||phrase.times.length<4)return base;
  const times=phrase.times;
  let lo=0,hi=times.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(times[mid]<=time)lo=mid+1;else hi=mid;}
  const event=lo-1;
  if(event<0)return base;
  const last=times[event],next=times[event+1];
  // Let a genuine musical gap settle back instead of free-running through it.
  const amount=ease((time-phrase.start)/.5)*ease((phrase.end-time)/.5)*
    (event>0&&last-times[event-1]>.85?ease((time-last)/.3):1)*
    (next!==undefined&&next-last<=.85?1:1-ease((time-last-.15)/.5));
  const anchor=event-event%2,step=anchor/2;
  // Travel for the entire measured two-attack step. A fixed short fade
  // finishes early and produces a rhythmic freeze before the next step.
  const end=times[anchor+2]??phrase.end;
  const mix=ease((time-times[anchor])/Math.max(.01,end-times[anchor]));
  const slot=(i,shift)=>count===2?Math.floor(((i+shift)%4)/2):(i+shift)%count;
  return base.map((rgb,i)=>blendSpatialColor(rgb,
    blendSpatialColor(palette[slot(i,step)],palette[slot(i,step+1)],mix),amount));
}
export function automaticStage(streams,count=2,equipment,mode='auto'){
  const chase=mode==='chase';
  const simple=['wash','follow','alternate'].includes(mode);
  const patch=stagePatch(equipment),units=patch.reduce((n,f)=>n+f.cells,0);
  count=Math.min(colorCount(count),units);
  const active=streams.filter(s=>s.frame&&s.frame.state!==false&&Number.isFinite(s.weight)&&s.weight>0);
  const total=active.reduce((sum,s)=>sum+s.weight,0);
  if(!total||!units)return {frames:patch.map(f=>Array.from({length:f.cells},()=>null)),palette:[],description:'Wartet auf Musik oder Demo.'};
  const main=active.reduce((a,b)=>a.weight>=b.weight?a:b),beat=Number.isFinite(main.motionBeat)?main.motionBeat:Number.isFinite(main.beat)?main.beat:null;
  const requested=count;
  const counts=active.map(s=>automaticColorCount(requested,s.look,s.sectionProgress));
  // Each deck may deliberately repeat colors. Preserve both shows in a transition.
  count=Math.max(...counts);
  // The prepared frame already contains musical color events and user edits.
  // A motif's opening color must not freeze that live color for the section.
  const palettes=active.map((s,k)=>{const p=automaticPalette(s.frame,counts[k],s.look,s.palette);return Array.from({length:count},(_,i)=>p[i%p.length]);});
  // Blend colors per palette slot before distributing them: at most N color
  // families remain on stage, including while two decks crossfade.
  const palette=Array.from({length:count},(_,i)=>[0,1,2].map(c=>Math.round(active.reduce((sum,s,k)=>sum+palettes[k][i][c]*s.weight,0)/total)));
  const level=active.reduce((sum,s)=>sum+clamp(s.frame.dimming||0,0,100)*passageIntensity(s.look,s.sectionProgress)*s.weight,0)/total;
  // Spots and bar pixels each get a complete formation, so a long bar cannot
  // consume the active slots intended for the spotlights.
  const spots=patch.filter(f=>f.profile==='dimmer-rgb').length;
  const spotColors=mode==='auto'?spatialColors(main,spots,palette):null;
  const barColors=mode==='auto'?patch.map(f=>f.profile==='rgb-pixels'?spatialColors(main,f.cells,palette):null):[];
  const activity=mode==='auto'?active.map(s=>({spots:activityAt(s,spots),bars:patch.map(f=>f.profile==='rgb-pixels'?activityAt(s,f.cells):null)})):[];
  const calm=quiet(main.look)||mode==='auto'&&main.motionCharacter==='atmospheric',peak=main.look==='peak',build=main.look==='lift';
  const rotation=mode!=='auto'&&!simple&&beat!==null&&!calm?Math.floor(beat/8)%count:0;
  let ordinal=0,spotIndex=-1;
  const frames=patch.map((fixture,index)=>{
    if(fixture.profile==='dimmer-rgb')spotIndex++;
    return Array.from({length:fixture.cells},(_,cell)=>{
      const cellOrdinal=ordinal,position=ordinal/units;
      const slot=(ordinal+rotation)%count;
      ordinal++;
      const [r,g,b]=mode==='auto'?(fixture.profile==='dimmer-rgb'?spotColors[spotIndex]:barColors[index][cell]):palette[slot];
      // Explicit presets retain their own choreography.
      const dimming=simple?active.reduce((sum,s)=>{
        const source=clamp(s.frame.dimming||0,0,100);
        const base=mode==='wash'&&source>0&&Number.isFinite(s.washDimming)?clamp(s.washDimming,0,100):source;
        const b=Number.isFinite(s.beat)?s.beat:null;
        const group=b===null?0:((Math.floor(b/4)%2)+2)%2;
        const lit=mode!=='alternate'||units===1||quiet(s.look)||b===null||cellOrdinal%2===group;
        return sum+(lit?base:0)*s.weight;
      },0)/total:chase?active.reduce((sum,s)=>{
        const b=Number.isFinite(s.motionBeat)?s.motionBeat:Number.isFinite(s.beat)?s.beat:null;
        const p=clamp(Number.isFinite(s.sectionProgress)?s.sectionProgress:0,0,1);
        let strength=1;
        if(b!==null&&!quiet(s.look)){
          const period=s.look==='peak'?2:s.look==='lift'?4:8;
          const phase=((b/period)%1+1)%1;
          const wave=(1+Math.cos(2*Math.PI*(phase-position)))/2;
          const rest=s.look==='peak'?.4:s.look==='lift'?.5-.3*p:.05;
          const envelope=clamp((wave-rest)/(1-rest),0,1);
          strength=envelope*envelope*(3-2*envelope);
        }
        return sum+clamp(s.frame.dimming||0,0,100)*passageIntensity(s.look,s.sectionProgress)*strength*s.weight;
      },0)/total:mode==='auto'?active.reduce((sum,s,k)=>{
        const exposure=fixture.profile==='dimmer-rgb'?activity[k].spots[spotIndex]:activity[k].bars[index][cell];
        return sum+clamp(s.frame.dimming||0,0,100)*passageIntensity(s.look,s.sectionProgress)*exposure*s.weight;
      },0)/total:level;
      return {state:true,r,g,b,dimming};
    });
  });
  return {frames,palette,description:`${count===1?'Eine gemeinsame Farbe':`${count} Farben`} · `+(simple?STAGE_PRESETS[mode].help:chase&&beat!==null&&!calm?'Lauflicht · eine weiche Lichtwelle wandert im Beat über die Bühne.':beat===null?'Farben folgen der Musik · ohne Beat-Raster keine Laufbewegung.':calm?'Ruhige Passage · getragenes Licht und gezielte Rücknahmen.':peak?'Kräftige Passage · Kontrastfarben und rhythmische Wechsel.':build?'Aufbau · die Lichtbewegung wird dichter.':'Fließende Passage · gemeinsames Licht folgt der Musik.')};
}
