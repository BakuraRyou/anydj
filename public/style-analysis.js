import { validateMusicStyle } from './music-style.js';

// Send the browser's decoded timebase, never decode the MP3 again on the server.
export async function analyzeStyle(decoded,{token='',signal,onStatus=()=>{}}={}) {
  try {
    signal?.throwIfAborted();
    onStatus('Stilverlauf wird erkannt …');
    const headers={...(token?{Authorization:`Bearer ${token}`}:{})};
    const statusResponse=await fetch('/api/analysis/style',{headers,signal});
    const status=await statusResponse.json();
    if(!statusResponse.ok)throw Error(status.error?.message||'Stilerkennung nicht erreichbar.');
    if(!status.available)throw Error(status.message);
    if(decoded.sampleRate!==16000)throw Error('Stilerkennung erwartet 16 kHz.');
    const pcm=new ArrayBuffer(decoded.length*4),view=new DataView(pcm);
    const channels=Array.from({length:decoded.numberOfChannels},(_,c)=>decoded.getChannelData(c));
    for(let i=0;i<decoded.length;i++)view.setFloat32(i*4,channels.reduce((sum,c)=>sum+c[i],0)/channels.length,true);
    const response=await fetch('/api/analysis/style',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-AnyDj-Local':'1'},body:pcm,signal});
    const result=await response.json();
    if(!response.ok)throw Error(result.error?.message||'Stilerkennung konnte das Lied nicht analysieren.');
    return {style:validateMusicStyle(result,decoded.duration),message:'Stilverlauf erkannt'};
  } catch(error) {
    if(signal?.aborted)throw error;
    return {style:null,message:`Stilerkennung nicht verfügbar: ${error.message||'Unbekannter Fehler'}`};
  }
}
