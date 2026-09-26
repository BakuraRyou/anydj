import {volumeGLSL} from './dmx-beam-volume.js';
// Soft haze, body and bright core share the existing beam pass; no extra draw calls.
const vertex=`attribute vec3 position;attribute vec4 color;attribute vec3 uv;attribute float kind;
uniform vec4 eye;uniform vec4 right;uniform vec4 up;uniform vec4 forward;
varying vec4 tint;varying vec3 tex;varying float effect;varying vec3 world;
void main(){vec3 v=position-eye.xyz;float z=dot(v,forward.xyz);
 gl_Position=vec4(dot(v,right.xyz)*right.w,dot(v,up.xyz)*up.w,z-2.0*forward.w,z);
 if(kind==3.0)gl_Position=vec4(position,1.0);tint=color;tex=uv;effect=kind;world=position;}`;
const fragment=`precision highp float;uniform sampler2D surfaceProfile;uniform sampler2D sceneDepth;uniform vec2 volumeViewport;uniform float depthEnabled;uniform vec4 forward;uniform vec4 eye;varying vec4 tint;varying vec3 tex;varying float effect;varying vec3 world;
${volumeGLSL}
float hazeNoise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 vec4 h=fract(sin(vec4(dot(cell,vec2(127.1,311.7)),dot(cell+vec2(1,0),vec2(127.1,311.7)),dot(cell+vec2(0,1),vec2(127.1,311.7)),dot(cell+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
 return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
void main(){vec4 color=tint;float alpha=1.0;float kind=floor(effect+.5);
 if(kind==1.0){float along=clamp(tex.y,0.0,1.0);float across=abs(tex.x)*1.12/(.035+.965*along);
 float edge=max(0.0,1.0-across*across);float halo=max(0.0,1.0-across*across/1.2544);
 float body=.72*edge*edge+.018*halo*halo;
 alpha=min(1.0,body*(1.0-.22*along)/(.6+along)*min(1.0,along*40.0)*min(1.0,(1.0-along)*40.0));
 alpha*=smoothstep(0.0,1.0,tex.z);
 if(eye.w>.5)alpha*=.72+.5*hazeNoise(vec2(world.x+.37*world.y,world.z+.21*world.y)*1.1);}
 if(kind==2.0){float radius=length(tex.xy);float edge=max(0.0,1.0-radius*radius);float core=max(0.0,1.0-radius*radius/.1);
 alpha=.07*edge*edge+.93*core*core;color=vec4(mix(color.rgb,vec3(1.0),.65*max(0.0,1.0-radius/.12)),color.a);}
 if(kind==4.0||kind==5.0){float radius=length(tex.xy);float stop=kind==5.0?.3:.08;alpha=1.0-smoothstep(stop,1.0,radius);}
 if(kind==7.0){float r=length(tex.xy/max(.0001,tex.z));
 alpha=r<1.0?texture2D(surfaceProfile,vec2((clamp(r,0.0,1.0)*255.0+.5)/256.0,.5)).r:0.0;
 if(alpha>0.0){float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;alpha=max(0.0,alpha+noise/255.0);}}
 if(kind==8.0){vec3 direction=normalize(world-eye.xyz);float limit=1000.0;
 if(depthEnabled>.5){float z=texture2D(sceneDepth,gl_FragCoord.xy/volumeViewport).r;limit=forward.w/max(.000001,1.0-z)/max(.000001,dot(direction,forward.xyz));}
 alpha=volumeLight(eye.xyz,direction,limit);}
 if(kind==6.0)alpha=fract(sin(dot(mod(gl_FragCoord.xy,64.0),vec2(12.9898,78.233)))*437.585);
 gl_FragColor=vec4(color.rgb,color.a*alpha);}`;
export function createWebGlStage(canvas,onLost){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL unavailable');
  const shaders=[];let program,buffer,disposed=false,capacity=0,depthTexture=null,depthTarget=null,depthColor=null,depthProgram=null,depthWidth=0,depthHeight=0,profileTexture=null,volumeTexture=null,volumeTarget=null,composite=null,quad=null,volumeWidth=0,volumeHeight=0;
  const lost=event=>{event.preventDefault();if(!disposed)onLost();};
  canvas.addEventListener('webglcontextlost',lost);
  function destroy(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);if(buffer)gl.deleteBuffer(buffer);if(quad)gl.deleteBuffer(quad);if(depthTexture)gl.deleteTexture(depthTexture);if(depthTarget)gl.deleteFramebuffer(depthTarget);if(depthColor)gl.deleteRenderbuffer(depthColor);if(depthProgram)gl.deleteProgram(depthProgram);if(profileTexture)gl.deleteTexture(profileTexture);if(volumeTexture)gl.deleteTexture(volumeTexture);if(volumeTarget)gl.deleteFramebuffer(volumeTarget);if(composite)gl.deleteProgram(composite);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  try{
    const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    // Sample the same radial profile from a tiny linear LUT instead of evaluating
    // exp/log for every overlapping receiver pixel.
    profileTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,profileTexture);
    const profilePixels=new Uint8Array(256*4);
    for(let i=0;i<256;i++){const r=i/255,a=Math.max(0,Math.min(1,Math.log((1-.65*Math.exp(-4))/(1-.65*Math.exp(-4*r*r)))));profilePixels[i*4]=Math.round(a*255);profilePixels[i*4+3]=255;}
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,profilePixels);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,'surfaceProfile'),1);gl.activeTexture(gl.TEXTURE0);
    const attributes=[['position',3,0],['color',4,12],['uv',3,28],['kind',1,40]].map(([name,size,offset])=>[gl.getAttribLocation(program,name),size,offset]);
    const bindScene=()=>{gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [location,size,offset] of attributes){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,44,offset);}};
    bindScene();
    const depthSupport=gl.getExtension('WEBGL_depth_texture');
    depthProgram=gl.createProgram();
    gl.attachShader(depthProgram,compile(gl.VERTEX_SHADER,'attribute vec3 position;attribute float kind;varying float effect;uniform vec4 eye,right,up,forward;void main(){vec3 v=position-eye.xyz;float z=dot(v,forward.xyz);gl_Position=vec4(dot(v,right.xyz)*right.w,dot(v,up.xyz)*up.w,z-2.0*forward.w,z);effect=kind;}'));
    gl.attachShader(depthProgram,compile(gl.FRAGMENT_SHADER,'precision mediump float;varying float effect;void main(){if(effect>.5)discard;gl_FragColor=vec4(0.);}'));
    gl.linkProgram(depthProgram);if(!gl.getProgramParameter(depthProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(depthProgram));
    const depthPosition=gl.getAttribLocation(depthProgram,'position'),depthKind=gl.getAttribLocation(depthProgram,'kind'),depthUniforms=['eye','right','up','forward'].map(n=>gl.getUniformLocation(depthProgram,n));
    composite=gl.createProgram();
    gl.attachShader(composite,compile(gl.VERTEX_SHADER,'attribute vec2 point;varying vec2 tex;void main(){tex=point*.5+.5;gl_Position=vec4(point,0.,1.);}'));
    gl.attachShader(composite,compile(gl.FRAGMENT_SHADER,'precision highp float;varying vec2 tex;uniform sampler2D haze,sceneDepth;uniform vec2 hazeSize; void main(){float center=.08/max(.000001,1.-texture2D(sceneDepth,tex).r);vec2 p=tex*hazeSize-.5,base=floor(p),f=fract(p);vec4 sum=vec4(0.);float total=0.,nearestDepth=100000.; for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 uv=(base+vec2(float(x),float(y))+.5)/hazeSize;float d=.08/max(.000001,1.-texture2D(sceneDepth,uv).r);nearestDepth=min(nearestDepth,d);float weight=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);weight*=1.-smoothstep(max(.08,center*.05),max(.16,center*.1),abs(d-center));sum+=texture2D(haze,uv)*weight;total+=weight;}gl_FragColor=total>.0001?sum/total:(center>=nearestDepth-.1?texture2D(haze,tex):vec4(0.));} '));
    gl.linkProgram(composite);if(!gl.getProgramParameter(composite,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(composite));
    const point=gl.getAttribLocation(composite,'point'),haze=gl.getUniformLocation(composite,'haze'),compositeDepth=gl.getUniformLocation(composite,'sceneDepth'),hazeSize=gl.getUniformLocation(composite,'hazeSize');
    quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    bindScene();
    const uniforms=['eye','right','up','forward'].map(name=>gl.getUniformLocation(program,name));
    const beamUniform=gl.getUniformLocation(program,'beamData[0]'),depthEnabled=gl.getUniformLocation(program,'depthEnabled'),volumeViewport=gl.getUniformLocation(program,'volumeViewport');gl.uniform1i(gl.getUniformLocation(program,'sceneDepth'),2);
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
    return {kind:'webgl',maxSize:Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS)),destroy,render(frame){
      if(disposed||gl.isContextLost())throw Error('WebGL context unavailable');
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);bindScene();
      if(frame.vertices.byteLength>capacity){capacity=2**Math.ceil(Math.log2(frame.vertices.byteLength));gl.bufferData(gl.ARRAY_BUFFER,capacity,gl.DYNAMIC_DRAW);}
      gl.bufferSubData(gl.ARRAY_BUFFER,0,frame.vertices);
      uniforms.forEach((location,i)=>gl.uniform4fv(location,frame.camera.subarray(i*4,i*4+4)));
      const reduced=depthSupport&&(frame.volumeScale??1)<1;gl.uniform1f(depthEnabled,0);
      const draw=batch=>{if(batch.volume)gl.uniform4fv(beamUniform,batch.volume);gl.blendFuncSeparate(gl.SRC_ALPHA,batch.mode==='add'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(batch.mode==='lines'?gl.LINES:gl.TRIANGLES,batch.first,batch.count);};
      for(const batch of frame.batches)if(!reduced||!batch.volume)draw(batch);
      if(reduced&&frame.batches.some(b=>b.volume)){
        const w=Math.max(1,Math.round(canvas.width*frame.volumeScale)),h=Math.max(1,Math.round(canvas.height*frame.volumeScale));
        // Full-resolution scene depth stops haze at opaque geometry. The depth-aware
        // upsample rejects background haze across foreground silhouettes.
        if(!depthTexture){depthTexture=gl.createTexture();depthTarget=gl.createFramebuffer();depthColor=gl.createRenderbuffer();}
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,depthTexture);
        if(depthWidth!==canvas.width||depthHeight!==canvas.height){
          depthWidth=canvas.width;depthHeight=canvas.height;
          gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,depthWidth,depthHeight,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          gl.bindRenderbuffer(gl.RENDERBUFFER,depthColor);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA4,depthWidth,depthHeight);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,depthTarget);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depthTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,depthColor);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Scene depth unavailable');
        gl.useProgram(depthProgram);for(const [location] of attributes)gl.disableVertexAttribArray(location);
        gl.enableVertexAttribArray(depthPosition);gl.vertexAttribPointer(depthPosition,3,gl.FLOAT,false,44,0);gl.enableVertexAttribArray(depthKind);gl.vertexAttribPointer(depthKind,1,gl.FLOAT,false,44,40);
        depthUniforms.forEach((location,i)=>gl.uniform4fv(location,frame.camera.subarray(i*4,i*4+4)));
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.colorMask(false,false,false,false);
        for(const batch of frame.batches)if(batch.mode==='normal')gl.drawArrays(gl.TRIANGLES,batch.first,batch.count);
        gl.colorMask(true,true,true,true);gl.disable(gl.DEPTH_TEST);gl.disableVertexAttribArray(depthPosition);gl.disableVertexAttribArray(depthKind);bindScene();
        gl.uniform1f(depthEnabled,1);gl.uniform2f(volumeViewport,w,h);

        if(!volumeTexture){volumeTexture=gl.createTexture();volumeTarget=gl.createFramebuffer();}
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,volumeTexture);
        if(w!==volumeWidth||h!==volumeHeight){
          volumeWidth=w;volumeHeight=h;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,volumeTarget);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,volumeTexture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Haze framebuffer unavailable');
        gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        for(const batch of frame.batches)if(batch.volume)draw(batch);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
        gl.useProgram(composite);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
        for(const [location] of attributes)gl.disableVertexAttribArray(location);
        gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);gl.uniform1i(haze,0);gl.uniform1i(compositeDepth,2);gl.uniform2f(hazeSize,w,h);
        // The haze texture already contains additive, premultiplied radiance.
        gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        gl.disableVertexAttribArray(point);bindScene();
      }
    }};
  }catch(error){destroy();throw error;}
}
