import {cleanCuts,keptRanges,editedDuration,nextKeptTime,cleanCutJoins,cutJoinPlan,cutTimeBetween,cutClock,parseCutPosition} from './track-cuts.js';
import {drawWaveform} from './dj-waveform.js';
import {formatTime} from './dj-model.js';
import {createTransitionPreview} from './transition-preview.js';
import {createCutPlayback} from './track-cut-playback.js';
import {optimizeTransition} from './transition-align.js';
import {cutOptimizationPair} from './transition-optimizer.js';

export function openTrackCutEditor({track,file,onSave,routing,host,onClose}){
 const duration=track.plan.duration,original=JSON.stringify([track.audioCuts||[],track.audioCutJoins||[]]);
 let cuts=cleanCuts(track.audioCuts,duration),joins=cleanCutJoins(track.audioCutJoins,track.audioCuts,duration),history=[],saving=false,drag=null,dead=false,auditionStart=null;
 const initialDraft=JSON.stringify([cuts,joins]);
 let context,previewGain,player,transitionEditor,optimization,jumpDirty=false;
 let inputFormat='seconds';try{if(localStorage.getItem('anydj-cut-time-format')==='time')inputFormat='time';}catch{}
 const dialog=document.createElement(host?'section':'dialog');dialog.className='dj-cut-editor'+(host?' cut-editor-embedded':'');dialog.setAttribute('aria-label','Lied schneiden');
 dialog.innerHTML=`
 <header class="cut-editor-header"><div class="cut-editor-title"><h2>Lied schneiden</h2><p data-title></p></div><button type="button" class="button secondary cut-close" data-close aria-label="Schließen" title="Schließen"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
 <div class="cut-editor-workspace" data-workspace>
  <section class="cut-selection-card" aria-labelledby="cut-selection-title">
   <h3 id="cut-selection-title">Bereich auswählen</h3><p class="cut-section-hint" data-selection-hint>Markiere den Teil, den du entfernen möchtest.</p>
   <canvas width="1000" height="180" tabindex="0" role="slider" aria-label="Hörposition in der Wellenform" aria-valuemin="0" aria-describedby="cut-navigation-help"></canvas><div class="cut-time-ruler" aria-label="Zeitachse der Originaldatei" data-ruler></div><p id="cut-navigation-help" class="cut-navigation-help">Klicken: Hörposition setzen · Ziehen: Schnittbereich markieren · Leertaste: ab Markierung abspielen / pausieren</p>
   <div class="cut-mark-transport"><button type="button" class="button secondary" data-play-position title="Ab Markierung abspielen · Leertaste">Ab Markierung abspielen</button><button type="button" class="button secondary" data-pause-position hidden>Pause</button><span class="small muted" data-mark-position></span></div>
   <details class="cut-shortcuts"><summary>Tastenkürzel</summary><p>Leertaste: Abspielen / Pause · Umschalt + Leertaste: Auswahl mit Vorlauf anhören<br>← / →: 1 Sekunde springen · Umschalt: 5 Sekunden · Alt: 0,1 Sekunden<br>I / O: Anfang / Ende an der Hörposition setzen · Entf: Bereich entfernen<br>Strg / ⌘ + Z: Rückgängig · Strg / ⌘ + S: Schnitte speichern · Pos1 / Ende: Liedanfang / Liedende</p><p>Gilt außerhalb von Eingabefeldern. Speichern funktioniert auch in Zeitfeldern. Schaltflächen behalten ihre normale Tastaturbedienung.</p></details>
   <div class="cut-fields">
    <label><span data-start-label>Von</span><input data-start type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="0" aria-describedby="cut-format-help"><output data-start-clock hidden></output></label>
    <label><span data-end-label>Bis</span><input data-end type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="0" aria-describedby="cut-format-help"><output data-end-clock hidden></output></label>
    <label class="cut-format">Format<select data-time-format aria-label="Format der Zeitangaben"><option value="seconds">Sekunden</option><option value="time">Minuten:Sekunden</option></select></label>
   </div>
   <p id="cut-format-help" class="cut-format-help" data-format-help></p><p class="cut-selection-readout" data-selection></p>
   <div class="cut-selection-actions"><button type="button" data-remove class="button primary">Bereich entfernen</button><button type="button" data-transition class="button secondary">Mit Übergang entfernen</button><button type="button" data-restore-selection class="button secondary" hidden>Auswahl wiederherstellen</button></div>
   <details class="cut-section-picker" data-section-picker><summary>Songabschnitt übernehmen</summary><label>Erkannten Abschnitt auswählen<select data-section><option value="">Abschnitt wählen …</option></select></label></details>
  </section>
  <aside class="cut-cuts-card" aria-labelledby="cut-list-title">
   <div class="cut-card-heading"><h3 id="cut-list-title">Deine Schnitte</h3><span class="cut-count" data-cut-count>0</span></div>
   <p class="cut-empty" data-empty>Noch keine Schnitte. Wähle einen Bereich aus und entferne ihn.</p><ol data-cuts aria-label="Entfernte Bereiche"></ol>
   <div class="cut-history-actions" data-history hidden><button type="button" data-undo class="button secondary">Rückgängig</button><button type="button" data-reset class="button secondary">Alle zurücksetzen</button></div>
   <button type="button" data-optimize-cuts class="button secondary" hidden>Übergänge optimieren</button>
   <div class="cut-result"><h4>Ergebnis</h4><dl><div><dt>Original</dt><dd data-original-duration></dd></div><div class="cut-result-total"><dt>Bearbeitet</dt><dd data-duration></dd></div></dl><p data-shortened></p></div>
   <details class="cut-help"><summary>Hinweise</summary><p>Gespeicherte Schnitte gelten für diesen Titel in allen Listen, bei der Wiedergabe und beim Export. Die Originaldatei bleibt unverändert.</p><p>Ein Übergang verbindet die erhaltenen Teile vor und nach einem inneren Schnitt. Intro und Ende lassen sich kürzen.</p></details>
  </aside>
  <section class="cut-preview-card" aria-labelledby="cut-preview-title">
   <h3 id="cut-preview-title">Probehören</h3><p class="cut-section-hint" data-preview-hint>Die Hörprobe startet kurz vor der Auswahl.</p>
   <div class="cut-preview-controls"><button type="button" data-play class="button secondary">Hörprobe starten</button><button type="button" data-stop class="button secondary" hidden>Stoppen</button><label class="cut-preview-volume">Lautstärke<input data-volume type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Lautstärke der Hörprobe"></label></div>
   <div class="cut-preview-seek"><label>Hörposition im Original<input data-seek type="range" min="0" step="0.01" value="0"></label><div class="cut-seek-tools"><button type="button" class="button secondary" data-nudge="-5" aria-label="5 Sekunden zurück">−5 s</button><label><span data-jump-label>Position (Sekunden)</span><input data-jump type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Hörposition in Sekunden" aria-describedby="cut-format-help"></label><button type="button" class="button secondary" data-jump-go>Springen</button><button type="button" class="button secondary" data-nudge="5" aria-label="5 Sekunden vor">+5 s</button></div></div><output class="cut-position" data-clock></output>
   <div class="cut-output-row"><p data-output-info></p><button type="button" class="button secondary" data-audio-options>Audioausgabe wählen</button></div><div data-audio-host hidden></div>
  </section>
 </div>
 <footer class="cut-editor-footer"><div class="cut-save-status"><span data-draft-state></span><p data-status role="status"></p></div><div class="cut-save-actions"><button type="button" class="button secondary" data-cancel>Abbrechen</button><button type="button" class="button primary" data-save>Schnitte speichern</button></div></footer>`;
 (host||document.body).append(dialog);const q=s=>dialog.querySelector(s),canvas=q('canvas'),previous=document.activeElement;
 if(host){q('[data-cancel]').textContent='Zurück zum Übergang';q('[data-close]').setAttribute('aria-label','Schnittbearbeitung schließen');}
 const url=URL.createObjectURL(file),audio=new Audio(url);audio.volume=1;
 const status=text=>{q('[data-status]').textContent=text;};q('[data-title]').textContent=track.name;
 q('[data-title]').title=track.name;
 const routingAnchor=document.createComment('Schnittvorschau: ursprüngliche Audioausgabe');routing?.routingHost?.before(routingAnchor);
 q('[data-audio-options]').hidden=!routing?.routingHost;
 q('[data-audio-options]').onclick=()=>{
  const host=q('[data-audio-host]');host.hidden=!host.hidden;q('[data-audio-options]').setAttribute('aria-expanded',String(!host.hidden));
  if(!host.hidden&&routing?.routingHost){host.append(routing.routingHost);routing.routingHost.hidden=false;routing.routingHost.open=true;}
 };
 function updateOutput(){
  const output=routing?.getPreviewOutput?.();q('[data-output-info]').textContent=output?'Vorschauausgang: '+(output.label||'Kopfhörer'):'Zum Anhören einen Vorschauausgang wählen.';
  q('[data-audio-options]').textContent=output?'Audioausgabe ändern':'Audioausgabe wählen';q('[data-play]').disabled=!output||!audio.paused;q('[data-stop]').hidden=audio.paused;q('[data-play-position]').disabled=!output;q('[data-pause-position]').hidden=audio.paused;
 }
 function syncSaveState(){
  const dirty=JSON.stringify([cuts,joins])!==initialDraft;
  q('[data-draft-state]').textContent=saving?'Wird gespeichert …':dirty?'Ungespeicherte Änderungen':'Keine ungespeicherten Änderungen';
  if(host)q('[data-cancel]').textContent=dirty?'Änderungen verwerfen':'Zurück zum Übergang';
  q('[data-save]').disabled=saving||Boolean(optimization)||!dirty;q('[data-save]').textContent=saving?'Speichern …':host?'Schnitte anwenden':'Schnitte speichern';q('[data-cancel]').disabled=saving;q('[data-close]').disabled=saving;q('[data-workspace]').inert=saving;
  q('[data-optimize-cuts]').hidden=!cuts.some(([a,b])=>a>0&&b<duration);q('[data-optimize-cuts]').textContent=optimization?'Optimierung abbrechen':'Übergänge optimieren';q('[data-optimize-cuts]').disabled=saving;
 }
 audio.addEventListener('play',updateOutput);audio.addEventListener('pause',updateOutput);audio.addEventListener('ended',updateOutput);
 const draftTrack=()=>({audioCuts:cuts,audioCutJoins:joins,plan:{duration}});
 q('[data-seek]').max=String(duration);
 function readPosition(name){
  const field=q('[data-'+name+']');
  const value=field.value===field.dataset.displayValue?Number(field.dataset.exactValue):parseCutPosition(field.value,inputFormat);
  return value>duration&&value-duration<=.00500001?duration:value;
 }
 function writePosition(name,value){
   const field=q('[data-'+name+']');field.value=inputFormat==='time'?cutClock(value):String(Number(value.toFixed(2))).replace('.',',');
   field.dataset.displayValue=field.value;field.dataset.exactValue=String(value);
 }
 function writePositions(a,b){writePosition('start',a);writePosition('end',b);}
 function formatFields(){
  q('[data-time-format]').value=inputFormat;
  q('[data-format-help]').textContent=inputFormat==='time'?'Zum Beispiel 1:30,50 · Nachkommastellen mit Komma oder Punkt.':'Zum Beispiel 90,50 · Nachkommastellen mit Komma oder Punkt.';
  for(const [name,label] of [['start','Von'],['end','Bis']]){const field=q('[data-'+name+']');field.inputMode=inputFormat==='time'?'text':'decimal';field.placeholder=inputFormat==='time'?'1:30,50':'90,50';field.setAttribute('aria-label',label+(inputFormat==='time'?' (Minuten:Sekunden)':' (Sekunden)'));q('[data-'+name+'-label]').textContent=label;}
  q('[data-jump-label]').textContent=inputFormat==='time'?'Position (Min:Sek)':'Position (Sekunden)';q('[data-jump]').inputMode=inputFormat==='time'?'text':'decimal';q('[data-jump]').setAttribute('aria-label',inputFormat==='time'?'Hörposition in Minuten:Sekunden':'Hörposition in Sekunden');
 }
 q('[data-time-format]').onchange=()=>{
  const a=readPosition('start'),b=readPosition('end'),jump=jumpDirty?readPosition('jump'):audio.currentTime;
  if(![a,b,jump].every(Number.isFinite)){q('[data-time-format]').value=inputFormat;status('Vor dem Formatwechsel gültige Werte in die Zeitfelder eingeben.');return;}
  inputFormat=q('[data-time-format]').value;formatFields();writePositions(a,b);writePosition('jump',jump);draw();
  try{localStorage.setItem('anydj-cut-time-format',inputFormat);}catch{}
 };
 formatFields();writePositions(0,0);
 for(const [i,section] of (track.basePlan?.sections||track.plan.sections||[]).entries())q('[data-section]').add(new Option(`${section.label||section.name||`Abschnitt ${i+1}`} · ${formatTime(section.start)}–${formatTime(section.end)}`,String(i)));
 q('[data-section-picker]').hidden=q('[data-section]').options.length<2;
 q('[data-section]').onchange=()=>{const s=(track.basePlan?.sections||track.plan.sections||[])[Number(q('[data-section]').value)];if(q('[data-section]').value!==''&&s){auditionStart=null;writePositions(s.start,s.end);draw();}};
 function ruler(){
  const count=canvas.clientWidth<500?4:6;q('[data-ruler]').replaceChildren();
  for(let i=0;i<=count;i++){const label=document.createElement('span');label.textContent=cutClock(duration*i/count,0);q('[data-ruler]').append(label);}
 }
 const resize=new ResizeObserver(ruler);resize.observe(canvas);
 function draw(){
  drawWaveform(canvas,track.waveform,audio.currentTime,duration);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fa64665c';
  for(const [a,b] of cuts)ctx.fillRect(a/duration*canvas.width,0,(b-a)/duration*canvas.width,canvas.height);
  ctx.fillStyle='#a7edc84d';for(const join of joins){const a=join.cut[0]-join.duration,b=join.cut[1]+join.duration;ctx.fillRect(a/duration*canvas.width,0,join.duration/duration*canvas.width,canvas.height);ctx.fillRect(join.cut[1]/duration*canvas.width,0,(b-join.cut[1])/duration*canvas.width,canvas.height);}
  const a=readPosition('start'),b=readPosition('end'),valid=[a,b].every(v=>Number.isFinite(v)&&v>=0&&v<=duration);ctx.fillStyle='#6ce5da4d';if(valid)ctx.fillRect(a/duration*canvas.width,0,(b-a)/duration*canvas.width,canvas.height);
  const cursor=Math.max(1,Math.min(canvas.width-1,audio.currentTime/duration*canvas.width));ctx.fillStyle='#e6fff5';ctx.fillRect(cursor-1,0,2,canvas.height);ctx.beginPath();ctx.moveTo(cursor-5,0);ctx.lineTo(cursor+5,0);ctx.lineTo(cursor,8);ctx.closePath();ctx.fill();
  canvas.setAttribute('aria-valuemax',String(duration));canvas.setAttribute('aria-valuenow',String(audio.currentTime));canvas.setAttribute('aria-valuetext',cutClock(audio.currentTime));
  q('[data-seek]').value=String(audio.currentTime);if(!jumpDirty)writePosition('jump',audio.currentTime);
  for(const [name,value] of [['start',a],['end',b]])q('[data-'+name+']').setAttribute('aria-invalid',String(!Number.isFinite(value)||value<0||value>duration));
  for(const [name,value] of [['start',a],['end',b]])q('[data-'+name+'-clock]').textContent=Number.isFinite(value)?inputFormat==='time'?value.toFixed(2).replace('.',',')+' s':cutClock(value):'—';
  q('[data-selection]').textContent=!valid?'Gültige Zeitangaben innerhalb des Liedes eingeben.':b<a?'Das Ende muss nach dem Anfang liegen.':b===a?'Ziehe auf der Wellenform oder gib Von und Bis ein.':`${cutClock(a)} – ${cutClock(b)} · ${(b-a).toFixed(2).replace('.',',')} s ausgewählt`;
  const mark=auditionStart??a;q('[data-mark-position]').textContent=Number.isFinite(mark)?'Ab '+cutClock(mark):'';q('[data-play-position]').setAttribute('aria-label',Number.isFinite(mark)?'Ab Markierung '+cutClock(mark)+' abspielen':'Ab Markierung abspielen');
  q('[data-selection]').classList.toggle('is-invalid',!valid||b<a);
  q('[data-clock]').textContent=`Original ${cutClock(audio.currentTime)} · Bearbeitet ${cutClock(cutTimeBetween(cuts,duration,joins,0,audio.currentTime))}`;
  q('[data-preview-hint]').textContent=auditionStart===null?'Die Hörprobe startet kurz vor der Auswahl.':'Hörprobe ab '+cutClock(auditionStart)+'.';
  q('[data-transition]').disabled=saving||!valid||!(a>0&&b>a&&b<duration);q('[data-remove]').disabled=saving||!valid||b<=a;
  q('[data-restore-selection]').hidden=!valid||b<=a||!cuts.some(([s,e])=>s<b&&e>a);q('[data-restore-selection]').disabled=saving;
 }
 function render(){
  const length=editedDuration(cuts,duration,joins);
  q('[data-selection-hint]').textContent=cuts.length?'Rot markierte Teile sind entfernt. Markiere einen Bereich, um ihn zu entfernen oder wiederherzustellen.':'Markiere den Teil, den du entfernen möchtest.';
  q('[data-original-duration]').textContent=cutClock(duration);q('[data-duration]').textContent=cutClock(length);q('[data-shortened]').textContent=duration-length>.001?cutClock(duration-length)+' kürzer':'Noch keine Kürzung';
  q('[data-cut-count]').textContent=String(cuts.length);q('[data-empty]').hidden=Boolean(cuts.length);q('[data-cuts]').hidden=!cuts.length;q('[data-history]').hidden=!cuts.length&&!history.length;
  q('[data-cuts]').replaceChildren();
  cuts.forEach(([a,b],i)=>{
   const li=document.createElement('li'),label=document.createElement('span'),restore=document.createElement('button');label.className='cut-row-range';label.textContent=`${cutClock(a)} – ${cutClock(b)}`;li.append(label);
   const removed=document.createElement('small');removed.className='cut-row-duration';removed.textContent=(b-a).toFixed(2).replace('.',',')+' s entfernt';li.append(removed);
   const join=joins.find(j=>j.cut[0]===a&&j.cut[1]===b);
   if(a>0&&b<duration){const edit=document.createElement('button');edit.type='button';edit.className='button secondary cut-row-join';edit.dataset.cutJoin=String(i);edit.textContent=join?`Übergang · ${join.duration.toFixed(2).replace('.',',')} s`:'Übergang gestalten';edit.onclick=()=>openJoin([a,b],edit);li.append(edit);}
   if(join){const remove=document.createElement('button');remove.type='button';remove.className='button secondary cut-row-no-join';remove.textContent='Ohne Überblendung';remove.onclick=()=>change(cuts,joins.filter(j=>j!==join));li.append(remove);}
   restore.type='button';restore.className='button secondary cut-row-restore';restore.title='Bereich wiederherstellen';restore.setAttribute('aria-label',`${cutClock(a)} bis ${cutClock(b)} wiederherstellen`);restore.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5v6h6M4 11a8 8 0 1 1 1 7"/></svg>';restore.onclick=()=>change(cuts.filter((_,j)=>j!==i));li.append(restore);q('[data-cuts]').append(li);
  });
  q('[data-undo]').disabled=!history.length;q('[data-reset]').disabled=!cuts.length;syncSaveState();draw();
 }
 const stop=()=>{audio.pause();player?.stop();if(optimization){optimization.abort();optimization=null;syncSaveState();}};q('[data-stop]').onclick=stop;
 q('[data-optimize-cuts]').onclick=async()=>{
  if(optimization){stop();status('Optimierung abgebrochen. Deine bisherigen Schnitte bleiben erhalten.');return;}
  stop();const controller=new AbortController();optimization=controller;syncSaveState();
  let nextCuts=structuredClone(cuts),nextJoins=structuredClone(joins);const ranges=cuts.filter(([a,b])=>a>0&&b<duration);let evaluated=0,partial=false;
  try{
   for(const [index,range] of ranges.entries()){
    const pair=cutOptimizationPair(track,nextCuts,nextJoins,range);
    const result=await optimizeTransition(pair,{signal:controller.signal,onProgress:({evaluated,total})=>status(`Schnitt ${index+1} von ${ranges.length}: ${evaluated.toLocaleString('de-DE')} von ${total.toLocaleString('de-DE')} Kombinationen …`)});
    if(optimization!==controller||dead)return;
    const boundary=[result.time+result.duration,result.cue],requested={cut:boundary,duration:result.duration,style:result.style,points:result.points||null};
    nextCuts=cleanCuts([...nextCuts.filter(c=>c[0]!==range[0]||c[1]!==range[1]),boundary],duration);
    const candidates=[...nextJoins.filter(j=>j.cut[0]!==range[0]||j.cut[1]!==range[1]),requested];nextJoins=cleanCutJoins(candidates,nextCuts,duration);
    if(nextJoins.length!==candidates.length)throw Error('Die optimierten Übergänge überdecken sich. Bitte die Schnittstellen einzeln optimieren.');
    evaluated+=result.optimization.evaluated;
    partial||=result.confidence!=='analyzed';
   }
   if(optimization!==controller||dead)return;optimization=null;change(nextCuts,nextJoins);status(`${ranges.length} Schnittübergänge optimiert · ${evaluated.toLocaleString('de-DE')} Kombinationen verglichen${partial?' · eingeschränkte Analysedaten':''}. Bitte probehören und speichern.`);
  }catch(error){if(optimization===controller&&!dead)status(error.message);}
  finally{if(optimization===controller){optimization=null;syncSaveState();}}
 };
 function change(value,nextJoins=joins){stop();auditionStart=null;history.push({cuts:structuredClone(cuts),joins:structuredClone(joins)});cuts=cleanCuts(value,duration);joins=cleanCutJoins(nextJoins,cuts,duration);status('');render();}
 function selectedCut(){
  const a=readPosition('start'),b=readPosition('end');
  if(!q('[data-start]').value||!q('[data-end]').value||![a,b].every(Number.isFinite)||a<0||b>duration||b<=a)throw Error('Einen gültigen Bereich innerhalb des Liedes markieren.');
  const next=cleanCuts([...cuts,[a,b]],duration);if(editedDuration(next,duration)<.1)throw Error('Mindestens 0,1 Sekunden des Liedes müssen erhalten bleiben.');
  return {a,b,next};
 }
 q('[data-remove]').onclick=()=>{try{change(selectedCut().next);}catch(error){status(error.message);}};
 q('[data-restore-selection]').onclick=()=>{
  const a=readPosition('start'),b=readPosition('end');
  if(![a,b].every(Number.isFinite)||a<0||b>duration||b<=a)return;
  change(cuts.flatMap(([s,e])=>e<=a||s>=b?[[s,e]]:[[s,Math.min(e,a)],[Math.max(s,b),e]].filter(([s,e])=>e>s)));
 };
 q('[data-transition]').onclick=()=>{try{const {a,b,next}=selectedCut();if(JSON.stringify(next)!==JSON.stringify(cuts))change(next);const cut=cuts.find(([s,e])=>a>=s&&b<=e);openJoin(cut,q('[data-transition]'));}catch(error){status(error.message);}};
 function openJoin(range,trigger){
  if(!range||range[0]<=0||range[1]>=duration){status('Übergänge verbinden zwei erhaltene Teile innerhalb des Liedes.');return;}stop();
  const [a,b]=range,kept=keptRanges(cuts,duration),left=kept.find(r=>r[1]===a),right=kept.find(r=>r[0]===b),existing=joins.find(j=>j.cut[0]===a&&j.cut[1]===b);
  const available=Math.min(a-left[0],right[1]-b),length=existing?.duration||Math.min(1,available/2);
  if(length<.1){status('Für einen Übergang müssen auf beiden Seiten mindestens 0,1 Sekunden erhalten bleiben.');return;}
  if(!transitionEditor){
   const host=document.createElement('section');host.hidden=true;dialog.append(host);
   transitionEditor=createTransitionPreview({host,getPair:()=>null,routing,onChoose:async(pair,choice)=>{
    const [oldA,oldB]=pair.cutJoin,newA=choice.time+choice.duration,newB=choice.cue;
    if(newA<=0||newB<=newA||newB>=duration)throw Error('Der Schnitt muss zwei hörbare Liedteile verbinden.');
    const next=cleanCuts([...cuts.filter(c=>c[0]!==oldA||c[1]!==oldB),[newA,newB]],duration),requested={cut:[newA,newB],duration:choice.duration,style:choice.style,points:choice.points||null};
    const candidates=[...joins.filter(j=>j.cut[0]!==oldA||j.cut[1]!==oldB),requested],valid=cleanCutJoins(candidates,next,duration);
    if(!valid.some(j=>j.cut[0]===newA&&j.cut[1]===newB&&j.duration===choice.duration)||valid.length!==candidates.length)throw Error('Die Überblendungen überdecken sich oder reichen in einen anderen Schnitt. Kürzere Dauer wählen.');
    change(next,valid);writePositions(newA,newB);draw();status('Übergang übernommen. Zum Abschließen speichern.');transitionEditor.close();return true;
   }});
  }
  const wave=track.waveform?{...track.waveform,...Object.fromEntries(['peaks','rms'].filter(k=>track.waveform[k]).map(k=>[k,track.waveform[k].slice(0,Math.max(1,Math.ceil(track.waveform[k].length*a/duration)))]))}:null;
  const source=(name,end,audioCuts,waveform)=>({name,track:{name:track.name},duration:end,audioCuts,audioCutJoins:structuredClone(joins.filter(j=>j.cut[0]!==a||j.cut[1]!==b)),waveform,url,rate:1,pitch:true,volume:1,eq:{trim:0,low:0,mid:0,high:0}});
  const plan=cutJoinPlan(existing||{cut:[a,b],duration:length,style:'smooth',points:null});
  transitionEditor.openPair({cutJoin:[a,b],alignmentTracks:[{...track,plan:{...track.plan,duration:a}},track],from:source('Vor dem Schnitt',a,structuredClone(cuts),wave),to:source('Nach dem Schnitt',duration,cleanCuts([[0,b],...cuts],duration),track.waveform),plan,position:0,dispose:()=>{if(trigger.isConnected)trigger.focus();else q('[data-transition]').focus();}});
 }
 q('[data-undo]').onclick=()=>{stop();const last=history.pop();if(last){cuts=last.cuts;joins=last.joins;}render();status('Letzte Änderung rückgängig gemacht.');};q('[data-reset]').onclick=()=>change([],[]);
 function jumpTo(value){
  if(!Number.isFinite(value)||value<0||value>duration){q('[data-jump]').setAttribute('aria-invalid','true');status('Eine gültige Hörposition zwischen 0 und '+cutClock(duration)+' eingeben.');return;}
  player?.stop();jumpDirty=false;q('[data-jump]').removeAttribute('aria-invalid');
  auditionStart=nextKeptTime(cuts,duration,value);audio.currentTime=auditionStart;
  status(auditionStart>value+.00001?'Diese Stelle ist entfernt. Hörposition bei '+cutClock(auditionStart)+'.':'');draw();
 }
 const point=event=>Math.max(0,Math.min(duration,(event.clientX-canvas.getBoundingClientRect().left)/canvas.getBoundingClientRect().width*duration));
 canvas.onpointerdown=event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();canvas.focus({preventScroll:true});drag={id:event.pointerId,time:point(event),x:event.clientX,moved:false};canvas.setPointerCapture(event.pointerId);};
 canvas.onpointermove=event=>{if(drag?.id!==event.pointerId)return;if(Math.abs(event.clientX-drag.x)>=5)drag.moved=true;if(!drag.moved)return;auditionStart=null;const t=point(event);writePositions(Math.min(drag.time,t),Math.max(drag.time,t));draw();};
 canvas.onpointerup=event=>{if(drag?.id!==event.pointerId)return;const clicked=!drag.moved;drag=null;if(clicked)jumpTo(point(event));};canvas.onpointercancel=canvas.onlostpointercapture=()=>{drag=null;};

 for(const name of ['start','end'])q('[data-'+name+']').oninput=()=>{delete q('[data-'+name+']').dataset.displayValue;delete q('[data-'+name+']').dataset.exactValue;auditionStart=null;draw();};
 q('[data-seek]').oninput=()=>jumpTo(Number(q('[data-seek]').value));
 q('[data-jump]').oninput=()=>{jumpDirty=true;delete q('[data-jump]').dataset.displayValue;delete q('[data-jump]').dataset.exactValue;q('[data-jump]').removeAttribute('aria-invalid');};
 q('[data-jump-go]').onclick=()=>jumpTo(readPosition('jump'));
 q('[data-jump]').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();q('[data-jump-go]').click();}};
 for(const button of dialog.querySelectorAll('[data-nudge]'))button.onclick=()=>jumpTo(Math.max(0,Math.min(duration,audio.currentTime+Number(button.dataset.nudge))));
 audio.addEventListener('seeked',()=>{if(!dead)draw();});audio.addEventListener('loadedmetadata',()=>{if(!dead)draw();});
 q('[data-volume]').oninput=()=>{if(previewGain)previewGain.gain.value=Number(q('[data-volume]').value);};
 async function playPreview(from=null){
  try{
   const output=routing?.getPreviewOutput();if(!output)throw Error('Zuerst unter „Audio & Aufnahme“ Master und Vorschauausgang auswählen.');
   if(!context){context=new AudioContext();previewGain=context.createGain();previewGain.gain.value=Number(q('[data-volume]').value);const limiter=context.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;previewGain.connect(limiter);limiter.connect(context.destination);player=createCutPlayback({context,audio,source:context.createMediaElementSource(audio),destination:previewGain,getTrack:draftTrack,onError:status});}
   await context.setSinkId(output.deviceId);await context.resume();if(dead)return;
   const a=readPosition('start');if(from===null&&auditionStart===null&&(!Number.isFinite(a)||a<0||a>duration))throw Error('Eine gültige Startposition innerhalb des Liedes eingeben.');const join=joins.find(j=>j.cut[0]===a),before=Math.max(0,a-(join?.duration||0)-2);
   const target=from??auditionStart??before;if(!Number.isFinite(target)||target<0||target>=duration)throw Error('Eine Hörposition vor dem Liedende wählen.');player?.stop();audio.currentTime=nextKeptTime(cuts,duration,target);await audio.play();if(dead)stop();else status(audio.currentTime>target+.1?'Diese Stelle ist entfernt. Wiedergabe ab '+cutClock(audio.currentTime)+'.':'');
  }catch(error){if(!dead)status(error.message);}
 };
 q('[data-play]').onclick=()=>playPreview();
 q('[data-play-position]').onclick=()=>playPreview(auditionStart??readPosition('start'));
 const pausePreview=()=>{stop();auditionStart=audio.currentTime;draw();};q('[data-pause-position]').onclick=pausePreview;
 dialog.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.repeat||saving||optimization)return;
  if([...document.querySelectorAll('dialog[open]')].some(other=>other!==dialog&&!other.contains(dialog)))return;
  const key=event.key.toLowerCase(),command=event.ctrlKey||event.metaKey;
  if(command&&key==='s'&&!event.altKey&&!event.shiftKey){event.preventDefault();event.stopPropagation();q('[data-save]').click();return;}
  if(event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(command){if(event.altKey||event.shiftKey||key!=='z')return;event.preventDefault();event.stopPropagation();q('[data-undo]').click();return;}
  if(key===' '){if(event.target.closest('button,a,summary')||event.altKey)return;event.preventDefault();event.stopPropagation();if(event.shiftKey){auditionStart=null;void playPreview();}else if(!audio.paused)pausePreview();else void playPreview(auditionStart??readPosition('start'));return;}
  if(['arrowleft','arrowright','home','end'].includes(key)){event.preventDefault();event.stopPropagation();const step=event.altKey?0.1:event.shiftKey?5:1;jumpTo(key==='home'?0:key==='end'?duration:Math.max(0,Math.min(duration,audio.currentTime+(key==='arrowleft'?-step:step))));return;}
  if(event.altKey||event.shiftKey)return;
  if(key==='i'||key==='o'){event.preventDefault();event.stopPropagation();writePosition(key==='i'?'start':'end',audio.currentTime);auditionStart=null;draw();return;}
  if(key==='delete'){event.preventDefault();event.stopPropagation();q('[data-remove]').click();}
 });
 const unsubscribe=routing?.subscribeOutput?.(()=>{stop();updateOutput();status('');});
 const timer=setInterval(()=>{if(audio.paused)return;if(!player?.handles()){const next=nextKeptTime(cuts,duration,audio.currentTime);if(next>=duration){stop();audio.currentTime=duration;}else if(next!==audio.currentTime)audio.currentTime=next;}q('[data-seek]').value=audio.currentTime;draw();},20);
 q('[data-save]').onclick=async()=>{
  if(saving)return;saving=true;stop();status('');syncSaveState();
  try{if(JSON.stringify([track.audioCuts||[],track.audioCutJoins||[]])!==original)throw Error('Die Schnitte wurden inzwischen geändert. Editor bitte neu öffnen.');await onSave(structuredClone(cuts),structuredClone(joins));close();}
  catch(error){status(error.message);}finally{saving=false;syncSaveState();}
 };
 function dispose(){if(dead)return;dead=true;clearInterval(timer);resize.disconnect();unsubscribe?.();transitionEditor?.destroy();if(routing?.routingHost&&routingAnchor.parentNode){routing.routingHost.hidden=false;routingAnchor.after(routing.routingHost);}routingAnchor.remove();stop();player?.destroy();void context?.close().catch(()=>{});audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);dialog.remove();previous?.isConnected&&previous.focus();onClose?.();}
 function close(){if(host)dispose();else dialog.close();}
 dialog.oncancel=event=>{if(saving)event.preventDefault();};q('[data-close]').onclick=q('[data-cancel]').onclick=close;
 dialog.addEventListener('close',dispose,{once:true});
 render();updateOutput();if(!host)dialog.showModal();ruler();
 return {destroy(){if(!host&&dialog.open)dialog.close();dispose();}};
}
