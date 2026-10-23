import {automaticFixtureGroups} from './dmx-group-motion.js';
// UI composition only: keep existing controls, handlers and saved settings intact.
export function createStageWorkspace(panel,{mountLighting,onFit,transport,zones,getPreviewLights=()=>({room:[],patch:[]}),onEditMode=()=>{}}){
  const q=s=>panel.querySelector(s),heading=q('.stage-3d-heading'),canvas=q('canvas'),tools=q('.stage-3d-tools'),status=q(':scope>p[role=status]');
  heading.querySelector('strong').innerHTML='Lichtshow <small>3D-Vorschau</small>';
  q('[data-stage3d-full]').textContent='Vollbild';
  const reset=q('[data-camera=reset]');reset.textContent='Raum einpassen';tools.append(reset);
  q('[data-stage3d-expand]').before(q('[data-stage3d-fps]'));
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
  const zoneHome=document.createComment('Zonen im Gerätemanager');
  const workspaceId=crypto.randomUUID();
  const pages=new Map(),buttons=new Map();let current='',cleanup=null,roomPlanner=null;
  for(const [key,title] of [['room','Raum'],['fixtures','Geräte'],['lighting','Licht'],['position','Standort'],['music','Decks']]){
    const button=document.createElement('button');button.type='button';button.className='button secondary';button.dataset.workspaceTab=key;button.textContent=title;button.setAttribute('aria-pressed','false');navigation.append(button);buttons.set(key,button);
    const page=document.createElement('div');page.className='stage-3d-tool-page';page.dataset.workspacePage=key;page.id='stage-tools-'+workspaceId+'-'+key;button.setAttribute('aria-controls',page.id);button.setAttribute('aria-expanded','false');page.hidden=true;body.append(page);pages.set(key,page);
    button.onclick=()=>show(current===key?'':key);
  }
  pages.get('music').append(q('.stage-3d-transport'));
  pages.get('room').append(room);pages.get('position').append(dancer);
  const positionHint=document.createElement('p');positionHint.className='stage-3d-position-hint';positionHint.textContent='Wähle „Im Raum“, um den Raum mit WASD zu erkunden oder Standort und Augenhöhe einzustellen.';pages.get('position').append(positionHint);
  const lightPage=pages.get('lighting'),lightTabs=document.createElement('div');lightTabs.className='stage-3d-light-tabs';
  lightTabs.innerHTML='<button type="button" class="button secondary" data-light-view="song">Song-Licht</button><button type="button" class="button secondary" data-light-view="live">Live-Look & Verbindung</button>';
  const songHost=document.createElement('div');songHost.className='stage-3d-song-editor';
  const songHint=document.createElement('p');songHint.className='stage-3d-song-editor-hint';
  const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Song-Licht bearbeiten';retry.hidden=true;
  const editorMount=document.createElement('div');songHost.append(songHint,retry,editorMount);
  const lightHost=document.createElement('div');lightHost.className='stage-3d-light-editor';lightPage.append(lightTabs,songHost,lightHost);
  const editButton=document.createElement('button');editButton.type='button';editButton.className='button secondary';editButton.textContent='Edit-Modus';editButton.setAttribute('aria-pressed','false');editButton.dataset.stageEdit='';
  const direct=document.createElement('div');direct.className='stage-3d-direct-edit';direct.hidden=true;
  direct.innerHTML='<p data-edit-hint role="status">Licht in der 3D-Ansicht anklicken. Die Auswahl gilt für den Abschnitt an der aktuellen Songposition.</p><button type="button" class="button secondary" data-edit-group>Gruppe auswählen</button><label>Formation<select data-edit-formation><option value="keep">Aktuelle Formation verschieben</option><option value="focus">Gemeinsames Ziel</option><option value="line">Linie</option><option value="fan">Fächer</option></select></label><label>Breite (m)<input data-edit-spread type="number" min="0" max="60" step="0.1" value="2"></label><button type="button" class="button secondary" data-edit-aim aria-pressed="false">Lichtziel im 3D-Bild anklicken</button>';
  songHost.prepend(direct);const dq=key=>direct.querySelector(`[data-edit-${key}]`);
  let editMode=false,aiming=false,selection=null,selectedLight='';
  function stopAim(){aiming=false;dq('aim').setAttribute('aria-pressed','false');}
  function setEditMode(value){if(value===editMode)return;editMode=value;work.classList.toggle('editing-direct',value);stopAim();direct.hidden=!value;editButton.setAttribute('aria-pressed',String(value));onEditMode(value);if(value)show('lighting');else releaseSong();}
  editButton.onclick=()=>{const value=!editMode;setEditMode(value);if(!value&&current==='lighting')show('');};
  dq('aim').onclick=()=>{if(!session||session.target==='scene'){dq('hint').textContent='Wähle zuerst ein Licht oder eine Raumgruppe.';return;}aiming=!aiming;dq('aim').setAttribute('aria-pressed',String(aiming));dq('hint').textContent=aiming?'Auf den Boden klicken, um die Lichtziele für den ausgewählten Zeitraum festzulegen. Escape bricht ab.':'Lichtziel-Auswahl beendet.';};
  dq('group').onclick=()=>{
    const room=roomPlanner?.active?roomPlanner.plan:null;
    const group=session?.targetGroups?.find(t=>t.members?.includes(`room:${room?.id}:${selectedLight}`)&&t.id.startsWith('room-group:'));
    const type=room?.positions[selectedLight]?.type;
    if(group)session.selectTargetAt(group.id);
    else if(type)session?.selectTargetAt(`room-type:${room.id}:${type}`);
    else dq('hint').textContent='Wähle zuerst ein Gerät im Raumplan.';
  };
  function applySelection(){if(!selection||!session)return;const {target,time}=selection;selection=null;if(session.selectTargetAt(target,time))dq('hint').textContent='Gerät ausgewählt. Farbe und Aktivität unten ändern oder ein Lichtziel im Bild wählen.';}
  let roomSignature='',lightView='song',session=null,sessionKey='',pending=null,epoch=0,disposed=false;
  function releaseSong(){stopAim();epoch++;pending?.abort();pending=null;session?.destroy();session=null;sessionKey='';editorMount.replaceChildren();}
  async function ensureSong(force=false){
    const selected=transport.getSelected(),key=selected?.canEdit?`${selected.id}:${selected.trackId}`:'';
    if(sessionKey&&sessionKey!==key)releaseSong();
    if(current!=='lighting'||lightView!=='song')return;
    if(!key){songHint.textContent='Lade unten einen vorbereiteten Song, um seine Lichtabschnitte hier zu bearbeiten.';retry.hidden=true;return;}
    if(!force&&sessionKey===key)return;
    releaseSong();sessionKey=key;songHint.textContent='Lichtmanager wird geöffnet …';retry.hidden=true;
    const own=++epoch;pending=new AbortController();
    try{
      const room=roomPlanner?.active?roomPlanner.plan:null;
      const devices=Object.entries(room?.positions||{}).filter(([,p])=>['moving','spot','bar'].includes(p.type));
      const roles=automaticFixtureGroups(devices.filter(([,p])=>p.type==='moving').map(([id,p])=>({id,position:p,group:p.group})));
      const groupRows=[...new Set([...roles.values()].map(r=>r.row))];
      const targets=room?[...['moving','spot','bar'].filter(type=>devices.some(([,p])=>p.type===type)).map(type=>({id:`room-type:${room.id}:${type}`,name:`Raumgruppe · ${type==='moving'?'Moving Heads':type==='spot'?'Scheinwerfer':'Lichtleisten'}`,members:devices.filter(([,p])=>p.type===type).map(([id])=>`room:${room.id}:${id}`),room:{width:room.width,depth:room.depth}})),...groupRows.map(group=>({id:`room-group:${room.id}:${group}`,name:`Formation · Gruppe ${group+1}`,members:devices.filter(([id])=>roles.get(id)?.row===group).map(([id])=>`room:${room.id}:${id}`),room:{width:room.width,depth:room.depth}})),...devices.map(([id,p])=>({id:`room:${room.id}:${id}`,name:p.name||id,room:{width:room.width,depth:room.depth},aim:p.target}))]:[];
      const editor=await transport.mountEditor(editorMount,{signal:pending.signal,targets,getTargetPreview:target=>{
        const scene=getPreviewLights(),prefix=`room:${room?.id}:`,typePrefix=`room-type:${room?.id}:`,groupPrefix=`room-group:${room?.id}:`;
        const selected=target.startsWith(prefix)?scene.room.filter(l=>l.id===target.slice(prefix.length)):target.startsWith(typePrefix)?scene.room.filter(l=>l.type===target.slice(typePrefix.length)):target.startsWith(groupPrefix)?scene.room.filter(l=>targets.find(t=>t.id===target)?.members?.includes(prefix+l.id)):target.startsWith('patch:')?scene.patch.filter(l=>l.id===target.slice(6)):[];
        return selected.map(l=>({color:l.color,power:l.power}));
      },onEditPosition:target=>{show('fixtures');const prefix=`room:${room?.id}:`;if(target.startsWith(prefix))roomPlanner?.selectDevice(target.slice(prefix.length));},onDispose:()=>{if(own!==epoch)return;session=null;songHint.textContent='Entwurf bleibt für diese Sitzung erhalten.';retry.hidden=false;}});
      if(own!==epoch||disposed){editor?.destroy();return;}
      pending=null;session=editor;applySelection();
      if(editor){
        // Share the timeline's zoom, scroll and playhead with the existing light curve.
        const track=editorMount.querySelector('.le-track'),curve=editorMount.querySelector('.le-preview-card canvas');
        track.classList.add('le-combined');track.insertBefore(curve,track.querySelector('.le-phases'));
        editorMount.querySelector('.le-preview-card').hidden=true;
        editorMount.querySelector('.le-timeline-tools strong').textContent='Lichtverlauf & Abschnitte';
      }
      songHint.textContent=editor?'Änderungen siehst du direkt in der 3D-Vorschau. Mit „Änderungen speichern“ übernehmen.':'Für diesen Song ist noch kein Lichtplan verfügbar.';
      retry.hidden=Boolean(editor);
    }catch(error){if(own!==epoch)return;pending=null;songHint.textContent=error.message;retry.hidden=false;}
  }
  retry.onclick=()=>ensureSong(true);
  function chooseLight(view='song',stageView='look'){
    cleanup?.();cleanup=null;lightView=view;if(view!=='song'&&editMode)setEditMode(false);
    songHost.hidden=view!=='song';lightHost.hidden=view==='song';
    lightTabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lightView===view)));
    work.classList.toggle('editing-song',current==='lighting'&&view==='song');
    if(view==='song'){const signature=JSON.stringify(roomPlanner?.active?roomPlanner.plan:null);if(signature!==roomSignature){releaseSong();roomSignature=signature;}}
    if(view==='live')cleanup=mountLighting?.(lightHost,stageView);else void ensureSong();
  }
  lightTabs.querySelectorAll('button').forEach(b=>b.onclick=()=>chooseLight(b.dataset.lightView));
  function show(key,view='song'){
    cleanup?.();cleanup=null;current=key;if(key!=='lighting'&&editMode)setEditMode(false);
    if(key==='room'){if(!zoneHome.parentNode)zones.panel.before(zoneHome);room.append(zones.panel);}else zoneHome.replaceWith(zones.panel);
    work.classList.toggle('has-tools',Boolean(key));work.classList.toggle('editing-room',key==='room');work.classList.toggle('editing-devices',key==='fixtures');inspector.hidden=!key;
    for(const [name,page] of pages){page.hidden=name!==key;buttons.get(name).setAttribute('aria-pressed',String(name===key));buttons.get(name).setAttribute('aria-expanded',String(name===key));}
    inspector.inert=!key;inspector.setAttribute('aria-label',key?buttons.get(key).textContent+' bearbeiten':'Vorbereitungswerkzeuge');
    panel.dispatchEvent(new Event('stage-tools-change'));
    if(key){inspectorHeader.querySelector('strong').textContent=key==='fixtures'?'Gerätemanager':buttons.get(key).textContent;body.scrollTop=0;}
    if(roomPlanner){
      if(key==='room'){pages.get('room').prepend(roomPlanner.root);roomPlanner.openStep(1);}
      if(key==='fixtures'){pages.get('fixtures').prepend(roomPlanner.root);roomPlanner.openStep(2);}
    }

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
  const stageSetup=document.createElement('button');stageSetup.type='button';stageSetup.className='button secondary';stageSetup.textContent='Geräte & Lichtziele bearbeiten';stageSetup.onclick=()=>show('fixtures');mode.after(stageSetup);
  const syncRoom=()=>{room.querySelector('.stage-3d-room-fields').hidden=!enabled.checked;all.hidden=!enabled.checked;q('[data-room-map]').toggleAttribute('hidden',!enabled.checked);stageSetup.hidden=false;mode.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(enabled.checked===(b.dataset.roomPreset==='true'))));all.disabled=!enabled.checked;};
  room.addEventListener('change',syncRoom);room.addEventListener('input',syncRoom);syncRoom();
  const toolEvents=new AbortController();
  function organizeTools(){
    tools.classList.add('stage-view-toolbar');tools.setAttribute('aria-label','3D-Ansicht steuern');
    const views=document.createElement('div');views.className='stage-view-group';views.setAttribute('role','group');views.setAttribute('aria-label','Perspektive');
    views.append(q('[data-camera=front]'),q('[data-camera=top]'),q('[data-dancer]'));
    const zoom=document.createElement('div');zoom.className='stage-view-group stage-view-zoom';zoom.setAttribute('role','group');zoom.setAttribute('aria-label','Ausschnitt');
    reset.textContent='Einpassen';reset.title='Raum einpassen';zoom.append(q('[data-camera=out]'),q('[data-camera=in]'),reset,editButton);
    const extras=document.createElement('div');extras.className='stage-view-extras';
    function disclosure(label,kind){
      const details=document.createElement('details');details.className='stage-view-menu';details.dataset.viewMenu=kind;
      const summary=document.createElement('summary');summary.textContent=label;
      const content=document.createElement('div');content.className='stage-view-popover';
      const title=document.createElement('strong');title.textContent=kind==='help'?'Die 3D-Ansicht bedienen':'Mit einer Brille ansehen';content.append(title);
      details.append(summary,content);extras.append(details);
      details.addEventListener('toggle',()=>{if(details.open)for(const other of extras.children)if(other!==details)other.open=false;},{signal:toolEvents.signal});
      return content;
    }
    const help=disclosure('Bedienung','help');help.append(q('[data-camera-help]'),status);
    const xr=disclosure('AR / VR','xr');xr.classList.add('stage-xr-flow');
    const intro=document.createElement('p');intro.textContent='Wie möchtest du die Lichtshow in der Brille öffnen?';
    const paths=document.createElement('div');paths.className='stage-xr-paths';paths.setAttribute('role','group');paths.setAttribute('aria-label','Verbindungsweg');
    const share=q('.stage-vr-share'),setup=q('.stage-vr-setup'),vrStatus=q('.stage-vr-status');
    const remote=document.createElement('section'),local=document.createElement('section');remote.dataset.xrPath='remote';local.dataset.xrPath='local';
    const remoteHeading=document.createElement('h3');remoteHeading.textContent='1 · Brille verbinden';
    const next=document.createElement('p');next.className='stage-xr-next';next.textContent='2 · Nach der Kopplung im Browser der Brille „VR starten“ wählen. Die Musik steuerst du hier am Rechner.';
    share.open=true;remote.append(remoteHeading,share,next);
    const localHeading=document.createElement('h3');localHeading.textContent='1 · PC-Verbindung prüfen';
    const actions=document.createElement('div');actions.className='stage-view-xr-actions';
    const recheck=q('[data-vr-recheck]');setup.open=true;
    const startHeading=document.createElement('h3');startHeading.textContent='2 · Vorschau starten';
    actions.append(q('[data-stage-vr]'),q('[data-stage-ar]'));
    local.append(localHeading,recheck,setup,startHeading,actions,vrStatus);
    let userPathChosen=false;
    function choosePath(path){remote.hidden=path!=='remote';local.hidden=path!=='local';for(const button of paths.children)button.setAttribute('aria-pressed',String(button.dataset.xrChoose===path));}
    for(const [path,label] of [['remote','Browser in der Brille'],['local','Brille am PC']]){const button=document.createElement('button');button.type='button';button.className='button secondary';button.dataset.xrChoose=path;button.textContent=label;button.onclick=()=>{userPathChosen=true;choosePath(path);};paths.append(button);}
    function syncConnection(){
      const connected=share.dataset.connection==='connected';
      remoteHeading.textContent=connected?'Brille verbunden':'1 · Brille verbinden';
      next.textContent=connected?'Die Vorschau ist verbunden. Wähle „VR starten“ in der Brille. Aufbau und Lichtshow werden live übertragen.':'2 · Nach der Kopplung im Browser der Brille „VR starten“ wählen. Die Musik steuerst du hier am Rechner.';
      const ready=setup.dataset.vrState==='ready';localHeading.textContent=ready?'PC-VR ist bereit':'1 · PC-Verbindung prüfen';
      local.classList.toggle('is-ready',ready);
      if(ready&&!userPathChosen&&!['waiting','connected'].includes(share.dataset.connection))choosePath('local');
    }
    xr.append(intro,paths,remote,local);choosePath(setup.dataset.vrState==='ready'?'local':'remote');syncConnection();
    panel.addEventListener('vr-connection-change',syncConnection,{signal:toolEvents.signal});
    tools.replaceChildren(views,zoom,q('[data-focus-point]'),extras);
    document.addEventListener('pointerdown',event=>{for(const menu of extras.children)if(menu.open&&!menu.contains(event.target))menu.open=false;},{signal:toolEvents.signal});
    tools.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const open=[...extras.children].find(m=>m.open);if(open){event.preventDefault();event.stopPropagation();open.open=false;open.querySelector('summary').focus();}},{signal:toolEvents.signal});
  }
  const fitButton=reset;fitButton.addEventListener('click',onFit);
  show('');
  return {show,exitEdit(){setEditMode(false);},get editMode(){return editMode;},get aiming(){return aiming;},cancelAim(){if(!aiming)return false;stopAim();return true;},
    selectLight(id){
      if(!editMode)return;stopAim();selectedLight=id;
      const room=roomPlanner?.active?roomPlanner.plan:null;
      const target=room?.positions[id]?`room:${room.id}:${id}`:`patch:${id}`;
      selection={target,time:transport.getSelected()?.position||0};
      if(current!=='lighting'||lightView!=='song')show('lighting');
      applySelection();
    },
    aimAt(point){
      if(!aiming||!session)return false;
      const room=roomPlanner?.active?roomPlanner.plan:null,target=session.target;
      if(!room||!target.startsWith('room')){dq('hint').textContent='Lichtziele per Klick sind für Geräte im Raumplan verfügbar.';stopAim();return true;}
      const prefix=`room:${room.id}:`;
      const ids=session.targetMembers;
      const members=getPreviewLights().room.filter(l=>ids.includes(prefix+l.id)).map(l=>({...l,targetId:prefix+l.id}));
      if(session.reformAt(members,point,dq('formation').value,Number(dq('spread').value),room.boundary)){stopAim();dq('hint').textContent='Formation im ausgewählten Zeitraum geändert. Mit „Änderungen speichern“ übernehmen.';}
      return true;
    },
    selectedLights(){
      if(!editMode||!session)return [];
      const room=roomPlanner?.active?roomPlanner.plan:null;
      if(!room)return session.targetMembers.filter(id=>id.startsWith('patch:')).map(id=>id.slice(6));
      const prefix=`room:${room.id}:`;return session.targetMembers.filter(id=>id.startsWith(prefix)).map(id=>id.slice(prefix.length));
    },dismiss(){if(!current)return false;const button=buttons.get(current);show('');button?.focus();return true;},organizeTools,setRoomPlanner(value){roomPlanner=value;},update(){if(sessionKey){const d=transport.getSelected();if(`${d?.id}:${d?.trackId}`!==sessionKey)releaseSong();}if(current==='lighting'&&lightView==='song')void ensureSong();},refresh(){positionHint.hidden=!dancer.hidden;},close(){setEditMode(false);show('');releaseSong();},destroy(){disposed=true;toolEvents.abort();releaseSong();cleanup?.();zoneHome.replaceWith(zones.panel);fitButton.removeEventListener('click',onFit);}};
}
