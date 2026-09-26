import {motionClearance} from './dmx-light-geometry.js';
import {insideRoom} from './dmx-ar-model.js';
// Stateful preview routing. Obstacles are expanded for early, gentle turns;
// Generic floor-speed limits are not device calibration. Disconnected regions
// allow a rare, fully dark transfer only after sustained route failure.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function zoneObstacles(layout,zones,padding=.5){return zones.map(z=>({left:(z.x-.5)*layout.width-padding,right:(z.x+z.width-.5)*layout.width+padding,bottom:z.y*layout.depth-padding,top:(z.y+z.depth)*layout.depth+padding}));}
const inside=(p,b)=>p.x>b.left&&p.x<b.right&&p.y>b.bottom&&p.y<b.top;
export function blockedSegment(a,b,boxes){
 return boxes.some(box=>{
  let low=0,high=1;
  for(const [key,min,max] of [['x',box.left,box.right],['y',box.bottom,box.top]]){
   const delta=b[key]-a[key];
   if(Math.abs(delta)<1e-9){if(a[key]<=min||a[key]>=max)return false;continue;}
   const t1=(min-a[key])/delta,t2=(max-a[key])/delta;
   low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
  }
  return low<high&&high>0&&low<1;
 });
}
function roomSegment(a,b,layout){
 if([a,b].some(p=>p.x<-layout.width/2-1e-8||p.x>layout.width/2+1e-8||p.y<(layout.lightMin||0)-1e-8||p.y>layout.depth+1e-8))return false;
 const r=layout.motionBounds;if(r&&[a,b].some(p=>p.x<r.left-1e-8||p.x>r.right+1e-8||p.y<r.bottom-1e-8||p.y>r.top+1e-8))return false;
 const boundary=layout.roomPlan?.boundary;if(!boundary)return true;
 if(!insideRoom([a.x,a.y],boundary)||!insideRoom([b.x,b.y],boundary))return false;
 const dx=b.x-a.x,dy=b.y-a.y,cuts=[0,1];
 for(let i=0;i<boundary.length;i++){
  const p=boundary[i],q=boundary[(i+1)%boundary.length],ex=q[0]-p[0],ey=q[1]-p[1],den=dx*ey-dy*ex;
  if(Math.abs(den)<1e-9)continue;
  const t=((p[0]-a.x)*ey-(p[1]-a.y)*ex)/den,u=((p[0]-a.x)*dy-(p[1]-a.y)*dx)/den;
  if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
 }
 cuts.sort((a,b)=>a-b);
 return cuts.slice(1).every((t,i)=>{const middle=(cuts[i]+t)/2;return insideRoom([a.x+dx*middle,a.y+dy*middle],boundary);});
}
function zoneCandidates(target,layout,boxes){
 const valid=p=>roomSegment(p,p,layout)&&!boxes.some(b=>inside(p,b));
 const corners=boxes.flatMap(b=>[[b.left-.02,b.bottom-.02],[b.left-.02,b.top+.02],[b.right+.02,b.bottom-.02],[b.right+.02,b.top+.02]].map(([x,y])=>({x,y}))).filter(valid);
 const boundary=layout.roomPlan?.boundary||[],winding=boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1];},0)>=0?1:-1;
 for(let i=0;i<boundary.length;i++){
  const p=boundary[i],before=boundary[(i+boundary.length-1)%boundary.length],after=boundary[(i+1)%boundary.length];
  const a=Math.hypot(p[0]-before[0],p[1]-before[1])||1,b=Math.hypot(after[0]-p[0],after[1]-p[1])||1;
  const nx=winding*((before[1]-p[1])/a+(p[1]-after[1])/b),ny=winding*((p[0]-before[0])/a+(after[0]-p[0])/b),length=Math.hypot(nx,ny)||1;
  const inset={x:p[0]+nx/length*.12,y:p[1]+ny/length*.12};
  if(valid(inset))corners.push(inset);else if(valid({x:p[0],y:p[1]}))corners.push({x:p[0],y:p[1]});
 }
 const candidates=[...corners,...boxes.flatMap(b=>[{x:b.left-.02,y:target.y},{x:b.right+.02,y:target.y},{x:target.x,y:b.bottom-.02},{x:target.x,y:b.top+.02}])].filter(valid);
 candidates.sort((a,b)=>distance(a,target)-distance(b,target));
 const targets=valid(target)?[target]:candidates;return {corners,targets,end:targets[0]};
}
export function zoneRoute(start,target,layout,boxes){
 const {corners,targets,end}=zoneCandidates(target,layout,boxes);
 if(!end)return null;
 if(!blockedSegment(start,end,boxes)&&roomSegment(start,end,layout))return [end];
 const nodes=[start,...targets,...corners],cost=nodes.map(()=>Infinity),prev=[],visited=new Set();cost[0]=0;
 const path=at=>{const result=[];for(let i=at;i!==0;i=prev[i])result.unshift(nodes[i]);return result;};
 for(let n=0;n<nodes.length;n++){
  let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||cost[i]<cost[at]))at=i;
  if(at<0||!Number.isFinite(cost[at]))break;if(at===1)return path(1);
  visited.add(at);
  for(let i=1;i<nodes.length;i++)if(!visited.has(i)&&!blockedSegment(nodes[at],nodes[i],boxes)&&roomSegment(nodes[at],nodes[i],layout)){
   const next=cost[at]+distance(nodes[at],nodes[i]);if(next<cost[i]){cost[i]=next;prev[i]=at;}
  }
 }
 for(let i=1;i<=targets.length;i++)if(Number.isFinite(cost[i]))return path(i);
 return null;
}
// Subdivide the permitted floor into usable rectangles. When choreography aims
// into a zone or another component, map both axes into a reachable free area
// instead of clamping every head to the same obstacle edge.
function freeRegions(layout,boxes){
 const r=layout.motionBounds||{left:-layout.width/2,right:layout.width/2,bottom:layout.lightMin||0,top:layout.depth};
 let regions=[{...r}];
 for(const b of boxes)regions=regions.flatMap(r=>{
  const left=Math.max(r.left,b.left),right=Math.min(r.right,b.right),bottom=Math.max(r.bottom,b.bottom),top=Math.min(r.top,b.top);
  if(left>=right||bottom>=top)return [r];
  return [{...r,right:left},{...r,left:right},{left,right,bottom:r.bottom,top:bottom},{left,right,bottom:top,top:r.top}].filter(r=>r.right-r.left>.08&&r.top-r.bottom>.08);
 });
 const check=(r,depth=0)=>{
  const points=[{x:r.left,y:r.bottom},{x:r.right,y:r.bottom},{x:r.right,y:r.top},{x:r.left,y:r.top}],center={x:(r.left+r.right)/2,y:(r.bottom+r.top)/2};
  if(points.every((p,i)=>roomSegment(p,points[(i+1)%4],layout)&&roomSegment(p,center,layout)))return [r];
  if(depth===3)return [];
  return [r.left,center.x].flatMap(left=>[r.bottom,center.y].flatMap(bottom=>check({left,right:left+(r.right-r.left)/2,bottom,top:bottom+(r.top-r.bottom)/2},depth+1)));
 };
 return regions.flatMap(r=>check(r));
}
const inRegion=(p,r)=>p.x>=r.left&&p.x<=r.right&&p.y>=r.bottom&&p.y<=r.top;
function selectRegion(p,regions,layout,boxes){
 return [...regions].sort((a,b)=>{
  const score=r=>distance(p,{x:clamp(p.x,r.left,r.right),y:clamp(p.y,r.bottom,r.top)})-.001*(r.right-r.left)*(r.top-r.bottom);
  return score(a)-score(b);
 }).find(r=>zoneRoute(p,{x:(r.left+r.right)/2,y:(r.bottom+r.top)/2},layout,boxes));
}
function regionalTarget(goal,region,layout){
 const r=layout.motionBounds||{left:-layout.width/2,right:layout.width/2,bottom:layout.lightMin||0,top:layout.depth};
 const x=clamp((goal.x-r.left)/(r.right-r.left),0,1),y=clamp((goal.y-r.bottom)/(r.top-r.bottom),0,1);
 const mx=Math.min(.12,(region.right-region.left)*.1),my=Math.min(.12,(region.top-region.bottom)*.1);
 return {x:region.left+mx+x*(region.right-region.left-2*mx),y:region.bottom+my+y*(region.top-region.bottom-2*my)};
}
const blockedDelay=3,crossingCooldown=30,fadeOutSeconds=.3,fadeInSeconds=.45;
export function createZoneMotion(){
 const states=new Map();let lastTime=null,transferOwner=null,transferCooldown=0;
 return {reset(){states.clear();lastTime=null;transferOwner=null;transferCooldown=0;},update(lights,layout,settings,now){
  const elapsed=lastTime===null?0:clamp(now-lastTime,0,.1);lastTime=now;transferCooldown=Math.max(0,transferCooldown-elapsed);
  if(!settings.zones.length){
   states.clear();transferOwner=null;transferCooldown=0;lights.forEach((light,index)=>{if(light.type==='moving')states.set(light.id??`moving-${index}`,{p:{...light.target},v:{x:0,y:0},last:{...light.target},route:[],geometry:null});});
   return lights;
  }
  const seen=new Set();
  const output=lights.map((light,index)=>{
   if(light.type!=='moving')return light;
   const motionLayout=light.motionBounds?{...layout,motionBounds:light.motionBounds}:layout;
   const id=light.id??`moving-${index}`;seen.add(id);
   const geometry=JSON.stringify([layout.width,layout.depth,layout.lightMin,layout.roomPlan?.boundary,light.motionBounds,light.position,light.modelSize,light.aimed,settings.zones]);
   let s=states.get(id);
   if(!s){s={p:{...light.target},v:{x:0,y:0},last:{...light.target},route:[]};states.set(id,s);}
   const dt=elapsed,requested=light.target;let goal=requested;
   if(s.geometry!==geometry){
    if(transferOwner===id)transferOwner=null;
    const initial=s.geometry===undefined;s.geometry=geometry;s.route=[];s.transfer=null;s.blockedFor=0;s.level=1;s.region=null;s.regional=false;s.connectivity=new Map();
    s.boxes=zoneObstacles(layout,settings.zones,motionClearance(light,motionLayout));
    // Extra room at corners allows deceleration before a change in direction.
    s.turns=s.boxes.map(b=>({left:b.left-.2,right:b.right+.2,bottom:b.bottom-.2,top:b.top+.2}));
    s.regions=freeRegions(motionLayout,s.boxes);
    if(initial){const start=zoneCandidates(s.p,motionLayout,s.boxes).end;if(start)s.p={...start};}
   }
   const boxes=s.boxes,free=(a,b)=>roomSegment(a,b,motionLayout)&&!blockedSegment(a,b,boxes),safe=free(s.p,s.p);
   if(!s.transfer){
    if(!safe){s.v={x:0,y:0};s.route=[];s.level=0;}
    let reachable=safe&&free(s.p,requested),requestedFree=free(requested,requested);
    if(safe&&requestedFree&&!reachable){
     const region=s.regions.findIndex(r=>inRegion(requested,r));
     if(region>=0&&s.connectivity.has(region))reachable=s.connectivity.get(region);
     else{reachable=!!zoneRoute(s.p,requested,motionLayout,boxes);if(region>=0)s.connectivity.set(region,reachable);}
    }
    const regional=safe&&(!requestedFree||!reachable);
    if(regional!==s.regional){s.route=[];s.regional=regional;s.region=null;}
    if(regional){
     s.region??=selectRegion(s.p,s.regions,motionLayout,boxes);
     if(s.region)goal=regionalTarget(requested,s.region,motionLayout);
    }
    if(distance(goal,s.last)>1.5)s.route=[];
    const velocity=dt?{x:clamp((goal.x-s.last.x)/dt,-2,2),y:clamp((goal.y-s.last.y)/dt,-2,2)}:{x:0,y:0};
    const ahead={x:clamp(goal.x+velocity.x*.6,-layout.width/2,layout.width/2),y:clamp(goal.y+velocity.y*.6,layout.lightMin||0,layout.depth)};
    if(light.motionBounds){const r=light.motionBounds;ahead.x=clamp(ahead.x,r.left,r.right);ahead.y=clamp(ahead.y,r.bottom,r.top);}
    while(s.route.length&&distance(s.p,s.route[0])<.04&&Math.hypot(s.v.x,s.v.y)<.15)s.route.shift();
    if(s.route.length&&!free(s.p,s.route[0]))s.route=[];
    if(safe&&!s.route.length&&(!free(s.p,ahead)||!free(s.p,goal)))s.route=zoneRoute(s.p,ahead,motionLayout,s.turns)||zoneRoute(s.p,goal,motionLayout,boxes)||[];
    const blocked=!safe||(requestedFree&&!reachable);
    s.blockedFor=blocked?(s.blockedFor||0)+dt:0;
    if(s.blockedFor>=blockedDelay&&!transferOwner&&!transferCooldown){
     const destination=zoneCandidates(requested,motionLayout,boxes).end;
     // Verify connectivity for the real goal, not only the predicted target.
     const detour=destination&&zoneRoute(s.p,destination,motionLayout,boxes);
     if(detour){s.route=detour;s.blockedFor=0;s.regional=false;s.region=null;}
     else if(destination){
      const route=zoneRoute(s.p,destination,motionLayout,[]);
      if(route){s.transfer={route,phase:'fade-out'};transferOwner=id;transferCooldown=crossingCooldown;s.blockedFor=0;s.route=[];}
     }
    }
    if(!s.transfer&&safe)s.level=1;
   }
   s.last={...goal};
   const transfer=s.transfer;
   if(transfer){
    if(transfer.phase==='fade-out'){
     s.level=Math.max(0,s.level-dt/fadeOutSeconds);
     if(!s.level&&Math.hypot(s.v.x,s.v.y)<.05){
      s.v={x:0,y:0};
      // Braking can change the start point near a room corner. Recheck the
      // complete dark path from the stopped position before setting off.
      const route=zoneRoute(s.p,transfer.route.at(-1),motionLayout,[]);
      if(route){transfer.route=route;transfer.phase='cross';}else transfer.phase='fade-in';
     }
    }
    if(transfer.phase==='cross'){
     s.level=0;
     while(transfer.route.length&&distance(s.p,transfer.route[0])<.04&&Math.hypot(s.v.x,s.v.y)<.15)transfer.route.shift();
     if(!transfer.route.length&&safe){transfer.phase='fade-in';s.v={x:0,y:0};}
    }
    if(transfer.phase==='fade-in'){
     s.level=Math.min(1,s.level+dt/fadeInSeconds);
     if(s.level===1){s.transfer=null;transferOwner=null;transferCooldown=crossingCooldown;s.region=null;s.regional=false;s.connectivity.clear();}
    }
   }
   const crossing=transfer?.phase==='cross',allowed=crossing?(a,b)=>roomSegment(a,b,motionLayout):free;
   const target=transfer?(crossing?transfer.route[0]||s.p:s.p):s.route[0]||(free(s.p,goal)?goal:s.p),frameStart={...s.p};
   const steps=Math.max(1,Math.ceil(dt/.02-1e-9)),h=dt/steps;
   for(let n=0;n<steps;n++){
    const delta={x:target.x-s.p.x,y:target.y-s.p.y},length=Math.hypot(delta.x,delta.y);
    const speed=Math.min(2,Math.sqrt(2*2.5*length),length*3);
    const wanted=length?{x:delta.x/length*speed,y:delta.y/length*speed}:{x:0,y:0};
    const ax=wanted.x-s.v.x,ay=wanted.y-s.v.y,change=Math.hypot(ax,ay),factor=change?Math.min(1,2.5*h/change):0;
    let v={x:s.v.x+ax*factor,y:s.v.y+ay*factor};
    const stoppingTime=Math.hypot(v.x,v.y)/(2*2.5)+h;
    if(!allowed(s.p,{x:s.p.x+v.x*stoppingTime,y:s.p.y+v.y*stoppingTime})){
     const speed=Math.hypot(s.v.x,s.v.y),brake=speed?Math.max(0,1-2.5*h/speed):0;v={x:s.v.x*brake,y:s.v.y*brake};
    }
    const next={x:s.p.x+v.x*h,y:s.p.y+v.y*h};
    if(allowed(s.p,next)&&allowed(frameStart,next)){s.p=next;s.v=v;}else{s.v={x:0,y:0};s.route=[];break;}
   }
   return {...light,target:{...s.p},power:light.power*s.level,...(transfer?{zoneTransit:true}:{})};
  });
  for(const id of states.keys())if(!seen.has(id))states.delete(id);
  if(transferOwner&&!seen.has(transferOwner))transferOwner=null;
  return output;
 }};
}
