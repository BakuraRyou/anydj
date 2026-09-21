import {sectionEditsFor,validateSectionEdits,transferMotif,snapSectionTime,applySectionLighting} from './section-lighting.js';
export function openSectionEditor({track,plan,position=()=>0,onSave}) {
  const dialog=document.createElement('dialog');dialog.className='section-editor';
  dialog.innerHTML=`<form><header><h2>Abschnittslicht</h2><button type="button" data-close aria-label="Schließen">×</button></header>
  <p class="section-track"></p><p class="small muted">Analyse-Vorschläge: Grenzen und Motivgruppen sind bearbeitbar. Gleiche Gruppe bedeutet dieselbe Lichtidee, keine bestätigte Motiverkennung.</p>
  <nav class="section-timeline" aria-label="Songabschnitte"></nav><canvas width="800" height="44" aria-label="Vorschau der bearbeiteten Lichtshow"></canvas>
  <div class="section-fields"><label>Name<input name="name" maxlength="80"></label><label>Motivgruppe<input name="motif" maxlength="80"></label>
  <label>Beginn (Sekunden)<input name="start" type="number" min="0" step="any"></label><label>Ende (Sekunden)<input name="end" type="number" min="0" step="any"></label>
  <label>Akzente<select name="rhythm"><option value="auto">Alle erkannten Akzente</option><option value="bars">Nur erkannte Taktanfänge</option><option value="strong">Nur starke Akzente</option><option value="none">Keine rhythmischen Akzente</option></select></label>
  <label>Bewegungsstärke <output data-movement></output><input name="movement" type="range" min="0" max="1.6" step="0.05"></label>
  <label>Farbverhalten<select name="colors"><option value="auto">Songanalyse</option><option value="hold">Eine Farbe halten</option><option value="pair">Zwei Farben auf Akzenten</option><option value="cycle">Vier Farben auf Akzenten</option></select></label>
  <div class="section-colors"><label>Farbe A<input name="colorA" type="color"></label><label>Farbe B<input name="colorB" type="color"></label></div></div>
  <div class="section-actions"><button type="button" data-preset="calm">Ruhig</button><button type="button" data-preset="balanced">Ausgewogen</button><button type="button" data-preset="intense">Intensiv</button><button type="button" data-transfer>Auf gleiche Motivgruppe übertragen</button></div>
  <div class="section-actions"><label>Teilung bei Sekunde<input data-split-time type="number" min="0" step="any"></label><button type="button" data-position>Abspielposition einsetzen</button><button type="button" data-split>Am nächsten Beat teilen</button><button type="button" data-merge>Mit nächstem Abschnitt verbinden</button></div>
  <p class="section-feedback" role="status"></p><footer><button type="button" data-reset>Analyse-Einteilung zurücksetzen</button><button type="button" data-close>Abbrechen</button><button type="submit" class="button primary">Speichern und anwenden</button></footer></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),q=s=>dialog.querySelector(s),field=n=>form.elements.namedItem(n);
  q('.section-track').textContent=track.name;
  let draft=structuredClone(track.sectionEdits?.length?track.sectionEdits:sectionEditsFor(plan)),selected=0;
  const message=text=>{q('.section-feedback').textContent=text;};
  const preview=()=>{
    const rendered=applySectionLighting(plan,draft),canvas=q('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let x=0;x<canvas.width;x++){const f=rendered.frames[Math.min(rendered.frames.length-1,Math.floor(x/canvas.width*rendered.frames.length))];ctx.fillStyle=`rgb(${f.r},${f.g},${f.b})`;ctx.fillRect(x,44-f.dimming*.44,1,f.dimming*.44);}
  };
  function render(){
    const e=draft[selected];if(!e)return;
    for(const name of ['name','motif','start','end','rhythm','movement','colors','colorA','colorB'])field(name).value=e[name];
    field('start').disabled=selected===0;field('end').disabled=selected===draft.length-1;
    q('[data-movement]').textContent=`${Math.round(e.movement*100)} %`;
    q('[data-split-time]').value=((e.start+e.end)/2).toFixed(2);
    q('[data-merge]').disabled=selected===draft.length-1;
    const timeline=q('.section-timeline');timeline.replaceChildren();
    draft.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${s.name} · ${s.start.toFixed(1)}–${s.end.toFixed(1)} s`;b.style.flexGrow=s.end-s.start;b.setAttribute('aria-pressed',String(i===selected));b.onclick=()=>{selected=i;message('');render();};timeline.append(b);});
    preview();
  }
  form.addEventListener('change',event=>{
    if(!event.target.name)return;
    const old=structuredClone(draft),e=draft[selected];
    try{
      for(const name of ['name','motif','rhythm','colors','colorA','colorB'])e[name]=field(name).value;
      e.movement=Number(field('movement').value);
      if(event.target.name==='start'&&selected>0){e.start=snapSectionTime(plan,Number(field('start').value));draft[selected-1].end=e.start;}
      if(event.target.name==='end'&&selected<draft.length-1){e.end=snapSectionTime(plan,Number(field('end').value));draft[selected+1].start=e.end;}
      draft=validateSectionEdits(draft,plan.duration);message('Vorschau aktualisiert. Mit Speichern übernehmen.');render();
    }catch(error){draft=old;message(error.message);render();}
  });
  field('movement').oninput=()=>{q('[data-movement]').textContent=`${Math.round(Number(field('movement').value)*100)} %`;};
  for(const b of dialog.querySelectorAll('[data-preset]'))b.onclick=()=>{
    Object.assign(draft[selected],{calm:{rhythm:'none',movement:.35,colors:'hold'},balanced:{rhythm:'auto',movement:1,colors:'auto'},intense:{rhythm:'auto',movement:1.5,colors:'pair'}}[b.dataset.preset]);render();
  };
  q('[data-transfer]').onclick=()=>{try{draft=transferMotif(draft,selected);message('Einstellungen auf die gleiche Motivgruppe übertragen.');render();}catch(e){message(e.message);}};
  q('[data-position]').onclick=()=>{q('[data-split-time]').value=position().toFixed(2);};
  q('[data-split]').onclick=()=>{
    const e=draft[selected],time=snapSectionTime(plan,Number(q('[data-split-time]').value));
    if(time<=e.start+.1||time>=e.end-.1){message('Teilung muss innerhalb des Abschnitts liegen.');return;}
    draft.splice(selected,1,{...e,end:time},{...e,id:crypto.randomUUID(),start:time});selected++;render();
  };
  q('[data-merge]').onclick=()=>{if(selected+1<draft.length){draft[selected].end=draft[selected+1].end;draft.splice(selected+1,1);render();}};
  q('[data-reset]').onclick=()=>{draft=sectionEditsFor(plan);selected=0;message('Analyse-Einteilung wiederhergestellt. Noch nicht gespeichert.');render();};
  for(const b of dialog.querySelectorAll('[data-close]'))b.onclick=()=>dialog.close();
  dialog.onclose=()=>dialog.remove();
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
    try{await onSave(validateSectionEdits(draft,plan.duration));dialog.close();}
    catch(error){message(`Speichern fehlgeschlagen: ${error.message}`);button.disabled=false;}
  };
  render();dialog.showModal();
}
