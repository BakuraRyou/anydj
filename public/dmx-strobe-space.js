// Coordinates describe beam angles, not spots on a rear wall. Equal coordinates
// yield parallel beams even across mounting rows; opposing angles cross in air.
const areaFrames=new WeakMap();

// Floor-only movement areas need their own receiving plane. Projecting an
// airborne picture onto the floor and clamping each ray independently pins
// whole banks to the same edge, even while both authored coordinates move.
export function strobeAreaTarget(light,layout,area){
 const positions=layout.roomPlan?.positions||layout.positions||{};
 let frames=areaFrames.get(positions);if(!frames){frames=new Map();areaFrames.set(positions,frames);}
 const key=[area.x,area.y,area.width,area.depth,layout.width,layout.depth].join(':');
 let frame=frames.get(key);
 if(!frame){
  const mounts=Object.values(positions).filter(p=>(p.type==='moving'||p.type===undefined)&&p.motionArea&&
   ['x','y','width','depth'].every(k=>p.motionArea[k]===area[k]));
  if(!mounts.length)mounts.push(light.position);
  const axis=(key,low,high)=>{
   const values=mounts.map(p=>p[key]),a=Math.min(...values),b=Math.max(...values),span=b-a;
   if(a>=low&&b<=high)return {center:(a+b)/2,offset:(a+b)/2,scale:1,margin:Math.min(a-low,high-b)};
   // Some rigs span a greater depth than their allowed target area. Fit the
   // mounting pattern together, reserving travel rather than clipping it away.
   const scale=span>0?Math.min(1,(high-low)*.75/span):1;
   return {center:(a+b)/2,offset:(low+high)/2,scale,margin:((high-low)-span*scale)/2};
  };
  frame={x:axis('x',(area.x-.5)*layout.width,(area.x+area.width-.5)*layout.width),
   y:axis('y',area.y*layout.depth,(area.y+area.depth)*layout.depth)};
  frames.set(key,frame);
 }
 const clamp=v=>Math.max(0,Math.min(1,v));
 const u=clamp(light.motionUV.x),v=clamp(light.motionUV.y);
 const focus=Number.isFinite(light.motionUV.beamFocus)?clamp(light.motionUV.beamFocus):0;
 const parallel=(axis,value,p)=>axis.offset+(p-axis.center)*axis.scale+(value-.5)*2*axis.margin;
 const x=parallel(frame.x,u,light.position.x),y=parallel(frame.y,v,light.position.y);
 const point={x:(area.x+area.width*u-.5)*layout.width,y:(area.y+area.depth*v)*layout.depth};
 return {x:x+(point.x-x)*focus,y:y+(point.y-y)*focus};
}

export function strobeSpaceTarget(light,layout){
 const plan=layout.roomPlan,front=layout.room?(layout.lightMin||0):-Math.max(4,layout.depth);
 const boundary=plan?.boundary||[[-layout.width/2,front],[layout.width/2,front],[layout.width/2,layout.depth],[-layout.width/2,layout.depth]];
 const near=Math.min(...boundary.map(p=>p[1])),far=Math.max(...boundary.map(p=>p[1]));
 const mounts=Object.values(plan?.positions||layout.positions||{}).filter(p=>p.type==='moving'||p.type===undefined);
 const center=mounts.length?mounts.reduce((sum,p)=>sum+p.y,0)/mounts.length:light.position.y;
 const clamp=v=>Math.max(0,Math.min(1,v));
 const u=clamp(light.motionUV.x),v=clamp(light.motionUV.y);
 const forward=center>=(near+far)/2?-1:1;
 const reach=Math.max(1,far-near),yaw=(u-.5)*1.4;
 const height=layout.height||plan?.height||3;
 if(Number.isFinite(light.motionUV.beamFocus)){
  const focus=clamp(light.motionUV.beamFocus);
  // One world-space plane joins floor and flown fixtures into the same
  // picture. Its rays continue to the real room boundary after crossing it.
  // A shared plane must remain in front of the foremost emitter as well.
  // A shallow front row can otherwise sit beyond the default 8% plane and
  // be sent backwards while the rear rows still face the audience.
  const mountYs=[light.position.y,...mounts.map(p=>p.y)];
  const planeY=forward<0?Math.min(near+reach*.08,...mountYs.map(y=>y-.5))
   :Math.max(far-reach*.08,...mountYs.map(y=>y+.5));
  const distance=Math.max(.01,Math.abs(planeY-light.position.y));
  const emissionHeight=light.emissionHeight??light.position.height+(light.aimed?(light.modelSize?.height??0)*.71:0);
  const parallel={x:light.position.x+(u-.5)*distance*1.4,
   z:emissionHeight+(v-.5)*distance*height/reach*.7};
  return {x:parallel.x+((u-.5)*layout.width*1.8-parallel.x)*focus,y:planeY,
   z:parallel.z+(height*(.12+.76*v)-parallel.z)*focus};
 }
 // Ceiling rigs sweep downward into the room; low mounts sweep upward.
 const vertical=light.position.height>height*.5?-1:1;
 const pitch=.18+.9*v;
 return {x:light.position.x+Math.sin(yaw)*Math.cos(pitch)*reach,
  y:light.position.y+forward*Math.cos(yaw)*Math.cos(pitch)*reach,
  z:light.position.height+vertical*Math.sin(pitch)*reach};
}
