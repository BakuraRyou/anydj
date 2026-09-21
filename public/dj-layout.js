// Group existing controls without replacing their event handlers or audio state.
export function simplifyDJLayout(decks,mixer){
 const statusbar=document.createElement('footer');statusbar.className='dj-statusbar';statusbar.setAttribute('aria-label','Verbindungsstatus');
 document.querySelector('.shell').append(statusbar);statusbar.append(document.getElementById('djConnection'));
 const disclosure=(title,className)=>{const node=document.createElement('details');node.className=className;const summary=document.createElement('summary');summary.textContent=title;node.append(summary);return node;};
 for(const deck of decks){
  const root=deck.panel;
  const lighting=disclosure('Lichtgestaltung','dj-light-options');
  const picker=root.querySelector('.dj-color-picker'),lightCanvas=root.querySelector('canvas:not(.dj-waveform)');
  picker.before(lighting);lighting.append(picker,lightCanvas);
  const transport=root.querySelector('.dj-buttons'),extra=disclosure('Deck einstellen','dj-transport-options');
  extra.append(root.querySelector('.dj-set-cue'),root.querySelector('.dj-unload'));transport.append(extra);
  const performance=root.querySelector('.dj-performance'),tools=disclosure('Mix-Werkzeuge','dj-deck-tools');
  performance.before(tools);tools.append(performance);
  tools.querySelector('summary').title='Tempo, Hotcues, Loops, Klang und Vorhören';
  const activeTools=new MutationObserver(()=>{
    const states=[];
    if(performance.querySelector('[data-loop]').getAttribute('aria-pressed')==='true')states.push('Loop aktiv');
    if(performance.querySelector('.dj-monitor').getAttribute('aria-pressed')==='true')states.push('Vorhören an');
    const tempo=performance.querySelector('[data-tempo-value]').textContent;
    if(Math.abs(parseFloat(tempo))>.05)states.push('Tempo '+tempo);
    const text='Mix-Werkzeuge'+(states.length?' · '+states.join(' · '):'');
    if(tools.querySelector('summary').textContent!==text)tools.querySelector('summary').textContent=text;
    const overview='Deck einstellen'+(states.length?' · '+states.join(' · '):'');
    if(extra.querySelector('summary').textContent!==overview)extra.querySelector('summary').textContent=overview;
  });
  activeTools.observe(performance,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed']});
  window.addEventListener('pagehide',()=>activeTools.disconnect(),{once:true});
  // One entry point for preparation; transport stays visually dominant.
  const volume=root.querySelector('.dj-volume').closest('label'),level=root.querySelector('.dj-level');
  extra.append(volume,level,tools,lighting);
  const seek=root.querySelector('.dj-seek');seek.setAttribute('aria-label',`Abspielposition Deck ${deck.name}`);seek.closest('label').classList.add('dj-position');
  root.querySelector('.dj-clock').after(transport);

 }
 const light=document.createElement('section');light.className='dj-mixer-light';light.setAttribute('aria-label','Lichtshow');
 const title=document.createElement('h2');title.textContent='Lichtshow';light.append(title);
 for(const selector of ['.dj-color-preview','.stage-inline','.stage-inline-toolbar','.dj-show-choice']){const node=mixer.querySelector(selector);if(node)light.append(node);}
 // Standalone stage button (without inline preview) remains accessible too.
 const stage=mixer.querySelector('#openLightStage');if(stage&&!light.contains(stage))light.append(stage);
 const show=light.querySelector('.dj-show-choice');if(show?.firstChild?.nodeType===Node.TEXT_NODE)show.firstChild.textContent='Stil ';
 const lightHeader=document.createElement('div');lightHeader.className='dj-light-heading';lightHeader.append(title);
 const settings=light.querySelector('#stageSettings');if(settings)lightHeader.append(settings);
 light.prepend(lightHeader);
 const lightOptions=document.createElement('div');lightOptions.className='dj-light-quick';
 const toolbar=light.querySelector('.stage-inline-toolbar');if(toolbar)lightOptions.append(toolbar);
 if(show)lightOptions.append(show);const lightDetails=disclosure('Lichtoptionen','dj-light-settings');lightDetails.append(lightOptions);light.append(lightDetails);
 mixer.classList.remove('panel');light.classList.add('panel');mixer.prepend(light);
 const transition=document.createElement('section');transition.className='panel dj-mixer-transition';transition.setAttribute('aria-label','Übergänge');
 const heading=document.createElement('h2');heading.textContent='Übergänge';transition.append(heading,mixer.querySelector('.dj-crossfader'));
 const planStatus=document.createElement('p');planStatus.id='pairTransitionStatus';planStatus.className='small muted';planStatus.setAttribute('role','status');planStatus.setAttribute('aria-live','polite');transition.querySelector('.dj-crossfader').append(planStatus);transition.querySelector('#crossfader').setAttribute('aria-describedby','mixValue pairTransitionStatus');
 const auto=mixer.querySelector('.dj-auto-controls');
 const options=disclosure('Automatik einstellen','dj-transition-options');
 const duration=document.createElement('label');duration.textContent='Übergangsdauer';duration.append(document.getElementById('fadeDuration'));
 options.append(duration,mixer.querySelector('.dj-beat-choice'),document.getElementById('beatStatus'));
 transition.append(auto,options,document.getElementById('fadeStatus'));light.after(transition);
 const master=mixer.querySelector('.dj-master'),audio=disclosure('Audio & Aufnahme','dj-audio-options');
 audio.append(master.querySelector('.dj-routing'),master.querySelector('.dj-shortcuts'),master.querySelector('.dj-recording'));audio.prepend(master.querySelector('.dj-level'));master.append(audio);transition.append(master);
 const recording=audio.querySelector('.dj-recording'),summary=audio.querySelector('summary');
 const observer=new MutationObserver(()=>{const running=recording.querySelector('[data-record]').textContent==='Aufnahme beenden',saved=!recording.querySelector('[data-download]').hidden;summary.textContent='Audio & Aufnahme'+(running?' · Aufnahme läuft':saved?' · Aufnahme bereit':'');});
 observer.observe(recording,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 const headingRow=document.querySelector('.dj-library-heading'),files=disclosure('Musik hinzufügen','dj-import-options');
 headingRow.append(files);files.append(document.getElementById('addTracks'),document.getElementById('linkFolder'),document.getElementById('folderBar'),document.getElementById('folderStatus'));
 files.append(document.getElementById('libraryTools').querySelector('button'));
 const manage=disclosure('Liste verwalten','dj-list-options');
 document.querySelector('.queue-manager').append(manage);
 manage.append(document.querySelector('.queue-list-actions'),document.getElementById('queueNameLabel'),document.getElementById('queueClear'));
 // Escape closes the nearest disclosure and returns focus to its trigger.
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.defaultPrevented||event.target.closest('dialog'))return;const details=event.target.closest('details');if(details?.open){details.open=false;details.querySelector('summary').focus();event.preventDefault();}});
}
