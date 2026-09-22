export const LIGHT_DEFAULTS=Object.freeze({brightness:100,saturation:100,hue:0,dynamics:100});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function lightSettings(value={}){
 return Object.fromEntries(Object.entries(LIGHT_DEFAULTS).map(([key,fallback])=>[key,clamp(Number.isFinite(value?.[key])?value[key]:fallback,key==='hue'?-180:0,key==='hue'?180:key==='brightness'?100:150)]));
}
// Apply once, after palette generation/mixing, so generated colors respect saturation too.
export function tuneLightFrame(frame,settings){
 if(!frame)return null;
 const s=lightSettings(settings);
 let rgb=[frame.r,frame.g,frame.b];
 if(s.hue!==0||s.saturation!==100){
  const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
  let h=delta?(max===rgb[0]?((rgb[1]-rgb[2])/delta+6)%6:max===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4):0;
  h=((h+s.hue/60)%6+6)%6;
  const saturation=clamp((max?delta/max:0)*s.saturation/100,0,1),c=max*saturation,x=c*(1-Math.abs(h%2-1)),m=max-c;
  rgb=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)].map(v=>Math.round(v+m));
 }
 const level=frame.dimming>0?clamp(50+(frame.dimming-50)*s.dynamics/100,0,100):0;
 const dimming=Math.round(level*s.brightness/100);
 return {...frame,r:rgb[0],g:rgb[1],b:rgb[2],dimming,state:frame.state!==false&&dimming>0};
}
export function createLightTuning(host,onChange){
 let settings;try{settings=lightSettings(JSON.parse(localStorage.getItem('anydj-light-tuning')));}catch{settings=lightSettings();}
 const root=document.createElement('details');root.className='dj-light-tuning';root.innerHTML='<summary>Licht feinjustieren</summary><p class="small muted">Gilt für beide Decks, Full und Lampen. Änderungen wirken sofort.</p>';
 const controls=document.createElement('div');controls.className='light-tuning-controls';root.append(controls);
 for(const [key,label,min,max,help] of [['brightness','Helligkeit',0,100,'Gesamte Lichtausgabe dimmen.'],['saturation','Farbsättigung',0,150,'Von weißen Flächen bis zu kräftigen Farben.'],['hue','Farbton',-180,180,'Alle Farben gemeinsam im Farbkreis verschieben.'],['dynamics','Lichtimpulse',0,150,'Kleinere Werte gleichen helle und dunkle Passagen an; größere betonen sie.']]){
  const labelNode=document.createElement('label');labelNode.innerHTML=`<span>${label} <output></output></span><input class="range" type="range" data-light-tuning="${key}" min="${min}" max="${max}" step="1" aria-label="${label}" title="${help}">`;controls.append(labelNode);
 }
 const reset=document.createElement('button');reset.type='button';reset.className='button secondary';reset.textContent='Lichtwerte zurücksetzen';root.append(reset);host.append(root);
 function draw(){for(const input of root.querySelectorAll('input')){input.value=settings[input.dataset.lightTuning];input.previousElementSibling.querySelector('output').textContent=input.value+(input.dataset.lightTuning==='hue'?'°':' %');}}
 function change(){try{localStorage.setItem('anydj-light-tuning',JSON.stringify(settings));}catch{}draw();onChange();}
 root.addEventListener('input',event=>{const key=event.target.dataset.lightTuning;if(key){settings=lightSettings({...settings,[key]:Number(event.target.value)});change();}});
 reset.onclick=()=>{settings=lightSettings();change();};draw();
 return {root,get settings(){return settings;}};
}
