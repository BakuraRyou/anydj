const time=value=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
export function createStageTransport(host,{isVisible}){
  const section=document.createElement('section');section.className='stage-3d-transport';section.setAttribute('aria-label','Songsteuerung');section.hidden=true;
  section.innerHTML='<div class="stage-3d-song-heading"><label>Deck <select data-song-deck aria-label="Deck für Songsteuerung"></select></label><button type="button" class="button secondary" data-song-library aria-expanded="false">Song laden</button><strong data-song-title>Kein Track geladen</strong><button type="button" class="button secondary" data-song-play disabled>Play</button></div><div class="stage-3d-song-picker" hidden><select data-song-track aria-label="Song aus der Bibliothek"></select><button type="button" class="button secondary" data-song-load>Laden</button><button type="button" class="button secondary" data-song-import>Datei hinzufügen</button><input type="file" data-song-files accept="audio/*" multiple hidden><p data-song-feedback role="status"></p></div><label class="stage-3d-song-position"><span class="sr-only">Songposition</span><input class="range" data-song-seek type="range" min="0" max="1" step="0.01" value="0" disabled></label><div class="stage-3d-song-bottom"><output data-song-clock hidden>0:00 / 0:00</output><label>Tempo <input data-song-rate class="range" type="range" min="-16" max="16" step="0.1" value="0" disabled><output data-song-rate-value>0 %</output></label><button type="button" class="button secondary" data-song-reset>Tempo zurücksetzen</button></div><p data-song-note hidden></p>';
  host.append(section);const controls=new Map(),q=key=>{if(!controls.has(key))controls.set(key,section.querySelector(`[data-song-${key}]`));return controls.get(key);};
  const text=(key,value)=>{const node=q(key);if(node.textContent!==value)node.textContent=value;};
  let api=null,selected='',snapshot=null;
  const seek=value=>{if(snapshot?.canSeek){api.seek(snapshot.id,Math.max(0,Math.min(snapshot.duration,value)));update();}};
  const picker=section.querySelector('.stage-3d-song-picker');let trackSignature='',busy=false;
  q('library').onclick=()=>{picker.hidden=!picker.hidden;q('library').setAttribute('aria-expanded',String(!picker.hidden));update();};
  q('import').onclick=()=>q('files').click();
  q('files').onchange=async()=>{try{await api?.importFiles?.([...q('files').files]);q('feedback').textContent='Dateien hinzugefügt. Nach der Vorbereitung kannst du den Song laden.';}catch(error){q('feedback').textContent=error.message;}q('files').value='';update();};
  q('load').onclick=async()=>{if(busy||!snapshot?.canLoad)return;busy=true;update();try{await api.loadTrack(snapshot.id,q('track').value);q('feedback').textContent='Song geladen.';picker.hidden=true;q('library').setAttribute('aria-expanded','false');}catch(error){q('feedback').textContent=error.message;}finally{busy=false;update();}};
  q('deck').onchange=()=>{selected=q('deck').value;update();};
  q('seek').oninput=e=>seek(Number(e.target.value));

  const rate=value=>{if(snapshot?.canRate){api.setRate(snapshot.id,value);update();}};
  q('rate').oninput=e=>rate(Number(e.target.value));q('reset').onclick=()=>rate(0);
  q('track').onchange=update;

  q('play').onclick=()=>{if(snapshot?.canPlay)api.toggle(snapshot.id);};
  function update(){
    section.hidden=!api;if(!api||!isVisible())return;
    const decks=api.getDecks();
    if(!decks.some(d=>d.id===selected))selected=(decks.find(d=>d.playing)||decks.find(d=>d.duration)||decks[0])?.id||'';
    const signature=decks.map(d=>d.id).join('|');
    if(q('deck').dataset.signature!==signature){q('deck').replaceChildren(...decks.map(d=>new Option(`Deck ${d.id}`,d.id)));q('deck').dataset.signature=signature;}
    q('deck').value=selected;snapshot=decks.find(d=>d.id===selected);
    const d=snapshot||{duration:0,position:0,rate:1};
    q('library').hidden=!api.getTracks;
    if(!picker.hidden&&api.getTracks){
      const tracks=api.getTracks(),signature=JSON.stringify(tracks);
      if(trackSignature!==signature){const previous=q('track').value;q('track').replaceChildren(...tracks.map(t=>{const o=new Option(t.title+(t.ready?'':' · wird vorbereitet / nicht verfügbar'),t.id);o.disabled=!t.ready;return o;}));if(tracks.some(t=>t.id===previous))q('track').value=previous;trackSignature=signature;}
      q('load').disabled=busy||!d.canLoad||!q('track').value||Boolean(q('track').selectedOptions[0]?.disabled);
      if(!d.canLoad&&!busy)q('feedback').textContent='Deck pausieren, um einen anderen Song zu laden.';
      q('import').disabled=busy;
    }
    text('title',d.title||'Kein Track geladen');text('clock',`${time(d.position)} / ${time(d.duration)}`);
    q('seek').disabled=!d.canSeek;q('seek').max=d.duration||1;q('seek').value=d.position;
    q('play').disabled=!d.canPlay;text('play',d.playing?'Pause':'Play');
    q('rate').disabled=!d.canRate;q('reset').disabled=!d.canRate;q('rate').value=(d.rate-1)*100;text('rate-value',((d.rate-1)*100).toFixed(1)+' %');
    text('note',d.note||'Tempo und Position steuern das ausgewählte Deck – Musik und Licht folgen gemeinsam.');
    const description=`${time(d.position)} von ${time(d.duration)}`;if(q('seek').getAttribute('aria-valuetext')!==description)q('seek').setAttribute('aria-valuetext',description);
  }
  return {vrState(){return {selected,decks:(api?.getDecks()||[]).map(d=>({id:d.id,title:d.title,position:d.position,duration:d.duration,rate:d.rate,playing:d.playing,canPlay:d.canPlay,canSeek:d.canSeek,canRate:d.canRate}))};},
    vrCommand(command){const d=api?.getDecks().find(d=>d.id===command.deck);if(!d)throw Error('Deck nicht verfügbar.');
      if(command.action==='select'){selected=d.id;update();return;}
      if(command.action==='playing'){if(!d.canPlay)throw Error('Deck kann derzeit nicht gestartet werden.');if(d.playing!==command.value)api.toggle(d.id);}
      else if(command.action==='seek'){if(!d.canSeek)throw Error('Positionssprung nicht verfügbar.');api.seek(d.id,Math.max(0,Math.min(d.duration,command.value)));}
      else if(command.action==='rate'){if(!d.canRate)throw Error('Tempo nicht verfügbar.');api.setRate(d.id,Math.max(-16,Math.min(16,command.value)));}
      else throw Error('Unbekannter VR-Befehl.');update();
    },getSelected(){return snapshot;},mountEditor(host,options){return api?.mountEditor?.(selected,host,options);},handleShortcut(event){api?.shortcut?.(event,selected);},setApi(value){api=value;update();},update,destroy(){section.remove();}};
}
