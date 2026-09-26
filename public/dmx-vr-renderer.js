import {createVRScene,roomToXRMatrix,vrEyeBasis,vrBeamBounds} from './dmx-vr-scene.js';
import {createVRQuality} from './dmx-vr-quality.js';
import {volumeGLSL} from './dmx-beam-volume.js';
import {sceneEnvironmentBrightness} from './dmx-room-style.js';
import {xrToRoom} from './dmx-ar-model.js';
import {createConsoleGraphics} from './dmx-vr-console.js';

const sceneVertex=`attribute vec3 position;attribute vec4 color;attribute vec3 uv;attribute float kind;
uniform mat4 projection,view,room;varying vec4 tint;varying vec3 tex;varying float effect;
void main(){gl_Position=projection*view*room*vec4(position,1.);tint=color;tex=uv;effect=kind;}`;
const depthCode=`float unpackDepth(vec4 rgba){return min(1.,dot(rgba,vec4(1./16777216.,1./65536.,1./256.,1.)));}
float distanceAt(float z,vec2 p){return p.y/(2.*z-1.+p.x);}`;
const sceneFragment=`precision highp float;uniform float depthOnly;uniform sampler2D profile;
varying vec4 tint;varying vec3 tex;varying float effect;
void main(){
 if(depthOnly>.5){vec4 d=fract(gl_FragCoord.z*vec4(16777216.,65536.,256.,1.));d-=d.xxyz*vec4(0.,1./256.,1./256.,1./256.);gl_FragColor=d;return;}
 float a=1.;if(effect>.5){float r=length(tex.xy/max(.0001,tex.z));a=r<1.?texture2D(profile,vec2((clamp(r,0.,1.)*255.+.5)/256.,.5)).r:0.;}
 gl_FragColor=vec4(tint.rgb,tint.a*a);
}`;
const quadVertex=`attribute vec2 point;uniform vec4 bounds;varying vec2 tex;
void main(){vec2 p=mix(bounds.xy,bounds.zw,point*.5+.5);tex=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const beamFragment=`precision highp float;varying vec2 tex;uniform sampler2D depth;
uniform vec3 eyePosition,rayRight,rayUp,rayForward,forward;uniform vec4 tint;uniform vec2 depthProjection;
${depthCode}
${volumeGLSL}
void main(){vec2 p=tex*2.-1.;vec3 direction=normalize(rayForward+p.x*rayRight+p.y*rayUp);
 float limit=distanceAt(unpackDepth(texture2D(depth,tex)),depthProjection)/max(.000001,dot(direction,forward));
 gl_FragColor=vec4(tint.rgb,tint.a*volumeLight(eyePosition,direction,limit));}`;
// Eight attributes and seven varying vectors fit the WebGL1 minimum limits.
// One instanced draw per eye replaces hundreds of per-beam uniform/draw calls.
const instancedBeamVertex=`attribute vec2 point;attribute vec4 bounds,color,volume0,volume1,volume2,volume3,volume4;
varying vec2 tex;varying vec4 tint,data0,data1,data2,data3,data4;
void main(){vec2 p=mix(bounds.xy,bounds.zw,point*.5+.5);tex=p*.5+.5;gl_Position=vec4(p,0.,1.);
tint=color;data0=volume0;data1=volume1;data2=volume2;data3=volume3;data4=volume4;}`;
const instancedBeamFragment=beamFragment.replace('uniform vec4 tint;','varying vec4 tint;')
  .replace('uniform vec4 beamData[5];','varying vec4 data0,data1,data2,data3,data4;')
  .replace(/beamData\[([0-4])\]/g,(_,n)=>'data'+n);
const compositeFragment=`precision highp float;varying vec2 tex;uniform sampler2D haze,depth;uniform vec2 hazeSize,depthProjection;
${depthCode}
float zAt(vec2 uv){return distanceAt(unpackDepth(texture2D(depth,uv)),depthProjection);}
void main(){float center=zAt(tex),total=0.,nearest=100000.;vec2 p=tex*hazeSize-.5,base=floor(p),f=fract(p);vec4 sum=vec4(0.);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 uv=(base+vec2(float(x),float(y))+.5)/hazeSize;float z=zAt(uv);nearest=min(nearest,z);
 float weight=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);weight*=1.-smoothstep(max(.08,center*.05),max(.16,center*.1),abs(z-center));sum+=texture2D(haze,uv)*weight;total+=weight;}
 gl_FragColor=total>.0001?sum/total:(center>=nearest-.1?texture2D(haze,tex):vec4(0.));}`;

export async function createVRGraphics(session){
  const ar=session.environmentBlendMode==='alpha-blend'||session.environmentBlendMode==='additive';
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:ar,antialias:true,xrCompatible:true,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL ist für die VR-Darstellung nicht verfügbar.');
  const programs=[],shaders=[],buffers=[],textures=[],targets=[],renderbuffers=[];
  let consoleGraphics,disposed=false;
  const destroy=()=>{if(disposed)return;disposed=true;consoleGraphics?.destroy();for(const p of programs)gl.deleteProgram(p);for(const s of shaders)gl.deleteShader(s);for(const b of buffers)gl.deleteBuffer(b);for(const t of textures)gl.deleteTexture(t);for(const f of targets)gl.deleteFramebuffer(f);for(const r of renderbuffers)gl.deleteRenderbuffer(r);gl.getExtension('WEBGL_lose_context')?.loseContext();};
  try{
    await gl.makeXRCompatible();
    // 1 means the runtime's recommended size, not necessarily panel-native size.
    const layer=new XRWebGLLayer(session,gl,{alpha:ar,antialias:true,framebufferScaleFactor:1});
    const foveation=typeof layer.fixedFoveation==='number';
    if(foveation)layer.fixedFoveation=1/3;
    const program=(vs,fs)=>{
      const p=gl.createProgram();programs.push(p);
      for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}
      gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      return {id:p,uniforms:new Map(),u(name){if(!this.uniforms.has(name))this.uniforms.set(name,gl.getUniformLocation(p,name));return this.uniforms.get(name);}};
    };
    const sceneProgram=program(sceneVertex,sceneFragment),beamProgram=program(quadVertex,beamFragment),composite=program(quadVertex,compositeFragment);
    const instancing=gl.getExtension('ANGLE_instanced_arrays');let instancedBeam=null;
    if(instancing)try{instancedBeam=program(instancedBeamVertex,instancedBeamFragment);}catch{/* Older drivers retain the per-beam path. */}
    const newBuffer=()=>{const b=gl.createBuffer();buffers.push(b);return b;};
    const streams=Object.fromEntries(['solid','lines','alpha','add'].map(name=>[name,{buffer:newBuffer(),capacity:0,previous:null,length:0}]));
    const instanceBuffer=newBuffer();let instanceData=new Float32Array(28*256),instanceCapacity=0;
    const instanceAttributes=instancedBeam?['bounds','color','volume0','volume1','volume2','volume3','volume4'].map((name,i)=>[gl.getAttribLocation(instancedBeam.id,name),i*16]):[];
    const quad=newBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const texture=(filter)=>{const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
    const profile=texture(gl.LINEAR),pixels=new Uint8Array(256*4);
    for(let i=0;i<256;i++){const r=i/255;pixels[i*4]=Math.round(255*Math.max(0,Math.min(1,Math.log((1-.65*Math.exp(-4))/(1-.65*Math.exp(-4*r*r))))));pixels[i*4+3]=255;}
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    function target(withDepth){const t={texture:texture(withDepth?gl.NEAREST:gl.LINEAR),framebuffer:gl.createFramebuffer(),width:0,height:0};targets.push(t.framebuffer);if(withDepth){t.depth=gl.createRenderbuffer();renderbuffers.push(t.depth);}return t;}
    // Separate eye targets avoid reallocating when runtime eye sizes differ.
    const eyes=new Map();
    const resize=(t,w,h)=>{
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);if(t.width===w&&t.height===h)return;
      t.width=w;t.height=h;gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.texture,0);
      if(t.depth){gl.bindRenderbuffer(gl.RENDERBUFFER,t.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depth);}
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('VR-Lichtpuffer konnte nicht erstellt werden.');
    };
    const attributes=[['position',3,0],['color',4,12],['uv',3,28],['kind',1,40]].map(([name,size,offset])=>[gl.getAttribLocation(sceneProgram.id,name),size,offset]);
    // The console uses other attributes. Reset the small attribute set at pass
    // boundaries, including disabled pointers left behind by another program.
    const maxAttributes=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const resetAttributes=()=>{for(let i=0;i<maxAttributes;i++)gl.disableVertexAttribArray(i);};
    const bindStream=name=>{gl.useProgram(sceneProgram.id);resetAttributes();gl.bindBuffer(gl.ARRAY_BUFFER,streams[name].buffer);for(const [a,size,offset] of attributes){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,44,offset);}};
    const bindQuad=p=>{gl.useProgram(p.id);resetAttributes();gl.bindBuffer(gl.ARRAY_BUFFER,quad);const a=gl.getAttribLocation(p.id,'point');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,8,0);};
    const bindTexture=(unit,t)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);};
    const builder=createVRScene(),quality=createVRQuality();consoleGraphics=createConsoleGraphics(gl);
    const stats={instancedBeams:!!instancedBeam,frames:0,buildMs:0,submitMs:0,uploadedBytes:0,vertices:0,beams:0,visibleBeams:0,volumeScale:1,framebufferWidth:0,framebufferHeight:0};
    return {layer,destroy,stats,observeFrame(time,frameRate){
      const state=quality.sample(time,frameRate,stats.buildMs+stats.submitMs);
      if(foveation)layer.fixedFoveation=Math.min(1,(1+state.level)/3);
      stats.intervalMs=state.intervalMs;stats.budgetMs=state.budgetMs;stats.missedFrames=state.missedFrames;stats.qualityLevel=state.level;
    },render(pose,scene,origin,overlay){
      if(disposed||gl.isContextLost())throw Error('Die VR-Grafikverbindung wurde unterbrochen.');
      const start=performance.now(),basis=pose.views[0]?vrEyeBasis(pose.views[0],origin):null;
      const frame=builder.build(scene,basis?.position),room=roomToXRMatrix(origin);
      frame.volumeScale=quality.scale(frame.volumeScale);
      for(const line of overlay?.worldLines||[])for(const point of line.points)frame.lines.push(xrToRoom(point,origin),line.color,1);
      if(overlay?.ray)for(const point of overlay.ray)frame.lines.push(xrToRoom(point,origin),overlay.rayColor||[.55,.95,.9],1);
      stats.buildMs=performance.now()-start;stats.uploadedBytes=0;stats.vertices=0;stats.beams=frame.beams.length;stats.visibleBeams=0;stats.volumeScale=frame.volumeScale;
      // Only changed streams are uploaded; fixed shows reuse their GPU buffers.
      for(const name of ['solid','lines','alpha','add']){const out=frame[name],gpu=streams[name];stats.vertices+=out.length/11;
        let changed=gpu.length!==out.length||!gpu.previous;
        if(!changed)for(let i=0;i<out.length;i++)if(gpu.previous[i]!==out.data[i]){changed=true;break;}
        if(changed){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);if(out.data.byteLength>gpu.capacity){gpu.capacity=out.data.byteLength;gpu.previous=new Float32Array(out.data.length);gl.bufferData(gl.ARRAY_BUFFER,gpu.capacity,gl.DYNAMIC_DRAW);}
          gl.bufferSubData(gl.ARRAY_BUFFER,0,out.data.subarray(0,out.length));gpu.previous.set(out.data.subarray(0,out.length));stats.uploadedBytes+=out.length*4;gpu.length=out.length;}
      }
      if(overlay)consoleGraphics.prepare(overlay);
      gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
      const ambient=sceneEnvironmentBrightness(scene.layout)/100;
      gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(ar?0:.025*ambient,ar?0:.045*ambient,ar?0:.075*ambient,ar?0:1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(sceneProgram.id);gl.uniformMatrix4fv(sceneProgram.u('room'),false,room);gl.uniform1i(sceneProgram.u('profile'),0);
      const draw=name=>{if(!streams[name].length)return;bindStream(name);gl.drawArrays(name==='lines'?gl.LINES:gl.TRIANGLES,0,streams[name].length/11);};
      for(const [index,eye] of Array.from(pose.views).entries()){
        const viewport=layer.getViewport(eye);if(!viewport)continue;
        const projection=eye.projectionMatrix,b=vrEyeBasis(eye,origin);
        gl.useProgram(sceneProgram.id);gl.uniformMatrix4fv(sceneProgram.u('projection'),false,projection);gl.uniformMatrix4fv(sceneProgram.u('view'),false,eye.transform.inverse.matrix);gl.uniform1f(sceneProgram.u('depthOnly'),0);
        gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);bindTexture(0,profile);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);draw('solid');draw('lines');
        gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);draw('alpha');
        gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);draw('add');
        const visible=frame.beams.map(beam=>({beam,bounds:vrBeamBounds(beam.corners,b,projection)})).filter(v=>v.bounds);stats.visibleBeams+=visible.length;
        if(visible.length){
          let targets=eyes.get(index);if(!targets){targets={depth:target(true),haze:target(false)};eyes.set(index,targets);}
          const {depth,haze}=targets,w=viewport.width,h=viewport.height;
          // Packed depth works on WebGL1 even without WEBGL_depth_texture.
          gl.activeTexture(gl.TEXTURE0);resize(depth,w,h);gl.viewport(0,0,w,h);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          bindTexture(0,profile);gl.useProgram(sceneProgram.id);gl.uniform1f(sceneProgram.u('depthOnly'),1);draw('solid');gl.uniform1f(sceneProgram.u('depthOnly'),0);
          resize(haze,Math.max(1,Math.round(w*frame.volumeScale)),Math.max(1,Math.round(h*frame.volumeScale)));gl.viewport(0,0,haze.width,haze.height);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
          const hazeProgram=instancedBeam||beamProgram;bindQuad(hazeProgram);bindTexture(0,depth.texture);gl.uniform1i(hazeProgram.u('depth'),0);gl.uniform2f(hazeProgram.u('depthProjection'),projection[10],projection[14]);
          gl.uniform3fv(hazeProgram.u('eyePosition'),b.position);gl.uniform3fv(hazeProgram.u('forward'),b.forward);
          gl.uniform3fv(hazeProgram.u('rayRight'),b.right.map(v=>v/projection[0]));gl.uniform3fv(hazeProgram.u('rayUp'),b.up.map(v=>v/projection[5]));
          gl.uniform3fv(hazeProgram.u('rayForward'),b.forward.map((v,i)=>v+b.right[i]*projection[8]/projection[0]+b.up[i]*projection[9]/projection[5]));
          if(instancedBeam){
            const count=visible.length*28;
            if(count>instanceData.length)instanceData=new Float32Array(2**Math.ceil(Math.log2(count)));
            visible.forEach(({beam,bounds},i)=>{const offset=i*28;instanceData.set(bounds,offset);instanceData.set(beam.color,offset+4);instanceData[offset+7]=beam.power;instanceData.set(beam.volume.data,offset+8);});
            gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);
            if(instanceData.byteLength>instanceCapacity){instanceCapacity=instanceData.byteLength;gl.bufferData(gl.ARRAY_BUFFER,instanceCapacity,gl.DYNAMIC_DRAW);}
            gl.bufferSubData(gl.ARRAY_BUFFER,0,instanceData.subarray(0,count));
            for(const [a,offset] of instanceAttributes){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,112,offset);instancing.vertexAttribDivisorANGLE(a,1);}
            instancing.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,visible.length);
            for(const [a] of instanceAttributes)instancing.vertexAttribDivisorANGLE(a,0);
          }else for(const {beam,bounds} of visible){gl.uniform4fv(hazeProgram.u('bounds'),bounds);gl.uniform4fv(hazeProgram.u('beamData[0]'),beam.volume.data);gl.uniform4f(hazeProgram.u('tint'),...beam.color,beam.power);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
          gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.viewport(viewport.x,viewport.y,w,h);bindQuad(composite);bindTexture(0,haze.texture);bindTexture(1,depth.texture);gl.uniform1i(composite.u('haze'),0);gl.uniform1i(composite.u('depth'),1);gl.uniform2f(composite.u('hazeSize'),haze.width,haze.height);gl.uniform2f(composite.u('depthProjection'),projection[10],projection[14]);gl.uniform4f(composite.u('bounds'),-1,-1,1,1);gl.blendFuncSeparate(gl.ONE,ar?gl.ONE_MINUS_SRC_ALPHA:gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        }
        if(overlay){gl.activeTexture(gl.TEXTURE0);resetAttributes();consoleGraphics.render(eye);}
      }
      gl.depthMask(true);gl.activeTexture(gl.TEXTURE0);stats.frames++;stats.submitMs=performance.now()-start-stats.buildMs;stats.framebufferWidth=layer.framebufferWidth||canvas.width;stats.framebufferHeight=layer.framebufferHeight||canvas.height;
    }};
  }catch(error){destroy();throw error;}
}
