import {automaticGroupMotionAt,automaticFixtureGroups,groupComposition} from './dmx-group-motion.js';
import {showScoreAt} from './show-score.js';
import {showActionAt} from './show-action.js';
import {lightingScenes,lightingSceneAt,scenePresence,bassPresence} from './dmx-light-scenes.js';
import {instrumentDevelopment,instrumentRests} from './instrument-activity.js';
// Whole-rig pauses are reserved for measured musical withdrawals. Measured
// bass attacks can hand the light between groups within an active passage.
const cache=new WeakMap(),restCache=new WeakMap();
const quiet=look=>/held|quiet|break|outro/.test(look||'');
const smooth=value=>{const v=Math.max(0,Math.min(1,value));return v*v*(3-2*v);};
function buildFor(section,drama){
  if(section.end-section.start<4||!(drama?.step>0)||!drama.intensity?.length)return null;
  const times=[],values=[];
  for(let time=section.start;time<section.end;time+=.5){
    const a=Math.max(0,Math.floor(section.start/drama.step),Math.floor((time-.75)/drama.step)),b=Math.min(drama.intensity.length,Math.ceil(Math.min(time+.75,section.end)/drama.step));
    if(b<=a)return null;
    let sum=0;for(let i=a;i<b;i++){if(!Number.isFinite(drama.intensity[i]))return null;sum+=drama.intensity[i];}
    times.push(time);values.push(sum/(b-a));
  }
  let anchor=0;
  if(drama.local&&values.at(-1)>values[0]){
    // A withdrawal followed by a riser has its start at the trough, not at
    // the louder section boundary. Do not count the withdrawal as build motion.
    for(let i=1;i<Math.floor(values.length/2);i++)if(values[i]<values[anchor])anchor=i;
  }
  const change=values.at(-1)-values[anchor];
  const variation=values.slice(anchor+1).reduce((sum,v,i)=>sum+Math.abs(v-values[anchor+i]),0);
  // A sustained measured trend qualifies; oscillating groove energy does not.
  const coherence=Math.abs(change)/Math.max(.001,variation);
  if(Math.abs(change)<.18||coherence<(section.look==='lift'&&Math.abs(change)>=.35?.33:.4))return null;
  let progress=0;
  const levels=values.map((v,i)=>{if(i<anchor)return 0;progress=Math.max(progress,Math.min(1,Math.max(0,(v-values[anchor])/change)));return change>0?progress:1-progress;});
  // A measured atmospheric withdrawal is a deliberate fade sequence, even
  // when bass or a tail remains audible. Let its final fixture finish too.
  const finishDark=change<=-.2&&values.at(-1)<=.18&&
    (quiet(section.look)||section.movement?.character==='atmospheric');
  return {start:section.start,end:section.end,look:section.look,kind:'build',direction:change>0?'rise':'fall',
    finishDark,leader:section.attention?.leader,times,levels};
}
function cuesFor(plan){
  if(cache.has(plan))return cache.get(plan);
  const sections=plan.sections||[],passages=plan.arrangement?.passages||[];
  const intensity=i=>sections[i]?.intensity??passages[i]?.intensity;
  const cues=[];
  const drama=plan.arrangement?.drama;
  const development=instrumentDevelopment(plan.structure?.instruments);
  const detect=section=>{
    // Complement a clipped quiet passage; a driving groove keeps its existing
    // intensity choreography. Require evidence, not just a section label.
    const samples=drama?.intensity?.slice(Math.floor(section.start/drama.step),Math.ceil(section.end/drama.step))||[];
    const clipped=samples.length&&samples.filter(v=>v<.12).length>=samples.length*.5;
    const raw=development?buildFor(section,development):null;
    if(raw?.direction==='fall'){
      const instruments=plan.structure.instruments;
      const rms=(start,end)=>{
        const a=Math.max(0,Math.floor(start/instruments.step)),b=Math.min(instruments.drums.length,Math.floor(end/instruments.step));
        let sum=0;for(let i=a;i<b;i++)for(const key of ['drums','bass','vocals','other'])sum+=instruments[key][i]**2;
        return Math.sqrt(sum/Math.max(1,b-a));
      };
      const opening=rms(section.start,section.start+.5),closing=rms(section.end-.5,section.end),arrival=rms(section.end,section.end+.5);
      // Use unsmoothed stems here: smoothing would leak the returning hit
      // backwards into the quiet endpoint and keep the final lamp on again.
      if(opening>=.025&&closing<=opening*.18&&arrival>=opening*.65)return {...raw,finishDark:true};
    }
    return (clipped?raw:null)||buildFor(section,drama);
  };
  for(let i=0;i<sections.length;i++){
    const section=sections[i],level=intensity(i),previous=intensity(i-1);
    if(!Number.isFinite(section.start)||!Number.isFinite(section.end))continue;
    // Detect developments within phrases, even in a verse or chorus. A section
    // label alone neither schedules a build nor suppresses measured evidence.
    const phrases=(plan.arrangement?.patterns?.phrases||[]).filter(p=>p.start>=section.start&&p.end<=section.end);
    const evidence=section.buildEvidence;
    const builds=evidence?.kind==='spectral'?[{start:section.start,end:section.end,look:section.look,kind:'build',direction:'rise',
      step:evidence.step,times:evidence.levels.map((_,i)=>section.start+i*evidence.step),levels:evidence.levels}]
      :(phrases.length?phrases:[section]).map(p=>detect({...p,look:section.look})).filter(Boolean);
    if(!builds.length){const whole=detect(section);if(whole)builds.push(whole);}
    // An already energetic peak does not restart fixture entrances for a
    // small remaining rise. Genuine withdrawals still keep their choreography.
    if(section.look==='peak'&&drama)for(let k=builds.length-1;k>=0;k--){
      const build=builds[k],samples=drama.intensity.slice(Math.floor(build.start/drama.step),Math.ceil((build.start+.75)/drama.step));
      if(build.direction==='rise'&&samples.length&&samples.reduce((a,b)=>a+b,0)/samples.length>=.55)builds.splice(k,1);
    }
    if(builds.length){
      for(const build of builds){
        const prior=cues.at(-1);
        const joined=prior?.kind==='build'&&!prior.step&&!build.step&&!prior.finishDark&&!build.finishDark&&prior.look===build.look&&prior.direction===build.direction&&Math.abs(prior.end-build.start)<.001
          ?detect({start:prior.start,end:build.end,look:build.look}):null;
        if(joined&&joined.direction===build.direction)cues[cues.length-1]=joined;else cues.push(build);
      }
      continue;
    }
    if(!quiet(section.look)||!Number.isFinite(level)||!Number.isFinite(previous)||
      level>.35||previous-level<.18||section.end-section.start<3)continue;
    // A quiet structural label or a lower relative level must not erase an
    // audible beat. Raw instrument withdrawals and measured blackouts still win.
    if(lightingScenes(plan).some(scene=>scene.start<section.end&&scene.end>section.start&&scene.drive>=.45))continue;
    cues.push({start:section.start,end:section.end,kind:'rest'});
  }
  // One standout per development may briefly feature a single head. Ordinary
  // beats do not run a chase; the emphasis always returns to the base formation.
  const arrangement=plan.arrangement;
  cues.forEach((cue,ordinal)=>{
    if(cue.kind!=='build')return;
    // A voice gets a central entrance, percussion can fill the room from its
    // edges. Mixed passages vary their formation only at a measured development.
    cue.formation=cue.leader==='vocals'?'centre':cue.leader==='drums'?'outside':['centre','outside','across'][ordinal%3];
    cue.side=ordinal%2;
    let selected=-1;
    for(let i=0;i<(arrangement?.times?.length||0);i++){
      const time=arrangement.times[i],salience=arrangement.eventSalience?.[i];
      if(time<cue.start+1||time>cue.end-1||!Number.isFinite(salience)||salience<.45)continue;
      if(selected<0||salience>arrangement.eventSalience[selected])selected=i;
    }
    if(selected>=0)cue.focus={time:arrangement.times[selected],side:ordinal%2};
  });
  cache.set(plan,cues);return cues;
}
export function activityAt(source,units){
  const plan=source.movingPlan,time=source.songTime;
  let cue=null,amount=0,expansion=1,darkness=1;
  const blackouts=plan?.arrangement?.blackouts||[];
  if(Number.isFinite(time)&&blackouts.length){
    let lo=0,hi=blackouts.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(blackouts[mid].start<=time)lo=mid+1;else hi=mid;}
    const stop=blackouts[lo-1];
    if(stop&&time<stop.end)darkness=1-smooth((time-stop.start)/.06);
  }
  if(plan&&Number.isFinite(time)){
    let rests=restCache.get(plan);
    if(!rests){rests=instrumentRests(plan.structure?.instruments);restCache.set(plan,rests);}
    let lo=0,hi=rests.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(rests[mid].start<=time)lo=mid+1;else hi=mid;}
    const rest=rests[lo-1];
    if(rest&&time<rest.end)darkness*=1-smooth((time-rest.start)/.6);
  }
  if(darkness===0)return Array(units).fill(0);
  if(plan&&Number.isFinite(time)){
    const cues=cuesFor(plan);
    let lo=0,hi=cues.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].start<=time)lo=mid+1;else hi=mid;}
    const selected=cues[lo-1];
    if(selected&&time<selected.end&&(selected.kind==='build'?source.look===selected.look:quiet(source.look))){
      cue=selected;
      amount=smooth((time-cue.start)/.8)*(cue.finishDark?1:smooth((cue.end-time)/.6));
      if(cue.kind==='build'){
        const position=(time-cue.start)/(cue.step||.5),index=Math.min(cue.levels.length-1,Math.floor(position));
        expansion=cue.levels[index]+(cue.levels[Math.min(index+1,cue.levels.length-1)]-cue.levels[index])*smooth(position-Math.floor(position));
      }
    }
  }
  const age=cue?.focus?time-cue.focus.time:-1;
  const emphasis=!(cue?.finishDark&&expansion<.2)&&age>=0&&age<.8?smooth(age/.12)*(1-smooth((age-.12)/.68)):0;
  const focused=cue?.direction==='fall'?(cue.focus?.side?Math.floor(units/2):Math.floor((units-1)/2)):(cue?.focus?.side?units-1:0);
  const order=cue?.kind==='build'?Array.from({length:units},(_,i)=>i).sort((a,b)=>{
    const distance=i=>Math.abs(i-(units-1)/2);
    const primary=cue.formation==='across'?a-b:cue.formation==='outside'?distance(b)-distance(a):distance(a)-distance(b);
    return cue.formation==='across'&&cue.side?-primary:primary||(cue.side?b-a:a-b);
  }):null;
  const ranks=[];order?.forEach((fixture,rank)=>{ranks[fixture]=rank;});
  return Array.from({length:units},(_,i)=>{
    if(!cue)return darkness;
    if(units<=2)return darkness*(cue.kind==='rest'?1-amount*.85:cue.finishDark?1-amount*(1-smooth(expansion/.2)):1);
    const rank=ranks[i];
    // Stage individual entrances through the measured rise/fall. This is only
    // active inside a development, not an ongoing single-fixture chase.
    // Residual light belongs to the whole rig, never to a protected leader.
    // Individual fixtures may lead a measured sequence, above that shared base.
    const staged=smooth(expansion*units-rank);
    const level=cue.kind==='build'?(cue.finishDark?staged:.12+.88*staged):.15;
    const base=1-amount*(1-level);
    return darkness*(i===focused?base+(1-base)*emphasis:base*(1-.35*emphasis));
  });
}

// Moving beams are accents above the base lighting, not a permanently lit rig.
// Decide density per musical section so individual beats cannot chatter the mask.
const presenceCache=new WeakMap();
function presenceSections(plan){
 if(presenceCache.has(plan))return presenceCache.get(plan);
 const drama=plan.arrangement?.drama;
 const profiles=(plan.sections||[]).map(section=>{
  const mean=key=>{
   if(!(drama?.step>0))return undefined;
   const values=drama[key]?.slice(Math.max(0,Math.floor(section.start/drama.step)),Math.ceil(section.end/drama.step)).filter(Number.isFinite)||[];
   return values.length?values.reduce((sum,v)=>sum+v,0)/values.length:undefined;
  };
  const energy=mean('intensity')??section.intensity??.4,vocals=mean('vocalShare')??0;
  if(quiet(section.look))return {level:0,spread:0};
  if(vocals<.55&&(energy>=.75||section.look==='peak'&&energy>=.6))return {level:.85,spread:1};
  if(section.look==='lift')return {level:.8,spread:.35};
  return {level:vocals>=.55?.55:.75,spread:vocals>=.55?0:energy>=.6?.65:energy>=.45?1/3:0};
 });
 presenceCache.set(plan,profiles);return profiles;
}
// Keep discrete group identities while blending; interpolating a group number
// would briefly select unrelated heads during section changes or deck mixes.
export function mixMovingPresence(entries){
 const layers=entries.flatMap(({presence,weight})=>(presence.layers||[presence]).map(layer=>({...layer,weight:(layer.weight??1)*weight})));
 return {level:layers.reduce((sum,p)=>sum+p.level*p.weight,0),spread:layers.reduce((sum,p)=>sum+p.spread*p.weight,0),layers};
}
export function movingPresenceAt(source){
 const plan=source.movingPlan,time=source.songTime;
 const scene=(!source.movingMood||source.movingMood==='balanced'||source.movingMood==='show')&&lightingSceneAt(plan,time);
 if(scene){
  if(source.movingMood==='show'){
   const level=activityAt(source,1)[0],action=showActionAt(plan,time),picture=showScoreAt(plan,time);
   const selection=picture?{occupancy:picture.occupancy,selection:picture.index%2,rowFraction:picture.rowFraction,rowSelection:picture.rowSelection}:{};
   const rhythm=plan.sectionLighting?.find(s=>time>=s.start&&time<s.end)?.rhythm;
   if(action&&(!rhythm||rhythm==='auto')&&action.cue.action!=='hit')return {level,spread:1,...selection,mask:'show-action',action:action.cue.action,phase:action.cue.phase,progress:action.progress,amount:Math.max(0,Math.min(1,source.flicker??1))};
   return rhythm&&rhythm!=='auto'?{level,spread:1,mask:'all'}:{level,spread:1,...selection,mask:'show-score'};
  }
  const scenes=lightingScenes(plan),previous=scenes[scene.index-1];
  const t=smooth((time-scene.start)/(scene.kind==='impact'?.2:.8));
  const presence=mixMovingPresence([{presence:previous?scenePresence(previous,plan,previous.end-.001):{level:0,spread:0},weight:1-t},{presence:scenePresence(scene,plan,time),weight:t}]);
  const darkness=activityAt(source,1)[0];
  const groupMotion=automaticGroupMotionAt(plan,time);
  const manual=plan.sectionLighting?.some(s=>time>=s.start&&time<s.end&&s.rhythm&&s.rhythm!=='auto');
  return {...presence,level:presence.level*darkness,layers:presence.layers.map((p,i)=>{
   const section=i===0?previous:scene;
   // Sustained energetic grooves need room too, not only contrast-driven impacts.
   const intensity=section&&section.drive>=.45?smooth((section.energy-.65)/.25):0;
   const rowFraction=section?.kind==='impact'?.67:.34+.33*intensity;
   return {...p,level:p.level*darkness,groupMotion:manual?null:groupMotion,...(!manual?{rowFraction,rowSelection:section?.groupIndex??0,supportSelection:section?.groupIndex??0,supportLevel:section?.kind==='silence'?0:section?.kind==='impact'?.85:section?.kind==='build'?.65:.5}:{})};
  })};
 }
 const profiles=plan?presenceSections(plan):[];
 const sections=plan?.sections||[];
 const index=Number.isFinite(time)?sections.findIndex(s=>time>=s.start&&time<s.end):-1;
 const phrases=plan?.arrangement?.patterns?.phrases||[];
 const phraseIndex=Number.isFinite(time)?phrases.findIndex(p=>time>=p.start&&time<p.end):-1;
 const segment=phraseIndex>=0?phrases[phraseIndex]:sections[index];
 const group=phraseIndex>=0?phraseIndex:Math.max(0,index);
 const fallback={level:quiet(source.look)?0:.65,spread:1/3};
 const current={...(profiles[index]||fallback),group};
 let presence=current;
 if(segment){
  const previousTime=segment.start-.0001,previousIndex=sections.findIndex(s=>previousTime>=s.start&&previousTime<s.end);
  const previous={...(profiles[previousIndex]||{level:0,spread:0}),group:Math.max(0,group-1)};
  const fade=smooth((time-segment.start)/Math.min(1.2,(segment.end-segment.start)/2));
  presence=mixMovingPresence([{presence:previous,weight:1-fade},{presence:current,weight:fade}]);
 }
 const bass=plan&&bassPresence(lightingSceneAt(plan,time),plan,time);
 if(bass)presence=bass;
 const darkness=activityAt(source,1)[0];
 return {...presence,level:presence.level*darkness,...(presence.layers?{layers:presence.layers.map(p=>({...p,level:p.level*darkness}))}:{})};
}
export function movingPresenceLevel(presence,rank,count){
 if(!presence)return 1;
 if(presence.layers)return presence.layers.reduce((sum,p)=>sum+(p.weight??1)*movingPresenceLevel(p,rank,count),0);
 const slots=Math.ceil(count/2),slot=Math.min(rank,count-1-rank);
 if(presence.occupancy!==undefined){
  const n=Math.max(1,Math.ceil(slots*presence.occupancy)),selected=presence.selection?slots-1-slot:slot;
  if(presence.occupancy<=0||selected>=n)return 0;
 }
 if(presence.mask==='show-score')return presence.level;
 if(presence.mask==='show-action'){
  if(count===1)return presence.level;
  const p=presence.progress,amount=presence.amount??1;
  const recover=smooth((p-.72)/.28);
  const radius=slots===1?0:(slots-1-slot)/(slots-1);
  const group=count===2?rank:slot%2;
  const staged=presence.action==='launch'?smooth(p*2-radius):group===presence.phase?1-smooth((p-.35)/.25):smooth((p-.12)/.25);
  return presence.level*(1-amount*(1-staged)*(1-recover));
 }
 if(presence.mask==='bass-chase'){
  if(count===1)return presence.level;
  // Evaluate discrete groups AFTER expansion to the physical rig: interpolated
  // four-head masks otherwise leave the extra heads permanently half lit.
  // Mirrored pairs preserve the formation on even and odd rigs alike.
  const group=count===2?rank:slot%2;
  const delay=group===presence.phase?0:Math.min(.075,presence.duration*.22);
  const age=presence.age-delay;
  const pulse=group===presence.phase?1-smooth((age-presence.duration*.48)/.07):smooth(age/.025);
  // Rejoin the underlying full picture at the end, without an all-rig blackout.
  const recover=smooth((presence.age-presence.duration+.075)/.075);
  return presence.level*(pulse+(1-pulse)*recover);
 }
 if(presence.mask==='roles'&&presence.roles?.length){
  const at=(count===1?.5:rank/(count-1))*(presence.roles.length-1),lo=Math.floor(at),hi=Math.min(presence.roles.length-1,lo+1);
  return presence.level*(presence.roles[lo]+(presence.roles[hi]-presence.roles[lo])*(at-lo));
 }
 if(presence.mask==='all')return presence.level;
 if(presence.mask==='edges')return presence.level*(slot===0?1:0);
 if(presence.mask==='gather')return presence.level*smooth(1+presence.spread*(slots-1)-slot);
 if(presence.mask==='center')return presence.level*(slot===slots-1?1:0);
 if(presence.mask==='answer')return presence.level*(slot%2===0?(presence.pairMix??1):1-(presence.pairMix??1));
 if(presence.mask==='expand')return presence.level*smooth(1+presence.spread*(slots-1)-(slots-1-slot));
 const order=(slot-(presence.group||0)%slots+slots)%slots;
 // Select whole groups at useful brightness. Fractional density used to
 // leave extra beams barely visible and looked like only one active pair.
 const budget=Math.min(slots,Math.max(2,Math.round(1+(slots-1)*presence.spread)));
 return presence.level*smooth(budget-order);
}
export function applyMovingPresence(lights){
 const ordered=lights.filter(l=>l.type==='moving').sort((a,b)=>a.position.x-b.position.x||String(a.id).localeCompare(String(b.id)));
 const ranks=new Map(ordered.map((l,i)=>[l.id,i]));
 // Select complete spatial rows, then articulate mirrored pairs within each row.
 // Four source heads cannot represent these group identities before expansion.
 const rows=[];
 if(ordered.length>=16&&ordered.some(l=>(l.movingPresence?.layers||[l.movingPresence]).some(p=>Number.isFinite(p?.rowFraction))))for(const light of [...ordered].sort((a,b)=>(a.position.y??0)-(b.position.y??0))){
  let row=rows.at(-1);
  if(!row||Math.abs(row.y-(light.position.y??0))>.3)rows.push(row={y:light.position.y??0,lights:[]});
  row.lights.push(light);
 }
 const rowById=new Map();
 if(rows.length>=2&&rows.every(r=>r.lights.length>=4))rows.forEach((row,index)=>{
  row.lights.sort((a,b)=>a.position.x-b.position.x||String(a.id).localeCompare(String(b.id)));
  row.lights.forEach((light,rank)=>rowById.set(light.id,{index,rank,count:row.lights.length}));
 });
 let groupCount=rows.length;
 if(ordered.some(l=>(l.movingPresence?.layers||[l.movingPresence]).some(p=>p?.groupMotion))){
  const groups=automaticFixtureGroups(ordered.map(l=>({id:l.id,position:l.position,group:l.motionGroup})));
  groupCount=Math.max(0,...[...groups.values()].map(g=>g.row+1));
  for(const [id,g] of groups)rowById.set(id,{...g,index:g.row});
 }
 function level(presence,light){
  if(presence.layers)return presence.layers.reduce((sum,p)=>sum+level(p,light)*(p.weight??1),0);
  const row=rowById.get(light.id);
  if(row&&Number.isFinite(presence.rowFraction)){
   const budget=Math.max(1,Math.ceil(groupCount*presence.rowFraction));
   const offset=(presence.rowSelection??0)%groupCount;
   if((row.index-offset+groupCount)%groupCount>=budget)return 0;
   const composition=groupComposition(presence.groupMotion,row.rank,row.count,row.index,groupCount);
   const base=movingPresenceLevel(presence,row.rank,row.count);
   // One composition owns membership. Multiplying two unrelated pair masks
   // could accidentally black out the entire figure on odd-sized rigs.
   return composition?base+(presence.level*composition.level-base)*composition.weight:base;
  }
  return movingPresenceLevel(presence,ranks.get(light.id),ordered.length);
 }
 return lights.map(l=>l.type==='moving'&&l.movingPresence&&Number.isFinite(l.movingPresenceBasePower)
  ?{...l,movingGroupActive:l.movingPresenceBasePower>0&&(l.movingPresence.layers||[l.movingPresence]).some(p=>(p.weight??1)>0&&p.level>0&&(p.mask==='bass-chase'||p.mask==='show-action'||!!p.groupMotion)),power:l.movingPresenceBasePower*level(l.movingPresence,l)*(l.movingShutter??1)}:l);
}
