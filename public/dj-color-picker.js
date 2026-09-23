import {COLOR_MODES,validColorMode} from './dj-color-modes.js';
const storageKey='anydj-custom-color-modes';
function customModes(){try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(data)?data.filter(validColorMode).slice(0,60):[];}catch{return [];}}
export function createColorPicker(name,onChange,{global=false}={}){
 const element=document.createElement('details');element.className='dj-color-picker';
 element.innerHTML=`<summary>${global?'Farbpalette':'Farbmodus'}: <span>Songanalyse</span></summary><div class="dj-color-menu">
 <p class="color-prerequisite small" role="status" hidden>Bitte zuerst einen Track in dieses Deck laden, um einen Farbmodus anzuwenden.</p>
 <label>Suche<input type="search" class="color-search" placeholder="Farbmodus suchen"></label>
 <label>Filter<select class="color-filter"><option value="">Alle Farben</option>${['Automatisch','Warm','Kühl','Bunt','Weiß','Eigene'].map(c=>`<option>${c}</option>`).join('')}</select></label>
 <select class="color-options" size="5" aria-label="Farbmodus auswählen"></select><p class="color-empty" hidden>Keine passenden Farbmodi.</p>
 <div class="color-swatches" aria-label="Palettenvorschau"></div>
 <button class="button primary color-apply" type="button">Übernehmen</button>
 <details class="color-custom"><summary>Eigene Palette hinzufügen</summary><label>Name<input class="color-name" maxlength="60" placeholder="Meine Farben"></label><div class="color-pair"><label>Farbe A<input type="color" value="#ff0080" class="color-a"></label><label>Farbe B<input type="color" value="#00e5ff" class="color-b"></label></div><button class="button secondary color-add" type="button">Hinzufügen und anwenden</button></details>
 <p class="small muted">Songanalyse nutzt die neue Farbdramaturgie. „Bisherige Farben (Vergleich)“ wechselt nur die Farben; Wiedergabe und Rhythmus bleiben gleich.</p>
 <p class="color-feedback small" role="status"></p></div>`;
 const q=s=>element.querySelector(s),list=q('.color-options'),search=q('.color-search'),filter=q('.color-filter');
 for(const control of [search,filter,list])control.setAttribute('aria-label',`${control===search?'Farbmodus suchen':control===filter?'Farbmodi filtern':'Farbmodus auswählen'} · ${global?name:`Deck ${name}`}`);
 if(global)q('.small.muted').textContent='Gilt für beide Decks und folgende Titel. Songfarben / Deck-Einstellungen nutzt die individuelle Farbwahl. Eigene Abschnittsfarben haben Vorrang.';
 let track=null,modes=[],busy=false;
 function preview(){
  const mode=modes.find(m=>m.id===list.value),swatches=q('.color-swatches');
  const colors=mode?.colors||[],signature=colors.join(',');
  if(swatches.dataset.colors===signature)return;
  swatches.dataset.colors=signature;
  swatches.replaceChildren(...colors.map(color=>{const chip=document.createElement('span');chip.style.backgroundColor=color;chip.title=color;return chip;}));
  if(!colors.length)swatches.textContent='Farben folgen der Songgestaltung.';
 }
 list.onchange=preview;
 function render(){
  modes=[...COLOR_MODES.map(m=>global&&m.id==='auto'?{...m,name:'Songfarben / Deck-Einstellungen'}:m),...customModes()];
  if(validColorMode(track?.colorMode)&&!modes.some(m=>m.id===track.colorMode.id))modes.push({...track.colorMode,category:'Eigene'});
  const term=search.value.trim().toLocaleLowerCase('de');
  const filtered=modes.filter(m=>(!filter.value||m.category===filter.value)&&`${m.name} ${m.category}`.toLocaleLowerCase('de').includes(term));
  const pending=list.value;
  if(JSON.stringify([...list.options].map(o=>[o.text,o.value]))!==JSON.stringify(filtered.map(m=>[m.name,m.id])))
   list.replaceChildren(...filtered.map(m=>new Option(m.name,m.id)));
  const selected=element.open&&filtered.some(m=>m.id===pending)?pending:track?.colorMode?.id||'auto';const next=filtered.some(m=>m.id===selected)?selected:(filtered[0]?.id||'');if(list.value!==next)list.value=next;
  q('.color-empty').hidden=filtered.length>0;q('.color-apply').disabled=busy||!track||!filtered.length;
  const label=track?.colorMode?.name||(global?'Songfarben / Deck-Einstellungen':'Songanalyse');if(q('summary span').textContent!==label)q('summary span').textContent=label;
  q('.color-prerequisite').hidden=Boolean(track);
  q('summary').title=`Farbmodus: ${track?.colorMode?.name||(global?'Songfarben / Deck-Einstellungen':'Songanalyse')}`;q('summary').removeAttribute('aria-disabled');
  q('.color-add').disabled=busy||!track;preview();
 }
 async function choose(mode){if(!track||busy)return;busy=true;render();q('.color-feedback').textContent='';
  try{await onChange(track,mode.id==='auto'?null:mode);element.open=false;}
  catch(error){q('.color-feedback').textContent=error.message;}
  finally{busy=false;render();}
 }
 search.oninput=filter.onchange=render;
 q('.color-apply').onclick=()=>{const mode=modes.find(m=>m.id===list.value);if(mode)void choose(mode);};
 list.ondblclick=()=>q('.color-apply').click();list.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();q('.color-apply').click();}};
 element.addEventListener('keydown',e=>{if(e.key==='Escape'){element.open=false;q('summary').focus();}});
 element.addEventListener('toggle',()=>{if(element.open){render();search.focus();}});
 q('.color-add').onclick=()=>{
  const title=q('.color-name').value.trim();if(!title){q('.color-feedback').textContent='Bitte einen Namen eingeben.';q('.color-name').focus();return;}
  const mode={id:crypto.randomUUID(),name:title,category:'Eigene',colors:[q('.color-a').value,q('.color-b').value]};
  try{const custom=customModes();if(custom.length>=60)throw Error('Maximal 60 eigene Farbmodi.');localStorage.setItem(storageKey,JSON.stringify([...custom,mode]));search.value='';filter.value='Eigene';render();void choose(mode);}
  catch(error){q('.color-feedback').textContent=`Speichern fehlgeschlagen: ${error.message}`;}
 };
 return {element,update(value){track=value;element.classList.toggle('is-empty',!track);render();}};
}
