import {FIXTURE_LIBRARY,fixtureProfile} from './dmx-fixture-library.js';
import {stageEquipment,stagePatch,fixtureKey} from './dmx-model.js';
import {colorCount,STAGE_PRESETS} from './dmx-auto.js';
import {COLOR_MODES,validColorMode} from './dj-color-modes.js';
import {GROUPS,cleanLook,cleanStageSettings,resolvedLook} from './dmx-show.js';
const KEY='anydj-stage-design-v1';
export function createStageEditor(host,onChange){
  let equipment=stageEquipment(),config=cleanStageSettings(undefined,4),mode='shared',count=2,sectionKey='',sectionName='',selected='global';
  let storageWarning='';
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');equipment=stageEquipment(saved?.equipment);config=cleanStageSettings(saved?.config,equipment.devices.length);if(saved?.equipment&&!saved.equipment.devices){const indices=saved.equipment.type==='bar'?[4]:equipment.devices.map((_,i)=>i);const old=cleanStageSettings(saved.config);config.members=indices.map(i=>old.members[i]);config.fixtures=indices.map(i=>old.fixtures[i]);for(const [key,layer] of Object.entries(old.sections))config.sections[key]={...layer,fixtures:indices.map(i=>layer.fixtures[i])};}mode=['shared',...Object.keys(STAGE_PRESETS),'design'].includes(saved?.mode)?saved.mode:saved?.enabled===true?'design':'shared';count=colorCount(saved?.count);}
  catch{storageWarning='Gespeicherte Gestaltung konnte nicht geladen werden.';}
  // One-time migration preserves the old four virtual heads and their position IDs.
  if(!equipment.unified){
    equipment=stageEquipment({unified:true,devices:[...equipment.devices,...Array.from({length:4},(_,i)=>({id:`moving-${i}`,type:'moving',cells:1}))]});
    config=cleanStageSettings(config,equipment.devices.length);
    config.members.splice(equipment.devices.length-4,4,0,0,1,1);
    try{localStorage.setItem(KEY,JSON.stringify({equipment,mode,count,config}));}catch{}
  }
  host.innerHTML=`<fieldset class="stage-equipment"><legend>Geräte</legend><p>Füge alle Geräte deiner Bühne hinzu. Moving Heads, Scheinwerfer und Lichtleisten gemeinsam konfigurieren.</p><div data-devices></div><div class="stage-controls"><button type="button" class="button secondary" data-add-moving>+ Moving Head</button><button type="button" class="button secondary" data-add-spot>+ Scheinwerfer</button><button type="button" class="button secondary" data-add-bar>+ Lichtleiste</button></div><details class="stage-fixture-library"><summary>Aus Gerätekatalog hinzufügen</summary><label>Hersteller oder Modell suchen<input type="search" data-library-search placeholder="z. B. SlimPAR oder Cameo"></label><label>Lichtgerät<select data-library-model></select></label><p data-library-info class="small"></p><a data-library-source target="_blank" rel="noopener">Hersteller-Handbuch</a><button type="button" class="button secondary" data-library-add>Gerät hinzufügen</button><p class="small">DMX-Profile für Farbe und Helligkeit. Stelle am Gerät den angegebenen Modus und die Startadresse ein. Moving Heads sind derzeit nur in der Vorschau verfügbar.</p></details><p data-capacity class="small"></p><p data-equipment-status role="status" class="small"></p><p class="small">Vorschau und DMX · Ausgabe unter „Live-Look & Verbindung“ einschalten.</p></fieldset><label>Lichtmodus<select data-mode><option value="shared">Alle Geräte gemeinsam</option>${Object.entries(STAGE_PRESETS).map(([id,preset])=>`<option value="${id}">${preset.name}</option>`).join('')}<option value="design">Manuell · pro Gerät gestalten</option></select></label>
  <div data-auto hidden><h3 data-auto-title>Die Musik gestaltet deine Bühne</h3><p data-auto-help>Farben und Bewegung folgen der Musik. Du bestimmst die maximale Anzahl gleichzeitiger Farben.</p>
  <label>Farben gleichzeitig · höchstens<select data-count><option value="1">1 Farbe · einheitlich</option><option value="2">Bis zu 2 Farben · abgestimmt</option><option value="3">Bis zu 3 Farben · abwechslungsreich</option><option value="4">Bis zu 4 Farben · vielfältig</option></select></label>
  <div class="stage-auto-palette" data-palette aria-label="Aktuelle Bühnenfarben"></div><p data-auto-status role="status"></p>
  <details class="stage-explanation"><summary>Wie entscheidet die Automatik?</summary><p class="small">Die vorbereitete Songanalyse entscheidet: ruhige Stellen dürfen auf allen Lampen dieselbe Farbe zeigen. Aufbauten und kräftige Passagen erhalten bei Bedarf mehr Farben und Bewegung. Die Farben folgen dem Farbmodus deiner Decks. Helligkeitsunterschiede erzeugen zusätzliche Schattierungen.</p></details></div>
  <div data-editor hidden><p>Klicke einen Scheinwerfer oder die Lichtleiste an. Gruppen teilen eine Einstellung; einzelne Geräte können davon abweichen.</p>
  <div class="stage-form"><label>Bearbeiten<select data-target><option value="global">Gesamte Bühne</option>${GROUPS.map((g,i)=>`<option value="g${i}">Gruppe: ${g}</option>`).join('')}${Array.from({length:5},(_,i)=>`<option value="f${i}">${i===4?'Lichtleiste':`Scheinwerfer ${i+1}`}</option>`).join('')}</select></label>
  <label>Gültigkeit<select data-scope><option value="all">Alle Songs und Abschnitte</option><option value="section">Aktueller Songabschnitt</option></select></label>
  <label data-membership hidden>Gerätegruppe<select data-group>${GROUPS.map((g,i)=>`<option value="${i}">${g}</option>`).join('')}</select></label></div>
  <p data-section class="small"></p><label class="stage-inherit"><input type="checkbox" data-own> Eigene Einstellungen für diese Auswahl</label>
  <fieldset data-fields><legend>Farbe und Animation</legend><div class="stage-form">
  <label>Farbmodus<select data-color><option value="auto">Lichtmix übernehmen</option><option value="opposite">Passende Gegenfarbe</option><option value="fixed">Feste Farbe</option><option value="custom">Eigene Palette</option>${COLOR_MODES.filter(m=>m.id!=='auto').map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</select></label>
  <label>Animation<select data-animation><option value="auto">Automatische Gesamtshow</option><option value="follow">Originale Helligkeit übernehmen</option><option value="wash">Ruhiges Hintergrundlicht</option><option value="pulse">Beat-Impulse</option><option value="alternate">Links / rechts abwechselnd</option><option value="wave">Farbwelle</option><option value="chase">Lauflicht</option></select></label>
  <label>Farbe A<input type="color" data-a></label><label>Farbe B<input type="color" data-b></label>
  <label>Helligkeit <output data-brightness-value></output><input type="range" min="0" max="100" step="1" data-brightness></label>
  <label>Animationsstärke <output data-strength-value></output><input type="range" min="0" max="100" step="1" data-strength></label>
  <label>Dauer eines Durchlaufs<select data-period>${[1,2,4,8,16].map(n=>`<option value="${n}">${n} ${n===1?'Beat':'Beats'}</option>`).join('')}</select></label>
  <label>Zeitversatz in Beats<input type="number" min="0" max="16" step="0.25" data-offset></label></div></fieldset>
  <p class="small">Automatik: Links und rechts setzen wechselnde Akzente, die Lichtleiste läuft mit. Ruhige Abschnitte erhalten Flächenlicht. Ohne Beat-Raster bleibt die originale Helligkeit erhalten. Vier Beats sind nicht bei jedem Song ein Takt.</p>
  <button type="button" class="button secondary" data-reset>Diese Auswahl zurücksetzen</button></div><p data-saved role="status" class="small"></p>`;
  const controls=new Map();
  const q=s=>{if(!controls.has(s))controls.set(s,host.querySelector(`[data-${s}]`));return controls.get(s);};
  q('equipment-status');
  const customs=[];
  try{const saved=JSON.parse(localStorage.getItem('anydj-custom-color-modes')||'[]');if(Array.isArray(saved))for(const m of saved.filter(validColorMode)){const id=`saved-${customs.length}`;customs.push(m);q('color').add(new Option(`Eigene: ${m.name}`,id));}}catch{}
  function scope(){return q('scope').value==='section'&&sectionKey?sectionKey:null;}
  function data(create=false){const key=scope();if(!key)return config;if(!config.sections[key]&&create)config.sections[key]={global:null,groups:[null,null,null],fixtures:equipment.devices.map(()=>null)};return config.sections[key];}
  function own(){const d=data();return selected==='global'?d?.global:selected[0]==='g'?d?.groups[+selected.slice(1)]:d?.fixtures[+selected.slice(1)];}
  function effective(){
    if(own())return own();
    if(selected[0]==='f')return resolvedLook(config,+selected.slice(1),scope());
    if(selected[0]==='g')return data()?.global||config.groups[+selected.slice(1)]||config.global;
    return config.global;
  }
  function set(value){if(scope()&&!data()&&Object.keys(config.sections).length>=256){q('saved').textContent='Maximal 256 Songabschnitte. Bitte eine vorhandene Abschnittsregel zurücksetzen.';return false;}const d=data(true);if(selected==='global')d.global=value;else d[selected[0]==='g'?'groups':'fixtures'][+selected.slice(1)]=value;
    if(scope()&&!d.global&&d.groups.every(v=>!v)&&d.fixtures.every(v=>!v))delete config.sections[scope()];
    return true;}
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify({equipment,mode,count,enabled:mode==='design',config}));q('saved').textContent='Auf diesem Gerät gespeichert.';}
    catch{q('saved').textContent='Speichern nicht möglich. Änderungen gelten nur bis zum Neuladen.';}
    onChange();
  }
  function refresh(){
    const patch=stagePatch(equipment),signature=JSON.stringify(equipment);
    if(q('devices').dataset.signature!==signature){
      q('devices').dataset.signature=signature;q('devices').replaceChildren();
      patch.forEach((f,i)=>{
        const row=document.createElement('div');row.className='stage-device-row';
        const check=document.createElement('input');check.type='checkbox';check.dataset.selectDevice=fixtureKey(f);check.setAttribute('aria-label',`${f.name} zur Auswahl hinzufügen`);row.append(check);
        const title=document.createElement('button');title.type='button';title.className='button secondary';title.dataset.positionDevice=fixtureKey(f);title.textContent=f.name;title.title='Gerät im Plan auswählen';row.append(title);
        const patchInfo=document.createElement('small');patchInfo.className='stage-device-patch';patchInfo.textContent=f.channels?`DMX ${f.address}–${f.address+f.channels-1} · ${f.mode||(f.type==='bar'?'RGB pro Segment':'Dimmer / RGB')}`:'Nur Vorschau · keine Motorsteuerung';row.append(patchInfo);
        if(f.type==='bar'){
          const label=document.createElement('label');label.textContent='Segmente';const input=document.createElement('input');input.type='number';input.min='1';input.max='170';input.value=f.cells;input.setAttribute('aria-label',`${f.name}: Segmente`);
          input.onchange=()=>changeEquipment(()=>{const next=structuredClone(equipment);next.devices[i].cells=Number(input.value);return next;});label.append(input);row.append(label);
        }
        const remove=document.createElement('button');remove.type='button';remove.className='button secondary';remove.textContent='Entfernen';remove.setAttribute('aria-label',`${f.name} entfernen`);
        remove.onclick=()=>changeEquipment(()=>({devices:equipment.devices.filter((_,j)=>j!==i)}),i);row.append(remove);q('devices').append(row);
      });
      if(!patch.length)q('devices').textContent='Noch keine Geräte. Füge einen Scheinwerfer oder eine Lichtleiste hinzu.';
      q('target').replaceChildren(new Option('Gesamte Bühne','global'),...GROUPS.map((g,i)=>new Option(`Gruppe: ${g}`,`g${i}`)),...patch.map((f,i)=>new Option(f.name,`f${i}`)));
    }
    q('capacity').textContent=`${patch.length} Geräte · ${patch.reduce((n,f)=>n+f.channels,0)} von 512 Kanälen belegt`;
    for(const option of q('target').options)if(option.value[0]==='g')option.hidden=option.disabled=!config.members.includes(+option.value.slice(1));
    if(![...q('target').options].some(o=>o.value===selected&&!o.disabled))selected='global';
    q('mode').value=mode;q('editor').hidden=mode!=='design';q('auto').hidden=!Object.hasOwn(STAGE_PRESETS,mode);q('count').value=count;
    q('auto-title').textContent=STAGE_PRESETS[mode]?.name||'Die Musik gestaltet deine Bühne';
    q('auto-help').textContent=STAGE_PRESETS[mode]?.help||'';
    q('target').value=selected;q('membership').hidden=selected[0]!=='f';
    if(selected[0]==='f')q('group').value=config.members[+selected.slice(1)];
    q('scope').options[1].disabled=!sectionKey;if(!sectionKey)q('scope').value='all';
    q('section').textContent=sectionKey?`Aktueller Abschnitt: ${sectionName}. Abschnittseinstellungen haben Vorrang vor den allgemeinen Einstellungen.`:'Für Abschnittseinstellungen einen Track abspielen. Die Demo verwendet allgemeine Einstellungen.';
    const base=selected==='global'&&!scope(),look=effective();
    q('own').checked=base||!!own();q('own').disabled=base;q('fields').disabled=!q('own').checked;
    q('color').value=look.mode;q('animation').value=look.animation;q('a').value=look.colors[0];q('b').value=look.colors[1];
    for(const key of ['brightness','strength','period','offset'])q(key).value=look[key];
    q('brightness-value').textContent=`${look.brightness} %`;q('strength-value').textContent=`${look.strength} %`;
    q('a').disabled=!['fixed','custom'].includes(look.mode);q('b').disabled=look.mode!=='custom';
    for(const key of ['period','offset','strength'])q(key).disabled=['follow','wash'].includes(look.animation);
  }
  function changeEquipment(create,removeIndex=null){
    try{
      const next=stageEquipment({...create(),unified:true});
      if(removeIndex!==null){
        config.members.splice(removeIndex,1);config.fixtures.splice(removeIndex,1);
        for(const layer of Object.values(config.sections))layer.fixtures.splice(removeIndex,1);
        if(selected[0]==='f'){const i=+selected.slice(1);selected=i===removeIndex?'global':`f${i>removeIndex?i-1:i}`;}
      }
      if(next.devices.length>equipment.devices.length){
        config.members.push(next.devices.at(-1).type==='bar'?2:(next.devices.length-1)%2);config.fixtures.push(null);
        for(const layer of Object.values(config.sections))layer.fixtures.push(null);
      }
      equipment=next;refresh();save();q('equipment-status').textContent='Geräteliste gespeichert · DMX-Adressen bei Änderungen prüfen.';
    }catch(error){q('devices').dataset.signature='';refresh();q('saved').textContent=error.message;q('equipment-status').textContent=error.message;}
  }
  function libraryInfo(){const p=fixtureProfile(q('library-model').value);q('library-add').disabled=!p;q('library-source').hidden=!p;q('library-info').textContent=p?`${p.mode} · ${p.map.length} Kanäle. ${p.note||'RGB und Helligkeit steuerbar.'}`:'Kein passendes Profil gefunden.';if(p)q('library-source').href=p.source;}
  function librarySearch(){const search=q('library-search').value.trim().toLocaleLowerCase();q('library-model').replaceChildren(...FIXTURE_LIBRARY.filter(p=>`${p.manufacturer} ${p.model}`.toLocaleLowerCase().includes(search)).map(p=>new Option(`${p.manufacturer} · ${p.model}`,p.id)));libraryInfo();}
  q('library-search').oninput=librarySearch;q('library-model').onchange=libraryInfo;
  q('library-add').onclick=()=>{const p=fixtureProfile(q('library-model').value);if(p)changeEquipment(()=>({devices:[...equipment.devices,{id:crypto.randomUUID(),type:p.type,cells:p.cells,modelId:p.id,name:`${p.manufacturer} ${p.model}`}]}));};
  librarySearch();
  q('add-moving').onclick=()=>changeEquipment(()=>({devices:[...equipment.devices,{id:crypto.randomUUID(),type:'moving',cells:1}]}));
  q('add-spot').onclick=()=>changeEquipment(()=>({devices:[...equipment.devices,{id:crypto.randomUUID(),type:'spot',cells:1}]}));
  q('add-bar').onclick=()=>changeEquipment(()=>({devices:[...equipment.devices,{id:crypto.randomUUID(),type:'bar',cells:8}]}));
  q('mode').onchange=()=>{mode=q('mode').value;refresh();save();};
  q('count').onchange=()=>{count=colorCount(+q('count').value);refresh();save();};
  q('target').onchange=()=>{selected=q('target').value;refresh();onChange();};
  q('scope').onchange=refresh;
  q('group').onchange=()=>{config.members[+selected.slice(1)]=+q('group').value;refresh();save();};
  q('own').onchange=()=>{const changed=set(q('own').checked?cleanLook(effective()):null);refresh();if(changed)save();};
  q('reset').onclick=()=>{const changed=set(selected==='global'&&!scope()?cleanLook():null);refresh();if(changed)save();};
  function change(){
    let mode=q('color').value,colors=[q('a').value,q('b').value];
    if(mode.startsWith('saved-')){colors=customs[+mode.slice(6)].colors;mode='custom';}
    else if(mode==='custom'&&effective().mode==='custom'&&effective().colors.length>2)colors=effective().colors;
    const changed=set(cleanLook({mode,colors,animation:q('animation').value,...Object.fromEntries(['brightness','strength','period','offset'].map(k=>[k,+q(k).value]))}));refresh();if(changed)save();
  }
  for(const key of ['color','animation','a','b','brightness','strength','period','offset'])q(key).addEventListener('input',()=>{if(key==='a'||key==='b'){const v=cleanLook(effective());v.colors=[q('a').value,q('b').value];set(v);}change();});
  refresh();q('saved').textContent=storageWarning;
  return {setProperties(ids,changes){
      const indices=equipment.devices.flatMap((d,i)=>ids.includes(fixtureKey(d))?[i]:[]);
      if(Number.isInteger(changes.group))for(const i of indices)config.members[i]=changes.group;
      changeEquipment(()=>({...equipment,devices:equipment.devices.map((d,i)=>indices.includes(i)?{...d,...changes}:d)}));
    },get equipment(){return equipment;},get config(){return config;},get enabled(){return mode!=='shared';},get mode(){return mode;},get count(){return count;},get selected(){return selected;},
    select(index){if(Object.hasOwn(STAGE_PRESETS,mode)){q('count').focus();return;}selected=`f${index}`;mode='design';refresh();save();q('target').focus();},
    preview(palette,description){const signature=JSON.stringify(palette);if(q('palette').dataset.colors!==signature){q('palette').dataset.colors=signature;q('palette').replaceChildren(...palette.map((rgb,i)=>{const chip=document.createElement('span');chip.style.background=`rgb(${rgb.join(',')})`;chip.setAttribute('role','img');chip.setAttribute('aria-label',`Farbe ${i+1}: RGB ${rgb.join(', ')}`);return chip;}));}if(q('auto-status').textContent!==description)q('auto-status').textContent=description;},
    context(key,name){key=key||'';if(sectionKey===key)return;sectionKey=key;sectionName=name||'';refresh();},
  };
}
