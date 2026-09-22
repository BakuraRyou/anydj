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

// Own media elements and context: rehearsal never seeks or starts either deck.
export function createTransitionPreview({host,getPair,onChoose,routing,getUnavailableReason=()=>'Zwei analysierte lokale Titel in Deck A und B laden.'}){
 const button=document.createElement('button');button.type='button';button.className='button secondary transition-preview-open';button.textContent='Übergang bearbeiten & probehören';host.querySelector('h2')?.after(button);if(!button.parentNode)host.prepend(button);
 const dialog=document.createElement('dialog');dialog.className='dj-transition-preview';
 dialog.innerHTML=`<form method="dialog"><button class="button secondary" aria-label="Vorschau schließen">Schließen</button></form><h2>Übergang bearbeiten</h2><label>Richtung<select data-direction><option value="auto">Aktuelles Deck → nächstes Deck</option><option value="0">Deck A → Deck B</option><option value="1">Deck B → Deck A</option></select></label><p data-tracks></p><label>Vorschlag <select data-alternative aria-label="Übergangsvariante"></select></label><fieldset class="preview-edit"><legend>Übergang anpassen</legend><label>Ausgehender Titel · Wechsel ab (s)<input data-edit-time type="number" min="0" step="0.1" required></label><label>Nächster Titel · Einstieg bei (s)<input data-edit-cue type="number" min="0" step="0.1" required></label><label>Überblenddauer (s)<input data-edit-duration type="number" min="0.1" max="60" step="0.1" required></label><label>Übergangsart<select data-edit-style><option value="smooth">Sanft überblenden</option><option value="bass">Bassübergabe</option><option value="handover">Kurze Überlagerung</option><option value="cut">Kurzer Wechsel</option></select></label></fieldset><p data-edit-status role="status"></p><label class="small"><input type="checkbox" data-remember> Ähnliche Übergänge künftig leicht bevorzugen</label><button data-choose class="button secondary">Übergang übernehmen</button><p data-timing></p><p data-reason></p><svg viewBox="0 0 500 140" role="img" aria-label="Lautstärkeverlauf: alter Titel wird leiser, neuer Titel lauter"><path d="M20 10V115H480" fill="none" stroke="#526471"/><path data-out fill="none" stroke="#f7ad76" stroke-width="3"/><path data-in fill="none" stroke="#79ced8" stroke-width="3"/><line data-cursor x1="20" x2="20" y1="10" y2="115" stroke="white"/><text x="20" y="135" fill="currentColor">Start</text><text x="445" y="135" fill="currentColor">Ende</text></svg><p class="small">Orange: ausgehender Titel · Türkis: nächster Titel</p><p data-bass class="small"></p><label>Verlauf erkunden <input data-position type="range" min="0" max="100" value="0" step="1"></label><p data-position-label class="small"></p><p class="small">Hörprobe ausschließlich über den gewählten Kopfhörerausgang. Die laufenden Decks spielen unverändert weiter. Sie beginnt bis zu zwei Sekunden vor dem geplanten Übergang und endet zwei Sekunden danach. Deck-EQ und Kanalpegel werden übernommen.</p><div class="preview-actions"><button data-play class="button primary">Hörprobe starten</button><button data-refresh class="button secondary">Paar neu laden</button><button data-stop class="button secondary" disabled>Stoppen</button><label>Probelautstärke <input data-volume type="range" min="0" max="1" step="0.01" value="0.5"></label></div><p data-status role="status"></p>`;
 document.body.append(dialog);const q=s=>dialog.querySelector(s);
 dialog.setAttribute('aria-label','Übergang bearbeiten und probehören');
 const actions=q('.preview-actions');q('[data-edit-status]').after(actions);actions.append(q('[data-choose]'));
 actions.after(q('[data-status]'));
 const details=document.createElement('details');details.className='preview-details';const summary=document.createElement('summary');summary.textContent='Zeitpunkte & Vorlagen';details.append(summary,q('[data-direction]').closest('label'),q('.preview-edit'),q('[data-alternative]').closest('label'),q('[data-remember]').closest('label'),q('[data-reason]'));q('[data-timing]').after(details);
 q('[data-position]').closest('label').hidden=true;
 const svg=q('svg');q('[data-tracks]').after(svg);
 const curveEditor=createTransitionCurveEditor(svg,{onInspect:value=>{if(!job)position(value);},onChange:points=>{
  if(!pair||!valid)return;stop('');pair.plan={...pair.plan,points,manual:true,audioProfile:null,label:points?'Eigene Übergangskurve':'Vorlagenkurve',reason:points?'Lautstärkeverläufe mit eigenen Punkten.':'Lautstärkekurve der gewählten Übergangsart.'};
  q('[data-edit-status]').textContent='Kurve geändert · probehören und übernehmen.';render();
 }});
 svg.after(q('[data-position-label]'));
 details.append(q('[data-bass]'));
 details.after(q('[data-edit-status]'),actions,q('[data-status]'));

 let suppliedPair=null;
 let pair=null,job=null,version=0,alternatives=[],valid=true;
 const routingAnchor=document.createComment('Audioausgänge');
 routing?.routingHost?.before(routingAnchor);
 const outputStatus=document.createElement('p');outputStatus.setAttribute('role','status');outputStatus.dataset.previewOutput='';actions.before(outputStatus);
 const output=()=>routing?.getPreviewOutput?.();
 const updateOutput=()=>{
  const device=output();outputStatus.textContent=device?'Hörprobe → '+(device.label||'Kopfhörer'):'Zum Probehören unterschiedliche Master- und Kopfhörerausgänge wählen.';
  q('[data-play]').disabled=!pair||!valid||!device||Boolean(job);
 };
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
  q('[data-stop]').disabled=true;updateOutput();q('[data-position]').disabled=false;q('[data-status]').textContent=message;
 }
 function render(){
  updateOutput();curveEditor.setPlan(valid?pair?.plan:null,{position:pair?.position||0});
  for(const selector of ['[data-out]','[data-in]'])q(selector).setAttribute('d','');
  if(pair){
   const {from,to,plan}=pair;
   q('[data-tracks]').textContent=`${from.name}: ${from.track.name} → ${to.name}: ${to.track.name}`;
   q('[data-timing]').textContent=`${plan.label||'Sanfter Übergang'} · ${plan.duration.toFixed(1)} Sekunden · Ausstieg ${formatTime(plan.time)} · Einstieg ${formatTime(plan.cue)} · Tempo bleibt unverändert`;
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
  stop('');pair=suppliedPair||getPair(q('[data-direction]').value);valid=true;alternatives=pair?(pair.plan.alternatives?.length?[...pair.plan.alternatives]:[pair.plan]):[];
  if(pair?.plan.manual&&!alternatives.some(p=>p.time===pair.plan.time&&p.cue===pair.plan.cue&&p.style===pair.plan.style&&p.duration===pair.plan.duration))alternatives.unshift(pair.plan);
  q('[data-alternative]').replaceChildren(...alternatives.map((p,i)=>new Option(`${p.manual?'Eigene Auswahl: ':i===0?'Empfehlung: ':''}${p.label} · ${p.duration.toFixed(1)} s · bei ${formatTime(p.time)} → ${formatTime(p.cue)}`,String(i))));
  if(pair){const selected=alternatives.findIndex(p=>p.time===pair.plan.time&&p.cue===pair.plan.cue&&p.style===pair.plan.style&&p.duration===pair.plan.duration);q('[data-alternative]').value=String(Math.max(0,selected));}
  q('[data-choose]').disabled=!pair;
  q('.preview-edit').disabled=!pair;q('[data-alternative]').disabled=!pair;
  q('[data-edit-status]').textContent='';syncFields();
  curveEditor.setPlan(pair?.plan,{reset:true});render();q('[data-status]').textContent=!pair?getUnavailableReason():'Zeiten oder Übergangsart ändern, auf Kopfhörern probehören und anschließend übernehmen.';
 }
 function open(){q('[data-direction]').disabled=Boolean(suppliedPair);q('[data-refresh]').disabled=Boolean(suppliedPair);q('[data-remember]').closest('label').hidden=Boolean(suppliedPair);if(routing?.routingHost){outputStatus.before(routing.routingHost);routing.routingHost.open=!output();}loadPair();if(!dialog.open)dialog.showModal();}
 function syncFields(){if(!pair)return;for(const key of ['time','cue','duration','style'])q('[data-edit-'+key+']').value=pair.plan[key];}
 function edit(){
  if(!pair)return;stop('');
  try{
   const values=Object.fromEntries(['time','cue','duration'].map(key=>[key,q('[data-edit-'+key+']').valueAsNumber]));
   pair.plan=editTransitionPlan(pair,{...values,style:q('[data-edit-style]').value});valid=true;
   q('[data-edit-status]').textContent='Geändert · Hörprobe zum Prüfen starten, dann übernehmen.';q('[data-choose]').disabled=false;render();
  }catch(error){valid=false;q('[data-edit-status]').textContent=error.message;q('[data-play]').disabled=true;q('[data-choose]').disabled=true;curveEditor.setPlan(null);}
 }
 for(const key of ['time','cue','duration','style'])q('[data-edit-'+key+']').addEventListener(key==='style'?'change':'input',edit);
 q('[data-direction]').onchange=loadPair;q('[data-refresh]').onclick=loadPair;
 q('[data-alternative]').onchange=()=>{stop('');if(pair){pair.plan={...alternatives[+q('[data-alternative]').value]};valid=true;syncFields();q('[data-edit-status]').textContent='';q('[data-choose]').disabled=false;curveEditor.setPlan(pair.plan,{reset:true});render();}};
 q('[data-choose]').onclick=async()=>{
  if(!pair||!valid)return;stop('');const chosen=pair;q('[data-choose]').disabled=true;
  try{
   const accepted=await onChoose?.(chosen,chosen.plan,q('[data-remember]').checked);
   if(pair===chosen)q('[data-status]').textContent=accepted?(chosen.setlist?'Übergang in der Setliste auf diesem Gerät gespeichert.':'Variante für diesen Übergang übernommen.'):(chosen.setlist?'Nicht gespeichert: Titelpaar wurde geändert oder der Gerätespeicher ist nicht verfügbar.':'Nicht übernommen: Der Plan hat sich geändert oder der Ausstieg liegt vor der aktuellen Deckposition. Start anpassen und Paar neu laden.');
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
  q('[data-play]').disabled=true;q('[data-stop]').disabled=false;q('[data-position]').disabled=true;
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
 dialog.addEventListener('close',()=>{stop('');suppliedPair?.dispose?.();suppliedPair=null;if(routing?.routingHost)routingAnchor.after(routing.routingHost);button.focus();});window.addEventListener('pagehide',()=>{stop('');unsubscribeOutput?.();},{once:true});
 return {stop,openPair(value){if(dialog.open)return false;suppliedPair=value;open();return true;}};
}
