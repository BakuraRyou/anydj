// Keep the live queue and its handlers in the opener's JS realm. Only its DOM
// moves: playback, file access and analysis never restart or run a second time.
export function createDetachedQueue(panel,{onDragEnd,onLayout,onKey,onError}){
 if(!window.anydjDesktop)return null;
 const home=document.createComment('queue dock'),placeholder=document.createElement('section');
 placeholder.className='panel dj-queue-placeholder';
 placeholder.innerHTML='<h2>Warteschlange im eigenen Fenster</h2><p>Du kannst Songs zwischen den Fenstern ziehen.</p><button type="button" class="button secondary">Fenster anzeigen</button><button type="button" class="button secondary">Wieder andocken</button>';
 panel.before(home);
 const button=document.createElement('button');button.type='button';button.className='button secondary dj-detach';button.textContent='Abdocken';button.title='Warteschlange als Desktop-Fenster öffnen';
 panel.querySelector('.dj-library-heading').append(button);
 const heading=panel.querySelector('h2');heading.draggable=true;heading.title='Zum Abdocken aus dem App-Fenster ziehen';
 let popup=null,opening=false,lastBounds=null,loadTimer,settingsObserver;
 try{lastBounds=JSON.parse(localStorage.getItem('anydj-queue-window')||'null');}catch{}
 function saveBounds(){
  if(!popup||popup.closed)return;
  const {screenX:x,screenY:y,outerWidth:width,outerHeight:height}=popup;
  lastBounds={x,y,width,height};
  try{localStorage.setItem('anydj-queue-window',JSON.stringify(lastBounds));}catch{}
 }
 function restore(closing=false){
  if(!popup)return;
  clearInterval(loadTimer);
  settingsObserver?.disconnect();
  saveBounds();
  // Popovers cannot remain in the old document's top layer when adopted.
  for(const menu of panel.querySelectorAll(':popover-open'))menu.hidePopover();
  home.after(panel);placeholder.remove();button.textContent='Abdocken';
  const previous=popup;popup=null;opening=false;
  if(!closing&&!previous.closed)previous.close();
  if(closing)setTimeout(()=>{if(!previous.closed)previous.close();},0);
  onDragEnd();onLayout();
 }
 function detach(point){
  if(popup&&!popup.closed){popup.focus();return;}
  if(opening)return;
  const bounded=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  const width=bounded(lastBounds?.width,680,420,2400),height=bounded(lastBounds?.height,720,320,1800);
  const position=point||lastBounds;
  const features=`popup,width=${width},height=${height}`+(Number.isFinite(position?.x)&&Number.isFinite(position?.y)?`,left=${Math.round(position.x)},top=${Math.round(position.y)}`:'');
  opening=true;
  popup=window.open('/dj-detached.html','anydj-queue',features);
  if(!popup){opening=false;onError('Das Warteschlangenfenster konnte nicht geöffnet werden.');return;}
  const child=popup;
  const deadline=Date.now()+15000;
  loadTimer=setInterval(()=>{
   if(popup!==child){clearInterval(loadTimer);return;}
   if(child.closed||Date.now()>deadline){restore();onError('Das Warteschlangenfenster konnte nicht geladen werden.');return;}
   if(child.location.pathname!=='/dj-detached.html'||child.document.readyState!=='complete')return;
   clearInterval(loadTimer);
   for(const menu of panel.querySelectorAll(':popover-open'))menu.hidePopover();
   home.after(placeholder);
   child.document.body.append(panel);button.textContent='Wieder andocken';opening=false;
   const syncSettings=()=>{for(const key of ['appComfortable','appContrast','appReducedMotion'])child.document.documentElement.dataset[key]=document.documentElement.dataset[key]||'false';};
   syncSettings();settingsObserver=new MutationObserver(syncSettings);settingsObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-app-comfortable','data-app-contrast','data-app-reduced-motion']});
   child.document.addEventListener('dragend',onDragEnd);
   child.document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!event.defaultPrevented){const details=event.target.closest('details[open]');if(details){details.open=false;details.querySelector('summary')?.focus();event.preventDefault();}}
    onKey(event);
   });
   child.document.addEventListener('click',event=>{
    const details=panel.querySelector('.dj-list-options');if(!details.contains(event.target))details.open=false;
    // Editors still belong to the main workspace; bring their window forward.
    if(event.target.closest('[data-queue-light-editor],.queue-transition-button,[data-export-format],button[aria-label="Lied schneiden"]'))window.focus();
   });
   child.addEventListener('resize',onLayout);
   child.document.addEventListener('scroll',onLayout,true);
   child.addEventListener('beforeunload',()=>restore(true),{once:true});
   onLayout();
  },30);
 }
 button.onclick=()=>popup?restore():detach();
 placeholder.querySelectorAll('button')[0].onclick=()=>popup?.focus();
 placeholder.querySelectorAll('button')[1].onclick=()=>restore();
 heading.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-anydj-panel','queue');event.dataTransfer.effectAllowed='move';});
 heading.addEventListener('dragend',event=>{
  if(popup)return;
  const x=event.screenX,y=event.screenY;
  // A cancelled drag (Escape) ends at 0/0 on some platforms.
  if((x||y)&&(x<window.screenX||x>window.screenX+window.outerWidth||y<window.screenY||y>window.screenY+window.outerHeight))detach({x:x-40,y:y-20});
 });
 window.addEventListener('pagehide',()=>{if(popup&&!popup.closed)popup.close();});
 return {find:id=>panel.querySelector('#'+CSS.escape(id)),restore};
}
