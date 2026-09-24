// Shared, world-space materials: no image downloads or renderer-specific shaders.
export const roomStyles={
  club:{label:'Club · dunkler Beton',floor:'#252a30',tile:'#2b3036',wall:'#303039',band:'#383842'},
  hall:{label:'Veranstaltungssaal · Holz & Putz',floor:'#40382f',tile:'#574839',wall:'#5d5b57',band:'#353638'},
  industrial:{label:'Industriehalle · Beton',floor:'#3d4245',tile:'#454a4d',wall:'#50565b',band:'#41474d'},
};
export const roomStyleId=value=>Object.hasOwn(roomStyles,value)?value:'club';
export const roomStyleOptions=()=>Object.entries(roomStyles).map(([id,s])=>`<option value="${id}">${s.label}</option>`).join('');

// Clip each material tile to the existing floor triangles (also works for concave rooms).
function clip(points,triangle){
  const area=triangle.reduce((n,p,i)=>{const q=triangle[(i+1)%3];return n+p[0]*q[1]-q[0]*p[1];},0),sign=Math.sign(area);
  for(let i=0;i<3&&points.length;i++){
    const a=triangle[i],b=triangle[(i+1)%3],side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),next=[];
    points.forEach((p,j)=>{const q=points[(j+1)%points.length],dp=side(p),dq=side(q);if(dp>=0)next.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push(p.map((v,k)=>v+(q[k]-v)*t));}});points=next;
  }
  return points;
}
const tint=(color,factor)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*factor)).toString(16).padStart(2,'0')).join('');
const variation=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
let cachedKey='',cachedTiles=[];
export function drawRoomMaterial(boundary,triangles,height,styleId,{polygon,wallVisible=()=>true}){
  const style=roomStyles[roomStyleId(styleId)],key=JSON.stringify([boundary,styleId,height]);
  if(key!==cachedKey){
    const tiles=[],xs=boundary.map(p=>p[0]),ys=boundary.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),detail=Math.max(1,Math.sqrt((maxX-minX)*(maxY-minY)/180));
    const sx=(styleId==='hall'?1.8:2.4)*detail,sy=(styleId==='hall'?.32:2.4)*detail,gap=styleId==='hall'?.004:.008;
    for(let row=Math.floor(minY/sy);row*sy<maxY;row++){
      const y=row*sy,shift=styleId==='hall'?(row%3)*sx/3:0;
      for(let col=Math.floor((minX-shift)/sx);col*sx+shift<maxX;col++){
        const x=col*sx+shift,noise=variation(col,row),color=(col+row)%5===0?style.tile:tint(style.tile,.94+noise*.12);
        const addFace=(shape,color,elevation=.002)=>{for(const t of triangles){const face=clip(shape,t);if(face.length>=3)tiles.push({points:face.map(p=>[...p,elevation]),color});}};
        addFace([[x+gap,y+gap],[x+sx-gap,y+gap],[x+sx-gap,y+sy-gap],[x+gap,y+sy-gap]],color);
        if(styleId==='hall'&&detail===1)for(let grain=0;grain<3;grain++){
          const gy=y+sy*(.2+grain*.25),start=x+.06+variation(row,grain+col)*.35,end=x+sx-.06;
          addFace([[start,gy],[end,gy+.003],[end,gy+.007],[start,gy+.004]],tint(color,.91),.003);
        }
      }
    }
    cachedKey=key;cachedTiles=tiles;

  }
  for(const face of cachedTiles)polygon(face.points,face.color);
  const winding=Math.sign(boundary.reduce((n,p,i)=>{const q=boundary[(i+1)%boundary.length];return n+p[0]*q[1]-q[0]*p[1];},0));
  boundary.forEach((a,i)=>{
    const b=boundary[(i+1)%boundary.length];if(!wallVisible(a,b,winding))return;
    polygon([[...a,Math.min(.15,height)],[...b,Math.min(.15,height)],[...b,height],[...a,height]],style.wall);
    // Recessed material joints and a restrained ceiling reveal add scale without
    // adding fictitious equipment or changing the usable room dimensions.
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length*winding*.003,ny=(b[0]-a[0])/length*winding*.003;
    const at=(t,z)=>[a[0]+(b[0]-a[0])*t+nx,a[1]+(b[1]-a[1])*t+ny,z];
    for(let d=2.4;d<length-.1;d+=2.4){const t=d/length,half=.003/length;polygon([at(t-half,.15),at(t+half,.15),at(t+half,height-.07),at(t-half,height-.07)],tint(style.wall,.83));}
    polygon([at(0,height-.055),at(1,height-.055),at(1,height-.035),at(0,height-.035)],tint(style.wall,.66));
    // A low skirting strip anchors the room without competing with the light show.
    polygon([[...a,0],[...b,0],[...b,Math.min(.15,height)],[...a,Math.min(.15,height)]],style.band);
  });
}

// Environment light is independent of fixture power and the music/light master.
export const environmentBrightness=value=>Math.max(0,Math.min(100,Number.isFinite(value)?value:30));
export const sceneEnvironmentBrightness=layout=>environmentBrightness(layout.roomPlan?.environmentBrightness??layout.environmentBrightness);
export function environmentColor(color,brightness){
  if(!color||brightness===100)return color;
  return '#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*brightness/100).toString(16).padStart(2,'0')).join('');
}
