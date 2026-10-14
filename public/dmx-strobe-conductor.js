import {planShowScore,showScoreAt} from './show-score.js';
import {musicalMovementEvents} from './dmx-light-scenes.js';
const cache=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function strobeConductor(plan){
 if(cache.has(plan))return cache.get(plan);
 const pictures=plan.showScore||planShowScore(plan),arr=plan.arrangement||{};
 // The shared conductor supplies melody changes, expression and developments.
 // Passing no bars deliberately excludes regular metronomic arrivals.
 const candidates=musicalMovementEvents(plan,[]).filter(e=>!['bar','recovered'].includes(e.kind));
 for(const e of arr.bassAttacks||[])if(e.strength>=.65)candidates.push({time:e.time,kind:'bass',strength:e.strength,duration:e.duration});
 for(let i=0;i<(arr.times||[]).length;i++)if(['onset','instrument'].includes(arr.eventSources?.[i]))
  candidates.push({time:arr.times[i],kind:'attack',strength:arr.accents?.[i]??.6});
 candidates.sort((a,b)=>a.time-b.time);
 const events=[],last=new Map(),ordinals=new Map(),entrances=new Map(),observed=new Map();
 for(const e of candidates){
  const picture=showScoreAt(plan,e.time);
  if(!picture||picture.role==='silence')continue;
  const role=e.kind==='melody'?'answer':e.kind==='accent'?'accent':'lead';
  const restrained=picture.role==='held'||picture.character==='vocal'||picture.vocals>.55;
  const percussion=['bass','attack'].includes(e.kind);
  const spacing=role==='lead'?(restrained?.65:picture.climax?.22:.38):role==='answer'?.6:.5;
  const key=`${picture.start}:${role}`,previous=entrances.get(key),previousObserved=observed.get(key);
  observed.set(key,e.time);
  if(e.time-(last.get(role)??-Infinity)<spacing)continue;
  // A repeated bass hit articulates the current unit. Only a new entrance
  // after a real gap, or a melodic/expressive decision, advances the picture.
  const advance=!previous||!percussion||e.time-(previousObserved??previous.time)>=.9;
  const ordinal=previous?(ordinals.get(key)||0)+(advance?1:0):0;
  ordinals.set(key,ordinal);last.set(role,e.time);entrances.set(key,e);
  const note=e.kind==='melody'?(plan.score?.notes||[]).find(n=>Math.abs(n.start-e.time)<.02):null;
  const duration=Math.max(.12,Math.min(e.kind==='melody'?1.8:.9,note?note.end-note.start:e.duration??(['expression','development'].includes(e.kind)?.8:role==='accent'?.18:.3)));
  events.push({...e,role,ordinal,advance,gain:percussion?(restrained?.45:picture.climax?1:.75):1,duration:Math.min(duration,picture.end-e.time),strength:clamp(e.strength??e.salience??.8),pictureStart:picture.start});
 }
 // Store continuous travel, not a sequence of independent shutter pulses.
 // Each measured entrance is a waypoint; light passes between neighbours.
 const transfers={};
 for(const role of ['lead','answer','solo']){
  const points=[];let position=0;
  for(const e of events.filter(e=>e.role===role||role==='solo'&&['lead','answer'].includes(e.role)))points.push({time:e.time,position:++position,gain:e.gain});
  transfers[role]=points;
 }
 const value={pictures,events,transfers,envelope:arr.motionEnvelope||[]};cache.set(plan,value);return value;
}
function indexAt(points,time,key='time'){
 let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][key]<=time)lo=mid+1;else hi=mid;}return lo-1;
}
export function strobeMusicAt(plan,time){
 const conductor=strobeConductor(plan),picture=showScoreAt(plan,time);
 const at=indexAt(conductor.events,time),active=[];
 for(let i=at;i>=0&&time-conductor.events[i].time<=1.8;i--){
  const e=conductor.events[i];if(time<e.time+e.duration&&e.pictureStart===picture?.start)active.push({...e,elapsed:time-e.time});
 }
 const points=conductor.envelope,i=indexAt(points,time),a=points[i],b=points[i+1];
 const blend=a&&b?clamp((time-a.time)/Math.max(.001,b.time-a.time)):0;
 const sample=(key,fallback)=>Number.isFinite(a?.[key])?a[key]+((Number.isFinite(b?.[key])?b[key]:a[key])-a[key])*blend:fallback;
 const transfer={};
 for(const role of ['lead','answer','solo']){
  const points=conductor.transfers[role],index=indexAt(points,time),previous=points[index],next=points[index+1];
  const start=previous??{time:0,position:0};
  // Event spacing sets travel speed. Preserve its phase across picture
  // boundaries; silence is applied separately to the final exposure.
  const from=start.time;
  const progress=next?clamp((time-from)/Math.max(.001,next.time-from)):0;
  const smooth=progress*progress*(3-2*progress);
  transfer[role]={position:start.position+(next?next.position-start.position:0)*smooth,
   enabled:role==='lead'||role==='solo'||!!previous&&previous.time>=(picture?.start??0)||!!next&&next.time<(picture?.end??0)};
 }
 return {transfer,active,evidence:conductor.events.some(e=>e.pictureStart===picture?.start),role:picture?.role??'silence',energy:sample('energy',picture?.energy??.4),tone:sample('tone',picture?.tone??.5),pitch:sample('pitch',null)};
}
export function strobeMusicExposure(music,role,bank,banks,hasAnswer){
 if(music.role==='silence')return 0;
 const path=music.transfer?.[role==='lead'&&!hasAnswer?'solo':role];
 if(path&&role!=='accent'){
  if(!path.enabled)return 0;
  if(banks<=1)return .65+.3*clamp(music.energy);
  const period=2*(banks-1),phase=((path.position%period)+period)%period;
  const position=phase<=banks-1?phase:period-phase;
  // Complementary neighbouring weights conserve light through every handover.
  return Math.max(0,1-Math.abs(bank-position))*(.65+.3*clamp(music.energy));
 }
 // Sustained music retains a sparse picture. Missing onset evidence never
 // fabricates a pulse train from the beat grid.
 let level=role==='lead'&&bank===0&&(!music.evidence||['held','flow','build'].includes(music.role))?.2+.25*clamp(music.energy):0;
 for(const e of music.active){
  if(e.role!==role&&!(e.role==='answer'&&!hasAnswer&&role==='lead'))continue;
  if(bank!==e.ordinal%banks)continue;
  const release=Math.min(e.duration*.45,.22),attack=Math.min(.025,e.duration*.1);
  const onset=e.kind==='bass'?Math.min(.09,e.duration*.25):attack;
  const envelope=Math.min(1,e.elapsed/onset,(e.duration-e.elapsed)/release);
  level=Math.max(level,clamp(envelope)*(.55+.45*e.strength)*(e.gain??1));
 }
 return clamp(level);
}
