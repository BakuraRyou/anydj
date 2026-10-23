const KEY='anydj-app-settings-v1';
const defaults={comfortable:false,contrast:false,motion:'system',awake:false,leaveGuard:true};
export function createAppSettings(){
 const root=document.documentElement,entry=document.querySelector('.dj-settings');
 let prefs={...defaults};try{const saved=JSON.parse(localStorage.getItem(KEY));for(const key of ['comfortable','contrast','awake','leaveGuard'])if(typeof saved?.[key]==='boolean')prefs[key]=saved[key];if(['system','reduced'].includes(saved?.motion))prefs.motion=saved.motion;}catch{}
 const dialog=document.createElement('dialog');dialog.className='app-settings-dialog';dialog.setAttribute('aria-labelledby','appSettingsTitle');
 dialog.innerHTML=`<header><div><h2 id="appSettingsTitle">Anwendungseinstellungen</h2><p>Gilt auf diesem Gerät und wird automatisch gespeichert.</p></div><button type="button" class="button secondary" data-close aria-label="Einstellungen schließen">Schließen</button></header>
 <section><h3>Darstellung & Bedienung</h3>
 <label class="app-setting"><span><strong>Größere Bedienelemente</strong><small>Größere Schrift und Schaltflächen im Arbeitsbereich.</small></span><input type="checkbox" data-pref="comfortable"></label>
 <label class="app-setting"><span><strong>Stärkere Kontraste</strong><small>Deutlichere Beschriftungen, Rahmen und Fokusmarkierungen.</small></span><input type="checkbox" data-pref="contrast"></label>
 <label class="app-setting"><span><strong>Oberflächenanimationen</strong><small>Betrifft die Bedienoberfläche. Die Lichtshow läuft unverändert weiter.</small></span><select data-pref="motion"><option value="system">Wie im System</option><option value="reduced">Reduziert</option></select></label>
 <div class="app-settings-actions" data-view-actions><button type="button" class="button secondary" data-fullscreen>Vollbild öffnen</button></div></section>
 <section><h3>Alltag & Sicherheit</h3>
 <label class="app-setting"><span><strong>Bildschirm wach halten</strong><small>Verhindert nach Möglichkeit das automatische Abschalten, solange AnyDj sichtbar ist.</small></span><input type="checkbox" data-pref="awake"></label><p class="small muted" data-wake role="status"></p>
 <label class="app-setting"><span><strong>Beim Verlassen während der Wiedergabe nachfragen</strong><small>Schützt laufende Decks vor versehentlichem Neuladen oder Schließen.</small></span><input type="checkbox" data-pref="leaveGuard"></label></section>
 <section><h3>Lokaler Speicher</h3><p>Bibliothek, Analysen und Einstellungen liegen im lokalen Speicher dieser Anwendung. Musikdateien bleiben an ihrem bisherigen Speicherort.</p><p class="small muted" data-storage role="status">Speicher wird geprüft …</p><button type="button" class="button secondary" data-persist>Speicher vor automatischer Bereinigung schützen</button><p class="small muted">Dies ist kein Backup. Beim Löschen der App-Daten können gespeicherte Einstellungen und Analysen verloren gehen.</p></section>
 <section><h3>Hilfe</h3><button type="button" class="button secondary" data-help>Tutorial & Fehler melden</button></section><p class="small muted" data-save role="status"></p>`;
 document.body.append(dialog);
 const q=s=>dialog.querySelector(s),status=q('[data-save]');
 if(window.anydjGraphics){
  const graphics=document.createElement('section');graphics.hidden=true;
  graphics.innerHTML='<h3>3D-Grafik & Videoexport</h3><label class="app-setting"><span><strong>Grafikkarte</strong><small>Die Hochleistungs-GPU kann große Lichtshows deutlich schneller rendern. Die Änderung gilt nach einem Neustart.</small></span><select data-graphics><option value="auto">Systemstandard</option><option value="nvidia">NVIDIA-Hochleistungs-GPU</option></select></label><p class="small muted" data-graphics-status role="status"></p>';
  q('[data-view-actions]').closest('section').after(graphics);
  const select=graphics.querySelector('[data-graphics]'),hint=graphics.querySelector('[data-graphics-status]');
  const update=value=>{graphics.hidden=!value.supported;select.value=value.preference;hint.textContent=value.restartRequired?'Gespeichert. Bitte AnyDj vollständig schließen und neu starten.':value.active==='nvidia'?'NVIDIA-Hochleistungs-GPU ist für diese Sitzung ausgewählt.':'Die Grafikkarte wird vom System ausgewählt.';};
  void window.anydjGraphics.get().then(update).catch(()=>{});
  select.onchange=async()=>{select.disabled=true;try{update(await window.anydjGraphics.set(select.value));}catch(error){hint.textContent=error.message;}finally{select.disabled=false;}};
 }
 // Preserve existing actions and their event handlers; analysis belongs with imports.
 const analysis=document.getElementById('djStructure')?.closest('label');
 if(analysis){analysis.hidden=false;const details=document.createElement('details');details.className='app-analysis-settings';details.innerHTML='<summary>Analyseoptionen</summary>';details.append(analysis);document.getElementById('libraryImportPopover').append(details);}
 const reset=[...entry.querySelectorAll('button')].find(n=>n.textContent==='Layout zurücksetzen');if(reset){reset.hidden=false;q('[data-view-actions]').append(reset);}
 const trigger=entry.querySelector('summary');entry.hidden=false;entry.open=false;entry.querySelector(':scope>div').hidden=true;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','appSettingsDialog');dialog.id='appSettingsDialog';
 trigger.addEventListener('click',event=>{event.preventDefault();dialog.showModal();void storageInfo();});
 q('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>queueMicrotask(()=>trigger.focus()));
 // App shortcuts must not reach the decks while configuring the application.
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
 function apply(){root.dataset.appComfortable=String(prefs.comfortable);root.dataset.appContrast=String(prefs.contrast);root.dataset.appReducedMotion=String(prefs.motion==='reduced'||systemMotion.matches);}
 systemMotion.addEventListener('change',apply);apply();
 for(const input of dialog.querySelectorAll('[data-pref]')){const key=input.dataset.pref;if(input.type==='checkbox')input.checked=prefs[key];else input.value=prefs[key];input.onchange=()=>{prefs[key]=input.type==='checkbox'?input.checked:input.value;apply();try{localStorage.setItem(KEY,JSON.stringify(prefs));status.textContent='Gespeichert.';}catch{status.textContent='Speichern nicht möglich. Die Auswahl gilt nur bis zum Schließen der Anwendung.';}if(key==='awake')void updateWake();};}
 let lock=null,pending=false,dead=false;
 async function updateWake(){
  if(!navigator.wakeLock){q('[data-wake]').textContent='Auf diesem Gerät nicht verfügbar.';q('[data-pref=awake]').disabled=true;return;}
  if(!prefs.awake||document.visibilityState!=='visible'){if(lock){const previous=lock;lock=null;await previous.release();}q('[data-wake]').textContent=prefs.awake?'Wird aktiv, sobald AnyDj wieder sichtbar ist.':'Aus';return;}
  if(lock||pending)return;pending=true;
  try{const next=await navigator.wakeLock.request('screen');if(dead||!prefs.awake||document.visibilityState!=='visible'){await next.release();return;}lock=next;q('[data-wake]').textContent='Aktiv · Bildschirm bleibt wach.';next.addEventListener('release',()=>{if(lock!==next)return;lock=null;q('[data-wake]').textContent='Vom System unterbrochen. Wird beim nächsten Aktivieren erneut versucht.';});}
  catch{q('[data-wake]').textContent='Derzeit vom System nicht erlaubt. Wird beim nächsten Aktivieren erneut versucht.';}finally{pending=false;}
 }
 document.addEventListener('visibilitychange',updateWake);window.addEventListener('focus',updateWake);void updateWake();
 window.addEventListener('beforeunload',event=>{if(prefs.leaveGuard&&[...document.querySelectorAll('.dj-deck audio')].some(audio=>!audio.paused&&!audio.ended)){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{dead=true;void lock?.release();},{once:true});
 const fullscreen=q('[data-fullscreen]');function fullscreenState(){fullscreen.textContent=document.fullscreenElement?'Vollbild verlassen':'Vollbild öffnen';fullscreen.disabled=!document.fullscreenEnabled;}
 fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{status.textContent='Vollbild konnte nicht aktiviert werden.';}};document.addEventListener('fullscreenchange',fullscreenState);fullscreenState();
 async function storageInfo(){try{const estimate=await navigator.storage?.estimate(),persisted=await navigator.storage?.persisted();q('[data-storage]').textContent=(Number.isFinite(estimate?.usage)?`${(estimate.usage/1048576).toFixed(1)} MB lokal belegt. `:'Speichergröße nicht verfügbar. ')+(persisted?'Dauerhafter Speicher ist aktiviert.':'Automatische Bereinigung durch Browser oder System ist möglich.');q('[data-persist]').disabled=!!persisted||!navigator.storage?.persist;}catch{q('[data-storage]').textContent='Speicherinformationen nicht verfügbar.';}}
 q('[data-persist]').onclick=async()=>{try{const granted=await navigator.storage.persist();await storageInfo();if(!granted)q('[data-storage]').textContent+=' Dauerhafter Speicher wurde nicht gewährt.';}catch{q('[data-storage]').textContent='Speicherschutz konnte nicht angefordert werden.';}};
 q('[data-help]').onclick=()=>{const help=document.querySelector('.animatus-tutorial-launcher');if(help){dialog.close();help.click();}else status.textContent='Die Hilfe wird noch geladen. Bitte gleich erneut versuchen.';};
}
