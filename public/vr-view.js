import {createVRPlayback} from './dmx-vr-playback.js';
import {createStageVR} from './dmx-stage-vr.js';
import {renderStage3d} from './dmx-stage-3d-renderer.js';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),connection=document.querySelector('#connection');
let latest=null,received=0,origin=null,camera=null,drag=null,ended=false,disposed=false,size={width:1,height:1},raf=0;
const testMode=/^\/vr-test\/?$/.test(location.pathname);
let id=location.hash.slice(1),testControl='';
if(testMode){
  // Keep the bookmark stable; session credentials stay in memory.
  for(;;){try{const response=await fetch('/api/vr-preview/test-connect',{cache:'no-store',signal:AbortSignal.timeout(4000)}),data=await response.json();if(!response.ok)throw Error(data.error?.message||'Verbindung fehlgeschlagen.');id=data.id;testControl=data.control;break;}catch(error){connection.textContent=error.message+' · Erneuter Versuch läuft …';await new Promise(resolve=>setTimeout(resolve,2000));}}
}
const control=()=>testControl||sessionStorage.getItem('vr-control-'+id);
const joinForm=document.querySelector('#joinPreview');
joinForm.onsubmit=async event=>{event.preventDefault();const code=document.querySelector('#previewLink').value.trim(),button=joinForm.querySelector('button');button.disabled=true;
  try{const response=await fetch('/api/vr-preview/pair?code='+encodeURIComponent(code));const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Kopplung fehlgeschlagen.');sessionStorage.setItem('vr-control-'+data.id,data.control);location.hash=data.id;location.reload();}catch(error){connection.textContent=error.message;}finally{button.disabled=false;}};

const playback=createVRPlayback();
function sample(){const scene=playback.sample(performance.now());if(!scene)return null;
  if(ended||performance.now()-received>3000)scene.lights=scene.lights.map(light=>({...light,power:0}));return scene;
}
const vr=createStageVR({button:document.querySelector('#enterVR'),status:document.querySelector('#vrStatus'),getScene:()=>{const scene=sample();return scene?{...scene,controlsAvailable:!ended&&performance.now()-received<3000&&Boolean(control())}:scene;},onCommand:async command=>{const response=await fetch('/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id,control:control(),command}),signal:AbortSignal.timeout(4000)});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Befehl fehlgeschlagen.');},getOrigin:()=>origin||{x:0,y:0,yaw:0,eyeHeight:1.7}});
const startVR=document.querySelector('#enterVR').onclick;document.querySelector('#enterVR').onclick=()=>{if(!latest){connection.textContent='Warte zuerst auf den Aufbau vom Rechner.';return;}startVR();};
document.querySelector('#recheck').onclick=()=>vr.checkSupport();
document.querySelector('#reset').onclick=()=>{if(latest){origin={...latest.origin};camera={...origin,mode:'dancer',pitch:0,zoom:1};if(vr.active)void vr.stop();}};
const resize=new ResizeObserver(entries=>{size=entries[0].contentRect;});resize.observe(canvas);
function draw(){if(disposed)return;raf=requestAnimationFrame(draw);if(!latest||vr.active||document.hidden||!ctx)return;const scale=Math.min(devicePixelRatio||1,1.5),width=Math.max(1,Math.round(size.width*scale)),height=Math.max(1,Math.round(size.height*scale));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const scene=sample();ctx.setTransform(scale,0,0,scale,0,0);renderStage3d(ctx,size.width,size.height,scene.layout,scene.lights,camera,scene.crowd,scene.motion);}
raf=requestAnimationFrame(draw);
canvas.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!camera||drag?.id!==e.pointerId)return;camera.yaw-=(e.clientX-drag.x)*.008;camera.pitch=Math.max(-1.2,Math.min(1.2,camera.pitch+(e.clientY-drag.y)*.006));drag={id:e.pointerId,x:e.clientX,y:e.clientY};};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=null;
let stream=null;
if(!/^[\w-]{24}$/.test(id)){joinForm.hidden=false;connection.textContent='Gib den sechsstelligen Code ein, der am Rechner unter „VR-Vorschau verbinden“ angezeigt wird.';}else{
 stream=new EventSource('/api/vr-preview/stream?id='+encodeURIComponent(id));
 stream.onmessage=event=>{try{const data=JSON.parse(event.data);if(!data.scene?.layout||!Array.isArray(data.scene.lights))return;latest=data.scene;received=performance.now();playback.push(latest,received);if(!origin){origin={...latest.origin};camera={...origin,mode:'dancer',pitch:0,zoom:1};}if(connection.textContent!=='Live mit dem Rechner verbunden')connection.textContent='Live mit dem Rechner verbunden';const info=`Aufbau ${latest.layout.width} × ${latest.layout.depth} m · ${latest.lights.length} Lichtquellen`;const output=document.querySelector('#sceneInfo');if(output.textContent!==info)output.textContent=info;}catch{connection.textContent='Ungültiger Showzustand empfangen.';}};
 stream.onerror=()=>{connection.textContent=stream.readyState===EventSource.CLOSED?'Vorschau-Link nicht mehr verfügbar. Am Rechner einen neuen Link erstellen.':'Verbindung unterbrochen · verbinde erneut …';};
 stream.addEventListener('ended',()=>{ended=true;stream.close();connection.textContent='Übertragung am Rechner beendet. Für eine neue Sitzung einen neuen Link öffnen.';void vr.stop();if(testMode)setTimeout(()=>location.reload(),1500);});
}
const watch=setInterval(()=>{if(latest&&!ended&&performance.now()-received>3000)connection.textContent='Warte auf aktuelle Lichtdaten vom Rechner …';},1000);
window.addEventListener('pagehide',()=>{disposed=true;stream?.close();clearInterval(watch);cancelAnimationFrame(raf);resize.disconnect();vr.destroy();},{once:true});
