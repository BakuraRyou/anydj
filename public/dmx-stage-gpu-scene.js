import {createBeamSurfaceCache} from './dmx-light-geometry.js';
import {beamVolume,volumeCorners,beamScreenBounds} from './dmx-beam-volume.js';
import {drawStageGeometry,stageCamera,lensHaloScale,previewLightExposure} from './dmx-stage-3d-renderer.js';
import {environmentColor,sceneEnvironmentBrightness} from './dmx-room-style.js';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const offset=(p,v,s)=>p.map((n,i)=>n+v[i]*s);
const zeroUV=[0,0];
// A reusable interleaved stream: position, RGBA, projective UVW, effect kind.
// Geometry stays shared with Canvas/XR; projection and soft effects run on the GPU.
export function createStageGpuScene(){
  const surfaces=createBeamSurfaceCache();
  let data=new Float32Array(65536),length=0;
  const colors=new Map(),cameraData=new Float32Array(16),batches=[];
  const color=value=>{
    if(colors.has(value))return colors.get(value);
    const rgb=value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255):(value.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(v=>Number(v)/255);
    if(colors.size>=512)colors.clear();colors.set(value,rgb);return rgb;
  };
  function reserve(size){
    if(size<=data.length)return;
    let capacity=data.length;while(capacity<size)capacity*=2;
    const next=new Float32Array(capacity);next.set(data);data=next;
  }
  function vertex(p,rgb,alpha,uv,kind){
    data[length++]=p[0];data[length++]=p[1];data[length++]=p[2];
    data[length++]=rgb[0];data[length++]=rgb[1];data[length++]=rgb[2];data[length++]=alpha;
    data[length++]=uv[0];data[length++]=uv[1];data[length++]=uv[2]??1;data[length++]=kind;
  }
  function emit(points,fill,alpha,kind,uv,mode,volume=null){
    const first=length/11,rgb=color(fill);
    const count=mode==='lines'?(points.length===2?2:points.length*2):Math.max(0,points.length-2)*3;
    reserve(length+count*11);
    if(mode==='lines')for(let i=0;i<(points.length===2?1:points.length);i++){
      vertex(points[i],rgb,alpha,zeroUV,0);vertex(points[(i+1)%points.length],rgb,alpha,zeroUV,0);
    }else if(points.length>=3){
      vertex(points[0],rgb,alpha,uv?.[0]||zeroUV,kind);
      vertex(points[1],rgb,alpha,uv?.[1]||zeroUV,kind);
      vertex(points[2],rgb,alpha,uv?.[2]||zeroUV,kind);
      for(let i=3;i<points.length;i++){
        // A triangle fan repeats its first and previous corner verbatim.
        data.copyWithin(length,first*11,first*11+11);length+=11;
        data.copyWithin(length,length-22,length-11);length+=11;
        vertex(points[i],rgb,alpha,uv?.[i]||zeroUV,kind);
      }
    }
    if(!count)return;
    const previous=batches.at(-1);
    if(previous?.mode===mode&&!volume&&!previous.volume)previous.count+=count;else batches.push({first,count,mode,volume});
  }
  return {build(width,height,layout,lights,camera,crowd=[],time=0){
    length=0;batches.length=0;surfaces.begin(layout);
    const project=stageCamera(layout,camera,width,height),eye=project.eye;
    const forward=[-Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch)];
    const right=unit(cross(forward,[0,0,1])),up=cross(right,forward);
    const focal=camera.mode==='dancer'?width/(2*Math.tan(Math.PI/5)):Math.min(width,height)*1.2;
    cameraData.set([...eye,layout.hazeDetail===false?0:1,...right,2*focal/width,...up,2*focal/height,...forward,.08]);
    const ambient=sceneEnvironmentBrightness(layout),queue=[];
    // The background uses clip-space vertices; all scene vertices use world space.
    const bg=color(environmentColor('#080e19',ambient)),bottom=color(environmentColor('#192a3b',ambient));
    const first=length/11;
    for(const i of [0,1,2,0,2,3])vertex([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]][i],i<2?bottom:bg,1,[0,0],3);
    batches.push({first,count:6,mode:'normal'});
    function polygon(points,fill,alpha=1,stroke=null,lineWidth=.7,emissive=false,kind=0,uv=null){
      if(points.length<2||alpha<=0)return;
      queue.push({points,fill,alpha,stroke,emissive,kind,uv,depth:points.reduce((n,p)=>n+project.depth(p),0)/points.length});
    }
    function paint(){
      queue.sort((a,b)=>b.depth-a.depth);
      for(const p of queue){
        if(p.fill)emit(p.points,p.fill,p.alpha,p.kind,p.uv,p.emissive?'add':'normal',p.volume);
        if(p.stroke)emit(p.points,p.stroke,p.alpha,0,null,'lines');
      }queue.length=0;
    }
    drawStageGeometry(layout,lights,crowd,time,{polygon,paint,eye,projectSurfaces:(...args)=>surfaces.project(...args),
      fixtureDetail:(light,p)=>focal*.35/Math.max(.08,project.depth(p))>=14,
      surfacePatch(patch,tint,strength){polygon(patch.points,tint,Math.min(1,strength)*(patch.attenuation??1),null,.7,true,7,patch.uv);},
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
      beam(start,end,radius,tint,power,ray){
        const volume=beamVolume(ray,layout);if(!volume)return true;
        // A conservative screen rectangle only schedules fragments. It does
        // not define beam shape: every fragment intersects the actual cone.
        const bounds=beamScreenBounds(volumeCorners(volume),{eye,right,up,forward,scaleX:2*focal/width,scaleY:2*focal/height,padX:2/width,padY:2/height});
        if(!bounds)return true;
        const [left,bottomEdge,rightEdge,top]=bounds;
        const points=[[left,bottomEdge],[rightEdge,bottomEdge],[rightEdge,top],[left,top]].map(([x,y])=>eye.map((v,i)=>v+forward[i]+right[i]*x*width/(2*focal)+up[i]*y*height/(2*focal)));
        queue.push({points,fill:tint,alpha:previewLightExposure(power),stroke:null,emissive:true,kind:8,uv:null,volume:volume.data,depth:(project.depth(start)+project.depth(end))/2});return true;
      },
      lens(center,radius,tint,power){
        const depth=project.depth(center);if(power<=0||depth<=.08)return;
        const r=lensHaloScale*Math.min(24,Math.max(2,Math.min(width,height)*1.2*radius/depth))*depth/focal;
        const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>offset(offset(center,right,x*r),up,y*r));
        polygon(points,tint,previewLightExposure(power),null,.7,true,2,[[-1,-1],[1,-1],[1,1],[-1,1]]);
      }
    });
    // Use installed optical capacity, not momentary dimmer values, so a drop
    // never reallocates the haze target or changes its resolution on the beat.
    const capacity=lights.reduce((n,l)=>n+(['moving','spot','bar'].includes(l.type)?(l.prism===3?3:1)*(l.gobo==='triad'?3:1):0),0);
    const volumeScale=capacity>96?1/3:capacity>32?.5:1;
    return {vertices:data.subarray(0,length),camera:cameraData,batches,volumeScale};
  }};
}
