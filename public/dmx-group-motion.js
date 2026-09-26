import {lightingScenes} from './dmx-light-scenes.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const cache=new WeakMap();
export const GROUP_COMPOSITIONS=['curtain','mirror-pairs','traveling-group','frame-center','question-answer','gather'];
const compositionFor={'counter-fans':'mirror-pairs','traveling-wave':'traveling-group','opening-arch':'gather','diagonal-curtain':'curtain','braided-pairs':'question-answer',orbit:'frame-center','folding-gates':'mirror-pairs','rising-steps':'curtain',ripple:'gather','crossing-ribbons':'question-answer'};
export const GROUP_MOTIONS=['counter-fans','traveling-wave','opening-arch','diagonal-curtain','braided-pairs','orbit','folding-gates','rising-steps','ripple','crossing-ribbons'];
// Affinities: energy, rhythmic drive, vocals, spectral brightness. Selection is
// made once per musical passage, never per rendered frame or fixture count.
const affinities=[[.7,.8,.2,.4],[.5,.6,.4,.6],[.5,.3,.6,.5],[.6,.5,.3,.8],[.8,.8,.2,.6],[.5,.3,.4,.7],[.8,.7,.2,.3],[.6,.6,.3,.5],[.4,.4,.6,.7],[.9,.9,.1,.5]];
export function automaticGroupScore(plan){
 if(!plan)return [];
 if(cache.has(plan))return cache.get(plan);
 const passages=[];
 for(const scene of lightingScenes(plan)){
  const previous=passages.at(-1);
  if(previous&&previous.groupIndex===scene.groupIndex&&previous.end===scene.start){previous.end=scene.end;continue;}
  passages.push({...scene});
 }
 const uses=new Map();let last=null;
 const score=passages.map(p=>{
  const active=p.kind!=='silence'&&p.kind!=='sculpture';
  const features=[p.energy,p.drive,p.vocals,p.tone];
  const motion=active?GROUP_MOTIONS.map((name,i)=>({name,cost:features.reduce((s,v,j)=>s+Math.abs(v-affinities[i][j]),0)+
   (uses.get(name)||0)*.3+(last===name?.7:0)+(p.kind==='build'&&['opening-arch','rising-steps'].includes(name)?-.7:0)})).sort((a,b)=>a.cost-b.cost)[0].name:null;
  if(motion){uses.set(motion,(uses.get(motion)||0)+1);last=motion;}
  return {start:p.start,end:p.end,motion,composition:compositionFor[motion]??null,energy:p.energy,drive:p.drive,direction:p.direction??1,groupIndex:p.groupIndex};
 });
 cache.set(plan,score);return score;
}
export function automaticGroupMotionAt(plan,time){
 if(!plan||!Number.isFinite(time))return null;
 // Freeze the extra choreography at the same song time as authored motor holds.
 const edit=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end);
 const sample=edit?.movement===0?edit.start:time;
 const score=automaticGroupScore(plan);let lo=0,hi=score.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(score[mid].start<=sample)lo=mid+1;else hi=mid;}
 const p=score[lo-1];if(!p?.motion||sample>=p.end)return null;
 const previous=score[lo-2],next=score[lo];
 const connected=previous?.motion&&previous.end===p.start;
 const continuing=next?.motion&&next.start===p.end;
 const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};
 const duration=p.end-p.start;
 const describe=(passage,progress)=>({motion:passage.motion,composition:passage.composition,progress,energy:passage.energy,drive:passage.drive,direction:passage.direction,duration:passage.end-passage.start});
 // Adjacent active passages share a moving handover. Continue the outgoing
 // trajectory while the incoming one gains weight, rather than returning both
 // groups to the base pose at every phrase boundary.
 const start=connected ? .12 : 0,end=continuing ? .88 : 1;
 const current=describe(p,start+(end-start)*clamp((sample-p.start)/duration));
 current.amount=edit?.movement===0?1:Math.max(0,Math.min(1,edit?.movement??1));
 if(connected){
  const overlap=Math.min(1.4,duration*.25,(previous.end-previous.start)*.25);
  if(sample-p.start<overlap){
   const before=score[lo-3],previousStart=before?.motion&&before.end===previous.start ? .12 : 0;
   current.from=describe(previous,clamp(.88+(.88-previousStart)*(sample-p.start)/(previous.end-previous.start)));
   current.blend=ease((sample-p.start)/overlap);
  }
 }
 return current;
}
// Evaluate each physical member AFTER expanding the four source roles. Rows
// lead, answer, and support with different trajectories rather than copies.
export function groupMotionOffset(motion,rank,count,row=0){
 if(!motion||count<2)return {x:0,y:0};
 if(motion.from){
  const {from,blend,...current}=motion;
  const a=groupMotionOffset({...from,amount:motion.amount},rank,count,row),b=groupMotionOffset(current,rank,count,row);
  return {x:a.x+(b.x-a.x)*blend,y:a.y+(b.y-a.y)*blend};
 }
 const role=row%3,delay=role*.06;
 const p=clamp((motion.progress-delay)/(1-delay));
 // Finite musical gestures unfold over the entire passage and return smoothly
 // to the authored formation. No half-passage plateau, wall clock or random walk.
 const envelope=Math.sin(Math.PI*p)**2;
 const phase=p*Math.PI*2,member=rank/(count-1)*2-1,sign=member<0?-1:1;
 const side=(motion.direction||1)*(row%2?-1:1),offset=member*Math.PI*.7;
 let x=0,y=0;
 switch(motion.motion){
  case 'counter-fans':x=member*Math.cos(phase*.5)*side;y=(1-Math.abs(member))*.65*Math.sin(phase);break;
  case 'traveling-wave':x=Math.sin(phase-offset)*.7;y=Math.cos(phase-offset)*.65*side;break;
  case 'opening-arch':x=member*(.3+.7*Math.sin(Math.PI*p));y=(1-member*member)*Math.cos(Math.PI*p)*side;break;
  case 'diagonal-curtain':x=(2*p-1)*side;y=member*.75+(2*p-1)*.2;break;
  case 'braided-pairs':x=sign*Math.sin(phase)*.8;y=Math.cos(phase+sign*Math.PI*.5)*(.4+.5*Math.abs(member));break;
  case 'orbit':x=Math.cos(phase+offset)*.7*side;y=Math.sin(phase+offset)*.8;break;
  case 'folding-gates':x=-member*Math.sin(Math.PI*p)*side;y=sign*Math.sin(phase)*.7;break;
  case 'rising-steps':x=member*.5*side;y=Math.sin(Math.PI*(p-(member+1)*.2));break;
  case 'ripple':x=member*Math.cos(phase-Math.abs(member)*2);y=Math.sin(phase-Math.abs(member)*2)*side;break;
  case 'crossing-ribbons':x=-member*Math.sin(phase)*side;y=sign*Math.cos(phase)*.8;break;
 }
 // Short phrases get smaller excursions; the downstream room motors enforce
 // physical speed/acceleration and fixture calibration on the final targets.
 const amount=envelope*(.65+.35*clamp(motion.energy))*(role===2?.65:1)*Math.min(1,(motion.duration??8)/6)*(motion.amount??1);
 return {x:x*.22*amount,y:y*.16*amount};
}
export function presenceGroupOffset(presence,rank,count,row){
 if(!presence)return {x:0,y:0};
 if(!presence.layers)return groupMotionOffset(presence.groupMotion,rank,count,row);
 return presence.layers.reduce((sum,p)=>{const v=presenceGroupOffset(p,rank,count,row),w=p.weight??1;return {x:sum.x+v.x*w,y:sum.y+v.y*w};},{x:0,y:0});
}

// Complete compositions are fitted inside the permitted target rectangle.
// Position, membership and motion share one description and one crossfade.
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
export function groupComposition(motion,rank,count,row=0,groups=1){
 if(!motion?.composition||count<2)return null;
 if(motion.from){
  const {from,blend,...current}=motion;
  const a=groupComposition({...from,amount:motion.amount},rank,count,row,groups),b=groupComposition(current,rank,count,row,groups);
  if(!a||!b)return b||a;
  return Object.fromEntries(['x','y','level','weight','articulation'].map(k=>[k,a[k]+(b[k]-a[k])*blend]));
 }
 const p=clamp(motion.progress),u=rank/(count-1),r=u*2-1;
 const phase=p*Math.PI*2,side=motion.direction||1;
 const slots=Math.ceil(count/2),pair=Math.min(rank,count-1-rank);
 const centerPair=pair===slots-1,outerPair=pair===0;
 const depth=.14+.72*(row+.5)/Math.max(1,groups),depthSpan=Math.min(.22,.6/Math.max(1,groups));
 let x=.5,y=depth,level=1;
 switch(motion.composition){
  case 'curtain':
   x=.12+.76*u;y=depth+Math.sin(phase)*depthSpan*.4;
   // A narrow rig gets one readable line; larger rigs leave alternating gaps.
   level=count<=4||pair%2===0?1:.18;break;
  case 'mirror-pairs':{
   const opening=.13+.27*(.5+.5*Math.sin(phase));
   x=.5+Math.sign(r)*opening*(.6+.4*Math.abs(r));
   y=depth+(centerPair?-.55:.55)*depthSpan;
   level=centerPair||outerPair?1:0;break;
  }
  case 'traveling-group':{
   const lead=.18+.64*(.5-.5*Math.cos(Math.PI*p));
   const window=Math.max(.2,1.1/(count-1));
   x=.14+.72*u;y=depth+Math.sin(phase+r)*depthSpan*.45;
   level=1-ease((Math.abs(u-lead)-window*.45)/(window*.55));break;
  }
  case 'frame-center':
   x=outerPair?.1+.8*u:.5+r*.19+.055*Math.sin(phase)*side;
   y=depth+(outerPair?depthSpan*.75:-depthSpan*.5+.03*Math.cos(phase));
   level=outerPair?.42:centerPair?1:0;break;
  case 'question-answer':{
   const answer=ease((p-.32)/.36),left=rank<count/2;
   x=left?.2+.16*u:.64+.16*u;y=depth+(left?-1:1)*depthSpan*.5;
   level=left?1-.85*answer:.15+.85*answer;break;
  }
  case 'gather':{
   const width=.08+.32*(.5+.5*Math.cos(phase));
   x=.5+r*width;y=depth+(1-r*r)*depthSpan*Math.sin(phase);
   const density=.25+.75*(width-.08)/.32;
   const order=(slots-1-pair)/Math.max(1,slots-1);
   level=centerPair?1:1-ease((order-density)/.18);break;
  }
 }
 // Sparse lead figures retain supporting members during sustained high energy.
 // This changes occupancy, never the source dimmer or an authored blackout.
 const intensity=ease(((motion.energy??0)-.65)/.25);
 level=level+(1-level)*.45*intensity;
 const weight=ease(p/.12)*ease((1-p)/.12)*clamp(motion.amount??1);
 return {x:clamp(x),y:clamp(y),level:1+(clamp(level)-1)*weight,weight,articulation:.15+.3*clamp(motion.energy??0)*clamp(motion.drive??0)};
}
export function presenceComposition(presence,rank,count,row=0,groups=1){
 if(!presence)return null;
 if(!presence.layers)return groupComposition(presence.groupMotion,rank,count,row,groups);
 let sum=0,x=0,y=0,level=0,weight=0,articulation=0;
 for(const layer of presence.layers){
  const w=layer.weight??1,c=presenceComposition(layer,rank,count,row,groups);sum+=w;
  level+=(c?.level??1)*w;
  if(c){const amount=c.weight*w;weight+=amount;articulation+=c.articulation*amount;x+=c.x*amount;y+=c.y*amount;}
 }
 return weight>0?{x:x/weight,y:y/weight,level:level/Math.max(.0001,sum),weight:weight/Math.max(.0001,sum),articulation:articulation/weight}:null;
}

// Stable groups from actual mounts, not device enumeration or repeated source IDs.
// Explicit fixture assignments win; unassigned fixtures get spatial groups.
export function automaticFixtureGroups(fixtures){
 const explicit=new Map(),unassigned=[];
 for(const f of fixtures){
  if(typeof f.group==='string'||Number.isFinite(f.group)){
   const key=String(f.group);if(!explicit.has(key))explicit.set(key,[]);explicit.get(key).push(f);
  }else unassigned.push(f);
 }
 const x=f=>f.position.x??0,y=f=>f.position.y??0,z=f=>f.position.height??0;
 const ordered=[...unassigned].sort((a,b)=>y(a)-y(b)||z(a)-z(b)||x(a)-x(b)||String(a.id).localeCompare(String(b.id)));
 let spatial=[];
 for(const f of ordered){
  const row=spatial.find(r=>Math.abs(y(r[0])-y(f))<=.4&&Math.abs(z(r[0])-z(f))<=.6);
  if(row)row.push(f);else spatial.push([f]);
 }
 if(spatial.some(r=>r.length<2)){
  spatial=ordered.length?[ordered]:[];
  const target=Math.min(6,Math.max(1,Math.floor(ordered.length/6)));
  while(spatial.length<target){
   const candidates=spatial.filter(g=>g.length>=4).sort((a,b)=>b.length-a.length);if(!candidates.length)break;
   const group=candidates[0],axes=[x,y,z];
   const axis=axes.sort((a,b)=>(Math.max(...group.map(b))-Math.min(...group.map(b)))-(Math.max(...group.map(a))-Math.min(...group.map(a))))[0];
   const sorted=[...group].sort((a,b)=>axis(a)-axis(b)||String(a.id).localeCompare(String(b.id))),mid=Math.floor(sorted.length/2);
   spatial.splice(spatial.indexOf(group),1,sorted.slice(0,mid),sorted.slice(mid));
  }
 }
 const center=(g,axis)=>g.reduce((s,f)=>s+axis(f),0)/g.length;
 const groups=[...explicit.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,members])=>({key:'user:'+key,members}));
 spatial.sort((a,b)=>center(a,y)-center(b,y)||center(a,x)-center(b,x));
 groups.push(...spatial.map((members,i)=>({key:'spatial:'+i,members})));
 const result=new Map();
 groups.forEach(({key,members},row)=>{
  members.sort((a,b)=>x(a)-x(b)||y(a)-y(b)||z(a)-z(b)||String(a.id).localeCompare(String(b.id)));
  members.forEach((f,rank)=>result.set(f.id,{rank,count:members.length,row,group:key}));
 });
 return result;
}
