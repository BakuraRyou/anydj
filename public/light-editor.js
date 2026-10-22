import {songPaletteAt} from './song-palette.js';
import {showFrameAt} from './show-plan.js';
import {cleanLook,DEFAULT_LOOK} from './dmx-show.js';
import {lightReview,lightReviewJSON} from './light-review.js';
import {sectionEditsFor,validateSectionEdits,transferMotif,applySectionLighting,sectionPlanAt} from './section-lighting.js';
import {editPhaseTime,isolateLightMoment} from './light-editor-model.js';
import {createLightTimeline} from './light-editor-timeline.js';

// The host owns mounting. Persistence, audio and physical output belong to the caller.
export function createLightEditor(host,{plan,edits,title='Lichtshow',position=()=>0,getDiagnostics=()=>null,audioSrc=null,externalAudio=null,onSave=async()=>{},onClose=()=>{},onPreview=()=>{},onBeforePlay=async()=>{},targets=[],onEditPosition=null,getTargetPreview=()=>[]}) {
  const dialog=document.createElement('section');dialog.className='light-editor';host.append(dialog);
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./light-editor.css',import.meta.url).href;dialog.append(stylesheet);
  dialog.insertAdjacentHTML('beforeend',`<form>
  <header class="le-header"><div><h2>Lichtshow bearbeiten</h2><p class="section-track"></p></div><button type="button" data-close aria-label="Schließen" class="le-icon">×</button></header>
  <div class="le-workspace">
    <section class="le-main" aria-label="Lichtverlauf">
      <div class="le-intro"><span class="le-step">1</span><div><h3>Abschnitt auswählen</h3><p>Wähle eine Phase oder bearbeite einen kurzen Moment. Die Wiedergabe läuft dabei weiter.</p></div></div>
      <div class="le-transport"><button type="button" data-play disabled>▶ Anhören</button><output data-clock></output><label class="le-time-input">Position (s)<input data-time type="number" min="0" step="0.01" aria-label="Songposition in Sekunden"></label><label class="le-check"><input type="checkbox" data-loop> Abschnitt wiederholen</label></div>
      <p class="le-audio-note" data-audio-note hidden>Zum Anhören die Audiodatei im DJ-Pult laden. Die Lichtvorschau ist bereits verfügbar.</p>
      <div class="le-moment-tools"><button type="button" data-previous-second aria-label="Eine Sekunde zurück">−1 s</button><button type="button" data-next-second aria-label="Eine Sekunde vor">+1 s</button><label>Dauer (s)<input data-moment-length type="number" min="0.1" max="60" step="0.1" value="1"></label><button type="button" data-moment>Moment bearbeiten</button><button type="button" data-split-now>Hier teilen</button></div><div class="le-timeline-card"><div class="le-timeline-tools"><strong>Deine Lichtabschnitte</strong><label class="le-zoom">Zoom<input data-zoom type="range" min="1" max="32" step="1" value="1"></label></div><div data-timeline></div><p class="le-guidance">Klicken zum Auswählen · Ränder ziehen zum Verlängern · Oben in die Zeitachse klicken zum Springen</p></div>
      <div class="le-preview-card"><div data-set-preview hidden></div><div class="light-editor-preview"><span data-orb aria-hidden="true"></span><div><strong>Lichtvorschau</strong><p>Farbe und Helligkeit an der Abspielposition</p></div></div><strong class="le-curve-heading">Lichtverlauf</strong><canvas width="800" height="44" aria-label="Farb- und Helligkeitsverlauf der Lichtshow"></canvas></div>
      <details class="le-tools"><summary>Abschnitte und Timing bearbeiten</summary><div class="le-tool-grid"><label>Zeiten einrasten<select data-snap><option value="beat">Am Beat</option><option value="bar">Am Takt</option><option value="free">Frei</option></select></label><label>Teilung bei Sekunde<input data-split-time type="number" min="0" step="any"></label></div><div class="le-actions"><button type="button" data-position>Position aus dem DJ-Pult</button><button type="button" data-split>Hier teilen</button><button type="button" data-merge>Mit nächstem verbinden</button><button type="button" data-add>In freiem Bereich hinzufügen</button><button type="button" data-duplicate>Duplizieren</button><button type="button" data-delete>Abschnitt entfernen</button></div><p>Freie Bereiche verwenden die automatisch berechnete Show. Zum Verschieben braucht ein Abschnitt freien Platz.</p><p>Tastatur: Pfeiltasten verschieben im gewählten Raster. Bei „Frei“: 0,1 s, mit Umschalt: 1 s.</p><button type="button" data-reset>Alle Abschnitte zurücksetzen</button></details><details class="le-tools"><summary>Lichtshow mit einem Video auswerten</summary><p>Exportiert die aktuelle Lichtplanung und Songposition für den Vergleich mit einer Aufnahme. Enthält den gewählten Showmodus und deine Abschnittseinstellungen. Raumeinstellungen, Musik und Video sind nicht enthalten. <button type="button" data-review-export>Analyse exportieren</button></p></details>
    </section>
    <aside class="le-inspector" aria-label="Ausgewählten Abschnitt gestalten">
      <div class="le-intro"><span class="le-step">2</span><div><h3>Lichtwirkung ändern</h3><p>Gilt nur für den ausgewählten Abschnitt.</p></div></div>
      <label class="le-selection">Ausgewählter Abschnitt<select data-selection></select></label><p class="le-selection-time" data-selection-time></p>
      <label class="le-target-search">Gerät oder Gruppe finden<input data-target-search type="search" placeholder="Name oder Gerätetyp"></label><label class="le-target-choice">Bearbeiten<select data-target><option value="scene">Gesamte Szene</option></select></label>
      <p class="le-scope-help" data-scope-help></p>
      <div class="section-fields">
        <div class="le-target-controls" hidden><div class="le-palette-card"><span class="le-label">Aktuelle Gerätefarben</span><div data-target-colors></div><p data-target-colors-help></p></div>
          <label>Eigene Gestaltung<input data-cue-enabled type="checkbox"></label>
          <div data-cue-fields>
            <label>Farbe<select data-cue-mode><option value="auto">Songfarbe übernehmen</option><option value="fixed">Feste Farbe</option><option value="custom">Eigene Farbkombination</option><option value="opposite">Kontrast zur Songfarbe</option></select></label>
            <div class="le-tool-grid"><label>Farbe<input data-cue-a type="color"></label><label>Zweite Farbe<input data-cue-b type="color"></label></div>
            <label>Helligkeit (%)<input data-cue-brightness type="range" min="0" max="100" step="1"><output data-cue-brightness-value></output></label>
            <label>Akzent / Animation<select data-cue-animation><option value="follow">Songimpulse übernehmen</option><option value="wash">Gleichmäßiges Licht</option><option value="pulse">Beat-Akzent</option><option value="alternate">Gruppenwechsel</option><option value="wave">Welle</option><option value="chase">Lauflicht</option></select></label>
            <label>Akzentstärke (%)<input data-cue-strength type="range" min="0" max="100" step="1"><output data-cue-strength-value></output></label>
            <label>Rhythmus<select data-cue-period><option value="1">Jeder Beat</option><option value="2">Alle 2 Beats</option><option value="4">Alle 4 Beats</option><option value="8">Alle 8 Beats</option><option value="16">Alle 16 Beats</option></select></label>
            <div data-cue-aim><label><input data-cue-aim-enabled type="checkbox"> Festes Lichtziel im Raum</label><div class="le-tool-grid"><label>Links / rechts (m)<input data-cue-x type="number" step="0.1"></label><label>Von vorne (m)<input data-cue-y type="number" step="0.1"></label></div><p>Lichtziel am Boden; Raumgrenzen und Ruhezonen gelten weiterhin.</p></div>
          </div>
          <button type="button" data-edit-position>Geräteposition im Raumplan bearbeiten</button>
        </div>
        <label class="le-style">Show-Stil<select name="profile"><option value="inherit">Songstandard übernehmen</option><option value="auto">Automatisch</option><option value="show">Show</option><option value="strobe">Formationen</option><option value="party">Party</option><option value="disco">Disco</option><option value="calm">Ruhig</option><option value="atmospheric">Atmosphärisch</option></select></label>
        <div class="le-palette-card"><span class="le-label">Verwendete Farben</span><div data-palette></div><p data-palette-help></p></div>
        <div><span class="le-label">Schnell auswählen</span><div class="le-presets"><button type="button" data-preset="calm">Ruhig</button><button type="button" data-preset="balanced">Automatisch</button><button type="button" data-preset="intense">Lebendig</button></div></div>
        <label>Farben<select name="colors"><option value="auto">Automatisch zum Song</option><option value="hold">Eine feste Farbe</option><option value="pair">Zwei Farben im Wechsel</option><option value="cycle">Vier Farben im Wechsel</option></select></label>
        <div class="section-colors"><label>Farbe<input name="colorA" type="color"></label><label data-second-color>Zweite Farbe<input name="colorB" type="color"></label></div>
        <label><span class="le-range-label">Lebendigkeit <output data-movement></output></span><input name="movement" type="range" min="0" max="1.6" step="0.05"><span class="le-range-ends"><span>Ruhig</span><span>Lebendig</span></span></label>
        <details class="le-details"><summary>Fein einstellen</summary><div class="le-detail-fields"><label>Abschnittsname<input name="name" maxlength="80"></label><div class="le-tool-grid"><label>Beginn (s)<input name="start" type="number" min="0" step="any"></label><label>Ende (s)<input name="end" type="number" min="0" step="any"></label></div><label>Lichtimpulse<select name="rhythm"><option value="auto">Automatisch zur Musik</option><option value="bars">Nur am Taktanfang</option><option value="strong">Nur bei starken Akzenten</option><option value="none">Keine Impulse</option></select></label><label>Gruppe für ähnliche Abschnitte<input name="motif" maxlength="80"></label><button type="button" data-transfer>Auf dieselbe Gruppe übertragen</button></div></details>
      </div>
    </aside>
  </div>
  <footer class="le-footer"><div class="le-history"><button type="button" data-undo title="Rückgängig" aria-label="Rückgängig">↶</button><button type="button" data-redo title="Wiederholen" aria-label="Wiederholen">↷</button></div><p class="section-feedback" role="status">Deine Änderungen werden erst beim Speichern übernommen.</p><div class="le-footer-actions"><button type="button" data-close>Abbrechen</button><button type="submit">Änderungen speichern</button></div></footer>
  </form>`);
  const form=dialog.querySelector('form'),q=s=>dialog.querySelector(s),field=n=>form.elements.namedItem(n);
  const advanced=document.createElement('div');advanced.className='le-advanced';advanced.append(...dialog.querySelectorAll('.le-main>.le-tools'));q('.le-workspace').after(advanced);
  q('.section-track').textContent=title;
  let draft=validateSectionEdits(structuredClone(edits??sectionEditsFor(plan)),plan.duration),selected=0;
  let targetColorSignature='',editTarget='scene',paletteSignature='',history=[],future=[],time=Math.max(0,Math.min(plan.duration,position())),rendered=plan,renderedSignature=null,destroyed=false,saving=false,animation=0;
  const audio=externalAudio||(audioSrc?new Audio(audioSrc):null),audioEvents=new AbortController(),audioOptions={signal:audioEvents.signal};
  q('[data-play]').disabled=!audio;q('[data-audio-note]').hidden=Boolean(audio);
  const profileNames={auto:'Automatisch',show:'Show',strobe:'Formationen',party:'Party',disco:'Disco',calm:'Ruhig',atmospheric:'Atmosphärisch'};
  const clock=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
  function select(index){if(saving)return;selected=index;const phase=draft[index];if(phase&&(!audio||audio.paused)){time=phase.start;if(audio)audio.currentTime=time;}render();}
  q('[data-selection]').onchange=e=>select(Number(e.target.value));
  function tick(){if(destroyed||!audio||audio.paused)return;const phase=draft[selected];if(q('[data-loop]').checked&&phase&&(audio.currentTime>=phase.end||audio.currentTime<phase.start))audio.currentTime=phase.start;seek(audio.currentTime);animation=requestAnimationFrame(tick);}
  if(audio){audio.addEventListener('play',()=>{q('[data-play]').textContent='Ⅱ Pause';cancelAnimationFrame(animation);tick();},audioOptions);audio.addEventListener('pause',()=>{q('[data-play]').textContent='▶ Anhören';cancelAnimationFrame(animation);seek(audio.currentTime);},audioOptions);audio.addEventListener('error',()=>message('Die Audiodatei konnte nicht geladen werden.'),audioOptions);if(externalAudio)audio.addEventListener('seeked',()=>seek(audio.currentTime),audioOptions);}
  q('[data-play]').onclick=async()=>{if(!audio)return;if(!audio.paused){audio.pause();return;}try{q('[data-play]').disabled=true;await onBeforePlay();if(destroyed)return;audio.currentTime=time;await audio.play();}catch(error){message(`Wiedergabe fehlgeschlagen: ${error.message}`);}finally{if(!destroyed)q('[data-play]').disabled=false;}};
  const clone=()=>structuredClone(draft);
  const remember=old=>{if(JSON.stringify(old)===JSON.stringify(draft))return;history.push(old);if(history.length>100)history.shift();future=[];};
  const change=fn=>{if(saving)return;const old=clone();try{fn();draft=validateSectionEdits(draft,plan.duration);remember(old);render();}catch(error){draft=old;message(error.message);render();}};
  function seek(value){
    time=Math.max(0,Math.min(plan.duration,value));const active=sectionPlanAt(rendered,time),f=showFrameAt(active,time);
    if(f){q('[data-orb]').style.background=`rgb(${f.r},${f.g},${f.b})`;q('[data-orb]').style.opacity=.15+.85*f.dimming/100;}
    q('[data-clock]').textContent=`${clock(time)} / ${clock(plan.duration)}`;
    if(document.activeElement!==q('[data-time]'))q('[data-time]').value=time.toFixed(2);
    q('[data-split-time]').value=time.toFixed(2);timeline.setPosition(time);updatePalette();onPreview({time,plan:rendered,playing:Boolean(audio&&!audio.paused)});
  }
  const go=value=>{if(audio)audio.currentTime=value;seek(value);};
  q('[data-time]').max=plan.duration;q('[data-time]').onchange=e=>go(Math.max(0,Math.min(plan.duration,Number(e.target.value)||0)));
  q('[data-previous-second]').onclick=()=>go(Math.max(0,time-1));q('[data-next-second]').onclick=()=>go(Math.min(plan.duration,time+1));
  q('[data-moment]').onclick=()=>change(()=>{const length=Number(q('[data-moment-length]').value);if(!Number.isFinite(length)||length<.1||length>60)throw Error('Wähle eine Dauer zwischen 0,1 und 60 Sekunden.');const isolated=isolateLightMoment(draft,time,plan.duration,length);draft=isolated.edits;selected=isolated.index;message('Dieser Moment ist ausgewählt. Änderungen gelten nur für seine Dauer.');});
  q('[data-split-now]').onclick=()=>{const index=draft.findIndex(e=>time>=e.start&&time<e.end);if(index<0){message('An dieser Position gibt es keinen Abschnitt zum Teilen.');return;}selected=index;q('[data-split]').click();};
  function paletteForSelection(){
    const e=draft[selected],at=e&&!(time>=e.start&&time<e.end)?e.start:time,active=sectionPlanAt(rendered,at),frame=showFrameAt(active,at);
    return songPaletteAt(active,at)||[[frame.r,frame.g,frame.b]];
  }
  const hex=rgb=>'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  function updatePalette(){
    const e=draft[selected];if(!e)return;
    const colors=paletteForSelection().slice(0,4).map(hex),signature=colors.join('/')+'/'+e.colors;
    if(signature===paletteSignature||q('[data-palette]').contains(document.activeElement))return;paletteSignature=signature;
    q('[data-palette]').replaceChildren(...colors.map((color,index)=>{
      const label=document.createElement('label');label.textContent=`Farbe ${index+1}`;
      const input=document.createElement('input');input.type='color';input.value=color;input.setAttribute('aria-label',`Verwendete Farbe ${index+1} ändern`);
      const code=document.createElement('span');code.textContent=color.toUpperCase();
      input.onchange=()=>change(()=>{const palette=colors.map((c,i)=>i===index?input.value:c),phase=draft[selected];phase.colors=palette.length===1?'hold':palette.length===2?'pair':'cycle';phase.colorA=palette[0];phase.colorB=palette[1]||palette[0];phase.palette=palette;paletteSignature='';message('Eigene Farben für den ausgewählten Abschnitt festgelegt.');});
      label.append(input,code);return label;
    }));
    q('[data-palette-help]').textContent=e.colors==='auto'?'Berechnete Palette an dieser Position. Eine Farbe ändern, um sie für den ausgewählten Abschnitt festzulegen.':'Deine Palette für diesen Abschnitt. Farben lassen sich direkt ändern.';
  }

  const timeline=createLightTimeline(q('[data-timeline]'),{plan,getSnap:()=>q('[data-snap]').value,onSelect:select,onSeek:value=>{if(audio)audio.currentTime=value;seek(value);},onEdit:(index,kind,value)=>change(()=>{draft=editPhaseTime(draft,index,kind,value,plan,q('[data-snap]').value);})});
  q('[data-zoom]').oninput=e=>timeline.setZoom(Number(e.target.value));
  function undo(redo=false){if(saving)return;const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(clone());draft=from.pop();selected=Math.min(selected,Math.max(0,draft.length-1));render();}
  q('[data-undo]').onclick=()=>undo();q('[data-redo]').onclick=()=>undo(true);
  dialog.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}});
  const message=text=>{q('.section-feedback').textContent=text;};
  for(const target of targets){const option=new Option(target.name,target.id);q('[data-target]').append(option);}
  // Keep stored device edits reachable even if their original room is not active.
  for(const cue of draft.flatMap(e=>e.fixtures||[]))if(![...q('[data-target]').options].some(o=>o.value===cue.target))q('[data-target]').append(new Option(`Gespeichertes Gerät · ${cue.target}`,cue.target));
  q('[data-target]').onchange=e=>{editTarget=e.target.value;targetColorSignature='';render();updateTargetColors();};
  q('[data-target-search]').oninput=e=>{const value=e.target.value.trim().toLocaleLowerCase();for(const option of q('[data-target]').options)option.hidden=option.value!=='scene'&&option.value!==editTarget&&!option.textContent.toLocaleLowerCase().includes(value);};
  const cueField=name=>q(`[data-cue-${name}]`);
  const currentCue=()=>draft[selected]?.fixtures?.find(c=>c.target===editTarget);
  function renderTarget(){
    const target=targets.find(t=>t.id===editTarget),cue=currentCue(),look=cleanLook(cue?.look);
    q('[data-scope-help]').textContent=editTarget==='scene'?'Farben, Stil und Bewegung gelten für den ausgewählten Abschnitt. Geräte können diese Vorgaben gezielt überschreiben.':`${target?.name||'Gespeichertes Gerät'} · nur im ausgewählten Zeitbereich. Einzelgeräte haben Vorrang vor Gruppen.`;
    cueField('enabled').checked=Boolean(cue);q('[data-cue-fields]').inert=!cue;
    for(const key of ['mode','animation','brightness','strength','period'])cueField(key).value=look[key];
    cueField('a').value=look.colors[0];cueField('b').value=look.colors[1];
    cueField('a').disabled=!cue||!['fixed','custom'].includes(look.mode);cueField('b').disabled=!cue||look.mode!=='custom';
    cueField('a').closest('label').hidden=!['fixed','custom'].includes(look.mode);cueField('b').closest('label').hidden=look.mode!=='custom';
    for(const key of ['brightness','strength'])cueField(`${key}-value`).textContent=`${look[key]} %`;
    cueField('aim').hidden=!target?.room;cueField('aim-enabled').checked=Boolean(cue?.aim);
    const room=target?.room,aim=cue?.aim||target?.aim||{x:0,y:(room?.depth||8)/2};
    for(const key of ['x','y']){cueField(key).value=aim[key];cueField(key).disabled=!cue?.aim;}
    cueField('x').min=-(room?.width||60)/2;cueField('x').max=(room?.width||60)/2;cueField('y').min=0;cueField('y').max=room?.depth||60;
    q('[data-edit-position]').hidden=!onEditPosition||!target?.room;
  }
  cueField('enabled').onchange=()=>change(()=>{
    const phase=draft[selected];phase.fixtures=(phase.fixtures||[]).filter(c=>c.target!==editTarget);
    if(cueField('enabled').checked)phase.fixtures.push({target:editTarget,look:cleanLook({...DEFAULT_LOOK,animation:'follow'})});
  });
  for(const key of ['mode','animation','a','b','brightness','strength','period','aim-enabled','x','y'])cueField(key).onchange=()=>change(()=>{
    const cue=currentCue();if(!cue)return;
    cue.look=cleanLook({mode:cueField('mode').value,colors:[cueField('a').value,cueField('b').value],animation:cueField('animation').value,brightness:Number(cueField('brightness').value),strength:Number(cueField('strength').value),period:Number(cueField('period').value)});
    if(cueField('aim-enabled').checked){const target=targets.find(t=>t.id===editTarget),x=Number(cueField('x').value),y=Number(cueField('y').value);if(!target?.room||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>target.room.width/2||y<0||y>target.room.depth)throw Error('Das Lichtziel muss im Raum liegen.');cue.aim={x,y};}else delete cue.aim;
    message('Gerätegestaltung für diesen Zeitbereich aktualisiert.');
  });
  q('[data-edit-position]').onclick=()=>onEditPosition?.(editTarget);
  function updateTargetColors(){
    if(editTarget==='scene'||destroyed)return;
    const values=getTargetPreview(editTarget)||[],signature=JSON.stringify(values);
    q('[data-target-colors-help]').textContent=values.length?'Farben der aktuellen 3D-Ausgabe. Eine Farbe ändern, um sie für den ausgewählten Abschnitt festzulegen.':'Die Ausgabe erscheint, sobald das Gerät in der Vorschau sichtbar ist. Eigene Gestaltung kannst du bereits festlegen.';
    if(signature===targetColorSignature||q('[data-target-colors]').contains(document.activeElement))return;targetColorSignature=signature;
    const colors=[...new Set(values.map(v=>v.color))].slice(0,4);
    q('[data-target-colors]').replaceChildren(...colors.map((color,i)=>{
      const label=document.createElement('label'),input=document.createElement('input');input.type='color';input.setAttribute('aria-label',`Aktuelle Gerätefarbe ${i+1} ändern`);
      input.value=color.startsWith('#')?color:hex((color.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number));
      label.textContent=`Farbe ${i+1}`;input.onchange=()=>change(()=>{const phase=draft[selected];phase.fixtures??=[];let cue=currentCue();if(!cue){cue={target:editTarget,look:cleanLook()};phase.fixtures.push(cue);}cue.look=cleanLook({...cue.look,mode:'fixed',colors:[input.value,input.value]});});label.append(input);return label;
    }));
  }
  const targetColorTimer=setInterval(updateTargetColors,200);
  const preview=()=>{
    const signature=JSON.stringify(draft);if(signature!==renderedSignature){rendered=applySectionLighting(plan,draft);renderedSignature=signature;}const canvas=q('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let x=0;x<canvas.width;x++){const f=rendered.frames[Math.min(rendered.frames.length-1,Math.floor(x/canvas.width*rendered.frames.length))];ctx.fillStyle=`rgb(${f.r},${f.g},${f.b})`;ctx.fillRect(x,44-f.dimming*.44,1,f.dimming*.44);}
  };
  function render(){
    timeline.update(draft,selected);
    q('[data-undo]').disabled=!history.length;q('[data-redo]').disabled=!future.length;
    const e=draft[selected];
    const selection=q('[data-selection]');selection.replaceChildren();
    draft.forEach((phase,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${clock(phase.start)} · ${phase.name}${phase.profile&&phase.profile!=='inherit'?' · '+profileNames[phase.profile]:''}`;selection.append(option);});selection.value=selected;selection.disabled=!e;
    q('[data-selection-time]').textContent=e?`${clock(e.start)} – ${clock(e.end)} · ${(e.end-e.start).toFixed(1)} Sekunden`:'Keine eigenen Abschnitte. Die automatische Show bleibt aktiv.';
    q('.section-fields').hidden=!e;
    q('.section-colors').hidden=!e||e.colors==='auto';q('[data-second-color]').hidden=e?.colors==='hold';
    const presets={calm:{rhythm:'none',movement:.35,colors:'hold'},balanced:{rhythm:'auto',movement:1,colors:'auto'},intense:{rhythm:'auto',movement:1.5,colors:'pair'}};
    for(const button of dialog.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed',String(Boolean(e)&&Object.entries(presets[button.dataset.preset]).every(([key,value])=>e[key]===value)));
    for(const input of dialog.querySelectorAll('.section-fields input,.section-fields select,[data-preset],[data-transfer],[data-split],[data-merge],[data-delete],[data-duplicate],[name=motif]'))input.disabled=!e;
    dialog.dataset.editScope=editTarget==='scene'?'scene':'fixture';q('.le-target-controls').hidden=editTarget==='scene';renderTarget();preview();seek(time);if(!e)return;
    field('profile').value=e.profile||'inherit';
    for(const name of ['name','motif','start','end','rhythm','movement','colors','colorA','colorB'])field(name).value=e[name];
    
    q('[data-movement]').textContent=`${Math.round(e.movement*100)} %`;

    q('[data-merge]').disabled=selected===draft.length-1;

  }
  let gesture=null;
  form.addEventListener('change',event=>{
    if(!event.target.name||!draft[selected])return;
    const old=gesture??structuredClone(draft),e=draft[selected];gesture=null;
    try{
      for(const name of ['name','motif','rhythm','colors','colorA','colorB'])e[name]=field(name).value;
      e.movement=Number(field('movement').value);e.profile=field('profile').value;
      if(['colors','colorA','colorB'].includes(event.target.name))delete e.palette;
      if(event.target.name==='start')draft=editPhaseTime(draft,selected,'start',Number(field('start').value),plan,q('[data-snap]').value);
      if(event.target.name==='end')draft=editPhaseTime(draft,selected,'end',Number(field('end').value),plan,q('[data-snap]').value);
      draft=validateSectionEdits(draft,plan.duration);remember(old);message('Vorschau aktualisiert. Mit Speichern übernehmen.');render();
    }catch(error){draft=old;message(error.message);render();}
  });
  for(const name of ['movement','colorA','colorB'])field(name).oninput=()=>{
    if(saving||!draft[selected])return;gesture??=clone();
    if(name==='colorA'||name==='colorB')delete draft[selected].palette;
    draft[selected][name]=name==='movement'?Number(field(name).value):field(name).value;
    q('[data-movement]').textContent=`${Math.round(draft[selected].movement*100)} %`;preview();seek(time);
  };
  for(const b of dialog.querySelectorAll('[data-preset]'))b.onclick=()=>change(()=>{
    Object.assign(draft[selected],{calm:{rhythm:'none',movement:.35,colors:'hold'},balanced:{rhythm:'auto',movement:1,colors:'auto'},intense:{rhythm:'auto',movement:1.5,colors:'pair'}}[b.dataset.preset]);
  });
  q('[data-transfer]').onclick=()=>change(()=>{draft=transferMotif(draft,selected);message('Einstellungen auf die gleiche Motivgruppe übertragen.');});
  q('[data-position]').onclick=()=>go(position());
  q('[data-review-export]').onclick=()=>{
    try{
      preview();
      const review=lightReview(rendered,{title,time});review.runtime=getDiagnostics();
      const blob=new Blob([lightReviewJSON(review)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='anydj-light-review.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      message(`Analyse bei Songsekunde ${time.toFixed(2)} exportiert. Für den Videovergleich dieselbe Songposition notieren.`);
    }catch(error){message(`Export fehlgeschlagen: ${error.message}`);}
  };
  q('[data-split]').onclick=()=>change(()=>{
    const e=draft[selected];let time=Number(q('[data-split-time]').value);const grid=q('[data-snap]').value==='bar'?plan.beatGrid?.downbeats:q('[data-snap]').value==='beat'?(plan.beatGrid?.beats??plan.beatTiming?.times):[];if(grid?.length)time=grid.reduce((a,b)=>Math.abs(b-time)<Math.abs(a-time)?b:a);
    if(time<=e.start+.1||time>=e.end-.1){message('Teilung muss innerhalb des Abschnitts liegen.');return;}
    draft.splice(selected,1,{...e,end:time},{...e,id:crypto.randomUUID(),start:time});selected++;
  });
  q('[data-merge]').onclick=()=>change(()=>{if(selected+1<draft.length){draft[selected].end=draft[selected+1].end;draft.splice(selected+1,1);}});
  q('[data-reset]').onclick=()=>change(()=>{draft=sectionEditsFor(plan);selected=0;message('Analyse-Einteilung wiederhergestellt. Noch nicht gespeichert.');});
  q('[data-duplicate]').onclick=()=>change(()=>{const source=draft[selected],duration=source.end-source.start;let start=source.end;for(const phase of draft){if(phase.end<=start)continue;if(phase.start-start>=duration)break;start=phase.end;}if(start+duration>plan.duration)throw Error('Kein freier Bereich für eine Kopie. Entferne zuerst eine Phase oder verkürze sie.');const copy={...source,id:crypto.randomUUID(),name:source.name+' · Kopie',start,end:start+duration};draft.push(copy);draft.sort((a,b)=>a.start-b.start);selected=draft.indexOf(copy);});
  q('[data-delete]').onclick=()=>change(()=>{draft.splice(selected,1);selected=Math.max(0,selected-1);});
  q('[data-add]').onclick=()=>change(()=>{if(time>=plan.duration||draft.some(e=>time>=e.start&&time<e.end))throw Error('Wähle einen freien Bereich in der Zeitleiste.');const next=draft.find(e=>e.start>time);draft.push({id:crypto.randomUUID(),start:time,end:Math.min(next?.start??plan.duration,time+4),name:'Neue Phase',motif:'',rhythm:'auto',movement:1,colors:'auto',colorA:'#ff7700',colorB:'#7400ff'});draft.sort((a,b)=>a.start-b.start);selected=draft.findIndex(e=>e.start===time);});
  for(const b of dialog.querySelectorAll('[data-close]'))b.onclick=onClose;
  form.onsubmit=async event=>{
    event.preventDefault();if(saving)return;saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;const controls=[...dialog.querySelectorAll('input,select,button')];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
    try{await onSave(validateSectionEdits(clone(),plan.duration));if(!destroyed)message('Änderungen gespeichert.');}
    catch(error){if(!destroyed)message(`Speichern fehlgeschlagen: ${error.message}`);}finally{saving=false;if(!destroyed){controls.forEach((c,i)=>c.disabled=disabled[i]);button.disabled=false;}}
  };
  render();
  if(audio&&!audio.paused){q('[data-play]').textContent='Ⅱ Pause';tick();}
  return {previewHost:q('[data-set-preview]'),getEdits:clone,setPosition:seek,destroy(){destroyed=true;clearInterval(targetColorTimer);audioEvents.abort();cancelAnimationFrame(animation);if(audio&&!externalAudio){audio.pause();audio.removeAttribute('src');audio.load();}timeline.destroy();dialog.remove();}};
}
