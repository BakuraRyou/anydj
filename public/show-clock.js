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
export function startShowClock(read,send,minimumMs=110) {
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
      if(!stopped){pending=nextShowWake(read(),minimumMs);timer=setTimeout(tick,Math.max(4,Math.ceil(pending.delay)));}
    }
  }
  timer=setTimeout(tick,0);
  return ()=>{stopped=true;clearTimeout(timer);};
}

// Local rendering follows display frames. Scheduling another timeout after
// rendering adds its full work time to every interval and leaves stale light
// samples on screen when the stage gets expensive. Read media time in send(),
// including after a song change, seek or suspended browser frame.
export function startPreviewClock(send,{minimumMs=16,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,page=globalThis.document}={}) {
  let stopped=false,frame,timer,last=-Infinity;
  function schedule(){
    // The same update also supplies physical output. Keep sampling when the
    // browser suspends display frames in a hidden tab.
    if(page?.hidden)timer=setTimeout(()=>tick(performance.now()),minimumMs);
    else frame=requestFrame(tick);
  }
  function cancel(){
    if(frame!==undefined)cancelFrame(frame);
    clearTimeout(timer);frame=timer=undefined;
  }
  function visibilityChanged(){cancel();last=-Infinity;if(!stopped)schedule();}
  function tick(now){
    frame=timer=undefined;
    if(stopped)return;
    try {
      if(now-last>=minimumMs){last=now;send();}
    } finally {
      if(!stopped)schedule();
    }
  }
  page?.addEventListener('visibilitychange',visibilityChanged);
  schedule();
  return ()=>{stopped=true;cancel();page?.removeEventListener('visibilitychange',visibilityChanged);};
}
