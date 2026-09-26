// Shared preview optics: routing uses the same footprint as desktop and XR.
export function lightProfile(type,beamAngle,aperture=false){
  const profile=type==='moving'?{spread:.045,stretch:1,power:1.35,maxRadius:1.8,volume:1}:type==='bar'?{spread:.5,stretch:1.65,power:.65,maxRadius:8,volume:.12}:{spread:.42,stretch:1,power:1,maxRadius:8,volume:.18};
  if(Number.isFinite(beamAngle))profile.spread=Math.tan(Math.max(aperture?.1:2,Math.min(90,beamAngle))*Math.PI/360);
  return profile;
}
export function lightFootprint(light,target=light.target){
  const p=light.position||{x:target.x,y:target.y,height:0},profile=lightProfile(light.type,light.beamAngle,light.previewAperture);
  const height=light.emissionHeight??((p.height||0)+(light.aimed&&light.modelSize?light.modelSize.height*(light.type==='moving'?.71:.5):0));
  const length=Math.hypot(target.x-p.x,target.y-p.y,(target.z||.012)-height);
  const radius=Math.min(profile.maxRadius,Math.max(light.previewAperture?.02:.12,length*profile.spread));
  return {height,length,radius,stretch:Math.min(3,length/Math.max(.3,Math.abs(height-(target.z||0))))*profile.stretch,angle:Math.atan2(target.y-p.y,target.x-p.x)};
}
export function footprintClearance(light,target=light.target){
  const {radius,stretch}=lightFootprint(light,target);
  // Enclose the entire soft footprint, including its faint outer edge.
  return radius*1.4*Math.max(1,light.wallIndex>=0?3:stretch)+.05;
}
export function motionClearance(light,layout){
  if(!light.position)return .5;
  const r=light.motionBounds||{left:-layout.width/2,right:layout.width/2,bottom:layout.lightMin||0,top:layout.depth};
  return Math.max(.5,...[r.left,r.right].flatMap(x=>[r.bottom,r.top].map(y=>footprintClearance(light,{x,y}))));
}

const dot3=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub3=(a,b)=>a.map((v,i)=>v-b[i]);
const unit3=a=>{const length=Math.hypot(...a)||1;return a.map(v=>v/length);};
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function beamBoundary(layout){return layout.roomPlan?.boundary||[[-layout.width/2,layout.room?(layout.lightMin||0):-Math.max(4,layout.depth)],[layout.width/2,layout.room?(layout.lightMin||0):-Math.max(4,layout.depth)],[layout.width/2,layout.depth],[-layout.width/2,layout.depth]];}
// First physical room intersection, including concave boundaries.
export function roomBeamHit(layout,origin,direction){
  const boundary=beamBoundary(layout),height=layout.height||3;let distance=Infinity,wallIndex=-1,targetSurface='floor';
  for(const [z,surface] of [[0,'floor'],[height,'ceiling']]){
    const t=(z-origin[2])/direction[2];if(t>1e-6&&t<distance){distance=t;targetSurface=surface;}
  }
  for(let i=0;i<boundary.length;i++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length],ex=b[0]-a[0],ey=b[1]-a[1],det=direction[0]*ey-direction[1]*ex;
    if(Math.abs(det)<1e-10)continue;
    const dx=a[0]-origin[0],dy=a[1]-origin[1],t=(dx*ey-dy*ex)/det,u=(dx*direction[1]-dy*direction[0])/det,z=origin[2]+t*direction[2];
    if(t>1e-6&&t<distance&&u>=-1e-8&&u<=1+1e-8&&z>=0&&z<=height){distance=t;wallIndex=i;targetSurface='wall';}
  }
  if(!Number.isFinite(distance))return null;
  return {target:{x:origin[0]+distance*direction[0],y:origin[1]+distance*direction[1],z:origin[2]+distance*direction[2]},wallIndex,targetSurface,distance};
}
// Generic preview motors in radians. Limits apply AFTER spatial choreography.
// Hardware output still needs the particular fixture's calibrated DMX ranges.
export function createRoomMotors(){
  const states=new Map(),clamp=(v,n)=>Math.max(-n,Math.min(n,v)),rad=Math.PI/180;
  const update=(light,layout,now)=>{
    if(light.type!=='moving')return light;
    const held=states.get(light.id);
    // Inactive fixtures rest at their last displayed pose. A temporarily
    // shuttered member of a live musical group must keep following the shared
    // movement, otherwise it reappears behind the rest of its formation. A protected-zone
    // transfer is the explicit exception: it must be allowed to move in darkness.
    if(light.power<=0&&!light.movingGroupActive&&!light.zoneTransit&&!light.cueTransit&&held?.aim){
      held.time=now;held.vy=held.vp=0;held.goalYaw=held.yaw;held.goalPitch=held.pitch;held.active=false;
      return {...light,...held.aim};
    }
    const remember=value=>({target:{...value.target},targetSurface:value.targetSurface,wallIndex:value.wallIndex,aimRotation:value.aimRotation,aimed:value.aimed,emissionHeight:value.emissionHeight});
    const config=layout.roomPlan?.positions?.[light.id];
    const centered=light.motionRole==='center'&&Math.abs(light.position.x)<1e-7&&Math.abs((light.motionUV?.x??0)-.5)<1e-7&&!light.motionBounds&&!config?.motionArea&&!config?.wallTarget;
    const height=lightFootprint(light).height,origin=[light.position.x,light.position.y,height];
    if(centered){
      // A middle ray has no partner for a unilateral obstacle detour. Keep
      // the authored center axis; the final volume check darkens blocked rays.
      const aim={...light.target,x:0},hit=roomBeamHit(layout,origin,unit3(sub3([0,aim.y,aim.z??.012],origin)));
      light=hit?{...light,target:hit.target,targetSurface:hit.targetSurface,wallIndex:hit.wallIndex}:{...light,target:aim,power:0};
    }
    const delta=sub3([light.target.x,light.target.y,light.target.z??.012],origin);
    const previous=states.get(light.id);
    let yaw=Math.hypot(delta[0],delta[1])<1e-7?(previous?.yaw??(light.rotation||0)*rad):Math.atan2(delta[0],-delta[1]),pitch=Math.atan2(delta[2],Math.hypot(delta[0],delta[1]));
    const mount=(light.rotation||0)*rad;
    yaw=mount+Math.atan2(Math.sin(yaw-mount),Math.cos(yaw-mount));
    let state=states.get(light.id);
    if(!state){states.set(light.id,{yaw,pitch,goalYaw:yaw,goalPitch:pitch,vy:0,vp:0,time:now,aim:remember(light)});return light;}
    // Pan/tilt have two equivalent solutions for the same ray. At zenith
    // the conventional atan2 form flips pan by 180°. Continue tilt through
    // the pole instead, using the solution nearest the previous joint pose.
    const resolve=(yaw,pitch,reference)=>{
      const flipped=pitch>=0?Math.PI-pitch:-Math.PI-pitch;
      const candidates=[{yaw,pitch},{yaw:yaw+Math.PI,pitch:flipped}].flatMap(pose=>[-2,-1,0,1,2].map(turn=>({...pose,yaw:pose.yaw+turn*2*Math.PI}))).filter(pose=>Math.abs(pose.yaw-mount)<=270*rad+1e-9);
      const cost=pose=>Math.max(Math.abs(pose.yaw-reference.yaw)/70,Math.abs(pose.pitch-reference.pitch)/60);
      return candidates.sort((a,b)=>cost(a)-cost(b))[0]||{yaw,pitch};
    };
    ({yaw,pitch}=resolve(yaw,pitch,{yaw:state.goalYaw,pitch:state.goalPitch}));
    const elapsed=Math.max(0,Math.min(.1,now-state.time));
    let feedYaw=0,feedPitch=0;
    const protectedPath=light.zoneTransit||(layout.roomPlan?.zones||layout.zones||[]).length>0;
    const ahead=protectedPath?null:light.motionAhead;
    if(ahead?.seconds>0&&ahead.seconds<=.5){
      const next=sub3([centered?0:ahead.target.x,ahead.target.y,ahead.target.z??.012],origin);
      const nextPose=resolve(Math.hypot(next[0],next[1])<1e-7?yaw:Math.atan2(next[0],-next[1]),Math.atan2(next[2],Math.hypot(next[0],next[1])),{yaw,pitch}),nextYaw=nextPose.yaw,nextPitch=nextPose.pitch;
      feedYaw=Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw))/ahead.seconds;
      feedPitch=(nextPitch-pitch)/ahead.seconds;
    }else if(!protectedPath&&elapsed>1e-5){
      // Follow feasible live trajectories without a second low-pass delay.
      // Discontinuities (seeks, routing changes) retain the bounded fallback.
      const dy=Math.atan2(Math.sin(yaw-state.goalYaw),Math.cos(yaw-state.goalYaw)),dp=pitch-state.goalPitch;
      if(Math.abs(dy)<=70*rad*elapsed*1.5)feedYaw=dy/elapsed;
      if(Math.abs(dp)<=60*rad*elapsed*1.5)feedPitch=dp/elapsed;
    }
    state.goalYaw=yaw;state.goalPitch=pitch;
    let remaining=elapsed;state.time=now;
    while(remaining>1e-8){const dt=Math.min(remaining,1/120);remaining-=dt;
      for(const [key,velocity,target,feed,speed,accel] of [['yaw','vy',yaw,feedYaw,70*rad,280*rad],['pitch','vp',pitch,feedPitch,60*rad,240*rad]]){
        const desired=clamp(clamp(feed,speed)+(target-state[key])*(protectedPath?4:8),speed);
        state[velocity]+=clamp(desired-state[velocity],accel*dt);state[key]+=state[velocity]*dt;
      }
    }
    const direction=[Math.sin(state.yaw)*Math.cos(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch)],hit=roomBeamHit(layout,origin,direction);
    if(!hit)return {...light,power:0};
    state.active=Math.abs(yaw-state.yaw)+Math.abs(pitch-state.pitch)+Math.abs(state.vy)+Math.abs(state.vp)>.001;
    const {distance,...surface}=hit;
    const value={...light,...surface,emissionHeight:height,aimed:true,aimRotation:state.yaw/rad};
    state.aim=remember(value);return value;
  };
  update.mirror=(sourceId,targetId,reflected)=>{const state=states.get(sourceId);if(state)states.set(targetId,{...state,yaw:-state.yaw,goalYaw:-state.goalYaw,vy:-state.vy,aim:reflected?{target:{...reflected.target},targetSurface:reflected.targetSurface,wallIndex:reflected.wallIndex,aimRotation:reflected.aimRotation,aimed:reflected.aimed,emissionHeight:reflected.emissionHeight}:undefined});};
  update.active=()=>[...states.values()].some(state=>state.active);
  update.reset=()=>states.clear();return update;
}

// Preview-only optical apertures. One mechanical head/lens, at most nine rays.
// No animation clock or DMX channel changes: rotation is an explicit angle.
export function previewOpticalRays(light,layout){
  const prism=light.type==='moving'&&light.prism===3;
  const gobo=light.type==='moving'&&light.gobo==='triad';
  if((!prism&&!gobo)||light.power<=0)return [light];
  const height=lightFootprint(light).height,origin=[light.position.x,light.position.y,height];
  const axis=unit3(sub3([light.target.x,light.target.y,light.target.z??.012],origin));
  const u=unit3(cross3(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0])),v=cross3(axis,u);
  const rotation=(Number.isFinite(light.opticsRotation)?light.opticsRotation:0)*Math.PI/180;
  const spread=Math.tan(Math.max(0,Math.min(24,Number.isFinite(light.prismSpread)?light.prismSpread:12))*Math.PI/360);
  const slope=lightProfile(light.type,light.beamAngle).spread,rays=[];
  const count=(prism?3:1)*(gobo?3:1);
  for(let p=0;p<(prism?3:1);p++)for(let g=0;g<(gobo?3:1);g++){
    const fan=prism?(p-1)*spread:0,phase=rotation+g*2*Math.PI/3;
    const x=fan*Math.cos(rotation)+(gobo?Math.cos(phase)*slope*.6:0);
    const y=fan*Math.sin(rotation)+(gobo?Math.sin(phase)*slope*.6:0);
    const direction=unit3(axis.map((n,i)=>n+u[i]*x+v[i]*y));
    const hit=roomBeamHit(layout,origin,direction);
    if(!hit)continue;
    rays.push({...light,...hit,power:light.power/count*(gobo?.72:.9),prism:0,gobo:null,
      beamAngle:2*Math.atan(slope*(gobo?.22:1))*180/Math.PI,
      emissionHeight:height,previewAperture:true,previewSurfaceLayers:8});
  }
  return rays;
}

// Intersect nested cones with every receiving plane. A spot naturally continues
// across wall/floor/ceiling edges rather than clipping an ellipse on one plane.
export function beamSurfacePatches(light,layout,floorFaces,{smooth=false,layers:requestedLayers}={}){
  const {height,length,radius}=lightFootprint(light),origin=[light.position.x,light.position.y,height],axis=unit3(sub3([light.target.x,light.target.y,light.target.z??.012],origin));
  const u=unit3(cross3(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0])),v=cross3(axis,u),boundary=beamBoundary(layout),roof=layout.height||3;
  const faces=floorFaces.flatMap(face=>[face.map(p=>[...p,0]),face.map(p=>[...p,roof])]);
  boundary.forEach((a,i)=>{const b=boundary[(i+1)%boundary.length];faces.push([[...a,0],[...b,0],[...b,roof],[...a,roof]]);});
  const limits=layout.roomPlan?.positions?.[light.id]?.wallTarget;
  if(limits&&light.wallIndex>=0&&boundary[light.wallIndex]){
    const a=boundary[light.wallIndex],b=boundary[(light.wallIndex+1)%boundary.length];
    const point=(fraction,z)=>[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction,z];
    const left=limits.start??0,right=limits.end??1,bottom=limits.minHeight??0,top=limits.maxHeight??roof;
    faces.splice(0,faces.length,[point(left,bottom),point(right,bottom),point(right,top),point(left,top)]);
  }
  // Scalar distances avoid allocating two vectors for every clipped edge.
  const clip=(points,normal,offset=0)=>{
    const [nx,ny,nz]=normal,[ox,oy,oz]=origin,out=[];
    let b=points[0],db=(b[0]-ox)*nx+(b[1]-oy)*ny+(b[2]-oz)*nz-offset;
    for(let i=0;i<points.length;i++){
      const a=b,da=db;b=points[(i+1)%points.length];
      db=(b[0]-ox)*nx+(b[1]-oy)*ny+(b[2]-oz)*nz-offset;
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
    }return out;
  };
  // All nested cones share the same angular basis and receiving planes.
  const horizontalSpread=lightProfile(light.type,light.beamAngle,light.previewAperture).stretch;
  const sides=Array.from({length:24},(_,k)=>{const angle=k*Math.PI/12,c=Math.cos(angle)/horizontalSpread,s=Math.sin(angle);return u.map((x,i)=>x*c+v[i]*s);});
  let candidates=faces.map(face=>{
    const normal=unit3(cross3(sub3(face[1],face[0]),sub3(face[2],face[0]))),sign=dot3(sub3(origin,face[0]),normal)>=0?1:-1;
    return {points:clip(face,axis,.001),normal,sign};
  }).filter(face=>face.points.length>2);
  const patches=[];
  const layers=smooth?1:requestedLayers??(light.previewSurfaceLayers===8?8:24);
  for(let layer=layers;layer>=1;layer--){const fraction=layer/layers,slope=radius*1.4*fraction/Math.max(.01,length);
    const normals=sides.map(side=>axis.map((x,i)=>x*slope-side[i])),remaining=[];
    for(const face of candidates){let points=face.points;
      for(let k=0;k<24&&points.length>2;k++)points=clip(points,normals[k]);
      if(points.length<3)continue;
      // A plane missed by this cone cannot intersect a narrower inner cone.
      remaining.push(face);
      const center=points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length),ray=sub3(center,origin),hit=roomBeamHit(layout,origin,unit3(ray));
      if(!hit||hit.distance<Math.hypot(...ray)-.02)continue;
      // Projective light coordinates: interpolate all three values, then
      // divide by axial depth in the fragment. The same cone crosses seams.
      const uv=smooth?points.map(p=>{const r=sub3(p,origin);return [dot3(r,u)/(slope*horizontalSpread),dot3(r,v)/slope,dot3(r,axis)];}):null;
      // Move toward the emitter only to avoid coplanar depth flicker.
      const {normal,sign}=face;
      points=points.map(p=>p.map((x,i)=>x+normal[i]*sign*.006));
      const outer=.65*Math.exp(-4*fraction*fraction),inner=.65*Math.exp(-4*((layer-1)/layers)**2);
      // Use the receiving plane, never the clipped triangle centroid. Otherwise
      // triangulation of one floor/ceiling produces visible brightness seams.
      const incidence=Math.abs(dot3(axis,normal));
      const planeDistance=Math.abs(dot3(sub3(origin,face.points[0]),normal));
      const axialDistance=planeDistance/Math.max(.02,incidence);
      const attenuation=incidence*Math.min(1,(1+.015*length*length)/(1+.015*axialDistance*axialDistance));
      patches.push({points,alpha:smooth?1:(inner-outer)/(1-outer)*attenuation,...(smooth?{uv,attenuation}:{})});
    }
    candidates=remaining;if(!candidates.length)break;
  }return patches;
}

// Clip the camera-facing haze polygon at the actual receiving plane, carrying
// its texture coordinates through the cut (no reflected beam on the ceiling).
export function clipBeamReceiver(points,uv,light,layout,feather=0){
 let normal;
 if(light.targetSurface==='ceiling')normal=[0,0,-1];
 else if(light.wallIndex>=0){const boundary=beamBoundary(layout),a=boundary[light.wallIndex],b=boundary[(light.wallIndex+1)%boundary.length];if(a&&b)normal=unit3([b[1]-a[1],a[0]-b[0],0]);}
 else if((light.target.z??0)<.03)normal=[0,0,1];
 if(!normal)return {points,uv};
 const target=[light.target.x,light.target.y,light.target.z??0],origin=[light.position.x,light.position.y,lightFootprint(light).height];
 const sign=dot3(sub3(origin,target),normal)>=0?1:-1;
 const contact=points.map(p=>dot3(sub3(p,target),normal)*sign/Math.max(.001,feather));
 if(feather>0)uv=uv.map((p,i)=>[p[0],p[1],contact[i]]);
 const out=[],coords=[];
 for(let i=0;i<points.length;i++){
  const j=(i+1)%points.length,a=points[i],b=points[j],da=dot3(sub3(a,target),normal)*sign,db=dot3(sub3(b,target),normal)*sign;
  if(da>=0){out.push(a);coords.push(uv[i]);}
  if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));coords.push(uv[i].map((v,k)=>v+(uv[j][k]-v)*t));}
 }
 return {points:out,uv:coords,contact};
}

// Renderer-owned LRU. Colour, power and camera do not alter a projection.
export function createBeamSurfaceCache(limit=512){
 const entries=new Map();let roomKey='',room=null;
 return {
  begin(layout){
   const key=JSON.stringify([layout.width,layout.depth,layout.height,layout.room,layout.lightMin,layout.roomPlan?.boundary]);
   if(key!==roomKey){entries.clear();roomKey=key;}room=layout;
  },
  project(light,layout,floorFaces,options){
   if(room!==layout)this.begin(layout);
   const key=JSON.stringify([light.id,light.type,light.position,light.target,light.emissionHeight,light.aimed,light.modelSize,light.beamAngle,light.previewAperture,light.previewSurfaceLayers,light.wallIndex,layout.roomPlan?.positions?.[light.id]?.wallTarget,options]);
   let value=entries.get(key);
   if(value){entries.delete(key);entries.set(key,value);return value;}
   value=beamSurfacePatches(light,layout,floorFaces,options);entries.set(key,value);
   if(entries.size>limit)entries.delete(entries.keys().next().value);
   return value;
  },
  get size(){return entries.size;}
 };
}
