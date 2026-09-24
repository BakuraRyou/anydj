// Shared time geometry for deck and optional stage transport.
export function drawWaveform(canvas,waveform,position,duration,cues=[],color='#f6ac7b'){
  const paint=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  paint.clearRect(0,0,w,h);
  if(waveform?.version===2){
    paint.fillStyle=color;
    for(const [values,alpha] of [[waveform.peaks,.22],[waveform.rms,1]]){
      paint.globalAlpha=alpha;
      values.forEach((v,i)=>{if(v>0)paint.fillRect(i*w/values.length,h/2-v*h*.425,w/values.length,v*h*.85);});
    }paint.globalAlpha=1;
  }
  if(duration>0){
    paint.fillStyle='#fff';paint.fillRect(Math.max(0,Math.min(1,position/duration))*w-1,0,2,h);
    for(const t of cues)if(t!==null){paint.fillStyle='#a7edc8';paint.fillRect(t/duration*w-1,0,2,10);}
  }
}
