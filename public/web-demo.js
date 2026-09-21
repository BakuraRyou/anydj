// Procedurally generated demo music; no downloads or bundled recordings.
export function createDemoFiles(){
  return [120,128].map((bpm,variant)=>{
    const rate=22050,duration=24,length=rate*duration,buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
    const word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    word(0,'RIFF');view.setUint32(4,36+length*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,length*2,true);
    let seed=42+variant;
    for(let i=0;i<length;i++){
      const t=i/rate,beat=t*bpm/60,phase=(beat%1)*60/bpm,step=Math.floor(beat),active=t>6&&t<20;
      seed=(1664525*seed+1013904223)>>>0;const noise=seed/4294967296*2-1;
      const kick=Math.sin(2*Math.PI*(48*phase+7*(1-Math.exp(-phase*32))))*Math.exp(-phase*22);
      const snare=step%2?noise*Math.exp(-phase*35)*.2:0;
      const hat=noise*Math.exp(-((beat*2)%1)*22)*.055;
      const bass=[55,65.406,73.416,49][Math.floor(beat/8)%4]*[1,1.5][variant];
      const tone=Math.sin(2*Math.PI*bass*t)*Math.exp(-phase*6)*.22;
      const lead=Math.sin(2*Math.PI*bass*[4,5,6,8][step%4]*t)*Math.exp(-phase*12)*.1;
      const envelope=Math.min(1,t/1.5,(duration-t)/2);
      const sample=envelope*((active?.45:.2)*kick+tone+(active?snare+hat+lead:lead*.25));
      view.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true);
    }
    return new File([buffer],`AnyDj Demo ${variant?'B':'A'} - ${bpm} BPM.wav`,{type:'audio/wav',lastModified:1});
  });
}
