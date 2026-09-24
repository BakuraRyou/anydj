import {createTransitionTimeline} from './transition-timeline.js';
import {createTransitionCurveEditor} from './transition-curve-editor.js';
import {transitionAudioGains,scheduleTransitionGain} from './transition-audio.js';
import {transitionBassDb} from './musical-transition.js';
import {formatTime} from './dj-model.js';

export function editTransitionPlan(pair,{time,cue,duration,style}){
 const labels={smooth:'Sanfter Übergang',bass:'Bassübergabe',handover:'Kurze Überlagerung',cut:'Kurzer Wechsel'};
 if(![time,cue,duration].every(Number.isFinite)||time<0||cue<0||duration<.1||duration>60||!Object.hasOwn(labels,style))throw Error('Gültige Zeiten und eine Dauer zwischen 0,1 und 60 Sekunden eingeben.');
 const remaining=Math.min((pair.from.duration-time)/pair.from.rate,(pair.to.duration-cue)/pair.to.rate);
 if(!Number.isFinite(remaining)||duration>remaining+.001)throw Error('Der Übergang reicht über das Ende eines Titels. Start, Einstieg oder Dauer anpassen.');
 return {...pair.plan,time,cue,duration,style,label:labels[style],kind:'time',manual:true,audioProfile:null,points:style===pair.plan.style?pair.plan.points:null,reason:'Manuell gewählte Zeitpunkte und Übergangsart.'};
}

// Keep analyzed candidates; offer explicit templates when analysis supplies fewer styles.
export function transitionProposals(pair){
 if(!pair)return [];
 const plans=pair.plan.alternatives?.length?[...pair.plan.alternatives]:[pair.plan];
 if(!plans.some(p=>p.time===pair.plan.time&&p.cue===pair.plan.cue&&p.style===pair.plan.style&&p.duration===pair.plan.duration))plans.unshift(pair.plan);
 const remaining=Math.min((pair.from.duration-pair.plan.time)/pair.from.rate,(pair.to.duration-pair.plan.cue)/pair.to.rate,60);
 for(const style of ['smooth','bass','handover','cut']){
  if(plans.some(p=>p.style===style))continue;
  const duration=Math.min(remaining,style==='cut'?1:style==='handover'?4:Math.max(8,pair.plan.duration));
  if(!Number.isFinite(duration)||duration<.1)continue;
  const plan=editTransitionPlan(pair,{time:pair.plan.time,cue:pair.plan.cue,duration,style});
  plans.push({...plan,points:null,alternatives:undefined,template:true,reason:'Vorlage an den gewählten Stellen · nach Wunsch bearbeiten.'});
 }
 return plans;
}

// Own media elements and context: rehearsal never seeks or starts either deck.
export function createTransitionPreview({host,getPair,onChoose,routing,getUnavailableReason=()=>'Zwei analysierte lokale Titel in Deck A und B laden.'}){
 const button=document.createElement('button');button.type='button';button.className='button secondary transition-preview-open';button.textContent='Bearbeiten & probehören';button.setAttribute('aria-label','Übergang bearbeiten und probehören');host.querySelector('h2')?.after(button);if(!button.parentNode)host.prepend(button);
 const dialog=document.createElement('dialog');dialog.className='dj-transition-preview';
 dialog.innerHTML=`<form method="dialog"><button class="button secondary" aria-label="Vorschau schließen">Schließen</button></form><h2>Übergang bearbeiten</h2><label>Richtung<select data-direction><option value="auto">Aktuelles Deck → nächstes Deck</option><option value="0">Deck A → Deck B</option><option value="1">Deck B → Deck A</option></select></label><p data-tracks></p><label>Vorschlag <select data-alternative aria-label="Übergangsvariante"></select></label><fieldset class="preview-edit"><legend>Übergang anpassen</legend><label>Ausgehender Titel · Wechsel ab (s)<input data-edit-time type="number" min="0" step="0.1" required></label><label>Nächster Titel · Einstieg bei (s)<input data-edit-cue type="number" min="0" step="0.1" required></label><label>Überblenddauer (s)<input data-edit-duration type="number" min="0.1" max="60" step="0.1" required></label><label>Übergangsart<select data-edit-style><option value="smooth">Sanft überblenden</option><option value="bass">Bassübergabe</option><option value="handover">Kurze Überlagerung</option><option value="cut">Kurzer Wechsel</option></select></label></fieldset><p data-edit-status role="status"></p><label class="small"><input type="checkbox" data-remember> Ähnliche Übergänge künftig leicht bevorzugen</label><button data-choose class="button secondary">Übergang übernehmen</button><p data-timing></p><p data-reason></p><svg viewBox="0 0 500 140" role="img" aria-label="Lautstärkeverlauf: alter Titel wird leiser, neuer Titel lauter"><path d="M20 10V115H480" fill="none" stroke="#526471"/><path data-out fill="none" stroke="#f7ad76" stroke-width="3"/><path data-in fill="none" stroke="#79ced8" stroke-width="3"/><line data-cursor x1="20" x2="20" y1="10" y2="115" stroke="white"/><text x="20" y="135" fill="currentColor">Start</text><text x="445" y="135" fill="currentColor">Ende</text></svg><p class="small">Orange: ausgehender Titel · Türkis: nächster Titel</p><p data-bass class="small"></p><label>Verlauf erkunden <input data-position type="range" min="0" max="100" value="0" step="1"></label><p data-position-label class="small"></p><p class="small">Hörprobe ausschließlich über den gewählten Kopfhörerausgang. Die laufenden Decks spielen unverändert weiter. Sie beginnt bis zu zwei Sekunden vor dem geplanten Übergang und endet zwei Sekunden danach. Deck-EQ und Kanalpegel werden übernommen.</p><div class="preview-actions"><button data-play class="button primary">Hörprobe starten</button><button data-refresh class="button secondary">Paar neu laden</button><button data-stop class="button secondary" disabled>Stoppen</button><label>Probelautstärke <input data-volume type="range" min="0" max="1" step="0.01" value="0.5"></label></div><p data-status role="status"></p>`;
 document.body.append(dialog);const q=s=>dialog.querySelector(s);
 dialog.setAttribute('aria-label','Übergang bearbeiten und probehören');
 const actions=q('.preview-actions');
 const header=document.createElement('header');header.className='preview-header';header.append(q('h2'),q('form'));dialog.prepend(header);
 const workspace=document.createElement('div');workspace.className='preview-workspace';
 const settings=document.createElement('section');settings.className='preview-settings';settings.setAttribute('aria-label','Übergang einstellen');
 const canvas=document.createElement('section');canvas.className='preview-visual';canvas.setAttribute('aria-label','Lautstärkeverlauf bearbeiten');
 const details=document.createElement('details');details.className='preview-details';details.innerHTML='<summary>Weitere Optionen & Erklärung</summary>';
 settings.append(q('[data-direction]').closest('label'),q('[data-alternative]').closest('label'),q('.preview-edit'));
 details.append(q('[data-remember]').closest('label'),q('[data-reason]'),q('[data-bass]'),q('[data-refresh]'));
 const libraryFields=document.createElement('div');libraryFields.className='preview-library-fields';libraryFields.innerHTML='<label><input type="checkbox" data-save-reusable> In Übergangsbibliothek speichern</label><label>Variantenname<input data-variant-name maxlength="80" placeholder="Zum Beispiel: Langer Aufbau"></label>';settings.append(libraryFields);
 const svg=q('svg');canvas.append(svg);
 workspace.append(settings,canvas);q('[data-tracks]').after(workspace);
 const notes=[...dialog.children].filter(n=>n.matches('p.small'));
 canvas.append(q('[data-position]').closest('label'),q('[data-position-label]'));
 notes.forEach(n=>details.append(n));
 workspace.after(q('[data-timing]'),details,q('[data-edit-status]'),actions,q('[data-status]'));
 actions.append(q('[data-choose]'));q('[data-choose]').className='button primary';q('[data-play]').className='button secondary';
 q('[data-position]').closest('label').hidden=false;
 q('[data-edit-time]').closest('label').firstChild.textContent='Wechsel beginnt bei (Sekunden)';
 q('[data-edit-cue]').closest('label').firstChild.textContent='Nächster Titel startet bei (Sekunden)';
 const keys=document.createElement('p');keys.className='preview-key-hint';keys.textContent='Leertaste: Hörprobe starten / stoppen · Strg/⌘ + Enter: übernehmen · Esc: schließen';details.after(keys);
 const curveEditor=createTransitionCurveEditor(svg,{onInspect:value=>{if(!job)position(value);},onChange:points=>{
  if(!pair||!valid)return;stop('');pair.plan={...pair.plan,points,manual:true,audioProfile:null,label:points?'Eigene Übergangskurve':'Vorlagenkurve',reason:points?'Lautstärkeverläufe mit eigenen Punkten.':'Lautstärkekurve der gewählten Übergangsart.'};
  q('[data-edit-status]').textContent='Kurve geändert · probehören und übernehmen.';render();
 }});
 canvas.append(q('[data-position-label]'));

 // Start with a usable proposal; reveal precision tools only when requested.
 const intro=document.createElement('p');intro.className='preview-intro';intro.textContent='Wähle einen Übergang, höre ihn an und übernimm ihn für diese beiden Titel.';header.after(intro);
 const basic=document.createElement('section');basic.className='preview-basic';basic.setAttribute('aria-label','Übergang wählen');
 basic.append(q('[data-edit-style]').closest('label'),q('[data-edit-duration]').closest('label'));
 const timelineHost=document.createElement('section');basic.append(timelineHost);
 const timeline=createTransitionTimeline(timelineHost,{onChange:(key,value)=>{if(!pair||!valid)return;syncFields();q('[data-edit-'+key+']').value=String(value);q('[data-edit-'+key+']').dataset.displayValue='';edit();syncFields();}});
 const advanced=document.createElement('section');advanced.className='preview-advanced';advanced.setAttribute('aria-label','Lautstärkekurve anpassen');advanced.innerHTML='<h4>Lautstärkekurve selbst zeichnen</h4>';
 workspace.before(basic,advanced);advanced.append(workspace);settings.prepend(q('[data-direction]').closest('label'));
 q('.preview-edit legend').textContent='Zeitpunkte in den Titeln';
 details.prepend(q('[data-alternative]').closest('label'));details.append(q('[data-volume]').closest('label'));
 const savedDetails=document.createElement('details');savedDetails.className='preview-save';savedDetails.innerHTML='<summary>Für später speichern</summary>';savedDetails.append(libraryFields);advanced.after(savedDetails);
 q('[data-variant-name]').closest('label').hidden=true;
 q('[data-save-reusable]').onchange=()=>{q('[data-variant-name]').closest('label').hidden=!q('[data-save-reusable]').checked;};
 q('[data-stop]').hidden=true;
 keys.textContent='Leertaste: Hörprobe · Strg/⌘ + Enter: übernehmen';

 let suppliedPair=null;
 let pair=null,job=null,version=0,alternatives=[],valid=true,selectedAlternative=0;
 const alternativeDrafts=new Map(),cards=[];
 const routingAnchor=document.createComment('Audioausgänge');
 routing?.routingHost?.before(routingAnchor);
 const outputStatus=document.createElement('p');outputStatus.setAttribute('role','status');outputStatus.dataset.previewOutput='';actions.before(outputStatus);
 const configure=document.createElement('button');configure.type='button';configure.className='button secondary preview-configure';configure.textContent='Audioausgabe wählen';configure.hidden=!routing?.routingHost;outputStatus.after(configure);
 configure.onclick=()=>{if(!routing?.routingHost)return;routing.routingHost.hidden=false;routing.routingHost.open=true;routing.routingHost.scrollIntoView({block:'nearest',behavior:'smooth'});routing.routingHost.querySelector('summary')?.focus();};
 const main=document.createElement('section');main.className='preview-step-page';main.setAttribute('aria-label','Übergänge vergleichen und anpassen');
 intro.after(q('[data-tracks]'));q('[data-tracks]').after(main);
 const exact=document.createElement('details');exact.className='preview-exact';exact.innerHTML='<summary>Zeitpunkte als Zahlen eingeben</summary>';exact.append(q('[data-direction]').closest('label'),q('.preview-edit'));

 const proposals=document.createElement('section');proposals.className='preview-proposals';proposals.innerHTML='<h3>Welcher Übergang passt?</h3><p>Höre die Varianten im Vergleich. Bei Bedarf kannst du jede direkt anpassen.</p><div data-proposal-cards></div>';
 q('[data-alternative]').closest('label').hidden=true;
 main.append(proposals);
 const editPlaces=document.createElement('button');editPlaces.type='button';editPlaces.className='button secondary';editPlaces.dataset.editPlaces='';editPlaces.textContent='Startstellen anpassen';editPlaces.onclick=()=>{const expanded=timelineHost.hidden;timelineHost.hidden=!expanded;exact.hidden=!expanded;editPlaces.setAttribute('aria-expanded',String(expanded));};editPlaces.setAttribute('aria-expanded','false');
 const proposalEditor=document.createElement('div');proposalEditor.className='proposal-editor';proposalEditor.hidden=true;
 const closeEditor=document.createElement('button');closeEditor.type='button';closeEditor.className='button secondary';closeEditor.textContent='Fertig';closeEditor.onclick=()=>{const card=proposalEditor.closest('article');proposalEditor.hidden=true;card?.removeAttribute('data-editing');card?.querySelector('[data-proposal-edit]')?.focus();};
 proposalEditor.append(basic,editPlaces,timelineHost,exact,advanced,details,closeEditor);timelineHost.hidden=exact.hidden=true;main.append(proposalEditor);
 const audition=document.createElement('div');audition.className='preview-audition';audition.append(q('[data-play]'),q('[data-stop]'));
 details.append(q('[data-timing]'));main.append(savedDetails);actions.prepend(audition);actions.after(keys);
 q('[data-edit-style]').closest('label').hidden=true;
 basic.setAttribute('aria-label','Dauer anpassen');

 const outputBar=document.createElement('div');outputBar.className='preview-output-bar';outputBar.append(outputStatus,configure);main.before(outputBar);
 outputBar.after(q('[data-status]'));
 function resetView(){
  intro.textContent='Anhören, bei Bedarf anpassen und übernehmen. Dein Live-Mix läuft weiter.';
  proposals.querySelector('[data-proposal-cards]').after(q('[data-status]'));
  dialog.scrollTop=0;
 }
 const output=()=>routing?.getPreviewOutput?.();
 const updateOutput=()=>{
  const device=output();outputStatus.textContent=device?'Hörprobe → '+(device.label||'Kopfhörer'):'Zum Anhören zuerst Kopfhörer einrichten. Du kannst den Übergang auch direkt übernehmen.';
  updateProposals();
  configure.hidden=!routing?.routingHost;
  configure.textContent=device?'Audioausgabe ändern':'Audioausgabe wählen';
  q('[data-play]').disabled=!pair||!valid||!device||Boolean(job);
 };
 function buildProposals(){
  proposalEditor.hidden=true;main.append(proposalEditor);cards.length=0;proposals.querySelector('[data-proposal-cards]').replaceChildren();proposals.hidden=!pair;
  alternatives.forEach((plan,index)=>{
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),reason=document.createElement('p'),chart=document.createElementNS('http://www.w3.org/2000/svg','svg');
   chart.setAttribute('viewBox','0 0 200 56');chart.setAttribute('aria-hidden','true');
   const paths=[0,1].map(channel=>{const path=document.createElementNS(chart.namespaceURI,'path');path.setAttribute('fill','none');path.setAttribute('stroke',channel?'#79ced8':'#f7ad76');path.setAttribute('stroke-width','3');chart.append(path);return path;});
   const controls=document.createElement('div'),choose=document.createElement('button'),listen=document.createElement('button'),editButton=document.createElement('button');
   editButton.type='button';editButton.className='button secondary';editButton.dataset.proposalEdit=index;editButton.textContent='Anpassen';
   editButton.onclick=()=>{selectProposal(index);stop('');proposals.querySelectorAll('[data-editing]').forEach(node=>node.removeAttribute('data-editing'));card.dataset.editing='true';card.append(proposalEditor);proposalEditor.hidden=false;timelineHost.hidden=exact.hidden=true;editPlaces.setAttribute('aria-expanded','false');q('[data-edit-duration]').focus({preventScroll:true});};
   choose.type=listen.type='button';choose.className=listen.className='button secondary';choose.dataset.proposalChoose=index;listen.dataset.proposalListen=index;
   choose.onclick=()=>selectProposal(index);
   listen.onclick=()=>{if(selectedAlternative===index&&job){stop();return;}selectProposal(index);if(!valid)return;if(!output()){updateOutput();configure.click();return;}void play();};
   choose.hidden=true;controls.append(choose,listen,editButton);const overview=document.createElement('div');overview.className='proposal-overview';overview.append(title,info,reason);card.append(overview,chart,controls);controls.className='proposal-controls';proposals.querySelector('[data-proposal-cards]').append(card);cards.push({card,title,info,reason,paths,choose,listen});
  });updateProposals();
 }
 function updateProposals(){
  cards.forEach(({card,title,info,reason,paths,choose,listen},index)=>{
   const active=index===selectedAlternative,p=active?pair?.plan:alternativeDrafts.get(index)||alternatives[index];if(!p)return;
   title.textContent=(p.template?'Vorlage · ':index===0&&!p.manual?'Empfehlung · ':'')+(p.label||'Übergang');
   info.textContent=`${p.duration.toFixed(1)} s · ${formatTime(p.time)} → ${formatTime(p.cue)}`;
   reason.textContent=({smooth:'Gleichmäßige Überblendung.',bass:'Der Bass wird zwischen den Titeln übergeben.',handover:'Kurze Überlagerung in der Mitte.',cut:'Kurzer, geglätteter Wechsel.'}[p.style]||p.reason||'');reason.className='proposal-reason';
   paths.forEach((path,channel)=>path.setAttribute('d',Array.from({length:41},(_,i)=>`${i?'L':'M'}${4+i*4.8},${52-48*transitionAudioGains(i/40,p,audioOptions(pair))[channel]}`).join(' ')));
   card.dataset.selected=String(active);choose.textContent=active?'Ausgewählt':'Auswählen';choose.setAttribute('aria-pressed',String(active));listen.textContent=active&&job?'■ Stoppen':'▶ Anhören';listen.disabled=active&&!valid;
  });
 }
 function selectProposal(index){
  if(!pair||!alternatives[index]||index===selectedAlternative)return;
  proposalEditor.hidden=true;proposalEditor.closest('article')?.removeAttribute('data-editing');
  if(valid)alternativeDrafts.set(selectedAlternative,structuredClone(pair.plan));stop('');selectedAlternative=index;
  pair.plan=structuredClone(alternativeDrafts.get(index)||alternatives[index]);valid=true;q('[data-alternative]').value=String(index);syncFields();q('[data-edit-status]').textContent='';q('[data-choose]').disabled=false;curveEditor.setPlan(pair.plan,{reset:true});render();
 }
 const unsubscribeOutput=routing?.subscribeOutput?.(()=>{if(job)stop('Hörprobe gestoppt: Audioausgänge wurden geändert.');updateOutput();});

 const audioOptions=snapshot=>({position:snapshot?.position||0,
  levelA:(snapshot?.from.volume??1)*10**((snapshot?.from.eq.trim||0)/20),
  levelB:(snapshot?.to.volume??1)*10**((snapshot?.to.eq.trim||0)/20)});
 const position=value=>{
  const p=value/100,gains=transitionAudioGains(p,pair?.plan,audioOptions(pair));
  q('[data-position]').value=value;q('[data-cursor]').setAttribute('x1',20+460*p);q('[data-cursor]').setAttribute('x2',20+460*p);
  q('[data-position-label]').textContent=`${(p*(pair?.plan.duration||0)).toFixed(1)} s · Ausgehend ${Math.round(gains[0]*100)} % · Eingehend ${Math.round(gains[1]*100)} %`;
 };
 function stop(message='Hörprobe gestoppt.'){
  version++;
  if(job){clearInterval(job.timer);for(const a of job.audio){a.pause();a.removeAttribute('src');a.load();}void job.ctx.close().catch(()=>{});job=null;}
  q('[data-stop]').disabled=true;q('[data-stop]').hidden=true;updateOutput();q('[data-position]').disabled=false;q('[data-status]').textContent=message;
 }
 function render(){
  timeline.setPair(valid?pair:null);updateOutput();curveEditor.setPlan(valid?pair?.plan:null,{position:pair?.position||0});
  for(const selector of ['[data-out]','[data-in]'])q(selector).setAttribute('d','');
  if(pair){
   const {from,to,plan}=pair;
   q('[data-tracks]').replaceChildren(...[[from,'Jetzt'],[to,'Danach']].map(([track,label])=>{const card=document.createElement('span'),caption=document.createElement('span'),name=document.createElement('strong');caption.textContent=label+' · '+track.name;name.textContent=track.track.name;card.append(caption,name);return card;}));
   q('[data-timing]').textContent=`Wechsel bei ${formatTime(plan.time)} → nächster Titel ab ${formatTime(plan.cue)} · ${plan.duration.toFixed(1)} Sekunden`;
   q('[data-reason]').textContent=(plan.reason||'Noch keine vollständige Paaranalyse: Übergang nach Zeit und verfügbarem Taktraster.')+(plan.audioProfile?' · RMS-gestützter Kurvenausgleich: bis zu 2 dB während der Überlagerung.':'');
   q('[data-bass]').textContent=plan.style==='bass'?'Bassübergabe: Zuerst wird der alte Bass abgesenkt. Ab der Mitte kommt der neue Bass hinzu.':plan.style==='cut'?'Kurzer Wechsel: Die Titel überlappen nur für einen kurzen, geglätteten Wechsel.':plan.style==='handover'?'Kurze Überlagerung: Der hörbare Wechsel findet zwischen 30 % und 70 % der Übergangsdauer statt.':'Beide Titel werden gleichmäßig ineinander überblendet.';
   for(const [selector,incoming] of [['[data-out]',false],['[data-in]',true]])q(selector).setAttribute('d',Array.from({length:101},(_,i)=>{const gains=transitionAudioGains(i/100,plan,audioOptions(pair));return `${i?'L':'M'}${20+i*4.6},${115-105*gains[incoming?1:0]}`;}).join(' '));
  }else{
   q('[data-tracks]').textContent='Zwei lokale Titel laden, um einen Übergang anzusehen.';
   for(const selector of ['[data-timing]','[data-reason]','[data-bass]'])q(selector).textContent='';
  }
  position(0);
 }
 function loadPair(){
  stop('');pair=suppliedPair||getPair(q('[data-direction]').value);valid=true;alternatives=transitionProposals(pair);
  alternativeDrafts.clear();
  q('[data-alternative]').replaceChildren(...alternatives.map((p,i)=>new Option(`${p.manual?'Eigene Auswahl: ':i===0?'Empfehlung: ':''}${p.label} · ${p.duration.toFixed(1)} s · bei ${formatTime(p.time)} → ${formatTime(p.cue)}`,String(i))));
  if(pair){const selected=alternatives.findIndex(p=>p.time===pair.plan.time&&p.cue===pair.plan.cue&&p.style===pair.plan.style&&p.duration===pair.plan.duration);q('[data-alternative]').value=String(Math.max(0,selected));}
  savedDetails.hidden=!pair?.libraryTracks;savedDetails.open=Boolean(pair?.linkLibrary);q('[data-variant-name]').closest('label').hidden=!pair?.linkLibrary;
  libraryFields.hidden=!pair?.libraryTracks; q('[data-save-reusable]').checked=Boolean(pair?.linkLibrary);q('[data-save-reusable]').disabled=Boolean(pair?.linkLibrary);q('[data-variant-name]').value=pair?.variantName||'';q('[data-choose]').textContent=pair?.linkLibrary?'Variante speichern':'Übergang übernehmen';
  q('[data-choose]').disabled=!pair;
  for(const key of ['style','duration'])q('[data-edit-'+key+']').disabled=!pair;
  q('.preview-edit').disabled=!pair;q('[data-alternative]').disabled=!pair;
  selectedAlternative=Number(q('[data-alternative]').value)||0;
  q('[data-edit-status]').textContent='';syncFields();buildProposals();
  curveEditor.setPlan(pair?.plan,{reset:true});render();q('[data-status]').textContent=!pair?getUnavailableReason():'';
 }
 function open(){q('[data-direction]').disabled=Boolean(suppliedPair);q('[data-refresh]').disabled=Boolean(suppliedPair);q('[data-remember]').closest('label').hidden=Boolean(suppliedPair);if(routing?.routingHost){outputBar.after(routing.routingHost);routing.routingHost.open=false;routing.routingHost.hidden=true;}loadPair();resetView();if(!dialog.open)dialog.showModal();}
 function syncFields(){if(!pair)return;for(const key of ['time','cue','duration','style']){const input=q('[data-edit-'+key+']');input.value=key==='style'?pair.plan[key]:Number(pair.plan[key].toFixed(2));input.dataset.displayValue=input.value;input.dataset.exactValue=String(pair.plan[key]);if(key!=='style')input.step='.01';}}
 function edit(){
  if(!pair)return;stop('');
  try{
   const values=Object.fromEntries(['time','cue','duration'].map(key=>[key,q('[data-edit-'+key+']').value===q('[data-edit-'+key+']').dataset.displayValue?Number(q('[data-edit-'+key+']').dataset.exactValue):q('[data-edit-'+key+']').valueAsNumber]));
   pair.plan=editTransitionPlan(pair,{...values,style:q('[data-edit-style]').value});valid=true;
   q('[data-edit-status]').textContent='Geändert · Hörprobe zum Prüfen starten, dann übernehmen.';q('[data-choose]').disabled=false;render();
  }catch(error){valid=false;q('[data-edit-status]').textContent=error.message;q('[data-play]').disabled=true;q('[data-choose]').disabled=true;curveEditor.setPlan(null);timeline.setPair(null);}
 }
 for(const key of ['time','cue','duration','style'])q('[data-edit-'+key+']').addEventListener(key==='style'?'change':'input',edit);
 q('[data-direction]').onchange=loadPair;q('[data-refresh]').onclick=loadPair;
 q('[data-alternative]').onchange=()=>selectProposal(Number(q('[data-alternative]').value));
 q('[data-choose]').onclick=async()=>{
  if(!pair||!valid)return;stop('');const chosen=pair;q('[data-choose]').disabled=true;
  try{
   chosen.saveReusable=q('[data-save-reusable]').checked;chosen.variantName=q('[data-variant-name]').value;
   const accepted=await onChoose?.(chosen,chosen.plan,q('[data-remember]').checked);
   if(pair===chosen)q('[data-status]').textContent=accepted?(chosen.linkLibrary?'Variante in der Übergangsbibliothek gespeichert.':chosen.setlist?'Übergang in der Setliste auf diesem Gerät gespeichert.':'Variante für diesen Übergang übernommen.'):(chosen.setlist?'Nicht gespeichert: Titelpaar wurde geändert oder der Gerätespeicher ist nicht verfügbar.':'Nicht übernommen: Der Plan hat sich geändert oder der Ausstieg liegt vor der aktuellen Deckposition. Start anpassen und Paar neu laden.');
  }catch(error){if(pair===chosen)q('[data-status]').textContent='Speichern fehlgeschlagen: '+error.message;}
  finally{if(pair===chosen)q('[data-choose]').disabled=!valid;}
 };
 const waitMedia=(audio,event,ready)=>ready()?Promise.resolve():new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);audio.removeEventListener(event,done);audio.removeEventListener('error',fail);};
  const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Audiodatei konnte nicht für die Hörprobe geladen werden.'));};
  const timer=setTimeout(fail,10000);audio.addEventListener(event,done,{once:true});audio.addEventListener('error',fail,{once:true});
 });
 async function play(){
  if(!pair||!valid)return;
  const device=output();if(!device){updateOutput();return;}
  stop('Hörprobe wird vorbereitet …');const token=version;const snapshot={...pair,plan:{...pair.plan}};
  let ctx,audio;
  try{ctx=new AudioContext();audio=[new Audio(),new Audio()];job={ctx,audio};}catch(error){stop('Hörprobe konnte nicht vorbereitet werden: '+error.message);return;}
  const master=ctx.createGain();master.gain.value=+q('[data-volume]').value;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(ctx.destination);job.master=master;
  q('[data-play]').disabled=true;q('[data-stop]').disabled=false;q('[data-stop]').hidden=false;q('[data-position]').disabled=true;updateProposals();
  try{
   await ctx.setSinkId(device.deviceId);if(token!==version)return;
   ctx.addEventListener('sinkchange',()=>{if(token===version&&ctx.sinkId!==device.deviceId)stop('Hörprobe gestoppt: Kopfhörerausgang nicht mehr verfügbar.');});
   await ctx.resume();if(token!==version)return;
   const nodes=await Promise.all([snapshot.from,snapshot.to].map(async(d,i)=>{
    const a=audio[i];a.preload='auto';a.src=d.url;a.playbackRate=d.rate;a.preservesPitch=d.pitch;
    let node=ctx.createMediaElementSource(a);
    for(const [key,type,freq] of [['trim'],['low','lowshelf',250],['mid','peaking',1000],['high','highshelf',4000]]){
     const filter=key==='trim'?ctx.createGain():ctx.createBiquadFilter();
     if(type){filter.type=type;filter.frequency.value=freq;if(key==='mid')filter.Q.value=.7;}
     filter.gain.value=key==='trim'?10**(d.eq[key]/20):d.eq[key];node.connect(filter);node=filter;
    }
    const bass=ctx.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=250;node.connect(bass);
    const gain=ctx.createGain();gain.gain.value=0;bass.connect(gain);gain.connect(master);
    await waitMedia(a,'loadedmetadata',()=>a.readyState>=1);if(token!==version)return null;
    a.currentTime=i?snapshot.plan.cue:Math.max(0,snapshot.plan.time-2*d.rate);
    await waitMedia(a,'seeked',()=>!a.seeking);if(token!==version)return null;
    return {gain,bass,volume:d.volume};
   }));
   if(token!==version)return;
   nodes[0].gain.gain.value=nodes[0].volume;
   await audio[0].play();if(token!==version)return;
   q('[data-status]').textContent='Hörprobe: Vorlauf zum Wechsel …';
   const lead=Math.min(2,snapshot.plan.time/snapshot.from.rate);
   await new Promise(resolve=>setTimeout(resolve,lead*1000));
   if(token!==version)return;
   await audio[1].play();if(token!==version)return;
   const start=ctx.currentTime,duration=snapshot.plan.duration;
   nodes.forEach(({gain,bass,volume},i)=>{
    scheduleTransitionGain(gain.gain,Float32Array.from({length:257},(_,n)=>transitionAudioGains(n/256,snapshot.plan,audioOptions(snapshot))[i]*volume),start,duration);
    if(snapshot.plan.style==='bass')bass.gain.setValueCurveAtTime(Float32Array.from({length:257},(_,n)=>transitionBassDb(n/256,Boolean(i))),start,duration);
   });
   q('[data-status]').textContent='Hörprobe läuft · '+(device.label||'Kopfhörer');
   clearInterval(job.timer);job.timer=setInterval(()=>{
    const elapsed=ctx.currentTime-start;position(Math.min(100,elapsed/duration*100));
    if(elapsed>=duration)audio[0].pause();
    if(elapsed>=duration+2||audio[1].ended)stop('Hörprobe beendet. Du kannst sie erneut anhören.');
   },30);
  }catch(e){if(token===version)stop(e.message);}
 }
 button.onclick=open;q('[data-play]').onclick=play;q('[data-stop]').onclick=()=>stop();
 q('[data-position]').oninput=e=>position(+e.target.value);
 q('[data-volume]').oninput=()=>{if(job)job.master.gain.setTargetAtTime(+q('[data-volume]').value,job.ctx.currentTime,.02);};
 dialog.addEventListener('keydown',event=>{
  if(!proposalEditor.hidden&&curveEditor.key(event))return;
  if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey)return;
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();q('[data-choose]').click();return;}
  if(event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,[contenteditable],button,summary,a'))return;
  if(event.key===' '){event.preventDefault();if(job)stop();else if(!output()){updateOutput();configure.click();}else void play();}
 });
 dialog.addEventListener('close',()=>{stop('');suppliedPair?.dispose?.();suppliedPair=null;if(routing?.routingHost){routing.routingHost.hidden=false;routingAnchor.after(routing.routingHost);}button.focus();});window.addEventListener('pagehide',()=>{stop('');unsubscribeOutput?.();},{once:true});
 return {stop,openPair(value){if(dialog.open)return false;suppliedPair=value;open();return true;}};
}
