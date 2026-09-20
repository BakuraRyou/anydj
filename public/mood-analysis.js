const clamp=v=>Math.max(0,Math.min(1,v));
export const MOOD_PALETTES={
  bright:['#ff6000','#ffbd00','#e6ff30','#ff4488'],
  gentle:['#ff8030','#ffc060','#ff6699','#c880ff'],
  wistful:['#163cff','#007fcc','#5833ee','#ad44ff'],
  dramatic:['#6600dd','#b000cc','#ff0066','#ff3000'],
};
export const MOOD_LABELS={bright:'Strahlend / lebhaft',gentle:'Warm / gelöst',wistful:'Ruhig / melancholisch',dramatic:'Kraftvoll / gespannt',neutral:'Unklar · gewählte Palette'};
// Deliberately simple tonal templates: tonic, third and fifth carry more
// weight than the remaining scale degrees. These scores are tendencies, not
// calibrated probabilities or emotional truth.
export function estimateMode(chroma) {
  const mean=chroma.reduce((a,b)=>a+b,0)/12;
  const spread=Math.sqrt(chroma.reduce((s,v)=>s+(v-mean)**2,0));
  if(mean<1e-6||spread<mean*.2)return {mode:null,confidence:0};
  const candidates=[];
  for(const mode of ['major','minor'])for(let root=0;root<12;root++) {
    const degrees=mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
    const profile=Array(12).fill(0);
    for(const degree of degrees)profile[(root+degree)%12]=degree===0?3:degree===degrees[2]||degree===7?2:1;
    const average=profile.reduce((a,b)=>a+b,0)/12;
    const norm=Math.sqrt(profile.reduce((s,v)=>s+(v-average)**2,0));
    const score=profile.reduce((s,v,k)=>s+(v-average)*(chroma[k]-mean),0)/(norm*spread);
    candidates.push({mode,root,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0],other=candidates.find(c=>c.mode!==best.mode);
  const margin=best.score-other.score;
  const confidence=clamp(margin/.2)*clamp((best.score-.4)/.4);
  return {mode:best.score>.6&&margin>.045?best.mode:null,root:best.root,confidence};
}
export function analyzeMood(windows,duration) {
  const loudness=windows.map(w=>w.rms).sort((a,b)=>a-b),ceiling=Math.max(.015,loudness[Math.floor(loudness.length*.95)]??.015);
  const segments=[];let active='neutral',candidate=null,repeats=0;
  for(let t=0;t<duration;t+=2) {
    const samples=windows.slice(Math.max(0,Math.floor((t-4)/.02)),Math.min(windows.length,Math.ceil((t+4)/.02)));
    const chroma=Array(12).fill(0);let weight=0,energy=0,tempo=0,tempoWeight=0,flux=0;
    for(const sample of samples) {
      energy+=sample.rms;flux+=sample.flux??0;
      if(sample.confidence>.65){tempo+=sample.bpm;tempoWeight++;}
      if(sample.rms>.003&&sample.chroma?.length===12) {
        const w=Math.min(1,sample.rms/ceiling)*(1-clamp(sample.flatness??0));
        for(let k=0;k<12;k++)chroma[k]+=sample.chroma[k]*w;
        weight+=w;
      }
    }
    const rms=energy/Math.max(1,samples.length);
    const tonal=estimateMode(chroma.map(v=>v/Math.max(1,weight)));
    const drive=clamp(.65*rms/ceiling+.25*(tempoWeight?clamp((tempo/tempoWeight-65)/100):.4)+.1*clamp(flux/Math.max(1,samples.length)*5));
    const proposed=rms>.003&&weight>1&&tonal.mode?(tonal.mode==='major'?(drive>.65?'bright':'gentle'):(drive>.65?'dramatic':'wistful')):null;
    if(proposed && proposed===candidate)repeats++;else{candidate=proposed;repeats=proposed?1:0;}
    if(repeats>=2)active=proposed;
    segments.push({start:t,end:Math.min(duration,t+2),mood:active,label:MOOD_LABELS[active],mode:proposed?tonal.mode:null,confidence:proposed?tonal.confidence:0,energy:drive,held:!proposed||proposed!==active});
  }
  return segments;
}
