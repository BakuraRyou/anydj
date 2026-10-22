// Musical membership is independent of geometry and source brightness. Resolve
// it again after room expansion, so a four-head source cannot limit a large rig.
const timelines=new WeakMap();
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export function showFixtureParticipation(plan,scene,time){
 if(!plan||!scene||!Number.isFinite(time))return undefined;
 let cached=timelines.get(plan);if(!cached){cached=new Map();timelines.set(plan,cached);}
 const key=`show:${scene.start}:${scene.end}`;
 let starts=cached.get(key);
 if(!starts){
  starts=[scene.start];
  const phrases=(plan.arrangement?.patterns?.phrases||[]).map(p=>p.start);
  const bars=(plan.beatGrid?.downbeats||[]).filter((_,i)=>i%4===0);
  for(const t of [...new Set([...phrases,...bars])].sort((a,b)=>a-b)){
   if(t>=starts.at(-1)+8&&t<=scene.end-4)starts.push(t);
  }
  cached.set(key,starts);
 }
 let index=0;while(index+1<starts.length&&time>=starts[index+1])index++;
 const progress=smooth((time-scene.start)/Math.max(.001,scene.end-scene.start));
 const fraction=scene.climax?1:scene.kind==='build'||scene.role==='build'?.65+.35*progress:(scene.energy??.5)>=.85?.85:.65;
 // Show owns picture identity and transitions. Keep the approved membership
 // behavior alongside its authored action shutters and large-scale formations.
 return {fraction,selection:(scene.index??0)+index,
  previous:index>0?(scene.index??0)+index-1:undefined,
  blend:index>0?smooth((time-starts[index])/1.2):1};
}
// Automatic keeps the scene-local membership used before the Strobo changes.
// Its movement picture supplies the handover; a second song-wide selection
// clock and anticipatory reserve must not replace or dim that picture.
export function fixtureParticipation(plan,scene,time){
 return showFixtureParticipation(plan,scene,time);
}
export function fixtureParticipationLevel(policy,rank,count){
 if(count<=1)return 1;
 // Even rigs retain mirrored pairs. Two heads and odd rigs exchange individual
 // members: a lone centre must not trap a three-head rig in one fixed pair.
 const individual=count===2||count%2===1;
 const slots=individual?count:count/2;
 const slot=individual?rank:Math.min(rank,count-1-rank);
 const selected=selection=>{
  const offset=((selection%slots)+slots)%slots;
  const order=(slot-offset+slots)%slots;
  const minimum=Math.ceil(Math.ceil(count/2)/(individual?1:2));
  if(order<minimum)return 1;
  // A build brings additional members in continuously rather than snapping
  // open a shutter when a rounded fixture budget changes by one.
  return smooth((slots*policy.fraction-order-.4)/.2);
 };
 const current=selected(policy.selection);
 if(policy.previous===undefined)return current;
 const previous=selected(policy.previous),blend=policy.blend??1;
 return previous+(current-previous)*blend;
}
