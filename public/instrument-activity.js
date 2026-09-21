const clamp=x=>Math.max(0,Math.min(1,x));
const names=['drums','bass','vocals','other'];
export function validateInstruments(value,duration) {
  if(value?.version!==1||value.source!=='htdemucs'||value.step!==.1)throw Error('Ungültige Instrumentenanalyse.');
  const count=Math.ceil(duration/value.step),result={version:1,source:'htdemucs',step:value.step};
  for(const name of names){
    const values=value[name];
    // Resampling 44.1 kHz to the browser's 16 kHz can move the final sample
    // across an envelope boundary. Permit one trailing bin, never a time shift.
    if(!Array.isArray(values)||!values.length||Math.abs(values.length-count)>1||values.some(x=>!Number.isFinite(x)||x<0||x>4))throw Error('Ungültige Instrumentenpegel.');
    result[name]=values.slice(0,count);
    if(result[name].length<count)result[name].push(values.at(-1));
  }
  return result;
}
const quantile=(xs,q)=>{const sorted=[...xs].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*q)]||0;};
// Plan the whole song once. Energy uses a song-wide reference so a quiet
// passage cannot normalize itself into a peak. Separation shares are estimates.
export function instrumentDrama(instruments,duration) {
  if(!instruments)return null;
  const n=instruments.drums.length,step=instruments.step;
  const prefixes=Object.fromEntries(names.map(name=>{const p=[0];for(const x of instruments[name])p.push(p.at(-1)+x*x);return [name,p];}));
  const mean=(name,a,b)=>{a=Math.max(0,a);b=Math.min(n,b);return Math.sqrt(Math.max(0,prefixes[name][b]-prefixes[name][a])/Math.max(1,b-a));};
  const drumsReference=Math.max(.008,quantile(instruments.drums,.95));
  const total=Array.from({length:n},(_,i)=>Math.sqrt(names.reduce((sum,name)=>sum+mean(name,i-5,i+6)**2,0)));
  const low=quantile(total,.15),high=quantile(total,.95);
  const intensity=[],percussion=[],vocalShare=[],attacks=[];
  for(let i=0;i<n;i++){
    const d=mean('drums',i-5,i+6),v=mean('vocals',i-5,i+6),b=mean('bass',i-5,i+6),o=mean('other',i-5,i+6);
    const sum=d+b+v+o;
    const rhythmic=clamp(d/drumsReference)*clamp(d/Math.max(.008,sum)*3);
    percussion.push(rhythmic);vocalShare.push(sum?v/sum:0);
    const contrast=clamp((total[i]-low)/Math.max(.025,high-low));
    intensity.push(total[i]<.002?0:clamp(contrast*.7+rhythmic*.3));
    attacks.push(clamp((instruments.drums[i]-Math.min(...instruments.drums.slice(Math.max(0,i-2),i+1)))/drumsReference*3));
  }
  return {version:1,step,intensity,percussion,vocalShare,attacks,duration};
}
export function dramaAt(drama,time) {
  if(!drama)return null;
  const i=Math.max(0,Math.min(drama.intensity.length-1,Math.floor(time/drama.step)));
  return {intensity:drama.intensity[i],percussion:drama.percussion[i],vocalShare:drama.vocalShare[i],attack:Math.max(...drama.attacks.slice(Math.max(0,i-1),i+2))};
}
