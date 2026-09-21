// Small local snapshot; audio files and running playback are never stored here.
export function createDJSession({decks, root=document, updateGains, drawDeck, restoreFile, reconnect}) {
  const key=`anydj-dj-session-${document.documentElement.dataset.edition||'local'}`;
  const deckSelectors=['.dj-volume','[data-tempo]','[data-keylock]','[data-loop-size]',...['trim','low','mid','high'].map(v=>`[data-eq="${v}"]`)];
  const mixerSelectors=['#crossfader','#autoCrossfade','#autoBeat','#fadeDuration','#djStructure','[data-master]','[data-cue-level]'];
  let ready=false,last='',warned=false;
  const auto=root.querySelector('#autoCrossfade'),autoKey=key+'-auto-crossfade';
  let autoPreference=auto.checked;
  try{
    const saved=localStorage.getItem(autoKey),legacy=JSON.parse(localStorage.getItem(key))?.mixer?.['#autoCrossfade'];
    if(saved==='true'||saved==='false')autoPreference=saved==='true';
    else if(typeof legacy==='boolean')autoPreference=legacy;
  }catch{}
  auto.checked=autoPreference;
  // Stopping a mix disarms the running automation; only a checkbox change
  // changes the preference for the next visit. Save immediately, even while
  // file handles and the library are still being restored.
  auto.addEventListener('change',()=>{
    autoPreference=auto.checked;
    try{localStorage.setItem(autoKey,String(autoPreference));}catch{storageError();}
    save();
  });
  const status=document.createElement('p');status.className='small muted';status.setAttribute('role','status');
  (root.querySelector('.dj-statusbar')||root.querySelector('#decks')).append(status);
  function storageError(){if(!warned){status.textContent='Der Browser kann den letzten Stand nicht speichern. Bitte lokalen Speicher freigeben.';warned=true;}}
  function values(scope,selectors){return Object.fromEntries(selectors.map(s=>{const n=scope.querySelector(s);return [s,n?.type==='checkbox'?n.checked:n?.value];}));}
  function apply(scope,selectors,values){
    for(const s of selectors){const n=scope.querySelector(s),v=values?.[s];if(!n||n.disabled||v===undefined)continue;
      if(n.type==='checkbox'){if(typeof v!=='boolean')continue;n.checked=v;}
      else if(n.type==='range'){const number=Number(v);if(!Number.isFinite(number))continue;n.value=Math.max(Number(n.min),Math.min(Number(n.max),number));}
      else {if(![...n.options].some(o=>o.value===v))continue;n.value=v;}
      n.dispatchEvent(new Event(n.type==='checkbox'?'change':'input',{bubbles:true}));
    }
  }
  function save(){
    if(!ready)return;
    const snapshot={version:1,mixer:{...values(root,mixerSelectors),'#autoCrossfade':autoPreference},decks:decks.map(d=>({trackId:d.track?.id||null,time:d.resumeTime??d.audio.currentTime,cue:d.cue,rate:d.audio.playbackRate,settings:values(d.panel,deckSelectors)}))};
    const json=JSON.stringify(snapshot);if(json===last)return;
    try{localStorage.setItem(key,json);last=json;}catch{storageError();}
  }
  const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
  for(const d of decks){
    const button=document.createElement('button');button.className='button secondary';button.textContent='Datei verbinden';button.hidden=true;
    d.panel.querySelector('.dj-track-title').after(button);d.resumeButton=button;
    button.onclick=()=>reconnect(d);
  }
  async function restore(tracks){
    let snapshot;try{snapshot=JSON.parse(localStorage.getItem(key));}catch{}
    if(snapshot?.version===1&&Array.isArray(snapshot.decks)){
      for(const [i,d] of decks.entries()){
        const saved=snapshot.decks[i];if(!saved)continue;
        // Tempo is disabled until a track is ready; restore its value explicitly below.
        apply(d.panel,deckSelectors.filter(s=>s!=='[data-tempo]'),saved.settings);
        const tempo=Number(saved.settings?.['[data-tempo]']);
        if(Number.isFinite(tempo)){d.panel.querySelector('[data-tempo]').value=Math.max(-16,Math.min(16,tempo));d.manualRate=1+Number(d.panel.querySelector('[data-tempo]').value)/100;d.audio.playbackRate=d.manualRate;}
        if(typeof saved.rate==='number'&&Number.isFinite(saved.rate)&&saved.rate>=.25&&saved.rate<=4){d.manualRate=saved.rate;d.audio.playbackRate=saved.rate;}
        const track=tracks.find(t=>t.id===saved.trackId);if(!track)continue;
        d.track=track;d.cue=Math.min(finite(saved.cue),track.plan?.duration||Infinity);d.resumeTime=Math.min(finite(saved.time),track.plan?.duration||Infinity);
        d.panel.querySelector('.dj-track-title').textContent=track.name;d.panel.querySelector('.dj-track-title').title=track.name;
        d.panel.querySelector('.dj-cue').textContent=d.cue?`Cue ${Math.floor(d.cue/60)}:${String(Math.floor(d.cue%60)).padStart(2,'0')}`:'Cue';
        d.resumeButton.hidden=false;drawDeck(d);
        // Permission prompts require a deliberate click, never a page reload.
        try{if(track.handle&&await track.handle.queryPermission({mode:'read'})==='granted')await restoreFile(d);}catch{}
      }
      apply(root,mixerSelectors,{...snapshot.mixer,'#autoCrossfade':autoPreference});updateGains();
      if(decks.some(d=>d.track))status.textContent='Letzter Stand wiederhergestellt · Wiedergabe pausiert.';
    }
    ready=true;
  }
  const timer=setInterval(save,1000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  return {restore,save,destroy(){save();clearInterval(timer);}};
}
