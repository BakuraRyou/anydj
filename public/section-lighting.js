import {directionAt} from './color-direction.js';
import {arrangementLevelAt} from './show-arrangement.js';
import {SHOW_PROFILES,applySongShowProfile} from './dj-show-profile.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function sectionAt(sections,time){
  if(!sections?.length)return null;
  let lo=0,hi=sections.length;while(lo<hi){const mid=(lo+hi)>>>1;if(sections[mid].start<=time)lo=mid+1;else hi=mid;}
  const section=sections[lo-1];return section&&time<section.end?section:null;
}
export function sectionEditsFor(plan) {
  return plan.sections.map((s,i)=>({id:`section-${i}`,start:s.start,end:s.end,
    name:s.title||s.label||s.kind||`Abschnitt ${i+1}`,motif:String(s.label??s.motif??i),
    rhythm:'auto',movement:1,colors:'auto',colorA:'#ff7700',colorB:'#7400ff'}));
}
export function validateSectionEdits(edits,duration) {
  if(!Array.isArray(edits)||edits.length>8192)throw Error('Ungültige Abschnittsliste.');
  let end=0;
  return edits.map(e=>{
    if(!e||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<end-1e-6||e.end<=e.start||e.end>duration+1e-6)throw Error('Abschnitte dürfen sich nicht überlappen und müssen innerhalb des Songs liegen.');
    if(!['auto','bars','strong','none'].includes(e.rhythm)||!['auto','hold','pair','cycle'].includes(e.colors)||!Number.isFinite(e.movement)||e.movement<0||e.movement>1.6)throw Error('Ungültige Lichtparameter.');
    if(!/^#[0-9a-f]{6}$/i.test(e.colorA)||!/^#[0-9a-f]{6}$/i.test(e.colorB))throw Error('Ungültige Farbe.');
    if(e.palette!=null&&(!Array.isArray(e.palette)||e.palette.length<1||e.palette.length>8||e.palette.some(c=>!/^#[0-9a-f]{6}$/i.test(c))))throw Error('Ungültige Farbpalette.');
    if(e.profile!=null&&e.profile!=='inherit'&&!SHOW_PROFILES.includes(e.profile))throw Error('Unbekannter Abschnittsstil.');
    if(e.fixtures!=null&&(!Array.isArray(e.fixtures)||e.fixtures.length>512))throw Error('Ungültige Gerätegestaltung.');
    for(const cue of e.fixtures||[]){
      if(!cue||typeof cue.target!=='string'||cue.target.length>200||!cue.look||!/^#[0-9a-f]{6}$/i.test(cue.look.colors?.[0])||!Number.isFinite(cue.look.brightness)||cue.look.brightness<0||cue.look.brightness>100||!Number.isFinite(cue.look.strength)||cue.look.strength<0||cue.look.strength>100)throw Error('Ungültige Gerätegestaltung.');
      if(cue.aim&&(!['x','y'].every(k=>Number.isFinite(cue.aim[k])&&Math.abs(cue.aim[k])<=1000)))throw Error('Ungültiges Lichtziel.');
    }
    end=e.end;
    return {...e,...(e.fixtures?{fixtures:structuredClone(e.fixtures)}:{}),...(e.palette?{palette:[...e.palette]}:{}),name:String(e.name||'Abschnitt').slice(0,80),motif:String(e.motif||'').slice(0,80)};
  });
}
export function transferMotif(edits,index) {
  const source=edits[index];
  if(!source?.motif)throw Error('Bitte zuerst eine Motivgruppe vergeben.');
  const {rhythm,movement,colors,colorA,colorB,profile,fixtures,palette}=source;
  return edits.map(e=>e.motif===source.motif?{...e,rhythm,movement,colors,colorA,colorB,profile,palette:palette?[...palette]:undefined,fixtures:structuredClone(fixtures||[])}:{...e});
}
export function snapSectionTime(plan,time) {
  const beats=plan.beatGrid?.beats||plan.beatTiming?.times||[];
  return beats.length?beats.reduce((a,b)=>Math.abs(b-time)<Math.abs(a-time)?b:a):clamp(time,0,plan.duration);
}
export function sectionPlanAt(plan,time){
  const section=sectionAt(plan?.profileSections,time);
  return plan?.profilePlans?.[section?.profile]||plan;
}
export function sectionFixtureAt(plan,time,targets){
  const cues=sectionAt(plan?.sectionLighting,time)?.fixtures||[];
  for(const target of targets){const cue=cues.find(c=>c.target===target);if(cue)return cue;}
  return null;
}
export function applySectionLighting(plan,edits=[]) {
  const profiles=[...new Set(edits.map(e=>e.profile).filter(p=>p&&p!=='inherit'))];
  const result=applySectionEdits(plan,edits);
  if(!profiles.length)return result;
  const profilePlans=Object.fromEntries(profiles.map(profile=>[profile,applySectionEdits(applySongShowProfile(plan.showProfileBase||plan,profile),edits)]));
  const combined={...result,profilePlans,profileSections:edits.map(({start,end,profile})=>({start,end,profile}))};
  combined.frames=result.frames.map((frame,i)=>sectionPlanAt(combined,i*plan.step).frames[i]||frame);
  return combined;
}
function applySectionEdits(plan,edits=[]) {
  if(!edits.length||!plan.arrangement)return plan;
  edits=validateSectionEdits(edits,plan.duration);
  // Opening the editor seeds neutral controls for every section. They must
  // preserve the live plan, including its dimmer recovery and motion handovers.
  if(edits.every(e=>e.rhythm==='auto'&&e.movement===1&&e.colors==='auto'&&!e.fixtures?.length))return plan;
  const source=plan.arrangement,at=t=>sectionAt(edits,t);
  const bars=plan.beatGrid?.downbeats||[];
  const selected=source.times.map((time,i)=>{
    const e=at(time);if(!e)return true;
    if(e.rhythm==='none')return false;
    if(e.rhythm==='bars')return bars.some(b=>Math.abs(b-time)<.04);
    if(e.rhythm==='strong')return source.accents[i]>=.4;
    return true;
  });
  const arrangement={...source,
    bases:source.bases.map((v,i)=>clamp(v*(.35+.65*(at(i*source.step)?.movement??1)),0,1)),
    accents:source.accents.map((v,i)=>selected[i]?clamp(v*(at(source.times[i])?.movement??1),0,.95):0),
    decays:source.times.map((t,i)=>(source.decays?.[i]??source.decay)*clamp(1.3-.3*(at(t)?.movement??1),.6,1.3))};
  const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
  const count=new Map();let event=-1;
  const frames=plan.frames.map((frame,i)=>{
    const t=i*plan.step;
    while(event+1<source.times.length&&source.times[event+1]<=t){event++;const e=at(source.times[event]);if(e&&selected[event]&&source.accents[event]>0)count.set(e,(count.get(e)||0)+1);}
    const e=at(t);let rgb=[frame.r,frame.g,frame.b];
    if(e){
      const anchor=plan.frames[Math.min(plan.frames.length-1,Math.floor(e.start/plan.step))];
      if(e.colors==='auto'&&e.movement<1)rgb=rgb.map((v,c)=>[anchor.r,anchor.g,anchor.b][c]*(1-e.movement)+v*e.movement);
      if(e.colors!=='auto'){
        const a=hex(e.colorA),b=hex(e.colorB),n=Math.max(0,(count.get(e)||1)-1);
        const palette=e.colors==='cycle'?(e.palette?.map(hex)||[a,b,[a[1],a[2],a[0]],[b[2],b[0],b[1]]]):[a,b];
        const audible=source.bases[Math.min(source.bases.length-1,Math.floor(t/source.step))]>0;
        if(audible)rgb=e.colors==='hold'?a:palette[n%palette.length];
      }
    }
    return {...frame,r:Math.round(rgb[0]),g:Math.round(rgb[1]),b:Math.round(rgb[2]),dimming:Math.round(plan.beatTiming.minimum+arrangementLevelAt(arrangement,t)*(plan.beatTiming.maximum-plan.beatTiming.minimum))};
  });
  const sectionLighting=edits.map(e=>{
    const a=hex(e.colorA),b=hex(e.colorB);
    return {start:e.start,end:e.end,movement:e.movement,rhythm:e.rhythm,fixtures:e.fixtures||[],palette:e.colors==='auto'?null:e.colors==='hold'?[a]:e.colors==='pair'?[a,b]:e.palette?.map(hex)||[a,b,[a[1],a[2],a[0]],[b[2],b[0],b[1]]],
      events:source.times.filter((t,i)=>t>=e.start&&t<e.end&&selected[i]&&source.accents[i]>0)};
  });
  const colorEvents=(plan.colorEvents||[]).flatMap((event,i)=>{
    const end=Math.min(event.end,plan.colorEvents[i+1]?.time??event.end);
    const boundaries=[event.time,...edits.flatMap(e=>[e.start,e.end]).filter(t=>t>event.time&&t<end),end];
    const points=[...new Set(boundaries)].sort((a,b)=>a-b);
    return points.slice(0,-1).map((time,j)=>{
      const edit=at(time),anchor=plan.frames[Math.min(plan.frames.length-1,Math.floor((edit?.start??time)/plan.step))];
      const factor=edit?.colors==='auto'?Math.min(1,edit.movement):1;
      return {...event,time,end:points[j+1],...Object.fromEntries(['r','g','b'].map(c=>[c,Math.round(anchor[c]*(1-factor)+event[c]*factor)]))};
    });
  });
  return {...plan,frames,colorEvents,arrangement,sectionLighting,beatTiming:{...plan.beatTiming,accents:arrangement.accents}};
}

// Evaluate explicit color changes at the actual beat time, not the 125 ms
// preview frame grid. This also makes seeks independent of playback history.
export function sectionFrameAt(plan,time,frame) {
  const section=sectionAt(plan.sectionLighting,time);
  if(section&&!section.palette&&plan.directionActive&&section.movement<1){
    const anchor=directionAt(plan.colorDirection,section.start)?.[0];
    if(anchor){const rgb=[frame.r,frame.g,frame.b].map((v,c)=>Math.round(anchor[c]*(1-section.movement)+v*section.movement));return {...frame,r:rgb[0],g:rgb[1],b:rgb[2]};}
  }
  if(!section||!section.palette)return frame;
  const base=plan.arrangement.bases[Math.min(plan.arrangement.bases.length-1,Math.floor(Math.max(0,time)/plan.arrangement.step))];
  if(!base)return frame;
  let lo=0,hi=section.events.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(section.events[mid]<=time)lo=mid+1;else hi=mid;}
  const rgb=section.palette[Math.max(0,lo-1)%section.palette.length];
  return {...frame,r:rgb[0],g:rgb[1],b:rgb[2]};
}
