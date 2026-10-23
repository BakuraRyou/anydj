import {newRoomPlan,validateRoomPlan,insideRoom,triangulateFloor} from './dmx-ar-model.js';

// These views follow the audience areas and stage orientation of each preset.
// Detect existing/renamed rooms by their fixture IDs, without rewriting plans.
export function roomSpectatorView(layout){
 const plan=layout.roomPlan??layout,positions=plan.positions??{},has=prefix=>Object.keys(positions).some(id=>id.startsWith(prefix));
 let x=0,y=layout.room?layout.depth*.5:-Math.min(3,layout.depth),yaw=0,pitch=0;
 // The forward banks begin at y=16 with a 19 m span. At the old y=8
 // position they sit outside the spectator's 72-degree field of view.
 if(has('gala-')){y=layout.depth*4/56;pitch=-.16;}
 else if(has('choreo-'))y=layout.depth*7/46;
 else if(has('combined-formation-arena-'))y=layout.depth*2.5/36;
 else if(has('formation-arena-'))y=layout.depth*5.5/36;
 else if(has('strobe-head-'))y=layout.depth*10/36;
 else if(has('festival-'))y=layout.depth*22/56;
 else if(has('club-stage-'))y=layout.depth*20/50;
 else if(has('club-')){y=layout.depth*21/42;yaw=Math.PI;}
 else if(has('barn-')){x=-layout.width*.25;y=layout.depth*.5;yaw=-Math.atan2(layout.width*.6,layout.depth/14);}
 const boundary=plan.boundary,zones=plan.zones??[];
 const available=([px,py])=>(!boundary||insideRoom([px,py],boundary))&&!zones.some(z=>px>=(z.x-.5)*layout.width&&px<=(z.x+z.width-.5)*layout.width&&py>=z.y*layout.depth&&py<=(z.y+z.depth)*layout.depth);
 if(layout.room&& !available([x,y])){
  // Edited/imported concave floors and exclusion areas need a valid fallback.
  const candidates=[];
  for(let i=1;i<20;i++)for(let j=1;j<20;j++)candidates.push([(i/20-.5)*layout.width,j/20*layout.depth]);
  if(boundary)candidates.push(...triangulateFloor(boundary).map(t=>[t.reduce((s,p)=>s+p[0],0)/3,t.reduce((s,p)=>s+p[1],0)/3]));
  const point=candidates.filter(available).sort((a,b)=>Math.hypot(a[0]-x,a[1]-y)-Math.hypot(b[0]-x,b[1]-y))[0];
  if(point)[x,y]=point;
 }
 return {mode:'dancer',x,y,eyeHeight:1.7,yaw,pitch,zoom:1};
}

// Approximate proportions from the China Film anniversary gala reference.
// Rings are static mounting geometry; every light remains an editable device.
export function galaArenaRoom(){
 const plan=newRoomPlan(48,56,15);
 plan.name='Gala-Arena · Lichtringe';plan.style='industrial';
 plan.environmentBrightness=14;plan.representation='model';plan.zones=[];
 const {mesh,face,box}=roomMeshBuilder(plan.name);
 face([[-24,0,0],[24,0,0],[24,56,0],[-24,56,0]],'#202633');
 for(const [a,b] of [[[-24,0],[24,0]],[[24,0],[24,56]],[[24,56],[-24,56]],[[-24,56],[-24,0]]])face([[...a,0],[...b,0],[...b,15],[...a,15]],'#202737');
 face([[-24,0,15],[24,0,15],[24,56,15],[-24,56,15]],'#121925');
 // Three ascending spectator tiers on both sides and across the rear.
 for(let tier=0;tier<3;tier++){
  const z=1.2+tier*1.5,x=18+tier*2;
  for(const side of [-1,1])box(side<0?-x-2:x,12,z,2,38,.28,tier%2?'#374255':'#2c3648');
  box(-18,50+tier*2,z,36,2,.28,tier%2?'#374255':'#2c3648');
 }
 box(-16,30,0,32,18,.6,'#30394a');
 box(-3,44,.6,6,1.3,1,'#151c29');
 for(const side of [-1,1]){
  for(let i=0;i<3;i++)box(side<0?-17.5:16,29+i*.4,0,1.5,.4,(i+1)*.2,'#414b5b');
  for(let i=0;i<5;i++)box(side<0?-17.5:16.5,31,6+i*.7,1,.8,.62,'#121823');
 }
 const add=(id,type,name,x,y,height,target,beamAngle=3,rotation=0)=>{
  plan.positions['gala-'+id]={type,name,x,y,height,rotation,target,beamAngle,
   size:type==='bar'?{width:1.5,depth:.12,height:.14}:{width:.26,depth:.28,height:.32}};
 };
 // Seven suspended circles: a large crown, paired wings and smaller satellites.
 const rings=[[0,35,12.2,4.6,24],[-11,34,10.4,3.2,16],[11,34,10.4,3.2,16],[-7,44,8.4,2.5,12],[7,44,8.4,2.5,12],[-11,23,7.2,2.2,12],[11,23,7.2,2.2,12]];
 rings.forEach(([cx,cy,z,r,count],ring)=>{
  const point=(a,radius,h)=>[cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,h];
  for(let i=0;i<32;i++){
   const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
   face([point(a,r-.14,z),point(b,r-.14,z),point(b,r+.14,z),point(a,r+.14,z)],'#69768b');
   face([point(a,r+.14,z),point(b,r+.14,z),point(b,r+.14,z+.22),point(a,r+.14,z+.22)],'#46536a');
  }
  for(let i=0;i<4;i++){
   const [x,y]=point(i*Math.PI/2,r,z);
   box(x-.025,y-.025,z+.22,.05,.05,14.5-z-.22,'#4b576b');
  }
  for(let i=0;i<count;i++){
   const a=(i+.5)*Math.PI*2/count,[x,y]=point(a,r,z);
   add(`ring-${ring}-${i}`,'moving',`Lichtring ${ring+1} · Beam ${i+1}`,x,y,z-.4,{x,y,z:.62},2.4);
  }
 });
 // Broad ceiling fans and low stage fans complement the circular curtains.
 for(const [row,y] of [[0,28],[1,43]]){
  box(-16,y,14.1,32,.22,.22,'#536078');
  for(let i=0;i<12;i++){
   const x=-15+i*30/11;
   add(`roof-${row}-${i}`,'moving',`Dachtraverse ${row+1} · Beam ${i+1}`,x,y,13.7,{x:x*.75,y:19+row*8,z:1},3);
  }
 }
 for(let i=0;i<16;i++){
  const x=-15+i*2;
  add(`floor-${i}`,'moving',`Bühnenkante · Bodenfächer ${i+1}`,x,30.4,.8,{x:x*.7,y:20,z:8},3);
  add(`edge-${i}`,'bar',`Bühnenkante · LED ${i+1}`,x,30.05,.7,{x,y:31.5,z:.62},40);
  add(`back-${i}`,'bar',`Rückwand · Lichtkontur ${i+1}`,x,49.7,5.9,{x,y:55.8,z:6},40);
 }
 for(const side of [-1,1])for(let i=0;i<8;i++){
  const y=18+i*4;
  add(`wash-${side}-${i}`,'spot',`Rang ${side<0?'links':'rechts'} · Wash ${i+1}`,side*17.5,y,6,{x:side*23.8,y,z:8},32);
 }
 // Millimetre precision avoids verbose circle coordinates in portable plans.
 const vertices=[],indices=new Map(),remap=mesh.vertices.map(p=>{
  const point=p.map(n=>Math.round(n*1000)/1000||0),key=point.join(',');
  if(!indices.has(key)){indices.set(key,vertices.length);vertices.push(point);}
  return indices.get(key);
 });
 mesh.vertices=vertices;mesh.triangles=mesh.triangles.map(t=>t.map(i=>remap[i]));
 for(const p of Object.values(plan.positions))for(const value of [p,p.target])for(const k of ['x','y','z','height'])if(k in value)value[k]=Math.round(value[k]*1000)/1000||0;
 plan.mesh=mesh;
 return validateRoomPlan(plan);
}

export function formationArenaRoom(){
  const plan=newRoomPlan(24,36,10);
  plan.name='Formationsarena · Raumfächer';plan.style='industrial';
  plan.environmentBrightness=5;plan.representation='model';
  const {mesh,face,box}=roomMeshBuilder('Formationsarena · sechs gegenüberliegende Beam-Bänke');
  face([[-12,0,0],[12,0,0],[12,36,0],[-12,36,0]],'#161a21');
  face([[-12,35.8,0],[12,35.8,0],[12,35.8,10],[-12,35.8,10]],'#0c1018');
  box(-11,11,0,22,24,.6,'#222832');
  box(-2,33,.6,4,1,1,'#161923');
  // Compact banks give each wing a distinct origin. Placing every fixture on
  // full-width rear traverses cannot produce these opposing spatial fans.
  for(const [row,y,height,center] of [[0,16,1,8],[1,24,4.8,10],[2,33,8.3,8]]){
    for(const side of [-1,1]){
      box(side*center-1.5,y,height+.45,3,.22,.22,'#454b56');
      for(let i=0;i<16;i++){
        const x=side*center+(i-7.5)*.18;
        plan.positions[`formation-arena-${row}-${side}-${i}`]={type:'moving',
          name:`${['Boden','Seite','Oben'][row]} ${side<0?'links':'rechts'} · Beam ${i+1}`,
          x,y,height,rotation:0,beamAngle:2,size:{width:.14,depth:.2,height:.25},target:{x:side*3,y:10,z:5}};
      }
    }
  }
  plan.mesh=mesh;plan.zones=[];
  return validateRoomPlan(plan);
}

export function strobeStageRoom(){
  const plan=newRoomPlan(24,36,10);
  plan.name='Formationsbühne · 3 Ebenen';
  plan.style='industrial';plan.environmentBrightness=5;plan.representation='model';
  const {mesh,face,box}=roomMeshBuilder('Formationsbühne · Bodenfächer und zwei erhöhte Strahlenreihen');
  face([[-12,0,0],[12,0,0],[12,36,0],[-12,36,0]],'#20232a');
  face([[-12,35.8,0],[12,35.8,0],[12,35.8,10],[-12,35.8,10]],'#10131c');
  box(-11,26,0,22,9,.6,'#292e37');
  box(-2,33,.6,4,1,1,'#161923');
  for(const x of [-11,10.7])box(x,31,.6,.3,.3,8.4,'#454b56');
  for(const [row,y,height] of [[0,27,1],[1,30,5],[2,33,8.5]]){
    if(row)box(-11,y,height+.45,22,.25,.25,'#454b56');
    for(let i=0;i<16;i++){
      const x=-10.5+i*1.4;
      plan.positions[`strobe-head-${row}-${i}`]={type:'moving',name:`${['Boden','Mitte','Oben'][row]} · Beam ${i+1}`,
        x,y,height,rotation:0,size:{width:.34,depth:.34,height:.4},
        target:{x:x*.8,y:12,z:row===0?6:2}};
    }
  }
  for(let i=0;i<8;i++)plan.positions[`strobe-bar-${i}`]={type:'bar',name:`Bühnenkante · LED-Antwort ${i+1}`,
    x:-9.8+i*2.8,y:26.4,height:.75,rotation:0,size:{width:1,depth:.12,height:.15},
    target:{x:-9.8+i*2.8,y:25,z:.6}};
  plan.mesh=mesh;plan.zones=[];
  return validateRoomPlan(plan);
}

// The full-width stage supplies the room geometry once. Only the arena's
// separate beam banks and supports are added; overlaying both room meshes
// would duplicate the floor, rear wall and DJ booth.
export function combinedFormationRoom(){
  const plan=strobeStageRoom(),arena=formationArenaRoom();
  plan.name='Formationsbühne · Panorama & Raumfächer';
  plan.positions=Object.fromEntries(Object.entries(plan.positions).map(([id,p])=>['combined-'+id,p]));
  const {mesh,box}=roomMeshBuilder(plan.name);
  const rows=[[0,16,1,8],[1,22,4.8,10],[2,34.5,8.3,8]];
  for(const [row,y,height,center] of rows)for(const side of [-1,1]){
    box(side*center-1.5,y,height+.45,3,.22,.22,'#454b56');
    for(const edge of [-1,1])box(side*center+edge*1.6-.05,y+.12,0,.1,.16,height+.45,'#343b46');
    for(let i=0;i<16;i++){
      const id=`formation-arena-${row}-${side}-${i}`;
      plan.positions['combined-'+id]={...arena.positions[id],y};
    }
  }
  const offset=plan.mesh.vertices.length;
  plan.mesh={...plan.mesh,name:plan.name,
    vertices:[...plan.mesh.vertices,...mesh.vertices],
    triangles:[...plan.mesh.triangles,...mesh.triangles.map(t=>t.map(i=>i+offset))],
    colors:[...plan.mesh.colors,...mesh.colors]};
  return validateRoomPlan(plan);
}

// A clear audience sightline, three broad beam rows and three opposing bank
// pairs form the moving picture. Fixed washes colour the stage and backdrop;
// narrow accents and LED strips provide a separate musical response.
export function choreographyArenaRoom(){
 const plan=newRoomPlan(28,46,12);
 plan.name='Choreografie-Arena · Beams, Wash & LED';plan.style='industrial';
 plan.environmentBrightness=7;plan.representation='model';plan.zones=[];
 const {mesh,face,box}=roomMeshBuilder(plan.name);
 face([[-14,0,0],[14,0,0],[14,46,0],[-14,46,0]],'#151922');
 face([[-14,45.9,0],[14,45.9,0],[14,45.9,12],[-14,45.9,12]],'#090e18');
 box(-12,30,0,24,14.8,1,'#242b36');
 for(const side of [-1,1])for(let i=0;i<4;i++)box(side<0?-13.2:12,29+i*.35,0,1.2,.35,(i+1)*.25,'#343d4a');
 for(let i=0;i<7;i++)box(-11.8+i*3.5,45.1,1,2.6,.2,8.7,i%2?'#121e30':'#182638');
 for(const [y,height]of [[32,9.2],[38,10],[44,10.8]]){
  box(-12.7,y,height,25.4,.2,.2,'#454e5e');
  for(const x of [-12.7,12.5])box(x,y,1,.2,.2,height-1,'#343e4c');
 }
 box(-2.3,41,1,4.6,1.2,1.1,'#121823');
 const sizes={moving:{width:.28,depth:.3,height:.34},spot:{width:.22,depth:.24,height:.26},bar:{width:1.2,depth:.12,height:.14}};
 const add=(id,type,name,x,y,height,target,beamAngle,size)=>{
  plan.positions['choreo-'+id]={type,name,x,y,height,rotation:0,target,beamAngle,size:size??{...sizes[type]}};
 };
 for(const [row,y,height]of [[0,31,1.3],[1,36,5.6],[2,43,9.6]]){
  if(row)box(-12,y+.25,height+.45,24,.2,.2,'#495565');
  for(let i=0;i<14;i++){
   const x=-11.7+i*1.8;
   add(`beam-row-${row}-${i}`,'moving',`${['Bodenlinie','Panorama','Dachlinie'][row]} · Beam ${i+1}`,x,y,height,{x:x*.5,y:14,z:4.5},3);
  }
 }
 for(const [row,y,height,centre]of [[0,26,2.2,10],[1,33,5.7,11.5],[2,41,9.9,10]])for(const side of [-1,1]){
  box(side*centre-1.1,y+.25,height+.36,2.2,.16,.16,'#526073');
  box(side*(centre+1.2)-.06,y+.35,0,.12,.14,height+.36,'#34404e');
  for(let i=0;i<8;i++){
   const x=side*centre+(i-3.5)*.22;
   add(`fan-${row}-${side}-${i}`,'moving',`${['Frontfächer','Seitenfächer','Hochfächer'][row]} ${side<0?'links':'rechts'} · Beam ${i+1}`,
    x,y,height,{x:-side*3,y:14,z:5},2.4,{width:.15,depth:.2,height:.24});
  }
 }
 for(let i=0;i<6;i++){
  const x=-10+i*4;
  add(`wash-up-${i}`,'spot',`Kulisse · Uplight ${i+1}`,x,43.5,1.2,{x,y:45.7,z:8.7},18);
  add(`wash-down-${i}`,'spot',`Bühnenfläche · Wash ${i+1}`,x,36.5,10.4,{x:x*.8,y:35,z:1.02},35);
 }
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const y=32+i*3.2;
  add(`wash-side-${side}-${i}`,'spot',`Seitenlicht ${side<0?'links':'rechts'} ${i+1}`,side*13.2,y,4.8,{x:side*8,y,z:1.1},26);
  add(`accent-${side}-${i}`,'spot',`Akzent ${side<0?'links':'rechts'} ${i+1}`,side*12.8,29+i*4,1.3,{x:side*7,y:31+i*4,z:6.7},8);
  add(`led-tower-${side}-${i}`,'bar',`LED-Säule ${side<0?'links':'rechts'} ${i+1}`,side*12.8,38,2+i*2,{x:side*13.8,y:38,z:2+i*2},35,{width:.14,depth:.12,height:1.1});
 }
 for(let i=0;i<12;i++){
  const x=-10.8+i*21.6/11;
  add(`led-edge-${i}`,'bar',`Bühnenkante · LED ${i+1}`,x,30.15,1.15,{x,y:31.5,z:1.03},40);
 }
 for(let row=0;row<2;row++)for(let i=0;i<8;i++){
  const x=-10.5+i*3;
  add(`led-back-${row}-${i}`,'bar',`Hintergrund ${row+1} · LED ${i+1}`,x,45.35,3+row*4.5,{x,y:45.8,z:3+row*4.5},45,{width:2,depth:.12,height:.14});
 }
 plan.mesh=mesh;
 return validateRoomPlan(plan);
}

// All fixtures are virtual room devices, driven by the current show's frames.
export function largeClubRoom() {
  const plan=newRoomPlan(30,42,9);
  plan.name='Großclub · 192 Lichter';
  plan.style='club';
  plan.environmentBrightness=12;
  const sizes={moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15},truss:{width:6,depth:.3,height:.3}};
  let count=0;
  const add=(type,name,x,y,height,target,extra={})=>{
    plan.positions[`club-${++count}`]={type,name,x,y,height,rotation:0,size:{...sizes[type]},...(target?{target}:{}),...extra};
  };
  // Central dance floor: x -10..10, y 7..35. DJ/stage is at the front.
  const motionArea={x:5/30,y:7/42,width:20/30,depth:28/42};
  for(let row=0;row<6;row++){
    const y=6+row*5.5,label=`Traverse ${row+1}`;
    for(let segment=0;segment<4;segment++)add('truss',`${label} · Segment ${segment+1}`,-9+segment*6,y,7.8);
    for(let i=0;i<12;i++){
      const x=-11+i*2;
      add('moving',`${label} · Moving Head ${i+1}`,x,y,7.4,{x:x*.75,y:Math.min(34,y+3)},{motionArea:{...motionArea}});
    }
    for(let i=0;i<8;i++){
      const x=-10.5+i*3;
      add('spot',`${label} · PAR ${i+1}`,x,y,7.3,{x:x*.8,y:Math.min(35,y+2.5)});
    }
    for(let i=0;i<4;i++){
      const x=-9+i*6;
      add('bar',`${label} · LED-Bar ${i+1}`,x,y,7.1,{x,y:Math.min(35,y+4)});
    }
  }
  for(const side of [-1,1])for(let i=0;i<12;i++){
    const y=7+i*2.5;
    add('spot',`${side<0?'Links':'Rechts'} · Seitenlicht ${i+1}`,side*11.8,y,4.5,{x:side*6,y});
  }
  for(let i=0;i<12;i++){
    const x=-11+i*2;
    add('bar',`Bühne · LED-Bar ${i+1}`,x,4.5,2,{x:x*.8,y:10});
    add('bar',`Hinten · LED-Bar ${i+1}`,x,37,5,{x:x*.8,y:31});
  }
  const zone=(id,name,x,y,width,depth)=>({id,name,x:(x+15)/30,y:y/42,width:width/30,depth:depth/42});
  plan.zones=[zone('club-dj','DJ-Pult & Bühne',-10,0,20,4),zone('club-bar-left','Bar links',-15,10,2,20),zone('club-bar-right','Bar rechts',13,10,2,20),zone('club-lounge','Lounge hinten',-15,39,30,3)];
  return validateRoomPlan(plan);
}

export function clubStageRoom() {
  const plan=newRoomPlan(36,50,10);
  plan.name='Club-Bühne · Publikum & Hintergrund';
  plan.environmentBrightness=18;
  plan.representation='model';
  const {mesh,face,box}=roomMeshBuilder('Club mit Bühne, Publikumsfläche und Bühnenhintergrund');
  const floorX=[-18,-12,12,18],floorY=[0,8,32,36,46,50];
  for(let x=0;x<floorX.length-1;x++)for(let y=0;y<floorY.length-1;y++){
    if(x===1&&y===3)continue; // The stage supplies its own floor.
    const left=floorX[x],right=floorX[x+1],front=floorY[y],back=floorY[y+1];
    face([[left,front,0],[right,front,0],[right,back,0],[left,back,0]],x===1&&y===1?'#343b46':'#252a30');
  }
  for(const [a,b] of [[[-18,0],[18,0]],[[18,0],[18,50]],[[18,50],[-18,50]],[[-18,50],[-18,0]]])face([[...a,0],[...b,0],[...b,10],[...a,10]],'#303039');
  // The audience faces the stage at the back. Side aisles stay clear.
  box(-12,36,0,24,10,.8,'#45404b');
  for(const side of [-1,1])for(let i=0;i<4;i++)box(side<0?-14:12,35+i*.5,0,2,.5,(i+1)*.2,'#555661');
  box(-3,42,.8,6,1.2,1.1,'#171c28');
  // Backdrop panels and side speaker stacks are ordinary portable geometry.
  for(let i=0;i<8;i++)box(-11.8+i*3,48.5,.8,2.6,.25,6.2,i%2?'#25334d':'#293e50');
  for(const side of [-1,1]){
    box(side<0?-15:13,37,0,2,2,4,'#141820');
    box(side<0?-18:15,13,0,3,14,1.1,'#423e42');
  }
  box(-4,3,0,8,2,1,'#313745');
  plan.mesh=mesh;
  const sizes={moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15},truss:{width:6,depth:.3,height:.3}};
  let count=0;
  const add=(type,name,x,y,height,target,extra={})=>{
    plan.positions[`club-stage-${++count}`]={type,name,x,y,height,rotation:0,size:{...sizes[type]},...(target?{target}:{}),...extra};
  };
  const audience={x:6/36,y:8/50,width:24/36,depth:24/50};
  for(const [section,rows] of [['Publikum',[12,22,32]],['Bühne',[37,41,45]]])for(const [row,y] of rows.entries()){
    for(let i=0;i<4;i++)add('truss',`${section} · Traverse ${row+1}/${i+1}`,-9+i*6,y,8.5);
    for(let i=0;i<8;i++){
      const x=-10.5+i*3;
      add('moving',`${section} · Moving Head ${row+1}/${i+1}`,x,y,8,{x:x*.8,y:section==='Bühne'?28:y+2},{motionArea:{...audience},...(section==='Bühne'?{wallTarget:{wall:2,start:.17,end:.83,minHeight:2,maxHeight:8}}:{})});
      if(section==='Bühne')add('spot',`Bühne · Frontlicht ${row+1}/${i+1}`,x,y-.6,7.8,{x:x*.85,y:40});
      else add('bar',`Publikum · LED-Bar ${row+1}/${i+1}`,x,y,7.6,{x:x*.8,y:y+2});
    }
  }
  for(const side of [-1,1])for(let i=0;i<12;i++)add('spot',`Publikum · ${side<0?'links':'rechts'} ${i+1}`,side*13,9+i*2,5,{x:side*8,y:9+i*2});
  for(let row=0;row<3;row++)for(let i=0;i<8;i++)add('bar',`Hintergrund · LED-Bar ${row+1}/${i+1}`,-10.5+i*3,48,2+row*2,{x:-10.5+i*3,y:49.5});
  const zone=(id,name,x,y,w,d)=>({id,name,x:(x+18)/36,y:y/50,width:w/36,depth:d/50});
  plan.zones=[zone('stage-bar-left','Bar links',-18,12,3,16),zone('stage-bar-right','Bar rechts',15,12,3,16),zone('stage-foh','Regie / FOH',-4,2,8,4)];
  return validateRoomPlan(plan);
}

export function clubStageRoomWithoutQuietZones() {
  const plan=clubStageRoom();
  plan.name='Club-Bühne · ohne Ruhezonen';
  plan.zones=[];
  return plan;
}

export function largeHallRoomWithDJQuietZone() {
  const plan=largeClubRoom();
  plan.name='Große Halle · 192 Lichter · nur DJ-Ruhezone';
  plan.style='industrial';
  // Only the central DJ booth at the front is protected (6 × 3 metres).
  plan.zones=[{id:'hall-dj',name:'DJ-Pult',x:12/30,y:0,width:6/30,depth:3/42}];
  return validateRoomPlan(plan);
}

function roomMeshBuilder(name){
  const mesh={name,vertices:[],triangles:[],colors:[]};
  // Small faces also keep the canvas renderer's depth sorting stable.
  const face=([a,b,c,d],color)=>{
    const distance=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));
    const columns=Math.ceil(Math.max(distance(a,b),distance(d,c))/3),rows=Math.ceil(Math.max(distance(a,d),distance(b,c))/3);
    const point=(u,v)=>a.map((n,i)=>(1-v)*(n+(b[i]-n)*u)+v*(d[i]+(c[i]-d[i])*u));
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const u=col/columns,v=row/rows,U=(col+1)/columns,V=(row+1)/rows,start=mesh.vertices.length;
      mesh.vertices.push(point(u,v),point(U,v),point(U,V),point(u,V));
      mesh.triangles.push([start,start+1,start+2],[start,start+2,start+3]);mesh.colors.push(color,color);
    }
  };
  const box=(x,y,z,w,d,h,color)=>{
    const a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z];
    const top=p=>[p[0],p[1],z+h];
    face([top(a),top(b),top(c),top(e)],color);
    for(const [p,q] of [[a,b],[b,c],[c,e],[e,a]])face([p,q,top(q),top(p)],color);
  };
  return {mesh,face,box};
}


export function villageBarnRoom(){
  const plan=newRoomPlan(10,14,5);
  plan.name='Dorfscheune';plan.style='hall';plan.environmentBrightness=22;plan.representation='model';
  const {mesh,face,box}=roomMeshBuilder('Dorfscheune · Spitzdach, Podest rechts, Tanzfläche links');
  // Floorboards; omit the floor underneath the 45 cm high side platform.
  for(let i=0;i<20;i++){
    const x=-5+i*.5,color=i%3===0?'#69503a':'#59432f';
    if(x>=1.5){
      face([[x,0,0],[x+.5,0,0],[x+.5,6,0],[x,6,0]],color);
      face([[x,10,0],[x+.5,10,0],[x+.5,14,0],[x,14,0]],color);
    }else face([[x,0,0],[x+.5,0,0],[x+.5,14,0],[x,14,0]],color);
  }
  // Vertical timber cladding, with 3.2 m eaves and a 5 m ridge.
  for(const side of [-1,1])for(let y=0;y<14;y+=.5)face([[side*5,y,0],[side*5,y+.5,0],[side*5,y+.5,3.2],[side*5,y,3.2]],y%1===0?'#614a35':'#6c533c');
  for(const y of [0,14])for(let x=-5;x<5;x+=.5){
    const roof=x=>5-Math.abs(x)*1.8/5;
    face([[x,y,0],[x+.5,y,0],[x+.5,y,roof(x+.5)],[x,y,roof(x)]],x%1===0?'#614a35':'#6c533c');
  }
  face([[-5,0,3.2],[0,0,5],[0,14,5],[-5,14,3.2]],'#493929');
  face([[0,0,5],[5,0,3.2],[5,14,3.2],[0,14,5]],'#493929');
  // Visible posts and tie beams support a modest village-party rig.
  for(const y of [2,7,12]){
    for(const x of [-4.85,4.65])box(x,y,0,.2,.2,3.2,'#39291d');
    box(-4.85,y,2.95,9.7,.2,.2,'#39291d');
  }
  box(1.5,6,0,3.5,4,.45,'#75563b');
  box(.6,7,0,.45,1.6,.15,'#75563b');box(1.05,7,0,.45,1.6,.3,'#75563b');
  box(3.7,7.1,.45,.8,1.8,.9,'#443526');
  for(const y of [6.35,9.1])box(3.9,y,.45,.55,.55,1.1,'#23252a');
  // The open left half is the dance floor; the front remains an entrance aisle.
  const dance={x:.08,y:3/14,width:.48,depth:8/14};
  const sizes={moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15}};
  const add=(id,type,name,x,y,height,target)=>{
    plan.positions['barn-'+id]={type,name,x,y,height,rotation:0,size:{...sizes[type]},target,...(type==='moving'?{motionArea:{...dance}}:{})};
  };
  add('moving-front','moving','Tanzfläche · Moving Head vorne',.7,2.1,2.5,{x:-2,y:5});
  add('moving-back','moving','Tanzfläche · Moving Head hinten',.7,12.1,2.5,{x:-2,y:9});
  for(const [i,x,y,tx,ty] of [[1,-4.5,2.1,-2,5],[2,-4.5,7.1,-2,8],[3,4.4,7.1,-1,7],[4,-4.5,12.1,-2,10]])add('par-'+i,'spot','Querbalken · PAR '+i,x,y,2.6,{x:tx,y:ty});
  add('bar-front','bar','Podestkante · LED-Bar vorne',1.7,6.4,.55,{x:-1.5,y:5});
  add('bar-back','bar','Podestkante · LED-Bar hinten',1.7,9.6,.55,{x:-1.5,y:10});
  plan.mesh=mesh;plan.zones=[];
  return validateRoomPlan(plan);
}

export function festivalStageRoom({legacyLighting=false}={}){
  const plan=newRoomPlan(40,56,12);
  plan.outdoor=true;plan.name='Festival-Bühne';plan.style='industrial';plan.environmentBrightness=12;plan.representation='model';
  const {mesh,face,box}=roomMeshBuilder('Festival-Bühne · offene Fantasie-Kulisse unter freiem Himmel');
  // Grass/gravel site, with no perimeter walls or ceiling over the audience.
  const xs=[-20,-12,12,20],ys=[0,14,38,40,54,56];
  for(let x=0;x<xs.length-1;x++)for(let y=0;y<ys.length-1;y++){
    if(x===1&&y===3)continue;
    face([[xs[x],ys[y],0],[xs[x+1],ys[y],0],[xs[x+1],ys[y+1],0],[xs[x],ys[y+1],0]],x===1&&y===1?'#514a3b':'#35402c');
  }
  box(-12,40,0,24,14,1.2,'#333941');
  // Two side stairways, six 20 cm steps each.
  for(const side of [-1,1])for(let i=0;i<6;i++)box(side<0?-14:12,38.5+i*.5,0,2,.5,(i+1)*.2,'#4a5057');
  // Open-air fantasy facade: decorative towers and wings, never a roof.
  face([[-7,55.8,1.2],[7,55.8,1.2],[7,55.8,9.5],[-7,55.8,9.5]],'#233e42');
  for(const side of [-1,1]){
    for(const [x,y,h] of [[9,53.5,10.5],[15,50.5,8]]){
      box(side*x-1.25,y,0,2.5,2,h,'#46534b');
      box(side*x-1.4,y-.1,h-.5,2.8,2.2,.35,'#998054');
      const start=mesh.vertices.length;
      mesh.vertices.push([side*x-1.4,y-.1,h],[side*x+1.4,y-.1,h],[side*x,y+.9,Math.min(12,h+1.3)]);
      mesh.triangles.push([start,start+1,start+2]);mesh.colors.push('#8c754e');
    }
    for(let i=0;i<5;i++){
      const inner=7+i*1.6,outer=inner+1.5,top=9.2-i*.95,y=55.4-i*.7;
      face([[side*inner,y,1.2],[side*outer,y,1.2],[side*outer,y,top-1.1],[side*inner,y,top]],i%2?'#496c60':'#355b56');
      face([[side*inner,y-.03,top-.18],[side*outer,y-.03,top-1.28],[side*outer,y-.03,top-1.1],[side*inner,y-.03,top]],'#b09360');
    }
  }
  // A large ornamental sun surrounds the subdued A on the central backdrop.
  for(let i=0;i<48;i++){
    const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
    const point=(angle,r)=>[Math.cos(angle)*r,55,7.1+Math.sin(angle)*r];
    face([point(a,2.7),point(b,2.7),point(b,3.05),point(a,3.05)],'#ac915d');
  }
  box(-3,50,1.2,6,1.2,1,'#252c34');
  // Flown PA arrays and subwoofers flank the stage.
  for(const side of [-1,1]){
    for(let i=0;i<5;i++)box(side<0?-15.4:14.2,40.5,4.2+i*.65,1.2,.9,.6,'#171c23');
    for(let i=0;i<3;i++)box(side<0?-15.4:12,38.5+i*.9,0,3.4,.8,1.1,'#1d2229');
  }
  // Short front-of-stage barrier with open side access.
  for(let x=-11;x<12;x+=2){box(x,37.4,0,.08,.15,1.05,'#515960');box(x,37.4,.95,2,.15,.1,'#515960');}
  box(-3,8,0,6,4,.3,'#3a4248');box(-2.4,9,.3,4.8,1,1,'#262e36');
  plan.positions=festivalLighting(legacyLighting);
  plan.mesh=mesh;
  plan.zones=[{id:'festival-foh',name:'Regie / FOH',x:17/40,y:8/56,width:6/40,depth:4/56}];
  return validateRoomPlan(plan);
}

function festivalLighting(legacy=false){
  const plan={positions:{}};
  if(legacy){
  const sizes={moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15},truss:{width:6,depth:.3,height:.3}};
  let count=0;
  const dance={x:.175,y:15/56,width:.65,depth:21/56};
  const add=(type,name,x,y,height,target)=>{plan.positions['festival-'+ ++count]={type,name,x,y,height,rotation:0,size:{...sizes[type]},...(target?{target}:{}),...(type==='moving'?{motionArea:{...dance}}:{})};};
  for(let row=0;row<4;row++){
    const y=41+row*4;
    for(let i=0;i<4;i++)add('truss',`Bühne · Traverse ${row+1}/${i+1}`,-9+i*6,y,9.5);
    for(let i=0;i<8;i++)add('moving',`Festival · Moving Head ${row+1}/${i+1}`,-10.5+i*3,y,9,{x:(-10.5+i*3)*.9,y:24+row*3});
    for(let i=0;i<6;i++)add('spot',`Bühne · PAR ${row+1}/${i+1}`,-10+i*4,y,8.9,{x:-8+i*3.2,y:35});
    for(let i=0;i<4;i++)add('bar',`Bühne · LED-Bar ${row+1}/${i+1}`,-9+i*6,y,8.7,{x:-9+i*6,y:36});
  }
    return plan.positions;
  }
  const sizes={moving:{width:.34,depth:.34,height:.4},spot:{width:.25,depth:.25,height:.3},bar:{width:1,depth:.12,height:.15}};
  const audience={x:.1,y:16/56,width:.8,depth:20/56};
  let count=0;
  const add=(type,name,x,y,height,target,area=audience)=>{
    plan.positions[`festival-v2-${++count}`]={type,name,x,y,height,rotation:0,size:{...sizes[type]},target,...(type==='moving'?{motionArea:{...area}}:{})};
  };
  // Low stage-edge fans, with a second visual layer supplied by tower fixtures.
  for(let i=0;i<24;i++){
    const x=-11.5+i;
    add('moving',`Bühnenkante · Beam-Fächer ${i+1}`,x,40.4,1.3,{x:x*1.3,y:24});
  }
  for(const side of [-1,1]){
    const label=side<0?'Links':'Rechts';
    for(const [tower,x,y,top] of [['Innenturm',9,53.5,10.5],['Außenturm',15,50.5,8]]){
      for(let i=0;i<6;i++)add('moving',`${label} · ${tower} · Beam ${i+1}`,side*x,y-.4,2.1+i*(top-2.8)/5,{x:side*(3+i*2),y:21+i*2});
      for(let i=0;i<4;i++)add('spot',`${label} · ${tower} · Fassadenlicht ${i+1}`,side*(x-.9+i*.6),y-1.1,.3,{x:side*(x-.9+i*.6),y,z:top-.7});
    }
    for(let i=0;i<8;i++){
      const x=side*(6+i*1.4),height=9.4-i*.7,y=54.8-i*.45;
      add('moving',`${label} · Kulissenfächer ${i+1}`,x,y,height,{x:side*(2+i*1.7),y:31-i});
    }
    for(let i=0;i<6;i++){
      const x=side*(7+i*1.5),y=54.9-i*.65;
      add('bar',`${label} · Konturlicht ${i+1}`,x,y-.2,2.4+i*.45,{x,y:y+.3,z:8.5-i*.8});
      add('spot',`${label} · Flügel-Wash ${i+1}`,x,y-1,.3,{x,y:y+.3,z:6.5-i*.5});
    }
  }
  // A ring of real, individually editable fixtures, not painted-on decoration.
  for(let i=0;i<16;i++){
    const angle=(i+.5)*Math.PI/8,x=Math.cos(angle)*3.05,z=7.1+Math.sin(angle)*3.05;
    add('moving',`Sonnenring · Beam ${i+1}`,x,54.7,z,{x:x*3,y:27+Math.sin(angle)*7});
  }
  for(let i=0;i<12;i++){
    const x=-6.6+i*1.2;
    add('spot',`Zentrale Fassade · Wash ${i+1}`,x,54.5,1.3,{x,y:55.8,z:8.7});
    add('bar',`Bühnenkante · LED-Akzent ${i+1}`,-11+i*2,40.1,1.3,{x:-11+i*2,y:35});
  }
  for(let i=0;i<16;i++)add('spot',`Publikum · Akzent ${i+1}`,-11.25+i*1.5,41,4.5,{x:-15+i*2,y:27});
  return plan.positions;
}

// Upgrade the original preset rig in place, including renamed copies. Keep
// manually edited rigs intact, and retain the room identity, geometry and zones.
export function upgradeFestivalLighting(plan){
  // Earlier saved festival rigs can already have the new fixtures but still
  // lack the outdoor flag. Repair that independently of any lighting edits.
  if(plan.outdoor!==true&&plan.mesh?.name==='Festival-Bühne · offene Fantasie-Kulisse unter freiem Himmel')plan=validateRoomPlan({...plan,outdoor:true});
  if(!plan.positions?.['festival-1']||Object.keys(plan.positions).length!==88)return plan;
  const original=festivalStageRoom({legacyLighting:true});
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(!Object.keys(original.positions).every(id=>same(plan.positions[id],original.positions[id])))return plan;
  const updated=festivalStageRoom();
  return validateRoomPlan({...plan,outdoor:true,positions:updated.positions});
}

// Rename only the supplied preset. Preserve identity, fixtures and user edits.
export function upgradeFormationStage(plan){
 if(plan.name!=='Strobo-Bühne · 3 Ebenen'||!plan.positions?.['strobe-head-0-0'])return plan;
 return {...plan,name:'Formationsbühne · 3 Ebenen',...(plan.mesh?.name==='Strobo-Bühne · Bodenfächer und zwei erhöhte Strahlenreihen'?{mesh:{...plan.mesh,name:'Formationsbühne · Bodenfächer und zwei erhöhte Strahlenreihen'}}:{})};
}
