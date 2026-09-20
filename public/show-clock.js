// Reserve the next send for an upcoming beat instead of sampling through it.
// The gap before the beat keeps the server's bounded send rate from dropping it.
export function nextShowWake(streams, minimumMs=110) {
  let next=null;
  for(const stream of streams) {
    if(!stream.playing || !stream.beats?.length || stream.weight<=.01)continue;
    const rate=stream.rate||1;
    let lo=0,hi=stream.beats.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(stream.beats[mid]<=stream.time)lo=mid+1;else hi=mid;}
    if(lo===stream.beats.length)continue;
    const delay=(stream.beats[lo]-stream.time)/rate*1000;
    if(!next||delay<next.delay)next={key:stream.key,time:stream.beats[lo],delay};
  }
  return next&&next.delay<=minimumMs*2?next:{delay:minimumMs};
}
export function startShowClock(read,send) {
  let stopped=false,timer,pending;
  async function tick() {
    if(stopped)return;
    const streams=read();
    if(pending?.key) {
      const stream=streams.find(s=>s.key===pending.key&&s.playing);
      const remaining=stream?(pending.time-stream.time)/(stream.rate||1)*1000:Infinity;
      // Media time may lag the timer slightly. Do not send a pre-beat frame
      // that would consume the slot reserved for the actual peak.
      if(remaining>0&&remaining<=250) {timer=setTimeout(tick,Math.max(4,Math.ceil(remaining)));return;}
    }
    pending=null;
    try {await send();}
    finally {
      if(!stopped){pending=nextShowWake(read());timer=setTimeout(tick,Math.max(4,Math.ceil(pending.delay)));}
    }
  }
  timer=setTimeout(tick,0);
  return ()=>{stopped=true;clearTimeout(timer);};
}
