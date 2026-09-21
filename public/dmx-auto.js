import {passageIntensity} from './stage-motifs.js';
import {stagePatch} from './dmx-model.js';
export const colorCount=value=>[1,2,3,4].includes(value)?value:2;
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
export function automaticPalette(frame,count,look){
  count=colorCount(count);
  const rgb=['r','g','b'].map(k=>clamp(Number.isFinite(frame?.[k])?frame[k]:0,0,255));
  if(count===1)return [rgb];
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
export function automaticStage(streams,count=2,equipment){
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
  const palettes=active.map((s,k)=>{const p=automaticPalette(s.motifColor?{...s.frame,...s.motifColor}:s.frame,counts[k],s.look);return Array.from({length:count},(_,i)=>p[i%p.length]);});
  // Blend colors per palette slot before distributing them: at most N color
  // families remain on stage, including while two decks crossfade.
  const palette=Array.from({length:count},(_,i)=>[0,1,2].map(c=>Math.round(active.reduce((sum,s,k)=>sum+palettes[k][i][c]*s.weight,0)/total)));
  const level=active.reduce((sum,s)=>sum+clamp(s.frame.dimming||0,0,100)*passageIntensity(s.look,s.sectionProgress)*s.weight,0)/total;
  const calm=quiet(main.look),peak=main.look==='peak',build=main.look==='lift';
  const progress=clamp(Number.isFinite(main.sectionProgress)?main.sectionProgress:0,0,1);
  const period=peak?2:build?8-6*progress:8;
  const phase=beat===null?0:((beat/period)%1+1)%1;
  const rotation=beat!==null&&!calm?Math.floor(beat/8)%count:0;
  let ordinal=0;
  const frames=patch.map((fixture,index)=>Array.from({length:fixture.cells},(_,cell)=>{
    const position=ordinal/units;
    const slot=(ordinal+++rotation)%count;
    let intensity=1;
    if(beat!==null&&!calm){
      const wave=(1+Math.cos(2*Math.PI*(phase-position)))/2;
      // Retain a lit background so every chosen color remains visible.
      intensity=peak?.28+.72*wave:build?.65+( .15+.2*progress)*wave:.7+.3*wave;
    }
    const [r,g,b]=palette[slot];
    return {state:true,r,g,b,dimming:level*intensity};
  }));
  return {frames,palette,description:`${count===1?'Eine gemeinsame Farbe':`${count} Farben`} · `+(beat===null?'Farben folgen der Musik · ohne Beat-Raster keine Laufbewegung.':calm?'Ruhige Passage · verwandte Farben, gehaltenes Licht.':peak?'Kräftige Passage · Kontrastfarben und rhythmische Wechsel.':build?'Aufbau · die Lichtbewegung wird dichter.':'Fließende Passage · abgestimmte Farben und weiche Lichtwellen.')};
}
