import {newRoomPlan,validateRoomPlan} from './dmx-ar-model.js';

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
