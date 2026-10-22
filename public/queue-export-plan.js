import {planTransitionPair,transitionTonalSegments} from './musical-transition.js';
import {matchingSetTransition} from './setlist-transition.js';
import {transitionAudioProfile} from './transition-audio.js';
import {keptRanges,cutTimeBetween,cutAudioClips,fitCutTransition,cutTransitionFits} from './track-cuts.js';

// Pure, frozen schedule in output seconds; source offsets always refer to originals.
export function planQueueExport(entries,tracks,options={}){
 if(!entries.length)throw Error('Die Warteschlange ist leer.');
 const byId=new Map(tracks.map(t=>[t.id,t]));
 const rows=entries.map(entry=>{
  const track=byId.get(entry.trackId);
  if(entry.provider)throw Error('Streaming-Titel können nicht exportiert werden. Bitte durch lokale Audiodateien ersetzen.');
  if(!track?.plan||track.deleted||track.missing||track.pendingChange||track.recalculate)throw Error(`${track?.name||'Titel fehlt'}: zuerst vorbereiten und die Datei verbinden.`);
  const kept=keptRanges(track.audioCuts,track.plan.duration);
  if(!kept.length)throw Error(`${track.name}: kein hörbarer Liedteil vorhanden.`);
  return {entry,track,kept,start:0,cue:kept[0][0],end:kept.at(-1)[1],incoming:null,outgoing:null};
 });
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1];let plan;
  if(b.entry.transition){
   const saved=b.entry.transition;
   if(saved.libraryId&&((saved.rateA??1)!==1||(saved.rateB??1)!==1))throw Error('Dieser gespeicherte Übergang verändert das Tempo. Für den Export bitte einen Übergang mit Originaltempo wählen.');
   plan=matchingSetTransition(b.entry,a.entry,a.track.plan,b.track.plan,1,1,a.track,b.track);
   if(!plan||!cutTransitionFits(plan,a.track,b.track))throw Error(`${a.track.name} → ${b.track.name}: gespeicherter Übergang passt nicht mehr. Bitte neu bearbeiten oder entfernen.`);
  }else{
   const from={...a.track.plan,duration:a.end},to={...b.track.plan,duration:b.end};
   plan=planTransitionPair(from,to,{...options,cue:b.cue,notBefore:a.cue,tonalA:transitionTonalSegments(a.track.windows),tonalB:transitionTonalSegments(b.track.windows)});
   plan=fitCutTransition(plan,a.track,b.track,{notBefore:a.cue});
   plan={...plan,audioProfile:options.musical&&options.adaptive?transitionAudioProfile(a.track.windows,b.track.windows,plan,{sameTrack:a.track.id===b.track.id}):null};
  }
  if(plan.time<a.cue-.00001||plan.duration<.01)throw Error(`${a.track.name}: zu wenig Platz für aufeinanderfolgende Übergänge. Bitte Schnitt oder Übergang anpassen.`);
  const start=a.start+cutTimeBetween(a.track.audioCuts,a.track.plan.duration,a.track.audioCutJoins,a.cue,plan.time);
  a.end=plan.time+plan.duration;a.outgoing={start,plan};
  b.start=start;b.cue=plan.cue;b.incoming={start,plan};
  // The following fade must begin after this incoming fade has finished.
  if(i&&start<a.incoming.start+a.incoming.plan.duration-.00001)throw Error(`${a.track.name}: zwei Übergänge überschneiden sich. Bitte eine kürzere Überblendung wählen.`);
 }
 const clips=[];
 for(const [index,row] of rows.entries()){
  const local=cutAudioClips(row.track.audioCuts,row.track.plan.duration,row.track.audioCutJoins,row.cue,row.end);
  for(const clip of local){
   const shift=value=>value?{...value,start:value.start+row.start}:null;
   clips.push({...clip,index,start:clip.start+row.start,end:clip.end+row.start,incoming:row.incoming,outgoing:row.outgoing,cutIncoming:shift(clip.cutIncoming),cutOutgoing:shift(clip.cutOutgoing)});
  }
  row.outputEnd=row.start+(local.at(-1)?.end||0);
 }
 const duration=Math.max(...rows.map(r=>r.outputEnd));
 if(!Number.isFinite(duration)||duration<=0)throw Error('Die Warteschlange enthält keine exportierbare Audiodauer.');
 return {rows,clips,duration};
}
