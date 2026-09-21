// Uses the same sampled light mix as the mixer, without touching playback.
export function createFullMode(trigger){
 const host=document.createElement('div');host.className='dj-full-host';host.hidden=true;
 host.innerHTML='<dialog class="dj-full" aria-label="Full · Party-Lichtshow"><div class="dj-full-wash" aria-hidden="true"></div><div class="dj-full-glow" aria-hidden="true"></div><div class="dj-full-controls"><span>FULL <small>Esc zum Verlassen</small></span><button type="button" class="button secondary">Schließen</button></div></dialog>';
 document.body.append(host);
 const dialog=host.querySelector('dialog'),button=host.querySelector('button');
 let timer,wasFullscreen=false,revision=0;
 const events=new AbortController(),options={signal:events.signal};
 function reveal(){
  dialog.classList.remove('dj-full-idle');clearTimeout(timer);
  timer=setTimeout(()=>dialog.classList.add('dj-full-idle'),2500);
 }
 function cleanup(){
  revision++;clearTimeout(timer);host.hidden=true;wasFullscreen=false;
  trigger.setAttribute('aria-expanded','false');
  if(document.fullscreenElement===host)void document.exitFullscreen().catch(()=>{});
  trigger.focus();
 }
 function close(){if(dialog.open){dialog.close();cleanup();}}
 trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('click',async()=>{
  if(dialog.open)return;
  host.hidden=false;dialog.showModal();
  trigger.setAttribute('aria-expanded','true');reveal();
  const opening=++revision;
  try{
   await host.requestFullscreen();
   if(opening!==revision){if(document.fullscreenElement===host)await document.exitFullscreen();return;}
   wasFullscreen=document.fullscreenElement===host;
  }catch{/* The modal still fills the viewport when fullscreen is unavailable. */}
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
  update(frame){
   if(!dialog.open)return;
   // Pause/stop becomes dark, matching the mixer and physical lights.
   dialog.style.setProperty('--full-color',frame?`rgb(${frame.r}, ${frame.g}, ${frame.b})`:'#000');
   dialog.style.setProperty('--full-level',frame?Math.max(0,Math.min(1,frame.dimming/100)):0);
  },
  destroy(){close();events.abort();clearTimeout(timer);host.remove();},
 };
}
