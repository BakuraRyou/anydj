// Keep at most two GPU snapshots/encoded writes in flight, independent of playlist length.
export async function createQueueVideoEncoder({width,height,fps,onChunk,Encoder=globalThis.VideoEncoder,Frame=globalThis.VideoFrame}){
 if(!Encoder||!Frame)return null;
 const config={codec:'avc1.640028',width,height,framerate:fps,bitrate:width*height*10,latencyMode:'realtime',avc:{format:'annexb'}};
 try{if(!(await Encoder.isConfigSupported(config)).supported)return null;}catch{return null;}
 let failure=null,submitted=0,completed=0,closed=false,writes=Promise.resolve(),wake;
 const notify=()=>{wake?.();wake=null;};
 const encoder=new Encoder({error:error=>{failure=error;notify();},output:chunk=>{
  const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);
  writes=writes.then(()=>onChunk(data)).then(()=>{completed++;notify();},error=>{failure=error;notify();});
 }});
 try{encoder.configure(config);}catch{encoder.close();return null;}
 const check=signal=>{signal?.throwIfAborted();if(failure)throw failure;};
 return {
  async frame(canvas,index,signal){
   check(signal);
   const frame=new Frame(canvas,{timestamp:Math.round(index*1e6/fps),duration:Math.round(1e6/fps)});
   try{encoder.encode(frame,{keyFrame:index%(fps*2)===0});submitted++;}finally{frame.close();}
   while(submitted-completed>=2){
    check(signal);
    await new Promise(resolve=>{const done=()=>{signal?.removeEventListener('abort',done);resolve();};wake=done;signal?.addEventListener('abort',done,{once:true});if(signal?.aborted)done();});
   }
   check(signal);
  },
  async finish(signal){check(signal);await encoder.flush();await writes;check(signal);if(completed!==submitted)throw Error('Die H.264-Bildfolge ist unvollständig.');},
  destroy(){if(closed)return;closed=true;encoder.close();notify();},
 };
}
