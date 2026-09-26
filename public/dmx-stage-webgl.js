// Soft haze, body and bright core share the existing beam pass; no extra draw calls.
const vertex=`attribute vec3 position;attribute vec4 color;attribute vec2 uv;attribute float kind;
uniform vec4 eye;uniform vec4 right;uniform vec4 up;uniform vec4 forward;
varying vec4 tint;varying vec2 tex;varying float effect;varying vec3 world;
void main(){vec3 v=position-eye.xyz;float z=dot(v,forward.xyz);
 gl_Position=vec4(dot(v,right.xyz)*right.w,dot(v,up.xyz)*up.w,z-2.0*forward.w,z);
 if(kind==3.0)gl_Position=vec4(position,1.0);tint=color;tex=uv;effect=kind;world=position;}`;
const fragment=`precision highp float;uniform vec4 eye;varying vec4 tint;varying vec2 tex;varying float effect;varying vec3 world;
float hazeNoise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 vec4 h=fract(sin(vec4(dot(cell,vec2(127.1,311.7)),dot(cell+vec2(1,0),vec2(127.1,311.7)),dot(cell+vec2(0,1),vec2(127.1,311.7)),dot(cell+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
 return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
void main(){vec4 color=tint;float alpha=1.0;float kind=floor(effect+.5);
 if(kind==1.0){float along=clamp(tex.y,0.0,1.0);float across=abs(tex.x)*1.12/(.035+.965*along);
 float edge=max(0.0,1.0-across*across);float halo=max(0.0,1.0-across*across/1.2544);
 float body=.72*edge*edge+.018*halo*halo;
 alpha=min(1.0,body*(1.0-.22*along)/(.6+along)*min(1.0,along*40.0)*min(1.0,(1.0-along)*40.0));
 if(eye.w>.5)alpha*=.72+.5*hazeNoise(vec2(world.x+.37*world.y,world.z+.21*world.y)*1.1);}
 if(kind==2.0){float radius=length(tex);float edge=max(0.0,1.0-radius*radius);float core=max(0.0,1.0-radius*radius/.1);
 alpha=.07*edge*edge+.93*core*core;color=vec4(mix(color.rgb,vec3(1.0),.65*max(0.0,1.0-radius/.12)),color.a);}
 if(kind==4.0||kind==5.0){float radius=length(tex);float stop=kind==5.0?.3:.08;alpha=1.0-smoothstep(stop,1.0,radius);}
 if(kind==6.0)alpha=fract(sin(dot(mod(gl_FragCoord.xy,64.0),vec2(12.9898,78.233)))*437.585);
 gl_FragColor=vec4(color.rgb,color.a*alpha);}`;
export function createWebGlStage(canvas,onLost){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL unavailable');
  const shaders=[];let program,buffer,disposed=false,capacity=0;
  const lost=event=>{event.preventDefault();if(!disposed)onLost();};
  canvas.addEventListener('webglcontextlost',lost);
  function destroy(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  try{
    const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,size,offset] of [['position',3,0],['color',4,12],['uv',2,28],['kind',1,36]]){
      const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset);
    }
    const uniforms=['eye','right','up','forward'].map(name=>gl.getUniformLocation(program,name));
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
    return {kind:'webgl',maxSize:Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS)),destroy,render(frame){
      if(disposed||gl.isContextLost())throw Error('WebGL context unavailable');
      gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(frame.vertices.byteLength>capacity){capacity=2**Math.ceil(Math.log2(frame.vertices.byteLength));gl.bufferData(gl.ARRAY_BUFFER,capacity,gl.DYNAMIC_DRAW);}
      gl.bufferSubData(gl.ARRAY_BUFFER,0,frame.vertices);
      uniforms.forEach((location,i)=>gl.uniform4fv(location,frame.camera.subarray(i*4,i*4+4)));
      for(const batch of frame.batches){gl.blendFuncSeparate(gl.SRC_ALPHA,batch.mode==='add'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(batch.mode==='lines'?gl.LINES:gl.TRIANGLES,batch.first,batch.count);}
    }};
  }catch(error){destroy();throw error;}
}
