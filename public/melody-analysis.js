const clamp = v => Math.max(0, Math.min(1, v));
const quantile = (values, p) => values[Math.floor((values.length-1)*p)] ?? 60;

// Harmonic evidence for MIDI 48..84 (C3..C6). This is a lead-contour
// estimate from the mix, not source separation or a transcription promise.
export function pitchCandidates(power, rate, size) {
  const peak = hz => {
    const bin = hz*size/rate, center = Math.round(bin);
    return Math.sqrt(Math.max(power[center]||0, (power[center-1]||0)*0.65, (power[center+1]||0)*0.65));
  };
  const scores = Array.from({length:37}, (_,i) => {
    const hz = 440*2**((48+i-69)/12), fundamental=peak(hz);
    let harmonics=0;
    for(let h=2;h<=5;h++) harmonics+=peak(hz*h)/(h*2);
    // Require fundamental evidence, so a bass overtone does not create an
    // arbitrary missing-fundamental melody one or two octaves below it.
    return fundamental + Math.min(fundamental*1.5,harmonics);
  });
  const top=Math.max(1e-10,...scores);
  return scores.map(v=>v/top);
}

export function trackMelody(features, step=0.08) {
  if(!features.length)return [];
  // Find a continuous path through competing pitches over the whole song.
  // Backtracking allows a brief stronger overtone to lose to a stable melody.
  const paths=[],costs=[];
  for(let i=0;i<features.length;i++) {
    const scores=features[i].pitches??Array(37).fill(0), prev=costs[i-1];
    const row=new Float64Array(37),back=new Uint8Array(37);
    for(let n=0;n<37;n++) {
      let best=-Infinity,from=n;
      for(let p=0;p<37;p++) {
        const jump=Math.abs(n-p), penalty=Math.min(0.85,jump*0.07)+(jump>=11?0.15:0);
        const value=(prev?.[p]??0)-(i?penalty:0);
        if(value>best){best=value;from=p;}
      }
      row[n]=best+scores[n];back[n]=from;
    }
    const max=Math.max(...row);for(let n=0;n<37;n++)row[n]-=max;
    costs.push(row);paths.push(back);
  }
  let note=costs.at(-1).indexOf(Math.max(...costs.at(-1)));
  const track=Array(features.length);
  for(let i=features.length-1;i>=0;i--) {
    const f=features[i],scores=f.pitches??[],score=scores[note]??0;
    const competitor=Math.max(0,...scores.filter((_,n)=>Math.abs(n-note)>2));
    const confidence=clamp((score-competitor)*2.5)*(1-clamp((f.flatness??0)*2));
    track[i]={time:i*step,midi:48+note,confidence:score>.6?confidence:0};
    note=paths[i][note];
  }
  return track;
}

// Lamp-independent score: normalized color positions, note events, phrases and
// motif identities. A single lamp renders this; future fixtures can share it.
export function musicalScore(windows,duration,beats) {
  if(!windows.some(w=>Number.isFinite(w.leadMidi)))return null;
  const step=.08,track=[];
  let held=60;
  for(let i=0;i<windows.length;i+=4) {
    const w=windows[i],valid=w.rms>.003 && (w.leadConfidence??0)>=.18;
    if(valid)held=w.leadMidi;
    track.push({time:i*.02,midi:held,confidence:valid?w.leadConfidence:0,audible:w.rms>.003,rms:w.rms});
  }
  // Median filter only removes isolated 80 ms pitch spikes, retaining bends.
  for(let i=1;i<track.length-1;i++) {
    if(track[i-1].confidence&&track[i].confidence&&track[i+1].confidence)track[i].midi=[track[i-1].midi,track[i].midi,track[i+1].midi].sort((a,b)=>a-b)[1];
  }
  // Reject a lone confident frame unsupported by either neighbor. A brief
  // spectral peak must not cause a fresh color excursion during uncertainty.
  const supported=track.map((p,i)=>p.confidence && [track[i-1],track[i+1]].some(n=>n?.confidence&&Math.abs(n.midi-p.midi)<=2));
  for(let i=0;i<track.length;i++)if(!supported[i])track[i].confidence=0;
  const pitches=track.filter(t=>t.confidence).map(t=>t.midi).sort((a,b)=>a-b);
  const low=quantile(pitches,.05),high=quantile(pitches,.95),span=Math.max(7,high-low);
  let position=.5;
  for(const point of track){if(point.confidence)position=clamp((point.midi-low)/span);point.position=position;}
  for(let i=0;i<track.length;i++) {
    const point=track[i],prev=track[i-1];
    point.attack=Boolean(point.confidence&&(!prev?.confidence || Math.abs(point.midi-prev.midi)>=1 || point.rms>prev.rms*1.5));
  }
  const notes=[];
  for(const point of track) {
    const last=notes.at(-1);
    if(point.confidence) {
      if(last&&!point.attack&&Math.abs(last.end-point.time)<.001&&Math.abs(last.midi-point.midi)<1)last.end=Math.min(duration,point.time+step);
      else notes.push({start:point.time,end:Math.min(duration,point.time+step),midi:point.midi});
    }
  }
  // Pauses bound phrases. Without a pause, groups of eight detected beats are
  // candidate phrases, not asserted verse/chorus boundaries or a known meter.
  const boundaries=[0];let nextBeat=8;
  for(let i=1;i<track.length;i++) {
    const t=track[i].time,last=boundaries.at(-1);
    const pauseEnd=track[i].audible&&i>=5&&track.slice(i-5,i).every(p=>!p.audible);
    while(nextBeat<beats.length&&beats[nextBeat]<last+1.5)nextBeat+=8;
    if(t-last>=1.5&&(pauseEnd || nextBeat<beats.length&&t>=beats[nextBeat] || t-last>=8)) {
      boundaries.push(t);while(nextBeat<beats.length&&beats[nextBeat]<=t)nextBeat+=8;
    }
  }
  boundaries.push(duration);
  const phrases=[],motifs=[];
  for(let i=0;i<boundaries.length-1;i++) {
    const start=boundaries[i],end=boundaries[i+1],points=track.filter(p=>p.time>=start&&p.time<end);
    const coverage=points.filter(p=>p.confidence).length/Math.max(1,points.length);
    const samples=Array.from({length:16},(_,k)=>points[Math.min(points.length-1,Math.floor(k/16*points.length))]);
    const base=samples.find(p=>p?.confidence)?.midi??60;
    const contour=samples.map(p=>(p?.midi??base)-base);
    const rhythm=Array.from({length:16},(_,k)=>points.some(p=>p.attack&&p.time>=start+k/16*(end-start)&&p.time<start+(k+1)/16*(end-start))?1:0);
    const movement=Math.max(...contour)-Math.min(...contour);
    let motif=-1;
    if(coverage>=.45&&movement>=2&&end-start>=1.5) {
      motif=motifs.findIndex(m=>{
        const ratio=(end-start)/m.duration;
        return ratio>.65&&ratio<1.5&&contour.reduce((sum,v,k)=>sum+Math.abs(v-m.contour[k]),0)/16<1.4&&rhythm.reduce((sum,v,k)=>sum+Math.abs(v-m.rhythm[k]),0)/16<.25;
      });
      if(motif<0){motif=motifs.length;motifs.push({contour,rhythm,duration:end-start,positions:samples.map(p=>p?.position??.5),occurrences:0});}
      motifs[motif].occurrences++;
    }
    phrases.push({start,end,motif,coverage});
  }
  // Repeated contours share their original color trajectory, including when
  // transposed. Interpolate in musical phrase time, never loop by wall clock.
  for(const phrase of phrases) {
    const motif=motifs[phrase.motif];if(!motif||motif.occurrences<2)continue;
    for(const point of track)if(point.time>=phrase.start&&point.time<phrase.end&&point.confidence) {
      const index=Math.min(15,(point.time-phrase.start)/(phrase.end-phrase.start)*16),a=Math.floor(index),f=index-a;
      point.position=motif.positions[a]*(1-f)+motif.positions[Math.min(15,a+1)]*f;
    }
  }
  let heldPosition=.5;
  for(const point of track){if(point.confidence)heldPosition=point.position;else point.position=heldPosition;}
  return {step,track,notes,phrases,motifs:motifs.map(({positions,contour,rhythm,...m},id)=>({...m,id})),coverage:pitches.length/Math.max(1,track.length)};
}
