// Multi-label style evidence shapes the show; it never edits the beat grid.
export const STYLE_FAMILIES=['electronic','rock','pop','groove','acoustic','orchestral','ambient'];
const clamp=value=>Math.max(0,Math.min(1,value));
export function validateMusicStyle(value,duration) {
  if(value?.version!==1||value.source!=='discogs-effnet'||!Number.isFinite(value.duration)||Math.abs(value.duration-duration)>.1||!Array.isArray(value.segments)||!value.segments.length||value.segments.length>500)throw Error('Ungültige Stilanalyse.');
  let end=0;
  const segments=value.segments.map(segment=>{
    if(!Number.isFinite(segment.start)||!Number.isFinite(segment.end)||Math.abs(segment.start-end)>.02||segment.end<=segment.start||segment.end>duration+.02)throw Error('Ungültiger Stilzeitraum.');
    const scores=Object.fromEntries(STYLE_FAMILIES.map(name=>{
      const score=segment.scores?.[name];if(!Number.isFinite(score)||score<0||score>1)throw Error('Ungültige Stilbewertung.');return [name,score];
    }));
    if(!Array.isArray(segment.tags)||segment.tags.length>5)throw Error('Ungültige Stil-Tags.');
    const tags=segment.tags.map(tag=>{if(typeof tag.label!=='string'||tag.label.length>100||!Number.isFinite(tag.score)||tag.score<0||tag.score>1)throw Error('Ungültiges Stil-Tag.');return {label:tag.label,score:tag.score};});
    end=segment.end;return {start:segment.start,end,scores,tags};
  });
  if(Math.abs(end-duration)>.02)throw Error('Unvollständige Stilanalyse.');
  return {version:1,source:value.source,duration,segments};
}
const neutral={drive:1,decay:1,colorSpeed:1,colorSpan:1,melody:.3,base:1};
// These are lighting design choices, not claims made by the classifier.
const designs={
  electronic:{drive:1.16,decay:.88,colorSpeed:1.15,colorSpan:1,melody:.2,base:.95},
  rock:{drive:1.12,decay:1,colorSpeed:1.05,colorSpan:.9,melody:.3,base:1},
  pop:{drive:1,decay:1.12,colorSpeed:.95,colorSpan:.85,melody:.4,base:1},
  groove:{drive:1.08,decay:1.3,colorSpeed:.9,colorSpan:.85,melody:.35,base:.95},
  acoustic:{drive:.8,decay:1.6,colorSpeed:.65,colorSpan:.65,melody:.65,base:1.1},
  orchestral:{drive:.85,decay:1.8,colorSpeed:.6,colorSpan:.75,melody:.72,base:1.1},
  ambient:{drive:.55,decay:2.2,colorSpeed:.45,colorSpan:.6,melody:.8,base:1.1},
};
export function musicStyleAt(style,time) {
  if(!style)return {...neutral,weights:{},confidence:0};
  // Symmetric six-second context avoids hard switches from a single prediction.
  const scores=Object.fromEntries(STYLE_FAMILIES.map(name=>[name,0]));let total=0;
  for(const segment of style.segments) {
    const center=(segment.start+segment.end)/2;
    const weight=Math.max(0,1-Math.abs(center-time)/3.1);
    if(!weight)continue;total+=weight;
    for(const name of STYLE_FAMILIES)scores[name]+=segment.scores[name]*weight;
  }
  if(!total)return {...neutral,weights:{},confidence:0};
  for(const name of STYLE_FAMILIES)scores[name]/=total;
  const top=Math.max(...Object.values(scores));
  // Scores are independent model activations, not calibrated percentages.
  const confidence=clamp((top-.06)/.3);
  const weights=Object.fromEntries(STYLE_FAMILIES.map(name=>[name,Math.max(0,scores[name]-Math.max(.03,top*.15))]));
  const sum=Object.values(weights).reduce((a,b)=>a+b,0);
  if(!sum)return {...neutral,weights:{},confidence:0};
  for(const name of STYLE_FAMILIES)weights[name]/=sum;
  return {...Object.fromEntries(Object.keys(neutral).map(key=>[key,neutral[key]*(1-confidence)+STYLE_FAMILIES.reduce((v,name)=>v+designs[name][key]*weights[name],0)*confidence])),weights,confidence};
}
