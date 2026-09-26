import {createRoomPreview,insideRoom,triangulateFloor} from './dmx-ar-model.js';
import {createARControls} from './dmx-ar-controls.js';
import {createVRConsole} from './dmx-vr-console.js';
// Optional WebXR adapter. No XR session or GPU resources until the user enters VR.
export function worldToXR(point,origin){
  const x=point[0]-origin.x,y=point[1]-origin.y,c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
  return [x*c+y*s,point[2]-(origin.floorOffset||0),x*s-y*c];
}
// Place the first tracked head pose at the preview start, not at the runtime's
// arbitrary room-scale origin. Subsequent real movement remains unchanged.
export function vrEntryOrigin(head,scene,start,floor=true){
  const layout=scene.layout,{width,depth}=layout;
  let x=Number.isFinite(start.x)?start.x:0,y=Number.isFinite(start.y)?start.y:depth*.35;
  const boundary=layout.roomPlan?.boundary;
  if(boundary&&!insideRoom([x,y],boundary)){
    const triangles=triangulateFloor(boundary).sort((a,b)=>Math.abs((b[1][0]-b[0][0])*(b[2][1]-b[0][1])-(b[1][1]-b[0][1])*(b[2][0]-b[0][0]))-Math.abs((a[1][0]-a[0][0])*(a[2][1]-a[0][1])-(a[1][1]-a[0][1])*(a[2][0]-a[0][0])));
    if(triangles.length){x=triangles[0].reduce((n,p)=>n+p[0],0)/3;y=triangles[0].reduce((n,p)=>n+p[1],0)/3;}
  }else if(!boundary){x=Math.max(-width/2+.3,Math.min(width/2-.3,x));const min=layout.room?0:-Math.max(4,depth);if(y<min+.3||y>depth-.3)y=layout.room?depth*.35:-Math.max(4,depth)*.4;}
  const yaw=(start.yaw||0)-Math.atan2(head[8],head[10]),c=Math.cos(yaw),s=Math.sin(yaw);
  return {...start,x:x-c*head[12]-s*head[14],y:y-s*head[12]+c*head[14],yaw,floorOffset:floor?0:(start.eyeHeight||1.7)-head[13]};
}
export {createVRGraphics} from './dmx-vr-renderer.js';
import {createVRGraphics} from './dmx-vr-renderer.js';
export function createStageVR({button,arButton=null,planner=null,status,getScene,getOrigin,onActive=()=>{},onSupport=()=>{},onCommand=()=>{},xr=globalThis.navigator?.xr,secure=globalThis.isSecureContext,createGraphics=createVRGraphics}){
  const roomPreview=createRoomPreview();
  let session=null,graphics=null,reference=null,origin=null,busy=false,disposed=false,generation=0,active=false,controls=null,mode='immersive-vr';
  const message=text=>{status.textContent=text;};
  function reset(){controls?.destroy?.();controls=null;graphics?.destroy();graphics=null;reference=null;session=null;busy=false;if(active){active=false;onActive(false);}button.textContent='VR starten';button.setAttribute('aria-pressed','false');button.disabled=disposed;if(arButton){arButton.textContent='AR starten';arButton.setAttribute('aria-pressed','false');arButton.disabled=true;}}
  async function support(){if(disposed||session||busy)return;button.disabled=true;if(arButton)arButton.disabled=true;
    if(!secure){planner?.setARSupport?.(false);onSupport('insecure');button.title='VR benötigt HTTPS oder localhost.';message('VR: Öffne die App über eine vertrauenswürdige HTTPS-Verbindung im Headset-Browser.');return;}
    if(!xr){planner?.setARSupport?.(false);onSupport('no-api');button.title='Dieser Browser bietet kein WebXR.';message('VR: In einem WebXR-fähigen Headset-Browser öffnen.');return;}
    try{const [supported,arSupported]=await Promise.all([xr.isSessionSupported('immersive-vr'),arButton&&planner?xr.isSessionSupported('immersive-ar').catch(()=>false):false]);if(arButton&&!disposed&&!session&&!busy){arButton.disabled=!arSupported;planner?.setARSupport?.(arSupported);arButton.title=arSupported?'Eigenen Raum erfassen und Lichtanlage darin planen':'Dieser Browser bietet keinen AR-Zugang.';}if(disposed||session||busy)return;onSupport(supported?'ready':'no-headset');button.disabled=!supported;button.title=supported?'Lichtshow im Headset erleben':'Dieser Browser meldet derzeit keinen VR-Zugang';message(arSupported?'AR bereit · eigenen Raum erfassen oder gespeicherte Aufstellung ausrichten.':supported?'VR bereit · Kopfbewegungen und Schritte werden im Headset übernommen.':'VR noch nicht verfügbar · Hinweise unter „VR einrichten“. Die Anschlussart wird nicht vorausgesetzt.');}catch{if(!disposed){onSupport('error');message('VR-Unterstützung konnte nicht geprüft werden.');}}
  }
  async function stop(){generation++;if(!session){if(busy){reset();if(!disposed)void support();}return;}if(session)try{await session.end();}catch{reset();} }
  async function start(requestedMode='immersive-vr'){
    if(disposed||busy)return;if(session){await stop();return;}
    mode=requestedMode;busy=true;button.disabled=true;if(arButton)arButton.disabled=true;const attempt=++generation;let own=null,failureMessage='';
    try{
      // requestSession must run directly in the user gesture, before async imports.
      own=await xr.requestSession(mode,{optionalFeatures:mode==='immersive-ar'?['local-floor','plane-detection','anchors']:['local-floor']});
      if(disposed||attempt!==generation){await own.end();return;}
      session=own;
      own.addEventListener('end',()=>{if(session!==own)return;generation++;reset();if(!disposed){message('XR beendet · die 3D-Ansicht ist wieder verfügbar.');void support().then(()=>{if(failureMessage&&!disposed)message(failureMessage);});}},{once:true});
      const resource=await createGraphics(own);
      if(disposed||session!==own||attempt!==generation){resource.destroy();await own.end().catch(()=>{});return;}graphics=resource;
      let floor=true;try{reference=await own.requestReferenceSpace('local-floor');}catch{floor=false;reference=await own.requestReferenceSpace('local');}
      if(disposed||session!==own||attempt!==generation){await own.end().catch(()=>{});return;}
      onActive(true);active=true;origin={...getOrigin(),floorOffset:floor?0:getOrigin().eyeHeight};
      own.updateRenderState({baseLayer:graphics.layer,depthNear:.05,depthFar:150});
      controls=mode==='immersive-ar'?createARControls({planner,session:own,reference,floorAvailable:floor,exit:()=>void stop(),command:onCommand}):createVRConsole({command:onCommand,exit:()=>void stop()});
      const select=event=>void controls.select(event,reference);own.addEventListener('select',select);own.addEventListener('end',()=>own.removeEventListener('select',select),{once:true});
      button.textContent='VR beenden';button.disabled=false;button.setAttribute('aria-pressed','true');busy=false;message('VR aktiv · linkes Pult mit rechtem Trigger bedienen. Linker Stick: gehen · rechter Stick: drehen.');
      if(mode==='immersive-ar'){button.disabled=true;button.textContent='VR starten';button.setAttribute('aria-pressed','false');arButton.textContent='AR beenden';arButton.disabled=false;arButton.setAttribute('aria-pressed','true');message('AR aktiv · Raumplan am linken Controller, rechter Trigger zum Bedienen.');}
      let entryPlaced=false;
      const frame=(time,xrFrame)=>{
        if(session!==own||disposed)return;
        own.requestAnimationFrame(frame);
        if(own.visibilityState==='hidden')return;
        try{const pose=xrFrame.getViewerPose(reference);if(pose){const scene=getScene(time/1000);if(!scene)return;const display=mode==='immersive-ar'?scene:scene.roomPlan?roomPreview(scene,scene.roomPlan):scene;
          if(mode==='immersive-vr'&&!entryPlaced&&pose.transform?.matrix&&display.layout){origin=vrEntryOrigin(pose.transform.matrix,display,origin,floor);entryPlaced=true;}
          const overlay=controls.update(xrFrame,reference,pose,own,display,origin,time);
          graphics.observeFrame?.(time,own.frameRate);
          graphics.render(pose,controls.scene?controls.scene(display):display,controls.origin||origin,overlay);}}catch(error){failureMessage=`XR wurde beendet: ${error.message}`;message(failureMessage);void stop();}
      };own.requestAnimationFrame(frame);
    }catch(error){failureMessage=error.name==='NotAllowedError'?'VR wurde nicht freigegeben. Du kannst es erneut versuchen.':`VR konnte nicht gestartet werden: ${error.message}`;if(own)await own.end().catch(()=>{});if(!disposed&&(!session||session===own)){reset();message(error.name==='NotAllowedError'?'XR wurde nicht freigegeben. Du kannst es erneut versuchen.':`XR konnte nicht gestartet werden: ${error.message}`);if(arButton)void support().then(()=>{if(!disposed)message(failureMessage);});}}
    finally{if(attempt===generation)busy=false;}
  }
  button.onclick=()=>void start();if(arButton)arButton.onclick=()=>void start('immersive-ar');xr?.addEventListener?.('devicechange',support);
  const focusCheck=()=>{if(!globalThis.document?.hidden)void support();};
  globalThis.window?.addEventListener('focus',focusCheck);globalThis.document?.addEventListener('visibilitychange',focusCheck);void support();
  return {get active(){return active;},get performance(){return graphics?.stats?{...graphics.stats}:null;},checkSupport:support,stop,destroy(){disposed=true;void stop();xr?.removeEventListener?.('devicechange',support);globalThis.window?.removeEventListener('focus',focusCheck);globalThis.document?.removeEventListener('visibilitychange',focusCheck);button.onclick=null;if(arButton)arButton.onclick=null;}};
}
