const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]??0;};

// Musical evidence selects a reproducible design; it is not a genre classifier.
export function automaticSettings(windows, limits={}, beatTimes=null) {
  const audible=windows.filter(w=>Number.isFinite(w.rms)&&w.rms>.003);
  const mean=read=>audible.reduce((sum,w)=>sum+read(w),0)/Math.max(1,audible.length);
  let bpm=mean(w=>w.bpm||0),regularity=mean(w=>w.confidence||0);
  if(beatTimes!==null){
    const intervals=beatTimes.slice(1).map((t,i)=>t-beatTimes[i]).filter(d=>d>.15&&d<2);
    const period=median(intervals);bpm=period?60/period:0;
    regularity=intervals.length>=4?intervals.filter(d=>Math.abs(d-period)<period*.15).length/intervals.length:0;
  }
  const tonal=mean(w=>Math.max(w.leadConfidence||0,w.harmonicConfidence||0,w.tonality||0));
  const bass=mean(w=>w.bands?.[0]??0),texture=mean(w=>w.flatness||0);
  const rhythmic=audible.length>0&&regularity>.65&&bpm>=105;
  const flowing=audible.length>0&&!rhythmic&&(regularity>.35||tonal>.3);
  const kind=rhythmic?'pulse':flowing?'flow':'calm';
  const label={pulse:'Dynamisch mit gezielten Akzenten',flow:'Fließend und melodisch',calm:'Ruhig und weich'}[kind];
  const description={pulse:'Klangbewegung, Aufbauten und rhythmische Akzente wechseln mit den Passagen.',flow:'Zusammenhängende Farbflächen und sanfte Helligkeitsbögen.',calm:'Ruhige Lichtflächen und langsame Farbentwicklung.'}[kind];
  return {kind,label,description,options:{
    mode:rhythmic||flowing?'color':'soft',mood:'auto',
    palette:rhythmic?(bass>.3?'fire':'neon'):flowing?'sunset':'ocean',
    saturation:Math.round(clamp((rhythmic?92:flowing?82:68)+tonal*8-texture*8,55,100)),
    toneFollow:Math.round(clamp(.6+tonal*.35,.6,.95)*100)/100,
    speed:Math.round(clamp((rhythmic?1.2:flowing?.7:.35)+(bpm/180)*.35,.3,1.8)*10)/10,
    smoothing:rhythmic?.7:flowing?.75:.85,
    dynamics:rhythmic?'punchy':flowing?'balanced':'sensitive',
    intensity:rhythmic?1.5:flowing?1.2:.85,
    minimum:limits.minimum??5,maximum:limits.maximum??100,
    colorA:'#ff0080',colorB:'#00dfff',arrangement:'auto',
  }};
}
