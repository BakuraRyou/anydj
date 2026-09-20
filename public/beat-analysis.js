import { validateBeatGrid } from './beat-grid.js';

// Send the browser's decoded timebase, never decode the MP3 again on the server.
export async function analyzeBeats(decoded,{engine='beat-this',token='',signal,onStatus=()=>{}}={}) {
  if(engine==='builtin')return {grid:null,message:'Standard-Analyse'};
  try {
    signal?.throwIfAborted();
    onStatus('Beat This! erkennt Beats und Taktanfänge …');
    const headers={...(token?{Authorization:`Bearer ${token}`}:{})};
    const statusResponse=await fetch('/api/analysis/beats',{headers,signal});
    const status=await statusResponse.json();
    if(!statusResponse.ok)throw Error(status.error?.message||'Beat This! nicht erreichbar.');
    if(!status.available)throw Error(status.message);
    if(decoded.sampleRate!==16000)throw Error('Beat This! erwartet 16 kHz.');
    const pcm=new ArrayBuffer(decoded.length*4),view=new DataView(pcm);
    const channels=Array.from({length:decoded.numberOfChannels},(_,c)=>decoded.getChannelData(c));
    for(let i=0;i<decoded.length;i++)view.setFloat32(i*4,channels.reduce((sum,c)=>sum+c[i],0)/channels.length,true);
    const response=await fetch('/api/analysis/beats',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-WiZ-Local':'1'},body:pcm,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(185000)]):AbortSignal.timeout(185000)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error?.message||'Beat This! konnte das Lied nicht analysieren.');
    const grid=validateBeatGrid(result,decoded.duration);
    return {grid,message:`Beat This! · ${grid.beats.length} Beats · ${grid.downbeats.length} Taktanfänge${result.cached?' · zwischengespeichert':''}`};
  } catch(error) {
    if(signal?.aborted)throw error;
    return {grid:null,message:`Standard-Analyse verwendet: ${error.message||'Beat This! nicht verfügbar.'}`};
  }
}
