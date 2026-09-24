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
// Follow the audible deck, retaining it around equal crossfader weights.
// Beat positions may be numbers (demo) or interpolated beat-grid samples.
export function createCrowdMotion(){
  let source=null,lastTime=null,lastBeat=null,synced=false,transition=0;
  let motion={beat:0,energy:.7,blend:1,from:null};
  const beatValue=value=>Number.isFinite(value)?value:
    Number.isFinite(value?.index)&&Number.isFinite(value?.phase)?value.index+value.phase:null;
  return (music={},now=0)=>{
    const dt=lastTime===null?0:Math.max(0,Math.min(.1,now-lastTime));lastTime=now;
    const streams=music.streams||[];
    const candidates=streams.map((stream,index)=>({...stream,key:stream.source??stream.movingPlan??index}))
      .filter(s=>s.weight>0&&(s.playing??Boolean(s.frame)));
    candidates.sort((a,b)=>b.weight-a.weight);
    const previous=candidates.find(s=>s.key===source),leader=candidates[0];
    const selected=previous&&leader&&leader.weight-previous.weight<.08?previous:leader;
    // A loaded but paused/muted song freezes the pose. An empty show keeps its idle dance.
    if(!selected&&streams.some(s=>s.source!=null||s.movingPlan))return motion;
    const raw=beatValue(selected?.beat),hasBeat=raw!==null,key=selected?.key??'idle';
    const beat=hasBeat?raw:motion.beat+dt*2;
    const jump=hasBeat&&lastBeat!==null&&(raw-lastBeat<-.05||raw-lastBeat>Math.max(1,dt*8));
    const changed=source!==null&&(source!==key||synced!==hasBeat||jump);
    if(changed){motion={...motion,from:{beat:motion.beat,energy:motion.energy},blend:0};transition=0;}
    transition+=dt;
    const targetEnergy=({peak:1,build:.85,break:.45,intro:.55,outro:.55})[selected?.look]??.7;
    motion={beat,energy:motion.energy+(targetEnergy-motion.energy)*(1-Math.exp(-dt*4)),
      from:motion.from,blend:motion.from?Math.min(1,transition/.4):1};
    if(motion.blend===1)motion.from=null;
    source=key;lastBeat=raw;synced=hasBeat;
    return motion;
  };
}
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
function dancePose(beat,index,energy){
  const block=Math.floor(beat/16),style=((block+index)%4+4)%4;
  const amount=smooth(beat-block*16); // one beat to change style every sixteen beats
  const phase=beat*Math.PI*2,sidePhase=beat*Math.PI;
  const strength=(.75+(index%3)*.1)*energy,mirror=index%2?-1:1;
  function pose(kind){
    const bounce=(1-Math.cos(phase))*.045*strength;
    const sway=Math.sin(sidePhase)*(.045+(kind===0?.045:0))*strength*mirror;
    const hop=kind===3?Math.max(0,Math.sin(phase))*.13*strength:0;
    const point=(x,z)=>[x,0,z+hop];
    const hip=point(sway,.82-bounce),neck=point(sway*1.4,1.4-bounce);
    const joints=[hip,neck];
    for(const side of [-1,1]){
      const step=kind===0?Math.max(0,Math.sin(sidePhase)*side)*.08*strength:0;
      const knee=point(side*.2+sway*.5,.42-bounce+step);
      const foot=point(side*(.26+step*.5),step);
      const wave=Math.sin(sidePhase+side*Math.PI/2)*strength;
      const elbow=point(sway*1.4+side*.29,(kind===2?1.48:1.12)+wave*.12-bounce);
      const hand=point(sway*1.4+side*(kind===1?.42:.38),
        (kind===2?1.79:kind===3?1.52:1.32)+wave*(kind===1?.28:.1)-bounce);
      joints.push(knee,foot,elbow,hand);
    }
    joints.push(point(sway*1.4,1.59-bounce));
    return joints;
  }
  const current=pose(style),previous=pose((style+3)%4);
  return current.map((p,i)=>p.map((v,j)=>previous[i][j]+(v-previous[i][j])*amount));
}
// Normalized floor positions survive room resizing and stage/club switches.
export function stickFigureSegments(layout,person,motion=0,index=0){
  if(typeof motion==='number')motion={beat:motion,energy:.7};
  let joints=dancePose(motion.beat,index,motion.energy??.7);
  if(motion.from&&motion.blend<1){
    const previous=dancePose(motion.from.beat,index,motion.from.energy),blend=smooth(motion.blend);
    joints=joints.map((p,i)=>p.map((v,j)=>previous[i][j]+(v-previous[i][j])*blend));
  }
  const depth=layout.room?layout.depth:Math.max(4,layout.depth);
  const x=(person.x-.5)*Math.max(0,layout.width-1.2);
  const y=layout.room?.6+person.y*Math.max(0,depth-1.2):-.6-person.y*Math.max(0,depth-1.2);
  const points=joints.map(p=>[x+p[0],y+p[1],p[2]]);
  const segments=[[points[0],points[1]]];
  for(const offset of [2,6])segments.push([points[0],points[offset]],[points[offset],points[offset+1]],
    [points[1],points[offset+2]],[points[offset+2],points[offset+3]]);
  const center=points[10],head=a=>[center[0]+Math.cos(a)*.14,center[1],center[2]+Math.sin(a)*.14];
  for(let i=0;i<12;i++)segments.push([head(i*Math.PI/6),head((i+1)*Math.PI/6)]);
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
  for(const zone of layout.zones||[]){
    const x=(zone.x-.5)*layout.width,y=zone.y*d,x2=x+zone.width*layout.width,y2=y+zone.depth*d;
    polygon([[x,y,.025],[x2,y,.025],[x2,y2,.025],[x,y2,.025]],'#9c634c',.45,'#e6ac80');
  }
  paint();
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
