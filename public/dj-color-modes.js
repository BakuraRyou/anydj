import {applyColorDirection,legacyColorDirection} from './color-direction.js';
import {choreographColors} from './color-choreography.js';
export const COLOR_MODES=[
 {id:'auto',name:'Songanalyse · Farbdramaturgie',category:'Automatisch',colors:[]},
 {id:'legacy-auto',name:'Songanalyse · Bisherige Farben (Vergleich)',category:'Automatisch',colors:[]},
 {id:'sunset',name:'Sonnenuntergang',category:'Warm',colors:['#ff7700','#ff0080','#7400ff']},
 {id:'fire',name:'Feuer',category:'Warm',colors:['#ff1800','#ffbf00']},
 {id:'ocean',name:'Ozean',category:'Kühl',colors:['#003cff','#00ffd0']},
 {id:'ice',name:'Eisblau',category:'Kühl',colors:['#0077ff','#c4ffff']},
 {id:'neon',name:'Neon',category:'Bunt',colors:['#ff0080','#00e5ff','#b5ff00']},
 {id:'aurora',name:'Aurora',category:'Bunt',colors:['#7400ff','#00ffa0']},
 {id:'warm-white',name:'Warmweiß',category:'Weiß',colors:['#ffce8a','#ffce8a']},
 {id:'cool-white',name:'Kaltweiß',category:'Weiß',colors:['#d9edff','#d9edff']},
];
export function validColorMode(mode){return mode&&typeof mode.id==='string'&&typeof mode.name==='string'&&mode.name.length>0&&mode.name.length<=60&&Array.isArray(mode.colors)&&mode.colors.length>=2&&mode.colors.length<=8&&mode.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c));}
export function applyTrackColors(plan,mode){
 if(mode?.id==='legacy-auto')return legacyColorDirection(plan);
 if(!validColorMode(mode))return plan.directionActive?plan:applyColorDirection(plan);
 const palette=mode.colors.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
 const frames=(plan.choreographyBaseFrames||plan.frames).map(frame=>{
  const hue=(Math.atan2(Math.sqrt(3)*(frame.g-frame.b),2*frame.r-frame.g-frame.b)/(2*Math.PI)+1)%1;
  const position=hue*(palette.length-1),i=Math.floor(position),f=position-i;
  const values=palette[i].map((v,c)=>Math.round(v*(1-f)+palette[Math.min(i+1,palette.length-1)][c]*f));
  return {...frame,r:values[0],g:values[1],b:values[2]};
 });
 return choreographColors({...plan,directionActive:false,frames,choreographyBaseFrames:frames,colorPalette:palette,colorEvents:[],effectiveOptions:{...plan.effectiveOptions,palette:'custom'}},plan.showProfile||'auto');
}
