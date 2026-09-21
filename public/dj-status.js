// Readiness permits playback; completion also accounts for background work.
export function analysisStatus(track,structureEnabled=true) {
  if(!track)return {text:'Leer',kind:'idle'};
  if(track.missing)return {text:'Datei fehlt · Deck entladen',kind:'warning'};
  if(track.pendingChange)return {text:'Geändert · Deck entladen',kind:'warning'};
  if(track.queuePreparationError)return {text:'Dateizugriff nötig · Details',kind:'warning',detail:track.queuePreparationError};
  if(track.failed)return {text:'Analyse fehlgeschlagen',kind:'warning',detail:track.state};
  if(!track.plan)return {text:track.phase||((track.file||track.handle)?'Noch nicht berechnet':'Erneut verbinden'),kind:track.phase?'working':'idle'};
  if(track.phase)return {text:track.phase,kind:'working'};
  if(track.structureState==='running')return {text:'Spielbereit · Songaufbau läuft …',kind:'working'};
  if(structureEnabled&&!track.plan.structure&&track.windows&&!track.refined)return {text:'Spielbereit · Songaufbau wartet …',kind:'working'};
  const warnings=[...(track.analysisWarnings||[]),...(structureEnabled&&track.structureState==='failed'?[track.state]:[])];
  if(warnings.length)return {text:'Spielbereit · Analyse eingeschränkt · Details',kind:'info',detail:warnings.join('\n')};
  if(!track.plan.structure)return {text:'Spielbereit',kind:'complete'};
  return {text:'Spielbereit',kind:'complete'};
}

// Pair planning is synchronous; only the underlying song analyses can be pending.
export function transitionStatus({from,to,plan,musical=true,structureEnabled=true,active=false,starting=false,needsFile=false}) {
 if(starting)return {kind:'working',text:'Übergang wird gestartet …'};
 if(active)return {kind:'active',text:'Übergang läuft'+(plan?.label?' · '+plan.label:'')};
 if(!from||!to)return {kind:'idle',text:'Wartet auf den nächsten Titel'};
 if(needsFile||[from,to].some(t=>t.missing||t.queuePreparationError||t.pendingChange))return {kind:'warning',text:'Datei verbinden · Übergang noch nicht bereit'};
 if([from,to].some(t=>t.failed&&!t.plan))return {kind:'warning',text:'Analyse fehlgeschlagen · Übergang nicht bereit'};
 if(!from.plan||!to.plan)return {kind:'working',text:'Titel werden vorbereitet …'};
 if(!plan?.label)return {kind:'working',text:'Nächster Titel wird geladen …'};
 const duration=Number.isFinite(plan.duration)?` · ${plan.duration.toFixed(1)} s`:'';
 if(!musical)return {kind:'ready',text:'Bereit · Crossfade'+duration};
 if(plan.confidence==='analyzed')return {kind:'ready',text:'Bereit · '+plan.label+duration};
 const pending=[from,to].some(t=>analysisStatus(t,structureEnabled).kind==='working');
 return {kind:pending?'working':'ready',text:pending?'Basisübergang bereit · Analyse läuft …':'Bereit · Sanfter Übergang (Basisanalyse)'+duration};
}
