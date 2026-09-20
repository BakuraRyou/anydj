import { validateStructure } from './song-structure.js';

export async function analyzeStructure(bytes,duration,{token='',signal,cancelSignal,onStatus=()=>{}}={}) {
  try {
    signal?.throwIfAborted();cancelSignal?.throwIfAborted();
    const combined=AbortSignal.any([signal,cancelSignal,AbortSignal.timeout(910000)].filter(Boolean));
    onStatus('Songaufbau wird mit lokaler KI analysiert. Das kann einige Minuten dauern …');
    const headers={...(token?{Authorization:`Bearer ${token}`}:{})};
    const response=await fetch('/api/analysis/structure',{headers,signal:combined});
    const status=await response.json();
    if(!response.ok||!status.available)throw Error(status.message||status.error?.message||'All-In-One nicht verfügbar.');
    // Preserve the browser's MP3 time origin; Demucs expects 44.1 kHz stereo.
    const decoded=await new OfflineAudioContext(2,1,44100).decodeAudioData(bytes);
    combined.throwIfAborted();
    if(Math.abs(decoded.duration-duration)>.05)throw Error('Die Audio-Zeitachsen stimmen nicht überein.');
    const pcm=new ArrayBuffer(decoded.length*4),view=new DataView(pcm);
    const left=decoded.getChannelData(0),right=decoded.getChannelData(Math.min(1,decoded.numberOfChannels-1));
    for(let i=0;i<decoded.length;i++){
      view.setInt16(i*4,Math.round(Math.max(-1,Math.min(1,left[i]))*32767),true);
      view.setInt16(i*4+2,Math.round(Math.max(-1,Math.min(1,right[i]))*32767),true);
    }
    combined.throwIfAborted();
    const result=await fetch('/api/analysis/structure',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-WiZ-Local':'1'},body:pcm,signal:combined});
    const data=await result.json();if(!result.ok)throw Error(data.error?.message||'Songstruktur-Analyse fehlgeschlagen.');
    return {structure:validateStructure(data,duration),message:`KI-Schätzung · ${data.segments.length} Songabschnitte${data.cached?' · zwischengespeichert':''}`};
  } catch(error) {
    if(signal?.aborted)throw error;
    return {structure:null,message:cancelSignal?.aborted?'Zusätzliche KI-Analyse abgebrochen. Die bisherige Show bleibt aktiv.':`Bisherige Show verwendet: ${error.message}`};
  }
}
