// Group existing controls without replacing their event handlers or audio state.
export function simplifyDJLayout(decks,mixer,lightStage){
 const disclosure=(title,className)=>{const node=document.createElement('details');node.className=className;const summary=document.createElement('summary');summary.textContent=title;node.append(summary);return node;};
 for(const deck of decks){
  const root=deck.panel;
  const lighting=disclosure('Lichtgestaltung','dj-light-options');
  const picker=root.querySelector('.dj-color-picker'),lightCanvas=root.querySelector('canvas:not(.dj-waveform)');
  picker.before(lighting);lighting.append(picker,lightCanvas);
  const transport=root.querySelector('.dj-buttons'),extra=disclosure('Weitere Deck-Optionen','dj-transport-options');
  extra.append(root.querySelector('.dj-set-cue'),root.querySelector('.dj-unload'),lighting,root.querySelector('.dj-deck-show-profile'));
  const performance=root.querySelector('.dj-performance');
  const volume=root.querySelector('.dj-volume').closest('label'),level=root.querySelector('.dj-level');
  volume.classList.add('dj-channel-volume');
  const channel=document.createElement('div');channel.className='dj-channel-strip';channel.append(volume,level);
  const eq=performance.querySelector('.dj-eq');eq.open=true;eq.querySelector('summary').textContent='Klang · Gain & EQ';
  const monitor=performance.querySelector('.dj-monitor');monitor.textContent='Kopfhörer · Cue';
  const channelTitle=document.createElement('h3');channelTitle.textContent='Kanal & Klang';channel.prepend(channelTitle);
  performance.querySelector('.dj-tempo').after(channel,eq,monitor);
  const banks=document.createElement('div');banks.className='dj-control-banks';banks.setAttribute('role','tablist');banks.setAttribute('aria-label',`Bedienbereich Deck ${deck.name}`);
  const sound=document.createElement('div'),cues=document.createElement('div');sound.className=cues.className='dj-control-bank';
  sound.append(channel,eq);cues.append(performance.querySelector('.dj-hotcues'),performance.querySelector('.dj-loop'),performance.querySelector('[data-loop-info]'));
  const panels=[sound,cues],buttons=['Kanal & EQ','Hotcues & Loops'].map((label,i)=>{
   const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent=label;button.id=`deck-${deck.name}-tab-${i}`;button.setAttribute('role','tab');
   panels[i].id=`deck-${deck.name}-bank-${i}`;panels[i].setAttribute('role','tabpanel');panels[i].setAttribute('aria-labelledby',button.id);button.setAttribute('aria-controls',panels[i].id);banks.append(button);return button;
  });
  const selectBank=i=>{buttons.forEach((button,j)=>{button.setAttribute('aria-selected',String(i===j));button.tabIndex=i===j?0:-1;panels[j].hidden=i!==j;});};
  buttons.forEach((button,i)=>{button.onclick=()=>selectBank(i);button.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?1:1-i;selectBank(next);buttons[next].focus();}};});selectBank(0);
  performance.append(monitor,banks,sound,cues);
  const seek=root.querySelector('.dj-seek');seek.setAttribute('aria-label',`Abspielposition Deck ${deck.name}`);seek.closest('label').classList.add('dj-position');
  const top=document.createElement('div');top.className='dj-deck-top';
  top.append(root.querySelector('h2'),root.querySelector('.dj-track-title'),root.querySelector('.dj-performance-readout'),root.querySelector('.dj-waveform'),seek.closest('label'),root.querySelector('.dj-clock'),transport);
  const controls=document.createElement('div');controls.className='dj-deck-controls';controls.setAttribute('aria-label',`Mix-Werkzeuge Deck ${deck.name}`);controls.tabIndex=0;
  const mixTools=disclosure('DJ-Mix','dj-deck-mix');mixTools.querySelector('summary').dataset.mixSummary='';mixTools.querySelector('summary').title='Tempo, Sync, EQ, Vorhören, Hotcues und Loops';mixTools.append(performance);
  controls.append(mixTools,extra);
  const analysisFooter=document.createElement('div');analysisFooter.className='dj-analysis-footer';
  analysisFooter.append(root.querySelector('.dj-analysis'));controls.append(analysisFooter);
  root.prepend(top,controls);
  const look=root.querySelector('.dj-look');if(look)lighting.append(look);


 }
 const light=document.createElement('section');light.className='dj-mixer-light';light.setAttribute('aria-label','Lichtshow');
 const title=document.createElement('h2');title.textContent='Lichtshow';light.append(title);
 for(const selector of ['.dj-color-preview','.stage-inline','.stage-inline-toolbar','.dj-show-choice']){const node=mixer.querySelector(selector);if(node)light.append(node);}
 // Standalone stage button (without inline preview) remains accessible too.
 const stage=mixer.querySelector('#openLightStage');if(stage&&!light.contains(stage))light.append(stage);
 const show=light.querySelector('.dj-show-choice');if(show?.firstChild?.nodeType===Node.TEXT_NODE)show.firstChild.textContent='Stil ';
 const lightHeader=document.createElement('div');lightHeader.className='dj-light-heading';lightHeader.append(title);if(lightStage?.tabs)lightHeader.append(lightStage.tabs);
 const settings=light.querySelector('#stageSettings');if(settings)lightHeader.append(settings);
 light.prepend(lightHeader);
 const lightOptions=document.createElement('div');lightOptions.className='dj-light-quick';
 const toolbar=light.querySelector('.stage-inline-toolbar');if(toolbar)lightOptions.append(toolbar);
 if(show)lightOptions.append(show);const lightDetails=disclosure('Lichtoptionen','dj-light-settings');lightDetails.append(lightOptions);light.append(lightDetails);
 for(const selector of ['.stage-inline>[data-moving-heads]','.stage-inline>[data-layout-open]']){const control=light.querySelector(selector);if(control)lightOptions.append(control);}
 mixer.classList.remove('panel');light.classList.add('panel');mixer.prepend(light);
 const transition=document.createElement('section');transition.className='panel dj-mixer-transition';transition.setAttribute('aria-label','Übergänge');
 const heading=document.createElement('h2');heading.textContent='Übergänge';
 const transitionHeader=document.createElement('div');transitionHeader.className='dj-transition-heading';transitionHeader.append(heading);transition.append(transitionHeader,mixer.querySelector('.dj-crossfader'));
 const planStatus=document.createElement('p');planStatus.id='pairTransitionStatus';planStatus.className='small muted';planStatus.setAttribute('role','status');planStatus.setAttribute('aria-live','polite');transition.querySelector('.dj-crossfader').append(planStatus);transition.querySelector('#crossfader').setAttribute('aria-describedby','mixValue pairTransitionStatus');
 const auto=mixer.querySelector('.dj-auto-controls');
 const options=disclosure('Automatik einstellen','dj-transition-options');
 const duration=document.createElement('label');duration.textContent='Übergangsdauer';duration.append(document.getElementById('fadeDuration'));
 options.append(duration,mixer.querySelector('.dj-beat-choice'),document.getElementById('beatStatus'));
 const entryChoice=document.createElement('label');entryChoice.textContent='Einstiegssuche';
 entryChoice.innerHTML+='<select id="transitionEntryWindow"><option value="2">Bis 2 s</option><option value="16">Intro bis 16 s</option><option value="30">Intro bis 30 s</option></select>';
 const entryHelp=document.createElement('p');entryHelp.className='small muted';entryHelp.textContent='Bei automatischer Dauer darf der Anfang bis zu diesem Punkt übersprungen werden. Ein gesetzter Cue bleibt exakt erhalten.';
 options.append(entryChoice,entryHelp);
 const preference=document.createElement('label');preference.innerHTML='Leichte Stilpräferenz <select id="transitionPreference"><option value="">Keine</option><option value="smooth">Sanft</option><option value="bass">Bassübergabe</option><option value="handover">Kurze Überlagerung</option><option value="cut">Kurzer Wechsel</option></select>';options.append(preference);
 transition.append(auto,options,document.getElementById('fadeStatus'));light.after(transition);
 const master=mixer.querySelector('.dj-master'),audio=disclosure('Audio & Aufnahme','dj-audio-options');
 audio.append(master.querySelector('.dj-routing'),master.querySelector('.dj-shortcuts'),master.querySelector('.dj-recording'));master.append(audio);master.querySelector('[data-master-meter]').closest('.dj-level').classList.add('dj-master-level');transition.append(master);
 const setupCue=document.createElement('button');setupCue.type='button';setupCue.className='button secondary dj-cue-setup';setupCue.textContent='Kopfhörer einrichten';
 setupCue.onclick=()=>{audio.open=true;const routing=audio.querySelector('.dj-routing');routing.open=true;routing.querySelector('summary').focus();};audio.prepend(setupCue);audio.prepend(audio.querySelector('summary'));audio.append(master.querySelector('.dj-master-level'));
 const recording=audio.querySelector('.dj-recording'),summary=audio.querySelector('summary');
 const observer=new MutationObserver(()=>{const running=recording.querySelector('[data-record]').textContent==='Aufnahme beenden',saved=!recording.querySelector('[data-download]').hidden;summary.textContent='Audio & Aufnahme'+(running?' · Aufnahme läuft':saved?' · Aufnahme bereit':'');});
 observer.observe(recording,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 const headingRow=document.querySelector('.dj-library-heading'),files=document.createElement('div');files.className='dj-import-options';
 const importButton=document.createElement('button');importButton.type='button';importButton.className='button primary';importButton.innerHTML='<span aria-hidden="true" class="dj-import-icon">+</span><span class="dj-import-label">Musik hinzufügen</span>';importButton.setAttribute('aria-label','Musik hinzufügen');importButton.title='Musik hinzufügen';importButton.setAttribute('popovertarget','libraryImportPopover');importButton.setAttribute('aria-expanded','false');
 const importPanel=document.createElement('div');importPanel.id='libraryImportPopover';importPanel.className='dj-import-panel';importPanel.setAttribute('popover','auto');importPanel.setAttribute('aria-labelledby','libraryImportTitle');
 const importTitle=document.createElement('h3');importTitle.id='libraryImportTitle';importTitle.textContent='Lokale Musik hinzufügen';
 const importActions=document.createElement('div');importActions.className='dj-import-actions';importActions.append(document.getElementById('addTracks'),document.getElementById('linkFolder'));
 importPanel.append(importTitle,importActions,document.getElementById('folderBar'),document.getElementById('folderStatus'));files.append(importButton,importPanel);headingRow.append(files);
 document.getElementById('libraryTools').append(document.getElementById('enqueueAll'));
 const positionImport=()=>{
  const rect=importButton.getBoundingClientRect(),width=importPanel.offsetWidth,height=importPanel.offsetHeight;
  importPanel.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';
  importPanel.style.top=Math.max(12,Math.min(rect.bottom+8+height<=innerHeight-12?rect.bottom+8:rect.top-height-8,innerHeight-height-12))+'px';
 };
 importPanel.addEventListener('toggle',()=>{const open=importPanel.matches(':popover-open');importButton.setAttribute('aria-expanded',String(open));if(open)positionImport();});
 new ResizeObserver(()=>{if(importPanel.matches(':popover-open'))positionImport();}).observe(importPanel);
 window.addEventListener('resize',()=>{if(importPanel.matches(':popover-open'))positionImport();});
 document.addEventListener('scroll',()=>{if(importPanel.matches(':popover-open'))positionImport();},true);
 const filterButton=document.getElementById('libraryFilterButton'),filterPopover=document.getElementById('libraryFilterPopover');
 const positionFilters=()=>{
  const rect=filterButton.getBoundingClientRect();
  filterPopover.style.left=Math.max(12,Math.min(rect.right-filterPopover.offsetWidth,innerWidth-filterPopover.offsetWidth-12))+'px';
  const below=rect.bottom+8,above=rect.top-filterPopover.offsetHeight-8;
  filterPopover.style.top=Math.max(12,Math.min(below+filterPopover.offsetHeight<=innerHeight-12?below:above,innerHeight-filterPopover.offsetHeight-12))+'px';
 };
 filterPopover.addEventListener('toggle',()=>{const open=filterPopover.matches(':popover-open');filterButton.setAttribute('aria-expanded',String(open));if(open)positionFilters();});
 filterButton.setAttribute('aria-expanded','false');
 const updateFilterIndicator=()=>{filterButton.dataset.active=String(document.getElementById('trackFilter').value!=='all'||document.getElementById('trackSort').value!=='newest'||Boolean(filterPopover.querySelector('.feeling-filter input:checked')));};
 filterPopover.addEventListener('change',()=>{updateFilterIndicator();if(filterPopover.matches(':popover-open'))positionFilters();});
 new ResizeObserver(()=>{if(filterPopover.matches(':popover-open'))positionFilters();}).observe(filterPopover);requestAnimationFrame(updateFilterIndicator);
 window.addEventListener('resize',()=>{if(filterPopover.matches(':popover-open'))positionFilters();});
 document.addEventListener('scroll',()=>{if(filterPopover.matches(':popover-open'))positionFilters();},true);
 const manage=disclosure('Liste verwalten','dj-list-options');
 document.querySelector('.queue-manager').append(manage);
 const manageSummary=manage.querySelector('summary');
 manageSummary.className='button secondary queue-icon-button';manageSummary.title='Liste verwalten';manageSummary.setAttribute('aria-label','Liste verwalten');
 manageSummary.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/></svg>';
 const managePanel=document.createElement('div');managePanel.className='queue-list-panel';
 manage.append(managePanel);
 managePanel.append(document.querySelector('.queue-list-actions'),document.getElementById('queueNameLabel'),document.getElementById('queueClear'),document.getElementById('queueSaved'));
 const shuffleOptions=document.createElement('div');shuffleOptions.className='queue-shuffle-options';
 shuffleOptions.innerHTML='<label for="queueShuffleCount">Shuffle: Titel im Voraus <input id="queueShuffleCount" type="number" min="1" max="50" step="1" value="3" aria-describedby="queueShuffleHelp"></label><p id="queueShuffleHelp" class="small muted">1–50 kommende Titel festlegen und automatisch nachfüllen. Bereits eingeplante Titel bleiben beim Verringern erhalten. Bei kleiner Bibliothek werden entsprechend weniger Titel eingeplant.</p>';
 managePanel.append(shuffleOptions);
 document.addEventListener('click',event=>{if(!manage.contains(event.target))manage.open=false;});
 // Escape closes the nearest disclosure and returns focus to its trigger.
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.defaultPrevented||event.target.closest('dialog'))return;const details=event.target.closest('details');if(details?.open){details.open=false;details.querySelector('summary').focus();event.preventDefault();}});
 // Align non-scrolling header/library content with the deck's reserved gutters.
 const alignmentDeck=decks[0].panel;
 const alignEdges=()=>{const gutter=Math.max(0,(alignmentDeck.offsetWidth-alignmentDeck.clientWidth)/2);document.querySelector('.dj-page').style.setProperty('--workspace-gutter',gutter+'px');};
 const alignmentObserver=new ResizeObserver(alignEdges);alignmentObserver.observe(alignmentDeck);alignEdges();
 window.addEventListener('pagehide',()=>alignmentObserver.disconnect(),{once:true});
 makeResizableLayout();
}

function makeResizableLayout(){
 const key='anydj-layout-sizes-v1',desktop=matchMedia('(min-width:761px)'),events=new AbortController();
 let saved={};try{saved=JSON.parse(localStorage.getItem(key))||{};}catch{}
 const groups=[],save=()=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(groups.filter(g=>g.shares).map(g=>[g.id,g.shares]))));}catch{}};
 let dragging=null;
 function stop(){if(!dragging)return;const {handle,pointer}=dragging;dragging=null;if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer);document.body.classList.remove('dj-resizing-x','dj-resizing-y');save();}
 function group(id,root,axis,minimum,labels){
  const panes=[...root.children],stored=saved[id];
  const g={id,root,panes,axis,minimum,handles:[],shares:Array.isArray(stored)&&stored.length===panes.length&&stored.every(n=>Number.isFinite(n)&&n>0&&n<=1)&&Math.abs(stored.reduce((a,b)=>a+b,0)-1)<.001?stored:null};
  root.classList.add('dj-resize-group',`dj-resize-${id}`);groups.push(g);
  const size=node=>node.getBoundingClientRect()[axis==='x'?'width':'height'];
  const sizes=()=>panes.map(size);
  function render(){
   const available=Math.max(1,size(root)-8*(panes.length-1));
   const scale=Math.min(1,available/minimum.reduce((a,b)=>a+b,0));
   if(g.shares)root.style.setProperty('--dj-split-tracks',g.shares.map((n,i)=>`minmax(${minimum[i]*scale}px,${n}fr)`).join(' 8px '));
   else root.style.removeProperty('--dj-split-tracks');
   const current=sizes();
   g.handles.forEach((h,i)=>{const total=current[i]+current[i+1],min=minimum[i]*scale,max=total-minimum[i+1]*scale;h.setAttribute('aria-valuenow',String(Math.round(current[i]/(total||1)*100)));h.setAttribute('aria-valuemin',String(Math.floor(min/(total||1)*100)));h.setAttribute('aria-valuemax',String(Math.ceil(max/(total||1)*100)));});
  }
  function adjust(i,delta,initial=sizes()){
   const total=initial.reduce((a,b)=>a+b,0),pair=initial[i]+initial[i+1];if(!total)return;
   const scale=Math.min(1,total/minimum.reduce((a,b)=>a+b,0));
   const next=Math.max(minimum[i]*scale,Math.min(pair-minimum[i+1]*scale,initial[i]+delta));
   const result=[...initial];result[i]=next;result[i+1]=pair-next;g.shares=result.map(n=>n/total);render();
  }
  panes.slice(0,-1).forEach((pane,i)=>{
   const handle=document.createElement('div');handle.className=`dj-resize-handle dj-resize-handle-${axis}`;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label',labels[i]);handle.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');handle.title=labels[i]+' · Ziehen oder Pfeiltasten · Doppelklick setzt zurück';
   pane.after(handle);g.handles.push(handle);
   handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||!desktop.matches)return;stop();event.preventDefault();handle.focus();
    dragging={handle,pointer:event.pointerId,start:axis==='x'?event.clientX:event.clientY,initial:sizes()};handle.setPointerCapture(event.pointerId);document.body.classList.add(`dj-resizing-${axis}`);
   },{signal:events.signal});
   handle.addEventListener('pointermove',event=>{if(dragging?.handle!==handle||dragging.pointer!==event.pointerId)return;adjust(i,(axis==='x'?event.clientX:event.clientY)-dragging.start,dragging.initial);},{signal:events.signal});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,()=>{if(dragging?.handle===handle)stop();},{signal:events.signal});
   handle.addEventListener('keydown',event=>{
    const negative=axis==='x'?'ArrowLeft':'ArrowUp',positive=axis==='x'?'ArrowRight':'ArrowDown';
    if(![negative,positive,'Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    adjust(i,event.key==='Home'?-Infinity:event.key==='End'?Infinity:(event.key===negative?-1:1)*(event.shiftKey?40:10));save();
   },{signal:events.signal});
   handle.addEventListener('dblclick',()=>{g.shares=null;render();save();},{signal:events.signal});
  });
  const observer=new ResizeObserver(()=>{if(desktop.matches)render();});observer.observe(root);g.observer=observer;g.render=render;render();
 }
 group('workspace',document.querySelector('.dj-page main'),'y',[300,180],['Höhe von Pult und Listen']);
 group('decks',document.querySelector('.dj-decks'),'x',[200,260,200],['Breite von Deck A und Mixer','Breite von Mixer und Deck B']);
 group('collections',document.querySelector('.dj-collections'),'x',[260,260],['Breite von Bibliothek und Warteschlange']);
 const reset=document.createElement('button');reset.type='button';reset.className='button secondary';reset.textContent='Layout zurücksetzen';
 const settings=document.querySelector('.dj-settings');
 if(settings.hidden){for(const child of settings.querySelector('div').children)child.hidden=true;settings.hidden=false;}
 settings.querySelector('div').append(reset);
 reset.addEventListener('click',()=>{stop();for(const g of groups){g.shares=null;g.render();}save();},{signal:events.signal});
 desktop.addEventListener('change',()=>{stop();for(const g of groups)g.render();},{signal:events.signal});
 window.addEventListener('pagehide',()=>{stop();events.abort();for(const g of groups)g.observer.disconnect();},{once:true});
}
