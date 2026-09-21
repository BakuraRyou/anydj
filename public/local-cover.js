// Embedded artwork only: no network lookups or linked pictures.
const text=(b,a,n)=>String.fromCharCode(...b.subarray(a,a+n));
const uint=(b,p)=>((b[p]*0x1000000)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3]);
const sync=(b,p)=>((b[p]&127)*0x200000+(b[p+1]&127)*16384+(b[p+2]&127)*128+(b[p+3]&127));
const deunsync=b=>b.filter((v,i)=>!(v===0&&b[i-1]===255));
function picture(b){
 if(!b?.length||b.length>8*1024*1024)return null;
 const type=b[0]===255&&b[1]===216?'image/jpeg':text(b,0,8)==='\x89PNG\r\n\x1a\n'?'image/png':text(b,0,4)==='RIFF'&&text(b,8,4)==='WEBP'?'image/webp':null;
 return type?new Blob([b],{type}):null;
}
function id3(bytes){
 const version=bytes[3];if(version<2||version>4||bytes.length<10)return null;
 let b=bytes.subarray(10,Math.min(bytes.length,10+sync(bytes,6)));
 if(version<4&&(bytes[5]&128))b=deunsync(b);
 let p=0;if(bytes[5]&64){if(version===2)return null;p=version===4?sync(b,0):4+uint(b,0);}
 let fallback=null;
 while(p+(version===2?6:10)<=b.length){
  const short=version===2,id=text(b,p,short?3:4),size=short?(b[p+3]<<16|b[p+4]<<8|b[p+5]):version===4?sync(b,p+4):uint(b,p+4),header=short?6:10;
  if(!size||size<0||p+header+size>b.length)break;
  const flags=short?0:b[p+9];let data=b.subarray(p+header,p+header+size);p+=header+size;
  if(id!=='APIC'&&id!=='PIC')continue;
  if(version===3&&(flags&224)||version===4&&(flags&77))continue;
  if(version===4&&((flags&2)||(bytes[5]&128)))data=deunsync(data);
  const encoding=data[0];let q=short?4:data.indexOf(0,1)+1;if(q<1||q>=data.length)continue;
  const front=data[q++]===3,wide=encoding===1||encoding===2;
  if(wide){while(q+1<data.length&&(data[q]!==0||data[q+1]!==0))q+=2;q+=2;}
  else {const end=data.indexOf(0,q);if(end<0)continue;q=end+1;}
  const image=picture(data.subarray(q));if(image&&front)return image;fallback??=image;
 }
 return fallback;
}
function flac(b){
 let p=4,fallback=null;
 while(p+4<=b.length){const type=b[p]&127,last=b[p]&128,size=b[p+1]<<16|b[p+2]<<8|b[p+3];p+=4;if(p+size>b.length)break;
  if(type===6){const end=p+size,front=uint(b,p)===3;let q=p+4;const mime=uint(b,q);q+=4+mime;if(q+4<=end){const desc=uint(b,q);q+=4+desc+16;if(q+4<=end){const len=uint(b,q);q+=4;if(q+len<=end){const image=picture(b.subarray(q,q+len));if(image&&front)return image;fallback??=image;}}}}
  p+=size;if(last)break;
 }return fallback;
}
function atoms(b,start,end,depth=0){
 if(depth>6)return null;
 for(let p=start;p+8<=end;){let size=uint(b,p),header=8;const type=text(b,p+4,4);
  if(size===1){if(p+16>end)return null;size=uint(b,p+8)*4294967296+uint(b,p+12);header=16;}else if(size===0)size=end-p;
  if(size<header||p+size>end)return null;
  if(type==='covr'){for(let q=p+header;q+16<=p+size;){const n=uint(b,q);if(n<16||q+n>p+size)break;if(text(b,q+4,4)==='data'){const image=picture(b.subarray(q+16,q+n));if(image)return image;}q+=n;}}
  if(['moov','udta','meta','ilst'].includes(type)){const image=atoms(b,p+header+(type==='meta'?4:0),p+size,depth+1);if(image)return image;}
  p+=size;
 }return null;
}
export function embeddedCover(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(text(b,0,3)==='ID3')return id3(b);
 if(text(b,0,4)==='fLaC')return flac(b);
 if(text(b,4,4)==='ftyp')return atoms(b,0,b.length);
 if(text(b,0,4)==='RIFF'&&text(b,8,4)==='WAVE'){
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  for(let p=12;p+8<=b.length;){const n=view.getUint32(p+4,true);if(p+8+n>b.length)break;if(text(b,p,4).toLowerCase()==='id3 ')return id3(b.subarray(p+8,p+8+n));p+=8+n+(n%2);}
 }
 return null;
}
export function createLocalCovers({save,changed}){
 const pending=new WeakSet(),attempts=new WeakMap();const queue=[];let running=false;
 const key=t=>JSON.stringify([t.name,t.size,t.lastModified]);
 async function drain(){
  if(running)return;running=true;
  try{while(queue.length){const t=queue.shift(),identity=key(t);try{
   if(t.deleted||t.missing||t.pendingChange)continue;
   attempts.set(t,t.file||t.handle);let file=t.file;
   if(!file&&t.handle&&await t.handle.queryPermission({mode:'read'})==='granted')file=await t.handle.getFile();
   if(!file)continue;
   if(key(file)!==identity||file.size>50*1024*1024)continue;
   const blob=embeddedCover(await file.arrayBuffer());let cover=null;
   if(blob){const bitmap=await createImageBitmap(blob);try{const canvas=document.createElement('canvas');const ratio=120/Math.max(bitmap.width,bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);cover=canvas.toDataURL('image/jpeg',.82);}finally{bitmap.close();}}
   if(t.deleted||key(t)!==identity)continue;
   t.cover=cover;t.coverKey=identity;await save(t);changed();
  }catch{/* Damaged or unsupported artwork must not block music. */}finally{pending.delete(t);}}
  }finally{running=false;}
 }
 return {attach(info,t){
  const identity=key(t);
  if(t.coverKey===identity&&typeof t.cover==='string'&&t.cover.startsWith('data:image/jpeg;base64,')){
   const image=document.createElement('img');image.className='dj-track-cover';image.src=t.cover;image.alt='';image.width=36;image.height=36;image.loading='lazy';image.draggable=false;image.onerror=()=>image.remove();info.prepend(image);
  }
  if(t.coverKey!==identity&&!pending.has(t)&&(!attempts.has(t)||attempts.get(t)!==(t.file||t.handle))&&(t.file||t.handle)){
   pending.add(t);queue.push(t);void drain();
  }
 }};
}
