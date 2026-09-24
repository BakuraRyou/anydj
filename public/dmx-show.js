import {COLOR_MODES} from './dj-color-modes.js';
import {stagePatch} from './dmx-model.js';
export const GROUPS=['Links','Rechts','Hintergrund'];
export const DEFAULT_LOOK={mode:'auto',colors:['#ff0080','#00e5ff'],animation:'auto',brightness:100,strength:80,period:4,offset:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cleanLook(value){
  const v=value||{},n=(key,min,max)=>Number.isFinite(v[key])?clamp(v[key],min,max):DEFAULT_LOOK[key];
  return {mode:['auto','opposite','fixed','custom',...COLOR_MODES.map(m=>m.id)].includes(v.mode)?v.mode:'auto',
    colors:Array.isArray(v.colors)&&v.colors.length>=2&&v.colors.length<=8&&v.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?[...v.colors]:[...DEFAULT_LOOK.colors],
    animation:['auto','follow','wash','pulse','alternate','wave','chase'].includes(v.animation)?v.animation:'auto',
    brightness:n('brightness',0,100),strength:n('strength',0,100),period:[1,2,4,8,16].includes(v.period)?v.period:4,offset:n('offset',0,16)};
}
function layer(value,base=false,size=5){
  const clean=v=>v&&typeof v==='object'?cleanLook(v):null;
  return {global:base?cleanLook(value?.global):clean(value?.global),groups:Array.from({length:3},(_,i)=>clean(value?.groups?.[i])),fixtures:Array.from({length:size},(_,i)=>clean(value?.fixtures?.[i]))};
}
export function cleanStageSettings(value,size=5){
  const sections=Object.create(null);
  if(value?.sections&&typeof value.sections==='object')for(const [key,v] of Object.entries(value.sections).slice(0,256))if(key.length<500)sections[key]=layer(v,false,size);
  const base=layer(value,true,size);
  if(!value)base.groups[1]=cleanLook({mode:'opposite'});
  return {version:1,...base,members:Array.from({length:size},(_,i)=>[0,1,2].includes(value?.members?.[i])?value.members[i]:([0,0,1,1,2][i]??i%3)),sections};
}
export function resolvedLook(config,index,sectionKey){
  const group=config.members[index],s=config.sections[sectionKey];
  return s?.fixtures[index]||s?.groups[group]||s?.global||config.fixtures[index]||config.groups[group]||config.global;
}
// Beat phase comes from playback time, never wall-clock time. With no beat grid,
// color/fixed/wash still work, but rhythmic animations follow the source frame.
export function beatPosition(times,time){
  if(!times?.length||times.length<2||time<times[0])return null;
  let lo=0,hi=times.length;while(lo<hi){const mid=(lo+hi)>>>1;if(times[mid]<=time)lo=mid+1;else hi=mid;}
  const i=lo-1,next=times[i+1]??times[i]+(times[i]-times[i-1]);
  if(!(next>times[i])||time>next)return null;
  return i+(time-times[i])/(next-times[i]);
}
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
function colorFor(frame,look,position){
  const rgb=[frame.r,frame.g,frame.b];
  if(look.mode==='auto')return rgb;
  if(look.mode==='opposite'){
    const max=Math.max(...rgb),min=Math.min(...rgb);return rgb.map(v=>max+min-v);
  }
  if(look.mode==='fixed')return hex(look.colors[0]);
  const colors=look.mode==='custom'?look.colors:COLOR_MODES.find(m=>m.id===look.mode)?.colors;
  if(!colors?.length)return rgb;
  const hue=(Math.atan2(Math.sqrt(3)*(frame.g-frame.b),2*frame.r-frame.g-frame.b)/(2*Math.PI)+1)%1;
  const p=((hue+position)%1)*(colors.length-1),i=Math.floor(p),f=p-i;
  return hex(colors[i]).map((v,c)=>v*(1-f)+hex(colors[Math.min(i+1,colors.length-1)])[c]*f);
}
export function fixtureFrames(stream,config,equipment){
  const patch=stagePatch(equipment),spots=patch.filter(f=>f.profile!=='rgb-pixels');
  if(!stream?.frame||stream.frame.state===false)return patch.map(f=>Array.from({length:f.cells},()=>null));
  const beat=Number.isFinite(stream.beat)?stream.beat:null;
  return patch.map((fixture,index)=>{
    const look=resolvedLook(config,index,stream.sectionKey),group=config.members[index]??0,bar=fixture.profile==='rgb-pixels';
    let animation=look.animation;
    if(animation==='auto')animation=/quiet|held|break|outro/.test(stream.look||'')?'wash':bar?'chase':group===2?'wash':'alternate';
    return Array.from({length:fixture.cells},(_,cell)=>{
      const units=bar?fixture.cells:spots.length,position=bar?cell:spots.indexOf(fixture);
      const spatial=position/units;
      const phase=beat===null?0:((beat+look.offset)/look.period%1+1)%1;
      let level=stream.frame.dimming/100;
      if(animation==='wash')level=stream.frame.dimming>0?.55:0;
      else if(beat!==null&&animation!=='follow'){
        const power=look.strength/100;
        let shape=1;
        if(animation==='pulse')shape=Math.exp(-phase*8);
        if(animation==='alternate')shape=(Math.floor((beat+look.offset)/look.period)%2===(group===1?1:0))?1:.08;
        if(animation==='wave')shape=(1+Math.cos(2*Math.PI*(phase-spatial)))/2;
        if(animation==='chase')shape=Math.floor(phase*units)===position?1:.05;
        level*=1-power+power*shape;
      }
      const rgb=colorFor(stream.frame,look,animation==='wave'||animation==='chase'?spatial*.3:0);
      return {state:true,r:rgb[0],g:rgb[1],b:rgb[2],dimming:clamp(level*look.brightness,0,100)};
    });
  });
}
export function mixFixtureFrames(streams,config,equipment){
  const patch=stagePatch(equipment);
  const active=streams.filter(s=>s.frame&&s.frame.state!==false&&Number.isFinite(s.weight)&&s.weight>0);
  const total=active.reduce((n,s)=>n+s.weight,0);
  const rendered=active.map(s=>fixtureFrames(s,config,equipment));
  return patch.map((f,i)=>Array.from({length:f.cells},(_,j)=>{
    if(!total)return null;
    // Mix emitted light, so a dark red source cannot tint a bright blue source.
    const rgb=['r','g','b'].map(key=>active.reduce((n,s,k)=>n+rendered[k][i][j][key]*rendered[k][i][j].dimming/100*s.weight,0)/total);
    return {state:true,r:rgb[0],g:rgb[1],b:rgb[2],dimming:100};
  }));
}
