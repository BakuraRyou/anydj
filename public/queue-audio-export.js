import {transitionAudioGains} from './transition-audio.js';
import {transitionBassDb} from './musical-transition.js';
import {audioExportFormat} from './audio-export-formats.js';

export function exportGainAt(clip,time){
 let gain=1;
 for(const [transition,incoming] of [[clip.incoming,true],[clip.outgoing,false],[clip.cutIncoming,true],[clip.cutOutgoing,false]])if(transition){
  gain*=transitionAudioGains((time-transition.start)/transition.plan.duration,transition.plan)[incoming?1:0];
 }
 // Tiny ramps at internal edits reduce discontinuity clicks without moving time.
 if(clip.fadeIn)gain*=Math.min(1,Math.max(0,(time-clip.start)/.005));
 if(clip.fadeOut)gain*=Math.min(1,Math.max(0,(clip.end-time)/.005));
 return gain;
}
export function exportBassAt(clip,time){
 let db=0;
 for(const [transition,incoming] of [[clip.incoming,true],[clip.outgoing,false],[clip.cutIncoming,true],[clip.cutOutgoing,false]])if(transition?.plan.style==='bass'){
  const p=(time-transition.start)/transition.plan.duration;
  // Bass curves are restored after each transition, just like the live mixer.
  if(p>=0&&p<=1)db+=transitionBassDb(p,incoming);
 }
 return db;
}
export async function renderExportChunk(schedule,buffers,first,count,{sampleRate=44100,master=.8,OfflineContext=globalThis.OfflineAudioContext}={}){
 // Warm filters/limiter before each block; never restart the MP3 encoder.
 const warm=Math.min(first,sampleRate),origin=(first-warm)/sampleRate,length=count+warm;
 const ctx=new OfflineContext(2,length,sampleRate),bus=ctx.createGain();bus.gain.value=master;
 const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;bus.connect(limiter);limiter.connect(ctx.destination);
 for(const clip of schedule.clips){
  if(clip.end<=origin||clip.start>=(first+count)/sampleRate)continue;
  const buffer=buffers.get(clip.index);if(!buffer)throw Error('Audiodaten für den Export fehlen.');
  const source=ctx.createBufferSource();source.buffer=buffer;
  const bass=ctx.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=250;
  const gain=ctx.createGain();source.connect(bass);bass.connect(gain);gain.connect(bus);
  const begin=Math.max(origin,clip.start),end=Math.min(clip.end,(first+count)/sampleRate),seconds=end-begin;
  const points=Math.max(2,Math.ceil(seconds*500)+1),gains=new Float32Array(points),db=new Float32Array(points);
  for(let i=0;i<points;i++){const t=begin+seconds*i/(points-1);gains[i]=exportGainAt(clip,t);db[i]=exportBassAt(clip,t);}
  gain.gain.setValueCurveAtTime(gains,begin-origin,seconds);bass.gain.setValueCurveAtTime(db,begin-origin,seconds);
  source.start(begin-origin,clip.sourceStart+begin-clip.start,seconds);
 }
 const audio=await ctx.startRendering();
 return [audio.getChannelData(0).slice(warm),audio.getChannelData(1).slice(warm)];
}
export async function exportQueueAudio(schedule,files,{signal,onProgress=()=>{},format='mp3',bitrate=192,master=.8,workerFactory=()=>new Worker(new URL('./audio-export-worker.js',import.meta.url))}={}){
 const outputFormat=audioExportFormat(format);
 const abort=()=>signal?.throwIfAborted();abort();
 const worker=workerFactory(),parts=[],buffers=new Map();let pending;
 const cancel=()=>{worker.terminate();pending?.reject(new DOMException('Export abgebrochen.','AbortError'));};
 signal?.addEventListener('abort',cancel,{once:true});
 worker.onmessage=({data})=>{const job=pending;pending=null;if(data.error)job?.reject(Error(data.error));else job?.resolve(data);};
 worker.onerror=()=>{pending?.reject(Error(`${outputFormat.label}-Encoder konnte nicht geladen werden.`));pending=null;};
 const send=(message,transfer=[])=>new Promise((resolve,reject)=>{pending={resolve,reject};worker.postMessage(message,transfer);});
 try{
  const sampleRate=44100,total=Math.ceil(schedule.duration*sampleRate),block=sampleRate*10;
  const initialized=await send({type:'start',format,bitrate,total});abort();parts.push(...(initialized.parts||[]));
  const decode=new OfflineAudioContext(2,1,sampleRate);
  for(let first=0;first<total;first+=block){
   abort();const count=Math.min(block,total-first),start=Math.max(0,(first-sampleRate)/sampleRate),end=(first+count)/sampleRate;
   const needed=new Set(schedule.clips.filter(c=>c.start<end&&c.end>start).map(c=>c.index));
   for(const key of buffers.keys())if(!needed.has(key))buffers.delete(key);
   for(const key of needed)if(!buffers.has(key)){
    onProgress(first/total,`Lese ${schedule.rows[key].track.name} …`);
    const audio=await decode.decodeAudioData(await files[key].arrayBuffer());abort();
    if(Math.abs(audio.duration-schedule.rows[key].track.plan.duration)>.25)throw Error(`${schedule.rows[key].track.name}: Audiodauer hat sich geändert. Bitte neu vorbereiten.`);
    buffers.set(key,audio);
   }
   const [left,right]=await renderExportChunk(schedule,buffers,first,count,{master});abort();
   const result=await send({type:'chunk',left,right},[left.buffer,right.buffer]);abort();parts.push(...result.parts);
   onProgress((first+count)/total,`${outputFormat.label} wird erstellt …`);
  }
  const result=await send({type:'finish'});abort();parts.push(...(result.parts||[]));if(result.bytes)parts.push(result.bytes);
  return new Blob(parts,{type:outputFormat.mime});
 }finally{signal?.removeEventListener('abort',cancel);worker.terminate();buffers.clear();}
}
