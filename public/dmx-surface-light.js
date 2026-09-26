// Inexpensive diffuse bounce approximation shared by desktop and XR.
// No photometric calibration or shadow tracing; fixture output remains untouched.
const materials=new Map();
const rgb=color=>{
 let value=materials.get(color);if(value)return value;
 value=color?.startsWith('#')?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255):(color?.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(v=>Number(v)/255);
 materials.set(color,value);if(materials.size>256)materials.delete(materials.keys().next().value);return value;
};
export function createSurfaceLighting(lights,ambient,reference=[0,0,0]){
  const sources=lights.filter(l=>l.power>0&&l.target&&l.position).sort((a,b)=>b.power-a.power).slice(0,32).map(l=>({
    x:l.target.x,y:l.target.y,z:(l.target.z||0)+.05,color:rgb(l.color),power:Math.min(1,l.power)*(l.type==='moving'?.7:l.type==='bar'?1.15:1),
  }));
  const planes=new Map();
  return (points,color)=>{
    const a=points[0],b=points[1],c=points[2];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const length=Math.hypot(nx,ny,nz);let x=0,y=0,z=0;
    if(length>1e-8){
     nx/=length;ny/=length;nz/=length;
     const distance=nx*(a[0]-reference[0])+ny*(a[1]-reference[1])+nz*(a[2]-reference[2]);
     x=reference[0]+nx*distance;y=reference[1]+ny*distance;z=reference[2]+nz*distance;
    }else for(const p of points){x+=p[0]/points.length;y+=p[1]/points.length;z+=p[2]/points.length;}
    // Coplanar triangles still share exactly the same bounce sample.
    const key=Math.round(x*100)+','+Math.round(y*100)+','+Math.round(z*100);
    let energy=planes.get(key);
    if(!energy){
    energy=[ambient/100,ambient/100,ambient/100];
    for(const s of sources){const dx=x-s.x,dy=y-s.y,dz=z-s.z;
      // Broad reflected illumination radiates from the illuminated floor patch.
      const strength=s.power*.35/(1+.22*(dx*dx+dy*dy+dz*dz));
      for(let i=0;i<3;i++)energy[i]+=s.color[i]*strength;
    }
    energy.colors=new Map();planes.set(key,energy);
    }
    let shaded=energy.colors.get(color);
    if(!shaded){shaded='#'+rgb(color).map((c,i)=>Math.round(255*Math.min(1,Math.max(0,c*energy[i]))).toString(16).padStart(2,'0')).join('');energy.colors.set(color,shaded);}
    return shaded;
  };
}
