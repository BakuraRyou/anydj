// Heuristic suggestions, not probabilities. New catalog entries can reuse a
// detection profile or remain manual; arbitrary names do not train a model.
export const FEELING_VERSION=1;
export const FEELING_PROFILES={calm:'Ruhig',gentle:'Gefühlvoll',romantic:'Romantisch',bright:'Fröhlich',dark:'Düster',driving:'Treibend',wild:'Wild',epic:'Episch'};
export const DEFAULT_FEELINGS=Object.entries(FEELING_PROFILES).map(([id,label])=>({id,label,profile:id}));
export function normalizeCatalog(value){
 const rows=Array.isArray(value)?value:DEFAULT_FEELINGS,ids=new Set(),labels=new Set();
 return rows.filter(tag=>{
  if(!tag||typeof tag.id!=='string'||!tag.id||tag.id.length>80||typeof tag.label!=='string'||!tag.label.trim()||tag.label.trim().length>40)return false;
  const label=tag.label.trim().toLocaleLowerCase();if(ids.has(tag.id)||labels.has(label))return false;ids.add(tag.id);labels.add(label);return true;
 }).map(tag=>({id:tag.id,label:tag.label.trim(),profile:Object.hasOwn(FEELING_PROFILES,tag.profile)?tag.profile:''}));
}
export function inferFeelings(plan){
 const moods=(plan?.moods||[]).filter(m=>Number.isFinite(m.energy)&&m.end>m.start);
 const styles=plan?.musicStyle?.segments||[];
 const source=styles.length?'desktop':'browser',scores={};
 const duration=moods.reduce((sum,m)=>sum+m.end-m.start,0);
 if(!duration)return {version:FEELING_VERSION,source,scores};
 // All-silent plans must not acquire a calm/romantic label.
 if(!(plan.sections||[]).some(s=>s.energy>.03))return {version:FEELING_VERSION,source,scores};
 const share=fn=>moods.reduce((sum,m)=>sum+(m.end-m.start)*fn(m),0)/duration;
 const energy=share(m=>m.energy);
 const tonal=kind=>share(m=>!m.held&&m.confidence>=.2&&m.mood===kind?1:0);
 const styleDuration=styles.reduce((sum,s)=>sum+s.end-s.start,0);
 const family=name=>styleDuration?styles.reduce((sum,s)=>sum+(s.end-s.start)*(s.scores?.[name]||0),0)/styleDuration:0;
 const calm=share(m=>m.energy<.52?1:0),strong=share(m=>m.energy>.73?1:0);
 const gentle=tonal('gentle'),bright=tonal('bright'),wistful=tonal('wistful'),dramatic=tonal('dramatic');
 const put=(key,value)=>{if(value>=.3)scores[key]=Math.min(1,value);};
 put('calm',calm);put('gentle',gentle+wistful*.45);put('bright',bright);put('dark',wistful+dramatic*.65);
 put('driving',energy>.62?share(m=>m.energy>.62?1:0):0);
 put('wild',strong*(.75+Math.min(.25,family('rock')+family('electronic'))));
 // Specific emotional claims need desktop style evidence; fallback stays broad.
 if(styleDuration){
  put('romantic',gentle*Math.min(1,(family('acoustic')+family('pop'))*3));
  const energies=(plan.sections||[]).map(s=>s.energy).filter(Number.isFinite);
  const contrast=energies.length?Math.max(...energies)-Math.min(...energies):0;
  put('epic',contrast>.25?Math.min(1,family('orchestral')*3)*(dramatic+strong):0);
 }
 return {version:FEELING_VERSION,source,scores};
}
export function automaticFeelingIds(track,catalog){
 return catalog.filter(tag=>tag.profile&&(track.feelingAnalysis?.scores?.[tag.profile]||0)>=.3).map(tag=>tag.id);
}
export function feelingIds(track,catalog=DEFAULT_FEELINGS){
 const excluded=new Set(track.feelingExcluded||[]),added=new Set(track.feelingAdded||[]);
 const auto=new Set(automaticFeelingIds(track,catalog));
 return catalog.filter(tag=>added.has(tag.id)||(auto.has(tag.id)&&!excluded.has(tag.id))).map(tag=>tag.id);
}
export function matchesFeelings(track,selected,catalog){
 return !selected.length||feelingIds(track,catalog).some(id=>selected.includes(id));
}
