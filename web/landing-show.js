import {validateCatalog,validateShow,sampleShow,fetchShowJSON} from './landing-show-data.js';
const root=document.querySelector('[data-showcase]');
const q=name=>root.querySelector(`[data-${name}]`),canvas=q('stage'),viewport=q('viewport'),poster=q('poster'),status=q('status'),play=q('play'),seek=q('seek'),clock=q('clock'),volume=q('volume'),choices=q('shows');
const audio=new Audio();audio.preload='metadata';audio.volume=.55;
const camera={yaw:-.12,pitch:.3,zoom:1.12};
let renderer,rendererPromise,show,catalog,selected=0,raf=0,lastFrame=0,visible=false,loadId=0,controller,playingRequest=false,quality=1,slowFrames=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const timeLabel=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function updateTransport(){
  const t=Math.min(show?.duration||0,audio.currentTime||0);seek.value=t;
  clock.textContent=`${timeLabel(t)} / ${timeLabel(show?.duration||0)}`;
  seek.setAttribute('aria-valuetext',`${timeLabel(t)} von ${timeLabel(show?.duration||0)}`);
  play.textContent=playingRequest?'Wird gestartet …':audio.paused?'Show abspielen':'Pause';play.setAttribute('aria-pressed',String(!audio.paused));
}
function pause(message){playingRequest=false;audio.pause();cancelAnimationFrame(raf);raf=0;updateTransport();if(show)status.textContent=message||'Pausiert. Du kannst die Show fortsetzen oder eine andere wählen.';}
function requestDraw(){if(!raf&&visible&&!document.hidden&&show&&renderer)raf=requestAnimationFrame(draw);}
function draw(now){
  raf=0;if(!visible||document.hidden||!renderer||!show)return;
  if(!audio.paused&&now-lastFrame<1000/30){requestDraw();return;}
  if(!audio.paused&&lastFrame){slowFrames=now-lastFrame>50?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=6){quality=Math.max(.45,quality*.8);slowFrames=0;}}
  lastFrame=now;
  const width=viewport.clientWidth,height=viewport.clientHeight,scale=Math.min(devicePixelRatio||1,width<700?1:1.25,1100/width)*quality;
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');if(!ctx){pause();status.textContent='Die 3D-Ansicht ist hier nicht verfügbar.';return;}ctx.setTransform(scale,0,0,scale,0,0);
  const t=audio.currentTime||0;
  // An illuminated still frame before playback makes the setup visible.
  const sample=t===0||reduced.matches?Math.min(4,show.duration/2):t;
  try{renderer.render(ctx,width,height,show.layout,sampleShow(show,sample),camera,[],0);poster.hidden=true;}
  catch{pause();status.textContent='Die 3D-Ansicht ist hier nicht verfügbar. Du kannst die Web-Demo öffnen.';poster.hidden=false;return;}
  updateTransport();if(!audio.paused&&!reduced.matches)requestDraw();
}
async function graphics(){
  rendererPromise??=import('./dmx-stage-desktop.js').then(m=>m.createDesktopRenderer(canvas,{backends:['webgl'],onInvalidate:requestDraw})).then(value=>renderer=value).catch(error=>{rendererPromise=null;throw error;});
  return rendererPromise;
}
function selection(){[...choices.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));}
async function load(index){
  pause();controller?.abort();controller=new AbortController();const signal=controller.signal,id=++loadId;selected=index;selection();show=null;play.disabled=true;seek.disabled=true;status.textContent='Lichtshow wird geladen …';
  audio.removeAttribute('src');audio.load();
  try{
    const [data]=await Promise.all([fetchShowJSON(catalog.shows[index].show,4*1024*1024,{signal}),graphics()]);
    if(id!==loadId)return;
    show=validateShow(data);audio.src=show.audio;audio.load();seek.max=show.duration;seek.disabled=false;play.disabled=false;
    status.textContent=reduced.matches?'Bewegungsarme Ansicht aktiv: Die Bühne bleibt als Standbild sichtbar.':'Ansicht mit Ziehen oder Pfeiltasten drehen.';
    updateTransport();requestDraw();
  }catch(error){if(id!==loadId||signal.aborted)return;status.textContent='Die Show konnte nicht geladen werden. Wähle sie erneut aus.';poster.hidden=false;}
}
async function initialize(){
  if(catalog)return;
  try{
    catalog=validateCatalog(await fetchShowJSON('./demo-shows/catalog.json',16000));
    catalog.shows.forEach((entry,i)=>{
      const button=document.createElement('button');button.type='button';button.className='show-choice';button.setAttribute('aria-pressed',String(i===selected));
      const number=document.createElement('span');number.className='show-number';number.textContent=`0${i+1}`;
      const title=document.createElement('strong');title.textContent=entry.title;
      const artist=document.createElement('span');artist.textContent=entry.artist;
      const description=document.createElement('small');description.textContent=entry.description;
      button.append(number,title,artist,description);button.onclick=()=>void load(i);choices.append(button);
    });await load(0);
  }catch{status.textContent='Die Demo-Auswahl ist gerade nicht verfügbar.';q('retry').hidden=false;}
}
let initialized=false;
new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;
  if(visible){if(!initialized){initialized=true;void initialize();}requestDraw();}
  else if(!audio.paused||playingRequest)pause('Pausiert, weil die Vorschau nicht mehr sichtbar ist.');
},{threshold:.05}).observe(viewport);
new ResizeObserver(()=>{quality=1;slowFrames=0;requestDraw();}).observe(viewport);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else requestDraw();});
window.addEventListener('pagehide',()=>pause());
q('retry').onclick=()=>{q('retry').hidden=true;void initialize();};
play.onclick=async()=>{
  if(!show||!visible||document.hidden)return;
  if(!audio.paused||playingRequest){pause();return;}
  if(audio.currentTime>=show.duration-.05)audio.currentTime=0;
  const id=loadId;lastFrame=0;slowFrames=0;playingRequest=true;updateTransport();
  try{await audio.play();if(id!==loadId)return;if(!playingRequest||!visible||document.hidden){pause();return;}playingRequest=false;status.textContent=reduced.matches?'Musik läuft · bewegungsarme Ansicht.':'Musik und Licht laufen synchron.';updateTransport();requestDraw();}
  catch{if(id!==loadId)return;pause();status.textContent='Audio konnte nicht gestartet werden. Bitte erneut abspielen.';}
};
audio.addEventListener('timeupdate',()=>{if(show&&audio.currentTime>=show.duration)pause();updateTransport();});
audio.addEventListener('ended',()=>{pause('Show beendet. Wähle eine weitere Show oder starte erneut.');requestDraw();});
audio.addEventListener('error',()=>{if(show){pause();status.textContent='Die Audiodatei konnte nicht geladen werden. Wähle die Show erneut aus.';}});
audio.addEventListener('loadedmetadata',()=>{if(show&&Math.abs(audio.duration-show.duration)>.3){pause();play.disabled=true;status.textContent='Audio und Lichtshow haben unterschiedliche Längen.';}});
seek.oninput=()=>{if(show){audio.currentTime=Number(seek.value);updateTransport();requestDraw();}};
volume.oninput=()=>{audio.volume=Number(volume.value);};
q('reset').onclick=()=>{Object.assign(camera,{yaw:-.12,pitch:.3,zoom:1.12});requestDraw();};
for(const [name,direction] of [['zoom-in',.15],['zoom-out',-.15]])q(name).onclick=()=>{camera.zoom=Math.max(.65,Math.min(2,camera.zoom+direction));requestDraw();};
let drag;
canvas.onpointerdown=event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);};
canvas.onpointermove=event=>{if(!drag)return;camera.yaw+=(event.clientX-drag.x)*.005;camera.pitch=Math.max(.1,Math.min(1.2,camera.pitch+(event.clientY-drag.y)*.004));drag={x:event.clientX,y:event.clientY};requestDraw();};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{drag=null;};
canvas.onkeydown=event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;event.preventDefault();
  if(event.key==='ArrowLeft')camera.yaw-=.1;if(event.key==='ArrowRight')camera.yaw+=.1;
  if(event.key==='ArrowUp')camera.pitch=Math.min(1.2,camera.pitch+.1);if(event.key==='ArrowDown')camera.pitch=Math.max(.1,camera.pitch-.1);
  if(event.key==='+')camera.zoom=Math.min(2,camera.zoom+.15);if(event.key==='-')camera.zoom=Math.max(.65,camera.zoom-.15);requestDraw();
};
reduced.addEventListener('change',requestDraw);
