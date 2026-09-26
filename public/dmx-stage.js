import {createDmxConnection} from './dmx-connection.js';
import {automaticStage,STAGE_PRESETS} from './dmx-auto.js';
import {createStageEditor} from './dmx-editor.js';
import {mixFixtureFrames} from './dmx-show.js';
import {stagePatch,encodeStage,decodeStage,fixtureKey} from './dmx-model.js';
import {createMovingHeads} from './dmx-moving-heads.js';
import {createStageLayout} from './dmx-layout.js';
import {createStage3d} from './dmx-stage-3d.js';

export function createDmxStage(button,{adjustFrame=frame=>frame,getMovingPlans=()=>[]}={}) {
  const panel=document.createElement('dialog');
  panel.className='dmx-stage';panel.id='dmxStage';panel.setAttribute('aria-labelledby','stageTitle');
  panel.innerHTML=`<div class="stage-heading"><div><span class="stage-badge">LICHTBÜHNE</span><h2 id="stageTitle">Virtuelle Lichtbühne</h2></div><button type="button" class="button secondary" data-close aria-label="Lichtbühne schließen">Schließen</button></div>
    <p class="stage-intro">Deine Musik auf deiner ausgewählten Ausstattung. Wähle den Lichtmodus: gemeinsam, automatisch zur Musik oder manuell pro Gerät.</p>
    <div class="stage-workspace"><div class="stage-preview"><div class="stage-scene" aria-label="Virtuelle Bühne mit vier Scheinwerfern und einer Lichtleiste"><div class="stage-spots"></div><div class="stage-bars"></div><span class="stage-floor-label">LICHTLEISTE · 8 SEGMENTE</span></div>
    <p class="stage-status" role="status"></p>
    <div class="stage-controls"><button type="button" class="button primary" data-demo aria-pressed="false">Demo ohne Musik starten</button><button type="button" class="button secondary" data-blackout aria-pressed="false">Vorschau abdunkeln</button></div>
    <p class="stage-help">Zum Ausprobieren: Demo starten. Für deine eigene Show: Track auf Deck A laden und Play drücken. Die Bühne folgt dem Lichtmix – auch bei „Nur Audio“. Du kannst das DJ-Pult weiter bedienen.</p>
    </div><div class="stage-editor"></div></div>
    <details class="stage-technical"><summary>Kanalbelegung &amp; technische Details</summary><p>DMX überträgt Zahlen für Farbe und Helligkeit. Hier erzeugen wir diese Kanalwerte und stellen daraus die Geräte dar. Im gemeinsamen Modus folgen alle Geräte dem Lichtmix. Im Gestaltungsmodus erhält jedes Gerät eigene Kanalwerte.</p><p>Generische Beispielgeräte, keine exakte Nachbildung eines Herstellers. Echte Geräte erhalten nur bei ausdrücklich eingeschalteter DMX-Ausgabe Signale. Die Darstellung nähert Licht und Helligkeit an.</p><table><thead><tr><th>Gerät</th><th>Kanäle</th><th>Belegung</th></tr></thead><tbody></tbody></table><p class="stage-values"></p></details>`;
  document.body.append(panel);
  const colorPreview=button.closest('.dj-mixer')?.querySelector('.dj-color-preview');
  const inline=colorPreview?document.createElement('section'):null;
  let active=false,editorPreview=null,previewMode='2d';
  const settingsButton=document.createElement('button');
  settingsButton.type='button';settingsButton.id='stageSettings';settingsButton.className='button secondary';settingsButton.textContent='Bühne einstellen';settingsButton.hidden=true;
  if(inline){
    inline.className='stage-inline';inline.id='inlineLightStage';inline.hidden=true;inline.setAttribute('aria-label','Virtuelle Lichtbühne');
    const heading=document.createElement('span');heading.className='stage-inline-title';heading.textContent='Virtuelle Lichtbühne · Simulation';
    inline.append(heading,panel.querySelector('.stage-scene'),panel.querySelector('.stage-status'));colorPreview.after(inline);
    const toolbar=document.createElement('div');toolbar.className='stage-inline-toolbar';button.before(toolbar);toolbar.append(button,settingsButton);
    panel.classList.add('stage-settings-only');panel.querySelector('#stageTitle').textContent='Lichtbühne einstellen';
    button.textContent='Lichtbühne aktivieren';button.setAttribute('aria-pressed','false');
  }
  button.setAttribute('aria-controls',inline?inline.id:panel.id);settingsButton.setAttribute('aria-controls',panel.id);settingsButton.setAttribute('aria-expanded','false');button.setAttribute('aria-expanded','false');
  const scene=(inline||panel).querySelector('.stage-scene'),spots=scene.querySelector('.stage-spots'),bars=scene.querySelector('.stage-bars');
  const layout=createStageLayout({getFixtures:()=>stagePatch(editor.equipment).map((f,i)=>({...f,group:editor.config.members[i]})),onProperties:(ids,changes)=>editor.setProperties(ids,changes),onChange:()=>render()});
  let movingPreview=[];
  const stage3d=createStage3d(inline||panel.querySelector('.stage-preview'),inline||panel.querySelector('.stage-controls'),{getLayout:()=>layout.value,onFixturePosition:(id,p)=>layout.setFixturePosition(id,p),onZonePlan:zones=>layout.attachZones(zones),getFixtureAims:()=>layout.getAims(),setFixtureAim:(id,p)=>layout.setAim(id,p),mountLighting:(host,view)=>mountLighting(host,view),onToggle:()=>{movingHeads.refresh();render();},onShareChange:()=>{movingHeads.refresh();render();if(stage3d.sharing)startTimer();else if(!active&&!panel.open&&!hardware.enabled&&!editorPreview){clearInterval(timer);timer=null;}}});
  const movingHeads=createMovingHeads(scene,inline||panel.querySelector('.stage-controls'),{getDevices:()=>stagePatch(editor.equipment).map((f,i)=>({...f,group:editor.config.members[i]})).filter(f=>f.type==='moving'),getPlans:()=>[...getMovingPlans(),...(editorPreview?.streams??[]).map(s=>s.movingPlan).filter(Boolean)],getLayout:()=>layout.value,getPreviewEnabled:()=>stage3d.needsScene,onPreview:value=>{movingPreview=value;layout.update(value);},showMoodControl:false,adjustFrame});
  const previewControls=inline||panel.querySelector('.stage-controls');
  previewControls.querySelector('[data-moving-heads]').after(previewControls.querySelector('[data-stage3d-toggle]'));
  const layoutButton=document.createElement('button');layoutButton.type='button';layoutButton.className='button secondary';layoutButton.dataset.layoutOpen='';layoutButton.textContent='Gerätemanager';layoutButton.setAttribute('aria-haspopup','dialog');layoutButton.onclick=()=>{if(panel.open)close();tabs?.children[1].click();stage3d.openDevices(layoutButton);};
  (inline||panel.querySelector('.stage-controls')).append(layoutButton);
  const statusNode=(inline||panel).querySelector('.stage-status');
  const sceneHome=document.createComment('stage-scene-home');scene.before(sceneHome);
  let tabs=null;
  if(inline){
    tabs=document.createElement('div');tabs.className='stage-view-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Lichtshow-Ansicht');
    const two=document.createElement('div');two.id='stage-view-2d';two.setAttribute('role','tabpanel');two.setAttribute('aria-labelledby','stage-tab-2d');sceneHome.before(two);two.append(sceneHome,scene);
    const three=inline.querySelector('.stage-3d');three.id='stage-view-3d';three.setAttribute('role','tabpanel');three.setAttribute('aria-labelledby','stage-tab-3d');
    for(const mode of ['2d','3d']){
      const tab=document.createElement('button');tab.type='button';tab.id='stage-tab-'+mode;tab.className='button secondary';tab.textContent=mode.toUpperCase();tab.setAttribute('role','tab');tab.setAttribute('aria-controls','stage-view-'+mode);
      tab.onclick=()=>{previewMode=mode;two.hidden=mode!=='2d';void stage3d.setEnabled(mode==='3d');for(const b of tabs.children){const selected=b===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}};
      tab.setAttribute('aria-selected',String(mode==='2d'));tab.tabIndex=mode==='2d'?0:-1;tabs.append(tab);
    }
    tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?1:previewMode==='2d'?1:0;tabs.children[index].click();tabs.children[index].focus();};
    button.hidden=true;
    settingsButton.hidden=false;settingsButton.classList.add('stage-expand-icon');settingsButton.title='Große Lichtshow-Ansicht öffnen';settingsButton.setAttribute('aria-label',settingsButton.title);settingsButton.setAttribute('aria-haspopup','dialog');
    settingsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';
    inline.querySelector('.stage-inline-title').remove();
    inline.querySelector('[data-stage3d-toggle]').hidden=true;
  }
  const nodes=[],fixtureNodes=[];
  let demo=false,blackout=false,current=null,playing=false,timer,streams=[];
  const editor=createStageEditor(panel.querySelector('.stage-editor'),()=>render());
  const hardware=createDmxConnection(panel.querySelector('.stage-editor'),()=>{if(inline&&!active)activate(true);render();startTimer();});
  // Keep daily show controls first; setup and preview tools are disclosed on demand.
  function fold(node,title,className){
    const details=document.createElement('details');details.className='stage-section '+className;
    const summary=document.createElement('summary');summary.textContent=title;
    node.before(details);details.append(summary,node);return details;
  }
  const equipmentSection=fold(panel.querySelector('.stage-equipment'),'Ausstattung','stage-equipment-section');
  const editorHost=panel.querySelector('.stage-editor');
  editorHost.append(equipmentSection);
  const hardwareSection=fold(panel.querySelector('.stage-hardware'),'Echte Lampen verbinden','stage-connection-section');
  editorHost.append(hardwareSection);
  const connectionStatus=hardwareSection.querySelector('[role=status]');
  hardwareSection.querySelector('summary').append(connectionStatus);
  const preview=panel.querySelector('.stage-preview');
  if(inline){const previewSection=fold(preview,'Vorschau ausprobieren','stage-preview-section');editorHost.append(previewSection);}
  // Keep the existing control nodes and handlers; organize them around DJ tasks.
  panel.classList.add('stage-redesigned');
  panel.querySelector('.stage-badge').textContent='DEIN LICHT';
  panel.querySelector('.stage-intro').textContent='Wähle deinen Look. Passe die Wirkung an. Deine Änderungen sind sofort sichtbar.';
  const nav=document.createElement('nav');nav.className='stage-navigation';nav.setAttribute('aria-label','Lichtbühne Bereiche');
  const pages=document.createElement('div');pages.className='stage-pages';
  const views={};
  function selectView(name){for(const [key,value] of Object.entries(views)){value.page.hidden=key!==name;value.button.setAttribute('aria-pressed',String(key===name));}panel.querySelector('.stage-workspace').scrollTop=0;}
  for(const [key,title,description] of [['look','Live-Look','Stil und Bühnenfarben'],['tuning','Feinschliff','Helligkeit und Farbwirkung'],['equipment','Geräte','Deine Bühne zusammenstellen'],['connection','Verbindung','Lampen einschalten']]){
    const tab=document.createElement('button');tab.type='button';tab.className='stage-nav-button';tab.innerHTML=`<strong>${title}</strong><span>${description}</span>`;tab.onclick=()=>selectView(key);nav.append(tab);
    const page=document.createElement('section');page.className='stage-page';page.dataset.stagePage=key;page.setAttribute('aria-label',title);pages.append(page);views[key]={button:tab,page};
  }
  panel.querySelector('.stage-heading').after(nav);editorHost.append(pages);
  const live=views.look.page;
  const modeLabel=editorHost.querySelector('[data-mode]').closest('label');modeLabel.hidden=true;live.append(modeLabel);
  const modeHeading=document.createElement('h3');modeHeading.textContent='Wie soll dein Licht spielen?';live.append(modeHeading);
  const modeButtons=document.createElement('div');modeButtons.className='stage-mode-grid';live.append(modeButtons);
  const names={shared:['Gemeinsam','Alle Lampen folgen dem Mix'],auto:['Automatisch','Passend zum Song'],chase:['Lauflicht','Bewegung durch die Bühne'],wash:['Ruhige Flächen','Weich und zurückhaltend'],follow:['Musikimpulse','Gemeinsam im Rhythmus'],alternate:['Gruppenwechsel','Links und rechts im Wechsel'],design:['Individuell','Farben und Bewegung selbst wählen']};
  for(const [mode,[name,description]] of Object.entries(names)){
    const choice=document.createElement('button');choice.type='button';choice.className='stage-mode-choice';choice.dataset.stageChoice=mode;choice.innerHTML=`<strong>${name}</strong><span>${description}</span>`;
    choice.onclick=()=>{const select=editorHost.querySelector('[data-mode]');select.value=mode;select.dispatchEvent(new Event('change'));};modeButtons.append(choice);
  }
  const automatic=editorHost.querySelector('[data-auto]');automatic.classList.add('stage-look-card');live.append(automatic);
  const tuningHost=document.createElement('section');tuningHost.className='stage-tuning-host stage-look-card';views.tuning.page.append(tuningHost);
  const individual=editorHost.querySelector('[data-editor]');individual.classList.add('stage-look-card');live.append(individual);
  const previewTools=panel.querySelector('.stage-preview-section');if(previewTools)live.append(previewTools);
  editorHost.append(editorHost.querySelector('[data-saved]'));
  panel.querySelector('.stage-hardware button').before(connectionStatus);
  equipmentSection.open=true;layout.attachEquipment(equipmentSection);
  const equipmentIntro=document.createElement('p');equipmentIntro.textContent='Geräte hinzufügen, konfigurieren und im selben Plan positionieren.';views.equipment.page.append(equipmentIntro);
  const equipmentLayoutButton=layoutButton.cloneNode(true);equipmentLayoutButton.onclick=()=>{if(panel.open)close();tabs?.children[1].click();stage3d.openDevices(equipmentLayoutButton);};views.equipment.page.prepend(equipmentLayoutButton);
  hardwareSection.open=true;views.connection.page.append(hardwareSection,panel.querySelector('.stage-technical'));
  if(inline)live.append(previewControls.querySelector('[data-moving-heads]'),layoutButton);
  selectView('look');
  const demoButton=panel.querySelector('[data-demo]'),blackoutButton=panel.querySelector('[data-blackout]');
  function mountLighting(host,view='look'){
    const editorMarker=document.createComment('lighting-home'),navMarker=document.createComment('lighting-nav-home');
    editorHost.before(editorMarker);nav.before(navMarker);host.append(nav,editorHost);host.classList.add('stage-redesigned');selectView(view);
    return ()=>{editorMarker.replaceWith(editorHost);navMarker.replaceWith(nav);};
  }
  const lastFrame=()=>current,lastStreams=()=>streams,lastDemo=()=>demo,lastBlackout=()=>blackout;
  function render(){
    if(!panel.open&&!active&&!hardware.enabled&&!editorPreview&&!stage3d.sharing)return;
    const current=editorPreview?.frame??lastFrame(),streams=editorPreview?.streams??lastStreams();
    const demo=editorPreview?false:lastDemo(),blackout=editorPreview?false:lastBlackout();
    panel.dataset.design=String(editor.enabled);panel.dataset.stageMode=editor.mode;
    for(const choice of modeButtons.children)choice.setAttribute('aria-pressed',String(choice.dataset.stageChoice===editor.mode));
    const equipment=editor.equipment,patch=stagePatch(equipment);
    const equipmentTitle='Ausstattung · '+patch.length+' Geräte';
    if(equipmentSection.querySelector('summary').textContent!==equipmentTitle)equipmentSection.querySelector('summary').textContent=equipmentTitle;
    const signature=JSON.stringify(equipment);
    if(scene.dataset.equipment!==signature){
      if(scene.dataset.equipment&&hardware.enabled)void hardware.stop('Ausstattung geändert · DMX-Ausgabe bitte erneut einschalten.');
      scene.dataset.equipment=signature;scene.dataset.type='mixed';spots.replaceChildren();bars.replaceChildren();nodes.length=0;fixtureNodes.length=0;
      patch.forEach((f,i)=>{
        const select=()=>{openSettings();editor.select(i);};
        if(f.type==='moving'){nodes[i]=[];return;}
        if(f.type==='spot'){
          const node=document.createElement('button');node.type='button';node.className='stage-spot';node.onclick=select;
          node.innerHTML='<span class="stage-light-name"></span><i class="stage-lamp"></i><i class="stage-beam"></i>';node.querySelector('span').textContent=f.name.replace('Scheinwerfer ','');spots.append(node);nodes[i]=[node];fixtureNodes[i]=node;
        }else{
          const row=document.createElement('div');row.className='stage-bar-row';
          const name=document.createElement('span');name.textContent=f.name;row.append(name);
          const bar=document.createElement('div');bar.className='stage-bar';bar.setAttribute('role','button');bar.tabIndex=0;bar.setAttribute('aria-label',`${f.name} gestalten`);bar.onclick=select;bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
          nodes[i]=Array.from({length:f.cells},()=>{const cell=document.createElement('i');cell.className='stage-cell';bar.append(cell);return cell;});fixtureNodes[i]=bar;row.append(bar);bars.append(row);
        }
      });
      spots.hidden=!patch.some(f=>f.type==='spot');bars.hidden=!patch.some(f=>f.type==='bar');
      const label=scene.querySelector('.stage-floor-label');label.hidden=patch.length>0;label.textContent='Keine Geräte · unter „Bühne einstellen“ hinzufügen';
      scene.setAttribute('aria-label',scene.dataset.hasMovingHeads==='true'?'Moving-Head-Vorschau':`Virtuelle Bühne mit ${patch.length} Geräten`);
      editorHost.querySelector('tbody').innerHTML=patch.map(f=>`<tr><td>${f.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</td><td>${f.channels?`${f.address}–${f.address+f.channels-1}`:'Vorschau'}</td><td>${f.mode||(f.type==='bar'?`${f.cells} × Rot, Grün, Blau`:f.type==='moving'?'Nur Vorschau':'Helligkeit, Rot, Grün, Blau')}</td></tr>`).join('');
    }
    const t=performance.now()/1000;
    const sample=demo?{state:true,r:Math.round(128+127*Math.sin(t*.6)),g:Math.round(128+127*Math.sin(t*.6+2)),b:Math.round(128+127*Math.sin(t*.6+4)),dimming:45+25*Math.sin(t*2)}:current;
    const inputs=demo?[{frame:sample,weight:1,beat:t*2,look:'peak',washDimming:55}]:streams.length?streams:[{frame:sample,weight:1}];
    const main=inputs.filter(s=>s.frame&&s.weight>0).sort((a,b)=>b.weight-a.weight)[0];
    editor.context(main?.sectionKey,main?.sectionName);
    fixtureNodes.forEach((node,i)=>node.setAttribute('aria-pressed',String(editor.mode==='design'&&editor.selected===`f${i}`)));
    const automatic=Object.hasOwn(STAGE_PRESETS,editor.mode)?automaticStage(inputs,editor.count,equipment,editor.mode):null;
    if(automatic)editor.preview(automatic.palette.map(rgb=>{const f=adjustFrame({r:rgb[0],g:rgb[1],b:rgb[2],dimming:100});return [f.r,f.g,f.b];}),automatic.description);
    const rawOutput=automatic?automatic.frames:editor.mode==='design'?mixFixtureFrames(inputs,editor.config,equipment):sample;
    const output=patch.map((f,i)=>Array.from({length:f.cells},(_,j)=>{const value=Array.isArray(rawOutput)?rawOutput[i]?.[j]:rawOutput;const adjusted=adjustFrame(value);return adjusted?{...adjusted,dimming:(adjusted.dimming??0)*(f.gain??100)/100}:adjusted;}));
    hardware.setDemo(demo);
    hardware.push(encodeStage(demo?null:output,equipment));
    const universe=encodeStage(blackout?null:output,equipment),fixtures=decodeStage(universe,equipment);
    fixtures.forEach((f,i)=>{if(f.type==='moving')f.cells=output[i].map(frame=>!frame||frame.state===false||blackout?[0,0,0]:['r','g','b'].map(k=>Math.round(Math.max(0,Math.min(255,frame[k]||0))*(frame.dimming||0)/100)));});
    movingHeads.update(fixtures,adjustFrame(sample),t,blackout,inputs,editor.mode,editor.count);
    layout.setLights(fixtures.filter(f=>f.type!=='moving'));
    stage3d.update(fixtures.filter(f=>f.type!=='moving'),movingPreview,{streams:inputs});
    fixtures.forEach((f,i)=>f.cells.forEach((rgb,j)=>{
      const target=nodes[i]?.[j];if(!target)return;
      target.style.setProperty('--stage-color',`rgb(${rgb.join(',')})`);
      // Decoded RGB already includes dimming. Apply it only once to the beam.
      const power=Math.max(...rgb)/255;
      const beamColor=power?rgb.map(v=>Math.round(v/power)):rgb;
      target.style.setProperty('--stage-beam-color',`rgb(${beamColor.join(',')})`);
      target.style.setProperty('--stage-power',String(power));
      if(f.type==='bar')target.setAttribute('role','img');target.setAttribute('aria-label',`${f.name}${f.type==='bar'?` Segment ${j+1}`:' gestalten'}: RGB ${rgb.join(', ')}`);
    }));
    const status=blackout?'Vorschau abgedunkelt · Musik und echte Lampen bleiben unverändert.':demo?'Demo läuft · Beispiellicht ohne Musik.':current?'Live-Vorschau · folgt deinem DJ-Lichtmix.':playing?'Kein hörbares Deck im Lichtmix · Crossfader und Lautstärke prüfen.':'Bereit · Starte die Demo oder spiele einen Track im DJ-Pult ab.';
    const displayStatus=inline?(blackout?'Vorschau abgedunkelt':demo?'Demo läuft · ohne Musik':current?'Live · folgt der Musik':playing?'Kein Deck im Lichtmix':'Bereit · Track oder Demo starten'):status;
    statusNode.title=status;if(statusNode.textContent!==displayStatus)statusNode.textContent=displayStatus;
    demoButton.disabled=playing;demoButton.textContent=demo?'Demo beenden':'Demo ohne Musik starten';demoButton.setAttribute('aria-pressed',String(demo));
    blackoutButton.textContent=blackout?'Vorschau wieder einschalten':'Vorschau abdunkeln';blackoutButton.setAttribute('aria-pressed',String(blackout));
    if(editorHost.querySelector('.stage-technical').open){const f=patch[0];editorHost.querySelector('.stage-values').textContent=f?`${f.name} · erste Kanäle: ${Array.from(universe.slice(f.address-1,f.address-1+Math.min(4,f.channels))).join(' / ')}`:'Keine Geräte konfiguriert.';}

  }
  function startTimer(){if(!timer)timer=setInterval(render,50);}
  function close(){panel.close();if(inline)sceneHome.after(scene);if(!active&&!hardware.enabled&&!stage3d.sharing){demo=false;blackout=false;clearInterval(timer);timer=null;}button.setAttribute('aria-expanded',String(active));settingsButton.setAttribute('aria-expanded','false');}
  function openSettings(){if(stage3d.isOpen){stage3d.openTools('lighting');return;}selectView('look');if(inline)panel.querySelector('.stage-heading').after(scene);if(!panel.open)panel.showModal();settingsButton.setAttribute('aria-expanded','true');if(!inline)button.setAttribute('aria-expanded','true');render();startTimer();}
  function activate(value){
    active=value;button.closest('.dj-mixer').classList.toggle('has-inline-stage',active);inline.hidden=!active;colorPreview.hidden=active;settingsButton.hidden=!active;
    button.textContent=active?'Bühne deaktivieren':'Lichtbühne aktivieren';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-expanded',String(active));
    if(active){render();startTimer();}else {void hardware.stop();close();}
    try{localStorage.setItem('anydj-stage-visible',String(active));}catch{}
  }
  button.addEventListener('click',()=>{if(inline){activate(!active);return;}if(panel.open)close();else openSettings();});
  settingsButton.onclick=()=>{if(previewMode==='3d'){if(panel.open)close();stage3d.open(settingsButton);}else openSettings();};
  panel.querySelector('[data-close]').onclick=()=>{close();(active?settingsButton:button).focus();};
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();(active?settingsButton:button).focus();}});
  demoButton.onclick=()=>{demo=!demo;blackout=false;render();};
  blackoutButton.onclick=()=>{blackout=!blackout;render();};
  if(inline)activate(true);
  return {
    tabs,
    mountOptions(node,fullButton){live.prepend(node);node.open=true;live.append(fullButton);},
    mountEditor(host){
      if(editorPreview)throw Error('Ein Lichteditor ist bereits geöffnet.');
      const marker=document.createComment('stage-editor-mount');scene.before(marker);host.append(scene);
      const status=document.createElement('p');status.className='le-set-status';host.append(status);
      editorPreview={frame:null,streams:[]};startTimer();
      return {
        update(frame,nextStreams){if(!editorPreview)return;const changed=editorPreview.streams[0]?.movingPlan!==nextStreams[0]?.movingPlan;editorPreview={frame,streams:nextStreams};if(changed)movingHeads.prepare();render();status.textContent=hardware.enabled?'DMX-Ausgabe aktiv · Entwurf live am Set':'Bühnenvorschau · DMX-Ausgabe nicht aktiviert';},
        destroy(){editorPreview=null;marker.replaceWith(scene);status.remove();render();if(!active&&!panel.open&&!hardware.enabled&&!stage3d.sharing){clearInterval(timer);timer=null;}}
      };
    },
    setTransport:stage3d.setTransport,
    prepareMovingHeads(){movingHeads.prepare();},
    setMovingMood(value){movingHeads.setMood(value);},
    tuningHost,
    openSettings(view='look'){openSettings();selectView(view);},
    update(frame,isPlaying,nextStreams=[]){streams=nextStreams;current=frame;playing=isPlaying;if(playing)demo=false;render();},
    stop(){void hardware.stop();demo=false;streams=[];current=null;playing=false;render();},
    destroy(){hardware.destroy();stage3d.destroy();movingHeads.destroy();layout.destroy();layoutButton.remove();clearInterval(timer);panel.remove();inline?.remove();settingsButton.remove();if(colorPreview)colorPreview.hidden=false;},
  };
}
