import {stageBrandRects} from './dmx-stage-brand-data.js';

// World-space geometry is shared by Canvas, WebGL, WebGPU and VR. Existing
// saved rooms receive the sign without changing their plans or imported meshes.
export function drawStageBrand(layout,{polygon,eye=null,wallVisible=()=>true}) {
  if(layout.ar)return;
  const height=layout.height||3;
  const boundary=layout.roomPlan?.boundary||[[-layout.width/2,0],[layout.width/2,0],[layout.width/2,layout.depth],[-layout.width/2,layout.depth]];
  const winding=Math.sign(boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1];},0))||1;
  // The back is the edge furthest along the room's depth axis.
  const edges=boundary.map((a,i)=>({a,b:boundary[(i+1)%boundary.length]}));
  const {a,b}=edges.sort((p,q)=>(q.a[1]+q.b[1])-(p.a[1]+p.b[1]))[0];
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<.1||!wallVisible(a,b,winding))return;
  const inward=[-dy/length*winding,dx/length*winding],right=[-dx/length*winding,-dy/length*winding];
  const center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(eye&&(eye[0]-center[0])*inward[0]+(eye[1]-center[1])*inward[1]<=0)return;
  const width=Math.min(3,length*.25,height*.28),signHeight=width,top=height*.68;
  // Model rooms may have backdrop panels in front of the structural wall.
  // Mount on their front surface so the lowered sign is not hidden behind them.
  let mountOffset=.05;
  const mesh=layout.roomPlan?.representation==='model'&&layout.roomPlan.mesh;
  if(mesh)for(const triangle of mesh.triangles){
    const points=triangle.map(i=>mesh.vertices[i]);
    const along=points.map(p=>(p[0]-center[0])*right[0]+(p[1]-center[1])*right[1]);
    const depths=points.map(p=>(p[0]-center[0])*inward[0]+(p[1]-center[1])*inward[1]);
    const zs=points.map(p=>p[2]),depth=depths[0];
    if(Math.max(...depths)-Math.min(...depths)<.001&&depth>=0&&depth<=Math.min(2,layout.depth*.1)&&Math.max(...zs)>top-signHeight&&Math.min(...zs)<top&&Math.max(...zs)-Math.min(...zs)>.01&&Math.max(...along)>-width/2&&Math.min(...along)<width/2)mountOffset=Math.max(mountOffset,depth+.05);
  }
  const point=(x,y,offset)=>[center[0]+right[0]*(x/96-.5)*width+inward[0]*offset,center[1]+right[1]*(x/96-.5)*width+inward[1]*offset,top-y/96*signHeight];
  const rectangle=(x,y,w,h,color,offset)=>polygon([point(x,y,offset),point(x+w,y,offset),point(x+w,y+h,offset),point(x,y+h,offset)],color,1,null,.7);
  for(const [x,y,w,h,color] of stageBrandRects)rectangle(x,y,w,h,color,mountOffset);
}
