import {createSurfaceLighting} from './dmx-surface-light.js';
import {surfaceTriangles} from './dmx-room-mesh.js';
import {roomStyles,roomStyleId,drawRoomMaterial,sceneEnvironmentBrightness,environmentColor} from './dmx-room-style.js';
import {triangulateFloor,insideRoom} from './dmx-ar-model.js';
// Standalone software 3D renderer. World axes: x across, y into stage, z up.
// No DOM, DMX output, music analysis or external dependencies.
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
// Clip geometry crossing the eye plane instead of dropping whole beams/floors.
export function clipNear(points,depth,near=.08){
  if(points.length===2){
    const [a,b]=points,da=depth(a),db=depth(b);
    if(da<near&&db<near)return [];
    const intersect=()=>a.map((v,i)=>v+(b[i]-v)*(near-da)/(db-da));
    return [da<near?intersect():a,db<near?intersect():b];
  }
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b);
    if(da>=near)out.push(a);
    if((da>=near)!==(db>=near))out.push(a.map((v,j)=>v+(b[j]-v)*(near-da)/(db-da)));
  }
  return out;
}
export function stageCamera(layout,camera,width,height){
  const dancer=camera.mode==='dancer';
  const center=[0,layout.depth*(layout.room?.5:.15),1],span=Math.max(layout.width,layout.depth*(layout.room?1:1.5),6,layout.height||0,...Object.values(layout.positions).map(p=>p.height*1.5));
  let distance=span*1.8/camera.zoom;
  const forward=[-Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch)];
  if(!dancer){
    const right=unit(cross(forward,[0,0,1])),up=cross(right,forward),focal=Math.min(width,height)*1.2;
    distance=0;
    const bottom=layout.room?0:-Math.max(4,layout.depth),top=Math.max(layout.height||3,...Object.values(layout.positions).map(p=>p.height));
    for(const x of [-layout.width/2,layout.width/2])for(const y of [bottom,layout.depth])for(const z of [0,top]){
      const v=add([x,y,z],mul(center,-1));
      distance=Math.max(distance,Math.abs(dot(v,right))*focal/(width*.4)-dot(v,forward),Math.abs(dot(v,up))*focal/(height*.38)-dot(v,forward));
    }
    distance=Math.max(2,distance)/camera.zoom;
  }
  const eye=dancer?[camera.x,camera.y,camera.eyeHeight]:camera.eye||add(center,mul(forward,-distance));
  const right=unit(cross(forward,[0,0,1])),up=cross(right,forward);
  const focal=dancer?width/(2*Math.tan(Math.PI/5)):Math.min(width,height)*1.2;
  const depth=p=>dot(add(p,mul(eye,-1)),forward);
  const project=p=>{const v=add(p,mul(eye,-1)),z=depth(p);return {x:width/2+dot(v,right)*focal/z,y:height/2-dot(v,up)*focal/z,depth:z};};
  project.depth=depth;project.eye=eye;
  return project;
}
// Dolly along the view direction; a world position can cross the old orbit centre.
export function moveStageCamera(layout,camera,width,height,forward,right=0,up=0){
  const eye=stageCamera(layout,camera,width,height).eye;
  const direction=[-Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch)];
  const sideways=[Math.cos(camera.yaw),Math.sin(camera.yaw),0];
  const vertical=cross(sideways,direction);
  const position=eye.map((v,i)=>v+direction[i]*forward+sideways[i]*right+vertical[i]*up);
  return camera.mode==='dancer'?{...camera,x:position[0],y:position[1],eyeHeight:position[2]}:{...camera,eye:position};
}
// Follow the audible deck, retaining it around equal crossfader weights.
// Beat positions may be numbers (demo) or interpolated beat-grid samples.
export function createCrowdMotion(){
  let source=null,lastTime=null,lastBeat=null,synced=false,transition=0;
  let motion={beat:0,energy:.7,blend:1,from:null};
  const beatValue=value=>Number.isFinite(value)?value:
    Number.isFinite(value?.index)&&Number.isFinite(value?.phase)?value.index+value.phase:null;
  return (music={},now=0)=>{
    const dt=lastTime===null?0:Math.max(0,Math.min(.1,now-lastTime));lastTime=now;
    const streams=music.streams||[];
    const candidates=streams.map((stream,index)=>({...stream,key:stream.source??stream.movingPlan??index}))
      .filter(s=>s.weight>0&&(s.playing??Boolean(s.frame)));
    candidates.sort((a,b)=>b.weight-a.weight);
    const previous=candidates.find(s=>s.key===source),leader=candidates[0];
    const selected=previous&&leader&&leader.weight-previous.weight<.08?previous:leader;
    // A loaded but paused/muted song freezes the pose. An empty show keeps its idle dance.
    if(!selected&&streams.some(s=>s.source!=null||s.movingPlan))return motion;
    const raw=beatValue(selected?.beat),hasBeat=raw!==null,key=selected?.key??'idle';
    const beat=hasBeat?raw:motion.beat+dt*2;
    const jump=hasBeat&&lastBeat!==null&&(raw-lastBeat<-.05||raw-lastBeat>Math.max(1,dt*8));
    const changed=source!==null&&(source!==key||synced!==hasBeat||jump);
    if(changed){motion={...motion,from:{beat:motion.beat,energy:motion.energy},blend:0};transition=0;}
    transition+=dt;
    const targetEnergy=({peak:1,build:.85,break:.45,intro:.55,outro:.55})[selected?.look]??.7;
    motion={beat,energy:motion.energy+(targetEnergy-motion.energy)*(1-Math.exp(-dt*4)),
      from:motion.from,blend:motion.from?Math.min(1,transition/.4):1};
    if(motion.blend===1)motion.from=null;
    source=key;lastBeat=raw;synced=hasBeat;
    return motion;
  };
}
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
function dancePose(beat,index,energy){
  const block=Math.floor(beat/16),style=((block+index)%4+4)%4;
  const amount=smooth(beat-block*16); // one beat to change style every sixteen beats
  const phase=beat*Math.PI*2,sidePhase=beat*Math.PI;
  const strength=(.75+(index%3)*.1)*energy,mirror=index%2?-1:1;
  function pose(kind){
    const bounce=(1-Math.cos(phase))*.045*strength;
    const sway=Math.sin(sidePhase)*(.045+(kind===0?.045:0))*strength*mirror;
    const hop=kind===3?Math.max(0,Math.sin(phase))*.13*strength:0;
    const point=(x,z)=>[x,0,z+hop];
    const hip=point(sway,.82-bounce),neck=point(sway*1.4,1.4-bounce);
    const joints=[hip,neck];
    for(const side of [-1,1]){
      const step=kind===0?Math.max(0,Math.sin(sidePhase)*side)*.08*strength:0;
      const knee=point(side*.2+sway*.5,.42-bounce+step);
      const foot=point(side*(.26+step*.5),step);
      const wave=Math.sin(sidePhase+side*Math.PI/2)*strength;
      const elbow=point(sway*1.4+side*.29,(kind===2?1.48:1.12)+wave*.12-bounce);
      const hand=point(sway*1.4+side*(kind===1?.42:.38),
        (kind===2?1.79:kind===3?1.52:1.32)+wave*(kind===1?.28:.1)-bounce);
      joints.push(knee,foot,elbow,hand);
    }
    joints.push(point(sway*1.4,1.59-bounce));
    return joints;
  }
  const current=pose(style),previous=pose((style+3)%4);
  return current.map((p,i)=>p.map((v,j)=>previous[i][j]+(v-previous[i][j])*amount));
}
// Normalized floor positions survive room resizing and stage/club switches.
export function stickFigureSegments(layout,person,motion=0,index=0){
  if(typeof motion==='number')motion={beat:motion,energy:.7};
  let joints=dancePose(motion.beat,index,motion.energy??.7);
  if(motion.from&&motion.blend<1){
    const previous=dancePose(motion.from.beat,index,motion.from.energy),blend=smooth(motion.blend);
    joints=joints.map((p,i)=>p.map((v,j)=>previous[i][j]+(v-previous[i][j])*blend));
  }
  const depth=layout.room?layout.depth:Math.max(4,layout.depth);
  const x=(person.x-.5)*Math.max(0,layout.width-1.2);
  const y=layout.room?.6+person.y*Math.max(0,depth-1.2):-.6-person.y*Math.max(0,depth-1.2);
  const points=joints.map(p=>[x+p[0],y+p[1],p[2]]);
  const segments=[[points[0],points[1]]];
  for(const offset of [2,6])segments.push([points[0],points[offset]],[points[offset],points[offset+1]],
    [points[1],points[offset+2]],[points[offset+2],points[offset+3]]);
  const center=points[10],head=a=>[center[0]+Math.cos(a)*.14,center[1],center[2]+Math.sin(a)*.14];
  for(let i=0;i<12;i++)segments.push([head(i*Math.PI/6),head((i+1)*Math.PI/6)]);
  return segments;
}
// Small bounded sprite cache: changing show colours must not grow GPU/bitmap memory forever.
const lightSprites=new Map();
let beamAlpha=null;
function lightSprite(kind,color){
  const key=kind+color;if(lightSprites.has(key))return lightSprites.get(key);
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(96,192):globalThis.document?.createElement('canvas');
  if(!canvas)return null;canvas.width=96;canvas.height=kind==='beam'?192:96;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  if(kind==='beam'){
    if(!beamAlpha){
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,96,192);
    const data=ctx.getImageData(0,0,96,192);
    for(let y=0;y<192;y++)for(let x=0;x<96;x++){
      const along=y/191,across=Math.abs((x-47.5)/48)/(.035+.965*along);
      data.data[(y*96+x)*4+3]=Math.round(255*Math.pow(Math.max(0,1-across*across),3)*(.32-.2*along)*Math.min(1,along*24)*Math.min(1,(1-along)*18));
    }beamAlpha=data;
    }
    ctx.putImageData(beamAlpha,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,96,192);
  }else{
    const glow=ctx.createRadialGradient(48,48,0,48,48,48);
    glow.addColorStop(0,kind==='lens'?'#ffffff':color);
    glow.addColorStop(kind==='moving'?.3:.08,color);
    glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,96,96);
  }
  if(lightSprites.size>=96)lightSprites.delete(lightSprites.keys().next().value);
  lightSprites.set(key,canvas);return canvas;
}
let floorGrain=null;
function floorTexture(){
  if(floorGrain)return floorGrain;
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(96,96):globalThis.document?.createElement('canvas');
  if(!canvas)return null;canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');
  const grain=ctx.createImageData(96,96);let seed=17;
  for(let i=0;i<96*96;i++){
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const shade=(seed>>>0)%2?210:0;
    grain.data.set([shade,shade,shade,2+(seed>>>8)%4],i*4);
  }ctx.putImageData(grain,0,0);
  return floorGrain=canvas;
}
export function lightProfile(type){
  return type==='moving'?{spread:.045,stretch:1,power:1.35}:type==='bar'?{spread:.095,stretch:1.65,power:.65}:{spread:.12,stretch:1,power:1};
}
export function renderStage3d(ctx,width,height,layout,lights,camera,crowd=[],time=0){
  const project=stageCamera(layout,camera,width,height),queue=[];
  const polygon=(points,fill,alpha=1,stroke=null,lineWidth=.7,emissive=false)=>{
    const clipped=clipNear(points,project.depth);if(clipped.length<2)return;
    const p=clipped.map(project);
    queue.push({p,fill,alpha,stroke,lineWidth,emissive,depth:p.reduce((s,v)=>s+v.depth,0)/p.length});
  };
  ctx.clearRect(0,0,width,height);
  const ambient=sceneEnvironmentBrightness(layout);
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,environmentColor('#080e19',ambient));bg.addColorStop(1,environmentColor('#192a3b',ambient));ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  drawStageGeometry(layout,lights,crowd,time,{polygon,paint,footprint,beam,lens,floorSurface,eye:project.eye,wallVisible:(a,b,winding)=>winding*((b[0]-a[0])*(project.eye[1]-a[1])-(b[1]-a[1])*(project.eye[0]-a[0]))>=0,thickness:p=>Math.max(.8,Math.min(5,height*.022/Math.max(.3,project.depth(p))))});
  const danceDepth=layout.room?0:Math.max(4,layout.depth);
  const front=project([0,-danceDepth+.4,.01]);
  if(front.depth>0){ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle=environmentColor('#b0c8d4',ambient);ctx.fillText(layout.roomPlan?layout.roomPlan.name:layout.room?'CLUB · TANZ- & LICHTFLÄCHE':'TANZFLÄCHE',front.x,front.y);}
  function footprint(center,radius,stretch,angle,color,strength,floorFaces,type){
    if(!ctx.createRadialGradient||project.depth(center)<=.08)return false;
    const c=project(center),u=project([center[0]+Math.cos(angle)*radius*stretch,center[1]+Math.sin(angle)*radius*stretch,center[2]]),v=project([center[0]-Math.sin(angle)*radius,center[1]+Math.cos(angle)*radius,center[2]]);
    if(u.depth<=.08||v.depth<=.08)return false;
    const ux=u.x-c.x,uy=u.y-c.y,vx=v.x-c.x,vy=v.y-c.y;if(Math.abs(ux*vy-uy*vx)<.01)return false;
    paint();ctx.save();ctx.beginPath();
    for(const face of floorFaces){const points=clipNear(face.map(p=>[...p,center[2]]),project.depth);if(points.length<3)continue;points.map(project).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
    ctx.clip();ctx.transform(ux,uy,vx,vy,c.x,c.y);
    const sprite=lightSprite(type,color);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,strength*1.5);
    if(sprite)ctx.drawImage(sprite,-1,-1,2,2);
    ctx.restore();return !!sprite;
  }
  function floorSurface(faces){
    const texture=floorTexture();if(!texture||!ctx.createPattern)return;
    paint();ctx.save();ctx.beginPath();
    for(const face of faces){const points=clipNear(face.map(p=>[...p,.006]),project.depth);if(points.length<3)continue;points.map(project).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
    ctx.clip();ctx.globalAlpha=ambient/100;ctx.fillStyle=ctx.createPattern(texture,'repeat');ctx.fillRect(0,0,width,height);ctx.restore();
  }
  function beam(start,end,radius,color,power){
    if(project.depth(start)<=.1||project.depth(end)<=.1)return false;
    const a=project(start),b=project(end),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if(length<2)return true;
    const edge=project(add(end,mul(unit(cross(add(end,mul(start,-1)),Math.abs(end[0]-start[0])+Math.abs(end[1]-start[1])<.001?[0,1,0]:[0,0,1])),radius)));
    const r=Math.max(1,Math.hypot(edge.x-b.x,edge.y-b.y)),sprite=lightSprite('beam',color);
    if(!sprite)return false;
    queue.push({depth:(a.depth+b.depth)/2,draw:()=>{ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,power)*.5;ctx.transform(dy/length*r,-dx/length*r,dx,dy,a.x,a.y);ctx.drawImage(sprite,-1,0,2,1);ctx.restore();}});return true;
  }
  function lens(center,radius,color,power){
    if(power<=0||project.depth(center)<=.1)return;
    const p=project(center),sprite=lightSprite('lens',color);if(!sprite)return;
    const r=Math.min(24,Math.max(2,Math.min(width,height)*1.2*radius/p.depth));
    queue.push({depth:p.depth-.001,draw:()=>{ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,power)*.65;ctx.drawImage(sprite,p.x-r,p.y-r,r*2,r*2);ctx.restore();}});
  }
  function paint(){
    queue.sort((a,b)=>b.depth-a.depth);
    for(const item of queue){if(item.draw){item.draw();continue;}ctx.beginPath();item.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(item.p.length>2)ctx.closePath();ctx.globalAlpha=item.alpha;ctx.globalCompositeOperation=item.emissive?'lighter':'source-over';if(item.fill){ctx.fillStyle=item.fill;if(item.alpha===1&&!item.stroke&&item.p.length>2){ctx.strokeStyle=item.fill;ctx.lineWidth=.65;ctx.stroke();}ctx.fill();}if(item.stroke){ctx.strokeStyle=item.stroke;ctx.lineWidth=item.lineWidth;ctx.stroke();}}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';queue.length=0;
  }
}

// Shared world geometry: desktop canvas and stereoscopic WebXR use the same scene.
export function drawStageGeometry(layout,lights,crowd,time,{polygon,paint=()=>{},thickness=()=>1,footprint=null,beam=null,lens=null,floorSurface=null,wallVisible=()=>true,eye=null}){
  const ambient=layout.ar?100:sceneEnvironmentBrightness(layout),rawPolygon=polygon,colors=new Map();
  const surfaceLight=createSurfaceLighting(layout.ar?[]:lights,ambient,[0,layout.depth/2,(layout.height||3)/2]);
  const dim=color=>{if(!color)return color;if(!colors.has(color))colors.set(color,environmentColor(color,ambient));return colors.get(color);};
  polygon=(points,fill,alpha=1,stroke=null,lineWidth=.7,emissive=false)=>rawPolygon(points,emissive?fill:fill&&points.length>=3?surfaceLight(points,fill):dim(fill),alpha,emissive?stroke:dim(stroke),lineWidth,emissive);
  const line=(a,b,color)=>polygon([a,b],null,1,color);
  const box=(p,size,rotation=0,pitch=0)=>{
    const [x,y,z]=p,[w,d,h]=size;
    const v=[[-w,-d,0],[w,-d,0],[w,d,0],[-w,d,0],[-w,-d,h*.88],[w,-d,h*.88],[w,d,h*.88],[-w,d,h*.88],[-w*.85,-d*.85,h],[w*.85,-d*.85,h],[w*.85,d*.85,h],[-w*.85,d*.85,h]].map(v=>[v[0],v[1]*Math.cos(pitch)-(v[2]-h/2)*Math.sin(pitch),v[1]*Math.sin(pitch)+(v[2]-h/2)*Math.cos(pitch)+h/2]).map(v=>add([v[0]*Math.cos(rotation)-v[1]*Math.sin(rotation),v[0]*Math.sin(rotation)+v[1]*Math.cos(rotation),v[2]],[x,y,z]));
    for(let i=0;i<4;i++)polygon([v[4+i],v[4+(i+1)%4],v[8+(i+1)%4],v[8+i]],'#394650');
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[8,9,10,11]].forEach((face,i)=>polygon(face.map(j=>v[j]),['#222b34','#303c47','#151d25','#1b252e','#46535e'][i],1,null));
  };
  const w=layout.width/2,d=layout.depth,danceDepth=layout.room?0:Math.max(4,d);
  const styleId=roomStyleId(layout.roomPlan?.style||layout.style),material=roomStyles[styleId];
  if(layout.roomPlan){
    const plan=layout.roomPlan;
    const custom=plan.representation==='model'&&plan.mesh||plan.representation==='scan'&&plan.surfaces.length;
    if(!layout.ar&&!custom)for(const triangle of triangulateFloor(plan.boundary))polygon(triangle.map(p=>[...p,0]),material.floor,1);
    paint();
    if(!layout.ar){if(custom)drawCapturedRoom(plan,material,polygon,eye);else drawRoomMaterial(plan.boundary,triangulateFloor(plan.boundary),plan.height,styleId,{polygon,wallVisible});paint();}
    plan.boundary.forEach((p,i)=>{
      const q=plan.boundary[(i+1)%plan.boundary.length];line([...p,.01],[...q,.01],layout.ar?'#8bd8cb':'#3c4b59');
      if(!layout.ar&&!custom){line([...p,0],[...p,plan.height],'#365363');line([...p,plan.height],[...q,plan.height],'#365363');}
    });

    if(layout.ar)for(const x of [-w,w]){line([x-.1,0,.02],[x+.1,0,.02],'#ffd384');line([x,-.1,.02],[x,.1,.02],'#ffd384');}
    paint();
  }else if(!layout.ar){
  if(!layout.room)polygon([[-w,-danceDepth,0],[w,-danceDepth,0],[w,0,0],[-w,0,0]],material.floor,1,'#436976');
  polygon([[-w,0,0],[w,0,0],[w,d,0],[-w,d,0]],material.floor,1,'#728e9d');
  paint();
  const boundary=[[-w,-danceDepth],[w,-danceDepth],[w,d],[-w,d]];
  drawRoomMaterial(boundary,triangulateFloor(boundary),layout.height||3,styleId,{polygon,wallVisible});
  // Draw the floor first; grid and footprints are coplanar overlays.
  paint();
  if(layout.room){
    const boundary=layout.lightMin||0;
    line([-w,boundary,.02],[w,boundary,.02],'#b8ffe6');
    for(const x of [-w,w])for(const y of [0,d])line([x,y,0],[x,y,layout.height],'#365363');
    for(const y of [0,d])line([-w,y,layout.height],[w,y,layout.height],'#365363');
    for(const x of [-w,w])line([x,0,layout.height],[x,d,layout.height],'#365363');
  }else line([-w,0,.01],[w,0,.01],'#9abec8');paint();
  }
  const ceilingBoundary=layout.roomPlan?.boundary||[[-w,-danceDepth],[w,-danceDepth],[w,d],[-w,d]],ceilingHeight=layout.height||3;
  if(!layout.ar&&eye&&eye[2]<ceilingHeight&&insideRoom([eye[0],eye[1]],ceilingBoundary)&&(!layout.roomPlan||layout.roomPlan.representation==='style')){
    for(const face of triangulateFloor(ceilingBoundary))polygon(face.map(p=>[...p,ceilingHeight]),material.wall);paint();
  }
  for(const zone of layout.ar?[]:layout.zones||[]){
    const x=(zone.x-.5)*layout.width,y=zone.y*d,x2=x+zone.width*layout.width,y2=y+zone.depth*d;
    polygon([[x,y,.025],[x2,y,.025],[x2,y2,.025],[x,y2,.025]],'#9c634c',.45,'#e6ac80');
  }
  paint();
  // Clip soft footprints to the actual floor, including concave room plans.
  const floorFaces=layout.roomPlan?triangulateFloor(layout.roomPlan.boundary):[[[-w,layout.room?(layout.lightMin||0):-danceDepth],[w,layout.room?(layout.lightMin||0):-danceDepth],[w,d],[-w,d]]];
  if(!layout.ar&&(!layout.roomPlan||layout.roomPlan.representation==='style'))floorSurface?.(layout.roomPlan?floorFaces:[[[-w,-danceDepth],[w,-danceDepth],[w,d],[-w,d]]]);
  const clipFloor=(points,boundary)=>{
    let result=points;const area=boundary.reduce((n,p,i)=>{const q=boundary[(i+1)%boundary.length];return n+p[0]*q[1]-q[0]*p[1];},0),sign=area>=0?1:-1;
    for(let i=0;i<boundary.length&&result.length;i++){
      const a=boundary[i],b=boundary[(i+1)%boundary.length],side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),next=[];
      for(let j=0;j<result.length;j++){const p=result[j],q=result[(j+1)%result.length],dp=side(p),dq=side(q);if(dp>=0)next.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push(p.map((v,k)=>v+(q[k]-v)*t));}}
      result=next;
    }return result;
  };
  for(const light of layout.ar?[]:lights){
    if(light.power<=0)continue;
    const height=light.position.height+(light.aimed&&light.modelSize?light.modelSize.height*(light.type==='moving'?.71:.5):0);
    const p=[light.position.x,light.position.y,height],t=[light.target.x,light.target.y,light.target.z||.012],length=Math.hypot(...add(t,mul(p,-1)));
    const profile=lightProfile(light.type);
    const radius=Math.min(1.8,Math.max(.12,length*profile.spread)),stretch=Math.min(3,length/Math.max(.3,height))*profile.stretch,angle=Math.atan2(t[1]-p[1],t[0]-p[0]);
    const strength=Math.min(1,light.power)*profile.power/(1+.015*length*length);
    if(light.wallIndex>=0&&layout.roomPlan){
      const boundary=layout.roomPlan.boundary,a=boundary[light.wallIndex],b=boundary[(light.wallIndex+1)%boundary.length];
      const size=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/size,uy=(b[1]-a[1])/size;
      const winding=boundary.reduce((n,v,i)=>{const q=boundary[(i+1)%boundary.length];return n+v[0]*q[1]-q[0]*v[1];},0)>=0?1:-1;
      const center=(t[0]-a[0])*ux+(t[1]-a[1])*uy,du=(t[0]-p[0])*ux+(t[1]-p[1])*uy,dz=t[2]-p[2];
      const angle=Math.atan2(dz,du),normalDistance=Math.abs((p[0]-a[0])*uy-(p[1]-a[1])*ux),elongation=Math.min(3,length/Math.max(.3,normalDistance));
      for(let layer=6;layer>=1;layer--){
        const fraction=layer/6,r=radius*fraction*1.4,alpha=strength*(.04+.45*(1-fraction));
        const ring=Array.from({length:20},(_,i)=>{const phase=i*Math.PI/10,u=Math.cos(phase)*r*elongation,v=Math.sin(phase)*r;return [center+u*Math.cos(angle)-v*Math.sin(angle),t[2]+u*Math.sin(angle)+v*Math.cos(angle)];});
        const limits=layout.roomPlan.positions[light.id]?.wallTarget,left=(limits?.start||0)*size,right=(limits?.end??1)*size,bottom=limits?.minHeight||0,top=limits?.maxHeight??layout.height;
        const clipped=clipFloor(ring,[[left,bottom],[right,bottom],[right,top],[left,top]]);
        if(clipped.length>2)polygon(clipped.map(([u,z])=>[a[0]+ux*u-uy*.006*winding,a[1]+uy*u+ux*.006*winding,z]),light.color,alpha,null,.7,true);
      }
      continue;
    }
    if(footprint?.(t,radius*1.4,stretch,angle,light.color,strength,floorFaces,light.type))continue;
    for(let layer=10;layer>=1;layer--){
      const fraction=layer/10,r=radius*fraction*1.4,alpha=strength*(.025+.32*(1-fraction));
      const ring=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,u=Math.cos(a)*r*stretch,v=Math.sin(a)*r;return [t[0]+u*Math.cos(angle)-v*Math.sin(angle),t[1]+u*Math.sin(angle)+v*Math.cos(angle),t[2]];});
      for(const face of floorFaces){const clipped=clipFloor(ring,face);if(clipped.length>2)polygon(clipped,light.color,alpha,null,.7,true);}
    }
  }
  paint();
  const bodies=new Set();
  for(const light of lights){
    const p=[light.position.x,light.position.y,light.position.height],t=[light.target.x,light.target.y,light.target.z||.025];
    // A subtle suspension line anchors fixtures in space.
    if(layout.ar||layout.selectedFixture===light.id)line([p[0],p[1],0],p,'#314858');
    if(!light.modelSize)box(add(p,[0,0,.04]),light.type==='bar'?[.12,.08,.12]:[.17,.17,.22]);
    else if(!bodies.has(light.id)){
      bodies.add(light.id);const size=light.modelSize,a=(light.rotation||0)*Math.PI/180,position=layout.positions[light.id]||light.position,base=[position.x,position.y,position.height];
      const pitch=light.aimed?Math.atan2(position.height+size.height*(light.type==='moving'?.71:.5)-t[2],Math.hypot(t[0]-base[0],t[1]-base[1])):0;
      if(light.type==='moving'){
        const headAngle=(light.aimRotation??light.rotation??0)*Math.PI/180;
        const local=(x,y,z)=>[base[0]+x*Math.cos(headAngle)-y*Math.sin(headAngle),base[1]+x*Math.sin(headAngle)+y*Math.cos(headAngle),base[2]+z];
        box(base,[size.width/2,size.depth/2,size.height*.18],a);
        for(const side of [-1,1])box(local(side*size.width*.42,0,size.height*.18),[size.width*.08,size.depth*.3,size.height*.64],headAngle);
        box(local(0,0,size.height*.42),[size.width*.3,size.depth*.42,size.height*.58],headAngle,pitch);
      }else box(base,[size.width/2,size.depth/2,size.height],a,pitch);
      const corners=[[-size.width/2,-size.depth/2],[size.width/2,-size.depth/2],[size.width/2,size.depth/2],[-size.width/2,size.depth/2]].map(([x,y])=>[base[0]+x*Math.cos(a)-y*Math.sin(a),base[1]+x*Math.sin(a)+y*Math.cos(a),.015]);
      if(layout.ar||layout.selectedFixture===light.id){corners.forEach((p,i)=>line(p,corners[(i+1)%4],layout.selectedFixture===light.id?'#ffd384':'#b8ffe6'));
      line([base[0],base[1],.02],[base[0]+Math.sin(a)*.5,base[1]-Math.cos(a)*.5,.02],'#ffd384');}
    }
    if(light.aimed&&light.modelSize)p[2]+=light.modelSize.height*(light.type==='moving'?.71:.5);
    const axis=unit(add(t,mul(p,-1))),u=unit(cross(axis,[0,1,0])),v=cross(axis,u);
    const ring=(center,r)=>Array.from({length:16},(_,i)=>add(center,add(mul(u,Math.cos(i*Math.PI/8)*r),mul(v,Math.sin(i*Math.PI/8)*r))));
    const front=add(p,mul(axis,light.aimed&&light.modelSize?light.modelSize.depth*(light.type==='moving'?.42:.5)+.01:.08));
    polygon(ring(add(front,mul(axis,-.003)),.15),'#424b54',1);
    polygon(ring(front,.135),'#0b1118',1);
    for(const sign of [-1,1])for(const side of [-1,1]){
      const center=add(front,add(mul(u,sign*.112),mul(v,side*.112))),r=.009;
      polygon([add(center,mul(u,-r)),add(center,mul(v,r)),add(center,mul(u,r)),add(center,mul(v,-r))],'#5b6269',1);
    }
    (light.power>0?rawPolygon:polygon)(ring(add(front,mul(axis,.002)),.105),light.power>0?light.color:'#25313c',Math.max(.3,light.power));
    lens?.(add(front,mul(axis,.004)),.2,light.color,light.power);
    if(light.power<=0)continue;
    const distance=Math.hypot(...add(t,mul(p,-1))),radius=Math.min(1.8,distance*lightProfile(light.type).spread);
    if(beam?.(front,t,radius,light.color,light.power))continue;
    // A faint volume suggests haze; the illuminated surface carries the light.
    for(const [scale,opacity] of [[1,.012],[.65,.016],[.3,.022]]){
      const start=ring(p,.035*scale),end=ring(t,radius*scale);
      for(let i=0;i<16;i++)polygon([start[i],start[(i+1)%16],end[(i+1)%16],end[i]],light.color,light.power*opacity,null,.7,true);
    }
  }
  // Share the fixture/beam depth queue so people belong to the scene.
  crowd.slice(0,12).forEach((person,index)=>{
    for(const segment of stickFigureSegments(layout,person,time,index)){
      const lineWidth=thickness(segment[0]);
      polygon(segment,null,1,['#b8ffe6','#ffd3a5','#c9c0ff'][index%3],lineWidth);
    }
  });
  paint();
}

const capturedFaces=new WeakMap();
function drawCapturedRoom(plan,material,polygon,eye){
  const model=plan.representation==='model',key=model?plan.mesh:plan.surfaces;
  let faces=capturedFaces.get(key);
  if(!faces){
    faces=model?plan.mesh.triangles.map((t,i)=>({points:t.map(j=>plan.mesh.vertices[j]),color:plan.mesh.colors[i]})):plan.surfaces.flatMap(surface=>surfaceTriangles(surface.points).map(points=>({points,kind:surface.kind})));
    capturedFaces.set(key,faces);
  }
  const center=[0,plan.depth/2,plan.height/2],outside=eye&&(Math.abs(eye[0])>plan.width/2||eye[1]<0||eye[1]>plan.depth||eye[2]>plan.height);
  for(const face of faces){
    const points=face.points,normal=unit(cross(add(points[1],mul(points[0],-1)),add(points[2],mul(points[0],-1))));
    // Open near exterior walls and ceilings in the desktop overview, regardless of winding.
    const midpoint=points[0].map((_,k)=>points.reduce((n,p)=>n+p[k],0)/3);
    if(outside&&midpoint[2]>.1&&dot(normal,add(eye,mul(midpoint,-1)))*dot(normal,add(center,mul(midpoint,-1)))<0)continue;
    let color=face.color||(face.kind==='floor'?material.floor:face.kind==='wall'?material.wall:material.band);
    const shade=.65+.25*Math.abs(normal[2])+.1*Math.abs(normal[0]);
    color='#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*shade).toString(16).padStart(2,'0')).join('');
    polygon(points,color);
  }
}
