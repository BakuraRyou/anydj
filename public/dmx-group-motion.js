import {selectGroupScore,SONG_MOVEMENT_VERSION,movementAccentEnvelope} from './song-movement-plan.js';
export {GROUP_COMPOSITIONS,GROUP_MOTIONS} from './song-movement-plan.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const cache=new WeakMap();
export function automaticGroupScore(plan){
 if(!plan)return [];
 if(cache.has(plan))return cache.get(plan);
 const score=plan.songMovement?.version===SONG_MOVEMENT_VERSION
  ?plan.songMovement.passages.map(p=>({...p,intent:p}))
  :selectGroupScore(plan);
 // Fit entrances once, including velocity direction; playback and seeks
 // then read the same deterministic solution without per-frame searches.
 for(let i=1;i<score.length;i++){
  const p=score[i],previous=score[i-1];
  if(!p.motion||!previous.motion||previous.end!==p.start||p.coordination==='build')continue;
  const step=1/60,span=p.end-p.start,oldSpan=previous.end-previous.start;
  const oldRate=(i>1&&score[i-2].motion ? .76 : .88)/oldSpan;
  const newRate=(score[i+1]?.motion ? .76 : .88)/span;
  const samples=(part,progress,time)=>[0,1].flatMap(row=>[0,2,5,7].map(rank=>groupComposition(describeMotion(plan,part,progress,time),rank,8,row,2)));
  const a=samples(previous,.88,p.start),av=samples(previous,.88+oldRate*step,p.start+step);
  const cost=offset=>{
   const candidate={...p,phaseOffset:offset};
   const b=samples(candidate,.12,p.start),bv=samples(candidate,.12+newRate*step,p.start+step);
   return a.reduce((sum,v,k)=>{
    const dx=v.x-b[k].x,dy=v.y-b[k].y;
    const vx=(av[k].x-v.x)/step,vy=(av[k].y-v.y)/step,wx=(bv[k].x-b[k].x)/step,wy=(bv[k].y-b[k].y)/step;
    const speed=Math.hypot(vx,vy)*Math.hypot(wx,wy);
    const reversal=speed>.0001?Math.max(0,-(vx*wx+vy*wy)/speed):0;
    return sum+dx*dx+dy*dy+.04*reversal;
   },0)/a.length;
  };
  const before=cost(0);let best=before,offset=0;
  if(p.composition===previous.composition&&p.coordination===previous.coordination&&p.direction===previous.direction){
   // A continuing figure inherits its exact musical phase, rather than being
   // independently aligned again on the next analysis fragment.
   offset=describeMotion(plan,previous,.88,p.start).phase-describeMotion(plan,{...p,phaseOffset:0},.12,p.start).phase;
   best=cost(offset);
  }else for(let j=1;j<16;j++){const candidate=j*Math.PI/8,value=cost(candidate);if(value<best-1e-9){best=value;offset=candidate;}}
  p.phaseOffset=offset;p.transitionFit={before,after:best};
 }
 cache.set(plan,score);return score;
}
// Unwrapped musical position: only measured downbeats supply extra motion.
// Keeping it separate from passage progress preserves long-lived compositions.
function barPosition(bars,time){
 if(!bars||bars.length<2)return 0;
 let lo=0,hi=bars.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(bars[mid]<=time)lo=mid+1;else hi=mid;}
 const i=Math.max(0,Math.min(bars.length-2,lo-1)),span=bars[i+1]-bars[i];
 return i+(span>0?(time-bars[i])/span:0);
}
function describeMotion(plan,passage,progress,time){
  const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};
  const rhythmic=passage.intent?.motionDrive??clamp(passage.drive??0)*ease((passage.energy-.45)/.35);
  const bars=plan.beatGrid?.downbeats;
  const coordinated=passage.coordination==='build'||passage.coordination==='ordered';
  // Periodic movement has one musical clock, independent of analysis fragment
  // length. Ordered gestures still unfold over their authored passage.
  const travel=coordinated?progress*Math.PI*2
   :bars?.length>=2?(barPosition(bars,time)-barPosition(bars,passage.start))*Math.PI*.5*(.5+rhythmic)
   :(time-passage.start)*Math.PI*2/(12-6*rhythmic);
  const phase=(passage.phaseOffset??0)+travel;
  const preparation=passage.intent?.anticipation;
  const anticipation=preparation?preparation.strength*ease((time-preparation.start)/(preparation.end-preparation.start)):0;
  return {start:passage.start,end:passage.end,motion:passage.motion,composition:passage.composition,coordination:passage.coordination,theme:passage.theme,development:passage.development,progress,phase,accent:movementAccentEnvelope(passage.intent,time),anticipation,intent:passage.intent,energy:passage.energy,drive:passage.drive,direction:passage.direction,duration:passage.end-passage.start};
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
 const describe=(passage,progress)=>describeMotion(plan,passage,progress,sample);
 // Adjacent active passages share a moving handover. Continue the outgoing
 // trajectory while the incoming one gains weight, rather than returning both
 // groups to the base pose at every phrase boundary.
 const start=connected ? .12 : 0,end=continuing ? .88 : 1;
 const current=describe(p,start+(end-start)*clamp((sample-p.start)/duration));
 current.amount=edit?.movement===0?1:Math.max(0,Math.min(1,edit?.movement??1));
 if(connected){
  const overlap=Math.min(p.intent?.transition?.overlap??1.4,duration*.25,(previous.end-previous.start)*.25);
  if(sample-p.start<overlap){
   const before=score[lo-3],previousStart=before?.motion&&before.end===previous.start ? .12 : 0;
   current.from=describe(previous,.88+(.88-previousStart)*(sample-p.start)/(previous.end-previous.start));
   // Keep the outgoing group intact while the incoming picture gains weight.
   current.from.envelopeProgress=.88;
   current.blend=ease((sample-p.start)/overlap);
  }
 }
 return current;
}
// Show keeps its authored large-scale pose and occupancy. The song's group
// gesture supplies development within that picture, with more of the source
// formation retained than in Automatic. Both share the same continuous timing.
export function showGroupMotionAt(plan,time,picture){
 if(!picture||['held','silence'].includes(picture.role))return null;
 const motion=automaticGroupMotionAt(plan,time);
 if(!motion?.intent)return null;
 const adapt=m=>({...m,composition:m.composition==='traveling-group'?'parallel-sweep':m.composition,presentation:'show',intent:{...m.intent,articulation:Math.max(.55,m.intent?.articulation??0)},...(m.from?{from:adapt(m.from)}:{})});
 return adapt(motion);
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
  case 'opening-lines':x=member*(2*p-1);y=.4*Math.sin(Math.PI*p);break;
  case 'rising-fan':x=member*.5;y=2*p-1;break;
  case 'unison-sweep':x=Math.sin(phase)*side;y=Math.cos(phase)*.7;break;
  case 'breathing-arch':x=member*Math.sin(phase)*.7;y=(1-member*member)*Math.cos(phase)*.6;break;
  case 'hinged-lines':x=member*Math.cos(phase)*.6;y=sign*Math.abs(member)*Math.sin(phase)*.7;break;
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
  return Object.fromEntries(['x','y','level','weight','articulation','paired','wallBlend'].map(k=>[k,a[k]+(b[k]-a[k])*blend]));
 }
 // Evaluate one member per mirrored pair: identical depth and cycle, opposite
 // lateral displacement. Travelling waves become paired waves, not stray heads.
 if(motion.intent?.symmetry==='paired'&&rank>(count-1)/2){
  const left=groupComposition(motion,count-1-rank,count,row,groups);
  return {...left,x:1-left.x};
 }
 const p=clamp(motion.progress),u=rank/(count-1),r=u*2-1;
 const paired=motion.intent?.symmetry==='paired';
 const attention=motion.intent?.attention;
 // Supporting rows can carry a sustained lead while the others keep rhythm.
 const leadRow=row%3===2&&['vocals','other'].includes(attention?.leader);
 const phase=motion.phase??p*Math.PI*2,side=motion.direction||1;
 const slots=Math.ceil(count/2),pair=Math.min(rank,count-1-rank);
 const centerPair=pair===slots-1,outerPair=pair===0;
 const depth=.14+.72*(row+.5)/Math.max(1,groups),depthSpan=Math.min(.22,.6/Math.max(1,groups));
 // A formation's travel must not shrink with the number of trusses. Keep
 // row spacing for the picture, but develop the whole line on the shared phase.
 const reach=.08+.08*clamp(motion.energy??0)*clamp(motion.drive??0);
 const lineDepth=depth+Math.sin(phase)*Math.min(reach,depth-.04,.96-depth);
 let x=.5,y=depth,level=1;
 switch(motion.composition){
  case 'opening-lines':{
   // One opening over the build; no periodic closing before its arrival.
   const opening=.12+.28*ease(p);
   x=.5+r*opening;y=depth+(ease(p)-.5)*.12;break;
  }
  case 'rising-fan':
   x=.5+r*(.28+.08*ease(p));
   y=.24+.4*ease(p)+.13*(1-r*r);break;
  case 'curtain':
   x=.5+r*(.34+.04*Math.cos(phase));y=lineDepth;
   // A narrow rig gets one readable line; larger rigs leave alternating gaps.
   level=count<=4||pair%2===0?1:.18;break;
  case 'mirror-pairs':{
   const opening=.13+.27*(.5+.5*Math.sin(phase));
   x=.5+Math.sign(r)*opening*(.6+.4*Math.abs(r));
   y=depth+(centerPair?-.55:.55)*depthSpan;
   level=centerPair||outerPair?1:0;break;
  }
  case 'traveling-group':{
   const lead=.18+.64*(.5-.5*Math.cos(phase*.5));
   // Mirroring evaluates only one half of the rig. Chase pairs within that
   // domain instead of travelling into a half that is never evaluated.
   const members=paired?slots:count;
   const member=paired?(slots>1?pair/(slots-1):lead):u;
   const window=Math.max(.2,1.1/Math.max(1,members-1));
   x=.5+r*(.32+.04*Math.cos(phase));y=lineDepth;
   level=1-ease((Math.abs(member-lead)-window*.45)/(window*.55));break;
  }
  case 'frame-center':
   x=outerPair?.5+r*(.37+.03*Math.cos(phase)):.5+r*(.19+.04*Math.sin(phase));
   y=lineDepth+(outerPair?depthSpan*.5:-depthSpan*.35);
   level=outerPair?.42:centerPair?1:0;break;
  case 'question-answer':{
   const answer=ease((p-.32)/.36),left=rank<count/2;
   // Paired rigs answer between complete mirrored pairs, not between left
   // and right halves (the latter is erased by the symmetry recursion).
   const caller=paired?pair%2===0:left;
   x=(left?.2+.16*u:.64+.16*u)+Math.sin(phase)*.08*(left?1:-1);y=depth+(left?-1:1)*depthSpan*.5*Math.cos(phase);
   level=paired&&slots===1?1:caller?1-.85*answer:.15+.85*answer;break;
  }
  case 'diagonal-sweep':{
   // One slanted line travels together; rows answer in opposite directions.
   const sweep=Math.sin(phase)*(row%2?-1:1)*side;
   x=.5+r*.27+sweep*.12;
   y=.5+r*.22*side+sweep*.16;
   level=pair%2===0?1:.4;break;
  }
  case 'depth-wave':
   // Front/back travel is independent of row spacing, so a dense rig does not
   // collapse this motion into tiny strips directly below each truss.
   x=.12+.76*u;
   y=.5+.32*Math.sin(phase-r*Math.PI*.6-row*.45)*side;
   level=.55+.45*(.5+.5*Math.cos(phase-r*Math.PI*.6-row*.45));break;
  case 'rotating-fan':{
   const angle=Math.sin(phase)*.85*side+(motion.coordination==='ordered'?0:row%2?-.35:.35);
   x=.5+r*.39*Math.cos(angle);
   y=.5+r*.32*Math.sin(angle)+.09*Math.cos(phase);
   level=outerPair||centerPair?1:.45;break;
  }
  case 'crossed-banks':{
   // Opposing banks trace separate ribbons, without aiming all heads at one point.
   const bank=rank<count/2?-1:1,turn=Math.sin(phase)*side;
   x=.5+bank*(.2+.09*Math.cos(phase))+r*.08;
   y=.5-bank*.25*turn+r*.13;
   level=bank<0?.7+.3*Math.cos(phase)**2:.7+.3*Math.sin(phase)**2;break;
  }
  case 'parallel-sweep':
   x=.5+r*.29+.12*Math.sin(phase)*side;
   y=.5+.27*Math.cos(phase);break;
  case 'breathing-arch':{
   const opening=.24+.12*(.5+.5*Math.sin(phase));
   x=.5+r*opening;y=.32+.27*(1-r*r)+.09*Math.cos(phase);break;
  }
  case 'hinged-lines':{
   const bank=r<0?-1:1,member=Math.abs(r),angle=.6*Math.sin(phase)*side;
   x=.5+bank*(.1+member*.29*Math.cos(angle));
   y=.5+bank*member*.27*Math.sin(angle);break;
  }
  case 'gather':{
   const width=.08+.32*(.5+.5*Math.cos(phase));
   x=.5+r*width;y=depth+(1-r*r)*depthSpan*Math.sin(phase);
   const density=.25+.75*(width-.08)/.32;
   const order=(slots-1-pair)/Math.max(1,slots-1);
   level=centerPair?1:1-ease((order-density)/.18);break;
  }
 }
 // Ordered passages keep separate depth bands for each row. The whole
 // picture shares its development; rows do not criss-cross the same centre.
 if((motion.coordination==='ordered'||motion.coordination==='build')&&!['curtain','traveling-group','frame-center','mirror-pairs','opening-lines'].includes(motion.composition)){
  const band=.26+.48*(row+.5)/Math.max(1,groups);
  y=band+(y-.5)*.55;
 }
 // During a long passage, rows softly exchange how broadly they carry the
 // figure. Partners keep the same phase and dimmer; only geometric reach varies.
 if(motion.development){
  const turn=ease(p),lead=motion.development.index%3;
  const before=row%3===lead?1:.78,after=row%3===(lead+1)%3?1:.78;
  const reach=before+(after-before)*turn;
  x=.5+(x-.5)*reach;
  y=depth+(y-depth)*reach;
 }
 // Sparse lead figures retain supporting members during sustained high energy.
 // This changes occupancy, never the source dimmer or an authored blackout.
 const intensity=ease(((motion.energy??0)-.65)/.25);
 level=level+(1-level)*.45*intensity;
 const envelope=motion.envelopeProgress??p;
 const weight=ease(envelope/.12)*(motion.coordination==='build'?1:ease((1-envelope)/.12))*clamp(motion.amount??1);
 // Expand about the room centre, without clipping targets into edge piles.
 const extent=(motion.intent?.extent??1)*(1-.12*(motion.anticipation??0))*(1+.04*(motion.accent??0));
 // Identity at extent=1 and continuous on either side. The former tanh
 // branch had a different shape even arbitrarily close to one, causing jumps.
 const spread=v=>{const d=v-.5;return .5+d*extent/(1+2*Math.abs(d)*(extent-1));};
 if(extent!==1){x=spread(x);y=spread(y);}
 const staging=motion.intent?.staging;
 if(staging){
  const reserve=staging.space+(motion.coordination==='build'?(1-staging.space)*ease(p):0);
  const variation=motion.theme?.occurrence?1+.04*Math.sin(motion.theme.occurrence*Math.PI/2):1;
  x=.5+(x-.5)*reserve*variation;y=.5+(y-.5)*reserve;
 }
 // Lead rows have a smaller excursion, not a different cycle speed.
 if(leadRow){const reach=1-.2*attention.confidence;x=.5+(x-.5)*reach;y=depth+(y-depth)*reach;}
 const wallBlend=motion.intent?.surface==='wall'?1:motion.intent?.surface==='rise'?ease(p):0;
 return {wallBlend,paired:motion.intent?.symmetry==='paired'?1:0,x:motion.intent?.symmetry==='paired'&&rank===(count-1)/2?.5:clamp(x),y:clamp(y),level:motion.presentation==='show'?1:1+(clamp(level)-1)*weight,weight,articulation:motion.intent?.articulation??(.15+.3*clamp(motion.energy??0)*clamp(motion.drive??0))};
}
export function presenceComposition(presence,rank,count,row=0,groups=1){
 if(!presence)return null;
 if(!presence.layers)return groupComposition(presence.groupMotion,rank,count,row,groups);
 let sum=0,x=0,y=0,level=0,weight=0,articulation=0,paired=0,wallBlend=0;
 for(const layer of presence.layers){
  const w=layer.weight??1,c=presenceComposition(layer,rank,count,row,groups);sum+=w;
  level+=(c?.level??1)*w;
  if(c){const amount=c.weight*w;weight+=amount;wallBlend+=(c.wallBlend??0)*amount;paired+=(c.paired??0)*amount;articulation+=c.articulation*amount;x+=c.x*amount;y+=c.y*amount;}
 }
 return weight>0?{wallBlend:wallBlend/weight,paired:paired/weight,x:x/weight,y:y/weight,level:level/Math.max(.0001,sum),weight:weight/Math.max(.0001,sum),articulation:articulation/weight}:null;
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

// Resolve the lead within the rows already selected by occupancy. No second
// fixture-count dimmer: one selected row stays at source strength, always.
export function presenceRowFocus(presence,row,groups){
 if(!presence)return {gain:1,lead:1};
 if(presence.layers){
  let gain=0,lead=0,total=0;
  for(const layer of presence.layers){const w=layer.weight??1,v=presenceRowFocus(layer,row,groups);gain+=v.gain*w;lead+=v.lead*w;total+=w;}
  return total?{gain:gain/total,lead:lead/total}:{gain:1,lead:1};
 }
 const count=Math.max(1,Math.min(groups,Math.ceil(groups*(presence.rowFraction??1))));
 const rank=((row-(presence.rowSelection??0))%groups+groups)%groups;
 const evaluate=motion=>{
  const staging=motion?.intent?.staging;
  if(!staging||groups<3||count<2)return {gain:1,lead:1};
  const lead=rank===(staging.lead%count)?1:0;
  const amount=Math.max(0,Math.min(1,motion.amount??1));
  const gain=1-(1-lead)*(1-staging.accompaniment)*amount;
  return {gain,lead};
 };
 const motion=presence.groupMotion,current=evaluate(motion);
 if(!motion?.from)return current;
 const previous=evaluate({...motion.from,amount:motion.amount}),t=motion.blend;
 return {gain:previous.gain+(current.gain-previous.gain)*t,lead:previous.lead+(current.lead-previous.lead)*t};
}
