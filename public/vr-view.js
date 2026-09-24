import {createRoomPreview} from './dmx-ar-model.js';
import {createARPlanner} from './dmx-ar-planner.js';
import {createVRPlayback} from './dmx-vr-playback.js';
import {createStageVR} from './dmx-stage-vr.js';
import {renderStage3d} from './dmx-stage-3d-renderer.js';
const roomPreview=createRoomPreview();
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),connection=document.querySelector('#connection');
let latest=null,received=0,origin=null,camera=null,drag=null,ended=false,disposed=false,size={width:1,height:1},raf=0;
const testMode=/^\/vr-test\/?$/.test(location.pathname);
const tokenKey='anydj-vr-access';
let savedToken='';try{savedToken=localStorage.getItem(tokenKey)||'';}catch{}
let id=location.hash.slice(1),testControl='';
if(testMode||savedToken){
  for(;;){try{
    const response=await fetch(testMode?'/api/vr-preview/test-connect':'/api/vr-preview/resume',testMode?{cache:'no-store',signal:AbortSignal.timeout(4000)}:{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({token:savedToken}),signal:AbortSignal.timeout(4000)}),data=await response.json();
    if(response.status===401&&!testMode){try{localStorage.removeItem(tokenKey);}catch{}savedToken='';id='';history.replaceState(null,'',location.pathname);connection.textContent=data.error?.message;break;}
    if(!response.ok)throw Error(data.error?.message||'Verbindung fehlgeschlagen.');id=data.id;testControl=data.control;history.replaceState(null,'',location.pathname);break;
  }catch(error){connection.textContent=error.message+' · Verbinde automatisch erneut …';await new Promise(resolve=>setTimeout(resolve,2000));}}
}
const control=()=>testControl||sessionStorage.getItem('vr-control-'+id);
const joinForm=document.querySelector('#joinPreview');
joinForm.onsubmit=async event=>{event.preventDefault();const code=document.querySelector('#previewLink').value.trim(),button=joinForm.querySelector('button');button.disabled=true;
  try{const response=await fetch('/api/vr-preview/pair?code='+encodeURIComponent(code));const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Kopplung fehlgeschlagen.');sessionStorage.setItem('vr-control-'+data.id,data.control);try{localStorage.setItem(tokenKey,data.token);}catch{}location.hash=data.id;location.reload();}catch(error){connection.textContent=error.message;}finally{button.disabled=false;}};

const playback=createVRPlayback();
function sample(){const scene=playback.sample(performance.now());if(!scene)return null;
  if(ended||performance.now()-received>3000)scene.lights=scene.lights.map(light=>({...light,power:0}));return scene;
}
async function sendCommand(command){if(ended||performance.now()-received>3000||!control())throw Error('Rechner nicht verbunden. Raum bleibt lokal gespeichert.');const response=await fetch('/api/vr-preview/command',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:JSON.stringify({id,control:control(),command}),signal:AbortSignal.timeout(4000)});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Befehl fehlgeschlagen.');}
const planner=createARPlanner(document.querySelector('#arPlanner'),{onStartAR:()=>document.querySelector('#enterAR').click(),getScene:sample,sendPlan:plan=>sendCommand({action:'room-plan',plan})});
let lastControlMessage='';
document.querySelector('#useComputerRoom').onclick=()=>{try{if(!latest?.roomPlan)throw Error('Am Rechner ist kein eigener Raum aktiv.');planner.use(latest.roomPlan);}catch(e){planner.notify(e.message);}};
const vr=createStageVR({arButton:document.querySelector('#enterAR'),planner,button:document.querySelector('#enterVR'),status:document.querySelector('#vrStatus'),getScene:()=>{const scene=sample()||{layout:{width:8,depth:6,positions:{}},lights:[],crowd:[],motion:0};return {...scene,controlsAvailable:!ended&&performance.now()-received<3000&&Boolean(control())};},onCommand:sendCommand,getOrigin:()=>origin||{x:0,y:0,yaw:0,eyeHeight:1.7}});
for(const selector of ['#enterVR','#enterAR']){const start=document.querySelector(selector).onclick;document.querySelector(selector).onclick=()=>{if(!latest&&selector==='#enterVR'){connection.textContent='Warte zuerst auf den Aufbau vom Rechner.';return;}start();};}
document.querySelector('#recheck').onclick=()=>vr.checkSupport();
document.querySelector('#reset').onclick=()=>{if(latest){origin={...latest.origin};camera={...origin,mode:'dancer',pitch:0,zoom:1};if(vr.active)void vr.stop();}};
const resize=new ResizeObserver(entries=>{size=entries[0].contentRect;});resize.observe(canvas);
function draw(){if(disposed)return;raf=requestAnimationFrame(draw);if(!latest||vr.active||document.hidden||!ctx)return;const scale=Math.min(devicePixelRatio||1,1.5),width=Math.max(1,Math.round(size.width*scale)),height=Math.max(1,Math.round(size.height*scale));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const raw=sample(),scene=planner.active?planner.scene(raw):raw.roomPlan?roomPreview(raw,raw.roomPlan):raw;ctx.setTransform(scale,0,0,scale,0,0);renderStage3d(ctx,size.width,size.height,scene.layout,scene.lights,camera,scene.crowd,scene.motion);}
raf=requestAnimationFrame(draw);
canvas.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!camera||drag?.id!==e.pointerId)return;camera.yaw-=(e.clientX-drag.x)*.008;camera.pitch=Math.max(-1.2,Math.min(1.2,camera.pitch+(e.clientY-drag.y)*.006));drag={id:e.pointerId,x:e.clientX,y:e.clientY};};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=null;
let stream=null,reconnectTimer=0;
const reconnect=()=>{if((testMode||savedToken)&&!reconnectTimer)reconnectTimer=setTimeout(()=>location.reload(),3000);};
if(!/^[\w-]{24}$/.test(id)){joinForm.hidden=false;connection.textContent='Gib den sechsstelligen Code ein, der am Rechner unter „VR-Vorschau verbinden“ angezeigt wird.';}else{
 stream=new EventSource('/api/vr-preview/stream?id='+encodeURIComponent(id));
 stream.onmessage=event=>{try{const data=JSON.parse(event.data);if(!data.scene?.layout||!Array.isArray(data.scene.lights))return;clearTimeout(reconnectTimer);reconnectTimer=0;latest=data.scene;if(latest.controlMessage&&String(latest.controlMessageId)+latest.controlMessage!==lastControlMessage){lastControlMessage=String(latest.controlMessageId)+latest.controlMessage;planner.notify(lastControlMessage);}received=performance.now();playback.push(latest,received);if(!origin){origin={...latest.origin};camera={...origin,mode:'dancer',pitch:0,zoom:1};}if(connection.textContent!=='Live mit dem Rechner verbunden')connection.textContent='Live mit dem Rechner verbunden';const info=`Aufbau ${(latest.roomPlan||latest.layout).width} × ${(latest.roomPlan||latest.layout).depth} m · ${latest.lights.length} Lichtquellen`;const output=document.querySelector('#sceneInfo');if(output.textContent!==info)output.textContent=info;}catch{connection.textContent='Ungültiger Showzustand empfangen.';}};
 stream.onerror=()=>{reconnect();connection.textContent=stream.readyState===EventSource.CLOSED?'Vorschau-Link nicht mehr verfügbar. Am Rechner einen neuen Link erstellen.':'Verbindung unterbrochen · verbinde erneut …';};
 stream.addEventListener('ended',()=>{ended=true;stream.close();connection.textContent='Übertragung am Rechner beendet. Für eine neue Sitzung einen neuen Link öffnen.';void vr.stop();reconnect();});
}
const watch=setInterval(()=>{if(latest&&!ended&&performance.now()-received>3000)connection.textContent='Warte auf aktuelle Lichtdaten vom Rechner …';},1000);
window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(reconnectTimer);stream?.close();clearInterval(watch);cancelAnimationFrame(raf);resize.disconnect();vr.destroy();planner.destroy();},{once:true});
