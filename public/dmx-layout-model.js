const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,fallback,min,max)=>clamp(Number.isFinite(v)?v:fallback,min,max);
export function stageLayout(value={}){
  const width=number(value?.width,8,2,30),depth=number(value?.depth,6,2,30),positions=Object.create(null);
  for(const [id,p] of Object.entries(value?.positions||{}).slice(0,512))if(p&&typeof p==='object')positions[id]={x:number(p.x,0,-width/2,width/2),y:number(p.y,depth*.85,0,depth),height:number(p.height,3,.3,12)};
  return {version:1,width,depth,positions};
}
export function fixturePosition(layout,id,index=0,count=4){
  return layout.positions[id]||{x:((index+.5)/Math.max(1,count)-.5)*layout.width*.8,y:layout.depth*.85,height:3};
}
// Choreography describes shared floor targets. Device placement determines
// the real azimuth, downward tilt, and beam length required to reach them.
export function projectMovingHeads(layout,poses){
  return poses.map((pose,i)=>{
    const position=fixturePosition(layout,`moving-${i}`,i,4);
    const target={x:clamp(pose.pan/42,-1,1)*layout.width*.45,y:layout.depth*(.1+.65*clamp((pose.tilt-.55)/.6,0,1))};
    const dx=target.x-position.x,dy=position.y-target.y,horizontal=Math.hypot(dx,dy);
    return {id:`moving-${i}`,position,target,pan:Math.atan2(dx,dy)*180/Math.PI,tilt:Math.atan2(position.height,horizontal)*180/Math.PI,
      frontPan:Math.atan2(dx,position.height)*180/Math.PI,distance:Math.hypot(horizontal,position.height)};
  });
}
