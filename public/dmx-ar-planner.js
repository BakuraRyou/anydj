import {compactDeviceManager} from './dmx-device-manager.js';
import {importRoomModel,modelFileLimit} from './dmx-room-mesh.js';
import {createZonePlan} from './dmx-zone-plan.js';
import {roomStyleOptions} from './dmx-room-style.js';
import {roomId,roomFixtureRotation,roomFixtureTarget,newRoomPlan,createRoomPreview,validateRoomPlan,roomPlanLayout,applyRoomPlan,insideRoom,triangulateFloor,deviceName,deviceTypes,planningDevice} from './dmx-ar-model.js';

const storageKey='anydj-ar-rooms-v1';
export function createARPlanner(host,{getScene=()=>null,onChange=()=>{},sendPlan=null,onStartAR=()=>{},onManageShow=null}={}) {
  let plans=[],selected='',enabled=false,disposed=false,step=1,fixture='',mode='select',draft=[],pointer=null,drag=null,preview=null,arReady=false;
  const renderRoom=createRoomPreview();let roomZones=null,zoneDrag=null,compact=null;
  let mapView={key:'',zoom:1,x:0,y:0},pan=null;
  let undo=null,storageError='',lastMessage='';
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved){plans=(saved.plans||[]).slice(0,20).flatMap(p=>{try{return [validateRoomPlan(p)];}catch{return [];}});selected=saved.selected;enabled=saved.enabled===true;}}catch{storageError='Deine Räume konnten nicht geladen werden. Du kannst eine Sicherung importieren.';}
  if(!plans.some(p=>p.id===selected)){selected=plans[0]?.id||'';enabled=false;}
  const current=()=>plans.find(p=>p.id===selected)||null;
  const root=document.createElement('details');root.className='stage-ar-planner';root.open=true;
  root.innerHTML=`<summary>Deinen Raum planen</summary>
    <div class="ar-room-switcher"><label>Aktiver Raum<select data-ar-room aria-label="Aktiver Raum"></select></label><div class="ar-actions"><button type="button" data-ar-new-room>+ Neuer Raum</button><button type="button" data-ar-copy>Duplizieren</button></div><p>Änderungen werden je Raum automatisch gespeichert. Duplizieren übernimmt Geräte, Lichtziele und Ruhezonen.</p></div>
    <nav class="ar-steps" aria-label="Schritte zur Aufstellung"><button type="button" data-ar-step="1"><b>1</b> Raum</button><button type="button" data-ar-step="2"><b>2</b> Geräte</button><button type="button" data-ar-step="3"><b>3</b> Fertig</button></nav>
    <div class="ar-guidance"><strong data-ar-title></strong><p data-ar-help></p></div>
    <p data-ar-status role="status" aria-live="polite"></p>
    <div data-ar-page="1">
      <div class="ar-start" data-ar-start><button class="ar-choice" type="button" data-ar-new><strong>Maße eingeben</strong><span>Breite und Tiefe reichen für den Anfang.</span></button><button class="ar-choice" type="button" data-ar-start-draw><strong>Grundriss zeichnen</strong><span>Maße wählen, dann Ecken im Plan anklicken.</span></button><button class="ar-choice" type="button" data-ar-scan><strong>Mit der Brille erfassen</strong><span>Den echten Raum erkennen oder Ecken am Boden markieren.</span></button></div>
      <details data-ar-model-import><summary>Eigenes 3D-Modell importieren</summary><p>GLB (empfohlen), eingebettetes glTF oder OBJ · maximal 10 MB und 5.000 Dreiecke. Geometrie und Grundfarben werden übernommen, Bildtexturen und Animationen nicht.</p><div class="ar-fields"><label>Einheit<select data-ar-model-scale><option value="1">Meter</option><option value="0.01">Zentimeter</option><option value="0.001">Millimeter</option></select></label><label>Hochachse<select data-ar-model-up><option value="y">Y (GLB / glTF)</option><option value="z">Z</option></select></label><label>Drehung<select data-ar-model-rotation><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div><label class="ar-import">Modelldatei wählen<input data-ar-model-file type="file" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json"></label><p>Der Import legt einen neuen Raum an. Das Modell wird zentriert und auf den Boden gesetzt. Der rechteckige Grundriss lässt sich danach anpassen. Für andere Maße oder Ausrichtung die Datei erneut importieren.</p></details>
      <div data-ar-room-fields hidden><label>Wie heißt dein Raum?<input data-ar-name maxlength="80" placeholder="Zum Beispiel: Wohnzimmer"></label>
      <div class="ar-fields"><label>Breite (m)<input data-ar-width type="number" min="0.5" max="60" step="0.1" required></label><label>Tiefe (m)<input data-ar-depth type="number" min="0.5" max="60" step="0.1" required></label><label>Raumhöhe (m)<input data-ar-height type="number" min="0.5" max="15" step="0.1" required></label></div>
      <label>Raumdarstellung<select data-ar-representation><option value="style">Raumstil</option><option value="scan">AR-Raumscan</option><option value="model">Eigenes 3D-Modell</option></select></label><p data-ar-geometry-info></p><label>Umgebungshelligkeit <output data-ar-brightness-value></output><input data-ar-brightness type="range" min="0" max="100" step="1"></label><p>0 %: Raum dunkel · 100 %: volle Raumhelligkeit. Die Scheinwerfer leuchten unabhängig davon.</p><label>Raumstil<select data-ar-style>${roomStyleOptions()}</select></label><div class="ar-actions"><button type="button" data-ar-draw>Raumecken im Plan setzen</button><button type="button" data-ar-scan-again>In der Brille erfassen</button></div></div>
      <div class="ar-callout" data-ar-scan-help hidden><strong>So geht es in der Brille</strong><p>Öffne die Vorschau im Browser deiner Brille über HTTPS. Wähle „AR starten“. Dort führt dich eine Anleitung durch den Raumscan oder das Markieren der Ecken.</p><p>Am Rechner findest du Adresse und Kopplungscode unter „VR-Vorschau verbinden“.</p><button type="button" data-ar-scan-start>AR starten</button></div>
    </div>
    <div data-ar-map-section hidden><div class="ar-map-heading"><strong data-ar-map-title>Dein Raum von oben</strong><span data-ar-map-size></span></div>
      <p class="ar-map-hint" data-ar-map-hint></p>
      <p class="ar-map-legend">MH = Moving Head · S = Scheinwerfer · LED = LED-Bar · gelber Kreis = Lichtziel</p>
      <div class="ar-map-tools" role="group" aria-label="Raumansicht"><button type="button" data-ar-zoom-out aria-label="Raumansicht verkleinern">−</button><output data-ar-zoom-level aria-label="Zoom">100 %</output><button type="button" data-ar-zoom-in aria-label="Raumansicht vergrößern">+</button><button type="button" data-ar-zoom-fit>Raum einpassen</button></div>
      <p class="ar-map-controls">Mausrad: zoomen · Freie Fläche ziehen: Ansicht verschieben · Tastatur: + / − / 0</p>
      <svg data-ar-map tabindex="0" role="group" aria-label="Interaktiver Raumplan. Mausrad zum Zoomen, freie Fläche zum Verschieben. Geräte anklicken oder ziehen; Escape bricht die Platzierung ab."></svg>
      <div class="ar-actions" data-ar-draw-actions hidden><button type="button" data-ar-point-undo>Letzten Punkt entfernen</button><button class="ar-primary" type="button" data-ar-draw-finish>Raumform übernehmen</button><button type="button" data-ar-cancel>Abbrechen</button></div>
      <div class="ar-actions" data-ar-place-actions hidden><button type="button" data-ar-place-cancel>Platzierung abbrechen</button></div>
      <div data-ar-room-zones></div>
    </div>
    <div data-ar-page="2" hidden>
      <div class="ar-empty" data-ar-empty><strong>Dein Raum ist bereit. Jetzt kommt das erste Gerät.</strong><p>Wähle einen Gerätetyp und tippe anschließend im Plan auf seinen Standort.</p></div>
      <div class="ar-add-types" aria-label="Gerät hinzufügen">${Object.entries(deviceTypes).map(([type,label])=>`<button type="button" data-ar-template="${type}">+ ${label}</button>`).join('')}</div>
      <div class="ar-actions"><button type="button" data-ar-manage-show>Showgeräte, Gruppen & Lichtsteuerung</button></div><p data-ar-show-functions>Mehrfachauswahl, feste Gruppen, Gruppendrehung, symmetrische Aufstellung, Lichtgruppe, Lichtstärke und Bewegungsbereich.</p><details data-ar-show-devices><summary>Geräte aus meiner Lichtshow</summary><p>Bereits in der Show konfigurierte Geräte in diesen Raum übernehmen.</p><div data-ar-available></div><button type="button" data-ar-add>Alle Showgeräte übernehmen</button></details>
      <div class="ar-device-list" data-ar-devices aria-label="Geräte im Raum"></div>
      <select data-ar-fixture aria-label="Ausgewähltes Gerät" hidden></select>
      <section class="ar-device-editor" data-ar-device-editor hidden><label>Gerätename<input data-ar-device-name maxlength="60"></label>
        <div class="ar-actions"><button type="button" class="ar-primary" data-ar-place>Im Plan platzieren</button><button type="button" data-ar-duplicate>Duplizieren</button><button type="button" data-ar-remove>Entfernen</button></div>
        <div class="ar-fields"><label>Höhe über dem Boden (m)<input data-ar-z type="number" min="0" max="15" step="0.1" required></label><label><span data-ar-rotation-label>Drehung (°)</span><input data-ar-rotation type="number" min="-360" max="360" step="15" required></label></div>
        <p data-ar-rotation-help hidden>Die Montageausrichtung dreht den Sockel und das Symbol im Plan. Der bewegliche Kopf folgt weiterhin der musikalischen Choreografie.</p>
        <fieldset data-ar-motion-area hidden><legend>Erlaubter Bewegungsbereich</legend><p>Moving Heads bewegen sich frei in dieser Bodenfläche. Ruhezonen gelten weiterhin.</p><div class="ar-fields"><label>Links (m)<input data-ar-area-left type="number" step="0.1"></label><label>Rechts (m)<input data-ar-area-right type="number" step="0.1"></label><label>Vorne (m)<input data-ar-area-front type="number" step="0.1"></label><label>Hinten (m)<input data-ar-area-back type="number" step="0.1"></label></div><button type="button" data-ar-area-reset>Gesamter Raum</button><details><summary>Wand in die Choreografie einbeziehen</summary><label>Zusätzliche Zielfläche<select data-ar-wall><option value="">Nur Boden</option></select></label><div class="ar-fields" data-ar-wall-fields hidden><label>Bereich ab (%)<input data-ar-wall-start type="number" min="0" max="98" step="1"></label><label>Bereich bis (%)<input data-ar-wall-end type="number" min="2" max="100" step="1"></label><label>Ab Höhe (m)<input data-ar-wall-min type="number" min="0" step="0.1"></label><label>Bis Höhe (m)<input data-ar-wall-max type="number" min="0.1" step="0.1"></label></div><p>Die Automatik wechselt musikalisch zwischen Boden und Wand. Außerhalb des Wandbereichs wird der Strahl ausgeblendet. Wandnummern stehen im Plan.</p></details></fieldset>
        <details><summary>Genau positionieren & Gerätemaße</summary><div class="ar-fields"><label>Seitlich zur Raummitte (m)<input data-ar-x type="number" step="0.01" required></label><label>Abstand von vorne (m)<input data-ar-y type="number" step="0.01" required></label></div>
        <p>Trage hier die Außenmaße deines Geräts ein. Die Vorschau beginnt mit Beispielmaßen.</p><div class="ar-fields"><label>Gerätebreite (m)<input data-ar-size-width type="number" min="0.01" max="12" step="0.01" required></label><label>Gerätetiefe (m)<input data-ar-size-depth type="number" min="0.01" max="12" step="0.01" required></label><label>Gerätehöhe (m)<input data-ar-size-height type="number" min="0.01" max="12" step="0.01" required></label></div></details>
      </section>
    </div>
    <div data-ar-page="3" hidden><div class="ar-complete"><strong>Deine Aufstellung ist gespeichert.</strong><p data-ar-summary></p></div><label class="ar-check"><input type="checkbox" data-ar-enabled> Diesen Raum in der Lichtshow verwenden</label>
      <button type="button" class="ar-primary" data-ar-view>Aufstellung in AR ansehen</button><p data-ar-view-help></p><button type="button" class="ar-primary" data-ar-send ${sendPlan?'':'hidden'}>Aufstellung an den Rechner senden</button>
      <details><summary>Wie finde ich die Positionen im echten Raum wieder?</summary><p>Beim AR-Einstieg wirst du durch die Ausrichtung geführt. Hat die Brille deinen Raum wiedererkannt, kannst du direkt beginnen. Sonst markierst du zwei Bezugspunkte am Boden. Prüfe die Ausrichtung, bevor du echte Geräte aufstellst.</p></details>
    </div>
    <div class="ar-navigation"><button type="button" data-ar-back>Zurück</button><button type="button" class="ar-primary" data-ar-next>Weiter zu den Geräten →</button></div>
    <button type="button" data-ar-undo hidden>Letzte Änderung rückgängig</button>
    <details class="ar-library"><summary>Raumdateien & Verwaltung</summary><div class="ar-actions"><button type="button" data-ar-delete>Raum löschen</button><button type="button" data-ar-export>Exportieren</button><label class="ar-import">Importieren<input data-ar-import type="file" accept="application/json,.json"></label></div></details>`;
  host.prepend(root);
  const q=name=>root.querySelector(`[data-ar-${name}]`);
  function notify(text,error=false){lastMessage=text;q('status').textContent=text;q('status').dataset.error=String(error);}
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify({plans,selected,enabled}));storageError='';}catch{storageError='Speichern auf diesem Gerät fehlgeschlagen. Bitte exportiere deinen Raum.';notify(storageError,true);}onChange();}
  function commit(value,{message='Änderung gespeichert.',history=true}={}){
    const plan=validateRoomPlan(value),i=plans.findIndex(p=>p.id===plan.id);
    if(i<0&&plans.length>=20)throw Error('Du hast bereits 20 Räume. Exportiere und entferne zuerst einen alten Raum.');
    if(history)undo={plans:structuredClone(plans),selected,enabled};
    if(i<0)plans.push(plan);else plans[i]=plan;
    selected=plan.id;sync();persist();if(!storageError)notify(message);return plan;
  }
  function attempt(fn){try{fn();}catch(e){notify(e.message,true);}}
  function go(value){if(value>1&&!current())return;step=value;mode='select';draft=[];preview=null;sync();q('title').focus?.();}
  function mutateFixture(changes,message='Gerät gespeichert.'){
    const plan=structuredClone(current());if(!plan?.positions[fixture])throw Error('Wähle zuerst ein Gerät aus der Liste oder im Plan.');
    const before=plan.positions[fixture],p={...before,...changes};
    if(!['stand','truss','moving'].includes(p.type)){
      p.target=changes.target||roomFixtureTarget(plan,fixture,getScene()?.lights);
      if(changes.rotation!==undefined){const angle=changes.rotation*Math.PI/180,distance=Math.max(.1,Math.hypot(p.target.x-p.x,p.target.y-p.y));p.target={x:p.x+Math.sin(angle)*distance,y:p.y-Math.cos(angle)*distance};}
      p.rotation=roomFixtureRotation(p);
    }
    if(!insideRoom([p.x,p.y],plan.boundary))throw Error('Der Standort liegt außerhalb deines Raumes. Wähle einen Punkt innerhalb der Raumfläche.');
    if(!Number.isFinite(p.height)||p.height<0||p.height>plan.height)throw Error(`Die Montagehöhe muss zwischen 0 und ${plan.height} m liegen.`);
    plan.positions[fixture]=p;commit(plan,{message});
  }
  function selectFixture(id){fixture=id;mode='select';preview=null;sync();}
  function available(){const unique=new Map();for(const l of getScene()?.lights||[])if(!unique.has(l.id))unique.set(l.id,l);return [...unique.values()];}
  function seed(scene=getScene(),onlyId=null){
    if(!current())throw Error('Lege zuerst deinen Raum an.');
    const lights=scene?.lights||[];if(!lights.length)throw Error('In deiner Show sind noch keine Geräte. Füge oben einen Gerätetyp für deine Planung hinzu.');
    const plan=structuredClone(current());let first=null;
    for(const l of lights){if(plan.positions[l.id]||(onlyId&&l.id!==onlyId))continue;const created=planningDevice(plan,l.type in deviceTypes?l.type:'spot');created.position.name=l.name||created.position.name;const p=l.position;if(insideRoom([p.x,p.y],plan.boundary)){created.position.x=p.x;created.position.y=p.y;}created.position.height=Math.min(plan.height,Math.max(0,p.height));plan.positions[l.id]=created.position;first??=l.id;}
    if(!first){notify('Diese Showgeräte sind bereits in deinem Raum.');return plan;}
    fixture=first;commit(plan,{message:'Showgeräte hinzugefügt. Wähle ein Gerät und seinen Standort.'});return plan;
  }
  function addDevice(type){const plan=structuredClone(current());if(!plan)throw Error('Lege zuerst deinen Raum an.');const added=planningDevice(plan,type);plan.positions[added.id]=added.position;if(['moving','spot','bar'].includes(type))added.position.target=roomFixtureTarget(plan,added.id);fixture=added.id;commit(plan);selectFixture(fixture);}
  function beginPlacement(){if(!current()?.positions[fixture])return;mode='place';preview=null;sync();notify('Tippe im Plan auf den gewünschten Standort. Escape oder „Abbrechen“ beendet die Platzierung.');q('map').focus({preventScroll:true});q('map-section').scrollIntoView({block:'nearest',behavior:'smooth'});}
  function beginDraw(){mode='draw';step=1;draft=[];preview=null;sync();notify('Tippe nacheinander auf die Ecken deines Raumes. Beginne vorne links und gehe entlang der Wände.');q('map').focus({preventScroll:true});q('map-section').scrollIntoView({block:'nearest',behavior:'smooth'});}
  function finishDraw(){
    if(draft.length<3)throw Error('Setze mindestens drei Ecken, bevor du die Raumform übernimmst.');
    const plan=structuredClone(current());plan.boundary=draft.map(p=>[...p]);plan.surfaces=[];
    const hadWalls=Object.values(plan.positions).some(p=>p.wallTarget);for(const p of Object.values(plan.positions))delete p.wallTarget;
    if(Object.values(plan.positions).some(p=>!insideRoom([p.x,p.y],plan.boundary)))throw Error('Ein Gerät würde außerhalb der neuen Raumform stehen. Versetze es zuerst oder passe die Ecken an.');
    try{validateRoomPlan(plan);}catch{throw Error('Die Raumform überschneidet sich. Entferne den letzten Punkt und folge den Wänden der Reihe nach.');}
    mode='select';draft=[];preview=null;commit(plan,{message:hadWalls?'Raumform übernommen. Bitte ordne die Wandziele den neuen Wänden zu.':'Raumform übernommen. Weiter geht es mit deinen Geräten.'});
  }
  function element(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;return node;}
  function drawMap(){
    const plan=current(),svg=q('map');svg.replaceChildren();if(!plan)return;
    const key=`${plan.id}:${plan.width}:${plan.depth}`;
    if(mapView.key!==key)mapView={key,zoom:1,x:0,y:plan.depth/2};
    const pad=Math.max(plan.width,plan.depth)*.12,scale=Math.max(plan.width,plan.depth)/18/mapView.zoom;
    const viewWidth=(plan.width+pad*2)/mapView.zoom,viewHeight=(plan.depth+pad*2)/mapView.zoom;
    mapView.x=Math.max(-plan.width/2-pad+viewWidth/2,Math.min(plan.width/2+pad-viewWidth/2,mapView.x));
    mapView.y=Math.max(-pad+viewHeight/2,Math.min(plan.depth+pad-viewHeight/2,mapView.y));
    const bounds=svg.getBoundingClientRect(),pixelsPerMeter=Math.max(1,Math.min((bounds.width||400)/viewWidth,(bounds.height||260)/viewHeight)),labelSize=13/pixelsPerMeter,hitRadius=16/pixelsPerMeter;
    svg.setAttribute('viewBox',`${mapView.x-viewWidth/2} ${mapView.y-viewHeight/2} ${viewWidth} ${viewHeight}`);svg.dataset.mode=mode;svg.dataset.panning=String(!!pan);
    q('zoom-level').value=`${Math.round(mapView.zoom*100)} %`;q('zoom-out').disabled=mapView.zoom<=1;q('zoom-in').disabled=mapView.zoom>=8;
    const xy=p=>[p[0],plan.depth-p[1]],put=(tag,attrs,text)=>{const n=element(tag,attrs,text);svg.append(n);return n;};
    put('rect',{x:-plan.width/2,y:0,width:plan.width,height:plan.depth,fill:'#102633',rx:.04});
    for(let x=Math.ceil(-plan.width/2);x<=plan.width/2;x++)put('line',{x1:x,x2:x,y1:0,y2:plan.depth,stroke:'#25434e','stroke-width':scale*.025});
    for(let y=0;y<=plan.depth;y++)put('line',{x1:-plan.width/2,x2:plan.width/2,y1:y,y2:y,stroke:'#25434e','stroke-width':scale*.025});
    put('polygon',{points:plan.boundary.map(p=>xy(p).join(',')).join(' '),fill:mode==='draw'?'none':'#24605b',opacity:mode==='draw'?.3:.55,stroke:'#8be0c9','stroke-width':scale*.07});
    put('text',{x:0,y:-pad*.4,fill:'#bed0d8','text-anchor':'middle','font-size':scale*.7},'HINTEN');put('text',{x:0,y:plan.depth+pad*.75,fill:'#bed0d8','text-anchor':'middle','font-size':scale*.7},'VORNE');
    for(const z of plan.zones||[]){
      const value=zoneDrag?.id===z.id&&zoneDrag.preview?zoneDrag.preview:z,x=(value.x-.5)*plan.width,y=(1-value.y-value.depth)*plan.depth,w=value.width*plan.width,h=value.depth*plan.depth;
      const g=put('g',{'data-ar-zone':z.id,role:'button',tabindex:0,'aria-label':z.name+' verschieben'});
      g.append(element('rect',{x,y,width:w,height:h,fill:'#b66b4c','fill-opacity':.35,stroke:roomZones?.selected===z.id?'#ffe29b':'#c99375','stroke-width':2/pixelsPerMeter}));
      g.append(element('text',{x:x+5/pixelsPerMeter,y:y+15/pixelsPerMeter,fill:'#ffe6c5','font-size':labelSize,'pointer-events':'none'},z.name));
      if(roomZones?.selected===z.id)g.append(element('rect',{'data-ar-zone-resize':'',x:x+w-6/pixelsPerMeter,y:y-6/pixelsPerMeter,width:12/pixelsPerMeter,height:12/pixelsPerMeter,fill:'#ffe29b'}));
    }
    if(mode==='draw'){
      const path=[...draft];if(preview)path.push(preview);
      if(path.length>1)put('polyline',{points:path.map(p=>xy(p).join(',')).join(' '),fill:'none',stroke:'#ffcf7a','stroke-width':scale*.1,'stroke-dasharray':preview?`${scale*.3} ${scale*.15}`:'none'});
      draft.forEach((p,i)=>{const [x,y]=xy(p);put('circle',{cx:x,cy:y,r:10/pixelsPerMeter,fill:'#ffcf7a'});put('text',{x,y:y+4/pixelsPerMeter,fill:'#14232a','font-size':labelSize,'text-anchor':'middle'},String(i+1));});
    }else{
      Object.entries(plan.positions).forEach(([id,p],i)=>{
        if(mode==='place'&&preview&&id===fixture)return;
        const pos=drag?.id===id&&!drag.aim&&preview?{...p,x:preview[0],y:preview[1]}:p,x=pos.x,y=plan.depth-pos.y;
        const type=p.type||(/moving/.test(id)?'moving':'spot'),code={moving:'MH',spot:'S',bar:'LED',stand:'ST',truss:'TR'}[type]||'G',color={moving:'#b9adff',spot:'#ffc38a',bar:'#8ce1de'}[type]||'#bdd9e6',icon=12/pixelsPerMeter;
        const g=put('g',{'data-device-id':id,'data-device-type':type,role:'button',tabindex:0,'aria-label':`${deviceName(id,p,i)} · ${deviceTypes[type]||'Gerät'} auswählen`,'aria-pressed':String(id===fixture)});
        const mark=(tag,attrs,text)=>g.append(element(tag,attrs,text)),orientation=type==='moving'?(pos.rotation||0):roomFixtureRotation(pos,drag?.id===id&&drag.aim&&preview?{x:preview[0],y:preview[1]}:roomFixtureTarget(plan,id,getScene()?.lights));
        mark('rect',{x:x-p.size.width/2,y:y-p.size.depth/2,width:p.size.width,height:p.size.depth,transform:`rotate(${-orientation} ${x} ${y})`,fill:'#142b35',stroke:color,'stroke-width':scale*.06});
        if(type==='moving'){
          mark('path',{d:`M ${x-icon} ${y-icon*.7} V ${y+icon*.7} H ${x+icon} V ${y-icon*.7}`,fill:'none',stroke:color,'stroke-width':3/pixelsPerMeter});
          mark('circle',{cx:x,cy:y-icon*.15,r:icon*.62,fill:color,stroke:'#162a35','stroke-width':1/pixelsPerMeter});
        }else if(type==='spot'){
          mark('path',{d:`M ${x-icon*.65} ${y+icon} L ${x-icon} ${y-icon*.7} L ${x+icon} ${y-icon*.7} L ${x+icon*.65} ${y+icon} Z`,fill:color,stroke:'#162a35','stroke-width':1/pixelsPerMeter});
          mark('line',{x1:x-icon,y1:y-icon*.7,x2:x+icon,y2:y-icon*.7,stroke:'#fff','stroke-width':2/pixelsPerMeter});
        }else if(type==='bar'){
          mark('rect',{x:x-icon*1.2,y:y-icon*.35,width:icon*2.4,height:icon*.7,rx:2/pixelsPerMeter,fill:color});
          for(const offset of [-.8,0,.8])mark('circle',{cx:x+offset*icon,cy:y,r:2/pixelsPerMeter,fill:'#102633'});
        }
        for(const node of [...g.children].slice(1))node.setAttribute('transform',`rotate(${-orientation} ${x} ${y}) translate(0 ${2*y}) scale(1 -1)`);
        mark('circle',{cx:x,cy:y,r:hitRadius,fill:'transparent',stroke:id===fixture?'#fff':'none','stroke-width':scale*.06});
        mark('rect',{x:x-24/pixelsPerMeter,y:y-hitRadius-18/pixelsPerMeter,width:48/pixelsPerMeter,height:19/pixelsPerMeter,rx:4/pixelsPerMeter,fill:color});
        mark('text',{x,y:y-hitRadius-4/pixelsPerMeter,fill:'#102633','font-size':labelSize,'text-anchor':'middle'},`${code} ${i+1}`);
      });
      for(const [id,p] of Object.entries(plan.positions)){
        if(p.type==='moving'){if(id===fixture){if(p.wallTarget){const c=p.wallTarget,v=plan.boundary[c.wall],w=plan.boundary[(c.wall+1)%plan.boundary.length],at=t=>[v[0]+(w[0]-v[0])*t,plan.depth-v[1]-(w[1]-v[1])*t],a=at(c.start),b=at(c.end);put('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#ffd384','stroke-width':scale*.12,'pointer-events':'none'});for(const [point,label] of [[a,'Ab'],[b,'Bis']])put('text',{x:point[0],y:point[1]-scale*.15,fill:'#ffd384','font-size':scale*.18,'text-anchor':'middle','pointer-events':'none'},label);}plan.boundary.forEach((v,j)=>{const w=plan.boundary[(j+1)%plan.boundary.length];put('text',{x:(v[0]+w[0])/2,y:plan.depth-(v[1]+w[1])/2,'font-size':scale*.22,fill:p.wallTarget?.wall===j?'#ffd384':'#b8cbd1','text-anchor':'middle','pointer-events':'none'},'W'+(j+1));});const a=p.motionArea||{x:0,y:0,width:1,depth:1};put('rect',{x:(a.x-.5)*plan.width,y:(1-a.y-a.depth)*plan.depth,width:a.width*plan.width,height:a.depth*plan.depth,fill:'#8ecbd5','fill-opacity':.10,stroke:'#8ecbd5','stroke-width':scale*.06,'stroke-dasharray':`${scale*.16} ${scale*.12}`,'pointer-events':'none'});}continue;}
        if(['stand','truss'].includes(p.type))continue;
        const moving=drag?.id===id&&preview,pos=moving&&!drag.aim?{...p,x:preview[0],y:preview[1]}:p;
        const target=moving&&drag.aim?{x:preview[0],y:preview[1]}:roomFixtureTarget(plan,id,getScene()?.lights);
        const color=insideRoom([target.x,target.y],plan.boundary)?(id===fixture?'#ffe29b':'#c4bc99'):'#ff897c';
        put('line',{x1:pos.x,y1:plan.depth-pos.y,x2:target.x,y2:plan.depth-target.y,stroke:color,'stroke-width':scale*.06,'pointer-events':'none'});
        const handle=put('g',{'data-target-id':id,role:'button',tabindex:0,'aria-label':`${deviceName(id,p)} Lichtziel verschieben`,'aria-pressed':String(id===fixture)});
        handle.append(element('circle',{'data-ar-light-target':id,cx:target.x,cy:plan.depth-target.y,r:hitRadius,fill:'transparent',stroke:color,'stroke-width':scale*.08}));
        handle.append(element('circle',{cx:target.x,cy:plan.depth-target.y,r:scale*.09,fill:color,'pointer-events':'none'}));
      }
      if(mode==='place'&&preview){const p=plan.positions[fixture],valid=insideRoom(preview,plan.boundary),[x,y]=xy(preview);put('rect',{x:x-p.size.width/2,y:y-p.size.depth/2,width:p.size.width,height:p.size.depth,fill:valid?'#8ce3c4':'#ff897c',opacity:.6,stroke:'#fff','stroke-width':scale*.06});put('circle',{cx:x,cy:y,r:scale*.4,fill:'none',stroke:valid?'#8ce3c4':'#ff897c','stroke-width':scale*.08});}
    }
  }
  function sync(){
    const plan=current(),ids=Object.keys(plan?.positions||{});if(!plan)step=1;root.querySelector('.ar-navigation').hidden=!plan||['aim','place','draw'].includes(mode);if(!ids.includes(fixture))fixture=ids[0]||'';
    q('start').hidden=!!plan;q('room-fields').hidden=!plan;q('map-section').hidden=!plan||step===3;
    q('room-zones').hidden=mode!=='select';
    root.querySelectorAll('[data-ar-page]').forEach(n=>n.hidden=Number(n.dataset.arPage)!==step);
    root.querySelectorAll('[data-ar-step]').forEach(n=>{n.disabled=Number(n.dataset.arStep)>1&&!plan;n.setAttribute('aria-current',Number(n.dataset.arStep)===step?'step':'false');});
    q('title').textContent=step===1?'1 · Lege deinen Raum an':step===2?'2 · Stelle deine Geräte auf':'3 · Deine Aufstellung ist bereit';
    q('help').textContent=step===1?(plan?'Prüfe die Maße und lege unter dem Raumplan Ruhezonen für Tische und Sitzbereiche an. Die Raumecken kannst du direkt im Plan setzen.':'Wähle einen einfachen Einstieg. Du kannst alles später ändern.'):step===2?'Zwei Punkte pro Leuchte: Gerät und Lichtziel direkt im Plan ziehen.':'Deine Änderungen sind gespeichert. Du kannst den Raum jetzt in der Lichtshow oder in AR verwenden.';
    q('room').replaceChildren(...(plans.length?plans.map(p=>new Option(p.name,p.id)):[new Option('Noch kein Raum','')]));q('room').value=selected;q('room').disabled=!plans.length;q('new-room').disabled=plans.length>=20;
    for(const k of ['name','width','depth','height']){q(k).value=plan?.[k]??'';q(k).disabled=!plan||mode==='draw'||(k!=='name'&&!!plan.mesh);}
    q('enabled').checked=enabled;q('enabled').disabled=!plan;
    q('brightness').value=plan?.environmentBrightness??30;q('brightness-value').textContent=`${plan?.environmentBrightness??30} %`;
    q('style').value=plan?.style||'club';q('style').disabled=plan?.representation==='model';
    q('representation').value=plan?.representation||'style';
    q('representation').querySelector('[value=scan]').disabled=!plan?.surfaces.length;
    q('representation').querySelector('[value=model]').disabled=!plan?.mesh;
    q('geometry-info').textContent=plan?.representation==='model'?`${plan.mesh.name} · ${plan.mesh.triangles.length} Dreiecke · Maße aus dem Modell. Den begehbaren Grundriss kannst du im Plan anpassen.`:plan?.representation==='scan'?`${plan.surfaces.length} erfasste Raumflächen. Die Brille liefert Flächengeometrie, keine Fototexturen.`:'Wände und Boden werden aus deinem Grundriss erzeugt.';
    q('map-size').textContent=plan?`${plan.width.toFixed(1)} × ${plan.depth.toFixed(1)} m`:'';
    q('map-title').textContent=mode==='draw'?`${draft.length} Ecken gesetzt`:'Dein Raum von oben';
    q('map-hint').textContent=mode==='aim'?'Wohin schaut die Leuchte? Klicke auf ihr Lichtziel im Raum.':mode==='draw'?(draft.length<3?'Klicke mindestens drei Ecken entlang deiner Wände an. Jeder Klick setzt einen Punkt.':'Weitere Ecken setzen oder „Raumform übernehmen“ wählen. Ein Klick auf Punkt 1 schließt den Grundriss.'):mode==='place'?`${deviceName(fixture,plan?.positions[fixture],ids.indexOf(fixture))}: Tippe auf den gewünschten Standort. Grün = innerhalb des Raumes.`:step===2?'Gerät = Standort · gelber Kreis = Lichtziel. Beide Punkte lassen sich direkt ziehen.':'Jedes kleine Rasterfeld entspricht einem Meter.';
    q('draw-actions').hidden=mode!=='draw';q('place-actions').hidden=!['place','aim'].includes(mode);q('draw-finish').disabled=draft.length<3;q('point-undo').disabled=!draft.length;
    q('empty').hidden=ids.length>0;q('device-editor').hidden=!fixture;
    q('fixture').replaceChildren(...ids.map((id,i)=>new Option(deviceName(id,plan.positions[id],i),id)));q('fixture').value=fixture;
    q('devices').replaceChildren(...ids.map((id,i)=>{const b=document.createElement('button');b.type='button';b.className='ar-device';b.dataset.selectDevice=id;b.setAttribute('aria-pressed',String(id===fixture));const number=document.createElement('b'),name=document.createElement('span'),small=document.createElement('small');number.textContent=String(i+1);name.textContent=deviceName(id,plan.positions[id],i);small.textContent=`${deviceTypes[plan.positions[id].type]||'Lichtgerät'} · ${plan.positions[id].height.toFixed(2)} m hoch · ${plan.positions[id].type==='moving'?'freier Bewegungsbereich':roomFixtureRotation(plan.positions[id],roomFixtureTarget(plan,id,getScene()?.lights)).toFixed(1)+'°'}`;b.append(number,name,small);b.onclick=()=>selectFixture(id);return b;}));
    const p=plan?.positions[fixture];q('rotation').closest('label').hidden=false;q('rotation-label').textContent=p?.type==='moving'?'Montageausrichtung (°)':'Drehung (°)';q('rotation-help').hidden=p?.type!=='moving';q('motion-area').hidden=p?.type!=='moving';
    if(p?.type==='moving'){const a=p.motionArea||{x:0,y:0,width:1,depth:1};for(const [key,value] of [['left',(a.x-.5)*plan.width],['right',(a.x+a.width-.5)*plan.width],['front',a.y*plan.depth],['back',(a.y+a.depth)*plan.depth]])q('area-'+key).value=Number(value.toFixed(3));}
    q('wall').replaceChildren(new Option('Nur Boden',''),...(plan?.boundary||[]).map((_,i)=>new Option('Wand '+(i+1),String(i))));q('wall').value=p?.wallTarget?String(p.wallTarget.wall):'';q('wall-fields').hidden=!p?.wallTarget;
    if(p?.wallTarget){const w=p.wallTarget;for(const [key,value] of [['start',w.start*100],['end',w.end*100],['min',w.minHeight],['max',w.maxHeight]])q('wall-'+key).value=value;}
    q('device-name').value=p?deviceName(fixture,p,ids.indexOf(fixture)):'';
    for(const [key,field] of [['x','x'],['y','y'],['height','z'],['rotation','rotation']]){q(field).disabled=!p;q(field).value=key==='rotation'&&p?Number((p.type==='moving'?(p.rotation||0):roomFixtureRotation(p,roomFixtureTarget(plan,fixture,getScene()?.lights))).toFixed(1)):p?Number(p[key].toFixed(2)):'';}
    for(const k of ['width','depth','height']){q('size-'+k).disabled=!p;q('size-'+k).value=p?.size[k]??'';}
    q('back').hidden=step===1;q('next').hidden=step===3;q('next').disabled=!plan||mode==='draw'||mode==='place';q('next').textContent=step===1?'Weiter zu den Geräten →':'Aufstellung abschließen →';
    q('summary').textContent=plan?`${plan.name} · ${plan.width.toFixed(1)} × ${plan.depth.toFixed(1)} m · ${ids.length} Geräte`:'';
    q('view').textContent=arReady?'Jetzt in AR ansehen':'So öffnest du die Aufstellung in AR';q('view-help').textContent=arReady?'In der Brille führen wir dich durch die Ausrichtung im echten Raum.':'Öffne die gekoppelte Vorschau im Browser deiner Brille. Dort kannst du AR starten.';q('scan-start').disabled=!arReady;
    q('undo').hidden=!undo;
    for(const k of ['copy','delete','export','send','draw'])q(k).disabled=!plan;
    q('copy').disabled=!plan||plans.length>=20;
    const availableLights=available().filter(l=>!plan?.positions[l.id]);q('available').replaceChildren(...availableLights.map((l,i)=>{const b=document.createElement('button');b.type='button';b.textContent='+ '+deviceName(l.id,{name:l.name,type:l.type},i);b.onclick=()=>attempt(()=>{seed(getScene(),l.id);beginPlacement();});return b;}));q('add').disabled=!availableLights.length;q('show-devices').hidden=!available().length&&!onManageShow;q('manage-show').hidden=!onManageShow;
    q('show-functions').hidden=!onManageShow;roomZones?.reload();compact?.refresh({step,fixture,moving:p?.type==='moving',mode});drawMap();
  }
  function newPlan(draw=false){if(plans.length>=20)throw Error('Du hast bereits 20 Räume.');const plan=newRoomPlan();let number=1;while(plans.some(p=>p.name===plan.name))plan.name=`Mein Raum ${++number}`;fixture='';step=1;mode='select';enabled=true;commit(plan,{message:'Gib deinem Raum einen Namen und prüfe Breite und Tiefe.'});if(draw){q('help').textContent='Wie groß ist dein Raum ungefähr? Passe Breite und Tiefe der Zeichenfläche an. Wähle dann „Raumecken im Plan setzen“.';q('width').focus({preventScroll:true});}else q('name').focus({preventScroll:true});}
  const scanHelp=()=>{if(!arReady){step=1;sync();}q('scan-help').hidden=false;if(arReady)onStartAR();else notify('Öffne die Vorschau im Browser deiner Brille. Die Schritte dafür stehen direkt hier.');};
  q('new').onclick=()=>attempt(()=>newPlan());q('start-draw').onclick=()=>attempt(()=>newPlan(true));q('draw').onclick=beginDraw;
  q('scan').onclick=q('scan-again').onclick=q('view').onclick=scanHelp;q('scan-start').onclick=onStartAR;
  q('new-room').onclick=()=>attempt(()=>newPlan());
  q('copy').onclick=()=>attempt(()=>{if(!current()||plans.length>=20)return;const plan=structuredClone(current()),base=plan.name.slice(0,60);let name=base+' · Kopie',n=2;while(plans.some(p=>p.name===name))name=base+' · Kopie '+n++;enabled=true;mode='select';draft=[];preview=null;fixture='';step=1;commit({...plan,id:roomId(),name},{message:'Raum dupliziert. Änderungen gelten nur für diese Kopie.'});q('name').focus({preventScroll:true});});
  q('delete').onclick=()=>{const plan=current();if(!plan||!confirm(`„${plan.name}“ mit allen Gerätepositionen löschen?`))return;undo={plans:structuredClone(plans),selected,enabled};plans=plans.filter(p=>p.id!==plan.id);selected=plans[0]?.id||'';if(!selected)enabled=false;step=1;mode='select';sync();persist();notify('Raum entfernt. Du kannst die Änderung rückgängig machen.');};
  q('room').onchange=()=>{const id=q('room').value;if(!plans.some(p=>p.id===id))return;selected=id;enabled=true;step=1;mode='select';fixture='';draft=[];preview=null;pointer=null;drag=null;zoneDrag=null;pan=null;sync();persist();if(!storageError)notify('Raum gewechselt. Änderungen werden hier automatisch gespeichert.');};
  q('brightness').oninput=()=>attempt(()=>commit({...current(),environmentBrightness:Number(q('brightness').value)}));
  q('representation').onchange=()=>attempt(()=>commit({...current(),representation:q('representation').value}));
  q('model-file').onchange=async()=>{
    const input=q('model-file'),file=input.files[0];if(!file)return;
    const options={scale:Number(q('model-scale').value),up:q('model-up').value,rotation:Number(q('model-rotation').value)};
    input.disabled=true;notify('Modell wird eingelesen …');
    try{
      if(file.size>modelFileLimit)throw Error('Die Modelldatei ist zu groß (maximal 10 MB).');
      const bytes=await file.arrayBuffer();if(disposed)return;
      const imported=importRoomModel(bytes,file.name,options),plan=validateRoomPlan({...newRoomPlan(imported.width,imported.depth,imported.height),name:file.name.replace(/\.[^.]+$/,'').slice(0,80),mesh:imported.mesh,representation:'model'});
      step=1;mode='select';fixture='';commit(plan,{message:'Modell importiert. Prüfe den Grundriss und stelle deine Geräte auf.'+(imported.warnings.length?' '+imported.warnings.join(' '):'')});enabled=true;sync();persist();
    }catch(error){notify(error.message,true);}finally{input.value='';input.disabled=false;}
  };
  q('style').onchange=()=>attempt(()=>commit({...current(),style:q('style').value}));
  q('name').onchange=()=>attempt(()=>commit({...current(),name:q('name').value}));
  for(const k of ['width','depth','height'])q(k).onchange=()=>attempt(()=>{if(!q(k).checkValidity())throw Error('Bitte gib ein gültiges Maß in Metern ein.');const plan=structuredClone(current()),value=q(k).valueAsNumber;if(plan.mesh)throw Error('Für andere Modellmaße bitte die Datei mit passender Einheit erneut importieren.');
    if(k!=='height'&&(plan.surfaces.length||plan.boundary.length!==4||plan.boundary.some(([x,y])=>Math.abs(x)!==plan.width/2||(y!==0&&y!==plan.depth)))&&!confirm('Durch das Ändern der Außenmaße wird der Grundriss rechteckig. Möchtest du das?')){sync();return;}
    plan[k]=value;if(k!=='height'){plan.boundary=[[-plan.width/2,0],[plan.width/2,0],[plan.width/2,plan.depth],[-plan.width/2,plan.depth]];plan.surfaces=[];}
    if(Object.values(plan.positions).some(p=>!insideRoom([p.x,p.y],plan.boundary)||p.height>plan.height))throw Error('Ein Gerät passt nicht in die neuen Maße. Versetze es zuerst oder wähle größere Raummaße.');commit(plan);
  });
  root.querySelectorAll('[data-ar-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.arStep)));
  q('back').onclick=()=>go(step-1);q('next').onclick=()=>go(step+1);
  q('enabled').onchange=()=>{enabled=q('enabled').checked;persist();notify(enabled?'Der Raum wird in der Lichtshow verwendet.':'Dein Raum bleibt gespeichert. Die Lichtshow verwendet wieder ihren bisherigen Raum.');};
  root.querySelectorAll('[data-ar-template]').forEach(b=>b.onclick=()=>attempt(()=>addDevice(b.dataset.arTemplate)));
  q('manage-show').onclick=()=>onManageShow?.();
  q('add').onclick=()=>attempt(()=>{seed();beginPlacement();});q('fixture').onchange=()=>selectFixture(q('fixture').value);q('place').onclick=beginPlacement;
  q('remove').onclick=()=>attempt(()=>{const plan=structuredClone(current()),name=deviceName(fixture,plan.positions[fixture]);delete plan.positions[fixture];mode='select';commit(plan,{message:`${name} entfernt. Du kannst die Änderung rückgängig machen.`});});
  q('duplicate').onclick=()=>attempt(()=>{const plan=structuredClone(current()),p=plan.positions[fixture],added=planningDevice(plan,p.type||'spot');plan.positions[added.id]={...structuredClone(p),name:(deviceName(fixture,p)+' · Kopie').slice(0,60),x:added.position.x,y:added.position.y};fixture=added.id;commit(plan);selectFixture(fixture);});
  q('device-name').onchange=()=>attempt(()=>mutateFixture({name:q('device-name').value}));
  for(const key of ['left','right','front','back'])q('area-'+key).onchange=()=>attempt(()=>{
    const plan=current(),left=q('area-left').valueAsNumber,right=q('area-right').valueAsNumber,front=q('area-front').valueAsNumber,back=q('area-back').valueAsNumber;
    if(![left,right,front,back].every(Number.isFinite)||left>=right||front>=back||left<-plan.width/2||right>plan.width/2||front<0||back>plan.depth)throw Error('Bewegungsbereich prüfen: links kleiner als rechts, vorne kleiner als hinten; alle Grenzen innerhalb des Raums.');
    mutateFixture({motionArea:{x:left/plan.width+.5,y:front/plan.depth,width:(right-left)/plan.width,depth:(back-front)/plan.depth}},'Bewegungsbereich gespeichert.');
  });
  q('wall').onchange=()=>attempt(()=>mutateFixture({wallTarget:q('wall').value===''?undefined:{wall:Number(q('wall').value),start:0,end:1,minHeight:Math.min(1,current().height*.4),maxHeight:current().height*.9}},'Wandziel gespeichert.'));
  for(const key of ['start','end','min','max'])q('wall-'+key).onchange=()=>attempt(()=>mutateFixture({wallTarget:{wall:Number(q('wall').value),start:Number(q('wall-start').value)/100,end:Number(q('wall-end').value)/100,minHeight:Number(q('wall-min').value),maxHeight:Number(q('wall-max').value)}},'Wandbereich gespeichert.'));
  q('area-reset').onclick=()=>attempt(()=>mutateFixture({motionArea:undefined},'Moving Head nutzt den ganzen Raum.'));
  for(const [field,key] of [['x','x'],['y','y'],['z','height'],['rotation','rotation']])q(field).onchange=()=>attempt(()=>mutateFixture({[key]:q(field).valueAsNumber}));
  for(const k of ['width','depth','height'])q('size-'+k).onchange=()=>attempt(()=>{if(!q('size-'+k).checkValidity())throw Error('Bitte gib eine Gerätegröße zwischen 0,01 und 12 Metern ein.');mutateFixture({size:{...current().positions[fixture].size,[k]:q('size-'+k).valueAsNumber}});});
  q('point-undo').onclick=()=>{draft.pop();sync();};q('draw-finish').onclick=()=>attempt(finishDraw);
  q('cancel').onclick=q('place-cancel').onclick=()=>{mode='select';draft=[];preview=null;sync();notify('Bearbeitung beendet. Geräte bleiben an ihren gespeicherten Standorten.');};
  q('undo').onclick=()=>{if(!undo)return;({plans,selected,enabled}=undo);undo=null;mode='select';draft=[];preview=null;sync();persist();notify('Letzte Änderung rückgängig gemacht.');};
  const svgPoint=e=>{const matrix=q('map').getScreenCTM();return matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):null;};
  const mapPoint=e=>{const p=svgPoint(e);if(!p||!current())return null;const snap=mapView.zoom>1?100:10;return [Math.round(p.x*snap)/snap,Math.round((current().depth-p.y)*snap)/snap];};
  function zoomMap(factor,event=null){
    if(!current()||pointer)return;
    const before=event?svgPoint(event):null;
    mapView.zoom=Math.max(1,Math.min(8,mapView.zoom*factor));drawMap();
    if(before){const after=svgPoint(event);if(after){mapView.x+=before.x-after.x;mapView.y+=before.y-after.y;drawMap();}}
  }
  q('zoom-in').onclick=()=>zoomMap(1.25);q('zoom-out').onclick=()=>zoomMap(1/1.25);
  q('zoom-fit').onclick=()=>{if(pointer)return;mapView.key='';drawMap();};
  q('map').addEventListener('wheel',e=>{if(!current())return;e.preventDefault();zoomMap(Math.exp(-Math.max(-200,Math.min(200,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?260:1)))*.003),e);},{passive:false});
  q('map').onpointerdown=e=>{
    if(!current()||pointer||![0,1].includes(e.button))return;
    e.preventDefault();q('map').focus({preventScroll:true});
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
    const targetId=e.target.closest('[data-target-id]')?.dataset.targetId,id=targetId||e.target.closest('[data-device-id]')?.dataset.deviceId;
    const zone=e.target.closest('[data-ar-zone]');
    if(e.button===0&&zone&&mode==='select'&&!id){const z=current().zones.find(z=>z.id===zone.dataset.arZone);roomZones.selectZone(z.id);zoneDrag={id:z.id,start:svgPoint(e),value:{...z},resize:e.target.hasAttribute('data-ar-zone-resize')};drawMap();}
    else if(e.button===1||(mode==='select'&&!id)){
      const matrix=q('map').getScreenCTM();pan={x:mapView.x,y:mapView.y,scale:matrix?.a||1};
    }else if(mode!=='draw'&&id){mode='select';fixture=id;drag={id,aim:!!targetId,target:roomFixtureTarget(current(),id,getScene()?.lights)};sync();}
    q('map').setPointerCapture(e.pointerId);
  };
  q('map').onpointermove=e=>{
    if(!current()||(pointer&&pointer.id!==e.pointerId))return;
    if(zoneDrag){const p=svgPoint(e),z=zoneDrag.value,dx=(p.x-zoneDrag.start.x)/current().width,dy=-(p.y-zoneDrag.start.y)/current().depth,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));zoneDrag.preview=zoneDrag.resize?{...z,width:clamp(z.width+dx,.02,1-z.x),depth:clamp(z.depth+dy,.02,1-z.y)}:{...z,x:clamp(z.x+dx,0,1-z.width),y:clamp(z.y+dy,0,1-z.depth)};drawMap();return;}
    if(pan){mapView.x=pan.x-(e.clientX-pointer.x)/pan.scale;mapView.y=pan.y-(e.clientY-pointer.y)/pan.scale;drawMap();return;}
    if(mode==='draw'||mode==='place'||mode==='aim'||drag){preview=mapPoint(e);drawMap();}
  };
  q('map').onpointerup=e=>{if(pointer?.id!==e.pointerId)return;if(zoneDrag){const pending=zoneDrag;zoneDrag=null;pointer=null;if(pending.preview)roomZones.setZone(pending.id,pending.preview);drawMap();return;}if(pan){pan=null;pointer=null;preview=null;drawMap();return;}const point=mapPoint(e),moved=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>4,wasDrag=drag;pointer=null;drag=null;
    attempt(()=>{if(!point)return;if(mode==='draw'){
      if(draft.length>=3&&Math.hypot(point[0]-draft[0][0],point[1]-draft[0][1])<Math.max(current().width,current().depth)/30){finishDraw();return;}
      if(point[0]<-current().width/2||point[0]>current().width/2||point[1]<0||point[1]>current().depth)throw Error('Setze die Ecke innerhalb des Rasters. Vergrößere bei Bedarf zuerst Breite oder Tiefe.');
      if(draft.some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<.05))throw Error('Hier ist bereits eine Ecke. Setze den nächsten Punkt entlang der Wand.');if(draft.length>=128)throw Error('Du kannst bis zu 128 Ecken setzen.');draft.push(point);preview=null;sync();notify(`Ecke ${draft.length} gesetzt. ${draft.length<3?'Setze die nächste Ecke.':'Weitere Ecke setzen oder Raumform übernehmen.'}`);
    }else if(wasDrag?.aim&&moved){mutateFixture({target:{x:point[0],y:point[1]}},'Lichtziel gespeichert. Der Kreis markiert den Zielpunkt.');mode='select';preview=null;sync();}
    else if(mode==='place'||wasDrag&&!wasDrag.aim&&moved){mutateFixture({x:point[0],y:point[1],...(wasDrag&&!['stand','truss'].includes(current().positions[fixture].type)?{target:wasDrag.target}:{})},'Standort gespeichert. Das Lichtziel bleibt an seinem Platz.');mode='select';preview=null;sync();}else if(!wasDrag&&step===2)notify('Ziehe den Gerätemarker oder seinen gelben Zielkreis direkt an den gewünschten Ort.');});drawMap();};
  q('map').onpointercancel=q('map').onlostpointercapture=()=>{pointer=null;pan=null;zoneDrag=null;drag=null;preview=null;drawMap();};
  q('map').onpointerleave=()=>{if(!drag){preview=null;drawMap();}};
  q('map').onkeydown=e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='0')q('zoom-fit').click();else zoomMap(e.key==='-'?1/1.25:1.25);return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();pointer=null;pan=null;zoneDrag=null;drag=null;q('cancel').click();}if((e.key==='Enter'||e.key===' ')&&e.target.dataset.deviceId){e.preventDefault();selectFixture(e.target.dataset.deviceId);}};
  q('export').onclick=()=>{const blob=new Blob([JSON.stringify(current())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='anydj-raum.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  q('import').onchange=async()=>{try{const file=q('import').files[0];if(!file)return;if(file.size>256000)throw Error('Die Raumdatei ist zu groß (maximal 256 KB).');const value=JSON.parse(await file.text());if(disposed)return;validateRoomPlan(value);step=1;enabled=true;mode='select';commit(value,{message:'Raum importiert. Prüfe die Maße und fahre mit den Geräten fort.'});}catch(e){notify(e.message,true);}finally{q('import').value='';}};
  q('send').onclick=async()=>{q('send').disabled=true;try{await sendPlan(current());notify('Aufstellung gesendet. Wir warten auf die Bestätigung des Rechners.');}catch(e){notify(e.message,true);}finally{if(!disposed)q('send').disabled=!current();}};
  roomZones=createZonePlan(q('room-zones'),{getLayout:()=>current()||{width:8,depth:6},getSettings:()=>({zones:current()?.zones||[],aims:{}}),onSave:value=>attempt(()=>commit({...current(),zones:value.zones},{message:'Ruhezonen im Raum gespeichert.'})),onChange:()=>drawMap()});
  roomZones.panel.classList.add('ar-room-zones');roomZones.panel.querySelector('h3').textContent='Ruhezonen';roomZones.panel.querySelector('p').textContent='Zone hinzufügen, dann das Rechteck oben im Raumplan verschieben. Die helle Ecke verändert die Größe.';
  const importZones=document.createElement('button');importZones.type='button';importZones.textContent='Bisherige Showzonen übernehmen';importZones.dataset.arImportZones='';
  importZones.onclick=()=>attempt(()=>{const saved=JSON.parse(localStorage.getItem('anydj-3d-zones-v1')||'null');if(!saved?.zones?.length){notify('Keine bisherigen Showzonen gespeichert.');return;}commit({...current(),zones:[...(current().zones||[]),...saved.zones.map(z=>({...z,id:roomId()}))]},{message:'Showzonen übernommen. Prüfe ihre Position im Raum.'});});roomZones.panel.querySelector('.stage-3d-zone-actions').append(importZones);
  compact=compactDeviceManager(root);
  sync();if(storageError)notify(storageError,true);
  return {root,get moving(){return renderRoom.active();},get plan(){return current();},get active(){return enabled&&!!current();},get layout(){return enabled&&current()?roomPlanLayout(current()):null;},scene(scene,ar=false){return enabled&&current()?renderRoom(scene,current(),ar):scene;},seed,save:commit,use(plan){validateRoomPlan(plan);enabled=true;commit(plan);},notify,openStep(value){root.open=true;go(value);},setARSupport(value){if(arReady===value)return;arReady=value;sync();},destroy(){disposed=true;compact?.destroy();roomZones?.destroy();root.remove();}};
}
