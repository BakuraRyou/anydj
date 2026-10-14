// Strobo coordinates describe a common vertical stage plane. All mounts aim
// through that same plane: changing mounting depth must not change the figure.
export function strobeSpaceTarget(light,layout){
 const plan=layout.roomPlan,front=layout.room?(layout.lightMin||0):-Math.max(4,layout.depth);
 const boundary=plan?.boundary||[[-layout.width/2,front],[layout.width/2,front],[layout.width/2,layout.depth],[-layout.width/2,layout.depth]];
 const left=Math.min(...boundary.map(p=>p[0])),right=Math.max(...boundary.map(p=>p[0]));
 const near=Math.min(...boundary.map(p=>p[1])),far=Math.max(...boundary.map(p=>p[1]));
 const mounts=Object.values(plan?.positions||layout.positions||{}).filter(p=>p.type==='moving'||p.type===undefined);
 const center=mounts.length?mounts.reduce((sum,p)=>sum+p.y,0)/mounts.length:light.position.y;
 const clamp=v=>Math.max(0,Math.min(1,v));
 const u=clamp(light.motionUV.x),v=clamp(light.motionUV.y);
 return {x:left+(right-left)*(.08+.84*u),
  y:center>=(near+far)/2?near+(far-near)*.12:far-(far-near)*.12,
  z:(layout.height||plan?.height||3)*(.18+.66*v)};
}
