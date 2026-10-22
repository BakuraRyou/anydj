// lamejs 1.2.1 (LGPL): separate, unmodified encoder; see lame-license.txt.
let encoder,lossless;

onmessage=async({data})=>{
 try{
  if(data.type==='start'&&data.format&&data.format!=='mp3'){const {createLosslessEncoder}=await import('./lossless-audio-encoder.js');lossless=createLosslessEncoder(data.format,{total:data.total,sampleRate:44100});encoder=null;postMessage({ready:true,parts:[lossless.header]});return;}
  if(data.type==='start'){lossless=null;importScripts('./lame.min.js');encoder=new lamejs.Mp3Encoder(2,44100,data.bitrate===320?320:192);postMessage({ready:true});return;}
  if(lossless){const parts=data.type==='finish'?lossless.finish():data.type==='chunk'?lossless.encode(data.left,data.right):null;if(!parts)throw Error('Unbekannter Exportauftrag.');postMessage({parts,done:data.type==='finish'});if(data.type==='finish')lossless=null;return;}
  if(!encoder)throw Error('MP3-Encoder ist nicht bereit.');
  if(data.type==='finish'){const bytes=encoder.flush();postMessage({bytes:new Uint8Array(bytes),done:true});encoder=null;return;}
  if(data.type!=='chunk')throw Error('Unbekannter Exportauftrag.');
  const {left,right}=data,parts=[];
  for(let offset=0;offset<left.length;offset+=1152){
   const a=new Int16Array(Math.min(1152,left.length-offset)),b=new Int16Array(a.length);
   for(let j=0;j<a.length;j++){
    const x=Math.max(-1,Math.min(1,left[offset+j])),y=Math.max(-1,Math.min(1,right[offset+j]));
    a[j]=Math.round(x*(x<0?32768:32767));b[j]=Math.round(y*(y<0?32768:32767));
   }
   const bytes=encoder.encodeBuffer(a,b);if(bytes.length)parts.push(new Uint8Array(bytes));
  }
  postMessage({parts});
 }catch(error){postMessage({error:error.message});}
};
