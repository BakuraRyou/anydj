import {sectionEditsFor,validateSectionEdits,transferMotif,applySectionLighting,sectionFrameAt} from './section-lighting.js';
import {editPhaseTime} from './light-editor-model.js';
import {createLightTimeline} from './light-editor-timeline.js';

// The host owns mounting. Persistence, audio and physical output belong to the caller.
export function createLightEditor(host,{plan,edits,title='Lichtshow',position=()=>0,audioSrc=null,onSave=async()=>{},onClose=()=>{},onPreview=()=>{},onBeforePlay=async()=>{}}) {
  const dialog=document.createElement('section');dialog.className='light-editor';host.append(dialog);
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./light-editor.css',import.meta.url).href;dialog.append(stylesheet);
  dialog.insertAdjacentHTML('beforeend',`<form>
  <header class="le-header"><div><h2>Lichtshow bearbeiten</h2><p class="section-track"></p></div><button type="button" data-close aria-label="Schließen" class="le-icon">×</button></header>
  <div class="le-workspace">
    <section class="le-main" aria-label="Lichtverlauf">
      <div class="le-intro"><span class="le-step">1</span><div><h3>Abschnitt auswählen</h3><p>Klicke auf einen Abschnitt und ändere seine Farben oder Lebendigkeit.</p></div></div>
      <div class="le-transport"><button type="button" data-play disabled>▶ Anhören</button><output data-clock></output><label class="le-check"><input type="checkbox" data-loop> Abschnitt wiederholen</label></div>
      <p class="le-audio-note" data-audio-note hidden>Zum Anhören die Audiodatei im DJ-Pult laden. Die Lichtvorschau ist bereits verfügbar.</p>
      <div class="le-timeline-card"><div class="le-timeline-tools"><strong>Deine Lichtabschnitte</strong><label class="le-zoom">Zoom<input data-zoom type="range" min="1" max="8" step="1" value="1"></label></div><div data-timeline></div><p class="le-guidance">Klicken zum Auswählen · Ränder ziehen zum Verlängern · Oben in die Zeitachse klicken zum Springen</p></div>
      <div class="le-preview-card"><div data-set-preview hidden></div><div class="light-editor-preview"><span data-orb aria-hidden="true"></span><div><strong>Lichtvorschau</strong><p>Farbe und Helligkeit an der Abspielposition</p></div></div><canvas width="800" height="44" aria-label="Farb- und Helligkeitsverlauf der Lichtshow"></canvas></div>
      <details class="le-tools"><summary>Abschnitte und Timing bearbeiten</summary><div class="le-tool-grid"><label>Zeiten einrasten<select data-snap><option value="beat">Am Beat</option><option value="bar">Am Takt</option><option value="free">Frei</option></select></label><label>Teilung bei Sekunde<input data-split-time type="number" min="0" step="any"></label></div><div class="le-actions"><button type="button" data-position>Position aus dem DJ-Pult</button><button type="button" data-split>Hier teilen</button><button type="button" data-merge>Mit nächstem verbinden</button><button type="button" data-add>In freiem Bereich hinzufügen</button><button type="button" data-duplicate>Duplizieren</button><button type="button" data-delete>Abschnitt entfernen</button></div><p>Freie Bereiche verwenden die automatisch berechnete Show. Zum Verschieben braucht ein Abschnitt freien Platz.</p><p>Tastatur: Pfeiltasten verschieben im gewählten Raster. Bei „Frei“: 0,1 s, mit Umschalt: 1 s.</p><button type="button" data-reset>Alle Abschnitte zurücksetzen</button></details>
    </section>
    <aside class="le-inspector" aria-label="Ausgewählten Abschnitt gestalten">
      <div class="le-intro"><span class="le-step">2</span><div><h3>Lichtwirkung ändern</h3><p>Gilt nur für den ausgewählten Abschnitt.</p></div></div>
      <label class="le-selection">Ausgewählter Abschnitt<select data-selection></select></label><p class="le-selection-time" data-selection-time></p>
      <div class="section-fields">
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
  q('.section-track').textContent=title;
  let draft=validateSectionEdits(structuredClone(edits??sectionEditsFor(plan)),plan.duration),selected=0;
  let history=[],future=[],time=Math.max(0,Math.min(plan.duration,position())),rendered=plan,renderedSignature=null,destroyed=false,saving=false,animation=0;
  const audio=audioSrc?new Audio(audioSrc):null;
  q('[data-play]').disabled=!audio;q('[data-audio-note]').hidden=Boolean(audio);
  const clock=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
  function select(index){if(saving)return;selected=index;const phase=draft[index];if(phase){time=phase.start;if(audio)audio.currentTime=time;}render();}
  q('[data-selection]').onchange=e=>select(Number(e.target.value));
  function tick(){if(destroyed||!audio||audio.paused)return;const phase=draft[selected];if(q('[data-loop]').checked&&phase&&(audio.currentTime>=phase.end||audio.currentTime<phase.start))audio.currentTime=phase.start;seek(audio.currentTime);animation=requestAnimationFrame(tick);}
  if(audio){audio.addEventListener('play',()=>{q('[data-play]').textContent='Ⅱ Pause';cancelAnimationFrame(animation);tick();});audio.addEventListener('pause',()=>{q('[data-play]').textContent='▶ Anhören';cancelAnimationFrame(animation);});audio.addEventListener('error',()=>message('Die Audiodatei konnte nicht geladen werden.'));}
  q('[data-play]').onclick=async()=>{if(!audio)return;if(!audio.paused){audio.pause();return;}try{q('[data-play]').disabled=true;await onBeforePlay();if(destroyed)return;audio.currentTime=time;await audio.play();}catch(error){message(`Wiedergabe fehlgeschlagen: ${error.message}`);}finally{if(!destroyed)q('[data-play]').disabled=false;}};
  const clone=()=>structuredClone(draft);
  const remember=old=>{if(JSON.stringify(old)===JSON.stringify(draft))return;history.push(old);if(history.length>100)history.shift();future=[];};
  const change=fn=>{if(saving)return;const old=clone();try{fn();draft=validateSectionEdits(draft,plan.duration);remember(old);render();}catch(error){draft=old;message(error.message);render();}};
  function seek(value){time=Math.max(0,Math.min(plan.duration,value));const frame=rendered.frames[Math.min(rendered.frames.length-1,Math.floor(time/rendered.step))],f=frame?sectionFrameAt(rendered,time,frame):null;if(f){q('[data-orb]').style.background=`rgb(${f.r},${f.g},${f.b})`;q('[data-orb]').style.opacity=.15+.85*f.dimming/100;}q('[data-clock]').textContent=`${clock(time)} / ${clock(plan.duration)}`;q('[data-split-time]').value=time.toFixed(2);timeline.setPosition(time);onPreview({time,plan:rendered,playing:Boolean(audio&&!audio.paused)});}
  const timeline=createLightTimeline(q('[data-timeline]'),{plan,getSnap:()=>q('[data-snap]').value,onSelect:select,onSeek:value=>{if(audio)audio.currentTime=value;seek(value);},onEdit:(index,kind,value)=>change(()=>{draft=editPhaseTime(draft,index,kind,value,plan,q('[data-snap]').value);})});
  q('[data-zoom]').oninput=e=>timeline.setZoom(Number(e.target.value));
  function undo(redo=false){if(saving)return;const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(clone());draft=from.pop();selected=Math.min(selected,Math.max(0,draft.length-1));render();}
  q('[data-undo]').onclick=()=>undo();q('[data-redo]').onclick=()=>undo(true);
  dialog.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}});
  const message=text=>{q('.section-feedback').textContent=text;};
  const preview=()=>{
    const signature=JSON.stringify(draft);if(signature!==renderedSignature){rendered=applySectionLighting(plan,draft);renderedSignature=signature;}const canvas=q('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let x=0;x<canvas.width;x++){const f=rendered.frames[Math.min(rendered.frames.length-1,Math.floor(x/canvas.width*rendered.frames.length))];ctx.fillStyle=`rgb(${f.r},${f.g},${f.b})`;ctx.fillRect(x,44-f.dimming*.44,1,f.dimming*.44);}
  };
  function render(){
    timeline.update(draft,selected);
    q('[data-undo]').disabled=!history.length;q('[data-redo]').disabled=!future.length;
    const e=draft[selected];
    const selection=q('[data-selection]');selection.replaceChildren();
    draft.forEach((phase,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${index+1}. ${phase.name}`;selection.append(option);});selection.value=selected;selection.disabled=!e;
    q('[data-selection-time]').textContent=e?`${clock(e.start)} – ${clock(e.end)} · ${(e.end-e.start).toFixed(1)} Sekunden`:'Keine eigenen Abschnitte. Die automatische Show bleibt aktiv.';
    q('.section-fields').hidden=!e;
    q('.section-colors').hidden=!e||e.colors==='auto';q('[data-second-color]').hidden=e?.colors==='hold';
    const presets={calm:{rhythm:'none',movement:.35,colors:'hold'},balanced:{rhythm:'auto',movement:1,colors:'auto'},intense:{rhythm:'auto',movement:1.5,colors:'pair'}};
    for(const button of dialog.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed',String(Boolean(e)&&Object.entries(presets[button.dataset.preset]).every(([key,value])=>e[key]===value)));
    for(const input of dialog.querySelectorAll('.section-fields input,.section-fields select,[data-preset],[data-transfer],[data-split],[data-merge],[data-delete],[data-duplicate],[name=motif]'))input.disabled=!e;
    preview();seek(time);if(!e)return;
    for(const name of ['name','motif','start','end','rhythm','movement','colors','colorA','colorB'])field(name).value=e[name];
    
    q('[data-movement]').textContent=`${Math.round(e.movement*100)} %`;

    q('[data-merge]').disabled=selected===draft.length-1;

  }
  let gesture=null;
  form.addEventListener('change',event=>{
    if(!event.target.name)return;
    const old=gesture??structuredClone(draft),e=draft[selected];gesture=null;
    try{
      for(const name of ['name','motif','rhythm','colors','colorA','colorB'])e[name]=field(name).value;
      e.movement=Number(field('movement').value);
      if(event.target.name==='start')draft=editPhaseTime(draft,selected,'start',Number(field('start').value),plan,q('[data-snap]').value);
      if(event.target.name==='end')draft=editPhaseTime(draft,selected,'end',Number(field('end').value),plan,q('[data-snap]').value);
      draft=validateSectionEdits(draft,plan.duration);remember(old);message('Vorschau aktualisiert. Mit Speichern übernehmen.');render();
    }catch(error){draft=old;message(error.message);render();}
  });
  for(const name of ['movement','colorA','colorB'])field(name).oninput=()=>{
    if(saving||!draft[selected])return;gesture??=clone();
    draft[selected][name]=name==='movement'?Number(field(name).value):field(name).value;
    q('[data-movement]').textContent=`${Math.round(draft[selected].movement*100)} %`;preview();seek(time);
  };
  for(const b of dialog.querySelectorAll('[data-preset]'))b.onclick=()=>change(()=>{
    Object.assign(draft[selected],{calm:{rhythm:'none',movement:.35,colors:'hold'},balanced:{rhythm:'auto',movement:1,colors:'auto'},intense:{rhythm:'auto',movement:1.5,colors:'pair'}}[b.dataset.preset]);
  });
  q('[data-transfer]').onclick=()=>change(()=>{draft=transferMotif(draft,selected);message('Einstellungen auf die gleiche Motivgruppe übertragen.');});
  q('[data-position]').onclick=()=>seek(position());
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
  render();return {previewHost:q('[data-set-preview]'),getEdits:clone,setPosition:seek,destroy(){destroyed=true;cancelAnimationFrame(animation);if(audio){audio.pause();audio.removeAttribute('src');audio.load();}timeline.destroy();dialog.remove();}};
}
