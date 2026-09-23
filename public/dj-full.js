import {automaticPalette} from './dmx-auto.js';

// Uses the same sampled light mix as the mixer, without touching playback.
export function createFullMode(trigger,{adjustFrame=frame=>frame}={}){
 const host=document.createElement('div');host.className='dj-full-host';host.hidden=true;
 host.innerHTML='<dialog class="dj-full" aria-label="Full · Party-Lichtshow"><div class="dj-full-colors" aria-hidden="true"><div class="dj-full-color"></div><div class="dj-full-color"></div><div class="dj-full-color"></div><div class="dj-full-color"></div></div><div class="dj-full-controls"><span>FULL <small>Esc zum Verlassen</small></span><button type="button" class="button secondary">Schließen</button></div></dialog>';
 document.body.append(host);
 const dialog=host.querySelector('dialog'),button=host.querySelector('button');
 let timer,wasFullscreen=false,revision=0,openingMode=false;
 let latestFrame=null,latestStreams=[];
 const colors=[...dialog.querySelectorAll('.dj-full-color')];
 function paint(){
  const active=latestStreams.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0);
  const streams=active.length?active:latestFrame?[{frame:latestFrame,weight:1}]:[];
  const total=streams.reduce((sum,s)=>sum+s.weight,0);
  const palettes=streams.map(s=>automaticPalette(s.frame,4,s.look,s.palette));
  colors.forEach((node,i)=>{
   const rgb=[0,1,2].map(c=>total?Math.round(streams.reduce((sum,s,k)=>sum+palettes[k][i][c]*s.weight,0)/total):0);
   const color=adjustFrame({r:rgb[0],g:rgb[1],b:rgb[2],dimming:100});
   node.style.setProperty('--full-color',`rgb(${color.r}, ${color.g}, ${color.b})`);
  });
  dialog.style.setProperty('--full-level',latestFrame?Math.max(0,Math.min(1,adjustFrame(latestFrame).dimming/100)):0);
 }
 const events=new AbortController(),options={signal:events.signal};
 function reveal(){
  dialog.classList.remove('dj-full-idle');clearTimeout(timer);
  timer=setTimeout(()=>dialog.classList.add('dj-full-idle'),2500);
 }
 function cleanup(){
  revision++;openingMode=false;clearTimeout(timer);host.hidden=true;wasFullscreen=false;
  trigger.setAttribute('aria-expanded','false');
  const closing=revision;
  const restoreFocus=()=>{if(revision===closing&&trigger.isConnected)trigger.focus();};
  if(document.fullscreenElement===host)void document.exitFullscreen().catch(()=>{}).then(restoreFocus);
  else restoreFocus();
 }
 function close(){if(dialog.open)dialog.close();cleanup();}
 trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('click',async()=>{
  if(dialog.open||openingMode)return;
  openingMode=true;host.hidden=false;
  const opening=++revision;
  try{
   await host.requestFullscreen();
   if(opening!==revision){if(document.fullscreenElement===host)await document.exitFullscreen();return;}
   wasFullscreen=document.fullscreenElement===host;
  }catch{/* Fall back to a viewport-sized modal. */}
  if(opening!==revision)return;
  openingMode=false;dialog.showModal();paint();
  trigger.setAttribute('aria-expanded','true');reveal();
 },options);
 button.addEventListener('click',close,options);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();},options);
 dialog.addEventListener('pointermove',reveal,options);
 dialog.addEventListener('pointerdown',reveal,options);
 dialog.addEventListener('keydown',event=>{reveal();event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}},options);
 document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement===host)wasFullscreen=true;
  else if(wasFullscreen)close();
 },options);
 return {
  update(frame,streams=[]){
   latestFrame=frame;latestStreams=streams;
   if(dialog.open)paint();
  },
  destroy(){close();events.abort();clearTimeout(timer);host.remove();},
 };
}
