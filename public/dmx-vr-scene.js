import {drawStageGeometry,previewLightExposure} from './dmx-stage-3d-renderer.js';
import {createBeamSurfaceCache} from './dmx-light-geometry.js';
import {beamVolume,volumeCorners} from './dmx-beam-volume.js';

// Room-space geometry is built once for both eyes. Navigation only changes a
// matrix, so walking never requires transforming every vertex on the CPU.
const emptyUV=[0,0,1];
function stream(){
  return {data:new Float32Array(16384),length:0,push(p,c,a,uv=emptyUV,kind=0){
    if(this.length+11>this.data.length){const next=new Float32Array(this.data.length*2);next.set(this.data);this.data=next;}
    const i=this.length,d=this.data;d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2];d[i+3]=c[0];d[i+4]=c[1];d[i+5]=c[2];d[i+6]=a;d[i+7]=uv[0];d[i+8]=uv[1];d[i+9]=uv[2]??1;d[i+10]=kind;this.length+=11;
  }};
}
export function createVRScene(){
  const surfaces=createBeamSurfaceCache(2048),solid=stream(),lines=stream(),alpha=stream(),add=stream();
  const colors=new Map(),beams=[];
  const color=value=>{
    let rgb=colors.get(value);if(rgb)return rgb;
    rgb=value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255):(value.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number).map(v=>v/255);
    if(colors.size>=1024)colors.clear();colors.set(value,rgb);return rgb;
  };
  function polygon(points,fill,opacity=1,stroke=null,_width=1,emissive=false,uv=null,kind=0){
    if(opacity<=0)return;
    if(fill&&points.length>=3){const out=emissive?add:opacity<1?alpha:solid,rgb=color(fill);
      for(let i=1;i<points.length-1;i++){out.push(points[0],rgb,opacity,uv?.[0],kind);out.push(points[i],rgb,opacity,uv?.[i],kind);out.push(points[i+1],rgb,opacity,uv?.[i+1],kind);}
    }
    if(stroke){const rgb=color(stroke);for(let i=0;i<(points.length===2?1:points.length);i++){lines.push(points[i],rgb,1);lines.push(points[(i+1)%points.length],rgb,1);}}
  }
  return {build(scene,eye){
    for(const out of [solid,lines,alpha,add])out.length=0;beams.length=0;surfaces.begin(scene.layout);
    drawStageGeometry(scene.layout,scene.lights,scene.crowd||[],scene.motion||0,{
      polygon,eye,projectSurfaces:(...args)=>surfaces.project(...args),
      fixtureDetail:(_light,p)=>!eye||Math.hypot(p[0]-eye[0],p[1]-eye[1],p[2]-eye[2])<6,
      surfacePatch(patch,tint,strength){polygon(patch.points,tint,Math.min(1,strength)*(patch.attenuation??1),null,1,true,patch.uv,1);},
      beam(_start,_end,_radius,tint,power,ray){
        const volume=beamVolume(ray,scene.layout);
        if(volume)beams.push({volume,corners:volumeCorners(volume),color:color(tint),power:previewLightExposure(power)});
        return true;
      }
    });
    // Capacity, rather than instantaneous dimmer values, prevents reallocations
    // and changes of quality on every beat. No lights are dropped.
    const capacity=scene.lights.reduce((n,l)=>n+(['stand','truss'].includes(l.type)?0:(l.prism===3?3:1)*(l.gobo==='triad'?3:1)),0);
    return {solid,lines,alpha,add,beams,volumeScale:capacity>96?1/3:capacity>32?.5:1};
  }};
}

export function roomToXRMatrix(origin){
  const c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
  return new Float32Array([c,0,s,0,s,0,-c,0,0,1,0,0,-c*origin.x-s*origin.y,-(origin.floorOffset||0),-s*origin.x+c*origin.y,1]);
}

// Rigid inverse of the WebXR view matrix, expressed in room coordinates.
export function vrEyeBasis(eye,origin){
  const m=eye.transform.inverse.matrix,c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
  const vector=(x,y,z)=>[c*x+s*z,s*x-c*z,y];
  const right=vector(m[0],m[4],m[8]),up=vector(m[1],m[5],m[9]),back=vector(m[2],m[6],m[10]);
  const position=vector(-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]),-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]),-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14]));
  position[0]+=origin.x;position[1]+=origin.y;position[2]+=origin.floorOffset||0;
  return {position,right,up,forward:back.map(v=>-v)};
}

// Cull the effect by its entire volume, never by the fixture position. Beams
// from behind the viewer may still illuminate surfaces in front of the viewer.
export function vrBeamBounds(corners,basis,projection){
  const projected=corners.map(p=>{
    const v=p.map((n,i)=>n-basis.position[i]),dot=a=>v.reduce((n,x,i)=>n+x*a[i],0),z=dot(basis.forward);
    return {z,x:dot(basis.right)*projection[0]/z-projection[8],y:dot(basis.up)*projection[5]/z-projection[9]};
  });
  if(projected.every(p=>p.z<=.05))return null;
  if(projected.some(p=>p.z<=.05))return [-1,-1,1,1];
  const bounds=[Math.max(-1,Math.min(...projected.map(p=>p.x))),Math.max(-1,Math.min(...projected.map(p=>p.y))),Math.min(1,Math.max(...projected.map(p=>p.x))),Math.min(1,Math.max(...projected.map(p=>p.y)))];
  return bounds[0]>=bounds[2]||bounds[1]>=bounds[3]?null:bounds;
}
