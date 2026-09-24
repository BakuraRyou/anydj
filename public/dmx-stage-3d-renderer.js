// Standalone software 3D renderer. World axes: x across, y into stage, z up.
// No DOM, DMX output, music analysis or external dependencies.
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
// Clip geometry crossing the eye plane instead of dropping whole beams/floors.
export function clipNear(points,depth,near=.08){
  if(points.length===2){
    const [a,b]=points,da=depth(a),db=depth(b);
    if(da<near&&db<near)return [];
    const intersect=()=>a.map((v,i)=>v+(b[i]-v)*(near-da)/(db-da));
    return [da<near?intersect():a,db<near?intersect():b];
  }
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b);
    if(da>=near)out.push(a);
    if((da>=near)!==(db>=near))out.push(a.map((v,j)=>v+(b[j]-v)*(near-da)/(db-da)));
  }
  return out;
}
export function stageCamera(layout,camera,width,height){
  const dancer=camera.mode==='dancer';
  const center=[0,layout.depth*(layout.room?.5:.15),1],span=Math.max(layout.width,layout.depth*(layout.room?1:1.5),6,layout.height||0,...Object.values(layout.positions).map(p=>p.height*1.5));
  let distance=span*1.8/camera.zoom;
  const forward=[-Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch),-Math.sin(camera.pitch)];
  if(!dancer){
    const right=unit(cross(forward,[0,0,1])),up=cross(right,forward),focal=Math.min(width,height)*1.2;
    distance=0;
    const bottom=layout.room?0:-Math.max(4,layout.depth),top=Math.max(layout.height||3,...Object.values(layout.positions).map(p=>p.height));
    for(const x of [-layout.width/2,layout.width/2])for(const y of [bottom,layout.depth])for(const z of [0,top]){
      const v=add([x,y,z],mul(center,-1));
      distance=Math.max(distance,Math.abs(dot(v,right))*focal/(width*.4)-dot(v,forward),Math.abs(dot(v,up))*focal/(height*.38)-dot(v,forward));
    }
    distance=Math.max(2,distance)/camera.zoom;
  }
  const eye=dancer?[camera.x,camera.y,camera.eyeHeight]:add(center,mul(forward,-distance));
  const right=unit(cross(forward,[0,0,1])),up=cross(right,forward);
  const focal=dancer?width/(2*Math.tan(Math.PI/5)):Math.min(width,height)*1.2;
  const depth=p=>dot(add(p,mul(eye,-1)),forward);
  const project=p=>{const v=add(p,mul(eye,-1)),z=depth(p);return {x:width/2+dot(v,right)*focal/z,y:height/2-dot(v,up)*focal/z,depth:z};};
  project.depth=depth;
  return project;
}
// Normalized floor positions survive room resizing and stage/club switches.
export function stickFigureSegments(layout,person,time=0,index=0){
  const depth=layout.room?layout.depth:Math.max(4,layout.depth);
  const x=(person.x-.5)*Math.max(0,layout.width-1.2);
  const y=layout.room?.6+person.y*Math.max(0,depth-1.2):-.6-person.y*Math.max(0,depth-1.2);
  const phase=time*Math.PI*2+index*1.7,sway=Math.sin(phase)*.09,bounce=(1-Math.cos(phase*2))*.045;
  const point=(dx,z)=>[x+dx,y,z];
  const hip=point(sway,.82-bounce),neck=point(sway*1.5,1.4-bounce);
  const segments=[[hip,neck]];
  for(const side of [-1,1]){
    const knee=point(side*.2+sway*.5,.42-bounce),foot=point(side*.26,0);
    const elbow=point(sway*1.5+side*.29,1.12+Math.sin(phase+side)*.18-bounce);
    const hand=point(sway*1.5+side*.46,1.4+Math.sin(phase+side)*.25-bounce);
    segments.push([hip,knee],[knee,foot],[neck,elbow],[elbow,hand]);
  }
  for(let i=0;i<12;i++){
    const head=a=>point(sway*1.5+Math.cos(a)*.14,1.59-bounce+Math.sin(a)*.14);
    segments.push([head(i*Math.PI/6),head((i+1)*Math.PI/6)]);
  }
  return segments;
}
export function renderStage3d(ctx,width,height,layout,lights,camera,crowd=[],time=0){
  const project=stageCamera(layout,camera,width,height),queue=[];
  const polygon=(points,fill,alpha=1,stroke=null,lineWidth=.7)=>{
    const clipped=clipNear(points,project.depth);if(clipped.length<2)return;
    const p=clipped.map(project);
    queue.push({p,fill,alpha,stroke,lineWidth,depth:p.reduce((s,v)=>s+v.depth,0)/p.length});
  };
  const line=(a,b,color)=>polygon([a,b],null,1,color);
  const box=(p,size)=>{
    const [x,y,z]=p,[w,d,h]=size;
    const v=[[-w,-d,0],[w,-d,0],[w,d,0],[-w,d,0],[-w,-d,h],[w,-d,h],[w,d,h],[-w,d,h]].map(v=>add(v,[x,y,z]));
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach((face,i)=>polygon(face.map(j=>v[j]),['#344454','#40566a','#263747','#2a3d50','#60788a'][i],1,'#77909f'));
  };
  ctx.clearRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#080e19');bg.addColorStop(1,'#192a3b');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const w=layout.width/2,d=layout.depth,danceDepth=layout.room?0:Math.max(4,d);
  if(!layout.room)polygon([[-w,-danceDepth,0],[w,-danceDepth,0],[w,0,0],[-w,0,0]],'#142b31',1,'#436976');
  polygon([[-w,0,0],[w,0,0],[w,d,0],[-w,d,0]],'#182c3b',1,'#728e9d');
  // Draw the floor first; grid and footprints are coplanar overlays.
  paint();
  for(let x=Math.ceil(-w);x<w;x++)line([x,-danceDepth,.005],[x,d,.005],'#294452');
  for(let y=Math.ceil(-danceDepth);y<d;y++)line([-w,y,.005],[w,y,.005],'#294452');
  if(layout.room){
    const boundary=layout.lightMin||0;
    line([-w,boundary,.02],[w,boundary,.02],'#b8ffe6');
    for(const x of [-w,w])for(const y of [0,d])line([x,y,0],[x,y,layout.height],'#365363');
    for(const y of [0,d])line([-w,y,layout.height],[w,y,layout.height],'#365363');
    for(const x of [-w,w])line([x,0,layout.height],[x,d,layout.height],'#365363');
  }else line([-w,0,.01],[w,0,.01],'#9abec8');paint();
  for(const light of lights){
    if(light.power<=0)continue;
    const p=[light.position.x,light.position.y,light.position.height],t=[light.target.x,light.target.y,.015];
    const length=Math.hypot(...add(t,mul(p,-1))),radius=Math.min(1.8,Math.max(.12,length*(light.type==='moving'?.045:.12)));
    const stretch=Math.min(3,length/Math.max(.3,p[2])),angle=Math.atan2(t[1]-p[1],t[0]-p[0]);
    for(let layer=3;layer>=1;layer--){
      const r=radius*layer/3,ring=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,u=Math.cos(a)*r*stretch,v=Math.sin(a)*r;return [t[0]+u*Math.cos(angle)-v*Math.sin(angle),t[1]+u*Math.sin(angle)+v*Math.cos(angle),.02];});
      // Clip to the rectangular stage floor in world coordinates.
      let clipped=ring;
      for(const [axis,bound,sign] of [[0,-w,1],[0,w,-1],[1,layout.room?layout.lightMin:-danceDepth,1],[1,d,-1]]){
        const out=[];
        for(let i=0;i<clipped.length;i++){
          const a=clipped[i],b=clipped[(i+1)%clipped.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
          if(insideA)out.push(a);
          if(insideA!==insideB){const f=(bound-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+(b[j]-v)*f));}
        }clipped=out;
      }
      if(clipped.length>2)polygon(clipped,light.color,light.power*.3);
    }
  }
  paint();
  for(const light of lights){
    const p=[light.position.x,light.position.y,light.position.height],t=[light.target.x,light.target.y,.025];
    // A subtle suspension line anchors fixtures in space.
    line([p[0],p[1],0],p,'#314858');
    box(add(p,[0,0,.04]),light.type==='bar'?[.12,.08,.12]:[.17,.17,.22]);
    const axis=unit(add(t,mul(p,-1))),u=unit(cross(axis,[0,1,0])),v=cross(axis,u);
    const ring=(center,r)=>Array.from({length:16},(_,i)=>add(center,add(mul(u,Math.cos(i*Math.PI/8)*r),mul(v,Math.sin(i*Math.PI/8)*r))));
    polygon(ring(add(p,mul(axis,.08)),.11),light.power>0?light.color:'#334757',Math.max(.3,light.power));
    if(light.power<=0)continue;
    const distance=Math.hypot(...add(t,mul(p,-1))),radius=Math.min(1.8,distance*(light.type==='moving'?.045:.12));
    const start=ring(p,.065),end=ring(t,radius);
    for(let i=0;i<16;i++)polygon([start[i],start[(i+1)%16],end[(i+1)%16],end[i]],light.color,light.power*.13);
  }
  // Share the fixture/beam depth queue so people belong to the scene.
  crowd.slice(0,12).forEach((person,index)=>{
    for(const segment of stickFigureSegments(layout,person,time,index)){
      const depth=project.depth(segment[0]);
      const thickness=Math.max(.8,Math.min(5,height*.022/Math.max(.3,depth)));
      polygon(segment,null,1,['#b8ffe6','#ffd3a5','#c9c0ff'][index%3],thickness);
    }
  });
  paint();
  const front=project([0,-danceDepth+.4,.01]);
  if(front.depth>0){ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#b0c8d4';ctx.fillText(layout.room?'CLUB · TANZ- & LICHTFLÄCHE':'TANZFLÄCHE',front.x,front.y);}
  function paint(){
    queue.sort((a,b)=>b.depth-a.depth);
    for(const item of queue){ctx.beginPath();item.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(item.p.length>2)ctx.closePath();ctx.globalAlpha=item.alpha;if(item.fill){ctx.fillStyle=item.fill;ctx.fill();}if(item.stroke){ctx.strokeStyle=item.stroke;ctx.lineWidth=item.lineWidth;ctx.stroke();}}
    ctx.globalAlpha=1;queue.length=0;
  }
}
