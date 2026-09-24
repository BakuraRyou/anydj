import {editPhaseTime} from './light-editor-model.js';
export function createLightTimeline(host,{plan,getSnap=()=>'beat',onSelect,onSeek,onEdit}) {
  host.innerHTML='<div class="le-scroll"><div class="le-track"><div class="le-ruler"></div><div class="le-phases" aria-label="Lichtphasen"></div><div class="le-playhead"></div></div></div><input class="le-seek" aria-label="Abspielposition in Sekunden" type="range" min="0" step="0.01">';
  const q=s=>host.querySelector(s),track=q('.le-track'),lane=q('.le-phases'),seek=q('.le-seek');
  seek.max=plan.duration;seek.oninput=()=>onSeek(Number(seek.value));
  const time=e=>Math.max(0,Math.min(plan.duration,(e.clientX-track.getBoundingClientRect().left)/track.getBoundingClientRect().width*plan.duration));
  let phases=[],drag=null;
  for(let i=0;i<=8;i++){const label=document.createElement('span');label.style.left=`${i/8*100}%`;const t=plan.duration*i/8;label.textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;q('.le-ruler').append(label);}

  function update(edits,selected){
    phases=edits;lane.replaceChildren();
    edits.forEach((phase,index)=>{
      const block=document.createElement('div');block.className='le-phase';block.style.left=`${phase.start/plan.duration*100}%`;block.style.width=`${(phase.end-phase.start)/plan.duration*100}%`;block.dataset.index=index;block.dataset.selected=String(index===selected);
      block.style.setProperty('--phase-color',phase.colors==='auto'?'#75c9ca':phase.colorA);
      for(const kind of ['start','move','end']){const button=document.createElement('button');button.type='button';button.dataset.kind=kind;button.className=`le-${kind}`;button.setAttribute('aria-label',`${phase.name}: ${kind==='move'?'Phase verschieben':kind==='start'?'Beginn ändern':'Ende ändern'}`);button.textContent=kind==='move'?phase.name:'';button.title=`${phase.name} · ${phase.start.toFixed(2)}–${phase.end.toFixed(2)} s`;button.setAttribute('aria-pressed',String(index===selected));block.append(button);}
      lane.append(block);
    });
  }
  lane.addEventListener('pointerdown',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(e.button!==0)return;e.preventDefault();const index=Number(button.parentElement.dataset.index),phase=phases[index];
    drag={id:e.pointerId,index,kind:button.dataset.kind,x:e.clientX,offset:time(e)-phase.start,button};lane.setPointerCapture(e.pointerId);button.focus();
  });
  lane.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const value=time(e)-(drag.kind==='move'?drag.offset:0);const preview=editPhaseTime(phases,drag.index,drag.kind,value,plan,getSnap());for(const [i,phase] of preview.entries()){const block=lane.children[i];block.style.left=`${phase.start/plan.duration*100}%`;block.style.width=`${(phase.end-phase.start)/plan.duration*100}%`;}drag.button.parentElement.dataset.dragging='true';});
  lane.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;const moved=Math.abs(e.clientX-d.x)>3;
    if(moved)onEdit(d.index,d.kind,time(e)-(d.kind==='move'?d.offset:0));
    onSelect(d.index);lane.querySelector(`[data-index="${d.index}"] .le-${d.kind}`)?.focus();
  });
  lane.addEventListener('pointercancel',()=>{if(drag){const index=drag.index;drag=null;onSelect(index);}});
  lane.addEventListener('keydown',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;const index=Number(button.parentElement.dataset.index),kind=button.dataset.kind,phase=phases[index];
    if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(index);lane.querySelector(`[data-index="${index}"] .le-${kind}`)?.focus();return;}
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
    const current=kind==='end'?phase.end:phase.start,direction=e.key==='ArrowLeft'?-1:1;const grid=getSnap()==='bar'?plan.beatGrid?.downbeats:getSnap()==='beat'?(plan.beatGrid?.beats??plan.beatTiming?.times):[];const points=grid?.filter(t=>direction<0?t<current-1e-6:t>current+1e-6);const value=points?.length?(direction<0?points.at(-1):points[0]):current+direction*(e.shiftKey?1:.1);onEdit(index,kind,value);
    lane.querySelector(`[data-index="${index}"] .le-${kind}`)?.focus();
  });
  track.addEventListener('click',e=>{if(!e.target.closest('button'))onSeek(time(e));});
  return {update,setPosition(value){seek.value=value;q('.le-playhead').style.left=`${value/plan.duration*100}%`;},setZoom(value){track.style.width=`${value*100}%`;},destroy(){host.replaceChildren();}};
}
