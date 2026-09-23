import {directionAt} from './color-direction.js';
// An artistic mapping of measured timbre, not a claim that music has an objective color.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const value=(v,fallback)=>Number.isFinite(v)?clamp(v):fallback;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function hsv(h,s){
 h=((h%1)+1)%1*6;
 const x=1-Math.abs(h%2-1);
 return [[1,x,0],[x,1,0],[0,1,x],[0,x,1],[x,0,1],[1,0,x]][Math.floor(h)].map(v=>Math.round(255*(1-s+v*s)));
}
function describe(windows,start=0,end=windows.length){
 let n=0;const sum=[0,0,0,0];
 for(let i=start;i<end;i++){
  const w=windows[i];if(!w||!(w.rms>.003))continue;
  const bass=value(w.bands?.[0],.2),high=value((w.bands?.[3]??0)+(w.bands?.[4]??0),.2);
  const tone=value(w.tone,.5),texture=value(w.flatness,0);
  const tonal=value(Math.max(w.leadConfidence??0,w.harmonicConfidence??0,w.tonality??0),0);
  [bass,high,tone,texture*.6+(1-tonal)*.4].forEach((v,k)=>sum[k]+=v);n++;
 }
 return n?sum.map(v=>v/n):null;
}
function palette(d){
 const [bass,high,tone,texture]=d;
 const hue=.04+.42*tone+.23*high-.18*bass+.12*texture;
 const spread=.06+.24*high+.18*texture+.12*Math.abs(high-bass);
 const saturation=clamp(.9-.25*texture+.08*bass);
 return [0,spread*.45,-spread*.65,spread*(1.1+.5*texture)].map((offset,i)=>hsv(hue+offset,clamp(saturation-i*.025)));
}
export function songPalettes(windows,sections,fallback){
 const song=describe(windows);
 if(!song)return sections.map(()=>fallback.map(c=>[...c]));
 return sections.map(s=>{
  const local=describe(windows,Math.max(0,Math.floor(s.start/.02)),Math.min(windows.length,Math.ceil(s.end/.02)));
  // Absolute timbre retains differences between songs; section evidence evolves the palette.
  return palette(local?mix(song,local,.65):song);
 });
}
export function songPaletteAt(plan,time){
 const edit=plan?.sectionLighting?.find(s=>time>=s.start&&time<s.end);
 if(edit?.palette)return edit.palette;
 if(plan?.effectiveOptions?.palette==='custom')return plan.colorPalette;
 if(plan?.directionActive){
  const colors=directionAt(plan.colorDirection,time);
  if(edit&&edit.movement<1){const anchor=directionAt(plan.colorDirection,edit.start);return colors.map((rgb,i)=>rgb.map((v,c)=>Math.round(anchor[i][c]*(1-edit.movement)+v*edit.movement)));}
  return colors;
 }
 const palettes=plan?.soundPalettes;
 if(!palettes?.length)return null;
 return palettes[Math.max(0,Math.min(palettes.length-1,Math.floor(time/plan.step)))];
}
