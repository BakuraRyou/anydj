import {drawStageGeometry,stageCamera,beamHaloScale,lensHaloScale,previewLightExposure,previewBeamResponse} from './dmx-stage-3d-renderer.js';
import {environmentColor,sceneEnvironmentBrightness} from './dmx-room-style.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const offset=(p,v,s)=>p.map((n,i)=>n+v[i]*s);
// A reusable interleaved stream: position, RGBA, UV, effect kind.
// Geometry stays shared with Canvas/XR; projection and soft effects run on the GPU.
export function createStageGpuScene(){
  let data=new Float32Array(65536),length=0;
  const colors=new Map(),cameraData=new Float32Array(16),batches=[];
  const color=value=>{
    if(colors.has(value))return colors.get(value);
    const rgb=value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255):(value.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(v=>Number(v)/255);
    if(colors.size>=512)colors.clear();colors.set(value,rgb);return rgb;
  };
  function vertex(p,rgb,alpha,uv,kind){
    if(length+10>data.length){const next=new Float32Array(data.length*2);next.set(data);data=next;}
    data[length++]=p[0];data[length++]=p[1];data[length++]=p[2];
    data[length++]=rgb[0];data[length++]=rgb[1];data[length++]=rgb[2];data[length++]=alpha;
    data[length++]=uv[0];data[length++]=uv[1];data[length++]=kind;
  }
  function emit(points,fill,alpha,kind,uv,mode){
    const first=length/10,rgb=color(fill);
    if(mode==='lines')for(let i=0;i<(points.length===2?1:points.length);i++){
      vertex(points[i],rgb,alpha,[0,0],0);vertex(points[(i+1)%points.length],rgb,alpha,[0,0],0);
    }else for(let i=1;i<points.length-1;i++)for(const j of [0,i,i+1])vertex(points[j],rgb,alpha,uv?.[j]||[0,0],kind);
    const count=length/10-first;if(!count)return;
    const previous=batches.at(-1);
    if(previous?.mode===mode)previous.count+=count;else batches.push({first,count,mode});
  }
  return {build(width,height,layout,lights,camera,crowd=[],time=0){
    length=0;batches.length=0;
    const project=stageCamera(layout,camera,width,height),eye=project.eye;
    const forward=[-Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch)];
    const right=unit(cross(forward,[0,0,1])),up=cross(right,forward);
    const focal=camera.mode==='dancer'?width/(2*Math.tan(Math.PI/5)):Math.min(width,height)*1.2;
    cameraData.set([...eye,layout.hazeDetail===false?0:1,...right,2*focal/width,...up,2*focal/height,...forward,.08]);
    const ambient=sceneEnvironmentBrightness(layout),queue=[];
    // The background uses clip-space vertices; all scene vertices use world space.
    const bg=color(environmentColor('#080e19',ambient)),bottom=color(environmentColor('#192a3b',ambient));
    const first=length/10;
    for(const i of [0,1,2,0,2,3])vertex([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]][i],i<2?bottom:bg,1,[0,0],3);
    batches.push({first,count:6,mode:'normal'});
    function polygon(points,fill,alpha=1,stroke=null,lineWidth=.7,emissive=false,kind=0,uv=null){
      if(points.length<2||alpha<=0)return;
      queue.push({points,fill,alpha,stroke,emissive,kind,uv,depth:points.reduce((n,p)=>n+project.depth(p),0)/points.length});
    }
    function paint(){
      queue.sort((a,b)=>b.depth-a.depth);
      for(const p of queue){
        if(p.fill)emit(p.points,p.fill,p.alpha,p.kind,p.uv,p.emissive?'add':'normal');
        if(p.stroke)emit(p.points,p.stroke,p.alpha,0,null,'lines');
      }queue.length=0;
    }
    drawStageGeometry(layout,lights,crowd,time,{polygon,paint,eye,
      wallVisible:(a,b,winding)=>winding*((b[0]-a[0])*(eye[1]-a[1])-(b[1]-a[1])*(eye[0]-a[0]))>=0,
      footprint(center,radius,stretch,angle,tint,strength,faces,type){
        paint();const c=Math.cos(angle),s=Math.sin(angle);
        for(const face of faces){const points=face.map(p=>[...p,center[2]]),uv=points.map(p=>{
          const x=p[0]-center[0],y=p[1]-center[1];return [(x*c+y*s)/(radius*stretch),(-x*s+y*c)/radius];
        });emit(points,tint,Math.min(1,strength*1.5),type==='moving'?5:4,uv,'add');}
        return true;
      },
      floorSurface(faces){
        paint();for(const face of faces)emit(face.map(p=>[...p,.006]),'#ffffff',ambient/100*.012,6,null,'normal');
      },
      beam(start,end,radius,tint,power){
        const axis=sub(end,start),side=unit(cross(axis,sub(eye,start)));
        if(Math.hypot(...side)<.1)return false;
        const response=previewBeamResponse(start,end,eye,radius);
        radius*=beamHaloScale;
        const points=[offset(start,side,-radius),offset(start,side,radius),offset(end,side,radius),offset(end,side,-radius)];
        polygon(points,tint,Math.min(1,previewLightExposure(power)*response),null,.7,true,1,[[-1,0],[1,0],[1,1],[-1,1]]);return true;
      },
      lens(center,radius,tint,power){
        const depth=project.depth(center);if(power<=0||depth<=.08)return;
        const r=lensHaloScale*Math.min(24,Math.max(2,Math.min(width,height)*1.2*radius/depth))*depth/focal;
        const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>offset(offset(center,right,x*r),up,y*r));
        polygon(points,tint,previewLightExposure(power),null,.7,true,2,[[-1,-1],[1,-1],[1,1],[-1,1]]);
      }
    });
    return {vertices:data.subarray(0,length),camera:cameraData,batches};
  }};
}
