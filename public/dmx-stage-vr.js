// Optional WebXR adapter. No XR session or GPU resources until the user enters VR.
export function worldToXR(point,origin){
  const x=point[0]-origin.x,y=point[1]-origin.y,c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
  return [x*c+y*s,point[2]-(origin.floorOffset||0),x*s-y*c];
}
export async function createVRGraphics(session){
  const {drawStageGeometry}=await import('./dmx-stage-3d-renderer.js');
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:false,antialias:true,xrCompatible:true});
  if(!gl)throw Error('WebGL ist für die VR-Darstellung nicht verfügbar.');
  let program,buffer;const shaders=[];
  function destroy(){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  try{
    await gl.makeXRCompatible();
    const layer=new XRWebGLLayer(session,gl,{alpha:false,antialias:true,framebufferScaleFactor:.85});
    const shader=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('VR-Shader konnte nicht erstellt werden.');return s;};
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 position; attribute vec4 color; uniform mat4 projection; uniform mat4 view; varying vec4 tint; void main(){tint=color;gl_Position=projection*view*vec4(position,1.0);}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec4 tint; void main(){gl_FragColor=tint;}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('VR-Renderer konnte nicht erstellt werden.');
    buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,size,offset] of [['position',3,0],['color',4,12]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,28,offset);}
    const projection=gl.getUniformLocation(program,'projection'),view=gl.getUniformLocation(program,'view');
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.025,.045,.075,1);
    const colors=new Map();
    const color=value=>{if(colors.has(value))return colors.get(value);const rgb=value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255):(value.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(v=>Number(v)/255);if(colors.size>1024)colors.clear();colors.set(value,rgb);return rgb;};
    return {layer,destroy,render(pose,scene,origin){
      if(gl.isContextLost())throw Error('Die VR-Grafikverbindung wurde unterbrochen.');
      const solid=[],transparent=[],lines=[];
      const vertex=(out,p,rgb,a)=>out.push(...worldToXR(p,origin),...rgb,a);
      drawStageGeometry(scene.layout,scene.lights,scene.crowd,scene.motion,{polygon(points,fill,alpha=1,stroke){
        if(fill&&points.length>=3){const out=alpha<1?transparent:solid,rgb=color(fill);for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]])vertex(out,p,rgb,alpha);}
        if(stroke){const rgb=color(stroke),n=points.length===2?1:points.length;for(let i=0;i<n;i++){vertex(lines,points[i],rgb,1);vertex(lines,points[(i+1)%points.length],rgb,1);}}
      }});
      const vertices=new Float32Array(solid.length+lines.length+transparent.length);vertices.set(solid);vertices.set(lines,solid.length);vertices.set(transparent,solid.length+lines.length);
      const batches=[{first:0,count:solid.length/7},{first:solid.length/7,count:lines.length/7},{first:(solid.length+lines.length)/7,count:transparent.length/7}];
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
      gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      for(const eye of pose.views){const v=layer.getViewport(eye);if(!v)continue;gl.viewport(v.x,v.y,v.width,v.height);gl.uniformMatrix4fv(projection,false,eye.projectionMatrix);gl.uniformMatrix4fv(view,false,eye.transform.inverse.matrix);
        batches.forEach((batch,i)=>{if(!batch.count)return;gl.depthMask(i!==2);if(i===2){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);}else gl.disable(gl.BLEND);gl.drawArrays(i===1?gl.LINES:gl.TRIANGLES,batch.first,batch.count);});
      }
      gl.depthMask(true);
    }};
  }catch(error){destroy();throw error;}
}
export function createStageVR({button,status,getScene,getOrigin,onActive=()=>{},xr=globalThis.navigator?.xr,secure=globalThis.isSecureContext,createGraphics=createVRGraphics}){
  let session=null,graphics=null,reference=null,origin=null,busy=false,disposed=false,generation=0,active=false;
  const message=text=>{status.textContent=text;};
  function reset(){graphics?.destroy();graphics=null;reference=null;session=null;busy=false;if(active){active=false;onActive(false);}button.textContent='VR starten';button.setAttribute('aria-pressed','false');button.disabled=disposed;}
  async function support(){if(disposed||session||busy)return;button.disabled=true;
    if(!secure){button.title='VR benötigt HTTPS oder localhost.';message('VR: Öffne die App über eine vertrauenswürdige HTTPS-Verbindung im Headset-Browser.');return;}
    if(!xr){button.title='Dieser Browser bietet kein WebXR.';message('VR: In einem WebXR-fähigen Headset-Browser öffnen.');return;}
    try{const supported=await xr.isSessionSupported('immersive-vr');if(disposed||session||busy)return;button.disabled=!supported;button.title=supported?'Lichtshow im Headset erleben':'Kein VR-Headset verfügbar';message(supported?'VR bereit · Kopfbewegungen und Schritte werden im Headset übernommen.':'VR: Kein kompatibles Headset erkannt.');}catch{if(!disposed)message('VR-Unterstützung konnte nicht geprüft werden.');}
  }
  async function stop(){generation++;if(!session){if(busy){reset();if(!disposed)void support();}return;}if(session)try{await session.end();}catch{reset();} }
  async function start(){
    if(disposed||busy)return;if(session){await stop();return;}
    busy=true;button.disabled=true;const attempt=++generation;let own=null,failureMessage='';
    try{
      // requestSession must run directly in the user gesture, before async imports.
      own=await xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});
      if(disposed||attempt!==generation){await own.end();return;}
      session=own;
      own.addEventListener('end',()=>{if(session!==own)return;generation++;reset();if(!disposed){message('VR beendet · die 3D-Ansicht ist wieder verfügbar.');void support().then(()=>{if(failureMessage&&!disposed)message(failureMessage);});}},{once:true});
      const resource=await createGraphics(own);
      if(disposed||session!==own||attempt!==generation){resource.destroy();await own.end().catch(()=>{});return;}graphics=resource;
      let floor=true;try{reference=await own.requestReferenceSpace('local-floor');}catch{floor=false;reference=await own.requestReferenceSpace('local');}
      if(disposed||session!==own||attempt!==generation){await own.end().catch(()=>{});return;}
      onActive(true);active=true;origin={...getOrigin(),floorOffset:floor?0:getOrigin().eyeHeight};
      own.updateRenderState({baseLayer:graphics.layer,depthNear:.05,depthFar:150});
      button.textContent='VR beenden';button.disabled=false;button.setAttribute('aria-pressed','true');busy=false;message('VR aktiv · umsehen und physisch umherbewegen. Zum Beenden das Headset-Menü verwenden.');
      const frame=(time,xrFrame)=>{
        if(session!==own||disposed)return;
        own.requestAnimationFrame(frame);
        if(own.visibilityState==='hidden')return;
        try{const pose=xrFrame.getViewerPose(reference);if(pose)graphics.render(pose,getScene(time/1000),origin);}catch(error){failureMessage=`VR wurde beendet: ${error.message}`;message(failureMessage);void stop();}
      };own.requestAnimationFrame(frame);
    }catch(error){failureMessage=error.name==='NotAllowedError'?'VR wurde nicht freigegeben. Du kannst es erneut versuchen.':`VR konnte nicht gestartet werden: ${error.message}`;if(own)await own.end().catch(()=>{});if(!disposed&&(!session||session===own)){reset();message(error.name==='NotAllowedError'?'VR wurde nicht freigegeben. Du kannst es erneut versuchen.':`VR konnte nicht gestartet werden: ${error.message}`);}}
    finally{if(attempt===generation)busy=false;}
  }
  button.onclick=()=>void start();xr?.addEventListener?.('devicechange',support);void support();
  return {get active(){return active;},stop,destroy(){disposed=true;void stop();xr?.removeEventListener?.('devicechange',support);button.onclick=null;}};
}
