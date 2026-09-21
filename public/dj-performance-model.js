export const dbGain=db=>10**(Math.max(-60,Math.min(12,Number(db)||0))/20);
// One common scale for the whole track: never normalize individual columns.
// RMS shows sustained energy; peaks retain short transients as a separate layer.
export function audioEnvelope(buffer,count=640){
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 count=Math.max(1,Math.min(Math.floor(count)||640,buffer.length||1));
 const peaks=[],rms=[];let scale=1;
 for(let i=0;i<count;i++){
  let peak=0,sum=0,n=0;
  const start=Math.floor(i*buffer.length/count),end=Math.floor((i+1)*buffer.length/count);
  for(const data of channels)for(let j=start;j<end;j++){
   const v=Number.isFinite(data[j])?data[j]:0;
   peak=Math.max(peak,Math.abs(v));sum+=v*v;n++;
  }
  peaks.push(peak);rms.push(n?Math.sqrt(sum/n):0);scale=Math.max(scale,peak);
 }
 return {version:2,peaks:peaks.map(v=>v/scale),rms:rms.map(v=>v/scale)};
}
export function audioPeaks(buffer,count=640){return audioEnvelope(buffer,count).peaks;}
export function cleanCues(value,duration=Infinity){return Array.from({length:4},(_,i)=>Number.isFinite(value?.[i])&&value[i]>=0&&value[i]<duration?value[i]:null);}
export function loopRange(beats,time,length,duration){
 if(!Array.isArray(beats)||![1,2,4,8,16].includes(length)||!Number.isFinite(time)||!Number.isFinite(duration))return null;
 let index=beats.findIndex(b=>b>time+.025)-1;if(index<0){if(time<beats[0])index=0;else return null;}
 const start=beats[index],end=beats[index+length];
 if(!Number.isFinite(start)||!Number.isFinite(end)||end>=duration-.04||end<=start)return null;
 const gaps=beats.slice(index+1,index+length+1).map((b,i)=>b-beats[index+i]);
 if(gaps.some(g=>g<.2||g>2))return null;
 return {start,end};
}
export function tempoAt(beats,time){
 if(!Array.isArray(beats)||beats.length<2)return null;
 let i=beats.findIndex(b=>b>time);if(i<1)i=i===0?1:beats.length-1;
 const gap=beats[i]-beats[i-1];return gap>=.2&&gap<=2?60/gap:null;
}

export function jumpBeats(beats,time,offset){
 if(!Array.isArray(beats)||beats.length<2||!Number.isInteger(offset))return null;
 const after=beats.findIndex(b=>b>time),index=after-1;
 if(index<0)return null;
 const target=Math.max(0,Math.min(beats.length-2,index+offset));
 const span=beats[index+1]-beats[index],targetSpan=beats[target+1]-beats[target];
 if(span<=0||targetSpan<=0)return null;
 return beats[target]+(time-beats[index])/span*targetSpan;
}
