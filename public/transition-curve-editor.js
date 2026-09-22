import {transitionAudioGains,validTransitionPoints} from './transition-audio.js';
const clone=value=>value.map(points=>points.map(p=>[...p]));
export function transitionControlPoints(plan){
 if(validTransitionPoints(plan?.points))return clone(plan.points);
 const times=plan?.style==='handover'?[0,.3,.4,.5,.6,.7,1]:[0,.25,.5,.75,1];
 return [0,1].map(channel=>times.map(t=>[t,transitionAudioGains(t,plan)[channel]]));
}
export function createTransitionCurveEditor(svg,{onChange,onInspect}){
 const ns='http://www.w3.org/2000/svg',toolbar=document.createElement('div');toolbar.className='curve-toolbar';
 toolbar.innerHTML='<button type="button" data-channel="0" aria-pressed="true">Ausgehender Titel</button><button type="button" data-channel="1" aria-pressed="false">Nächster Titel</button><button type="button" data-add>Punkt hinzufügen</button><button type="button" data-delete disabled>Punkt löschen</button><button type="button" data-undo disabled>Rückgängig</button><button type="button" data-reset>Kurve zurücksetzen</button>';
 svg.before(toolbar);
 const hint=document.createElement('p');hint.className='small';hint.textContent='Punkte ziehen: horizontal = Zeitpunkt, vertikal = Lautstärke. Doppelklick fügt einen Punkt hinzu. Pfeiltasten verschieben, Entf löscht. Start und Ende bleiben fest.';svg.after(hint);
 svg.setAttribute('role','group');svg.setAttribute('aria-label','Interaktiver Übergang: Lautstärkekurven beider Titel');svg.classList.add('transition-curve-editor');
 const grid=document.createElementNS(ns,'g');grid.setAttribute('pointer-events','none');svg.prepend(grid);
 const handles=document.createElementNS(ns,'g');svg.append(handles);
 svg.querySelectorAll('text').forEach(node=>node.remove());
 let points=null,plan=null,channel=0,selected=null,drag=null,history=[],cursor=.5,mixPosition=0;
 const colors=['#f7ad76','#79ced8'];
 const shown=(value,c)=>(c?mixPosition:0)+(1-mixPosition)*value;
 function draw(){
  grid.replaceChildren();
  for(let i=0;i<=4;i++){
   const x=20+460*i/4,line=document.createElementNS(ns,'path');line.setAttribute('d',`M${x} 10V115`);line.setAttribute('stroke','#526471');line.setAttribute('opacity','.3');grid.append(line);
   const label=document.createElementNS(ns,'text');label.setAttribute('x',x);label.setAttribute('y','132');label.setAttribute('font-size','9');label.setAttribute('fill','currentColor');label.setAttribute('text-anchor',i===0?'start':i===4?'end':'middle');label.textContent=((plan?.duration||0)*i/4).toFixed(1)+' s';grid.append(label);
  }
  handles.replaceChildren();toolbar.querySelectorAll('button').forEach(b=>b.disabled=!points);
  toolbar.querySelector('[data-delete]').disabled=!points||selected==null||selected===0||selected===points[channel].length-1;
  toolbar.querySelector('[data-undo]').disabled=!history.length;
  toolbar.querySelector('[data-add]').disabled=!points||points[channel].length>=32;
  toolbar.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.channel===channel)));
  points?.forEach((curve,c)=>curve.forEach(([x,y],index)=>{
   const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',20+460*x);circle.setAttribute('cy',115-105*shown(y,c));circle.setAttribute('r',c===channel&&index===selected?'5':'4');circle.setAttribute('fill',colors[c]);circle.setAttribute('stroke','#18232c');circle.setAttribute('stroke-width','1.5');circle.dataset.channel=c;circle.dataset.point=index;
   const fixed=index===0||index===curve.length-1;
   circle.setAttribute('tabindex',fixed?'-1':'0');circle.setAttribute('role','slider');circle.setAttribute('aria-label',`${c?'Nächster':'Ausgehender'} Titel · Punkt ${index+1} · ${(x*(plan?.duration||0)).toFixed(1)} Sekunden${fixed?' · fest':''}`);circle.setAttribute('aria-valuemin','0');circle.setAttribute('aria-valuemax','100');circle.setAttribute('aria-valuenow',Math.round(shown(y,c)*100));circle.setAttribute('aria-valuetext',`${Math.round(shown(y,c)*100)} Prozent bei ${(x*(plan?.duration||0)).toFixed(1)} Sekunden`);handles.append(circle);
  }));
 }
 function save(){history.push(clone(points));if(history.length>40)history.shift();}
 function commit(){onChange(clone(points));draw();if(selected!=null)onInspect(points[channel][selected][0]*100);}
 function coords(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(1,(v.x-20)/460)),Math.max(0,Math.min(1,((115-v.y)/105-(channel?mixPosition:0))/Math.max(.001,1-mixPosition)))];}
 function move(x,y){if(selected==null||selected===0||selected===points[channel].length-1)return;const curve=points[channel];curve[selected]=[Math.max(curve[selected-1][0]+.002,Math.min(curve[selected+1][0]-.002,x)),Math.max(0,Math.min(1,y))];commit();}
 function add(x=cursor,y){
  if(!points||points[channel].length>=32)return;
  const curve=points[channel];if(curve.some(p=>Math.abs(p[0]-x)<.005)){x=.5;let gap=0;for(let i=1;i<curve.length;i++)if(curve[i][0]-curve[i-1][0]>gap){gap=curve[i][0]-curve[i-1][0];x=(curve[i][0]+curve[i-1][0])/2;}}
  save();const index=curve.findIndex(p=>p[0]>x);if(y==null)y=transitionAudioGains(x,{points})[channel];curve.splice(index,0,[x,y]);selected=index;commit();
 }
 function remove(){if(!points||selected==null||selected===0||selected===points[channel].length-1)return;save();points[channel].splice(selected,1);selected=null;commit();}
 toolbar.onclick=e=>{const b=e.target.closest('button');if(!b||!points)return;if(b.dataset.channel!=null){channel=+b.dataset.channel;selected=null;draw();}else if(b.hasAttribute('data-add'))add();else if(b.hasAttribute('data-delete'))remove();else if(b.hasAttribute('data-undo')&&history.length){points=history.pop();selected=null;commit();}else if(b.hasAttribute('data-reset')){save();selected=null;onChange(null);draw();}};
 svg.addEventListener('pointerdown',e=>{if(!points||e.button!==0)return;const target=e.target.closest('[data-point]');if(target){channel=+target.dataset.channel;selected=+target.dataset.point;save();drag=e.pointerId;svg.setPointerCapture(e.pointerId);draw();e.preventDefault();}else{cursor=coords(e)[0];onInspect(cursor*100);}});
 svg.addEventListener('pointermove',e=>{if(drag===e.pointerId&&points)move(...coords(e));});
 const end=()=>{drag=null;};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
 svg.addEventListener('dblclick',e=>{if(points&&!e.target.closest('[data-point]')){e.preventDefault();add(...coords(e));}});
 svg.addEventListener('keydown',e=>{const target=e.target.closest('[data-point]');if(!target||!points)return;channel=+target.dataset.channel;selected=+target.dataset.point;const [x,y]=points[channel][selected],step=e.shiftKey?.05:.01;
  if(['Delete','Backspace'].includes(e.key)){e.preventDefault();remove();}else if(e.key.startsWith('Arrow')){e.preventDefault();save();move(x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0));}
  handles.querySelector(`[data-channel="${channel}"][data-point="${selected}"]`)?.focus();
 });
 return {setPlan(value,{reset=false,position=0}={}){mixPosition=position;plan=value;points=value?transitionControlPoints(value):null;if(reset){history=[];selected=null;}draw();}};
}
