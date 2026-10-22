const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
const counterparts={
 'parallel-lines':'diagonal-plane','diagonal-plane':'parallel-lines','open-fan':'crossed-fans','crossed-fans':'open-fan',
 'split-wings':'twin-fans','twin-fans':'split-wings','rising-arch':'vaulted-roof','vaulted-roof':'rising-arch',
 crown:'concentric-fans','concentric-fans':'crown','layered-steps':'chevron-stack','chevron-stack':'layered-steps',
 lattice:'crossed-sheets','crossed-sheets':'lattice','braided-ribbons':'double-helix','double-helix':'braided-ribbons',
 diamond:'hourglass',hourglass:'diamond','nested-gates':'portal-rows','portal-rows':'nested-gates',
 'traveling-wave':'folded-roof','folded-roof':'traveling-wave','converging-lines':'open-fan',
 'radial-wheel':'spiral-shell','spiral-shell':'radial-wheel','folding-blades':'opposed-diagonals',
 'opposed-diagonals':'folding-blades','horizontal-sheets':'vertical-curtain','vertical-curtain':'horizontal-sheets',
 'split-foci':'split-wings',rake:'split-curtain','split-curtain':'rake'
};
const upper=(points,time)=>{let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].time<=time)lo=mid+1;else hi=mid;}return lo;};

// The grid identifies musical positions; an agreeing prepared attack must
// actually exist there. Never turn an empty grid into fabricated source hits.
function measuredMetricEntrances(events,grid,stride,beat,start,end){
 const result=[],used=new Set();
 for(let i=0;i<grid.length;i+=stride){
  const time=grid[i];if(time<start||time>=end)continue;
  const at=upper(events,time),nearest=[events[at-1],events[at]].filter(Boolean)
   .sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
  if(nearest&&nearest.time>=start&&nearest.time<end&&Math.abs(nearest.time-time)<=beat*.22&&!used.has(nearest.time)){
   result.push({time:nearest.time,strength:clamp(nearest.strength??.7)});used.add(nearest.time);
  }
 }
 return result;
}

// An action owns geometry AND participating groups. It is planned at musical
// boundaries, with measured entrances as cues, rather than added over a motor.
export function planFormationAction(story,plan,timeline){
 const {start,end,motion}=story,evidence=story.musicalEvidence??{};
 const beats=(plan.beatGrid?.beats??[]).filter(t=>t>=start&&t<=end);
 const gaps=beats.slice(1).map((t,i)=>t-beats[i]).filter(t=>t>.2&&t<1.5).sort((a,b)=>a-b);
 const beat=gaps[Math.floor(gaps.length/2)]??.5;
 let source=evidence.texture==='bass'?'bass':evidence.texture==='drums'?'drums':'lead';
 let entrances=(timeline.roles[source]??[]).filter(e=>e.time>=start&&e.time<end),melodic=false,expressive=false;
 // A sustained section may contain a clear melodic line even when drum/bass
 // analysis sees no attacks. Its section label must not discard those notes.
 if(motion==='suspend'||evidence.texture==='voice'||evidence.texture==='melody'){
  const notes=(plan.score?.notes??[]).filter(n=>n.start>=start&&n.start<end&&n.end-n.start>=.12&&(n.confidence==null||n.confidence>=.65))
   .map(n=>({time:n.start,strength:n.confidence??.7}));
  if(notes.length>=2){entrances=notes;source='melody';melodic=true;}
 }
 if(motion==='suspend'&&!melodic){
  const contour=(timeline.rows??[]).filter(e=>e.time>=start&&e.time<end);
  let anchor=contour[0];const changes=[];
  for(const row of contour)if(anchor&&row.time-anchor.time>=Math.max(.8,beat*2)&&
   Math.abs(row.energy-anchor.energy)+Math.abs(row.tone-anchor.tone)>.09){
    changes.push({time:row.time,strength:clamp(row.energy)});anchor=row;
   }
  if(changes.length>=2){entrances=changes;source='expression';expressive=true;}
 }
 if(entrances.length<2&&evidence.energy>.12){
  const alternatives=['drums','bass','lead'].map(source=>({source,events:(timeline.roles[source]??[]).filter(e=>e.time>=start&&e.time<end)}));
  const audible=alternatives.sort((a,b)=>b.events.length-a.events.length)[0];
  if(audible.events.length>=2){source=audible.source;entrances=audible.events;}
 }
 let selected=[];
 for(const e of entrances)if(!selected.length||e.time-selected.at(-1).time>=beat*2-.025)selected.push({time:e.time,strength:clamp(e.strength??.7)});
 const rhythmic=!melodic&&['relay','dialogue','weave','bloom'].includes(motion)&&
  (evidence.texture==='drums'||evidence.texture==='bass'||evidence.movementDrive>.55);
 const prepared=timeline.roles.lead??[],grid=plan.beatGrid?.beats??[];
 const cueStride=evidence.texture==='drums'&&evidence.density>.45&&evidence.movementDrive>.6?1:2;
 const metric=rhythmic?measuredMetricEntrances(prepared,grid,cueStride,beat,start,end):[];
 const cueSource=metric.length>=2?'rhythm':source;
 if(cueSource==='rhythm')selected=metric;
 const kind=motion==='rest'?'rest':motion==='bloom'?'opening':motion==='gather'?'closing'
  :motion==='suspend'?(selected.length>=2&&evidence.energy>.12?'develop':'hold'):selected.length<2?'hold':motion==='dialogue'?'answer':motion==='weave'?'crossing':'handoff';
 const cues=selected.map((e,i)=>({...e,ordinal:i,group:i%4}));
 const clock=[{time:start,position:0}];
 for(const [i,e]of selected.entries())if(e.time>start+.02&&e.time<end-.02)clock.push({time:e.time,position:i/Math.max(1,selected.length-1)});
 clock.push({time:end,position:1});
 const slopes=clock.slice(1).map((b,i)=>(b.position-clock[i].position)/(b.time-clock[i].time));
 clock.forEach((p,i)=>{const a=slopes[Math.max(0,i-1)],b=slopes[Math.min(slopes.length-1,i)];p.velocity=a>0&&b>0?2/(1/a+1/b):0;});
 // Separate the speed of light answers from full-rig travel. Dense measured
 // percussion may answer every beat; broad motor strokes still get room.
 const articulated=rhythmic&&evidence.energy>.35&&
  (evidence.texture==='drums'&&evidence.drums>.4||evidence.texture==='bass'&&evidence.bass>.3||evidence.movementDrive>.65&&evidence.density>.35);
 const grouping=articulated?(evidence.texture==='bass'?'rows':'mirrored'):null;
 const from=kind==='opening'?'converging-lines':story.shape;
 // A sustained melodic fan should meet across the stage. Split wings send
 // every ray in a bank to the same outside direction and leave an empty centre.
 const quietTarget=story.shape==='rising-arch'?'vaulted-roof':evidence.tone>.55?'crossed-fans':'rising-arch';
 const to=kind==='develop'?quietTarget:kind==='opening'?story.shape:kind==='closing'?'converging-lines':kind==='hold'||kind==='rest'?story.shape:counterparts[story.shape]??story.shape;
 // The opening track belongs to the whole musical arc, including earlier
 // phrases. Once that arc is fully open, continue on measured entrances;
 // inspecting all its old points would hold every later phrase indefinitely.
 const fullyOpen=1-1e-9; // Ignore only the smoothing tail's numerical residue.
 const completed=kind==='opening'?story.opening?.findIndex(p=>p.position>=fullyOpen):-1;
 const openingComplete=completed>=0&&story.opening.slice(completed).every(p=>p.position>=fullyOpen)
  ?Math.max(start,story.opening[completed].time??start):Infinity;
 let movingOpening=openingComplete<end&&selected.filter(p=>p.time>=openingComplete).length>=2;
 let pathStart=movingOpening?openingComplete:start;
 const pathKinds=['handoff','answer','crossing'];
 const origin=movingOpening?story.shape:from;
 // Open, close and cross a gate instead of merely resizing another nearly
 // identical gate. The section's shared hero picture remains the origin.
 const destination=movingOpening&&['nested-gates','portal-rows'].includes(story.shape)?'crossed-fans':movingOpening?counterparts[story.shape]??to:to;
 // Crossing the full fan swaps the far left/right beam directions. On low
 // side banks, a one-bar Cartesian morph demands more angular speed than
 // the motors can supply. Give these large sweeps two bars, keeping the
 // source-driven light answers independent of the slower full-rig stroke.
 const wideCrossing=(a,b)=>a==='crossed-fans'&&['open-fan','nested-gates','portal-rows'].includes(b)
  ||a==='braided-ribbons'&&b==='double-helix'||a==='diamond'&&b==='hourglass';
 const minimumBars=wideCrossing(origin,destination)||wideCrossing(destination,origin)?2:1;
 const stride=Math.max(minimumBars,evidence.movementDrive>.55?1:2);
 const statement=beat*4*stride,turns=[];
 // Do not squeeze a new full-rig sweep into a short tail of the opening.
 if(movingOpening&&pathStart>start&&end-pathStart<statement){movingOpening=false;pathStart=start;}
 let last=pathStart;
 const bars=plan.beatGrid?.downbeats??[];
 const cycleGrid=bars.length?bars:grid,anchor=Math.max(0,cycleGrid.findIndex(t=>t>=pathStart-beat*.22));
 const metricalTurns=cueSource==='rhythm'?measuredMetricEntrances(prepared,minimumBars>1?cycleGrid.slice(anchor):cycleGrid,bars.length?stride:stride*4,beat,
  pathStart+(minimumBars>1?statement-beat*.22:beat*2),end-(minimumBars>1?statement-beat*.22:beat*2)):[];
 if(metricalTurns.length)turns.push(...metricalTurns);
 else for(const e of selected)if(e.time-last>=statement-.025&&end-e.time>=(minimumBars>1?statement-.025:beat*2)){turns.push(e);last=e.time;}
 const third=kind==='handoff'&&evidence.drums>.4&&evidence.energy>.5&&minimumBars===1
  ?({'parallel-lines':'horizontal-sheets','diagonal-plane':'rake','vertical-curtain':'layered-steps',
   lattice:'layered-steps','folding-blades':'opposed-diagonals','crossed-sheets':'split-curtain'})[origin]:null;
 const path=pathKinds.includes(kind)||movingOpening?[
  {time:pathStart,shape:origin},
  ...turns.map((e,i)=>({time:e.time,shape:i%2===0?destination:third&&i%4===1?third:origin}))
 ]:null;
 if(path){const last=path.at(-1);path.push({time:end,shape:last.shape===origin?destination:origin});}
 // These figures are journeys around a closed curve, not a morph between
 // two frozen samples of that curve. Use the measured beat transport so their
 // velocity survives bar lines and phrase cuts without an extra motor overlay.
 const cyclic=['radial-wheel','spiral-shell','traveling-wave','double-helix','braided-ribbons'];
 const flowingFans=['open-fan','nested-gates','portal-rows','crown','concentric-fans','twin-fans'];
 const continuous=(pathKinds.includes(kind)&&kind!=='answer'||kind==='develop')&&cyclic.includes(story.shape)
  ||movingOpening&&flowingFans.includes(story.shape);
 const trajectory=continuous&&beats.length>=3&&selected.length>=2
  ?{shape:story.shape,start:movingOpening?pathStart:start,clock:beats.map(time=>({time,position:grid.indexOf(time)})),
    period:evidence.movementDrive>.6?16:32,direction:story.direction??1,
    low:evidence.texture==='bass'||evidence.tone<.4}:null;
 const heightBand=Number.isFinite(evidence.tone)&&evidence.energy>.35&&
  (evidence.texture==='bass'||evidence.texture==='drums'&&evidence.tone<.48)
  ?{floor:evidence.texture==='bass'?.04:.08,span:evidence.texture==='bass'?.55:.7}:null;
 return {kind,source,cueSource,from,to,...(heightBand?{heightBand}:{}),...(trajectory?{trajectory}:{}),...(articulated?{grouping}:{}),...(path?{path}:{}),movingOpening,
  start,end,cues,clock,overlap:kind==='develop'?Math.min(.85,Math.max(.45,beat*2),...selected.slice(1).map((e,i)=>(e.time-selected[i].time)*.8)):cueSource==='rhythm'?Math.min(.12,beat*.2):Math.min(.3,beat*.6),direction:story.direction??1,
  reason:kind==='develop'?(melodic?'Melodiegeführte Entfaltung':'Klanggeführte Entwicklung'):kind==='answer'?'Musikalischer Ruf mit räumlicher Antwort':kind==='crossing'?'Gemeinsame Kreuzung zweier Strahlenbilder'
   :kind==='handoff'?'Übergabe zwischen benachbarten Lichtgruppen':kind==='opening'?'Gemeinsame Entfaltung':kind==='closing'?'Gemeinsame Zusammenführung':'Getragenes Lichtbild'};
}

// Compact, rig-independent geometry descriptors preserve the outgoing picture
// without retaining entire stories or sampling a particular installation.
export function formationActionGeometry(action,time,opening=1){
 const picture=(shape,progress=1)=>({shape,progress,...(action.heightBand?{heightBand:action.heightBand}:{})});
 if(action.trajectory&&time>=action.trajectory.start){
  const travel=action.trajectory,clock=travel.clock,i=Math.min(clock.length-2,Math.max(0,upper(clock,time)-1)),a=clock[i],b=clock[i+1];
  const phase=(a.position+(time-a.time)/(b.time-a.time)*(b.position-a.position))/travel.period*travel.direction;
  const target={orbit:travel.shape,phase,low:travel.low};
  // Connected entries retain their actual pose during the first statement.
  const span=Math.min(action.path?.[1]?.time??action.end,action.end)-travel.start;
  const join=ease((time-travel.start)/Math.max(.001,span));
  return !action.continueOrbit&&join<1?{a:action.entry??picture(travel.shape),b:target,join}:target;
 }
 if(action.path&&time>=action.path[0].time){
  const i=Math.max(0,upper(action.path,time)-1),a=action.path[i],b=action.path[Math.min(i+1,action.path.length-1)];
  const join=a===b?0:ease((time-a.time)/(b.time-a.time));
  return {a:i===0&&action.entry?action.entry:picture(a.shape),b:picture(b.shape),join,
   ...(a!==b?{curve:{t:clamp((time-a.time)/(b.time-a.time)),duration:b.time-a.time,
    ...(i>0?{before:i===1&&action.entry?action.entry:picture(action.path[i-1].shape),beforeDuration:a.time-action.path[i-1].time}:{}),
    ...(i+2<action.path.length?{after:picture(action.path[i+2].shape),afterDuration:action.path[i+2].time-b.time}:{})}}:{})};
 }
 const p=formationActionProgress(action,time),morph=['opening','closing'].includes(action.kind)?opening:action.kind==='hold'?.35+.3*p:p;
 return {a:action.entry??picture(action.from,morph),b:picture(action.to,morph),join:action.kind==='hold'?0:ease(morph),
  ...(action.kind==='opening'?{opening}:action.kind==='closing'?{closing:opening}:{})};
}
export function formationGeometryPose(geometry,rank,count,row,groups,spatialPose){
 if(geometry.orbit){
  if(groups>6&&count<=2){rank=count===1?row:rank===0?groups-1-row:groups+row;count*=groups;}
  const r=count>1?rank/(count-1)*2-1:0,phase=geometry.phase*Math.PI*2,layer=row/Math.max(1,groups-1);
  let x=.5+r*.44,y=.5,beamFocus=1;
  if(geometry.orbit==='traveling-wave')y=.5+Math.sin(r*Math.PI-phase)*.32;
  if(geometry.orbit==='double-helix')y=.5+Math.sin(r*Math.PI*2+phase+row*Math.PI)*.32;
  if(geometry.orbit==='braided-ribbons'){x=.5+r*.42*Math.cos(phase);y=.5+r*.3*Math.sin(phase);}
  if(geometry.orbit==='radial-wheel'||geometry.orbit==='spiral-shell'){
   const angle=rank/Math.max(1,count)*Math.PI*2+layer*Math.PI*.25+phase;
   const radius=geometry.orbit==='spiral-shell'?.12+.28*(r+1)/2:.4;
   x=.5+Math.cos(angle)*radius;y=.5+Math.sin(angle)*radius*.9;
  }
  if(['open-fan','nested-gates','portal-rows','crown','concentric-fans','twin-fans'].includes(geometry.orbit)){
   const pose=spatialPose(geometry.orbit,rank,count,row,groups,.5+.5*Math.cos(phase));
   x=.5+(pose.x-.5)*(.82+.15*Math.sin(phase));
   y=.08+pose.y*.45+.32*(.5+.5*Math.sin(phase));beamFocus=pose.beamFocus;
  }
  if(geometry.low)y=.06+y*.52;
  return {x,y,beamFocus};
 }
 if(geometry.frame)return {x:.5,y:.24+row/Math.max(1,groups-1)*.5,beamFocus:0};
 if(geometry.shape){
  // Many festival installations consist of small opposing pairs. Sampling
  // every pair as a complete two-ray fan discards all its interior rays.
  if(groups>6&&count<=2){rank=count===1?row:rank===0?groups-1-row:groups+row;count*=groups;}
  const pose=spatialPose(geometry.shape,rank,count,row,groups,geometry.progress??1);
  return geometry.heightBand?{...pose,y:geometry.heightBand.floor+pose.y*geometry.heightBand.span}:pose;
 }
 const a=formationGeometryPose(geometry.a,rank,count,row,groups,spatialPose),b=formationGeometryPose(geometry.b,rank,count,row,groups,spatialPose);
 const join=geometry.join;let x=a.x+(b.x-a.x)*join,y=a.y+(b.y-a.y)*join;
 let beamFocus=(a.beamFocus??1)+((b.beamFocus??1)-(a.beamFocus??1))*join;
 if(geometry.curve){
  const c=geometry.curve,before=c.before?formationGeometryPose(c.before,rank,count,row,groups,spatialPose):null,
   after=c.after?formationGeometryPose(c.after,rank,count,row,groups,spatialPose):null;
  const tangent=(left,right)=>left*right>0?2/(1/left+1/right):0;
  const interpolate=key=>{
   const slope=(b[key]-a[key])/c.duration,v0=before?tangent((a[key]-before[key])/c.beforeDuration,slope):0,
    v1=after?tangent(slope,(after[key]-b[key])/c.afterDuration):0,t=c.t,t2=t*t,t3=t2*t;
   return (2*t3-3*t2+1)*a[key]+(t3-2*t2+t)*c.duration*v0+(-2*t3+3*t2)*b[key]+(t3-t2)*c.duration*v1;
  };
  x=interpolate('x');y=interpolate('y');beamFocus=interpolate('beamFocus');
 }

 if(geometry.opening!==undefined){const p=ease(geometry.opening);x=.5+(x-.5)*(.2+.8*p);y=.28+(y-.28)*p;}
 if(geometry.closing!==undefined){const p=ease(geometry.closing);x+=(.5-x)*p;y+=(.4-y)*p;}
 return {x,y,beamFocus};
}
export function formationActionExit(action,opening=1){
 const geometry=formationActionGeometry(action,action.end,opening);
 // Prune completed morphs so successive scenes cannot accumulate a tree.
 if(geometry.opening===undefined&&geometry.closing===undefined)return geometry.join===1?geometry.b:geometry.join===0?geometry.a:geometry;
 if(geometry.opening===1)return geometry.b;
 return geometry;
}
export function formationActionProgress(action,time){
 const points=action.clock,i=Math.max(0,upper(points,time)-1),a=points[i],b=points[Math.min(i+1,points.length-1)];
 if(a.time===b.time)return a.position;
 const dt=b.time-a.time,t=clamp((time-a.time)/dt),t2=t*t,t3=t2*t;
 return clamp((2*t3-3*t2+1)*a.position+(t3-2*t2+t)*dt*a.velocity+(-2*t3+3*t2)*b.position+(t3-t2)*dt*b.velocity);
}
export function formationActionPose(action,time,rank,count,row,groups,spatialPose,opening=.5){
 const progress=formationActionProgress(action,time),u=count>1?rank/(count-1):.5,layer=row/Math.max(1,groups-1);
 const index=upper(action.cues,time)-1,cue=action.cues[index],prior=action.cues[index-1]??{group:action.entryGroup??cue?.group??0};
 const transfer=cue?ease((time-cue.time)/action.overlap):1;
 // The new group lands on the attack; the outgoing group may leave a short
 // tail. A symmetric fade would put the visible answer after the beat.
 const attack=cue&&action.cueSource==='rhythm'?ease((time-cue.time)/.012):transfer;
 // Irregular installations often have many two-head rows. Coordinate these
 // through depth, so an entire tower/ring installation can carry an answer.
 const depth=groups>6||count===1&&groups>1||action.grouping==='rows'&&groups>1;
 const radial=(action.grouping==='mirrored'||action.source==='bass'||action.kind==='develop'||action.kind==='crossing')&&count>2;
 const route=depth?layer:radial?Math.abs(u*2-1):u;
 const slots=Math.min(4,depth?groups:radial?Math.ceil(count/2):count);
 const unit=Math.min(slots-1,Math.floor(clamp(action.direction<0?1-route:route)*slots));
 const weight=group=>unit===group?1:0;
 const activeGroup=(cue?.ordinal??cue?.group??0)%slots,priorGroup=(prior.ordinal??prior.group??0)%slots;
 const lead=cue?(priorGroup===activeGroup?weight(activeGroup):Math.sqrt(weight(priorGroup)*(1-transfer)+weight(activeGroup)*attack)):unit===(action.entryGroup??0)%slots?1:0;
 const pair=count>1?(u<.5?0:1):row%2;
 const reply=cue?(cue.ordinal??index)%2:(action.entryGroup??0)%2;
 const previousReply=(action.cues[index-1]?.ordinal??action.entryGroup??cue?.ordinal??index)%2;
 const answer=cue?(previousReply===reply?(pair===reply?1:0):Math.sqrt((pair===previousReply?1:0)*(1-transfer)+(pair===reply?1:0)*attack)):pair===reply?1:0;
 let morph=progress,exposure=.12+.88*lead;
 if(action.kind==='answer'){morph=ease((progress-pair*.18)/.7);exposure=.12+.88*answer;}
 if(action.kind==='crossing')exposure=action.grouping ? .04+.96*lead : .25+.75*lead;
 if(action.kind==='handoff'&&action.grouping)exposure=.04+.96*lead;
 if(action.kind==='opening'){
  morph=opening;
  exposure=ease((opening-(Math.abs(u*2-1)*.65+layer*.35)*.8)/.17);
  if(action.movingOpening&&time>=action.path[0].time)exposure*=action.grouping ? .04+.96*lead : .65+.35*lead;
 }
 if(action.kind==='closing'){morph=opening;exposure=1-ease((opening-(1-Math.abs(u*2-1))*.65-layer*.15)/.25);}
 if(action.kind==='develop')exposure=.16+.7*ease((progress-route*.7)/.22)+.14*lead;
 if(action.kind==='hold'){
  morph=.35+.3*progress;
  exposure=count<=2?(layer<.1?1:layer>.9?.6:0):Math.abs(u-.5)<.18||Math.abs(u-.5)>.44?.65:0;
 }
 if(action.kind==='rest')exposure=0;
 const geometry=formationActionGeometry(action,time,opening);
 // Answers may stagger their wings while sharing the same geometric path.
 if(action.kind==='answer'&&!action.path)geometry.join=ease(morph);
 const {x,y,beamFocus}=formationGeometryPose(geometry,rank,count,row,groups,spatialPose);
 if(count===1&&groups===1&&action.kind!=='rest')exposure=1;
 return {x:clamp(x),y:clamp(y),beamFocus,exposure:clamp(exposure),progress,unit};
}
