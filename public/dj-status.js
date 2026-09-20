// Readiness permits playback; completion also accounts for background work.
export function analysisStatus(track,structureEnabled=true) {
  if(!track)return {text:'Leer',kind:'idle'};
  if(track.missing)return {text:'Datei fehlt · Deck entladen',kind:'warning'};
  if(track.pendingChange)return {text:'Geändert · Deck entladen',kind:'warning'};
  if(track.failed)return {text:'Analyse fehlgeschlagen',kind:'warning',detail:track.state};
  if(!track.plan)return {text:track.phase||((track.file||track.handle)?'Noch nicht berechnet':'Erneut verbinden'),kind:track.phase?'working':'idle'};
  if(track.structureState==='running')return {text:'Spielbereit · Songaufbau läuft …',kind:'working'};
  if(structureEnabled&&!track.plan.structure&&track.windows&&!track.refined)return {text:'Spielbereit · Songaufbau wartet …',kind:'working'};
  const warnings=[...(track.analysisWarnings||[]),...(structureEnabled&&track.structureState==='failed'?[track.state]:[])];
  if(warnings.length)return {text:'⚠ Fertig · Teilanalyse',kind:'warning',detail:warnings.join('\n')};
  if(!track.plan.structure)return {text:'✓ Fertig · ohne Songaufbau',kind:'complete'};
  return {text:'✓ Vollständig berechnet',kind:'complete'};
}
