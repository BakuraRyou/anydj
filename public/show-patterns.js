import {musicStyleAt} from './music-style.js';
const clamp=x=>Math.max(0,Math.min(1,x));
export function planPatterns(passages,times,downbeats=[],musicStyle=null,impacts=[]) {
  const phrases=[],events=[];
  for(const [sectionIndex,section] of passages.entries()) {
    const selected=times.map((time,index)=>({time,index})).filter(e=>e.time>=section.start&&e.time<section.end);
    const bars=downbeats.filter(time=>time>=section.start&&time<section.end);
    const boundaries=[section.start];
    // Four detected bars are a visual phrase, not an assumed four-beat meter.
    if(bars.length>=5){for(let i=4;i<bars.length;i+=4)if(bars[i]-boundaries.at(-1)>=6&&section.end-bars[i]>=3)boundaries.push(bars[i]);}
    else for(let i=16;i<selected.length;i+=16)if(selected[i].time-boundaries.at(-1)>=6&&section.end-selected[i].time>=3)boundaries.push(selected[i].time);
    boundaries.push(section.end);
    for(let i=0;i<boundaries.length-1;i++) {
      const start=boundaries[i],end=boundaries[i+1];
      const profile=musicStyleAt(musicStyle,(start+end)/2);
      const gentle=profile.confidence>.35&&
        (profile.weights.acoustic||0)+(profile.weights.orchestral||0)+(profile.weights.ambient||0)>.5;
      const local=selected.filter(e=>e.time>=start&&e.time<end);
      const measured=local.map(e=>impacts[e.index]).filter(Number.isFinite);
      const driving=measured.length>0&&measured.filter(value=>value>=.55).length/measured.length>=.6;
      const soft=measured.length>=3&&measured.reduce((sum,value)=>sum+value,0)/measured.length<.3;
      const sequence=section.look==='held'?['wash']:section.look==='lift'?['build']:
        gentle||soft?['sweep','bounce']:driving?['punch','bounce']:section.look==='peak'?['punch','bounce','sweep']:['bounce','sweep'];
      const previous=phrases.at(-1);
      // A new energetic section gets a clear entrance. Within a section,
      // keep motif identity but avoid repeating the preceding movement.
      const entrance=i===0&&section.look==='peak'&&!gentle&&!soft&&
        passages[sectionIndex-1]?.look!=='peak';
      let choice=entrance?0:(i+(section.motif||0))%sequence.length;
      if(!entrance&&sequence.length>1&&sequence[choice]===previous?.kind)choice=(choice+1)%sequence.length;
      const kind=sequence[choice];
      const phrase={start,end,kind,section:sectionIndex};phrases.push(phrase);
      for(const [j,event] of local.entries()) {
        const next=times[event.index+1];
        const progress=kind==='build'
          ?clamp((event.time-section.start)/Math.max(.1,section.end-section.start))
          :clamp((event.time-start)/Math.max(.1,end-start));
        const onBar=bars.some(time=>Math.abs(time-event.time)<=.03);
        events[event.index]={kind,driving:driving&&!gentle,progress,alternate:onBar?0:j%2,
          // Morph only within the same musical section; an entrance stays crisp.
          previousKind:!driving&&i>0&&previous?.kind!==kind&&j===0?previous.kind:undefined,
          blend:.5,
          period:Math.max(.2,Math.min(1,next===undefined?.5:next-event.time))};
      }
    }
  }
  return {version:3,phrases,events};
}
export function patternEnvelope(event,age,decay) {
  const current=envelope(event,age,decay);
  if(!event?.previousKind)return current;
  const previous=envelope({...event,kind:event.previousKind},age,decay);
  return previous*(1-event.blend)+current*event.blend;
}
function envelope(event,age,decay) {
  const ordinary=Math.exp(-age/decay);
  if(!event||event.kind==='wash'||event.kind==='punch')return ordinary;
  if(event.kind==='bounce')return (event.alternate?.72:1)*Math.exp(-age/(decay*(event.alternate?1.7:1)));
  if(event.kind==='build')return (.6+event.progress*.65)*Math.exp(-age/(decay*(1.6-event.progress*.8)));
  // A broad rising/falling wave spans the musical interval rather than another
  // sharp flash. It exists only after an acoustically selected event.
  const phase=clamp(age/event.period);
  return age>event.period?0:(.35+.65*Math.sin(Math.PI*phase))*(1-phase)**.75;
}
