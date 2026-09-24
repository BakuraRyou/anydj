import {validateRoomMesh,surfaceTriangles} from './dmx-room-mesh.js';
import {zoneLights} from './dmx-zone-plan.js';
import {createZoneMotion,blockedSegment,zoneObstacles} from './dmx-zone-motion.js';
import {roomStyleId,environmentBrightness} from './dmx-room-style.js';
// Portable room plans use metres: x across the room, y towards the back, z up.
// Headset anchors and XR reference-space coordinates deliberately stay on the headset.
export const roomId=()=>globalThis.crypto?.randomUUID?.()||'room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
export const area = points => points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;

export function insideRoom(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const cross = (point[0] - a[0]) * dy - (point[1] - a[1]) * dx;
    if (Math.abs(cross) < 1e-7 && point[0] >= Math.min(a[0], b[0]) - 1e-7 && point[0] <= Math.max(a[0], b[0]) + 1e-7 && point[1] >= Math.min(a[1], b[1]) - 1e-7 && point[1] <= Math.max(a[1], b[1]) + 1e-7) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < dx * (point[1] - a[1]) / dy + a[0]) inside = !inside;
  }
  return inside;
}

export function roomFixtureRotation(position,target=position.target){
  if(!target||['stand','truss'].includes(position.type))return position.rotation||0;
  const dx=target.x-position.x,dy=position.y-target.y;
  return Math.hypot(dx,dy)<1e-7?position.rotation||0:(Math.atan2(dx,dy)*180/Math.PI+360)%360;
}

export function validateRoomPlan(value) {
  const fail = () => { throw Error('Ungültiger Raumplan: Maße, Grundriss und Gerätepositionen prüfen.'); };
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !/^[\w-]{1,80}$/.test(value.id) || typeof value.name !== 'string' || value.name.length > 80) fail();
  const {width, depth, height, boundary} = value;
  if (!finite(width, .5, 60) || !finite(depth, .5, 60) || !finite(height, .5, 15) || !Array.isArray(boundary) || boundary.length < 3 || boundary.length > 128) fail();
  if (boundary.some(p => !Array.isArray(p) || p.length !== 2 || !finite(p[0], -width / 2 - .001, width / 2 + .001) || !finite(p[1], -.001, depth + .001)) || Math.abs(area(boundary)) < .1) fail();
  // Reject crossing edges. Concave but simple floor plans are supported.
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for (let i=0;i<boundary.length;i++) for(let j=i+2;j<boundary.length;j++) {
    if(i===0 && j===boundary.length-1) continue;
    const a=boundary[i],b=boundary[(i+1)%boundary.length],c=boundary[j],d=boundary[(j+1)%boundary.length];
    if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) fail();
  }
  if(boundary.some((p,i)=>boundary.some((q,j)=>i!==j&&Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6))) fail();
  triangulateFloor(boundary);
  const positions = Object.create(null);
  if (!value.positions || typeof value.positions !== 'object' || Array.isArray(value.positions) || Object.keys(value.positions).length > 512) fail();
  for (const [id,p] of Object.entries(value.positions)) {
    if (!id || id.length > 100 || ['__proto__','constructor','prototype'].includes(id) || !p || !finite(p.x,-30,30) || !finite(p.y,0,60) || !finite(p.height,0,height) || !finite(p.rotation,-360,360) || !insideRoom([p.x,p.y],boundary)) fail();
    if (!['width','depth','height'].every(k=>finite(p.size?.[k],.01,12))) fail();
    if(p.target&&(!finite(p.target.x,-width/2,width/2)||!finite(p.target.y,0,depth)||!insideRoom([p.target.x,p.target.y],boundary)))fail();
    if(p.wallTarget&&(!Number.isInteger(p.wallTarget.wall)||p.wallTarget.wall<0||p.wallTarget.wall>=boundary.length||!finite(p.wallTarget.start,0,1)||!finite(p.wallTarget.end,0,1)||p.wallTarget.end-p.wallTarget.start<.02||!finite(p.wallTarget.minHeight,0,height)||!finite(p.wallTarget.maxHeight,0,height)||p.wallTarget.maxHeight-p.wallTarget.minHeight<.1))throw Error('Wandbereich und Höhen müssen innerhalb des Raums liegen.');
    if(p.motionArea&&(!finite(p.motionArea.x,0,1)||!finite(p.motionArea.y,0,1)||!finite(p.motionArea.width,.02,1)||!finite(p.motionArea.depth,.02,1)||p.motionArea.x+p.motionArea.width>1.000001||p.motionArea.y+p.motionArea.depth>1.000001))fail();
    if(p.motionArea){const a=p.motionArea,left=(a.x-.5)*width,right=(a.x+a.width-.5)*width,front=a.y*depth,back=(a.y+a.depth)*depth;if([[left,front],[right,front],[right,back],[left,back],[(left+right)/2,(front+back)/2]].some(q=>!insideRoom(q,boundary)))throw Error('Der Bewegungsbereich muss innerhalb der Raumfläche liegen.');
      for(let i=0;i<boundary.length;i++){const p=boundary[i],q=boundary[(i+1)%boundary.length];let low=0,high=1;for(const [axis,min,max] of [[0,left+1e-7,right-1e-7],[1,front+1e-7,back-1e-7]]){const d=q[axis]-p[axis];if(Math.abs(d)<1e-9){if(p[axis]<=min||p[axis]>=max){high=-1;break;}}else{const t1=(min-p[axis])/d,t2=(max-p[axis])/d;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}}if(high>low)throw Error('Der Bewegungsbereich darf keine Aussparung oder Wand im Grundriss kreuzen.');}
    }
    positions[id] = {...(p.wallTarget?{wallTarget:{wall:p.wallTarget.wall,start:p.wallTarget.start,end:p.wallTarget.end,minHeight:p.wallTarget.minHeight,maxHeight:p.wallTarget.maxHeight}}:{}),...(typeof p.name==='string'?{name:p.name.trim().slice(0,60)}:{}),...(typeof p.type==='string'?{type:p.type.slice(0,30)}:{}),...(p.target?{target:{x:p.target.x,y:p.target.y}}:{}),...(p.motionArea?{motionArea:{x:p.motionArea.x,y:p.motionArea.y,width:p.motionArea.width,depth:p.motionArea.depth}}:{}),x:p.x,y:p.y,height:p.height,rotation:p.type==='moving'?p.rotation:roomFixtureRotation(p),size:{width:p.size.width,depth:p.size.depth,height:p.size.height}};
  }
  const surfaces = [];
  if (!Array.isArray(value.surfaces) || value.surfaces.length > 128) fail();
  for (const surface of value.surfaces) {
    if (!surface || !Array.isArray(surface.points) || surface.points.length < 3 || surface.points.length > 128 || surface.points.some(p=>!Array.isArray(p)||p.length!==3||p.some(n=>!finite(n,-100,100)))) fail();
    surfaceTriangles(surface.points);
    surfaces.push({kind:['floor','wall','surface'].includes(surface.kind)?surface.kind:'surface',points:surface.points.map(p=>[...p])});
  }
  const result={version:1,id:value.id,name:value.name.trim()||'Mein Raum',width,depth,height,boundary:boundary.map(p=>[...p]),surfaces,positions,style:roomStyleId(value.style),environmentBrightness:environmentBrightness(value.environmentBrightness)};
  if(value.mesh!==undefined){result.mesh=validateRoomMesh(value.mesh);if(result.mesh.vertices.some(p=>Math.abs(p[0])>width/2+.001||p[1]<-.001||p[1]>depth+.001||p[2]<-.001||p[2]>height+.001))fail();}
  result.representation=value.representation==='model'&&result.mesh?'model':value.representation==='style'?'style':surfaces.length?'scan':result.mesh?'model':'style';
  if(value.zones!==undefined){
    if(!Array.isArray(value.zones)||value.zones.length>24)fail();
    const ids=new Set();result.zones=value.zones.map(z=>{
      if(!z||typeof z.id!=='string'||!/^[\w-]{1,80}$/.test(z.id)||ids.has(z.id)||typeof z.name!=='string'||z.name.length>60||!finite(z.width,.02,1)||!finite(z.depth,.02,1)||!finite(z.x,0,1-z.width+1e-9)||!finite(z.y,0,1-z.depth+1e-9))fail();
      ids.add(z.id);return {id:z.id,name:z.name,x:z.x,y:z.y,width:z.width,depth:z.depth};
    });
  }
  if(new TextEncoder().encode(JSON.stringify(result)).length>256000)throw Error('Raumplan zu groß (maximal 256 KB). Bitte das Modell vor dem Import vereinfachen.');
  return result;
}

export function newRoomPlan(width=8,depth=6,height=3) {
  return validateRoomPlan({version:1,id:roomId(),name:'Mein Raum',width,depth,height,boundary:[[-width/2,0],[width/2,0],[width/2,depth],[-width/2,depth]],surfaces:[],positions:{}});
}

export function roomPlanLayout(plan) {
  return {width:plan.width,depth:plan.depth,height:plan.height,room:true,lightMin:0,positions:plan.positions,roomPlan:plan,zones:plan.zones||[]};
}

export function roomFixtureTarget(plan,id,lights=[]){
  const p=plan.positions[id];if(p.target)return {...p.target};
  const live=lights.find(light=>light.id===id)?.target;
  if(live&&insideRoom([live.x,live.y],plan.boundary))return {x:live.x,y:live.y};
  const candidates=triangulateFloor(plan.boundary).map(t=>({x:t.reduce((n,v)=>n+v[0],0)/3,y:t.reduce((n,v)=>n+v[1],0)/3}));
  return candidates.sort((a,b)=>Math.hypot(b.x-p.x,b.y-p.y)-Math.hypot(a.x-p.x,a.y-p.y))[0];
}

export function applyRoomPlan(scene, plan, ar=false) {
  if (!scene || !plan) return scene;
  plan={...plan,positions:Object.fromEntries(Object.entries(plan.positions).map(([id,p])=>{if(p.type==='moving'||!p.target&&!['spot','bar'].includes(p.type))return [id,p];const target=roomFixtureTarget(plan,id,scene.lights);return [id,{...p,target,rotation:roomFixtureRotation(p,target)}];}))};
  // Planned fixtures are virtual preview devices. Reuse current show frames by
  // fixture type; never invent brightness or change the hardware inventory.
  const frames=[...scene.lights],groups=new Map(),assigned=new Map();
  for(const light of scene.lights){if(!groups.has(light.id))groups.set(light.id,[]);groups.get(light.id).push(light);}
  const available=[...groups.values()].filter(cells=>!['stand','truss'].includes(cells[0].type));
  for(const [id,p] of Object.entries(plan.positions)){
    if(groups.has(id)||!['moving','spot','bar'].includes(p.type))continue;
    const sameType=available.filter(cells=>cells[0].type===p.type),pool=sameType.length?sameType:available;
    if(!pool.length)continue;
    const index=assigned.get(p.type)||0;assigned.set(p.type,index+1);
    for(const light of pool[index%pool.length])frames.push({...light,id,type:p.type});
  }
  const centers=new Map();
  for(const light of frames){const p=centers.get(light.id)||{x:0,y:0,count:0};p.x+=light.position.x;p.y+=light.position.y;p.count++;centers.set(light.id,p);}
  const lights = frames.filter(l=>plan.positions[l.id]).map(light=>{
    const p=plan.positions[light.id],center=centers.get(light.id),source=scene.layout.positions?.[light.id]||{x:center.x/center.count,y:center.y/center.count};
    const dx=light.position.x-source.x,dy=light.position.y-source.y,a=p.rotation*Math.PI/180;
    let target=p.target?{...p.target}:{...light.target};
    if(light.type==='moving'){
      const range=p.motionArea||{x:0,y:0,width:1,depth:1};
      const nx=Math.max(0,Math.min(1,Number.isFinite(light.motionUV?.x)?light.motionUV.x:light.target.x/(scene.layout.width*.9)+.5));
      const ny=Math.max(0,Math.min(1,Number.isFinite(light.motionUV?.y)?light.motionUV.y:(light.target.y/scene.layout.depth-.1)/.65));
      target={x:(range.x+range.width*nx-.5)*plan.width,y:(range.y+range.depth*ny)*plan.depth};
      if(!insideRoom([target.x,target.y],plan.boundary)){
        // Retain the nearest valid destination for concave floor plans.
        const candidates=triangulateFloor(plan.boundary).map(t=>({x:t.reduce((n,v)=>n+v[0],0)/3,y:t.reduce((n,v)=>n+v[1],0)/3}));
        const anchor=candidates.sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
        if(anchor){let low=0,high=1;for(let i=0;i<20;i++){const t=(low+high)/2;if(insideRoom([anchor.x+(target.x-anchor.x)*t,anchor.y+(target.y-anchor.y)*t],plan.boundary))low=t;else high=t;}target={x:anchor.x+(target.x-anchor.x)*low,y:anchor.y+(target.y-anchor.y)*low};}
      }
    }

    return {...light,...(light.type==='moving'&&p.motionArea?{motionBounds:{left:(p.motionArea.x-.5)*plan.width,right:(p.motionArea.x+p.motionArea.width-.5)*plan.width,bottom:p.motionArea.y*plan.depth,top:(p.motionArea.y+p.motionArea.depth)*plan.depth}}:{}),aimed:light.type==='moving'||!!p.target,target,aimRotation:light.type==='moving'||p.target?roomFixtureRotation(p,target):p.rotation,position:{...p,x:p.x+dx*Math.cos(a)-dy*Math.sin(a),y:p.y+dx*Math.sin(a)+dy*Math.cos(a)},modelSize:p.size,rotation:p.rotation};
  });
  for(const [id,p] of Object.entries(plan.positions))if(!centers.has(id))lights.push({id,type:p.type||'spot',aimed:!!p.target,position:p,target:roomFixtureTarget(plan,id),color:'#7595a4',power:0,modelSize:p.size,rotation:p.rotation});
  return {...scene,layout:{...roomPlanLayout(plan),ar},lights,crowd:ar?[]:scene.crowd};
}

// Apply exclusion zones after room placement, so both geometry and targets use room coordinates.
export function createRoomPreview(){
  const motion=createZoneMotion();let room='';
  return (scene,plan,ar=false,now=performance.now()/1000)=>{
    if(!scene||!plan)return scene;
    if(room!==plan.id){motion.reset();room=plan.id;}
    const result=applyRoomPlan(scene,plan,ar),settings={zones:plan.zones||[],aims:{}};
    result.lights=motion.update(zoneLights(result.lights,result.layout,settings),result.layout,settings,now).map(light=>wallChoreography(light,plan)).map(light=>({...light,aimRotation:roomFixtureRotation(light.position,light.target)}));
    return result;
  };
}

export function xrToRoom(point,origin) {
  const c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
  return [origin.x+c*point[0]+s*point[2],origin.y+s*point[0]-c*point[2],point[1]+(origin.floorOffset||0)];
}
export function alignedOrigin(plan, left, right) {
  const length=Math.hypot(right[0]-left[0],right[2]-left[2]);
  if(length<.25) throw Error('Die beiden Bezugspunkte müssen mindestens 25 cm auseinander liegen.');
  const yaw=Math.atan2(right[2]-left[2],right[0]-left[0]),c=Math.cos(yaw),s=Math.sin(yaw);
  return {x:-plan.width/2-c*left[0]-s*left[2],y:-s*left[0]+c*left[2],yaw,floorOffset:-left[1],eyeHeight:1.7};
}

// XR outlines may explicitly repeat their first vertex to close the loop.
// Remove only adjacent repetitions and the closing vertex, not interior duplicates.
function captureVertices(points) {
  const same=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6;
  const result=points.filter((p,i)=>i===0||!same(p,points[i-1]));
  if(result.length>1&&same(result[0],result.at(-1)))result.pop();
  return result;
}

export function roomFromFloor(points, surfaces=[], previous=null) {
  points=captureVertices(points);
  if(points.length<3) throw Error('Mindestens drei Bodenpunkte markieren.');
  const yaw=Math.atan2(points[1][2]-points[0][2],points[1][0]-points[0][0]),c=Math.cos(yaw),s=Math.sin(yaw);
  const flat=points.map(p=>[c*p[0]+s*p[2],s*p[0]-c*p[2]]),xs=flat.map(p=>p[0]),ys=flat.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),floor=points.reduce((n,p)=>n+p[1],0)/points.length;
  const width=maxX-minX,depth=maxY-minY,origin={x:-(minX+maxX)/2,y:-minY,yaw,floorOffset:-floor,eyeHeight:1.7};
  const boundary=flat.map(p=>[p[0]-(minX+maxX)/2,p[1]-minY]);
  const converted=surfaces.map(s=>({kind:s.kind,points:captureVertices(s.points).map(p=>xrToRoom(p,origin))}));
  const tops=converted.filter(s=>s.kind==='wall').flatMap(s=>s.points.map(p=>p[2]));
  const height=Math.max(.5,Math.min(15,tops.length?Math.max(...tops):previous?.height||3));
  const plan=validateRoomPlan({version:1,id:roomId(),style:previous?.style,environmentBrightness:previous?.environmentBrightness,name:previous?.name?`${previous.name} · Aufnahme`.slice(0,80):'Aufgenommener Raum',width,depth,height,boundary,surfaces:converted,positions:{}});
  return {plan,origin};
}

export function floorRay(matrix, floor=0) {
  if(!matrix || Math.abs(matrix[9])<.001) return null;
  const t=(matrix[13]-floor)/matrix[9];
  return t>0 && t<30 ? [matrix[12]-matrix[8]*t,floor,matrix[14]-matrix[10]*t] : null;
}

export function detectedRoomSurfaces(frame, reference) {
  const result=[];
  for(const plane of frame.detectedPlanes||[]) {
    if(result.length>=128) break;
    const matrix=frame.getPose(plane.planeSpace,reference)?.transform.matrix;
    if(!matrix || plane.polygon.length<3 || plane.polygon.length>129) continue;
    const points=captureVertices(Array.from(plane.polygon,p=>[matrix[0]*p.x+matrix[4]*p.y+matrix[8]*p.z+matrix[12],matrix[1]*p.x+matrix[5]*p.y+matrix[9]*p.z+matrix[13],matrix[2]*p.x+matrix[6]*p.y+matrix[10]*p.z+matrix[14]]));
    if(points.length<3||points.length>128)continue;
    result.push({kind:plane.semanticLabel==='floor'?'floor':plane.orientation==='vertical'?'wall':'surface',horizontal:plane.orientation==='horizontal',points});
  }
  return result;
}

// Ear clipping preserves concave floor plans in the WebGL renderer.
export function triangulateFloor(points) {
  const indices=points.map((_,i)=>i),triangles=[],sign=Math.sign(area(points));
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let budget=points.length*points.length;
  while(indices.length>2 && budget-->0) {
    let cut=false;
    for(let i=0;i<indices.length;i++) {
      const ids=[indices[(i+indices.length-1)%indices.length],indices[i],indices[(i+1)%indices.length]], [a,b,c]=ids.map(j=>points[j]);
      if(sign*cross(a,b,c)<=1e-9) continue;
      if(indices.some(j=>!ids.includes(j)&&sign*cross(a,b,points[j])>=0&&sign*cross(b,c,points[j])>=0&&sign*cross(c,a,points[j])>=0)) continue;
      triangles.push([a,b,c]);indices.splice(i,1);cut=true;break;
    }
    if(!cut) break;
  }
  if(indices.length>2) throw Error('Grundriss enthält überlappende oder doppelte Kanten.');
  return triangles;
}

export const deviceTypes={moving:'Moving Head',spot:'Scheinwerfer',bar:'LED-Bar',stand:'Stativ',truss:'Traverse'};
export function deviceName(id,p,index=0){return p?.name||`${deviceTypes[p?.type]||(/moving/.test(id)?'Moving Head':'Lichtgerät')} ${index+1}`;}
export function planningDevice(plan,type='moving'){
  let number=1;while(Object.values(plan.positions).some(p=>p.name===`${deviceTypes[type]||'Gerät'} ${number}`))number++;
  const size=({moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15},stand:{width:.8,depth:.8,height:2},truss:{width:2,depth:.3,height:.3}})[type]||{width:.34,depth:.34,height:.4};
  const triangle=triangulateFloor(plan.boundary)[0],center=[0,1].map(i=>triangle.reduce((n,p)=>n+p[i],0)/3);
  let point=center;
  search:for(let y=.5;y<plan.depth;y+=.6)for(let x=-plan.width/2+.5;x<plan.width/2;x+=.6){if(insideRoom([x,y],plan.boundary)&&Object.values(plan.positions).every(p=>Math.hypot(p.x-x,p.y-y)>.5)){point=[x,y];break search;}}
  return {id:'plan-'+roomId(),position:{name:`${deviceTypes[type]||'Gerät'} ${number}`,type,x:point[0],y:point[1],height:0,rotation:0,size}};
}

// Ray against each fixture's rotated bounds, in room metres. Prefer the nearest hit.
export function roomFixtureHit(matrix,origin,plan) {
  if(!matrix||!plan)return null;
  const start=xrToRoom([matrix[12],matrix[13],matrix[14]],origin);
  const end=xrToRoom([matrix[12]-matrix[8],matrix[13]-matrix[9],matrix[14]-matrix[10]],origin);
  const direction=end.map((v,i)=>v-start[i]);let best=null;
  for(const [id,p] of Object.entries(plan.positions)){
    const a=p.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=start[0]-p.x,y=start[1]-p.y;
    const local=[x*c+y*s,-x*s+y*c,start[2]-p.height];
    const ray=[direction[0]*c+direction[1]*s,-direction[0]*s+direction[1]*c,direction[2]];
    const low=[-p.size.width/2-.05,-p.size.depth/2-.05,-.05],high=[p.size.width/2+.05,p.size.depth/2+.05,p.size.height+.05];
    let near=0,far=30;
    for(let i=0;i<3;i++){
      if(Math.abs(ray[i])<1e-9){if(local[i]<low[i]||local[i]>high[i]){far=-1;break;}}
      else{const a=(low[i]-local[i])/ray[i],b=(high[i]-local[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
    }
    if(near<=far&&(!best||near<best.distance))best={id,distance:near};
  }
  return best;
}


// Analytic ray/surface intersection: one pass over the floor-plan edges, no
// shadow maps or mesh ray tracing. Routing first supplies a safe floor gesture.
export function wallChoreography(light,plan){
 const config=plan.positions[light.id]?.wallTarget;
 if(light.type!=='moving'||!config||!light.motionUV)return light;
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 const blend=smooth((light.motionUV.y-.48)/.35);
 if(blend<=0)return light;
 const a=plan.boundary[config.wall],b=plan.boundary[(config.wall+1)%plan.boundary.length];
 const u=config.start+(config.end-config.start)*(.1+.8*clamp(light.motionUV.x));
 const wall={x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,z:config.minHeight+(config.maxHeight-config.minHeight)*(.2+.8*clamp(light.motionUV.x))};
 const origin={x:light.position.x,y:light.position.y,z:light.position.height+(light.modelSize?.height||0)*.71};
 const direction={x:light.target.x+(wall.x-light.target.x)*blend-origin.x,y:light.target.y+(wall.y-light.target.y)*blend-origin.y,z:wall.z*blend-origin.z};
 let hit=direction.z<0?-origin.z/direction.z:Infinity,wallIndex=-1,wallU=0;
 for(let i=0;i<plan.boundary.length;i++){
  const p=plan.boundary[i],q=plan.boundary[(i+1)%plan.boundary.length],ex=q[0]-p[0],ey=q[1]-p[1],den=direction.x*ey-direction.y*ex;
  if(Math.abs(den)<1e-9)continue;
  const dx=p[0]-origin.x,dy=p[1]-origin.y,t=(dx*ey-dy*ex)/den,v=(dx*direction.y-dy*direction.x)/den;
  if(t>1e-7&&t<hit&&v>=0&&v<=1){hit=t;wallIndex=i;wallU=v;}
 }
 if(!Number.isFinite(hit))return {...light,power:0};
 const target={x:origin.x+direction.x*hit,y:origin.y+direction.y*hit,z:Math.max(0,origin.z+direction.z*hit)};
 let level=1;
 if(wallIndex>=0){
  level=wallIndex===config.wall?smooth((target.z-config.minHeight)/.15)*smooth((wallU-config.start)/.03)*smooth((config.end-wallU)/.03):0;
  if(target.z>config.maxHeight+1e-6)level=0;
 }
 // Ruhezonen apply to the projected path as well, including wall approaches.
 const boxes=zoneObstacles({width:plan.width,depth:plan.depth},plan.zones||[],.25);
 if(blockedSegment(light.target,target,boxes)||boxes.some(b=>target.x>b.left&&target.x<b.right&&target.y>b.bottom&&target.y<b.top))level=0;
 const bounds=light.motionBounds;
 if(wallIndex<0&&bounds&&(target.x<bounds.left||target.x>bounds.right||target.y<bounds.bottom||target.y>bounds.top))level=0;
 return {...light,target,wallIndex,power:light.power*level};
}
