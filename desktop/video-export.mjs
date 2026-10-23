import {spawn} from 'node:child_process';
import {mkdtemp,open,rm,rename,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {constants} from 'node:fs';
const require=createRequire(import.meta.url);

export async function resolveVideoEncoder({packaged=false,resourcesPath}={}){
 const executable=packaged?join(resourcesPath,'video',process.platform==='win32'?'ffmpeg.exe':'ffmpeg'):require('ffmpeg-static');
 // pnpm may intentionally disable dependency install scripts. Development can
 // use an installed system encoder; packaged apps carry their own executable.
 if(!packaged)try{await access(executable,constants.X_OK);}catch{return 'ffmpeg';}
 return executable;
}

export function videoEncoderError({code,signal,frames,expected,width,height,log=''}){
 const reason=signal?`Signal ${signal}`:Number.isInteger(code)?`Exitcode ${code}`:'unbekannter Prozessfehler';
 return Error(`MP4-Encoder beendet (${reason}, ${width} × ${height}, Bild ${frames}/${expected}).${log.trim()?' '+log.trim():''}`);
}
export function videoEncoderArgs({width,height,fps,duration},audioPath,temporary,format='jpeg'){
 return ['-hide_banner','-loglevel','error','-y',
  // Limit decoder/filter pools as well as x264. Output -threads alone does not
  // limit input frame buffering, especially on machines with many CPU cores.
  '-filter_threads','2','-filter_complex_threads','2',
  ...(format==='h264'?['-f','h264','-r',String(fps)]:['-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg']),'-threads','1',
  '-probesize','1048576','-analyzeduration','1','-fpsprobesize','0','-thread_queue_size','2','-i','pipe:0',
  '-threads','1','-i',audioPath,'-map','0:v:0','-map','1:a:0',
  ...(format==='h264'?['-c:v','copy']:['-vf',`scale=${width}:${height}`,'-c:v','libx264','-preset','veryfast','-threads','4','-rc-lookahead','8','-crf','20','-pix_fmt','yuv420p']),
  '-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart','-f','mp4',temporary];
}

export function videoSettings(value){
 const {width=1920,height=1080,fps=30,duration}=value||{};
 if(![[1920,1080],[1280,720]].some(([w,h])=>w===width&&h===height)||fps!==30||!Number.isFinite(duration)||duration<=0||duration>21600)throw Error('MP4 unterstützt 720p oder 1080p mit 30 FPS und maximal sechs Stunden.');
 return {width,height,fps,duration};
}
export async function createVideoExportJob({ffmpeg,destination,settings,tempRoot=tmpdir()}){
 settings=videoSettings(settings);
 const directory=await mkdtemp(join(tempRoot,'anydj-video-')),audioPath=join(directory,'mix.wav');
 const temporary=join(dirname(destination),`.anydj-${randomUUID()}.mp4`);
 let audio=await open(audioPath,'w'),child,completion,cancelTask,log='',failure=null,phase='audio',format='jpeg',frames=0,busy=false;
 const expected=Math.ceil(settings.duration*settings.fps);
 const check=()=>{if(failure)throw failure;if(phase==='cancelled')throw Error('Export abgebrochen.');};
 const bytes=(value,max)=>{if(!(value instanceof Uint8Array)||!value.byteLength||value.byteLength>max)throw Error('Ungültige Exportdaten.');return value;};
 const serialized=fn=>async(...args)=>{check();if(busy)throw Error('Exportauftrag läuft bereits.');busy=true;try{return await fn(...args);}finally{busy=false;}};
 async function clean(){if(audio){await audio.close().catch(()=>{});audio=null;}await rm(directory,{recursive:true,force:true});await rm(temporary,{force:true});}
 return {
  audio:serialized(async data=>{if(phase!=='audio')throw Error('Audioexport ist bereits abgeschlossen.');data=bytes(data,8*1024*1024);let offset=0;while(offset<data.length){const {bytesWritten}=await audio.write(data,offset,data.length-offset);offset+=bytesWritten;}}),
  startFrames:serialized(async(options)=>{
   if(options?.format!==undefined&&!['jpeg','h264'].includes(options.format))throw Error('Ungültiges Videoformat.');
   format=options?.format??'jpeg';
   if(phase!=='audio')throw Error('Videoexport wurde bereits gestartet.');await audio.close();audio=null;phase='video';
   child=spawn(ffmpeg,videoEncoderArgs(settings,audioPath,temporary,format),{stdio:['pipe','ignore','pipe'],windowsHide:true});
   child.stderr.on('data',chunk=>{log=(log+chunk).slice(-4000);});
   // A broken pipe often precedes 'close'. Keep the final exit/signal instead
   // of replacing the actual process failure with a generic EPIPE message.
   child.stdin.on('error',()=>{});
   completion=new Promise((resolve,reject)=>{child.once('error',error=>{failure=Error('MP4-Encoder konnte nicht gestartet werden: '+error.message);reject(failure);});child.once('close',(code,signal)=>{if(code===0)resolve();else{failure??=videoEncoderError({...settings,code,signal,frames,expected,log});reject(failure);}});});
   completion.catch(()=>{});
  }),
  frame:serialized(async data=>{
   if(phase!=='video'||frames>=expected)throw Error('Unerwartetes Videobild.');data=bytes(data,16*1024*1024);
   if(format==='jpeg'&&(data[0]!==255||data[1]!==216))throw Error('JPEG-Videobild fehlt.');
   if(format==='h264'&&!(data[0]===0&&data[1]===0&&(data[2]===1||data[2]===0&&data[3]===1)))throw Error('H.264-Videobild fehlt.');
   await new Promise((resolve,reject)=>child.stdin.write(data,error=>{
    if(!error){resolve();return;}
    completion.then(()=>reject(Error(`MP4-Encoder wurde vorzeitig beendet (Bild ${frames}/${expected}).`)),reject);
   }));check();frames++;
  }),
  finish:serialized(async()=>{
   if(phase!=='video'||frames!==expected)throw Error('Die Bildfolge ist noch nicht vollständig.');
   child.stdin.end();await completion;check();await rename(temporary,destination);phase='done';await clean();return {name:basename(destination)};
  }),
  cancel(){
   if(phase==='done')return Promise.resolve();
   return cancelTask??=(async()=>{
    phase='cancelled';child?.stdin.destroy();child?.kill();
    // FFmpeg can be probing a pipe when cancelled. Closing stdin and bounding
    // termination also handles that state, before any complete video frame.
    const timeout=setTimeout(()=>{if(child?.exitCode===null)child.kill('SIGKILL');},1000);timeout.unref();
    try{if(completion)await completion.catch(()=>{});}finally{clearTimeout(timeout);await clean();}
   })();
  },
 };
}

export function installVideoExport({ipcMain,dialog,origin,getWindow,packaged=false,resourcesPath}){
 let current=null,opening=false;
 // Renderer abort and finally, navigation and shutdown can close the same job.
 // Remember recent IDs so cancellation is idempotent without accepting foreign IDs.
 const retired=new Set();
 const retire=id=>{retired.add(id);if(retired.size>32)retired.delete(retired.values().next().value);};
 const trusted=event=>{const owner=getWindow()?.webContents;return owner&&event.sender===owner&&event.senderFrame===owner.mainFrame&&new URL(event.senderFrame.url).origin===origin;};
 const job=(event,id)=>{if(!trusted(event)||!current||current.id!==id)throw Error('Unzulässiger Videoexport.');return current.job;};
 const restoreThrottling=value=>{if(value&&!value.owner.isDestroyed?.())value.owner.setBackgroundThrottling?.(value.throttling);};
 const close=async expected=>{if(expected&&current?.job!==expected)return;const value=current;current=null;if(value)retire(value.id);if(value)try{await value.job.cancel();}finally{restoreThrottling(value);}};
 ipcMain.handle('anydj:video-begin',async(event,value)=>{
  if(!trusted(event))throw Error('Unzulässiger Videoexport.');if(current||opening)throw Error('Ein Videoexport läuft bereits.');
  const settings=videoSettings(value);opening=true;
  try{
   const choice=await dialog.showSaveDialog(getWindow(),{title:'Playlist als MP4 speichern',defaultPath:'AnyDj-Lichtshow.mp4',filters:[{name:'MP4-Video',extensions:['mp4']}]});
   if(choice.canceled||!choice.filePath)return null;
   if(!trusted(event))throw Error('Das Exportfenster wurde geschlossen.');
   const ffmpeg=await resolveVideoEncoder({packaged,resourcesPath});
   const id=randomUUID(),owner=event.sender,job=await createVideoExportJob({ffmpeg,destination:choice.filePath,settings});
   current={id,job,owner,throttling:owner.getBackgroundThrottling?.()??true};
   // Offline rendering must keep running at full speed when the user switches
   // apps or minimizes the main window. Restore the prior policy afterwards.
   owner.setBackgroundThrottling?.(false);return {id};
  }finally{opening=false;}
 });
 for(const [channel,method] of [['audio','audio'],['start','startFrames'],['frame','frame'],['finish','finish']])ipcMain.handle('anydj:video-'+channel,async(event,id,data)=>{
  const value=job(event,id);try{const result=await value[method](data);if(method==='finish'&&current?.job===value){retire(current.id);restoreThrottling(current);current=null;}return result;}catch(error){await close(value);throw error;}
 });
 ipcMain.handle('anydj:video-cancel',async(event,id)=>{
  if(!trusted(event))throw Error('Unzulässiger Videoexport.');
  if(retired.has(id))return;
  await close(job(event,id));
 });
 return {close};
}
