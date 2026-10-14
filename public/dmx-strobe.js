import {strobeRole,strobeRoleColor} from './dmx-strobe-motifs.js';
import {strobeScoreAt,strobeComposition} from './dmx-strobe-score.js';
import {lightingScenes,lightingSceneAt} from './dmx-light-scenes.js';
import {musicalDarknessAt} from './dmx-activity.js';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const fract=v=>((v%1)+1)%1;
const wave=v=>(1+Math.cos(2*Math.PI*v))/2;
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
// Twenty spatial scores, each with a distinct ordering or temporal envelope.
// Coordinates are normalized separately for fixtures and for each pixel bar.
const patterns=[
 ['together','Gemeinsam',(x,i,n,t)=>[0,1]],
 ['forward','Vorwärts',(x,i,n,t)=>[x,1]],
 ['backward','Rückwärts',(x,i,n,t)=>[-x,1]],
 ['centre','Aus der Mitte',(x,i,n,t)=>[Math.abs(x-.5)*2,1]],
 ['edges','Von außen',(x,i,n,t)=>[-Math.abs(x-.5)*2,1]],
 ['banks','Zwei Gruppen',(x,i,n,t)=>[i%2/2,1]],
 ['thirds','Drei Gruppen',(x,i,n,t)=>[i%3/3,1]],
 ['pairs','Gerätepaare',(x,i,n,t)=>[Math.floor(i/2)%2/2,1]],
 ['wings','Linker und rechter Flügel',(x,i,n,t)=>[x<.5?0:.5,1]],
 ['fold','Gefaltete Welle',(x,i,n,t)=>[Math.abs(Math.sin(x*Math.PI*2))*.75,1]],
 ['ripple','Doppelwelle',(x,i,n,t)=>[x*2,1]],
 ['pendulum','Pendel',(x,i,n,t)=>[x*Math.cos(t*Math.PI/4),1]],
 ['zipper','Reißverschluss',(x,i,n,t)=>[(i%2?1-x:x)*.75,1]],
 ['spiral','Versetzte Spirale',(x,i,n,t)=>[x+i%3/6,1]],
 ['echo','Echo',(x,i,n,t)=>[x*.5,.45+.55*wave(t/2)]],
 ['double','Doppelimpuls',(x,i,n,t)=>[x*.25,.3+.7*wave(t*2)]],
 ['answer','Frage und Antwort',(x,i,n,t)=>[i%2/2,.35+.65*wave(t/4+(x<.5?0:.5))]],
 ['comet','Komet',(x,i,n,t)=>[x,.2+.8*(1-x)]],
 ['cross','Kreuzwelle',(x,i,n,t)=>[x,.25+.75*wave(t/3-x*2)]],
 ['terraces','Terrassen',(x,i,n,t)=>[Math.floor(x*4)/4,.4+.6*wave(t/8+x)]],
];
export const STROBE_FAMILIES=Object.freeze({
 calm:{name:'Ruhe',period:16,floor:.65},
 flow:{name:'Fluss',period:8,floor:.4},
 groove:{name:'Groove',period:2,floor:.15},
 build:{name:'Aufbau',period:2,floor:.05},
 impact:{name:'Höhepunkt',period:.5,floor:0},
 outro:{name:'Ausklang',period:12,floor:.3},
});
export const STROBE_ANIMATIONS=Object.freeze(Object.entries(STROBE_FAMILIES).flatMap(([family,style])=>
 patterns.map(([key,name],pattern)=>Object.freeze({id:`${family}-${key}`,name:`${style.name} · ${name}`,family,pattern}))));
const catalog=new Map(STROBE_ANIMATIONS.map(a=>[a.id,a]));
const planned=new WeakMap();
export function strobeFamily(source,scene){
 if(source.look==='outro')return 'outro';
 if(['held','quiet','break'].includes(source.look))return 'calm';
 if(scene?.kind==='silence')return 'calm';
 if(scene?.evidence){
  if(scene.kind==='build')return 'build';
  if(scene.kind==='impact')return 'impact';
  if(scene.kind==='groove')return 'groove';
  return scene.kind==='sculpture'?'calm':'flow';
 }
 if(scene?.kind==='build'||source.look==='lift')return 'build';
 if(scene?.kind==='impact'||source.look==='peak')return 'impact';
 if(scene?.kind==='groove')return 'groove';
 if(scene?.kind==='sculpture'||source.motionCharacter==='atmospheric')return 'calm';
 return source.look==='flow'? 'flow':'calm';
}
function songAnimations(plan){
 if(planned.has(plan))return planned.get(plan);
 const selected=new Map(),uses=new Map(),motifs=new Map(),groups=new Map();let previous='';
 for(const scene of lightingScenes(plan)){
  const section=plan.sections?.[scene.sectionIndex]||{};
  const family=strobeFamily(section,scene),key=scene.motif==null?null:`${family}:${scene.motif}`;
  let animation=groups.get(`${family}:${scene.groupIndex}`)||(key&&motifs.get(key));
  if(!animation){
   const candidates=STROBE_ANIMATIONS.filter(a=>a.family===family);
   // Acoustic features establish the first choice; usage balances subsequent
   // sections. Selection never depends on rendering order, track name or time.
   const preferred=Math.floor(clamp(scene.drive*.4+scene.energy*.3+scene.tone*.2+scene.texture*.1)*19);
   animation=candidates.reduce((best,a)=>{
    const score=v=>(uses.get(v.id)||0)*25+(v.id===previous?30:0)+(v.pattern-preferred+20)%20;
    return score(a)<score(best)?a:best;
   });
   if(key)motifs.set(key,animation);
  }
  uses.set(animation.id,(uses.get(animation.id)||0)+1);previous=animation.id;selected.set(scene,animation);groups.set(`${family}:${scene.groupIndex}`,animation);
 }
 planned.set(plan,selected);return selected;
}
export function strobeAnimationAt(source){
 const scene=source.movingPlan&&Number.isFinite(source.songTime)?lightingSceneAt(source.movingPlan,source.songTime):null;
 const animation=scene?songAnimations(source.movingPlan).get(scene):catalog.get(`${strobeFamily(source)}-together`);
 return {animation,scene};
}
export function strobeLevel(animation,{beat,progress=0,index=0,units=1,flicker=100}={}){
 if(!Number.isFinite(beat))return 1;
 const style=STROBE_FAMILIES[animation.family],p=clamp(progress);
 const period=style.period;
 const t=beat/period,x=units>1?index/units:0;
 const [offset,envelope]=patterns[animation.pattern][2](x,index,units,t);
 const phase=fract(t-offset);
 let pulse;
 if(animation.family==='impact')pulse=phase<.5?1:0;
 else if(animation.family==='build')pulse=(1-p)*wave(phase)+p*(fract(beat*2-offset)<.5?1:0);
 else if(animation.family==='groove')pulse=Math.exp(-phase*5);
 else pulse=smooth(wave(phase));
 let level=style.floor+(1-style.floor)*pulse*envelope;
 if(animation.family==='build')level*=.35+.65*p;
 if(animation.family==='outro')level*=1-.85*smooth(p);
 const strength=Number.isFinite(flicker)?clamp(flicker/100):1;
 return clamp(1-strength+strength*level);
}
export function strobeGestureExposure(plan,time){
 const figure=strobeScoreAt(plan,time);
 return figure?Math.max(...Array.from({length:8},(_,i)=>strobeComposition(figure,i,8).level)):0;
}
export function renderStrobe(active,patch,{movingSource=false}={}){
 const total=active.reduce((sum,s)=>sum+s.weight,0);
 const main=active.reduce((a,b)=>a.weight>=b.weight?a:b);
 const {animation,scene}=strobeAnimationAt(main);
 const progress=scene?clamp((main.songTime-scene.start)/(scene.end-scene.start)):clamp(main.sectionProgress);
 const figure=main.movingPlan&&Number.isFinite(main.songTime)?strobeScoreAt(main.movingPlan,main.songTime):null;
 // One beat clock keeps the two decks' flashes from filling each other's gaps.
 const beat=Number.isFinite(main.beat)?main.beat:null;
 const directed=Boolean(main.movingPlan&&Number.isFinite(main.songTime));
 const sources=active.map(s=>{
  const source=Number.isFinite(s.frame.dimming)?Math.max(0,Math.min(100,s.frame.dimming)):0;
  const base=source>0&&Number.isFinite(s.washDimming)?Math.max(0,Math.min(100,s.washDimming)):source;
  return {source:s,base:base*musicalDarknessAt(s.movingPlan,s.songTime).level};
 });
 // Strong impacts are white; gentler passages retain the song's live colors.
 const flashStrength=active.reduce((sum,s)=>sum+s.weight*(Number.isFinite(s.flicker)?clamp(s.flicker/100):1),0)/total;
 const white=directed?(figure?.kind==='impact'?flashStrength*.35*clamp(main.accentStrength??0):0):animation.family==='impact'?flashStrength:animation.family==='build'?progress*.7*flashStrength:0;
 const colorWeight=sources.reduce((sum,{source:s,base})=>sum+base*s.weight,0);
 const rgb=['r','g','b'].map(k=>sources.reduce((sum,{source:s,base})=>sum+(Math.max(0,Math.min(255,s.frame[k]||0))*(1-white)+255*white)*base*s.weight,0)/Math.max(.001,colorWeight));
 const fixtures=patch.filter(f=>f.type!=='bar'&&f.profile!=='rgb-pixels');let ordinal=-1;
 const frames=patch.map(f=>{
  const bar=f.type==='bar'||f.profile==='rgb-pixels';if(!bar)ordinal++;
  return Array.from({length:f.cells},(_,cell)=>{
   const index=bar?cell:ordinal,units=bar?f.cells:fixtures.length;
   const dimming=sources.reduce((sum,{source:s,base})=>{
    const strength=Number.isFinite(s.flicker)?clamp(s.flicker/100):1;
    const shape=figure?strobeComposition(figure,index,units).level:0;
    const level=!figure&&beat===null?1:movingSource||f.type==='moving'?1:1-strength+strength*shape;
    return sum+base*s.weight*(directed?level:strobeLevel(animation,{beat,progress,index,units,flicker:s.flicker}));
   },0)/total;
   const color=figure?.motifId&&flashStrength>0?strobeRoleColor(rgb,strobeRole(index,units)):rgb;
   return {state:true,r:color[0],g:color[1],b:color[2],dimming};
  });
 });
 const first=frames.flat()[0];
 return {frames,strobeColor:figure?.motifId&&flashStrength>0?rgb.map(v=>v*255/Math.max(1,...rgb)):undefined,palette:first?[[first.r,first.g,first.b]]:[],animationId:figure?.id||animation.id,
  description:`${figure?.id||animation.name} · ${directed?(figure&&strobeComposition(figure,0,1).level>0?'Figur · Bewegung':'Figurwechsel · dunkel'):'Beat-Demo'}`+(beat===null?' · ohne Beat-Raster: Dauerlicht':'')};
}
