import {transitionBlendScores,transitionTonalSegments} from './musical-transition.js';
import {beatPosition} from './beat-sync.js';
import {transitionSafeRanges,transitionCutTracks,cleanCuts,cleanCutJoins,cutJoinPlan} from './track-cuts.js';

const labels={smooth:'Sanfter Übergang',bass:'Bassübergabe',handover:'Kurze Überlagerung',cut:'Kurzer Wechsel'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unique=values=>[...new Set(values.filter(Number.isFinite).map(v=>Math.round(v*100000)/100000))];

// Only analysis needed for this search crosses the worker boundary, never files,
// light frames, DOM/deck references or the full 20 ms analysis-window objects.
export function prepareTransitionOptimization(pair,{requestedDuration=null}={}){
 const tracks=pair.alignmentTracks||pair.libraryTracks||[],sources=[pair.from,pair.to];
 const data=sources.map((source,i)=>{
  const track=tracks[i]||{},p=track.plan||{},windows=track.windows||[];
  const plan={duration:source.duration,beatGrid:p.beatGrid,beatTiming:{times:p.beatTiming?.times||[]},sections:p.sections||[],structure:p.structure?{instruments:p.structure.instruments,segments:p.structure.segments||[]}:undefined};
  const rms=[],bass=[];
  for(let j=0;j<windows.length;j+=5){const group=windows.slice(j,j+5);rms.push(Math.sqrt(group.reduce((s,w)=>s+(Number.isFinite(w.rms)?w.rms*w.rms:0),0)/group.length));bass.push(group.reduce((s,w)=>s+(w.bands?.[0]??w.bass??0),0)/group.length);}
  const wave=source.waveform||track.waveform,waveDuration=source.waveform?source.duration:track.analysisDuration||p.duration||source.duration;
  const features=rms.length?{step:.1,rms,bass,absolute:true}:wave?.rms?.length?{step:waveDuration/wave.rms.length,rms:wave.rms,absolute:false}:null;
  return {plan,features,tonal:transitionTonalSegments(windows)};
 });
 return {sources:sources.map(s=>({duration:s.duration,rate:s.rate||1})),tracks:transitionCutTracks(pair),data,plan:structuredClone(pair.plan),cutJoin:pair.cutJoin? [...pair.cutJoin]:null,notBefore:Math.max(0,Number(pair.source?.audio?.currentTime)||0),requestedDuration};
}
export function cutOptimizationPair(track,cuts,joins,range){
 const duration=track.plan.duration,[a,b]=range,other=joins.filter(j=>j.cut[0]!==a||j.cut[1]!==b);
 const existing=joins.find(j=>j.cut[0]===a&&j.cut[1]===b),ranges=transitionSafeRanges({plan:track.plan,audioCuts:cuts,audioCutJoins:other});
 const left=ranges.find(([s,e])=>s<a&&Math.abs(e-a)<.00001),right=ranges.find(([s,e])=>Math.abs(s-b)<.00001&&e>b);
 if(!left||!right)throw Error('Neben diesem Schnitt ist kein freier Bereich für eine Überblendung vorhanden.');
 const length=existing?.duration||Math.min(1,(a-left[0])/2,(right[1]-b)/2);
 return {cutJoin:[a,b],alignmentTracks:[{...track,analysisDuration:duration,plan:{...track.plan,duration:a}},track],from:{duration:a,rate:1,audioCuts:cuts,audioCutJoins:other},to:{duration,rate:1,audioCuts:cleanCuts([[0,b],...cuts],duration),audioCutJoins:other},plan:cutJoinPlan(existing||{cut:[a,b],duration:length,style:'smooth',points:null})};
}
function seeds(plan){return unique([...(plan.beatGrid?.beats||plan.beatTiming?.times||[]),...(plan.beatGrid?.downbeats||[]),...(plan.sections||[]).map(s=>s.start),...(plan.structure?.segments||[]).map(s=>s.start)]);}
function near(values,time,tolerance=.1){return values.some(t=>Math.abs(t-time)<=tolerance);}
function candidates(plan,ranges,origin,length,rate,outgoing,join){
 const bars=plan.beatGrid?.downbeats||[],sections=unique([...(plan.sections||[]).map(s=>s.start),...(plan.structure?.segments||[]).map(s=>s.start)]),all=seeds(plan),values=[];
 for(const [a,b] of ranges){
  const lo=Math.max(a,origin-48*rate),hi=Math.min(b-length*rate,origin+(join?16:32)*rate);
  if(hi<lo-.00001)continue;
  const grid=[lo,hi,clamp(origin,lo,hi),...all,...(outgoing?all.map(t=>t-length*rate):[])];
  // A modest time grid remains usable when no reliable beat model is present.
  for(let t=Math.ceil(lo/rate)*rate;t<=hi;t+=rate)grid.push(t);
  for(const t of unique(grid))if(t>=lo-.00001&&t<=hi+.00001){
   if(join&&(outgoing?t+length*rate<join[0]-Math.min(16,(b-a)*.4):t>join[1]+Math.min(16,(b-a)*.4)))continue;
   values.push({t:clamp(t,a,b-length*rate),priority:(near(sections,t)||outgoing&&near(sections,t+length*rate)?2:0)+(near(bars,t)?1:0)});
  }
 }
 const ordered=values.sort((a,b)=>b.priority-a.priority||Math.abs(a.t-origin)-Math.abs(b.t-origin));
 const selected=ordered.slice(0,24).map(v=>v.t),spread=unique(values.map(v=>v.t)).sort((a,b)=>a-b);
 for(let i=0;i<8&&spread.length;i++)selected.push(spread[Math.round(i/7*(spread.length-1))]);
 return unique(selected).slice(0,32);
}
function featureAt(data,time){
 const f=data.features;if(!f||time<0)return null;const i=Math.floor(time/f.step);
 return Number.isFinite(f.rms[i])?{energy:f.rms[i],bass:f.bass?.[i]??0}:null;
}
function audioCost(input,time,cue,length,style){
 const [a,b]=input.data,[x,y]=input.sources;let energy=0,bass=0,silence=0,count=0;
 for(let i=0;i<12;i++){
  const p=(i+.5)/12,u=featureAt(a,time+p*length*x.rate),v=featureAt(b,cue+p*length*y.rate);if(!u||!v)continue;
  energy+=Math.abs(Math.log((u.energy+.005)/(v.energy+.005)));bass+=u.bass*v.bass;silence+=Number(u.energy<.0015)+Number(v.energy<.0015);count++;
 }
 if(!count)return 0;
 return energy/count*.14+bass/count*(style==='bass'?.05:.2)+silence/count*.25;
}
function boundaryCost(plan,time,end){
 const bars=plan.beatGrid?.downbeats||[],sections=unique([...(plan.sections||[]).map(s=>s.start),...(plan.structure?.segments||[]).map(s=>s.start)]);
 return -(near(sections,time)||near(sections,end)?.1:0)-(near(bars,time)?.035:0)-(near(bars,end)?.035:0);
}

// Bounded generator: the worker reports progress; the fallback yields to the UI.
export function* transitionOptimizationSearch(input){
 const {sources,plan,cutJoin,requestedDuration}=input,rateA=sources[0].rate,rateB=sources[1].rate,fixedDuration=requestedDuration!=null;
 if(fixedDuration&&(!Number.isFinite(requestedDuration)||requestedDuration<.1||requestedDuration>60))throw Error('Eine Überblenddauer zwischen 0,1 und 60 Sekunden vorgeben.');
 if(sources.some(s=>!Number.isFinite(s.duration)||s.duration<=0||!Number.isFinite(s.rate)||s.rate<=0))throw Error('Gültige Liedlängen und Wiedergabegeschwindigkeiten werden benötigt.');
 let ranges=input.tracks.map(transitionSafeRanges);
 if(cutJoin)ranges=ranges.map((rs,i)=>rs.filter(([a,b])=>i?a<=cutJoin[1]+.00001&&b>cutJoin[1]:a<cutJoin[0]&&b>=cutJoin[0]-.00001));
 else ranges[0]=ranges[0].map(([a,b])=>[Math.max(a,input.notBefore||0),b]).filter(([a,b])=>b-a>=.1*rateA);
 if(ranges.some(r=>!r.length))throw Error('Die erhaltenen Liedteile bieten keinen Platz für einen Übergang.');
 const data=input.data.map((d,i)=>({...d,plan:{...d.plan,transitionRanges:ranges[i]}}));
 const hasData=data.some(d=>d.plan.structure?.instruments||d.features||seeds(d.plan).length>1);
 if(!hasData)throw Error('Für die Optimierung fehlen Audio-, Beat- oder Abschnittsdaten. Den Titel bitte zuerst analysieren.');
 const capacity=Math.min(...ranges.map((rs,i)=>Math.max(...rs.map(([a,b])=>(b-a)/sources[i].rate))),fixedDuration?60:24);
 if(capacity<.1)throw Error('Für einen Übergang müssen auf beiden Seiten mindestens 0,1 Sekunden erhalten bleiben.');
 if(fixedDuration&&requestedDuration>capacity+.00001)throw Error(`Für die vorgegebenen ${requestedDuration.toLocaleString('de-DE')} Sekunden ist in den erhaltenen Liedteilen nicht genug Platz. Verfügbar sind höchstens ${(Math.floor(capacity*100)/100).toLocaleString('de-DE')} Sekunden. Die Dauer wurde nicht geändert.`);
 const target=fixedDuration?requestedDuration:cutJoin?Math.min(8,capacity/2):Math.min(16,Math.max(4,plan.duration));
 const periods=data.map((d,i)=>{const beat=beatPosition(d.plan.beatGrid?.beats,plan[i?'cue':'time']);return beat?beat.period/sources[i].rate:null;});
 const lengths=fixedDuration?[requestedDuration]:unique([Math.min(target,capacity),Math.min(plan.duration,capacity),.25,.5,1,2,4,8,12,16,24,...periods.flatMap(p=>p?[2,4,8,16,32].map(n=>p*n):[])]).filter(t=>t>=.1&&t<=capacity+.00001).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)).slice(0,14);
 const batches=lengths.map(length=>({length,a:candidates(data[0].plan,ranges[0],plan.time,length,rateA,true,cutJoin),b:candidates(data[1].plan,ranges[1],plan.cue,length,rateB,false,cutJoin)}));
 const total=batches.reduce((sum,b)=>sum+b.a.length*b.b.length,0);let evaluated=0,best=null;const ranked=[];
 for(const batch of batches)for(const time of batch.a)for(const cue of batch.b){
  const length=batch.length;
  let scores=transitionBlendScores(data[0].plan,data[1].plan,time,cue,length,{rateA,rateB,tonalA:data[0].tonal,tonalB:data[1].tonal,points:plan.points,style:plan.style});
  const analyzed=Boolean(scores.length);
  if(!scores.length)scores=(plan.points?[plan.style]:['smooth','bass','handover']).map(style=>({style,cost:0,context:{explanation:''},harmonic:{description:''}}));
  for(const entry of scores){
   const {style,context,harmonic}=entry;
   const durationCost=Math.abs(Math.log(length/Math.max(.1,target)))*.15+(length<1&&capacity>=2?.25:0);
   const locality=cutJoin?Math.max(0,cutJoin[0]-(time+length*rateA))/rateA*.012+Math.max(0,cue-cutJoin[1])/rateB*.014:Math.abs(time-plan.time)/rateA*.0025+Math.abs(cue-plan.cue)/rateB*.0035;
   const beatA=beatPosition(data[0].plan.beatGrid?.beats,time),beatB=beatPosition(data[1].plan.beatGrid?.beats,cue);
   const drift=beatA&&beatB?Math.abs(rateA/beatA.period-rateB/beatB.period)*length:0;
   const phase=beatA&&beatB?Math.min(Math.abs(beatA.phase-beatB.phase),1-Math.abs(beatA.phase-beatB.phase))*.18:0;
   const score=entry.cost+audioCost(input,time,cue,length,style)+durationCost+locality+phase+(analyzed?0:drift*.12)+boundaryCost(data[0].plan,time,time+length*rateA)+boundaryCost(data[1].plan,cue,cue+length*rateB)+(style==='handover'?.12:style==='bass'?.025:0);
   const candidate={time,cue,duration:length,style,score,confidence:analyzed?'analyzed':'partial',context,harmonic:harmonic.description};
   if(!best||score<best.score){best=candidate;ranked.push(candidate);if(ranked.length>32)ranked.shift();}
  }
  if(++evaluated%128===0)yield {evaluated,total};
 }
 if(!best)throw Error(fixedDuration?'Für die vorgegebene Dauer wurde in der Suchumgebung kein gültiger Übergang gefunden. Songstelle oder Dauer bitte anpassen. Die Dauer wurde nicht geändert.':'In den angrenzenden Liedteilen wurde kein gültiger Übergang gefunden. Schnitt oder Songstelle bitte anpassen.');
 const evidence=[data.every(d=>d.plan.structure?.instruments)?'Gesang, Bass und Energie':null,data.every(d=>d.plan.beatGrid?.beats?.length>3)?'Beats und Taktgrenzen':null,data.some(d=>d.plan.sections.length||d.plan.structure?.segments?.length)?'Songabschnitte':null,data.every(d=>d.features)?data.every(d=>d.features.absolute)?'Audiopegel':'Wellenformpegel':null,data.every(d=>d.tonal.length)?'Tonartschätzung':null].filter(Boolean);
 const alternatives=[best,...ranked.reverse().filter(p=>p!==best&&Math.abs(p.time-best.time)+Math.abs(p.cue-best.cue)>1)].slice(0,3);
 return {...plan,...best,points:plan.points||null,label:plan.points?'Eigene Übergangskurve':labels[best.style],manual:true,kind:'time',audioProfile:null,alternatives:undefined,optimization:{evaluated,evidence,alternatives},reason:`${evaluated.toLocaleString('de-DE')} Kombinationen verglichen · ${evidence.join(' · ')||'Vorhandene Zeitdaten'}${best.context.explanation?' · '+best.context.explanation:''}${!data.every(d=>d.plan.structure?.instruments)?' · Ohne vollständige Instrumentenanalyse':''}${plan.points?' · Eigene Kurve beibehalten':''}.`};
}
export function computeTransitionOptimization(input){const search=transitionOptimizationSearch(input);let step;do{step=search.next();}while(!step.done);return step.value;}
