import {lightFootprint,beamBoundary} from './dmx-light-geometry.js';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
// Five vec4s per beam. Camera rays integrate only inside the cone, room bounds
// and the receiving plane. The box is a conservative bound for custom rooms.
export function beamVolume(light,layout){
 const {height,length,radius}=lightFootprint(light),origin=[light.position.x,light.position.y,height];
 const delta=[light.target.x-origin[0],light.target.y-origin[1],(light.target.z??0)-height],distance=Math.hypot(...delta);
 if(distance<.001)return null;
 const axis=delta.map(x=>x/distance),boundary=beamBoundary(layout),roof=layout.height||3;
 const lower=[Math.min(...boundary.map(p=>p[0])),Math.min(...boundary.map(p=>p[1])),0];
 const upper=[Math.max(...boundary.map(p=>p[0])),Math.max(...boundary.map(p=>p[1])),roof];
 let normal=[0,0,light.targetSurface==='ceiling'?-1:1];
 if(light.wallIndex>=0){const a=boundary[light.wallIndex],b=boundary[(light.wallIndex+1)%boundary.length];if(a&&b){const n=Math.hypot(b[0]-a[0],b[1]-a[1]);normal=[(b[1]-a[1])/n,(a[0]-b[0])/n,0];}}
 const target=[light.target.x,light.target.y,light.target.z??0];
 if(dot(normal,origin.map((v,i)=>v-target[i]))<0)normal=normal.map(v=>-v);
 const slope=radius*1.4/Math.max(.01,length),roomReach=Math.hypot(...upper.map((v,i)=>Math.max(Math.abs(v-origin[i]),Math.abs(lower[i]-origin[i]))));
 const incidence=Math.abs(dot(axis,normal)),radialNormal=Math.sqrt(Math.max(0,1-incidence*incidence));
 const reach=incidence>slope*radialNormal+.0001?Math.min(roomReach,distance*incidence/(incidence-slope*radialNormal)+.01):roomReach;
 return {origin,axis,slope,reach,lower,upper,data:new Float32Array([...origin,slope,...axis,reach,...normal,-dot(normal,target),...lower,0,...upper,0])};
}
export const volumeGLSL=`
uniform vec4 beamData[5];
vec2 halfSpace(vec2 span,float origin,float direction){
 if(abs(direction)<.000001){if(origin<0.0)return vec2(1.0,0.0);return span;}
 float t=-origin/direction;
 if(direction>0.0)span.x=max(span.x,t);else span.y=min(span.y,t);return span;
}
float volumeLight(vec3 eyePosition,vec3 direction,float limit){
 vec3 origin=beamData[0].xyz,axis=beamData[1].xyz,relative=eyePosition-origin;
 float slope=beamData[0].w,z=dot(relative,axis),dz=dot(direction,axis);
 vec2 span=vec2(.08,limit);
 for(int k=0;k<3;k++){
  span=halfSpace(span,eyePosition[k]-beamData[3][k],direction[k]);
  span=halfSpace(span,beamData[4][k]-eyePosition[k],-direction[k]);
 }
 span=halfSpace(span,z,dz);span=halfSpace(span,beamData[1].w-z,-dz);
 span=halfSpace(span,dot(beamData[2].xyz,eyePosition)+beamData[2].w,dot(beamData[2].xyz,direction));
 float cone=1.0+slope*slope;
 float a=1.0-cone*dz*dz,b=2.0*(dot(relative,direction)-cone*z*dz),c=dot(relative,relative)-cone*z*z;
 if(abs(a)<.000001){span=halfSpace(span,-c,-b);}
 else{
  float discriminant=b*b-4.0*a*c;
  if(discriminant<0.0){if(a>0.0)return 0.0;}
  else{
   float root=sqrt(discriminant),r1=(-b-root)/(2.0*a),r2=(-b+root)/(2.0*a),lo=min(r1,r2),hi=max(r1,r2);
   if(a>0.0){span.x=max(span.x,lo);span.y=min(span.y,hi);}
   else if(span.x<lo){span.y=min(span.y,lo);}else{span.x=max(span.x,hi);}
  }
 }
 if(span.y<=span.x)return 0.0;
 float stepSize=(span.y-span.x)/8.0,total=0.0;
 for(int j=0;j<8;j++){
  vec3 p=relative+direction*(span.x+(float(j)+.5)*stepSize);float depth=dot(p,axis),width=max(.001,slope*depth);
  float radial=length(p-axis*depth)/width;
  float profile=max(0.0,exp(-4.0*radial*radial)-exp(-4.0));
  total+=profile/(.12+depth*depth*.035);
 }
 // Bounded single scattering: more illuminated haze along the view is brighter.
 float phase=.65+.35*pow(max(0.0,dot(axis,-direction)),2.0);
 return 1.0-exp(-total*stepSize*.24*phase);
}
`;
export const volumeWGSL=`
struct Beam {data:array<vec4f,5>};
@group(0) @binding(1) var<uniform> beam:Beam;
fn halfSpace(input:vec2f,origin:f32,direction:f32)->vec2f {
 var span=input;
 if(abs(direction)<.000001){if(origin<0.0){return vec2f(1.0,0.0);}return span;}
 let t=-origin/direction;
 if(direction>0.0){span.x=max(span.x,t);}else{span.y=min(span.y,t);}return span;
}
fn volumeLight(eyePosition:vec3f,direction:vec3f)->f32 {
 let origin=beam.data[0].xyz;let axis=beam.data[1].xyz;let relative=eyePosition-origin;
 let slope=beam.data[0].w;let z=dot(relative,axis);let dz=dot(direction,axis);
 var span=vec2f(.08,1000.0);
 for(var k=0;k<3;k++){
  span=halfSpace(span,eyePosition[k]-beam.data[3][k],direction[k]);
  span=halfSpace(span,beam.data[4][k]-eyePosition[k],-direction[k]);
 }
 span=halfSpace(span,z,dz);span=halfSpace(span,beam.data[1].w-z,-dz);
 span=halfSpace(span,dot(beam.data[2].xyz,eyePosition)+beam.data[2].w,dot(beam.data[2].xyz,direction));
 let cone=1.0+slope*slope;
 let a=1.0-cone*dz*dz;let b=2.0*(dot(relative,direction)-cone*z*dz);let c=dot(relative,relative)-cone*z*z;
 if(abs(a)<.000001){span=halfSpace(span,-c,-b);}
 else{
  let discriminant=b*b-4.0*a*c;
  if(discriminant<0.0){if(a>0.0){return 0.0;}}
  else{
   let root=sqrt(discriminant);let r1=(-b-root)/(2.0*a);let r2=(-b+root)/(2.0*a);let lo=min(r1,r2);let hi=max(r1,r2);
   if(a>0.0){span.x=max(span.x,lo);span.y=min(span.y,hi);}
   else if(span.x<lo){span.y=min(span.y,lo);}else{span.x=max(span.x,hi);}
  }
 }
 if(span.y<=span.x){return 0.0;}
 let stepSize=(span.y-span.x)/8.0;var total=0.0;
 for(var j=0;j<8;j++){
  let p=relative+direction*(span.x+(f32(j)+.5)*stepSize);let depth=dot(p,axis);let width=max(.001,slope*depth);
  let radial=length(p-axis*depth)/width;
  let profile=max(0.0,exp(-4.0*radial*radial)-exp(-4.0));
  total+=profile/(.12+depth*depth*.035);
 }
 let phase=.65+.35*pow(max(0.0,dot(axis,-direction)),2.0);
 return 1.0-exp(-total*stepSize*.24*phase);
}
`;
// CPU equivalent for the bounded-resolution Canvas fallback and numeric tests.
export function sampleBeamVolume(data,eye,direction,samples=8){
 const [ex,ey,ez]=eye,[dx,dy,dz]=direction;
 const x=ex-data[0],y=ey-data[1],z=ez-data[2],ax=data[4],ay=data[5],az=data[6],slope=data[3];
 const depth=x*ax+y*ay+z*az,along=dx*ax+dy*ay+dz*az;
 let lo=.08,hi=1000;
 const half=(p,d)=>{if(Math.abs(d)<1e-6){if(p<0)hi=-1;}else if(d>0)lo=Math.max(lo,-p/d);else hi=Math.min(hi,-p/d);};
 for(let k=0;k<3;k++){half(eye[k]-data[12+k],direction[k]);half(data[16+k]-eye[k],-direction[k]);}
 half(depth,along);half(data[7]-depth,-along);
 half(data[8]*ex+data[9]*ey+data[10]*ez+data[11],data[8]*dx+data[9]*dy+data[10]*dz);
 const cone=1+slope*slope,a=1-cone*along*along,b=2*(x*dx+y*dy+z*dz-cone*depth*along),c=x*x+y*y+z*z-cone*depth*depth;
 if(Math.abs(a)<1e-6)half(-c,-b);
 else{
  const disc=b*b-4*a*c;
  if(disc<0){if(a>0)return 0;}
  else{const root=Math.sqrt(disc),r1=(-b-root)/(2*a),r2=(-b+root)/(2*a),entry=Math.min(r1,r2),exit=Math.max(r1,r2);
   if(a>0){lo=Math.max(lo,entry);hi=Math.min(hi,exit);}else if(lo<entry)hi=Math.min(hi,entry);else lo=Math.max(lo,exit);
  }
 }
 if(hi<=lo)return 0;
 const step=(hi-lo)/samples;let total=0;
 for(let j=0;j<samples;j++){
  const t=lo+(j+.5)*step,px=x+dx*t,py=y+dy*t,pz=z+dz*t,h=px*ax+py*ay+pz*az,w=Math.max(.001,slope*h);
  const rx=px-ax*h,ry=py-ay*h,rz=pz-az*h,r2=(rx*rx+ry*ry+rz*rz)/(w*w);
  total+=Math.max(0,Math.exp(-4*r2)-Math.exp(-4))/(.12+h*h*.035);
 }
 return 1-Math.exp(-total*step*.24*(.65+.35*Math.max(0,-along)**2));
}
export function volumeCorners(volume){
 const a=volume.axis,reference=Math.abs(a[2])<.9?[0,0,1]:[0,1,0];
 const u=[a[1]*reference[2]-a[2]*reference[1],a[2]*reference[0]-a[0]*reference[2],a[0]*reference[1]-a[1]*reference[0]],norm=Math.hypot(...u);
 for(let i=0;i<3;i++)u[i]/=norm;
 const v=[a[1]*u[2]-a[2]*u[1],a[2]*u[0]-a[0]*u[2],a[0]*u[1]-a[1]*u[0]];
 const tip=volume.origin.map((n,i)=>n+a[i]*volume.reach),r=volume.slope*volume.reach/Math.cos(Math.PI/16);
 return [volume.origin,...Array.from({length:16},(_,i)=>tip.map((n,k)=>n+r*(u[k]*Math.cos(i*Math.PI/8)+v[k]*Math.sin(i*Math.PI/8))))];
}
