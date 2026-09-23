// A transient, keyboard-accessible picker. All names are inserted as text.
export function openTransitionLinks({from,getTracks,getVariants,problem,onEdit,onUse,onDelete,onRelink}){
 const dialog=document.createElement('dialog');dialog.className='transition-links';dialog.setAttribute('aria-label','Gespeicherte Übergänge');
 dialog.innerHTML='<header><h2>Was soll danach laufen?</h2><button data-close class="button secondary" aria-label="Übergänge schließen">Schließen</button></header><p data-source class="links-source"></p><p data-intro>Wähle einen Titel mit gespeichertem Übergang. Er wird direkt danach eingeplant.</p><section data-saved><label class="links-search">Gespeicherte Übergänge durchsuchen<input type="search" data-search placeholder="Titel suchen …"></label><div data-list></div><button data-new class="button secondary links-new">+ Anderen Titel verknüpfen</button></section><section data-create hidden><button data-back class="button secondary">← Zurück</button><h3>Mit welchem Titel möchtest du überblenden?</h3><p>Wähle einen Titel. Anschließend kannst du den vorgeschlagenen Übergang anhören, anpassen und speichern.</p><label>Titel suchen<input type="search" data-new-search placeholder="Name des nächsten Titels …"></label><div data-targets></div></section><p data-status role="status"></p><footer class="links-footer"><span>Die laufende Musik spielt weiter.</span><button data-refresh type="button">Aktualisieren</button></footer>';
 const q=s=>dialog.querySelector(s),focus=document.activeElement;document.body.append(dialog);q('[data-source]').textContent='Nach: '+from.name;if(!onUse){q('h2').textContent='Übergänge für diesen Titel';q('[data-intro]').textContent='Öffne einen gespeicherten Übergang oder verknüpfe einen weiteren Titel.';}
 const action=(label,fn,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className='button secondary';b.textContent=label;b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){q('[data-status]').textContent=e.message;}finally{if(b.isConnected)b.disabled=disabled;}};return b;};
 if(!from.file&&!from.handle||from.missing)q('[data-source]').after(action('Quelltitel verbinden',()=>onRelink(from)));
 function edit(to,variant){dialog.close();void onEdit(to,variant);}
 function render(){
  const tracks=getTracks(),query=q('[data-search]').value.toLocaleLowerCase();q('[data-list]').replaceChildren();
  for(const v of getVariants().filter(v=>v.fromTrackId===from.id&&`${v.name} ${v.toName}`.toLocaleLowerCase().includes(query))){
   const to=tracks.find(t=>t.id===v.toTrackId),issue=problem(v,from,to),row=document.createElement('article'),title=document.createElement('strong'),status=document.createElement('p'),buttons=document.createElement('div');
   title.textContent=to?.name||v.toName;status.textContent=issue||`${v.name} · ${v.plan.duration.toFixed(1)} Sekunden`;
   const more=document.createElement('details');more.className='links-more';const summary=document.createElement('summary');summary.textContent='Details & Bearbeiten';more.append(summary);
   const metadata=document.createElement('p');metadata.textContent=`${v.name} · ${{smooth:'Sanft',bass:'Bassübergabe',handover:'Kurze Überlagerung',cut:'Kurzer Wechsel'}[v.plan.style]} · Tempo ${Math.round(v.rateA*100)} / ${Math.round(v.rateB*100)} %`;more.append(metadata);
   const editButton=action('Bearbeiten & probehören',()=>edit(to,v),!to?.plan||!from.plan||to.missing||from.missing);
   if(onUse){
    const choose=action('Als nächsten Titel wählen',async()=>{
     if(!onUse.exists(to?.id)){await onUse.apply(v,'copy');dialog.close();return;}
     choices.hidden=false;choose.hidden=true;choices.querySelector('button').focus();
    },Boolean(issue));choose.className='button primary';buttons.append(choose);
    const choices=document.createElement('div');choices.className='links-duplicate';choices.hidden=true;
    const hint=document.createElement('p');hint.textContent='Dieser Titel steht bereits in der Warteschlange.';
    choices.append(hint,action('Vorhandenen Eintrag hierher verschieben',async()=>{await onUse.apply(v,'move');dialog.close();}),action('Zusätzlich einfügen',async()=>{await onUse.apply(v,'copy');dialog.close();}),action('Abbrechen',()=>{choices.hidden=true;choose.hidden=false;choose.focus();}));buttons.append(choices);more.append(editButton);
   }else{editButton.className='button primary';buttons.append(editButton);}
   if(to&&(!to.file&&!to.handle||to.missing))buttons.append(action('Datei verbinden',()=>onRelink(to)));
   more.append(action('Variante löschen',async()=>{await onDelete(v);render();}));row.append(title,status,buttons,more);q('[data-list]').append(row);
  }
  if(!q('[data-list]').children.length){const empty=document.createElement('p');empty.className='links-empty';empty.textContent=query?'Kein passender Übergang gefunden.':'Für diesen Titel hast du noch keinen Übergang gespeichert. Verknüpfe zuerst den Titel, der danach laufen soll.';q('[data-list]').append(empty);}q('[data-search]').closest('label').hidden=!getVariants().some(v=>v.fromTrackId===from.id);
 }
 function targets(){const query=q('[data-new-search]').value.toLocaleLowerCase();q('[data-targets]').replaceChildren();const all=getTracks().filter(t=>!t.deleted&&t.id!==from.id&&t.name.toLocaleLowerCase().includes(query));for(const t of all.slice(0,50))q('[data-targets]').append(action(t.name,()=>edit(t),!t.plan||t.missing||t.pendingChange||!from.plan));if(!all.length){const hint=document.createElement('p');hint.textContent=query?'Kein Titel gefunden.':'Lade zuerst einen weiteren lokalen Titel in deine Bibliothek.';q('[data-targets]').append(hint);}if(all.length>50){const hint=document.createElement('p');hint.textContent='Weitere Titel über die Suche eingrenzen.';q('[data-targets]').append(hint);}}
 q('[data-new]').onclick=()=>{q('[data-saved]').hidden=true;q('[data-create]').hidden=false;q('[data-intro]').hidden=true;targets();q('[data-new-search]').focus();};q('[data-back]').onclick=()=>{q('[data-saved]').hidden=false;q('[data-create]').hidden=true;q('[data-intro]').hidden=false;q('[data-new]').focus();};
 q('[data-refresh]').onclick=()=>{render();targets();};q('[data-search]').oninput=render;q('[data-new-search]').oninput=targets;q('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();if(!document.querySelector('dialog[open]')&&focus?.isConnected)focus.focus();},{once:true});
 render();targets();dialog.showModal();(q('[data-search]').closest('label').hidden?q('[data-new]'):q('[data-search]')).focus();
}
