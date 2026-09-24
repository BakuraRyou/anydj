// Controller interaction uses XR metres; music commands go through the existing deck transport.
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
export function panelHit(panel,matrix){
  if(!panel||!matrix)return null;
  const p=[matrix[12],matrix[13],matrix[14]],ray=[-matrix[8],-matrix[9],-matrix[10]],den=dot(ray,panel.normal);
  if(den>=-.001)return null;const distance=dot(sub(panel.center,p),panel.normal)/den;if(distance<0||distance>5)return null;
  const point=p.map((v,i)=>v+ray[i]*distance),relative=sub(point,panel.center),u=.5+dot(relative,panel.right)/panel.width,v=.5-dot(relative,panel.up)/panel.height;
  return u>=0&&u<=1&&v>=0&&v<=1?{u,v,point}:null;
}
export function moveVROrigin(origin,head,layout,axes,turn,dt){
  const c=Math.cos(origin.yaw),s=Math.sin(origin.yaw),hx=head[12]||0,hz=head[14]||0;
  let x=origin.x+c*hx+s*hz,y=origin.y+s*hx-c*hz;
  const a=axes.map(n=>Math.abs(n)>.2?Math.sign(n)*(Math.abs(n)-.2)/.8:0),n=Math.max(1,Math.hypot(...a)),forward=unit([-head[8],0,-head[10]]),right=[-forward[2],0,forward[0]];
  const rx=(right[0]*a[0]-forward[0]*a[1])/n*1.4*Math.min(.05,dt),rz=(right[2]*a[0]-forward[2]*a[1])/n*1.4*Math.min(.05,dt);
  if(rx||rz){x=Math.max(-layout.width/2+.2,Math.min(layout.width/2-.2,x+c*rx+s*rz));y=Math.max(.2,Math.min(layout.depth-.2,y+s*rx-c*rz));}
  origin.yaw+=turn;const nc=Math.cos(origin.yaw),ns=Math.sin(origin.yaw);origin.x=x-nc*hx-ns*hz;origin.y=y-ns*hx+nc*hz;
}
export function createVRConsole({command,exit}){
  let panel=null,hover=null,selected='',scene={},notice='',pending=false,last=0,latched=false,pointer=null;
  const buttons=[['A',.04,.19,.44,.12],['B',.52,.19,.44,.12],['play',.04,.52,.44,.16],['back',.52,.52,.21,.16],['next',.75,.52,.21,.16],['exit',.64,.80,.32,.14]];
  const deck=()=>scene.transport?.decks?.find(d=>d.id===selected);
  function target(hit){return hit&&buttons.find(([,x,y,w,h])=>hit.u>=x&&hit.u<=x+w&&hit.v>=y&&hit.v<=y+h)?.[0];}
  function input(frame,source,reference){return source?.targetRaySpace?frame.getPose?.(source.targetRaySpace,reference)?.transform.matrix:null;}
  return {
    update(frame,reference,pose,session,value,origin,time){
      scene=value;const decks=scene.transport?.decks||[];if(!decks.some(d=>d.id===selected))selected=scene.transport?.selected||decks[0]?.id||'A';
      const head=pose.transform?.matrix;if(!head)return null;
      const sources=Array.from(session.inputSources||[]),left=sources.find(s=>s.handedness==='left'),right=sources.find(s=>s.handedness==='right')||sources.find(s=>s!==left),la=left?.gamepad?.axes||[],ra=right?.gamepad?.axes||[];
      const thumb=ra.length>=4?ra[2]:0;let turn=0;if(Math.abs(thumb)<.3)latched=false;if(Math.abs(thumb)>.7&&!latched){turn=-Math.sign(thumb)*Math.PI/6;latched=true;}
      if(scene.layout)moveVROrigin(origin,head,scene.layout,la.length>=4?[la[2],la[3]]:[0,0],turn,last?Math.max(0,(time-last)/1000):0);last=time;
      const grip=left?.gripSpace?frame.getPose?.(left.gripSpace,reference)?.transform.matrix:null;
      const center=grip?[grip[12],grip[13]+.12,grip[14]]:[head[12]-head[8]*.8,head[13]-.25,head[14]-head[10]*.8];
      const normal=unit(sub([head[12],head[13],head[14]],center)),rightVector=unit([normal[2],0,-normal[0]]),up=[normal[1]*rightVector[2]-normal[2]*rightVector[1],normal[2]*rightVector[0]-normal[0]*rightVector[2],normal[0]*rightVector[1]-normal[1]*rightVector[0]];
      panel={center,normal,right:rightVector,up,width:grip ? .38 : .50,height:grip ? .249 : .328};pointer=right||sources[0];const matrix=input(frame,pointer,reference),hit=panelHit(panel,matrix);hover=target(hit);
      return {panel,canvasState:this.state(),ray:matrix?[[matrix[12],matrix[13],matrix[14]],hit?.point||[matrix[12]-matrix[8]*1.5,matrix[13]-matrix[9]*1.5,matrix[14]-matrix[10]*1.5]]:null};
    },
    async select(event,reference){
      if(event.inputSource!==pointer)return;const action=target(panelHit(panel,input(event.frame,event.inputSource,reference)));if(!action)return;
      if(action==='exit'){exit();return;}if(pending||scene.controlsAvailable===false)return;
      const d=deck();let request;
      if(action==='A'||action==='B'){selected=action;request={action:'select',deck:action};}
      else if(action==='play'&&d?.canPlay)request={action:'playing',deck:d.id,value:!d.playing};
      else if((action==='back'||action==='next')&&d?.canSeek)request={action:'seek',deck:d.id,value:Math.max(0,Math.min(d.duration,d.position+(action==='back'?-10:10)))};
      if(!request)return;pending=true;notice='Wird ausgeführt …';try{await command(request);notice='';}catch(e){notice=e.message;}finally{pending=false;}
    },
    state(){const d=deck();return {buttons,hover,selected,title:d?.title||'Kein Song geladen',playing:d?.playing,position:Math.floor(d?.position||0),duration:d?.duration||0,canPlay:d?.canPlay,canSeek:d?.canSeek,disabled:scene.controlsAvailable===false||pending,notice:notice||scene.controlMessage||(scene.controlsAvailable===false?'Verbindung prüfen / erneut mit Code koppeln':'Links: gehen · Rechts: zeigen + Trigger / Stick: drehen')};},
  };
}
export function createConsoleGraphics(gl){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=672;const ctx=canvas.getContext('2d');
  const program=gl.createProgram(),shaders=[];let signature='';
  for(const [type,source] of [[gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 uv;uniform mat4 projection;uniform mat4 view;varying vec2 t;void main(){t=uv;gl_Position=projection*view*vec4(p,1.);}'],[gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;varying vec2 t;void main(){gl_FragColor=texture2D(tex,t);}']]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);gl.attachShader(program,s);}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('VR-Pult konnte nicht erstellt werden.');
  const buffer=gl.createBuffer(),texture=gl.createTexture(),projection=gl.getUniformLocation(program,'projection'),view=gl.getUniformLocation(program,'view');
  function prepare(overlay){
    const state=overlay.canvasState,key=JSON.stringify(state);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(key!==signature){signature=key;ctx.fillStyle='#101f29';ctx.fillRect(0,0,1024,672);ctx.fillStyle='#ecf6f7';ctx.font='bold 36px sans-serif';ctx.fillText('AnyDj · VR-Pult',40,75);
      ctx.font='28px sans-serif';ctx.fillText(state.title.slice(0,53),40,258);ctx.font='24px sans-serif';const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;ctx.fillText(`${fmt(state.position)} / ${fmt(state.duration)}`,40,303);
      ctx.fillStyle='#354b58';ctx.fillRect(40,322,944,7);ctx.fillStyle='#8ee0d3';ctx.fillRect(40,322,944*Math.min(1,state.position/(state.duration||1)),7);
      for(const [id,x,y,w,h] of state.buttons){const disabled=id!=='exit'&&(state.disabled||(id==='play'&&!state.canPlay)||(['back','next'].includes(id)&&!state.canSeek));ctx.fillStyle=disabled?'#26343d':state.hover===id?'#63bfb3':state.selected===id?'#36655f':'#304652';ctx.fillRect(x*1024,y*672,w*1024,h*672);ctx.fillStyle=disabled?'#7c909d':'#ffffff';ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.fillText(id==='play'?(state.playing?'Pause':'Play'):id==='back'?'−10 s':id==='next'?'+10 s':id==='exit'?'VR beenden':`Deck ${id}`,(x+w/2)*1024,(y+h/2)*672+10);ctx.textAlign='left';}
      ctx.font='22px sans-serif';ctx.fillStyle='#bacbd4';const words=state.notice.split(' ');let line='',y=495;for(const word of words){if(ctx.measureText(line+word).width>940){ctx.fillText(line,40,y);line='';y+=27;}line+=word+' ';}ctx.fillText(line,40,y);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    const p=overlay.panel,vertices=[];for(const [u,v] of [[0,0],[0,1],[1,1],[0,0],[1,1],[1,0]])vertices.push(...p.center.map((n,i)=>n+(u-.5)*p.width*p.right[i]+(.5-v)*p.height*p.up[i]),u,v);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
  }
  return {prepare,render(eye){gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,size,offset] of [['p',3,0],['uv',2,12]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,20,offset);}gl.uniformMatrix4fv(projection,false,eye.projectionMatrix);gl.uniformMatrix4fv(view,false,eye.transform.inverse.matrix);gl.bindTexture(gl.TEXTURE_2D,texture);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.DEPTH_TEST);},destroy(){gl.deleteBuffer(buffer);gl.deleteTexture(texture);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}};
}
