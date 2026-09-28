// Small in-memory history of renderer input. No audio, network or persistence.
export function createLightOutputTrace({limit=450,interval=100}={}){
 const frames=[];let last=-Infinity;
 const summarize=lights=>{
  const types={};
  for(const l of lights){
   if(!['moving','spot','bar'].includes(l.type))continue;
   const t=types[l.type]??={count:0,lit:0,power:0,maximum:0,zoneTransit:0};
   const power=Number.isFinite(l.power)?Math.max(0,l.power):0;
   t.count++;t.lit+=power>0?1:0;t.power+=power;t.maximum=Math.max(t.maximum,power);t.zoneTransit+=l.zoneTransit?1:0;
  }
  return types;
 };
 return {
  push(now,sources,before,after){
   if(now-last<interval)return;last=now;
   frames.push({now,sources:sources.map(s=>({source:s.source,time:s.songTime,profile:s.movingPlan?.showProfile,weight:s.weight,dimming:s.frame?.dimming,state:s.frame?.state})),beforeRoom:summarize(before),rendererInput:summarize(after)});
   if(frames.length>limit)frames.splice(0,frames.length-limit);
  },
  snapshot(){return {scope:'Last rendered frames: source levels, before room routing and renderer input. Does not measure GPU pixels.',intervalMs:interval,frames:structuredClone(frames)};}
 };
}
