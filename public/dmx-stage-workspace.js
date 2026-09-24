// UI composition only: keep existing controls, handlers and saved settings intact.
export function createStageWorkspace(panel,{mountLayout,mountLighting,onFit,transport,zones}){
  const q=s=>panel.querySelector(s),heading=q('.stage-3d-heading'),canvas=q('canvas'),tools=q('.stage-3d-tools'),status=q(':scope>p[role=status]');
  heading.querySelector('strong').innerHTML='Lichtshow <small>3D-Vorschau</small>';
  q('[data-stage3d-full]').textContent='Vollbild';
  const reset=q('[data-camera=reset]');reset.textContent='Raum einpassen';tools.append(reset);
  q('[data-camera=front]').textContent='Übersicht';q('[data-camera=front]').setAttribute('aria-pressed','true');q('[data-camera=top]').textContent='Von oben';
  const work=document.createElement('div');work.className='stage-3d-workspace';
  const viewport=document.createElement('div');viewport.className='stage-3d-viewport';
  const navigation=document.createElement('nav');navigation.className='stage-3d-tool-tabs';navigation.setAttribute('aria-label','Show vorbereiten');
  const inspector=document.createElement('aside');inspector.className='stage-3d-inspector';inspector.setAttribute('aria-label','Vorbereitungswerkzeuge');
  const body=document.createElement('div');body.className='stage-3d-inspector-body';
  const inspectorHeader=document.createElement('div');inspectorHeader.className='stage-3d-inspector-heading';
  inspectorHeader.innerHTML='<strong></strong><button type="button" class="button secondary" data-tools-close aria-label="Werkzeuge schließen">✕</button>';
  inspector.append(inspectorHeader,body);heading.after(navigation,work);work.append(viewport,inspector);viewport.append(canvas,tools,status);
  const room=q('.stage-3d-room'),dancer=q('.stage-3d-dancer');room.open=true;
  const pages=new Map(),buttons=new Map();let current='',cleanup=null,roomPlanner=null;
  for(const [key,title] of [['room','Raum'],['fixtures','Geräte'],['lighting','Licht'],['position','Standort']]){
    const button=document.createElement('button');button.type='button';button.className='button secondary';button.dataset.workspaceTab=key;button.textContent=title;button.setAttribute('aria-pressed','false');navigation.append(button);buttons.set(key,button);
    const page=document.createElement('div');page.className='stage-3d-tool-page';page.dataset.workspacePage=key;page.hidden=true;body.append(page);pages.set(key,page);
    button.onclick=()=>show(current===key?'':key);
  }
  pages.get('room').append(room);pages.get('position').append(dancer);
  const positionHint=document.createElement('p');positionHint.className='stage-3d-position-hint';positionHint.textContent='Wähle „Ego-Perspektive“, um den Raum mit WASD zu erkunden oder Standort und Augenhöhe einzustellen.';pages.get('position').append(positionHint);
  const deviceActions=document.createElement('div');deviceActions.className='stage-3d-device-actions';deviceActions.innerHTML='<p>Geräte hinzufügen, in der Liste auswählen und direkt im Plan positionieren.</p>';pages.get('fixtures').append(deviceActions);
  const backToPlan=document.createElement('button');backToPlan.type='button';backToPlan.className='button secondary';backToPlan.textContent='Zurück zur Raumaufstellung';backToPlan.hidden=true;backToPlan.onclick=()=>show('fixtures');deviceActions.prepend(backToPlan);
  const deviceHost=document.createElement('div');deviceHost.className='stage-3d-device-editor';pages.get('fixtures').append(deviceHost);
  const lightPage=pages.get('lighting'),lightTabs=document.createElement('div');lightTabs.className='stage-3d-light-tabs';
  lightTabs.innerHTML='<button type="button" class="button secondary" data-light-view="song">Song-Licht</button><button type="button" class="button secondary" data-light-view="live">Live-Look & Verbindung</button>';
  const songHost=document.createElement('div');songHost.className='stage-3d-song-editor';
  const songHint=document.createElement('p');songHint.className='stage-3d-song-editor-hint';
  const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Song-Licht bearbeiten';retry.hidden=true;
  const editorMount=document.createElement('div');songHost.append(songHint,retry,editorMount);
  const lightHost=document.createElement('div');lightHost.className='stage-3d-light-editor';lightPage.append(lightTabs,songHost,lightHost);
  let lightView='song',session=null,sessionKey='',pending=null,epoch=0,disposed=false;
  function releaseSong(){epoch++;pending?.abort();pending=null;session?.destroy();session=null;sessionKey='';editorMount.replaceChildren();}
  async function ensureSong(force=false){
    const selected=transport.getSelected(),key=selected?.canEdit?`${selected.id}:${selected.trackId}`:'';
    if(sessionKey&&sessionKey!==key)releaseSong();
    if(current!=='lighting'||lightView!=='song')return;
    if(!key){songHint.textContent='Lade unten einen vorbereiteten Song, um seine Lichtabschnitte hier zu bearbeiten.';retry.hidden=true;return;}
    if(!force&&sessionKey===key)return;
    releaseSong();sessionKey=key;songHint.textContent='Lichtmanager wird geöffnet …';retry.hidden=true;
    const own=++epoch;pending=new AbortController();
    try{
      const editor=await transport.mountEditor(editorMount,{signal:pending.signal,onDispose:()=>{if(own!==epoch)return;session=null;songHint.textContent='Entwurf bleibt für diese Sitzung erhalten.';retry.hidden=false;}});
      if(own!==epoch||disposed){editor?.destroy();return;}
      pending=null;session=editor;
      if(editor){
        // Share the timeline's zoom, scroll and playhead with the existing light curve.
        const track=editorMount.querySelector('.le-track'),curve=editorMount.querySelector('.le-preview-card canvas');
        track.classList.add('le-combined');track.insertBefore(curve,track.querySelector('.le-phases'));
        editorMount.querySelector('.le-timeline-tools strong').textContent='Lichtverlauf & Abschnitte';
      }
      songHint.textContent=editor?'Änderungen siehst du direkt in der 3D-Vorschau. Mit „Änderungen speichern“ übernehmen.':'Für diesen Song ist noch kein Lichtplan verfügbar.';
      retry.hidden=Boolean(editor);
    }catch(error){if(own!==epoch)return;pending=null;songHint.textContent=error.message;retry.hidden=false;}
  }
  retry.onclick=()=>ensureSong(true);
  function chooseLight(view='song',stageView='look'){
    cleanup?.();cleanup=null;lightView=view;
    songHost.hidden=view!=='song';lightHost.hidden=view==='song';
    lightTabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lightView===view)));
    work.classList.toggle('editing-song',current==='lighting'&&view==='song');
    if(view==='live')cleanup=mountLighting?.(lightHost,stageView);else void ensureSong();
  }
  lightTabs.querySelectorAll('button').forEach(b=>b.onclick=()=>chooseLight(b.dataset.lightView));
  function show(key,view='song'){
    cleanup?.();cleanup=null;current=key;
    work.classList.toggle('has-tools',Boolean(key));work.classList.toggle('editing-room',key==='room');work.classList.toggle('editing-devices',key==='fixtures');inspector.hidden=!key;
    for(const [name,page] of pages){page.hidden=name!==key;buttons.get(name).setAttribute('aria-pressed',String(name===key));}
    if(key){inspectorHeader.querySelector('strong').textContent=key==='fixtures'?'Gerätemanager':buttons.get(key).textContent;body.scrollTop=0;}
    backToPlan.hidden=true;
    if(roomPlanner){
      if(key==='room'){pages.get('room').prepend(roomPlanner.root);roomPlanner.openStep(1);}
      if(key==='fixtures'&&roomPlanner.active){pages.get('fixtures').prepend(roomPlanner.root);roomPlanner.openStep(2);}
      deviceActions.hidden=key==='fixtures'&&roomPlanner.active;deviceHost.hidden=key==='fixtures'&&roomPlanner.active;
    }
    if(key==='fixtures'&&!roomPlanner?.active)cleanup=mountLayout?.(deviceHost,zones);
    work.classList.toggle('editing-song',key==='lighting'&&view==='song');
    if(key==='lighting')chooseLight(view==='song'?'song':'live',view);
    positionHint.hidden=!dancer.hidden;
  }
  inspectorHeader.querySelector('button').onclick=()=>{const button=buttons.get(current);show('');button?.focus();};
  // Room editing stays in one compact panel, with presets before detailed fields.
  const enabled=q('[data-room-enabled]'),mode=document.createElement('div');mode.className='stage-3d-room-presets';mode.setAttribute('aria-label','Raumtyp');
  for(const [value,title] of [[true,'Club'],[false,'Bühne']]){const b=document.createElement('button');b.type='button';b.className='button secondary';b.textContent=title;b.dataset.roomPreset=String(value);b.onclick=()=>{if(enabled.checked!==value)enabled.click();syncRoom();};mode.append(b);}
  room.querySelector('summary').after(mode);enabled.closest('label').classList.add('stage-3d-legacy-mode');
  const all=document.createElement('button');all.type='button';all.className='button secondary';all.textContent='Gesamten Raum beleuchten';all.dataset.roomAll='';room.querySelector('.stage-3d-room-fields').after(all);
  all.onclick=()=>{const range=q('[data-room-reach]');range.value=range.max;range.dispatchEvent(new Event('input'));};
  const stageSetup=document.createElement('button');stageSetup.type='button';stageSetup.className='button secondary';stageSetup.textContent='Geräte, Lichtziele & Zonen bearbeiten';stageSetup.onclick=()=>show('fixtures');mode.after(stageSetup);
  const syncRoom=()=>{room.querySelector('.stage-3d-room-fields').hidden=!enabled.checked;all.hidden=!enabled.checked;q('[data-room-map]').toggleAttribute('hidden',!enabled.checked);stageSetup.hidden=false;mode.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(enabled.checked===(b.dataset.roomPreset==='true'))));all.disabled=!enabled.checked;};
  room.addEventListener('change',syncRoom);room.addEventListener('input',syncRoom);syncRoom();
  const fitButton=reset;fitButton.addEventListener('click',onFit);
  show('');
  return {show,manageShowDevices(){show('fixtures');if(roomPlanner)pages.get('room').prepend(roomPlanner.root);deviceActions.hidden=false;deviceHost.hidden=false;backToPlan.hidden=!roomPlanner?.active;cleanup?.();cleanup=mountLayout?.(deviceHost,zones);},setRoomPlanner(value){roomPlanner=value;},update(){if(sessionKey){const d=transport.getSelected();if(`${d?.id}:${d?.trackId}`!==sessionKey)releaseSong();}if(current==='lighting'&&lightView==='song')void ensureSong();},refresh(){positionHint.hidden=!dancer.hidden;},close(){show('');releaseSong();},destroy(){disposed=true;releaseSong();cleanup?.();fitButton.removeEventListener('click',onFit);}};
}
