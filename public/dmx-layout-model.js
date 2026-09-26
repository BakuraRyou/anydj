const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,fallback,min,max)=>clamp(Number.isFinite(v)?v:fallback,min,max);
export function stageLayout(value={}){
  const width=number(value?.width,8,2,30),depth=number(value?.depth,6,2,30),positions=Object.create(null),targets=Object.create(null);
  for(const [id,p] of Object.entries(value?.positions||{}).slice(0,512))if(p&&typeof p==='object')positions[id]={x:number(p.x,0,-width/2,width/2),y:number(p.y,depth*.85,0,depth),height:number(p.height,3,.3,12)};
  for(const [id,p] of Object.entries(value?.targets||{}))if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))targets[id]={x:clamp(p.x,-width/2,width/2),y:clamp(p.y,0,depth)};
  const used=new Set(),groupIds=new Set(),assemblies=[];
  for(const g of (Array.isArray(value?.assemblies)?value.assemblies:[]).slice(0,256)){
    if(!g||typeof g.id!=='string'||groupIds.has(g.id)||!Array.isArray(g.members))continue;
    const members=[...new Set(g.members)].filter(id=>typeof id==='string'&&positions[id]&&!used.has(id));
    if(members.length<2)continue;
    members.forEach(id=>used.add(id));groupIds.add(g.id);
    assemblies.push({id:g.id,name:typeof g.name==='string'?g.name.slice(0,60):'Montagegruppe',members,rotation:number(g.rotation,0,-360,360)});
  }
  return {version:3,width,depth,positions,targets,assemblies};
}
export function fixturePosition(layout,id,index=0,count=4){
  return layout.positions[id]||{x:((index+.5)/Math.max(1,count)-.5)*layout.width*.8,y:layout.depth*.85,height:3};
}
// Choreography describes shared floor targets. Device placement determines
// the real azimuth, downward tilt, and beam length required to reach them.
export function projectMovingHeads(layout,poses,devices=null){
  const count=poses.length,order=poses.map((_,i)=>({i,x:fixturePosition(layout,devices?.[i]?.id??`moving-${i}`,i,count).x})).sort((a,b)=>a.x-b.x||a.i-b.i);
  const center=count%2?order[Math.floor(count/2)].i:-1;
  return poses.map((pose,i)=>{
    const id=devices?.[i]?.id??`moving-${i}`,range=devices?.[i]?.motionRange??1,motionFormation=pose.motionFormation;
    const position=fixturePosition(layout,id,i,devices?.length??4),motionFocus=pose.focus===undefined?undefined:pose.focus*clamp(range,0,1);
    pose={pan:pose.pan*range,tilt:.8+(pose.tilt-.8)*range};
    const motionUV={x:.5+.5*clamp(pose.pan/42,-1,1),y:clamp((pose.tilt-.55)/.6,0,1)};
    const target={x:(motionUV.x-.5)*layout.width*.9,y:layout.depth*(.1+.65*motionUV.y)};
    const dx=target.x-position.x,dy=position.y-target.y,horizontal=Math.hypot(dx,dy);
    return {id,position,target,motionUV,...(motionFocus!==undefined?{motionFocus}:{}),...(motionFormation?{motionFormation}:{}),...(i===center?{motionRole:'center'}:{}),motionCenter:{x:0,y:layout.depth*(.1+.65*(.8-.55)/.6)},pan:Math.atan2(dx,dy)*180/Math.PI,tilt:Math.atan2(position.height,horizontal)*180/Math.PI,
      frontPan:Math.atan2(dx,position.height)*180/Math.PI,distance:Math.hypot(horizontal,position.height)};
  });
}

// Rotation is atomic: never clip individual members and deform a rigid assembly.
export function rotateAssembly(layout,id,degrees){
  const group=layout.assemblies.find(g=>g.id===id);
  if(!group||!Number.isFinite(degrees))return null;
  const points=group.members.map(id=>layout.positions[id]);
  const center={x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
  const radians=(degrees-group.rotation)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  const next=points.map(p=>({...p,x:center.x+(p.x-center.x)*c-(p.y-center.y)*s,y:center.y+(p.x-center.x)*s+(p.y-center.y)*c}));
  if(next.some(p=>p.x < -layout.width/2-1e-9||p.x > layout.width/2+1e-9||p.y < -1e-9||p.y > layout.depth+1e-9))return null;
  const result=structuredClone(layout);
  group.members.forEach((id,i)=>result.positions[id]=next[i]);
  result.assemblies.find(g=>g.id===id).rotation=((degrees%360)+360)%360;
  return stageLayout(result);
}


// Assign complete musical roles. Interpolating opposing heads cancels their
// travel and used to pin background/odd-sized rigs to the middle.
export function movingDevicePoses(poses,devices,{formation=null,layout=null}={}){
 if(formation==='designed'){
  const order=devices.map((d,i)=>({i,x:layout?fixturePosition(layout,d.id,i,devices.length).x:i})).sort((a,b)=>a.x-b.x||a.i-b.i),result=[];
  order.forEach(({i},rank)=>{
   const at=(devices.length===1?.5:rank/(devices.length-1))*(poses.length-1),lo=Math.floor(at),hi=Math.min(poses.length-1,lo+1),t=at-lo;
   result[i]={pan:poses[lo].pan+(poses[hi].pan-poses[lo].pan)*t,tilt:poses[lo].tilt+(poses[hi].tilt-poses[lo].tilt)*t,motionFormation:'designed',...(poses.some(p=>p.focus!==undefined)?{focus:(poses[lo].focus??0)+((poses[hi].focus??0)-(poses[lo].focus??0))*t}:{})};
  });return result;
 }
 if(formation==='mirror'||formation==='coherent'){
  // Spread one formation across the physical rig; repeating four role indices
  // breaks reflection symmetry for odd counts and rigs with extra heads.
  const sorted=devices.map((d,i)=>({i,x:layout?fixturePosition(layout,d.id,i,devices.length).x:i})).sort((a,b)=>a.x-b.x||a.i-b.i);
  const result=[],height=poses.reduce((sum,p)=>sum+p.tilt,0)/poses.length;
  // Fit one signed aperture to the musical pose. Inner/outer role changes
  // must not create alternating crossings between neighbouring fixtures.
  const roles=poses.map((_,i)=>2*i/Math.max(1,poses.length-1)-1);
  const center=clamp(poses.reduce((sum,p)=>sum+p.pan,0)/poses.length,-42,42);
  const aperture=clamp(poses.reduce((sum,p,i)=>sum+p.pan*roles[i],0)/roles.reduce((sum,r)=>sum+r*r,0),-42+Math.abs(center),42-Math.abs(center));
  const paired=poses.map((p,i)=>({pan:(p.pan-poses[3-i].pan)/2,tilt:(p.tilt+poses[3-i].tilt)/2}));
  sorted.forEach(({i},rank)=>{
   const index=devices.length===1?1.5:rank*3/(devices.length-1),lo=Math.floor(index),hi=Math.min(3,lo+1),t=index-lo;
   result[i]=formation==='coherent'
    ?{pan:center+(devices.length===1?0:2*rank/(devices.length-1)-1)*aperture,tilt:height,motionFormation:'coherent'}
    :{pan:paired[lo].pan+(paired[hi].pan-paired[lo].pan)*t,tilt:paired[lo].tilt+(paired[hi].tilt-paired[lo].tilt)*t};
  });
  return result;
 }

 const counts=new Map();
 return devices.map(device=>{
  const group=device.group,member=counts.get(group)||0;counts.set(group,member+1);
  const roles=group===0?[0,1]:group===1?[3,2]:group===2?[0,3,1,2]:[0,1,2,3];
  const role=roles[member%roles.length],pose=poses[role];
  const row=Math.floor(member/roles.length);
  // Additional fixtures keep their group's gesture with a distinct reach/depth.
  const variant=row%3,scale=1-variant*.07;
  return {pan:pose.pan*scale,tilt:.85+(pose.tilt-.85)*scale+(variant===1?.025:variant===2?-.025:0)};
 });
}
