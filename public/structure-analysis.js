import { validateStructure } from './song-structure.js';

export async function analyzeStructure(bytes,duration,{token='',signal,cancelSignal,onStatus=()=>{}}={}) {
  try {
    signal?.throwIfAborted();cancelSignal?.throwIfAborted();
    const combined=AbortSignal.any([signal,cancelSignal].filter(Boolean));
    onStatus('Instrumente und Songaufbau werden analysiert …');
    const headers={...(token?{Authorization:`Bearer ${token}`}:{})};
    // A dropped connection is different from a failed model. Retry once only
    // after the service confirms it is available and has no job running.
    async function request(options){
      try{return await fetch('/api/analysis/structure',options);}
      catch(error){
        combined.throwIfAborted();
        if(!(error instanceof TypeError))throw error;
        onStatus('Verbindung zur Songaufbau-Analyse wird geprüft …');
        let probe;
        try{probe=await fetch('/api/analysis/structure',{headers,signal:combined});}
        catch{combined.throwIfAborted();throw Error('Verbindung zum lokalen Analysedienst unterbrochen. Bitte prüfen, ob AnyDj noch läuft, und die Analyse erneut starten. Ein Server-Neustart kann laufende Anfragen abbrechen.');}
        if(!options.method)return probe;
        const state=await probe.json();
        if(!probe.ok||!state.available)throw Error(state.message||state.error?.message||'Der lokale Analysedienst ist nicht verfügbar.');
        if(state.busy)throw Error('Die Verbindung ist abgebrochen, aber der Analysedienst arbeitet noch. Bitte warten und anschließend die Analyse erneut starten.');
        onStatus('Verbindung wiederhergestellt · Songaufbau-Analyse wird erneut gestartet …');
        try{return await fetch('/api/analysis/structure',options);}
        catch(retryError){combined.throwIfAborted();if(!(retryError instanceof TypeError))throw retryError;throw Error('Die Verbindung zum lokalen Analysedienst ist erneut abgebrochen. Bitte den Server prüfen und die Analyse später erneut starten.');}
      }
    }
    const response=await request({headers,signal:combined});
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
    const result=await request({method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-AnyDj-Local':'1'},body:pcm,signal:combined});
    const data=await result.json();if(!result.ok)throw Error(data.error?.message||'Songstruktur-Analyse fehlgeschlagen.');
    return {structure:validateStructure(data,duration),message:`KI-Schätzung · ${data.segments.length} Songabschnitte${data.instruments?' · Instrumente und Spannungsverlauf':''}${data.cached?' · zwischengespeichert':Number.isFinite(data.elapsedSeconds)?` · ${Math.round(data.elapsedSeconds)} s`:''}`};
  } catch(error) {
    if(signal?.aborted)throw error;
    return {structure:null,message:cancelSignal?.aborted?'Zusätzliche KI-Analyse abgebrochen. Die bisherige Show bleibt aktiv.':`Bisherige Show verwendet: ${error.message}`};
  }
}
