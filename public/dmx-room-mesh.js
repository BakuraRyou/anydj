// Compact, portable static meshes fit the existing room export and headset relay.
export const meshTriangleLimit=5000;
export const modelFileLimit=10*1024*1024;
const finite=v=>Number.isFinite(v)&&Math.abs(v)<=1e6;
const fail=message=>{throw Error(message||'Ungültige Modellgeometrie.');};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);

// Project onto the dominant plane before ear clipping; scan walls need not be axis aligned.
export function surfaceTriangles(points){
  if(!Array.isArray(points)||points.length<3||points.length>512||points.some(p=>!Array.isArray(p)||p.length!==3||!p.every(finite)))fail();
  let normal=[0,0,0];
  points.forEach((p,i)=>{const q=points[(i+1)%points.length];normal=normal.map((v,k)=>v+(p[(k+1)%3]-q[(k+1)%3])*(p[(k+2)%3]+q[(k+2)%3]));});
  const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  if(Math.abs(normal[axis])<1e-9)return [];
  const flat=points.map(p=>p.filter((_,k)=>k!==axis)),ids=points.map((_,i)=>i),out=[];
  const side=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const sign=Math.sign(flat.reduce((n,p,i)=>{const q=flat[(i+1)%flat.length];return n+p[0]*q[1]-q[0]*p[1];},0));
  while(ids.length>2){
    let cut=false;
    for(let i=0;i<ids.length;i++){
      const tri=[ids[(i+ids.length-1)%ids.length],ids[i],ids[(i+1)%ids.length]], [a,b,c]=tri.map(j=>flat[j]);
      const turn=sign*side(a,b,c);
      if(Math.abs(turn)<1e-9){ids.splice(i,1);cut=true;break;}
      if(turn<0||ids.some(j=>!tri.includes(j)&&sign*side(a,b,flat[j])>=-1e-9&&sign*side(b,c,flat[j])>=-1e-9&&sign*side(c,a,flat[j])>=-1e-9))continue;
      out.push(tri.map(j=>points[j]));ids.splice(i,1);cut=true;break;
    }
    if(!cut)fail('Eine Modellfläche lässt sich nicht triangulieren. Bitte als Dreiecke exportieren.');
  }
  return out;
}
export function validateRoomMesh(value){
  if(!value||typeof value.name!=='string'||value.name.length>100||!Array.isArray(value.vertices)||value.vertices.length<3||value.vertices.length>meshTriangleLimit*3||!Array.isArray(value.triangles)||!value.triangles.length||value.triangles.length>meshTriangleLimit||!Array.isArray(value.colors)||value.colors.length!==value.triangles.length)fail();
  if(value.vertices.some(p=>!Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>100)))fail();
  if(value.triangles.some(t=>!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=value.vertices.length)))fail();
  if(value.colors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))fail();
  return {name:value.name,vertices:value.vertices.map(p=>[...p]),triangles:value.triangles.map(t=>[...t]),colors:[...value.colors]};
}
function collector(){
  const faces=[];
  return {faces,add(points,color='#78818a'){
    if(faces.length>=meshTriangleLimit)fail(`Das Modell hat zu viele Dreiecke (maximal ${meshTriangleLimit}). Bitte vor dem Import vereinfachen.`);
    if(points.length!==3||points.some(p=>!p.every(finite)))fail();
    if(Math.hypot(...cross(sub(points[1],points[0]),sub(points[2],points[0])))>1e-10)faces.push({points,color});
  }};
}
function readOBJ(text,out){
  const vertices=[];
  for(const line of text.split(/\r?\n/)){
    const [type,...args]=line.replace(/#.*/,'').trim().split(/\s+/);
    if(type==='v'){
      const p=args.slice(0,3).map(Number);if(p.length!==3||!p.every(finite))fail();vertices.push(p);
      if(vertices.length>200000)fail('Das Modell enthält zu viele Punkte. Bitte vereinfachen.');
    }else if(type==='f'){
      if(args.length>512)fail('Eine Fläche hat zu viele Ecken. Bitte als Dreiecke exportieren.');
      const points=args.map(part=>{const n=Number(part.split('/')[0]),i=n<0?vertices.length+n:n-1;if(!Number.isInteger(n)||!n||!vertices[i])fail();return vertices[i];});
      for(const triangle of surfaceTriangles(points))out.add(triangle);
    }
  }
  return /^(mtllib|usemtl)\s/m.test(text)?['OBJ-Materialien und Bildtexturen werden nicht übernommen.']:[];
}
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){return Array.from({length:16},(_,i)=>{const r=i%4,c=Math.floor(i/4);return a[r]*b[c*4]+a[r+4]*b[c*4+1]+a[r+8]*b[c*4+2]+a[r+12]*b[c*4+3];});}
function nodeMatrix(node){
  if(node.matrix){if(node.matrix.length!==16||!node.matrix.every(finite))fail();return node.matrix;}
  const t=node.translation||[0,0,0],s=node.scale||[1,1,1],q=node.rotation||[0,0,0,1];
  if(t.length!==3||s.length!==3||q.length!==4||![...t,...s,...q].every(finite))fail();
  const [x,y,z,w]=q;
  return [(1-2*y*y-2*z*z)*s[0],(2*x*y+2*w*z)*s[0],(2*x*z-2*w*y)*s[0],0,(2*x*y-2*w*z)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*w*x)*s[1],0,(2*x*z+2*w*y)*s[2],(2*y*z-2*w*x)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
}
function readGLTF(bytes,isGLB,out){
  let json,bin=null;
  if(isGLB){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes.length<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)fail('Ungültige GLB-Datei (Version 2 erforderlich).');
    for(let offset=12;offset<bytes.length;){
      if(offset+8>bytes.length)fail();const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
      if(size%4||offset+size>bytes.length)fail();const chunk=bytes.subarray(offset,offset+size);
      if(type===0x4e4f534a){if(json||offset!==20)fail();json=JSON.parse(new TextDecoder().decode(chunk));}
      if(type===0x004e4942){if(bin)fail();bin=chunk;}offset+=size;
    }
  }else json=JSON.parse(new TextDecoder().decode(bytes));
  if(json?.asset?.version!=='2.0')fail('Bitte als glTF 2.0 oder GLB 2.0 exportieren.');
  if((json.extensionsRequired||[]).some(x=>x!=='KHR_materials_unlit'))fail('Dieses Modell benötigt nicht unterstützte Erweiterungen. Bitte unkomprimiertes GLB ohne Draco/Meshopt exportieren.');
  if(json.skins?.length||json.animations?.length)fail('Bitte ein statisches Raummodell ohne Animation oder Skelett exportieren.');
  const buffers=(json.buffers||[]).map((b,i)=>{
    let data;
    if(b.uri){
      if(!/^data:[^,]*;base64,/.test(b.uri))fail('Die glTF-Datei verweist auf externe Dateien. Bitte als einzelne GLB-Datei oder glTF mit eingebetteten Daten exportieren.');
      const raw=atob(b.uri.slice(b.uri.indexOf(',')+1));data=Uint8Array.from(raw,c=>c.charCodeAt(0));
    }else if(i===0)data=bin;
    if(!data||!Number.isInteger(b.byteLength)||b.byteLength<0||b.byteLength>data.length)fail();return data.subarray(0,b.byteLength);
  });
  const accessorCache=new Map();
  function accessor(index){
    if(accessorCache.has(index))return accessorCache.get(index);
    const a=json.accessors?.[index],v=json.bufferViews?.[a?.bufferView],data=buffers[v?.buffer],components={SCALAR:1,VEC3:3,VEC4:4}[a?.type],format={5121:[1,'getUint8',255],5123:[2,'getUint16',65535],5125:[4,'getUint32',4294967295],5126:[4,'getFloat32',1]}[a?.componentType];
    if(!a||a.sparse||!data||!components||!format||!Number.isInteger(a.count)||a.count<1||a.count>200000)fail('Nicht unterstützte oder ungültige glTF-Punktdaten.');
    const [size,read,max]=format,offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size*components;
    if(![offset,stride,v.byteLength,v.byteOffset||0,a.byteOffset||0].every(Number.isInteger)||offset<0||stride<size*components||v.byteLength<0||(a.byteOffset||0)<0||(v.byteOffset||0)<0||(a.byteOffset||0)+(a.count-1)*stride+size*components>v.byteLength||(v.byteOffset||0)+v.byteLength>data.length)fail();
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength),result=Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,k)=>view[read](offset+i*stride+k*size,true)/(a.normalized?max:1)));
    if(result.some(p=>!p.every(finite)))fail();accessorCache.set(index,result);return result;
  }
  const warnings=new Set(),visited=new Set();let count=0;
  function visit(index,parent,depth=0){
    if(depth>128||visited.has(index)||++count>10000)fail('Ungültige oder zu große Modellhierarchie.');
    const node=json.nodes?.[index];if(!node)fail();visited.add(index);
    const matrix=multiply(parent,nodeMatrix(node));
    if(node.mesh!==undefined){
      const mesh=json.meshes?.[node.mesh];if(!mesh?.primitives)fail();
      for(const primitive of mesh.primitives){
        if(primitive.targets?.length)fail('Bitte ein statisches Modell ohne Morph-Ziele exportieren.');
        if(primitive.mode!==undefined&&primitive.mode!==4)fail('Bitte das Modell als Dreiecke exportieren.');
        if(json.accessors?.[primitive.attributes?.POSITION]?.type!=='VEC3')fail();
        const positions=accessor(primitive.attributes.POSITION),colors=primitive.attributes.COLOR_0===undefined?null:accessor(primitive.attributes.COLOR_0);
        if(colors&&(colors.length!==positions.length||![3,4].includes(colors[0].length)))fail();
        const indices=primitive.indices===undefined?positions.map((_,i)=>i):accessor(primitive.indices).map(v=>{if(v.length!==1)return NaN;return v[0];});
        if(indices.length%3)fail();
        const material=json.materials?.[primitive.material],factor=material?.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
        if(factor.length!==4||factor.some(v=>!Number.isFinite(v)||v<0||v>1))fail();
        if(material?.pbrMetallicRoughness?.baseColorTexture||json.images?.length)warnings.add('Bildtexturen werden durch Materialgrundfarben ersetzt.');
        if(material?.alphaMode&&material.alphaMode!=='OPAQUE')warnings.add('Transparente Materialien werden deckend dargestellt.');
        for(let i=0;i<indices.length;i+=3){
          const ids=indices.slice(i,i+3);if(ids.some(id=>!Number.isInteger(id)||id<0||id>=positions.length))fail();
          const points=ids.map(id=>{const p=positions[id];return [0,1,2].map(k=>matrix[k]*p[0]+matrix[k+4]*p[1]+matrix[k+8]*p[2]+matrix[k+12]);});
          const color='#'+factor.slice(0,3).map((v,k)=>{const linear=Math.max(0,Math.min(1,v*(colors?ids.reduce((s,id)=>s+colors[id][k],0)/3:1)));return Math.round(255*(linear<=.0031308?linear*12.92:1.055*linear**(1/2.4)-.055)).toString(16).padStart(2,'0');}).join('');
          out.add(points,color);
        }
      }
    }
    for(const child of node.children||[])visit(child,matrix,depth+1);
    visited.delete(index);
  }
  const roots=json.scenes?.[json.scene??0]?.nodes;
  if(!Array.isArray(roots)||!roots.length)fail('Das Modell enthält keine darstellbare Szene.');
  for(const index of roots)visit(index,identity());
  return [...warnings];
}
export function importRoomModel(data,name,{scale=1,up='y',rotation=0}={}){
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
  if(!bytes.length||bytes.length>modelFileLimit)fail('Die Modelldatei ist zu groß oder leer (maximal 10 MB).');
  if(![1,.01,.001].includes(scale)||!['y','z'].includes(up)||![0,90,180,270].includes(rotation))fail('Ungültiger Maßstab oder ungültige Ausrichtung.');
  const out=collector(),extension=name.split('.').at(-1).toLowerCase();let warnings;
  if(extension==='obj')warnings=readOBJ(new TextDecoder().decode(bytes),out);
  else if(['glb','gltf'].includes(extension))warnings=readGLTF(bytes,extension==='glb',out);
  else fail('Bitte eine GLB-, glTF- oder OBJ-Datei auswählen.');
  if(!out.faces.length)fail('Das Modell enthält keine Dreiecksflächen.');
  const angle=rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const face of out.faces)face.points=face.points.map(p=>{const [x,y,z]=up==='y'?[p[0],-p[2],p[1]]:p;const point=[(x*c-y*s)*scale,(x*s+y*c)*scale,z*scale];point.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});return point;});
  const [width,depth,height]=max.map((v,k)=>v-min[k]);
  if(width<.5||depth<.5||height<.5||width>60||depth>60||height>15)fail('Das Modell muss zwischen 0,5 und 60 m breit/tief und 0,5 bis 15 m hoch sein. Prüfe Einheit und Hochachse.');
  const vertices=[],triangles=[],colors=[],ids=new Map();
  for(const face of out.faces){
    triangles.push(face.points.map(p=>{const point=p.map((v,k)=>Math.round((v-(k===0?(min[k]+max[k])/2:min[k]))*10000)/10000),key=point.join(',');if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(point);}return ids.get(key);}));colors.push(face.color);
  }
  return {mesh:validateRoomMesh({name:name.slice(0,100),vertices,triangles,colors}),width:Math.ceil(width*10000)/10000,depth:Math.ceil(depth*10000)/10000,height:Math.ceil(height*10000)/10000,warnings};
}
