// Shared time geometry for deck and optional stage transport.
const backgrounds=new WeakMap();
export function drawWaveform(canvas,waveform,position,duration,cues=[],color='#f6ac7b'){
  const paint=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  paint.clearRect(0,0,w,h);
  if(waveform?.version===2){
    let cached=backgrounds.get(canvas);
    if(!cached||cached.waveform!==waveform||cached.peaks!==waveform.peaks||cached.rms!==waveform.rms||cached.w!==w||cached.h!==h||cached.color!==color){
      const image=cached?.image||canvas.ownerDocument.createElement('canvas');image.width=w;image.height=h;
      const background=image.getContext('2d');background.fillStyle=color;
      for(const [values,alpha] of [[waveform.peaks,.22],[waveform.rms,1]]){
        background.globalAlpha=alpha;
        values.forEach((v,i)=>{if(v>0)background.fillRect(i*w/values.length,h/2-v*h*.425,w/values.length,v*h*.85);});
      }
      background.globalAlpha=1;
      cached={image,waveform,peaks:waveform.peaks,rms:waveform.rms,w,h,color};backgrounds.set(canvas,cached);
    }
    paint.globalAlpha=1;paint.fillStyle=color;paint.drawImage(cached.image,0,0);
  }
  if(duration>0){
    paint.fillStyle='#fff';paint.fillRect(Math.max(0,Math.min(1,position/duration))*w-1,0,2,h);
    for(const t of cues)if(t!==null){paint.fillStyle='#a7edc8';paint.fillRect(t/duration*w-1,0,2,10);}
  }
}
