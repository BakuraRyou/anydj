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
  const mesh={name:'Club mit Bühne, Publikumsfläche und Bühnenhintergrund',vertices:[],triangles:[],colors:[]};
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
