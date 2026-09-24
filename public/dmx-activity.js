import {instrumentDevelopment,instrumentRests} from './instrument-activity.js';
// Light pauses are reserved for measured musical withdrawals. Accents and
// beat counts never alternate the active fixtures; brightness carries rhythm.
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
