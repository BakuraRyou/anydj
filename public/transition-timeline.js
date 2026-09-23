const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clock=t=>`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;
// Absolute source positions, shared real-time overlap. No media elements are touched.
export function timelineEdit(pair,key,value){
 const {time,cue,duration}=pair.plan;
 if(key==='duration')return clamp(value,.1,Math.max(.1,Math.min(60,(pair.from.duration-time)/pair.from.rate,(pair.to.duration-cue)/pair.to.rate)));
 const source=key==='time'?pair.from:pair.to;
 return clamp(value,0,Math.max(0,source.duration-duration*source.rate));
}
export function createTransitionTimeline(host,{onChange}){
 const ns='http://www.w3.org/2000/svg';let pair=null,drag=null;
 host.classList.add('transition-timeline');
 const heading=document.createElement('h3');heading.textContent='Welche Stellen sollen ineinander übergehen?';host.append(heading);
 const hint=document.createElement('p');hint.className='small';hint.textContent='Fasse den farbigen Bereich an und verschiebe ihn. Am rechten Rand änderst du die Länge.';host.append(hint);
 const lanes=['time','cue'].map((key,index)=>{
  const row=document.createElement('section'),label=document.createElement('div'),title=document.createElement('strong'),readout=document.createElement('span');label.className='timeline-label';title.textContent=index?'Danach · Einstieg':'Jetzt · Wechselstelle';label.append(title,readout);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 64');svg.setAttribute('role','group');svg.setAttribute('aria-label',title.textContent);
  const node=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
  node('rect',{x:0,y:0,width:1000,height:64,fill:'#101920',rx:6});
  const wave=node('path',{fill:'none',stroke:index?'#79ced8':'#f7ad76','stroke-opacity':'.4','stroke-width':2,'pointer-events':'none'});
  const region=node('rect',{y:4,height:56,rx:4,fill:index?'#79ced833':'#f7ad7633',stroke:index?'#79ced8':'#f7ad76',tabindex:0,role:'slider','data-timeline-start':key,'aria-label':index?'Einstieg im nächsten Titel':'Wechselstelle im ausgehenden Titel'});
  const edge=node('rect',{y:4,height:56,width:10,rx:3,fill:index?'#79ced8':'#f7ad76',tabindex:0,role:'slider','data-timeline-end':key,'aria-label':'Überblenddauer über '+(index?'nächsten':'ausgehenden')+' Titel ändern'});
  const footer=document.createElement('div');footer.className='timeline-scale';const startLabel=document.createElement('span'),endLabel=document.createElement('span'),zoom=document.createElement('button');zoom.type='button';zoom.textContent='Details vergrößern';zoom.className='timeline-zoom';footer.append(startLabel,zoom,endLabel);
  row.append(label,svg,footer);host.append(row);
  const lane={key,index,svg,wave,region,edge,readout,startLabel,endLabel,zoom,near:true,range:[0,1],waveData:null};
  zoom.onclick=()=>{lane.near=!lane.near;lane.waveData=null;draw(lane);};
  const seconds=e=>{const r=svg.getBoundingClientRect();return lane.range[0]+clamp((e.clientX-r.left)/r.width,0,1)*(lane.range[1]-lane.range[0]);};
  svg.addEventListener('pointerdown',e=>{
   if(!pair||e.button!==0)return;e.preventDefault();
   const duration=e.target===edge,source=index?pair.to:pair.from;
   drag={lane,id:e.pointerId,key:duration?'duration':key,start:seconds(e),value:duration?pair.plan.duration:pair.plan[key],rate:duration?source.rate:1};
   svg.setPointerCapture(e.pointerId);(duration?edge:region).focus();
   if(e.target!==region&&e.target!==edge){drag.value=timelineEdit(pair,key,seconds(e));onChange(key,drag.value);}
  });
  svg.addEventListener('pointermove',e=>{if(drag?.lane!==lane||drag.id!==e.pointerId)return;onChange(drag.key,timelineEdit(pair,drag.key,drag.value+(seconds(e)-drag.start)/drag.rate));});
  const finish=()=>{if(drag?.lane===lane){drag=null;lane.waveData=null;draw(lane);}};
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);svg.addEventListener('lostpointercapture',finish);
  svg.addEventListener('keydown',e=>{
   if(!pair||e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();const k=e.target===edge?'duration':key,delta=e.shiftKey?1:.1;
   onChange(k,timelineEdit(pair,k,e.key==='Home'?0:e.key==='End'?Infinity:pair.plan[k]+(e.key==='ArrowLeft'?-delta:delta)));
  });
  return lane;
 });
 function draw(lane){
  const {key,index,svg,wave,region,edge,readout,startLabel,endLabel,zoom}=lane;
  svg.style.pointerEvents=pair?'':'none';for(const node of [region,edge])node.setAttribute('tabindex',pair?'0':'-1');
  if(!pair){readout.textContent='Zwei Titel laden';wave.setAttribute('d','');region.setAttribute('width','0');edge.setAttribute('visibility','hidden');return;}
  edge.removeAttribute('visibility');const source=index?pair.to:pair.from,start=pair.plan[key],end=start+pair.plan.duration*source.rate;
  if(!drag){lane.range=lane.near?[Math.max(0,start-10*source.rate),Math.min(source.duration,end+10*source.rate)]:[0,source.duration];}
  const [a,b]=lane.range,span=Math.max(.001,b-a),x=t=>clamp((t-a)/span*1000,0,1000);
  region.setAttribute('x',x(start));region.setAttribute('width',Math.max(1,x(end)-x(start)));edge.setAttribute('x',clamp(x(end)-5,0,990));
  for(const [node,v,max] of [[region,start,source.duration-pair.plan.duration*source.rate],[edge,pair.plan.duration,Math.min(60,(pair.from.duration-pair.plan.time)/pair.from.rate,(pair.to.duration-pair.plan.cue)/pair.to.rate)]]){
   node.setAttribute('aria-valuemin',node===edge?.1:0);node.setAttribute('aria-valuemax',max);node.setAttribute('aria-valuenow',v);node.setAttribute('aria-valuetext',node===edge?v.toFixed(2)+' Sekunden':clock(v));
  }
  readout.textContent=clock(start)+' – '+clock(end);startLabel.textContent=clock(a);endLabel.textContent=clock(b);zoom.textContent=lane.near?'Ganzen Titel zeigen':'Details vergrößern';zoom.setAttribute('aria-pressed',String(lane.near));
  const values=source.waveform?.peaks||source.waveform?.rms,signature=values?`${a}:${b}:${values.length}`:'empty';
  if(lane.waveData!==signature){lane.waveData=signature;wave.setAttribute('d',values?Array.from({length:250},(_,i)=>{const t=a+(i+.5)/250*span,v=values[Math.min(values.length-1,Math.floor(t/source.duration*values.length))]||0,h=clamp(v,0,1)*27;return `M${i*4+2} ${32-h}v${h*2}`;}).join(' '):'M0 32H1000');}
 }
 return {setPair(value){if(pair!==value)lanes.forEach(l=>{l.waveData=null;});pair=value;lanes.forEach(draw);}};
}
