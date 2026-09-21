import {createDmxConnection} from './dmx-connection.js';
import {automaticStage} from './dmx-auto.js';
import {createStageEditor} from './dmx-editor.js';
import {mixFixtureFrames} from './dmx-show.js';
import {stagePatch,encodeStage,decodeStage} from './dmx-model.js';

export function createDmxStage(button) {
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
  let active=false;
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
  const demoButton=panel.querySelector('[data-demo]'),blackoutButton=panel.querySelector('[data-blackout]');
  function render(){
    if(!panel.open&&!active&&!hardware.enabled)return;
    panel.dataset.design=String(editor.enabled);panel.dataset.stageMode=editor.mode;
    const equipment=editor.equipment,patch=stagePatch(equipment);
    const equipmentTitle='Ausstattung · '+patch.length+' Geräte';
    if(equipmentSection.querySelector('summary').textContent!==equipmentTitle)equipmentSection.querySelector('summary').textContent=equipmentTitle;
    const signature=JSON.stringify(equipment);
    if(scene.dataset.equipment!==signature){
      if(scene.dataset.equipment&&hardware.enabled)void hardware.stop('Ausstattung geändert · DMX-Ausgabe bitte erneut einschalten.');
      scene.dataset.equipment=signature;scene.dataset.type='mixed';spots.replaceChildren();bars.replaceChildren();nodes.length=0;fixtureNodes.length=0;
      patch.forEach((f,i)=>{
        const select=()=>{openSettings();editor.select(i);};
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
      scene.setAttribute('aria-label',`Virtuelle Bühne mit ${patch.length} Geräten`);
      panel.querySelector('tbody').innerHTML=patch.map(f=>`<tr><td>${f.name}</td><td>${f.address}–${f.address+f.channels-1}</td><td>${f.type==='bar'?`${f.cells} × Rot, Grün, Blau`:'Helligkeit, Rot, Grün, Blau'}</td></tr>`).join('');
    }
    const t=performance.now()/1000;
    const sample=demo?{state:true,r:Math.round(128+127*Math.sin(t*.6)),g:Math.round(128+127*Math.sin(t*.6+2)),b:Math.round(128+127*Math.sin(t*.6+4)),dimming:45+25*Math.sin(t*2)}:current;
    const inputs=demo?[{frame:sample,weight:1,beat:t*2,look:'peak'}]:streams.length?streams:[{frame:sample,weight:1}];
    const main=inputs.filter(s=>s.frame&&s.weight>0).sort((a,b)=>b.weight-a.weight)[0];
    editor.context(main?.sectionKey,main?.sectionName);
    fixtureNodes.forEach((node,i)=>node.setAttribute('aria-pressed',String(editor.mode==='design'&&editor.selected===`f${i}`)));
    const automatic=editor.mode==='auto'?automaticStage(inputs,editor.count,equipment):null;
    if(automatic)editor.preview(automatic.palette,automatic.description);
    const output=automatic?automatic.frames:editor.mode==='design'?mixFixtureFrames(inputs,editor.config,equipment):sample;
    hardware.setDemo(demo);
    hardware.push(encodeStage(demo?null:output,equipment));
    const universe=encodeStage(blackout?null:output,equipment),fixtures=decodeStage(universe,equipment);
    fixtures.forEach((f,i)=>f.cells.forEach((rgb,j)=>{
      const target=nodes[i][j];
      target.style.setProperty('--stage-color',`rgb(${rgb.join(',')})`);
      target.style.setProperty('--stage-power',String(Math.max(...rgb)/255));
      if(f.type==='bar')target.setAttribute('role','img');target.setAttribute('aria-label',`${f.name}${f.type==='bar'?` Segment ${j+1}`:' gestalten'}: RGB ${rgb.join(', ')}`);
    }));
    const status=blackout?'Vorschau abgedunkelt · Musik und echte Lampen bleiben unverändert.':demo?'Demo läuft · Beispiellicht ohne Musik.':current?'Live-Vorschau · folgt deinem DJ-Lichtmix.':playing?'Kein hörbares Deck im Lichtmix · Crossfader und Lautstärke prüfen.':'Bereit · Starte die Demo oder spiele einen Track im DJ-Pult ab.';
    const statusNode=inline?.querySelector('.stage-status')||panel.querySelector('.stage-status');
    const displayStatus=inline?(blackout?'Vorschau abgedunkelt':demo?'Demo läuft · ohne Musik':current?'Live · folgt der Musik':playing?'Kein Deck im Lichtmix':'Bereit · Track oder Demo starten'):status;
    statusNode.title=status;if(statusNode.textContent!==displayStatus)statusNode.textContent=displayStatus;
    demoButton.disabled=playing;demoButton.textContent=demo?'Demo beenden':'Demo ohne Musik starten';demoButton.setAttribute('aria-pressed',String(demo));
    blackoutButton.textContent=blackout?'Vorschau wieder einschalten':'Vorschau abdunkeln';blackoutButton.setAttribute('aria-pressed',String(blackout));
    if(panel.querySelector('.stage-technical').open){const f=patch[0];panel.querySelector('.stage-values').textContent=f?`${f.name} · erste Kanäle: ${Array.from(universe.slice(f.address-1,f.address-1+Math.min(4,f.channels))).join(' / ')}`:'Keine Geräte konfiguriert.';}

  }
  function startTimer(){if(!timer)timer=setInterval(render,50);}
  function close(){panel.close();if(!active&&!hardware.enabled){demo=false;blackout=false;clearInterval(timer);timer=null;}button.setAttribute('aria-expanded',String(active));settingsButton.setAttribute('aria-expanded','false');}
  function openSettings(){if(!panel.open)panel.show();settingsButton.setAttribute('aria-expanded','true');if(!inline)button.setAttribute('aria-expanded','true');render();startTimer();}
  function activate(value){
    active=value;button.closest('.dj-mixer').classList.toggle('has-inline-stage',active);inline.hidden=!active;colorPreview.hidden=active;settingsButton.hidden=!active;
    button.textContent=active?'Bühne deaktivieren':'Lichtbühne aktivieren';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-expanded',String(active));
    if(active){render();startTimer();}else {void hardware.stop();close();}
    try{localStorage.setItem('anydj-stage-visible',String(active));}catch{}
  }
  button.addEventListener('click',()=>{if(inline){activate(!active);return;}if(panel.open)close();else openSettings();});
  settingsButton.onclick=openSettings;
  panel.querySelector('[data-close]').onclick=()=>{close();(active?settingsButton:button).focus();};
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();(active?settingsButton:button).focus();}});
  demoButton.onclick=()=>{demo=!demo;blackout=false;render();};
  blackoutButton.onclick=()=>{blackout=!blackout;render();};
  if(inline){try{if(localStorage.getItem('anydj-stage-visible')==='true')activate(true);}catch{}}
  return {
    update(frame,isPlaying,nextStreams=[]){streams=nextStreams;current=frame;playing=isPlaying;if(playing)demo=false;render();},
    stop(){void hardware.stop();demo=false;streams=[];current=null;playing=false;render();},
    destroy(){hardware.destroy();clearInterval(timer);panel.remove();inline?.remove();settingsButton.remove();if(colorPreview)colorPreview.hidden=false;},
  };
}
