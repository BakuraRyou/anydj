import {transitionAudioGains,validTransitionPoints} from './transition-audio.js';
const clone=value=>value.map(points=>points.map(p=>[...p]));
export function transitionControlPoints(plan){
 if(validTransitionPoints(plan?.points))return clone(plan.points);
 const times=plan?.style==='handover'?[0,.3,.4,.5,.6,.7,1]:[0,.25,.5,.75,1];
 return [0,1].map(channel=>times.map(t=>[t,transitionAudioGains(t,plan)[channel]]));
}
export function createTransitionCurveEditor(svg,{onChange,onInspect}){
 const ns='http://www.w3.org/2000/svg',toolbar=document.createElement('div');toolbar.className='curve-toolbar';
 toolbar.innerHTML='<div class="curve-channels" role="group" aria-label="Kurve wählen"><button type="button" data-channel="0" aria-pressed="true">Ausgehend · 1</button><button type="button" data-channel="1" aria-pressed="false">Eingehend · 2</button></div><div class="curve-tools" role="group" aria-label="Punkte bearbeiten"><button type="button" data-add title="Punkt hinzufügen (N)">+ Punkt</button><button type="button" data-delete disabled title="Ausgewählten Punkt löschen (Entf)">Löschen</button><button type="button" data-undo disabled title="Rückgängig (Strg/⌘ Z)">↶ Rückgängig</button><button type="button" data-redo disabled title="Wiederholen (Strg/⌘ Shift Z)">↷ Wiederholen</button><button type="button" data-reset>Zur Vorlage</button></div>';
 svg.before(toolbar);
 const hint=document.createElement('p');hint.className='small';hint.textContent='Punkt auswählen und ziehen. ← → Zeitpunkt · ↑ ↓ Pegel · Shift: größere Schritte · N: neuer Punkt · Entf: löschen · Strg/⌘ Z: rückgängig · Strg/⌘ Shift Z: wiederholen. Tab wechselt die Punkte. Start und Ende bleiben fest.';svg.after(hint);
 svg.setAttribute('role','group');svg.setAttribute('aria-label','Interaktiver Übergang: Lautstärkekurven beider Titel');svg.classList.add('transition-curve-editor');
 const grid=document.createElementNS(ns,'g');grid.setAttribute('pointer-events','none');svg.prepend(grid);
 const handles=document.createElementNS(ns,'g');svg.append(handles);
 svg.querySelectorAll('text').forEach(node=>node.remove());
 const selection=document.createElement('p');selection.className='curve-selection';selection.setAttribute('role','status');hint.before(selection);
 svg.setAttribute('tabindex','0');
 let points=null,plan=null,channel=0,selected=null,drag=null,history=[],future=[],cursor=.5,mixPosition=0;
 const colors=['#f7ad76','#79ced8'];
 const shown=(value,c)=>(c?mixPosition:0)+(1-mixPosition)*value;
 function describe(){
  handles.querySelectorAll('[data-point]').forEach(node=>node.setAttribute('r',+node.dataset.channel===channel&&+node.dataset.point===selected?'5':'4'));
  const point=points?.[channel]?.[selected];
  selection.textContent=point?`${channel?'Eingehend':'Ausgehend'} · Punkt ${selected+1} · ${(point[0]*(plan?.duration||0)).toFixed(2)} s · ${Math.round(shown(point[1],channel)*100)} %`:'Punkt auswählen oder mit N hinzufügen.';
  toolbar.querySelector('[data-delete]').disabled=!point||selected===0||selected===points[channel].length-1;
 }
 function focusPoint(){handles.querySelector(`[data-channel="${channel}"][data-point="${selected}"]`)?.focus();}
 function draw(){
  grid.replaceChildren();
  for(let i=0;i<=4;i++){
   const x=20+460*i/4,line=document.createElementNS(ns,'path');line.setAttribute('d',`M${x} 10V115`);line.setAttribute('stroke','#526471');line.setAttribute('opacity','.3');grid.append(line);
   const label=document.createElementNS(ns,'text');label.setAttribute('x',x);label.setAttribute('y','132');label.setAttribute('font-size','9');label.setAttribute('fill','currentColor');label.setAttribute('text-anchor',i===0?'start':i===4?'end':'middle');label.textContent=((plan?.duration||0)*i/4).toFixed(1)+' s';grid.append(label);
  }
  handles.replaceChildren();toolbar.querySelectorAll('button').forEach(b=>b.disabled=!points);
  toolbar.querySelector('[data-delete]').disabled=!points||selected==null||selected===0||selected===points[channel].length-1;
  toolbar.querySelector('[data-undo]').disabled=!history.length;toolbar.querySelector('[data-redo]').disabled=!future.length;describe();
  toolbar.querySelector('[data-add]').disabled=!points||points[channel].length>=32;
  toolbar.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.channel===channel)));
  points?.forEach((curve,c)=>curve.forEach(([x,y],index)=>{
   const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',20+460*x);circle.setAttribute('cy',115-105*shown(y,c));circle.setAttribute('r',c===channel&&index===selected?'5':'4');circle.setAttribute('fill',colors[c]);circle.setAttribute('stroke','#18232c');circle.setAttribute('stroke-width','1.5');circle.dataset.channel=c;circle.dataset.point=index;
   const fixed=index===0||index===curve.length-1;
   circle.setAttribute('tabindex',fixed?'-1':'0');circle.setAttribute('role','slider');circle.setAttribute('aria-label',`${c?'Nächster':'Ausgehender'} Titel · Punkt ${index+1} · ${(x*(plan?.duration||0)).toFixed(1)} Sekunden${fixed?' · fest':''}`);circle.setAttribute('aria-valuemin','0');circle.setAttribute('aria-valuemax','100');circle.setAttribute('aria-valuenow',Math.round(shown(y,c)*100));circle.setAttribute('aria-valuetext',`${Math.round(shown(y,c)*100)} Prozent bei ${(x*(plan?.duration||0)).toFixed(1)} Sekunden`);handles.append(circle);
  }));
 }
 function save(){future=[];history.push(clone(points));if(history.length>40)history.shift();}
 function commit(){onChange(clone(points));draw();if(selected!=null)onInspect(points[channel][selected][0]*100);}
 function coords(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(1,(v.x-20)/460)),Math.max(0,Math.min(1,((115-v.y)/105-(channel?mixPosition:0))/Math.max(.001,1-mixPosition)))];}
 function move(x,y){if(selected==null||selected===0||selected===points[channel].length-1)return;const curve=points[channel];curve[selected]=[Math.max(curve[selected-1][0]+.002,Math.min(curve[selected+1][0]-.002,x)),Math.max(0,Math.min(1,y))];commit();}
 function add(x=cursor,y){
  if(!points||points[channel].length>=32)return;
  const curve=points[channel];if(curve.some(p=>Math.abs(p[0]-x)<.005)){x=.5;let gap=0;for(let i=1;i<curve.length;i++)if(curve[i][0]-curve[i-1][0]>gap){gap=curve[i][0]-curve[i-1][0];x=(curve[i][0]+curve[i-1][0])/2;}}
  save();const index=curve.findIndex(p=>p[0]>x);if(y==null)y=transitionAudioGains(x,{points})[channel];curve.splice(index,0,[x,y]);selected=index;commit();focusPoint();
 }
 function remove(){if(!points||selected==null||selected===0||selected===points[channel].length-1)return;save();points[channel].splice(selected,1);selected=Math.min(selected,points[channel].length-2);commit();focusPoint();}
 function undo(){if(!history.length)return;future.push(clone(points));points=history.pop();selected=null;commit();}
 function redo(){if(!future.length)return;history.push(clone(points));points=future.pop();selected=null;commit();}
 toolbar.onclick=e=>{const b=e.target.closest('button');if(!b||!points)return;if(b.dataset.channel!=null){channel=+b.dataset.channel;selected=points[channel].length>2?1:null;draw();focusPoint();}else if(b.hasAttribute('data-add'))add();else if(b.hasAttribute('data-delete'))remove();else if(b.hasAttribute('data-undo'))undo();else if(b.hasAttribute('data-redo'))redo();else if(b.hasAttribute('data-reset')){save();selected=null;onChange(null);draw();}};
 svg.addEventListener('pointerdown',e=>{if(!points||e.button!==0)return;const target=e.target.closest('[data-point]');if(target){channel=+target.dataset.channel;selected=+target.dataset.point;save();drag=e.pointerId;svg.setPointerCapture(e.pointerId);draw();e.preventDefault();}else{cursor=coords(e)[0];onInspect(cursor*100);}});
 svg.addEventListener('pointermove',e=>{if(drag===e.pointerId&&points)move(...coords(e));});
 const end=()=>{if(drag!==null)focusPoint();drag=null;};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
 svg.addEventListener('dblclick',e=>{if(points&&!e.target.closest('[data-point]')){e.preventDefault();add(...coords(e));}});
 svg.addEventListener('focusin',event=>{const target=event.target.closest('[data-point]');if(!target)return;channel=+target.dataset.channel;selected=+target.dataset.point;describe();toolbar.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.channel===channel)));});
 function key(e){
  if(!points||e.defaultPrevented||e.isComposing||e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return false;
  const target=e.target.closest('[data-point]');if(target){channel=+target.dataset.channel;selected=+target.dataset.point;}
  const k=e.key.toLowerCase(),command=e.ctrlKey||e.metaKey;
  if(command){if(k==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return true;}if(k==='y'){e.preventDefault();redo();return true;}return false;}
  if(e.repeat&&!k.startsWith('arrow'))return false;
  if(k==='1'||k==='2'){e.preventDefault();channel=+k-1;selected=points[channel].length>2?1:null;draw();focusPoint();return true;}
  if(k==='n'){e.preventDefault();add();return true;}
  if(['delete','backspace'].includes(k)&&selected!==null){e.preventDefault();remove();return true;}
  if(k.startsWith('arrow')&&e.target.closest('[data-point]')&&selected!==null){
   e.preventDefault();const [x,y]=points[channel][selected],step=e.shiftKey?.05:.01;
   save();move(x+(k==='arrowright'?step:k==='arrowleft'?-step:0),y+(k==='arrowup'?step:k==='arrowdown'?-step:0));focusPoint();return true;
  }
  return false;
 }
 svg.addEventListener('keydown',event=>{if(key(event))event.stopPropagation();});
 return {key,setPlan(value,{reset=false,position=0}={}){mixPosition=position;plan=value;points=value?transitionControlPoints(value):null;if(reset){history=[];future=[];selected=null;}draw();}};
}
