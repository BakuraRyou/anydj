// Inexpensive diffuse bounce approximation shared by desktop and XR.
// No photometric calibration or shadow tracing; fixture output remains untouched.
const rgb=color=>color?.startsWith('#')?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255):(color?.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number).map(v=>v/255);
export function createSurfaceLighting(lights,ambient,reference=[0,0,0]){
  const sources=lights.filter(l=>l.power>0&&l.target&&l.position).sort((a,b)=>b.power-a.power).slice(0,32).map(l=>({
    x:l.target.x,y:l.target.y,z:(l.target.z||0)+.05,color:rgb(l.color),power:Math.min(1,l.power)*(l.type==='moving'?.7:l.type==='bar'?1.15:1),
  }));
  const planes=new Map();
  return (points,color)=>{
    const material=rgb(color),center=[0,0,0];
    // A shared plane samples one diffuse bounce value. Triangulation and tile
    // size must never change the illumination of the underlying surface.
    const a=points[0],b=points[1],c=points[2];
    const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
    if(length>1e-8){normal=normal.map(n=>n/length);const offset=normal.reduce((n,v,i)=>n+v*(a[i]-reference[i]),0);for(let i=0;i<3;i++)center[i]=reference[i]+normal[i]*offset;}
    else for(const p of points)for(let i=0;i<3;i++)center[i]+=p[i]/points.length;
    // Quantization also joins coplanar material overlays a few millimetres apart.
    const key=center.map(n=>Math.round(n*100)).join(',');
    let energy=planes.get(key);
    if(!energy){
    energy=[ambient/100,ambient/100,ambient/100];
    for(const s of sources){const dx=center[0]-s.x,dy=center[1]-s.y,dz=center[2]-s.z;
      // Broad reflected illumination radiates from the illuminated floor patch.
      const strength=s.power*.35/(1+.22*(dx*dx+dy*dy+dz*dz));
      for(let i=0;i<3;i++)energy[i]+=s.color[i]*strength;
    }
    planes.set(key,energy);
    }
    return '#'+material.map((c,i)=>Math.round(255*Math.min(1,Math.max(0,c*energy[i]))).toString(16).padStart(2,'0')).join('');
  };
}
