export const STRUCTURE_LABELS={start:'Anfang',intro:'Intro',verse:'Strophe',chorus:'Refrain',bridge:'Bridge',break:'Break',inst:'Instrumental',solo:'Solo',outro:'Outro',end:'Ende'};
export function validateStructure(value,duration) {
  if(!value||value.source!=='all-in-one'||value.version!==1||!Number.isFinite(duration)||duration<=0||
    !Number.isFinite(value.duration)||Math.abs(value.duration-duration)>.05||
    !Array.isArray(value.segments)||!value.segments.length||value.segments.length>256)throw Error('Songaufbau passt nicht zu diesem Lied.');
  const segments=value.segments.map((s,i)=>{
    if(!s||!Object.hasOwn(STRUCTURE_LABELS,s.label)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||
      s.start<0||s.end>duration+.05||s.end<=s.start||
      (i===0?s.start>.05:Math.abs(s.start-value.segments[i-1].end)>.001))throw Error('Ungültige Songabschnitte.');
    return {start:s.start,end:Math.min(duration,s.end),label:s.label};
  });
  if(Math.abs(segments.at(-1).end-duration)>.05)throw Error('Songaufbau ist unvollständig.');
  segments[0].start=0;segments.at(-1).end=duration;
  if(segments.some(s=>s.end<=s.start))throw Error('Ungültige Abschnittslänge.');
  return {version:1,source:'all-in-one',duration,segments};
}

// Label-based themes recur, but labels are predictions rather than ground truth.
export function structureTheme(label) {
  return {
    chorus:{rotation:0,saturation:1,speed:1.15},
    verse:{rotation:1,saturation:.9,speed:.8},
    bridge:{rotation:2,saturation:.92,speed:.7},
    solo:{rotation:3,saturation:1,speed:1.1},
    inst:{rotation:2,saturation:.9,speed:.9},
  }[label]??{rotation:1,saturation:.78,speed:.6};
}
