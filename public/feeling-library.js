import {DEFAULT_FEELINGS,FEELING_PROFILES,normalizeCatalog,feelingIds,automaticFeelingIds} from './feeling-tags.js';
import {readFeelingCatalog,saveFeelingCatalog,saveTrack} from './dj-library.js';
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
export function createFeelingLibrary({changed,notice}){
 let catalog=DEFAULT_FEELINGS.map(t=>({...t})),selected=[];
 try{const saved=JSON.parse(localStorage.getItem('anydj-feeling-filter')||'[]');if(Array.isArray(saved))selected=saved.filter(id=>typeof id==='string');}catch{}
 const popover=document.getElementById('libraryFilterPopover');
 const group=element('fieldset',null,'feeling-filter'),legend=element('legend','Gefühl'),choices=element('div',null,'feeling-choices');
 const help=element('p','Mehrere auswählen: Zeigt Titel mit mindestens einem dieser Gefühle.','small muted');
 const reset=element('button','Alle Gefühle','button secondary');reset.type='button';
 group.append(legend,choices,help,reset);popover.append(group);
 const manage=element('details'),summary=element('summary','Gefühlskatalog erweitern');manage.append(summary);
 const form=element('form'),nameLabel=element('label','Neues Gefühl'),input=element('input');input.required=true;input.maxLength=40;input.placeholder='z. B. Verträumt';nameLabel.append(input);
 const profileLabel=element('label','Automatische Zuordnung'),profile=element('select');
 profile.append(new Option('Nur manuell zuordnen',''));
 for(const [id,label] of Object.entries(FEELING_PROFILES))profile.append(new Option('Ähnlich wie „'+label+'“',id));
 profileLabel.append(profile);const add=element('button','Gefühl hinzufügen','button secondary');add.type='submit';
 const status=element('p',null,'small muted');status.setAttribute('role','status');
 form.append(nameLabel,profileLabel,add,status);manage.append(form);popover.append(manage);
 const update=()=>{
  choices.replaceChildren();
  for(const tag of catalog){const label=element('label'),check=element('input');check.type='checkbox';check.value=tag.id;check.checked=selected.includes(tag.id);check.onchange=()=>{selected=check.checked?[...selected,tag.id]:selected.filter(id=>id!==tag.id);saveFilter();changed();};label.append(check,document.createTextNode(tag.label));choices.append(label);}
 };
 const saveFilter=()=>{try{localStorage.setItem('anydj-feeling-filter',JSON.stringify(selected));}catch{}popover.dispatchEvent(new Event('change',{bubbles:true}));};
 reset.onclick=()=>{selected=[];saveFilter();update();changed();};
 form.onsubmit=async event=>{
  event.preventDefault();const label=input.value.trim();if(!label)return;
  if(catalog.some(t=>t.label.toLocaleLowerCase()===label.toLocaleLowerCase())){status.textContent='Dieses Gefühl ist schon vorhanden.';return;}
  const next=[...catalog,{id:crypto.randomUUID(),label,profile:profile.value}];add.disabled=true;
  try{await saveFeelingCatalog(next);catalog=next;input.value='';status.textContent='Gefühl hinzugefügt.';update();changed();}catch{status.textContent='Gefühl konnte nicht gespeichert werden.';}finally{add.disabled=false;}
 };
 update();
 return {
  get catalog(){return catalog;},get selected(){return selected;},
  async load(){try{catalog=normalizeCatalog(await readFeelingCatalog());selected=selected.filter(id=>catalog.some(t=>t.id===id));update();saveFilter();}catch{notice('Gefühlskatalog kann derzeit nicht geladen werden.',true);}},
  badges(track){
   const wrap=element('div',null,'feeling-badges'),ids=new Set(feelingIds(track,catalog));
   for(const tag of catalog)if(ids.has(tag.id)){const badge=element('span',tag.label);badge.title=(track.feelingAdded||[]).includes(tag.id)?'Manuell zugeordnet':track.feelingAnalysis?.source==='desktop'?'Vorschlag mit Desktopanalyse':'Vorschlag aus einfacher Browseranalyse';wrap.append(badge);}
   return wrap;
  },
  edit(track){
   const dialog=element('dialog',null,'feeling-dialog'),title=element('h2','Gefühle bearbeiten'),subtitle=element('p',track.name),list=element('div',null,'feeling-choices');
   title.id='feelingEditorTitle';dialog.setAttribute('aria-labelledby',title.id);
   const auto=new Set(automaticFeelingIds(track,catalog)),current=new Set(feelingIds(track,catalog)),checks=[];
   const hint=element('p',track.feelingAnalysis?track.feelingAnalysis.source==='desktop'?'Vorschläge mit Desktopanalyse. Änderungen bleiben bei erneuter Analyse erhalten.':'Einfache Browseranalyse: grobe Vorschläge. Änderungen bleiben bei erneuter Analyse erhalten.':'Noch keine Analyse vorhanden. Du kannst Gefühle manuell zuordnen.','small muted');
   for(const tag of catalog){const label=element('label'),check=element('input');check.type='checkbox';check.checked=current.has(tag.id);check.value=tag.id;label.append(check,document.createTextNode(tag.label+(auto.has(tag.id)?' · Vorschlag':'')));list.append(label);checks.push(check);}
   const actions=element('div',null,'feeling-actions'),save=element('button','Speichern','button primary'),cancel=element('button','Abbrechen','button secondary'),restore=element('button','Automatische Vorschläge verwenden','button secondary'),error=element('p',null,'small');error.setAttribute('role','status');
   let useAutomatic=false;
   restore.onclick=()=>{useAutomatic=true;for(const check of checks)check.checked=auto.has(check.value);};
   cancel.onclick=()=>dialog.close();
   save.onclick=async()=>{
    const added=new Set(useAutomatic?[]:track.feelingAdded||[]),excluded=new Set(useAutomatic?[]:track.feelingExcluded||[]);
    const baseline=useAutomatic?auto:current;
    for(const check of checks)if(check.checked!==baseline.has(check.value)){if(check.checked){added.add(check.value);excluded.delete(check.value);}else{added.delete(check.value);excluded.add(check.value);}}
    const previous={feelingAdded:track.feelingAdded,feelingExcluded:track.feelingExcluded};
    track.feelingAdded=[...added];track.feelingExcluded=[...excluded];save.disabled=true;
    try{await saveTrack(track);dialog.close();changed();}catch{Object.assign(track,previous);error.textContent='Änderungen konnten nicht gespeichert werden.';save.disabled=false;}
   };
   actions.append(save,cancel);dialog.append(title,subtitle,hint,list,restore,error,actions);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  }
 };
}
