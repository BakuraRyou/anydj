// Stateful preview routing. Obstacles are expanded for early, gentle turns;
// targets never teleport. Generic floor-speed limits are not device calibration.
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
export function zoneRoute(start,target,layout,boxes){
 const valid=p=>p.x>=-layout.width/2&&p.x<=layout.width/2&&p.y>=(layout.lightMin||0)&&p.y<=layout.depth&&!boxes.some(b=>inside(p,b));
 const corners=boxes.flatMap(b=>[[b.left-.02,b.bottom-.02],[b.left-.02,b.top+.02],[b.right+.02,b.bottom-.02],[b.right+.02,b.top+.02]].map(([x,y])=>({x,y}))).filter(valid);
 let end=target;
 if(!valid(end)){
  const candidates=[...corners,...boxes.flatMap(b=>[{x:b.left-.02,y:target.y},{x:b.right+.02,y:target.y},{x:target.x,y:b.bottom-.02},{x:target.x,y:b.top+.02}])].filter(valid);
  candidates.sort((a,b)=>distance(a,target)-distance(b,target));end=candidates[0];
 }
 if(!end)return null;
 if(!blockedSegment(start,end,boxes))return [end];
 const nodes=[start,end,...corners],cost=nodes.map(()=>Infinity),prev=[],visited=new Set();cost[0]=0;
 for(let n=0;n<nodes.length;n++){
  let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||cost[i]<cost[at]))at=i;
  if(at<0||!Number.isFinite(cost[at]))break;if(at===1){const path=[];for(let i=1;i!==0;i=prev[i])path.unshift(nodes[i]);return path;}
  visited.add(at);
  for(let i=1;i<nodes.length;i++)if(!visited.has(i)&&!blockedSegment(nodes[at],nodes[i],boxes)){
   const next=cost[at]+distance(nodes[at],nodes[i]);if(next<cost[i]){cost[i]=next;prev[i]=at;}
  }
 }
 return null;
}
export function createZoneMotion(){
 const states=new Map();let lastTime=null,geometry='';
 return {reset(){states.clear();lastTime=null;geometry='';},update(lights,layout,settings,now){
  const elapsed=lastTime===null?0:clamp(now-lastTime,0,.1);lastTime=now;
  const signature=JSON.stringify([layout.width,layout.depth,layout.lightMin,settings.zones]);
  if(signature!==geometry){geometry=signature;for(const s of states.values())s.route=[];}
  const boxes=zoneObstacles(layout,settings.zones),dimBoxes=zoneObstacles(layout,settings.zones,.25),seen=new Set();
  const output=lights.map((light,index)=>{
   if(light.type!=='moving')return light;
   const id=light.id??`moving-${index}`;seen.add(id);
   let s=states.get(id);
   if(!s&&!boxes.length)return light;
   if(!s){s={p:{...light.target},v:{x:0,y:0},last:{...light.target},route:[],level:1};states.set(id,s);}
   const dt=elapsed,goal=light.target;
   if(distance(goal,s.last)>1.5)s.route=[]; // Seek or a new song: abandon the old destination, retain velocity.
   // Estimate near-future travel from the incoming choreography. Bound seeks so
   // jumping the song does not create an enormous projected destination.
   const velocity=dt?{x:clamp((goal.x-s.last.x)/dt,-2,2),y:clamp((goal.y-s.last.y)/dt,-2,2)}:{x:0,y:0};s.last={...goal};
   const ahead={x:clamp(goal.x+velocity.x*.6,-layout.width/2,layout.width/2),y:clamp(goal.y+velocity.y*.6,layout.lightMin||0,layout.depth)};
   while(s.route.length&&distance(s.p,s.route[0])<.16)s.route.shift();
   if(!s.route.length&&blockedSegment(s.p,ahead,boxes))s.route=zoneRoute(s.p,ahead,layout,boxes)||[];
   // Retain intermediate waypoints: moving targets cannot swap the detour side.
   const target=s.route[0]||goal;
   const risky=blockedSegment(s.p,{x:s.p.x+s.v.x*.55,y:s.p.y+s.v.y*.55},dimBoxes)||dimBoxes.some(b=>inside(s.p,b));
   const desired=risky?.08:1;s.level+=(desired-s.level)*(1-Math.exp(-dt/(risky?.12:.45)));
   const steps=Math.max(1,Math.ceil(dt/.02-1e-9)),h=dt/steps;
   for(let n=0;n<steps;n++){
    const delta={x:target.x-s.p.x,y:target.y-s.p.y},length=Math.hypot(delta.x,delta.y);
    const speed=Math.min(2,Math.sqrt(2*2.5*length),length*3);
    const wanted=length?{x:delta.x/length*speed,y:delta.y/length*speed}:{x:0,y:0};
    const ax=wanted.x-s.v.x,ay=wanted.y-s.v.y,change=Math.hypot(ax,ay),factor=change?Math.min(1,2.5*h/change):0;
    s.v.x+=ax*factor;s.v.y+=ay*factor;s.p.x+=s.v.x*h;s.p.y+=s.v.y*h;
   }
   return {...light,target:{...s.p},power:light.power*s.level};
  });
  for(const id of states.keys())if(!seen.has(id))states.delete(id);
  return output;
 }};
}
