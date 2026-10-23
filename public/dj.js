import {createAppSettings} from './app-settings.js';
import {createDetachedQueue} from './dj-detach.js';
import {ensureLocalAccess} from './local-access.js';
import {migrateStorageKey} from './storage-migration.js';
import {createQueueExportMenu} from './queue-export-dialog.js';
import {openTrackCutEditor} from './track-cut-editor.js';
import {saveTransitionCutChanges} from './transition-cut-save.js';
import {keptRanges,nextKeptTime,keptPassageRemaining,fitCutTransition,cutTransitionFits} from './track-cuts.js';
import {inferFeelings} from './feeling-tags.js';
import {createFeelingLibrary} from './feeling-library.js';
import {createFlickerControl} from './light-flicker.js';
import {makeTransitionVariant,variantProblem,bindVariant} from './transition-library.js';
import {openTransitionLinks} from './transition-links.js';
import {stageMotionAt} from './stage-motion.js';
import {songPaletteAt} from './song-palette.js';
import {copySetTransition,matchingSetTransition} from './setlist-transition.js';
import {createLightTuning,tuneLightFrame} from './light-tuning.js';
import {transitionAudioProfile,transitionAudioGains,scheduleTransitionGain,holdAudioParam} from './transition-audio.js';
import {createTransitionPreview} from './transition-preview.js';
import {createFullMode} from './dj-full.js';
import {createTidalLibrary} from './tidal-library.js';
import {createDJTutorial} from './dj-tutorial.js';
import {spotifyImage} from './spotify-client.js';
import {spotifyQueueEntry,validQueueEntry,copyQueueEntry} from './provider-queue.js';
import {createShufflePicker,shuffleLookahead} from './dj-shuffle.js';
import {createLocalCovers} from './local-cover.js';
import {createDJSession} from './dj-session.js';
import {createSpotifyLibrary} from './spotify-library.js';
import {simplifyDJLayout} from './dj-layout.js';
import {createPerformance} from './dj-performance.js';
import {audioEnvelope} from './dj-performance-model.js';
import {transitionPoint,incomingCue,planTransitionPair,transitionProgress,transitionTonalSegments} from './musical-transition.js';
import {prepareStageMotifs,stageWashDimming,stageAccentStrength} from './stage-motifs.js';
import {beatPosition} from './dmx-show.js';
import {createDmxStage} from './dmx-stage.js';
import {alignedStart} from './beat-sync.js';
import {applyTrackColors,validColorMode,COLOR_MODES} from './dj-color-modes.js';
import {createColorPicker} from './dj-color-picker.js';
import {applySectionLighting,sectionPlanAt} from './section-lighting.js';
import {openSectionEditor} from './section-editor.js';
import {applySongShowProfile,resolveShowProfile,SHOW_PROFILES,movingMoodForProfile} from './dj-show-profile.js';
import {analysisStatus,transitionStatus} from './dj-status.js';
import {startPreviewClock} from './show-clock.js';
import { analyzeBeats } from './beat-analysis.js';
import { analyzeStyle } from './style-analysis.js';
import { analyzeStructure } from './structure-analysis.js';
import { showFrameAt, transitionFrame } from './show-plan.js';
import { deckGains, mixDeckFrames, fileIdentity, formatTime, crossfadePosition, automaticFadeSource } from './dj-model.js';
import { libraryTracks, readShow, saveShow, readLibrary, saveTrack, removeTrack, readFolder, saveFolder, saveFolderChanges, readQueue, saveQueue, readQueueLists, saveQueueLists, readTransitionLibrary, saveTransitionLibrary } from './dj-library.js';

import {scanFolder, folderChanges, audioFile} from './dj-folder.js';

let detachedQueue=null;
const $ = id => document.getElementById(id)||detachedQueue?.find(id);
const webMode=document.documentElement.dataset.edition==='web';
const token=webMode?'':await ensureLocalAccess();
let lightTuning;
// Restoring a visible stage can read its moving plans synchronously.
let tracks = [];
const adjustLight=frame=>tuneLightFrame(frame,lightTuning?.settings);
const lightStage=createDmxStage($('openLightStage'),{adjustFrame:adjustLight,getMovingPlans:()=>tracks.filter(t=>!t.deleted).flatMap(t=>t.plan?[t.plan,...Object.values(t.plan.profilePlans||{})]:[])});
if(webMode){$('djStructure').checked=false;$('djStructure').disabled=true;}
let showProfile='auto';
try{const saved=migrateStorageKey(localStorage,'anydj-dj-show-profile','-dj-show-profile');if(SHOW_PROFILES.includes(saved))showProfile=saved;}catch{}
$('djShowProfile').value=showProfile;
let globalColorMode=null;
try{const saved=JSON.parse(localStorage.getItem('anydj-light-palette')||'null');
  globalColorMode=validColorMode(saved)?saved:saved?.id==='legacy-auto'?COLOR_MODES.find(m=>m.id==='legacy-auto'):null;
}catch{}

const design = {arrangement:'auto', mood:'auto', minimum:5, maximum:100,...(webMode?{analysisMode:'browser'}:{})};
let context, closed = false;
lightStage.setMovingMood(movingMoodForProfile(showProfile));
let folder = null, folderBusy = false;
let preparing = false, refining = false, refineController;
const lifetime = new AbortController(), workers = new Set();
let fade = null,autoFadePaused=false;
let spotifyDeck=null,providerSwitch=false;
const shufflePicker=createShufflePicker(),shuffleEntries=new Set();
let shuffleEnabled=false;
let shuffleCount=3;
try{shuffleCount=shuffleLookahead(localStorage.getItem('anydj-shuffle-count'));}catch{}
let queue=[],queueRunning=false,queueBusy=false,queueEpoch=0,queueDeck=null,queueMessage='';
let activeSetId='';const setPlayed=new Set();
let transitionVariants=[],transitionLibraryReady=false,transitionLibrarySave=Promise.resolve();
let queueLists=[],selectedQueueList='',queueSourceName='',queueListsReady=false,queueListsSave=Promise.resolve(),queueListRevision=0;
const viewedQueue=()=>queueLists.find(list=>list.id===selectedQueueList);
const displayedQueue=()=>viewedQueue()?.entries||queue;
const editingLiveQueue=()=>!viewedQueue();
let queueSave=Promise.resolve(),queueSignature='',queueDrag=null;
let libraryDragging=false,queueDropActive=false;
let actions = Promise.resolve();

const perform = action => { actions = actions.then(action).catch(error => notice(error.message, true)); return actions; };
function notice(text, error = false) { $('djStatus').hidden = !error; $('djStatus').textContent = error ? text : '';  $('djStatus').className = `notice${error?' warning':''}`; }
async function persist(track) {
  try { await saveTrack(track); }
  catch { $('libraryStatus').textContent = 'Speichern ist in diesem Browser nicht verfügbar. Die Trackliste bleibt nur bis zum Neuladen erhalten.'; }
}
async function cacheShow(track) {
  if(track.deleted||!track.basePlan)return;
  try {await saveShow(track,design);}
  catch {$('libraryStatus').textContent='Lichtshow konnte nicht gespeichert werden. Nach dem Neuladen ist eine neue Berechnung nötig.';}
}
async function restoreShow(track) {
  const revision=track.revision||0;
  try {
    const saved=await readShow(track,design);
    if(!saved||track.recalculate||track.deleted||(track.revision||0)!==revision||track.plan)return;
    track.waveform=saved.waveform?.version===2?saved.waveform:null;track.windows=saved.windows;track.refined=saved.refined;
    track.structureState=saved.structureState;track.analysisWarnings=saved.analysisWarnings;
    track.state=saved.state;replacePlan(track,saved.plan);
  } catch { /* Unavailable storage must not prevent ordinary analysis. */ }
}
function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./show-worker.js',import.meta.url), {type:'module'}); workers.add(worker);
    const done = () => {worker.terminate(); workers.delete(worker); lifetime.signal.removeEventListener('abort', abort);};
    const abort = () => {done(); reject(Error('Analyse beendet.'));};
    lifetime.signal.addEventListener('abort', abort, {once:true});
    worker.onerror = () => {done(); reject(Error('Audioanalyse fehlgeschlagen.'));};
    worker.onmessage = ({data}) => {if(data.progress !== undefined) return; done(); data.error?reject(Error(data.error)):resolve(data);};
    worker.postMessage(data);
  });
}
const decks = ['A','B'].map((name, index) => {
  const panel = document.createElement('section'); panel.className = 'panel dj-deck'; panel.setAttribute('aria-label', `Deck ${name}`);
  panel.innerHTML = `<h2>DECK ${name}</h2><div class="dj-track-title">Track laden</div><canvas width="640" height="64" aria-label="Vorbereiteter Lichtverlauf"></canvas><p class="dj-look small"></p><p class="dj-analysis small muted" role="status">Leer</p><label>Position <input class="dj-seek range" type="range" min="0" max="1" value="0" step="0.01" disabled></label><output class="dj-clock">0:00 / 0:00</output><div class="dj-buttons"><button class="button primary dj-play" disabled>Play</button><button class="button secondary dj-cue" disabled>Cue</button><button class="button secondary dj-set-cue" disabled>Cue setzen</button><button class="button secondary dj-unload" disabled>Entladen</button></div><label>Lautstärke <input class="dj-volume range" type="range" min="0" max="1" value="1" step="0.01"></label>`;
  $('decks').append(panel);
  const edit=document.createElement('button');edit.className='button secondary dj-sections';edit.textContent='Abschnittslicht';edit.disabled=true;panel.append(edit);
  const audio = new Audio(); audio.preload = 'metadata'; audio.hidden = true; panel.append(audio);
  const deck = {name, index, panel, audio, track:null, cue:0, gain:null, url:null, transition:null};
  deck.colorPicker=createColorPicker(name,async(track,mode)=>{
    const previous=track.colorMode;track.colorMode=mode;
    try{await saveTrack(track);}catch(error){track.colorMode=previous;throw error;}
    if(track.basePlan)replacePlan(track,track.basePlan);
    for(const other of decks)if(other.track===track)other.colorPicker.update(track);
  });
  panel.querySelector('.dj-track-title').after(deck.colorPicker.element);deck.colorPicker.element.querySelector('.dj-color-menu').append(edit);deck.colorPicker.update(null);
  const profileLabel=document.createElement('label');profileLabel.className='dj-deck-show-profile';profileLabel.append('Lichtshow');
  const profileSelect=document.createElement('select');profileSelect.dataset.deckShowProfile=name;profileSelect.setAttribute('aria-label',`Lichtshow für Song in Deck ${name}`);profileSelect.title='Wird für diesen Song gespeichert';profileSelect.disabled=true;
  profileSelect.replaceChildren(...[...$('djShowProfile').options].map(option=>new Option(option.textContent,option.value)));profileLabel.append(profileSelect);panel.querySelector('.dj-track-title').after(profileLabel);
  deck.profileSelect=profileSelect;
  profileSelect.onchange=async()=>{profileSelect.disabled=true;try{await setTrackShowProfile(name,profileSelect.value);profileSelect.setCustomValidity('');}catch(error){profileSelect.setCustomValidity(error.message);profileSelect.reportValidity();}finally{syncDeckShowProfile(deck);}};
  edit.onclick=()=>editSections(deck.track,()=>deck.audio.currentTime);
  panel.querySelector('.dj-play').onclick = () => perform(() => toggleDeck(deck));
  panel.querySelector('.dj-cue').onclick = () => { pauseQueue();cancelFade(); return perform(async () => {audio.pause(); audio.currentTime = deck.cue; deck.loop=null; deck.transition = null;}); };
  panel.querySelector('.dj-set-cue').title='Cue exakt festlegen · Shift-Klick: Cue aufheben';
  panel.querySelector('.dj-set-cue').onclick = event => {deck.cue = event.shiftKey?0:audio.currentTime; deck.cueLocked=!event.shiftKey; panel.querySelector('.dj-cue').textContent = `Cue ${formatTime(deck.cue)}`;};
  panel.querySelector('.dj-unload').onclick = () => {pauseQueue();return perform(async () => {await unload(deck); await syncFolder();});};
  panel.querySelector('.dj-seek').oninput = event => deck.spotify?void spotifyLibrary.playback.seek(Number(event.target.value)).catch(e=>notice(e.message,true)):performanceControls.seek(deck,Number(event.target.value));
  panel.querySelector('.dj-volume').oninput = updateGains;
  audio.onseeking = () => {deck.pairPlan=null;};
  audio.addEventListener('timeupdate',()=>skipTrackCuts(deck));
  audio.addEventListener('seeking',()=>skipTrackCuts(deck));
  audio.addEventListener('seeked',()=>skipTrackCuts(deck));
  audio.addEventListener('loadedmetadata',()=>skipTrackCuts(deck));
  audio.onpause = () => { if(!providerSwitch&&queueRunning&&deck===queueDeck&&!audio.ended)pauseQueue();if (fade && (fade.to===deck || (fade.from===deck && !audio.ended))) cancelFade(); };
  audio.onerror = () => perform(async () => {pauseQueue('Datei kann nicht abgespielt werden.');audio.pause(); notice(`Deck ${name}: Datei kann nicht abgespielt werden. Bitte erneut verknüpfen.`, true);});
  bindDrop(panel, async (files, track, remote) => {if(remote){await loadSpotifyDeck(deck,remote);return;}const imported = track?[track]:await addFiles(files); if(imported[0]) await loadDeck(deck, imported[0]);});
  return deck;
});
// Put the central mixer between the decks in both visual and keyboard order.
const mixer=document.querySelector('.dj-mixer');
$('decks').insertBefore(mixer,decks[1].panel);
const performanceControls=createPerformance({decks,mixer,ready:audioReady,
  manual:()=>{pauseQueue();cancelFade();},save:persist,report:message=>notice(message,true),
  sync:deck=>{
    const other=decks.find(d=>d!==deck&&!d.audio.paused);
    if(!other)throw Error('Zum Synchronisieren muss das andere Deck laufen.');
    const target=alignedStart(beatGridFor(other),other.audio.currentTime,other.audio.playbackRate,beatGridFor(deck),deck.audio.currentTime);
    if(!target)throw Error('Kein passendes Beat-Raster für Sync verfügbar.');
    deck.loop=null;deck.audio.currentTime=target.time;deck.audio.playbackRate=target.rate;deck.manualRate=target.rate;deck.transition=null;
  }});
simplifyDJLayout(decks,mixer,lightStage);
createAppSettings();
for(const deck of decks){const cut=document.createElement('button');cut.type='button';cut.className='button secondary';cut.textContent='Lied schneiden';cut.onclick=()=>perform(()=>editTrackAudio(deck.track));deck.panel.querySelector('.dj-transport-options').append(cut);}
function syncDeckShowProfile(deck){
 const input=deck.profileSelect,disabled=!deck.track||Boolean(deck.spotify)||Boolean(deck.track.profileSaving);
 if(input.disabled!==disabled)input.disabled=disabled;
 let inherited=input.querySelector('option[value=default]');if(!inherited){inherited=new Option('', 'default');input.prepend(inherited);}
 const label=`Standard verwenden (${$('djShowProfile').selectedOptions[0].textContent})`;
 if(inherited.textContent!==label)inherited.textContent=label;
 const value=SHOW_PROFILES.includes(deck.track?.showProfile)?deck.track.showProfile:'default';
 if(input.value!==value)input.value=value;
}
async function setTrackShowProfile(id,value){
 const track=decks.find(d=>d.name===id)?.track;if(!track||track.profileSaving||(value!=='default'&&!SHOW_PROFILES.includes(value)))return;
 const previous=track.showProfile;if(value==='default')delete track.showProfile;else track.showProfile=value;track.profileSaving=true;
 try{await saveTrack(track);if(track.basePlan)replacePlan(track,track.basePlan);updateLightPreview();}
 catch(error){track.showProfile=previous;throw error;}
 finally{track.profileSaving=false;for(const deck of decks)syncDeckShowProfile(deck);}
}
// Optional 3D transport uses the same deck actions as the main controls.
const stageLightDrafts=new Map();
lightStage.setTransport({
  getShowProfiles:()=>[{value:'default',label:'Standard verwenden'},...[...$('djShowProfile').options].map(option=>({value:option.value,label:option.textContent}))],
  setTrackShowProfile,
  getMixer:()=>({position:Number($('crossfader').value),mix:$('mixValue').textContent,canCrossfade:!$('crossfader').disabled,
    auto:$('autoCrossfade').checked,canAuto:!$('autoCrossfade').disabled,duration:$('fadeDuration').value,canDuration:!$('fadeDuration').disabled,
    fading:!$('fadeCancel').hidden,canFade:!$('fadeCancel').hidden||!$('fadeNow').disabled,status:$('fadeStatus').textContent}),
  setCrossfade:value=>{const input=$('crossfader');if(input.disabled)return;input.value=value;input.dispatchEvent(new Event('input'));},
  setAutoCrossfade:value=>{const input=$('autoCrossfade');if(input.disabled)return;input.checked=value;input.dispatchEvent(new Event('change'));},
  setFadeDuration:value=>{const input=$('fadeDuration');if(input.disabled)return;input.value=value;input.dispatchEvent(new Event('change'));},
  fade:()=>($('fadeCancel').hidden?$('fadeNow'):$('fadeCancel')).click(),
  getPlaylists:()=>({selected:selectedQueueList,ready:queueListsReady,
    lists:[{id:'',name:'Aktuelle Warteschlange'},...queueLists.map(({id,name})=>({id,name}))],
    running:queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList),canResume:canResumeQueue(),
    canStart:(!(queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList))?!$('queuePlay').disabled:!$('queueStart').disabled)&&(queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList)||!(fade||decks.filter(d=>!d.audio.paused).length>1)),
    status:fade?'Übergang läuft.':decks.filter(d=>!d.audio.paused).length>1?'Zum Start nur ein Deck laufen lassen.':$('queueStatus').textContent,
    entries:displayedQueue().map(entry=>{const track=entry.provider==='spotify'?entry.remote:tracks.find(t=>t.id===entry.trackId);const deck=decks.find(d=>d.queueEntry===entry.id||d.setEntry?.sourceEntryId===entry.id);
      return {id:entry.id,title:track?.name||'Track fehlt',status:deck&&!deck.audio.paused?'Spielt · Deck '+deck.name:entry.provider==='spotify'?'Spotify':analysisStatus(track,$('djStructure').checked).text};})}),
  selectPlaylist:id=>{if(!queueListsReady||id&&!queueLists.some(list=>list.id===id))return;const select=$('queueSelect');select.value=id;select.dispatchEvent(new Event('change'));},
  startPlaylist:async()=>{const error=await (queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList)?$('queueStart').onclick():resumeQueue());if(error)throw Error(error);},
  getTracks:()=>tracks.filter(t=>!t.deleted).map(t=>({id:t.id,title:t.name,ready:Boolean(t.plan&&!t.missing&&!t.pendingChange)})),
  importFiles:files=>addFiles(files),
  mountEditor:async(id,host,options)=>{const d=decks.find(d=>d.name===id);if(!d?.track?.basePlan?.arrangement)return null;return editSections(d.track,()=>d.audio.currentTime,{...options,host,externalAudio:d.audio,edits:stageLightDrafts.get(d.track.id)});},
  editTrack:async id=>{const d=decks.find(d=>d.name===id);if(d?.track)await editSections(d.track,()=>d.audio.currentTime);},
  loadTrack:async(id,trackId)=>{const d=decks.find(d=>d.name===id),track=tracks.find(t=>t.id===trackId&&!t.deleted);if(!d||!track?.plan)throw Error('Song ist noch nicht vorbereitet.');if(!d.audio.paused||(d.spotifyStarted&&!d.spotifyPaused))throw Error('Deck zuerst pausieren.');pauseQueue();cancelFade();await loadDeck(d,track);},
  shortcut:(event,deckId)=>performanceControls.handleShortcut(event,{stage:true,deckId}),
  getDecks:()=>decks.map(d=>{
    const seek=d.panel.querySelector('.dj-seek'),play=d.panel.querySelector('.dj-play');
    return {id:d.name,trackId:d.track?.id||d.spotify?.id||null,title:d.track?.name||d.spotify?.name||'',waveform:d.track?.waveform,showProfile:resolveShowProfile(d.track?.showProfile,showProfile),showProfileInherited:!SHOW_PROFILES.includes(d.track?.showProfile),defaultShowProfileLabel:$('djShowProfile').selectedOptions[0].textContent,canSetShowProfile:Boolean(d.track&&!d.track.profileSaving&&!d.spotify),
      analysis:d.spotify?null:analysisStatus(d.track,$('djStructure').checked),
      duration:d.spotify?Number(seek.max):d.track?.plan?.duration||0,position:d.spotify?Number(seek.value):d.resumeTime??d.audio.currentTime,
      volume:Number(d.panel.querySelector('.dj-volume').value),rate:d.audio.playbackRate,playing:d.spotify?play.textContent==='Pause':!d.audio.paused,
      canEdit:Boolean(d.track?.basePlan?.arrangement),canLoad:d.audio.paused&&!(d.spotifyStarted&&!d.spotifyPaused),canSeek:!seek.disabled,canPlay:!play.disabled,canRate:!d.spotify&&Boolean(d.track?.plan)&&d.resumeTime==null,
      note:d.spotify?'Spotify: Positionssprünge bei aktiver Wiedergabe; Tempo wird nicht unterstützt.':''};
  }),
  seek:(id,value)=>{const d=decks.find(d=>d.name===id),input=d?.panel.querySelector('.dj-seek');if(input&&!input.disabled){input.value=value;input.dispatchEvent(new Event('input'));}},
  setVolume:(id,value)=>{if(!Number.isFinite(value))return;const input=decks.find(d=>d.name===id)?.panel.querySelector('.dj-volume');if(input){input.value=Math.max(0,Math.min(1,value));input.dispatchEvent(new Event('input'));}},
  setRate:(id,value)=>{const d=decks.find(d=>d.name===id);if(!d||d.spotify||!d.track?.plan||d.resumeTime!=null)return;const input=d.panel.querySelector('[data-tempo]');input.value=value;input.dispatchEvent(new Event('input'));},
  toggle:id=>decks.find(d=>d.name===id)?.panel.querySelector('.dj-play').click()
});
const flickerControl=createFlickerControl(mixer.querySelector('.dj-light-settings'),()=>updateLightPreview());
const paletteSettings={colorMode:globalColorMode};
const globalColorPicker=createColorPicker('Lichtoptionen',async(settings,mode)=>{
  localStorage.setItem('anydj-light-palette',JSON.stringify(mode));
  globalColorMode=mode;settings.colorMode=mode;
  for(const track of tracks)if(track.basePlan)replacePlan(track,track.basePlan);
  updateLightPreview();
},{global:true});
globalColorPicker.element.id='djLightPalette';globalColorPicker.update(paletteSettings);
mixer.querySelector('.dj-light-settings').append(globalColorPicker.element);

const fullButton=document.createElement('button');fullButton.type='button';fullButton.className='button secondary';fullButton.textContent='Full';fullButton.title='Party-Lichtshow im Vollbild öffnen';
mixer.querySelector('.dj-light-heading').append(fullButton);
const fullMode=createFullMode(fullButton,{adjustFrame:adjustLight});
lightTuning=createLightTuning(lightStage.tuningHost,()=>updateLightPreview());
lightTuning.root.open=true;
const tuneButton=document.createElement('button');tuneButton.type='button';tuneButton.className='button secondary';tuneButton.textContent='Licht feinjustieren';tuneButton.onclick=()=>lightStage.openSettings('tuning');
mixer.querySelector('.dj-light-settings').append(tuneButton);
lightStage.mountOptions(mixer.querySelector('.dj-light-settings'),fullButton);
const transitionEditor=createTransitionPreview({host:document.querySelector('.dj-mixer-transition'),
 routing:performanceControls,
 allowCutRestore:true,
 onEditCuts:async(pair,index,options)=>{
  const track=pair.libraryTracks[index];
  if(!track||fileIdentity(track)!==pair.identities[index])throw Error('Der Titel wurde inzwischen geändert. Paar bitte neu laden.');
  const beforeSave=()=>{
   if(pair.libraryTracks.some((track,i)=>track.deleted||fileIdentity(track)!==pair.identities[i]))throw Error('Ein Titel wurde inzwischen geändert. Paar bitte neu laden.');
   if(pair.source&&(pair.source.track!==pair.libraryTracks[0]||decks[1-pair.source.index].track!==pair.libraryTracks[1]))throw Error('Das Titelpaar in den Decks wurde geändert. Paar bitte neu laden.');
  };beforeSave();
  return editTrackAudio(track,{...options,beforeSave,onSaved:()=>{
   for(const [i,source] of [pair.from,pair.to].entries()){
    source.audioCuts=structuredClone(pair.libraryTracks[i].audioCuts||[]);source.audioCutJoins=structuredClone(pair.libraryTracks[i].audioCutJoins||[]);
   }
   // Saving cuts invalidates the live pair cache. Keep the draft, but refresh its token.
   if(pair.source)pair.token=plannedTransition(pair.source);
   options.onSaved();
  }});
 },
 getUnavailableReason:()=>fade?'Der laufende Übergang muss zuerst beendet werden.':decks.some(d=>d.spotify)?'Für die Hörprobe zwei lokale Audiodateien laden.':decks.some(d=>d.resumeTime!=null)?'Zuerst die Dateien in den Decks über „Datei verbinden“ erneut verbinden.':decks.some(d=>!d.track)?'Einen lokalen Titel in Deck A und einen in Deck B laden.':decks.some(d=>!d.track.plan)?'Die Songanalyse läuft noch. Danach „Paar neu laden“ wählen.':'Das nächste Deck der Warteschlange ist noch nicht bereit. Zwei vorbereitete Titel laden und das Paar neu laden.',
 getPair:(direction='auto')=>{
  const source=fadeSource(),from=decks[direction==='0'||direction==='1'?Number(direction):source>=0?source:Number($('crossfader').value)<.5?0:1],to=decks[1-from.index];
  if(fade||!from.track?.plan||!to.track?.plan||!from.url||!to.url||from.resumeTime!=null||to.resumeTime!=null)return null;
  if(queueRunning&&to.queueEntry!==queue[0]?.id)return null;
  const plan=plannedTransition(from);if(!plan.duration)return null;
  const snapshot=d=>({name:d.name,track:{name:d.track.name},waveform:d.track.waveform,duration:d.track.plan.duration,audioCuts:structuredClone(d.track.audioCuts||[]),audioCutJoins:structuredClone(d.track.audioCutJoins||[]),url:d.url,rate:d.audio.playbackRate,pitch:d.audio.preservesPitch,
   volume:Number(d.panel.querySelector('.dj-volume').value),eq:Object.fromEntries([...d.panel.querySelectorAll('[data-eq]')].map(e=>[e.dataset.eq,Number(e.value)]))});
  return {identities:[fileIdentity(from.track),fileIdentity(to.track)],libraryTracks:[from.track,to.track],source:from,token:plan,position:from.index===0?Number($('crossfader').value):1-Number($('crossfader').value),from:snapshot(from),to:snapshot(to),plan:{...plan}};
 },
 onChoose:async(pair,choice,remember)=>{
  return saveTransitionCutChanges(pair,{save:items=>saveFolderChanges(items,[]),validate:changes=>{
   if(pair.libraryTracks.some((t,i)=>t.deleted||fileIdentity(t)!==pair.identities[i]))throw Error('Ein Titel wurde inzwischen geändert. Paar bitte neu laden.');
   if(pair.source&&(fade||pair.source.track!==pair.libraryTracks[0]||decks[1-pair.source.index].track!==pair.libraryTracks[1]||plannedTransition(pair.source)!==pair.token||pair.source.audio.currentTime>choice.time))throw Error('Das Titelpaar oder die Deckposition wurde geändert. Paar bitte neu laden.');
   if(pair.setlist){const {list,entry,previous,fromPlan,toPlan}=pair.setlist,entries=list?.entries||queue,index=entries.indexOf(entry);if((list?!queueLists.includes(list):Boolean(fade?.fromQueue))||index<1||entries[index-1]!==previous||tracks.find(t=>t.id===previous.trackId)?.plan!==fromPlan||tracks.find(t=>t.id===entry.trackId)?.plan!==toPlan)throw Error('Die Setliste wurde inzwischen geändert. Paar bitte neu laden.');}
   const affected=changes.map(c=>pair.libraryTracks[c.index]);
   if(decks.some(d=>affected.includes(d.track)&&!d.audio.paused)||fade&&[fade.from.track,fade.to.track].some(t=>affected.includes(t)))throw Error('Zum Wiederherstellen die betroffenen Titel in den Decks pausieren und den laufenden Übergang beenden.');
  },changed:()=>{
   for(const deck of decks){deck.pairPlan=null;if(pair.libraryTracks.includes(deck.track)){deck.cutPlayback?.stop();deck.loop=null;}}
   if(pair.source&&pair.source.track===pair.libraryTracks[0]&&decks[1-pair.source.index].track===pair.libraryTracks[1])pair.token=plannedTransition(pair.source);
   renderLibrary();renderQueue();
  },accept:async()=>{
  if(pair.libraryTracks&&!cutTransitionFits(choice,...pair.libraryTracks,pair.from.rate,pair.to.rate))throw Error('Der Übergang liegt in einem entfernten Liedteil. Zeitpunkte bitte anpassen.');
  if(pair.linkLibrary){await storeTransitionVariant(pair,choice);return true;}
  if(pair.saveReusable)await storeTransitionVariant(pair,choice);
  if(pair.setlist){
   const {list,entry,previous,fromPlan,toPlan}=pair.setlist,entries=list?.entries||queue,index=entries.indexOf(entry);
   if((list?!queueLists.includes(list):Boolean(fade?.fromQueue))||index<1||entries[index-1]!==previous||tracks.find(t=>t.id===previous.trackId)?.plan!==fromPlan||tracks.find(t=>t.id===entry.trackId)?.plan!==toPlan)return false;
   const saved=copySetTransition({fromEntryId:previous.id,fromTrackId:previous.trackId,toTrackId:entry.trackId,fromDuration:pair.from.duration,toDuration:pair.to.duration,plan:choice});
   if(!saved)return false;entry.transition=saved;if(list)persistLists();else{queueEpoch++;persistQueue();}renderQueue();return list?queueListsSave:queueSave;
  }
  const from=pair.source;
  if(fade||plannedTransition(from)!==pair.token||from.audio.currentTime>choice.time)return false;
  if(remember){$('transitionPreference').value=choice.style;$('transitionPreference').dispatchEvent(new Event('change'));from.pairPlan.keys[15]=choice.style;}
  from.pairPlan.value={...choice,manual:true,alternatives:pair.token.alternatives};pair.token=from.pairPlan.value;
  return true;
  }});
 }
});
const spotifyLibrary=createSpotifyLibrary({getTracks:()=>tracks,
  enqueueSpotifyTracks:items=>{
    if(!queueListsReady)throw Error('Bibliothek wird noch geladen.');
    displayedQueue().push(...items.map(track=>spotifyQueueEntry(track)));persistDisplayedQueue();renderQueue();
  },
  loadSpotify:(name,remote)=>perform(()=>loadSpotifyDeck(decks.find(d=>d.name===name),remote)),
  playSpotify:remote=>perform(async()=>{const target=decks.find(d=>d.audio.paused&&d!==spotifyDeck)||decks[0];await loadSpotifyDeck(target,remote);await toggleDeck(target);}),
  onSpotifyState:value=>{
    if(!spotifyDeck)return;
    const wasPlaying=spotifyDeck.spotifyPaused===false;
    spotifyDeck.spotifyPaused=value?.paused??true;
    if(value?.paused&&wasPlaying&&queueRunning)pauseQueue('Spotify pausiert');
    if(value&&!value.paused){
      // Transfers from other Spotify clients must never overlap local audio.
      providerSwitch=true;for(const d of decks)d.audio.pause();providerSwitch=false;
    }
  },
  onSpotifyEnded:()=>{if(spotifyDeck){spotifyDeck.spotifyEnded=true;spotifyDeck.spotifyStarted=false;spotifyDeck.spotifyPaused=true;spotifyDeck=null;}void advanceQueue();},
  onSpotifyError:(message,options)=>{if(spotifyDeck){spotifyDeck.spotifyPaused=true;if(!options?.resume)spotifyDeck.spotifyStarted=false;pauseQueue(message);}notice(message,true);},
  enqueueTracks:items=>{
    if(!queueListsReady)throw Error('Bibliothek wird noch geladen. Bitte kurz warten.');
    for(const track of items)displayedQueue().push({id:crypto.randomUUID(),trackId:track.id});
    persistDisplayedQueue();renderQueue();
  },
  saveList:async(name,items)=>{
    if(!queueListsReady)throw Error('Bibliothek wird noch geladen. Bitte kurz warten.');
    if(!items.length)throw Error('Bitte zuerst lokale Dateien zuordnen.');
    const list={id:crypto.randomUUID(),name:('Spotify · '+name).slice(0,80),entries:items.map(t=>({id:crypto.randomUUID(),trackId:t.id}))};
    queueLists.push(list);selectedQueueList=list.id;persistLists();renderQueue();if(!await queueListsSave)throw Error('DJ-Liste ist nur in diesem Fenster verfügbar: Speichern fehlgeschlagen.');
  },
  loadLocal:(name,track)=>perform(async()=>{if(!track)throw Error('Bitte eine lokale Datei zuordnen.');const deck=decks.find(d=>d.name===name);if(!deck.audio.paused)throw Error('Deck zuerst pausieren.');await loadDeck(deck,track);}),
  addLocal:async file=>(await addFiles([{file}]))[0],
});
const tidalLibrary=createTidalLibrary({getTracks:()=>tracks,
  enqueueTracks:items=>{
    if(!queueListsReady)throw Error('Bibliothek wird noch geladen.');
    for(const track of items)displayedQueue().push({id:crypto.randomUUID(),trackId:track.id});
    persistDisplayedQueue();renderQueue();
  },
  loadLocal:(name,track)=>perform(async()=>{if(!track)throw Error('Lokale Datei nicht verfügbar.');await loadDeck(decks.find(d=>d.name===name),track);}),
});
function stopSpotify(){
  const old=spotifyDeck;spotifyDeck=null;spotifyLibrary.playback.stop();
  if(old){old.spotifyStarted=false;old.spotifyPaused=true;old.spotifyEnded=true;}
}
async function loadSpotifyDeck(deck,remote,fromQueue=false){
  const entry=spotifyQueueEntry(remote);
  if(!fromQueue)pauseQueue();
  if(!deck.audio.paused||(deck===spotifyDeck&&!deck.spotifyPaused))throw Error(`Deck ${deck.name} zuerst pausieren.`);
  await unload(deck);deck.spotify=entry.remote;deck.spotifyPaused=true;deck.spotifyEnded=false;
  deck.panel.querySelector('.dj-track-title').textContent=remote.name+' · '+(remote.artists||[]).join(', ');
  deck.panel.querySelector('.dj-track-title').title=remote.name;
  const provider=document.createElement('a');provider.className='spotify-deck-link';provider.textContent='In Spotify öffnen';provider.href='https://open.spotify.com/track/'+entry.remote.id;provider.target='_blank';provider.rel='noopener noreferrer';
  deck.panel.querySelector('.dj-transport-options').append(provider);
  const brand=document.querySelector('.spotify-brand svg')?.cloneNode(true);if(brand){brand.classList.add('spotify-deck-brand');deck.panel.querySelector('h2').append(brand);}

  deck.panel.querySelector('.dj-waveform').hidden=true;
  const image=document.createElement('img');image.className='spotify-deck-cover';image.alt='';image.width=80;image.height=80;
  const url=spotifyImage(remote.image?[{url:remote.image}]:[]);
  if(url){image.src=url;image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();deck.panel.querySelector('.dj-track-title').after(image);}
  drawDeck(deck);
}
async function startSpotifyDeck(deck){
  spotifyLibrary.playback.ensureAuthorized();
  providerSwitch=true;
  try{cancelFade(true);lightStage.stop();for(const d of decks)d.audio.pause();}
  finally{providerSwitch=false;}
  stopSpotify();spotifyDeck=deck;deck.spotifyStarted=true;deck.spotifyEnded=false;deck.spotifyPaused=true;
  $('crossfader').value=deck.index;updateGains();
  try{await spotifyLibrary.playback.play(deck.spotify.id,Number(deck.panel.querySelector('.dj-volume').value)*Number(document.querySelector('[data-master]').value));}
  catch(error){deck.spotifyStarted=false;throw error;}
}
document.querySelector('[data-master]').addEventListener('input',()=>{if(spotifyDeck)updateGains();});
const browserSession=createDJSession({decks,updateGains,drawDeck,restoreFile:restoreDeckFile,
  reconnect:deck=>{if(deck.track?.handle)void perform(()=>restoreDeckFile(deck));else if(deck.track)relink(deck.track);}});
async function restoreDeckFile(deck,options){
  const track=deck.track;if(!track||deck.resumeTime==null)return;
  const file=await ensureFile(track,options);if(deck.track!==track)return;
  const time=deck.resumeTime;
  if(deck.url)URL.revokeObjectURL(deck.url);
  deck.url=URL.createObjectURL(file);deck.audio.src=deck.url;
  await new Promise((resolve,reject)=>{
    const clean=()=>{deck.audio.removeEventListener('loadedmetadata',loaded);deck.audio.removeEventListener('error',failed);clearTimeout(timeout);};
    const loaded=()=>{clean();resolve();};const failed=()=>{clean();reject(Error('Datei konnte nicht geöffnet werden.'));};
    const timeout=setTimeout(failed,10000);deck.audio.addEventListener('loadedmetadata',loaded,{once:true});deck.audio.addEventListener('error',failed,{once:true});
  });
  deck.audio.currentTime=Math.min(time,deck.audio.duration||time);deck.audio.playbackRate=deck.manualRate||1;
  deck.resumeTime=null;deck.resumeButton.hidden=true;void performanceControls.waveform(track,file);
}
const beatGridFor=deck=>deck.track?.plan?.beatGrid?.beats;
function prepareDeckStart(deck){
  skipTrackCuts(deck);
  deck.audio.preservesPitch=deck.panel.querySelector('[data-keylock]')?.checked!==false;
}
$('autoBeat').onchange=()=>{
  try{localStorage.setItem('anydj-auto-beat',String($('autoBeat').checked));}catch{}
};
$('autoBeat').checked=true;
try{$('autoBeat').checked=localStorage.getItem('anydj-auto-beat')!=='false';}catch{}
try{const saved=localStorage.getItem('anydj-entry-window');if(['2','16','30'].includes(saved))$('transitionEntryWindow').value=saved;}catch{}
$('transitionEntryWindow').onchange=()=>{try{localStorage.setItem('anydj-entry-window',$('transitionEntryWindow').value);}catch{}};
try{const saved=localStorage.getItem('anydj-transition-preference');if(['smooth','bass','handover','cut'].includes(saved))$('transitionPreference').value=saved;}catch{}
$('transitionPreference').onchange=()=>{try{localStorage.setItem('anydj-transition-preference',$('transitionPreference').value);}catch{}};
function fadeSeconds(){return Number($('fadeDuration').value)||8;}
function cutPlan(track){
  const plan=track?.plan;if(!plan||!track.audioCuts?.length)return plan;
  const kept=keptRanges(track.audioCuts,plan.duration);return {...plan,duration:kept.at(-1)?.[1]??plan.duration};
}
function skipTrackCuts(deck){
  deck.cutPlayback?.tick();
  if(!deck.track?.audioCuts?.length||!deck.track.plan||deck.spotify||deck.audio.seeking||deck.cutPlayback?.handles())return;
  const time=deck.audio.currentTime,next=nextKeptTime(deck.track.audioCuts,deck.track.plan.duration,time);
  if(next>time+.00001){deck.loop=null;deck.transition=null;deck.pairPlan=null;deck.audio.currentTime=next;}
}
async function editTrackAudio(track,{host,onSaved,onClose,beforeSave}={}){
  if(!track?.plan)throw Error('Den Titel zuerst vorbereiten.');
  const file=await ensureFile(track),identity=fileIdentity(track),plan=track.plan;
  if(host&&!host.isConnected)return null;
  return openTrackCutEditor({track,file,host,onClose,routing:performanceControls,onSave:async(cuts,joins)=>{
    beforeSave?.();
    if(track.deleted||fileIdentity(track)!==identity||track.plan!==plan)throw Error('Der Titel wurde inzwischen geändert. Editor bitte neu öffnen.');
    if(decks.some(d=>d.track===track&&!d.audio.paused)||fade&&[fade.from.track,fade.to.track].includes(track))throw Error('Den Titel vor dem Speichern in den Decks pausieren und den Übergang beenden.');
    const previous=track.audioCuts,previousJoins=track.audioCutJoins;track.audioCuts=cuts;track.audioCutJoins=joins;
    try{await saveTrack(track);}catch(error){track.audioCuts=previous;track.audioCutJoins=previousJoins;throw error;}
    for(const deck of decks)if(deck.track===track){deck.cutPlayback?.stop();deck.pairPlan=null;deck.loop=null;skipTrackCuts(deck);}
    for(const deck of decks)deck.pairPlan=null;
    renderLibrary();renderQueue();onSaved?.();
  }});
}
function plannedTransition(deck){
  const next=decks[1-deck.index];
  if(!next?.track?.plan||(queueRunning&&next.queueEntry!==queue[0]?.id))return transitionPoint(cutPlan(deck.track),fadeSeconds(),deck.audio.playbackRate,$('autoBeat').checked);
  const saved=queueRunning&&matchingSetTransition(queue[0],deck.setEntry,deck.track?.plan||{},next.track.plan,deck.audio.playbackRate,next.audio.playbackRate,deck.track,next.track);
  const keys=[deck.track?.plan,next.track.plan,next.cue,deck.audio.playbackRate,next.audio.playbackRate,fadeSeconds(),$('autoBeat').checked,$('fadeDuration').value==='auto',next.queueEntry,deck.track,next.track,Number($('transitionEntryWindow').value),Boolean(next.cueLocked),deck.track?.windows,next.track.windows,$('transitionPreference').value,queueRunning?queue[0]?.transition:null,deck.setEntry];
  if(!deck.pairPlan||!keys.every((key,i)=>key===deck.pairPlan.keys[i]))deck.pairPlan={keys,value:saved||planTransitionPair(cutPlan(deck.track),cutPlan(next.track),{cue:keys[2],rateA:keys[3],rateB:keys[4],seconds:keys[5],musical:keys[6],adaptive:keys[7],notBefore:deck.audio.currentTime,entryWindow:keys[11],cueLocked:keys[12],tonalA:transitionTonalSegments(keys[13]),tonalB:transitionTonalSegments(keys[14]),preferredStyle:keys[15]})};
  if(!saved&&(deck.track.audioCuts?.length||next.track.audioCuts?.length)&&!deck.pairPlan.cutFitted){
    deck.pairPlan.value=fitCutTransition(deck.pairPlan.value,deck.track,next.track,{rateA:deck.audio.playbackRate,rateB:next.audio.playbackRate,notBefore:deck.audio.currentTime});deck.pairPlan.cutFitted=true;
    deck.pairPlan.value.audioProfile=keys[6]&&keys[7]?transitionAudioProfile(deck.track.windows,next.track.windows,deck.pairPlan.value,{rateA:keys[3],rateB:keys[4],sameTrack:deck.track.id===next.track.id}):null;
  }
  const value=deck.pairPlan.value;
  for(const plan of new Set([value,...(value.alternatives||[])]))if(!Object.hasOwn(plan,'audioProfile'))
    plan.audioProfile=keys[6]&&keys[7]?transitionAudioProfile(deck.track.windows,next.track.windows,plan,{rateA:keys[3],rateB:keys[4],sameTrack:deck.track.id===next.track.id}):null;
  return value;
}
setInterval(()=>{
  if(closed)return;
  const audible=fadeSource(),sourceIndex=audible>=0?audible:(Number($('crossfader').value)<.5?0:1);
  const sourceDeck=fade?.from||decks[sourceIndex],nextDeck=fade?.to||decks[1-sourceIndex];
  const preview=fade?.plan||(sourceDeck?.track?.plan?plannedTransition(sourceDeck):null);
  const summary=$('pairTransitionStatus');
  if(summary&&(sourceDeck?.spotify||nextDeck?.spotify||queue[0]?.provider==='spotify')){
    summary.textContent='Spotify erlaubt über diese Anbindung keine Crossfades. Titel wechseln ohne Überblendung.';summary.dataset.state='ready';summary.title='Vorgabe von Spotify für die öffentliche Schnittstelle';
    $('beatStatus').textContent='';return;
  }
  if(summary){
    const status=transitionStatus({from:sourceDeck?.track,to:nextDeck?.track,plan:preview,
      musical:$('autoBeat').checked,structureEnabled:$('djStructure').checked,active:Boolean(fade),starting:Boolean(fade?.starting),
      needsFile:sourceDeck?.resumeTime!=null||nextDeck?.resumeTime!=null});
    if(summary.textContent!==status.text)summary.textContent=status.text;
    if(summary.dataset.state!==status.kind)summary.dataset.state=status.kind;
    summary.title=preview?.reason||'Ohne vollständige Paaranalyse: bewährter Übergang mit bis zu '+fadeSeconds()+' Sekunden.';
  }
  if(!$('autoBeat').checked){$('beatStatus').textContent=`${fadeSeconds()} s · keine musikalische Startauswahl`;return;}
  const source=fadeSource(),deck=decks[source];
  if(!deck?.track?.plan){$('beatStatus').textContent='Passende Übergangsstellen · Tempo bleibt unverändert';return;}
  if(fade){$('beatStatus').textContent='Übergang läuft · Tempo beider Songs bleibt unverändert';return;}
  const point=plannedTransition(deck),kind={section:'Abschnittswechsel',bar:'Taktbeginn',time:'zeitbasierter Übergang'}[point.kind];
  $('beatStatus').textContent=`${$('autoCrossfade').checked||queueRunning?'Geplant':'Bei Auto-Crossfade'}: ${point.label?point.label+' · ':''}${kind} bei ${formatTime(point.time)}${point.duration?' · '+point.duration.toFixed(1)+' s':''}${point.kind==='time'?' · kein passendes Taktraster':''} · ohne Tempoänderung`;
},200);
async function audioReady() {
  if (!context) {
    context = new AudioContext();
    performanceControls.connect(context);
  }
  await context.resume(); updateGains();
}
function updateGains() {
  if(spotifyDeck)void spotifyLibrary.playback.volume(Number(spotifyDeck.panel.querySelector('.dj-volume').value)*Number(document.querySelector('[data-master]').value)).catch(e=>notice(e.message,true));
  const gains = deckGains(Number($('crossfader').value));
  $('mixValue').textContent = `A ${Math.round(gains[0]*100)} % · B ${Math.round(gains[1]*100)} %`;
  for (const deck of decks) if (deck.gain) {
    deck.channelGain.gain.setTargetAtTime(Number(deck.panel.querySelector('.dj-volume').value),context.currentTime,.015);
    if(!fade||fade.starting)deck.gain.gain.setTargetAtTime(gains[deck.index],context.currentTime,.015);
  }
}
$('crossfader').oninput = () => {pauseQueue();cancelFade(true); updateGains();};
async function toggleDeck(deck, automatic = false) {
  if(deck.spotify){
    if(!automatic)pauseQueue();
    if(spotifyDeck===deck&&deck.spotifyStarted&&!deck.spotifyEnded)await spotifyLibrary.playback.toggle();
    else await startSpotifyDeck(deck);
    return;
  }
  if (!automatic) {pauseQueue();cancelFade();}
  if (!deck.track?.plan) return;
  if(deck.resumeTime!=null)await restoreDeckFile(deck);
  if (!deck.audio.paused) {deck.audio.pause(); return;}
  stopSpotify();await audioReady();
  prepareDeckStart(deck);
  try {await deck.audio.play(); if(!automatic){autoFadePaused=false;if($('autoCrossfade').checked)$('fadeStatus').textContent='Auto-Crossfade aktiv';} notice(`Deck ${deck.name} läuft. Das zweite Deck kann parallel vorbereitet werden.`);}
  catch (error) {throw error;}
}
async function stopAll(reason = 'Beide Decks pausiert.') {
  stopSpotify();pauseQueue();cancelFade(true); for (const deck of decks) deck.audio.pause(); notice(reason);
}
$('djStop').onclick = () => {lightStage.stop();cancelFade(true); return perform(() => stopAll());};
async function unload(deck) {
  deck.setEntry=null;
  if(deck===spotifyDeck)stopSpotify();
  deck.spotify=null;deck.spotifyStarted=false;deck.spotifyEnded=false;deck.panel.querySelector('.spotify-deck-cover')?.remove();deck.panel.querySelector('.spotify-deck-link')?.remove();deck.panel.querySelector('.spotify-deck-brand')?.remove();deck.panel.querySelector('.dj-waveform').hidden=false;
  deck.resumeTime=null;if(deck.resumeButton)deck.resumeButton.hidden=true;
  performanceControls.reset(deck);
  deck.audio.pause(); deck.audio.playbackRate=1; deck.audio.removeAttribute('src'); deck.audio.load();
  if (deck.url) URL.revokeObjectURL(deck.url);
  deck.queueEntry=null;deck.url = null; deck.track = null; deck.transition = null; deck.cue = 0; deck.cueLocked=false;
  deck.panel.querySelector('.dj-track-title').textContent = 'Track laden';
  deck.panel.querySelector('.dj-cue').textContent = 'Cue';
  drawDeck(deck); renderLibrary();
}
async function rememberDesktopFile(track){
 if(!globalThis.anydjFiles||!track.file)return;
 try{if(await anydjFiles.remember(track.id,track.file)){track.nativeFile=true;await persist(track);}}
 catch(error){notice('Dateireferenz konnte nicht dauerhaft gespeichert werden: '+error.message,true);}
}
async function ensureFile(track,{requestPermission=true}={}) {
  if(track.deleted) throw Error('Track nicht mehr verfügbar.');
  if(track.missing || track.pendingChange) throw Error('Datei geändert: Deck entladen und Ordner aktualisieren.');
  track.queuePreparationError=null;
  if (track.file) return track.file;
  if(globalThis.anydjFiles){try{const saved=await anydjFiles.read(track.id);if(saved){const file=new File([saved.bytes],saved.name,{lastModified:saved.lastModified,type:'audio/'+saved.name.split('.').pop()});if(fileIdentity(file)!==fileIdentity(track))throw Error('Die Datei wurde verändert. Bitte erneut auswählen.');track.file=file;return file;}}catch(error){if(!track.handle)throw error;}}
  if (!track.handle) throw Error('Bitte diesen Track über „Erneut verknüpfen“ öffnen.');
  // Only an explicit deck action may request permission. Startup instead tries
  // a non-prompting read and keeps the reconnect button if access is unavailable.
  if (requestPermission && await track.handle.queryPermission({mode:'read'}) !== 'granted' && await track.handle.requestPermission({mode:'read'}) !== 'granted') throw Error('Lesezugriff wurde nicht freigegeben.');
  const file = await track.handle.getFile();
  if (fileIdentity(file) !== fileIdentity(track)) throw Error('Die Datei wurde verändert. Bitte erneut verknüpfen, damit die Show neu berechnet wird.');
  track.file = file; await rememberDesktopFile(track); if(!track.plan)track.state = 'Wartet auf Analyse'; void prepareTracks(); renderLibrary(); return file;
}
async function loadDeck(deck, track, fromQueue=false) {
  if(!fromQueue)pauseQueue();
  if (!deck.audio.paused||(deck===spotifyDeck&&!deck.spotifyPaused)) throw Error(`Deck ${deck.name} bitte vor dem Laden pausieren.`);
  const file = await ensureFile(track); await unload(deck);
  deck.autoUsed = false; deck.track = track; deck.url = URL.createObjectURL(file); deck.audio.src = deck.url;
  deck.panel.querySelector('.dj-track-title').textContent = track.name;
  deck.panel.querySelector('.dj-track-title').title = track.name;
  drawDeck(deck); renderLibrary();
  void performanceControls.waveform(track,file);
  void prepareTracks();
}
function drawDeck(deck) {
  deck.colorPicker.update(deck.track);
  const canvas = deck.panel.querySelector('canvas:not(.dj-waveform)'), ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
  const plan = deck.track?.plan; deck.panel.querySelector('.dj-sections').disabled=!plan?.arrangement; if (!plan) return;
  for (let i=0;i<canvas.width;i+=3) {
    const frame = plan.frames[Math.min(plan.frames.length-1,Math.floor(i/canvas.width*plan.frames.length))];
    const height = 6+frame.dimming/100*52; ctx.fillStyle = `rgb(${frame.r},${frame.g},${frame.b})`; ctx.fillRect(i,(64-height)/2,2,height);
  }
}
function replacePlan(track, plan) {
  for (const deck of decks) if (deck.track === track) {
    if(track.plan && !deck.audio.paused) deck.transition = {from:track.plan, start:deck.audio.currentTime};
  }
  const feelingAnalysis=inferFeelings(plan);
  if(JSON.stringify(track.feelingAnalysis)!==JSON.stringify(feelingAnalysis)){track.feelingAnalysis=feelingAnalysis;void persist(track);}
  track.basePlan=plan;
  track.plan=applySectionLighting(applySongShowProfile(applyTrackColors(plan,globalColorMode??track.colorMode),track.showProfile,showProfile),track.sectionEdits||[]);
  track.stageMotifs=prepareStageMotifs(track.plan);
  lightStage.prepareMovingHeads();
  for (const deck of decks) if (deck.track === track) drawDeck(deck);
}
async function editSections(track,position=()=>0,embedded={}) {
  if(!track?.basePlan?.arrangement)return;
  const initialPosition=position();
  if(!track.file&&(track.handle||track.nativeFile))await ensureFile(track);
  if(embedded.signal?.aborted)return null;
  if(!embedded.externalAudio)await stopAll('DJ-Wiedergabe pausiert · Lichteditor übernimmt die Vorschau.');
  if(embedded.signal?.aborted)return null;
  let stage=null,latest=null,disposed=false,lastPlan=null,motifs=null;
  const sample=({time,plan,playing})=>{
    plan=sectionPlanAt(plan,time);
    if(disposed)return;if(lastPlan!==plan){lastPlan=plan;motifs=prepareStageMotifs(plan);}
    const frame=showFrameAt(plan,time,flickerControl.value),section=plan.sections?.find(s=>time>=s.start&&time<s.end);
    const motif=motifs?.[plan.sections?.indexOf(section)],grid=plan.beatGrid?.beats||plan.beatTiming?.times;
    const absoluteBeat=beatPosition(grid,time),startBeat=motif?beatPosition(grid,motif.start):null;
    latest={frame,streams:[{frame,weight:1,playing,movingPlan:plan,songTime:time,flicker:flickerControl.value,beat:absoluteBeat,
      motionCharacter:stageMotionAt(plan,time),palette:songPaletteAt(plan,time),motifColor:motif?.color,
      motionBeat:absoluteBeat!==null&&startBeat!==null?absoluteBeat-startBeat:null,look:section?.look,
      sectionProgress:section?(time-section.start)/Math.max(.001,section.end-section.start):0,
      accentStrength:stageAccentStrength(plan,time),washDimming:stageWashDimming(plan,time),
      sectionKey:section?`${track.id}:${section.start}`:null,sectionName:track.name}]};
    stage?.update(latest.frame,latest.streams);
  };
  try{return openSectionEditor({track,host:embedded.host,externalAudio:embedded.externalAudio,edits:embedded.edits??track.sectionEdits,targets:[...(embedded.targets||[]),...lightStage.lightingTargets],onEditPosition:embedded.onEditPosition,getTargetPreview:target=>target.startsWith('patch')?lightStage.lightingPreview(target):embedded.getTargetPreview?.(target)||[],plan:applySongShowProfile(applyTrackColors(track.basePlan,globalColorMode??track.colorMode),track.showProfile,showProfile),position:()=>initialPosition,
    getDiagnostics:()=>({lightTuning:lightTuning?.settings,stage:lightStage.getDiagnostics()}),
    onPreview:sample,
    mountPreview:host=>{stage=lightStage.mountEditor(host);if(latest)stage.update(latest.frame,latest.streams);return stage;},
    onBeforePlay:async()=>{if(embedded.externalAudio)await audioReady();},
    onDispose:draft=>{if(embedded.host)stageLightDrafts.set(track.id,draft);disposed=true;updateLightPreview();embedded.onDispose?.();},
    onSave:async edits=>{
      const old=track.sectionEdits;track.sectionEdits=edits;
      try{await saveTrack(track);}catch(error){track.sectionEdits=old;throw error;}
      replacePlan(track,track.basePlan);renderLibrary();
    }
  });}catch(error){disposed=true;stage?.destroy();throw error;}
}

function preparationQueue(){
  const ids=new Set([...queue,...displayedQueue()].map(entry=>entry.trackId)),byId=new Map(tracks.map(track=>[track.id,track]));
  return [...ids].map(id=>byId.get(id)).filter(Boolean);
}
function nextTrack(predicate) {
  return [...decks.map(deck=>deck.track),...preparationQueue(),...tracks].find(track=>track&&predicate(track));
}
function needsPreparation(track){return (!track.plan||track.recalculate)&&!track.failed&&!track.deleted&&!track.missing&&!track.pendingChange&&!track.queuePreparationError;}
function nextPreparationTrack(){
  const queued=new Set(preparationQueue());
  return nextTrack(t=>needsPreparation(t)&&(queued.has(t)||(t.file&&(t.recalculate||!t.folderId||decks.some(d=>d.track===t)))));
}
async function readPreparationFile(track){
  if(track.file)return;
  if(track.nativeFile&&globalThis.anydjFiles){await ensureFile(track,{requestPermission:false});return;}
  if(!track.handle||await track.handle.queryPermission({mode:'read'})!=='granted')throw Error('Dateizugriff nötig · über Mehr erneut verknüpfen oder Ordner freigeben.');
  const file=await track.handle.getFile();
  if(fileIdentity(file)!==fileIdentity(track))throw Error('Datei geändert · bitte Ordner aktualisieren oder erneut verknüpfen.');
  track.file=file;
}
async function prepareTracks() {
  if (preparing || refining || closed) return; preparing = true;
  try {
    let track;
    for(const queued of preparationQueue()){
      if(queued.plan&&queued.windows&&!queued.refined&&!queued.file&&!queued.queuePreparationError&&!queued.missing&&!queued.pendingChange){
        try{await readPreparationFile(queued);}catch(error){queued.queuePreparationError=error.message;renderLibrary();}
      }
    }
    while ((track = nextPreparationTrack()) && !closed) {
      try{await readPreparationFile(track);}catch(error){track.queuePreparationError=error.message;renderLibrary();renderQueue();continue;}
      const revision=track.revision||0;
      try {
        await restoreShow(track);
        if(track.deleted || (track.revision||0)!==revision)continue;
        if(track.plan&&!track.recalculate){renderLibrary();void refineTracks();continue;}
        track.phase='Audio wird gelesen …';track.analysisWarnings=[];renderLibrary();
        const decoded = await new OfflineAudioContext(2,1,16000).decodeAudioData(await track.file.arrayBuffer());
        if(decoded.duration<.1 || decoded.duration>900) throw Error('Unterstützt werden Tracks bis 15 Minuten.');
        track.waveform=audioEnvelope(decoded);
        track.phase='Takt wird erkannt …';renderLibrary();
        const beat = webMode?{grid:null,message:'Browseranalyse'}:await analyzeBeats(decoded,{token, signal:lifetime.signal});
        if(track.deleted || (track.revision||0)!==revision)continue;
        track.phase='Stilverlauf wird erkannt …';renderLibrary();
        const style = webMode?{style:null,message:'Browseranalyse'}:await analyzeStyle(decoded,{token,signal:lifetime.signal});
        if(track.deleted || (track.revision||0)!==revision)continue;
        track.styleMessage=style.message;
        track.analysisWarnings=webMode?[]:[...(!beat.grid?[beat.message]:[]),...(!style.style?[style.message]:[])];
        track.phase='Lichtshow wird berechnet …';renderLibrary();
        const channels = Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i).slice());
        const result = await runWorker({channels, rate:16000, options:design, beatGrid:beat.grid,musicStyle:style.style});
        if(track.deleted || (track.revision||0)!==revision) continue;
        track.phase=null;track.recalculate=false;track.structureState=webMode?'disabled':'pending';if(webMode)track.refined=true;
        track.windows = result.windows; replacePlan(track,result.plan);
        track.state = `Spielbereit · ${beat.message}`;
        await cacheShow(track);renderLibrary();
        if($('djStructure').checked&&!webMode&&track.windows&&!track.refined)break;
      } catch(error) {if(track.deleted || (track.revision||0)!==revision) continue; track.phase=null;track.recalculate=false;track.failed = true; track.state = error.message; renderLibrary();}
    }
  } finally {preparing = false;void refineTracks();}
}
async function refineTracks() {
  if(webMode || preparing || refining || closed || !$('djStructure').checked) return; refining = true;
  try {
    let track;
    while($('djStructure').checked && !closed && (track = nextTrack(t => t.file && t.plan && t.windows && !t.recalculate && !t.refined && !t.deleted))) {
      const revision=track.revision||0;
      refineController = new AbortController(); track.refined = true;track.structureState='running';
      track.state = 'Spielbereit · Songaufbau wird im Hintergrund analysiert …'; renderLibrary();
      try {
        const result = await analyzeStructure(await track.file.arrayBuffer(),track.plan.duration,{token, signal:lifetime.signal, cancelSignal:refineController.signal,
          onStatus:text=>{track.state=`Spielbereit · ${text}`;renderLibrary();}});
        if(track.deleted || (track.revision||0)!==revision) continue;
        if(result.structure) {
          const rendered = await runWorker({kind:'render',windows:track.windows,duration:track.plan.duration,options:design,beatGrid:track.plan.beatGrid,structure:result.structure,musicStyle:track.plan.musicStyle});
          if(track.deleted || (track.revision||0)!==revision) continue;
          replacePlan(track,rendered.plan);
        }
        track.state = `Spielbereit · ${result.message}`;
        // Keep retryable windows only for an explicit cancellation.
        if(refineController.signal.aborted){track.refined=false;track.structureState='pending';}
        else {track.windows=null;track.structureState=result.structure?'complete':'failed';}
      } catch(error) {if(track.deleted || (track.revision||0)!==revision) continue; track.state = `Spielbereit · ${error.message}`; track.windows = null;track.structureState='failed';}
      await cacheShow(track);renderLibrary();
      if(nextPreparationTrack())break;
    }
  } finally {refining = false; refineController = null;if(nextPreparationTrack())void prepareTracks();}
}
$('djStructure').onchange = () => {if(!$('djStructure').checked) refineController?.abort(); else void refineTracks();renderLibrary();};
async function addFiles(entries) {
  const added = [];
  for(const {file,handle} of entries) {
    if(!file || (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name))) {notice('Bitte unterstützte Audiodateien auswählen.',true); continue;}
    if(file.size>50*1024*1024) {notice(`${file.name}: maximal 50 MB pro Track.`,true); continue;}
    let track = tracks.find(t => !t.folderId && fileIdentity(t) === fileIdentity(file));
    if(track) {track.file = file; track.queuePreparationError=null; track.handle = handle || track.handle; if(track.failed) {track.failed=false; track.state='Wartet auf Analyse';}}
    else {track = {id:crypto.randomUUID(),name:file.name,size:file.size,lastModified:file.lastModified,order:tracks.length,addedAt:Date.now(),file,handle:handle||null,state:'Wartet auf Analyse'}; tracks.push(track);}
    await persist(track);await rememberDesktopFile(track); added.push(track);
  }
  renderLibrary(); void prepareTracks(); return added;
}
function bindDrop(element, receive) {
  element.addEventListener('dragover', event => {event.preventDefault(); element.classList.add('dragging');});
  element.addEventListener('dragleave', () => element.classList.remove('dragging'));
  element.addEventListener('drop', event => {
    event.preventDefault(); element.classList.remove('dragging');
    const provider=event.dataTransfer.getData('application/x-anydj-provider-track');
    if(provider){try{const remote=spotifyQueueEntry(JSON.parse(provider)).remote;void perform(()=>receive([],null,remote));}catch(error){notice(error.message,true);}return;}
    const track = tracks.find(t => t.id === event.dataTransfer.getData('application/x-anydj-track'));
    // Read handles in the drop callback, before the drag data store closes.
    const entries = [...event.dataTransfer.items].filter(item => item.kind === 'file').map(item => ({file:item.getAsFile(), handle:item.getAsFileSystemHandle?.().catch(()=>null)}));
    void perform(async () => {
      const files = await Promise.all(entries.map(async entry => {const handle = await entry.handle; return {file:entry.file,handle:handle?.kind==='file'?handle:null};}));
      await receive(files,track);
    });
  });
}
bindDrop($('libraryDrop'), files => addFiles(files));
$('addTracks').onclick = async () => {
  if(!window.showOpenFilePicker) {$('djFiles').click(); return;}
  try {
    const handles = await showOpenFilePicker({multiple:true,types:[{description:'Musik',accept:{'audio/*':['.mp3','.wav','.flac','.ogg','.m4a','.aac']}}]});
    await addFiles(await Promise.all(handles.map(async handle => ({file:await handle.getFile(),handle}))));
  } catch(error) {if(error.name!=='AbortError') notice(error.message,true);}
};
$('djFiles').onchange = async event => {await addFiles([...event.target.files].map(file=>({file}))); event.target.value='';};
function button(text, action, disabled = false, label = text) {const b=document.createElement('button');b.className='button secondary';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.disabled=disabled;b.onclick=()=>perform(action);return b;}
function groupTrackActions(row,compact=false) {
  const actions=document.createElement('div');actions.className='dj-track-actions';
  const more=document.createElement('details');more.className='dj-track-more';
  const summary=document.createElement('summary');summary.textContent='Mehr';summary.setAttribute('aria-label','Weitere Titelaktionen');more.append(summary);
  for(const child of [...row.children])if(child.tagName==='BUTTON'){
    if(compact&&child.getAttribute('aria-label')==='In Warteschlange einreihen'){child.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';child.classList.add('dj-enqueue');actions.append(child);}
    else if(compact){child.textContent=child.getAttribute('aria-label')||child.textContent;more.append(child);}
    else actions.append(child);
  }
  if(compact)actions.append(more);
  row.append(actions);
}
function positionQueueActions(menu){
  const trigger=menu.parentElement?.querySelector('.queue-row-more');if(!trigger)return;
  const rect=trigger.getBoundingClientRect(),gap=8,{innerWidth,innerHeight}=menu.ownerDocument.defaultView;
  menu.style.left=Math.max(gap,Math.min(rect.right-menu.offsetWidth,innerWidth-menu.offsetWidth-gap))+'px';
  const below=rect.bottom+gap,above=rect.top-menu.offsetHeight-gap;
  menu.style.top=Math.max(gap,Math.min(below+menu.offsetHeight<=innerHeight-gap?below:above,innerHeight-menu.offsetHeight-gap))+'px';
}
function groupQueueActions(row,entry){
  const actions=document.createElement('div');actions.className='dj-track-actions';
  const menu=document.createElement('div');menu.className='queue-row-menu';menu.id='queue-actions-'+entry.id;menu.setAttribute('popover','auto');menu.setAttribute('aria-label','Weitere Titelaktionen');
  for(const child of [...row.children])if(child.tagName==='BUTTON'){
    if(child.classList.contains('queue-row-remove'))actions.append(child);
    else{
      if(child.dataset.queueLightEditor){const label=document.createElement('span');label.textContent='Lichtshow bearbeiten';child.append(label);}
      child.addEventListener('click',()=>menu.hidePopover());menu.append(child);
    }
  }
  if(menu.children.length){
    const more=document.createElement('button');more.type='button';more.className='button secondary queue-row-more';more.title='Weitere Titelaktionen';more.setAttribute('aria-label','Weitere Titelaktionen');more.setAttribute('aria-expanded','false');more.setAttribute('popovertarget',menu.id);
    more.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
    menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');more.setAttribute('aria-expanded',String(open));if(open)positionQueueActions(menu);});
    actions.append(more,menu);
  }
  row.append(actions);
}
const repositionQueueActions=()=>$('queueList').querySelectorAll('.queue-row-menu:popover-open').forEach(positionQueueActions);
window.addEventListener('resize',repositionQueueActions);
document.addEventListener('scroll',repositionQueueActions,true);
const feelings=createFeelingLibrary({changed:()=>renderLibrary(),notice});
const localCovers=createLocalCovers({save:persist,changed:()=>renderLibrary()});
const libraryView=()=>libraryTracks(tracks,{query:$('trackSearch').value,filter:$('trackFilter').value,sort:$('trackSort').value,feelings:feelings.selected,catalog:feelings.catalog});
function renderLibrary() {
  if(libraryDragging)return;
  spotifyLibrary.refresh();
  tidalLibrary.refresh();
  const scroll=$('trackList').scrollTop;
  $('trackList').replaceChildren(); $('trackCount').textContent=tracks.length;
  const visible=libraryView();$('trackCount').textContent=visible.length===tracks.length?tracks.length:`${visible.length} / ${tracks.length}`;
  if(!tracks.length) {const li=document.createElement('li');li.className='dj-empty';li.textContent='Dateien hierher ziehen';$('trackList').append(li);}
  for(const track of visible) {
    const index=tracks.indexOf(track);
    const li=document.createElement('li');li.draggable=true;li.ondragstart=event=>{libraryDragging=true;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-anydj-track',track.id);};
    li.ondragend=()=>{libraryDragging=false;clearLibraryQueueDrop();renderLibrary();};
    const info=document.createElement('div');info.className='dj-track-info';
    const name=document.createElement('strong');name.textContent=track.name;name.title=track.relativePath||track.name;
    const state=document.createElement('small');paintAnalysis(state,track);
    const label=document.createElement('div');label.className='dj-track-label';label.append(name,state,feelings.badges(track));info.append(label);localCovers.attach(info,track);li.append(info);
    for(const deck of decks) li.append(button(deck.name,()=>loadDeck(deck,track),!deck.audio.paused||track.missing||track.pendingChange,`Auf Deck ${deck.name} laden`));
    const enqueueButton=button('+ Queue',()=>{},track.missing||track.pendingChange,'In Warteschlange einreihen');enqueueButton.onclick=()=>enqueue(track);li.append(enqueueButton);
    if((!track.folderId && (!track.file || track.failed))||track.queuePreparationError) li.append(button('↻',()=>relink(track),false,'Erneut verknüpfen'));
    li.append(button('Gefühle',()=>feelings.edit(track),false,'Gefühle bearbeiten'));
    li.append(button('Übergänge',()=>showTransitionLinks(track),!transitionLibraryReady,'Gespeicherte Übergänge'));
    li.append(button('Lied schneiden',()=>editTrackAudio(track),!track.plan||track.missing||track.pendingChange,'Lied schneiden'));
    li.append(button('Abschnitte',()=>editSections(track),!track.basePlan?.arrangement,'Abschnittslicht bearbeiten'));
    li.append(button('Neu berechnen',()=>recalculateShow(track),Boolean(track.phase)||track.missing||track.pendingChange,'Lichtshow neu berechnen'));
    if($('trackSort').value==='manual'&&!$('trackSearch').value.trim()&&$('trackFilter').value==='all'&&!feelings.selected.length)for(const [label,offset] of [['↑',-1],['↓',1]]) li.append(button(label,async()=>{const target=index+offset;[tracks[index],tracks[target]]=[tracks[target],tracks[index]];await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},index+offset<0||index+offset>=tracks.length,label==='↑'?'In Bibliothek nach oben':'In Bibliothek nach unten'));
    if(!folder || track.folderId!==folder.id) li.append(button('×',async()=>{track.deleted=true;tracks=tracks.filter(t=>t!==track);await removeTrack(track.id).catch(()=>{});await globalThis.anydjFiles?.forget(track.id);await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},decks.some(d=>d.track===track),'Track entfernen'));
    groupTrackActions(li,true);$('trackList').append(li);
  }
  if(!$('trackList').children.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Keine Treffer';$('trackList').append(li);}
  $('trackList').scrollTop=scroll;
}
async function recalculateShow(track) {
  if(track.phase||track.deleted)return;
  if(!track.file&&!track.handle&&!track.nativeFile){relink(track,true);return;}
  await ensureFile(track);
  if(track.structureState==='running')refineController?.abort();
  track.revision=(track.revision||0)+1;
  track.recalculate=true;track.failed=false;track.windows=null;
  track.refined=false;track.structureState=null;track.analysisWarnings=[];
  track.phase='Wartet auf Neuberechnung …';
  renderLibrary();void prepareTracks();
}
function relink(track,recalculate=false) {
  const input=document.createElement('input');input.type='file';input.accept='audio/*';
  input.onchange=()=>perform(async()=>{
    const file=input.files[0];if(!file)return;
    if(fileIdentity(file)!==fileIdentity(track)) throw Error('Bitte dieselbe Datei auswählen. Geänderte Tracks über „+ Dateien“ hinzufügen.');
    track.file=file;await rememberDesktopFile(track);track.queuePreparationError=null;track.failed=false;for(const deck of decks)if(deck.track===track&&deck.resumeTime!=null)await restoreDeckFile(deck);if(recalculate){await recalculateShow(track);return;}if(!track.plan)track.state='Wartet auf Analyse';renderLibrary();void prepareTracks();
  });input.click();
}
function frameFor(deck,time=deck.audio.currentTime) {
  if(!deck.track?.plan || deck.audio.paused) return null;
  const transition=deck.transition;
  if(transition && (time<transition.start || time>=transition.start+2)) deck.transition=null;
  return deck.transition?transitionFrame(deck.transition.from,deck.track.plan,time,(time-deck.transition.start)/2,flickerControl.value):showFrameAt(deck.track.plan,time,flickerControl.value);
}
function paintColorPoint(id,frame,description){
  frame=adjustLight(frame);if(frame?.state===false)frame=null;
  const point=$(id),color=frame?`rgb(${frame.r}, ${frame.g}, ${frame.b})`:'#364047';
  point.style.setProperty('--light-color',color);point.style.opacity=frame?String(.25+.75*frame.dimming/100):'.35';
  point.title=frame?`${description}: RGB ${frame.r}, ${frame.g}, ${frame.b} · ${frame.dimming} %`:`${description}: inaktiv`;
  point.setAttribute('aria-label',point.title);
}
function updateLightPreview(){
  const times=decks.map(deck=>deck.audio.currentTime);
  const current=decks.map((deck,i)=>frameFor(deck,times[i]));
  for(const [i,deck] of decks.entries()){
    const frame=current[i]||(deck.track?.plan?showFrameAt(deck.track.plan,times[i],flickerControl.value):null);
    paintColorPoint(`preview${deck.name}`,frame,`Deck ${deck.name}${deck.audio.paused?' · pausiert':''}`);
  }
  const weights=deckGains(Number($('crossfader').value)).map((w,i)=>w*Number(decks[i].panel.querySelector('.dj-volume').value));
  const active=current.some((frame,i)=>frame&&weights[i]>0);
  const mixedFrame=active?mixDeckFrames(current,weights):null;
  paintColorPoint('previewMix',mixedFrame,'Lichtmix · berechnete Vorschau');
  const lightStreams=decks.map((deck,i)=>{
    const time=times[i],plan=sectionPlanAt(deck.track?.plan,time);
    const section=plan?.sections?.find(s=>time>=s.start&&time<s.end);
    const motif=deck.track?.stageMotifs?.[plan?.sections?.indexOf(section)];
    const absoluteBeat=beatPosition(plan?.beatGrid?.beats||plan?.beatTiming?.times,time);
    const grid=plan?.beatGrid?.beats||plan?.beatTiming?.times;
    const firstBeat=grid?.findIndex(t=>t>=motif?.start);
    const startBeat=motif?(beatPosition(grid,motif.start)??(firstBeat>=0?firstBeat:null)):null;
    return {source:deck.track?`${deck.name}:${deck.track.id}`:null,playing:!deck.audio.paused&&!deck.audio.seeking,motionCharacter:stageMotionAt(plan,time),palette:songPaletteAt(plan,time),movingPlan:plan,songTime:time,flicker:flickerControl.value,motifColor:motif?.color,motionBeat:absoluteBeat!==null&&startBeat!==null?absoluteBeat-startBeat:null,frame:current[i],weight:weights[i],beat:beatPosition(plan?.beatGrid?.beats||plan?.beatTiming?.times,time),look:section?.look,sectionProgress:section?(time-section.start)/Math.max(.001,section.end-section.start):0,
      accentStrength:stageAccentStrength(plan,time),washDimming:stageWashDimming(plan,time),sectionKey:section?`${deck.track.id}:${section.start}`:null,sectionName:section?`${deck.track.name} · ${section.title||section.label||section.lookLabel||'Abschnitt'}`:''};
  });
  fullMode.update(mixedFrame,lightStreams);
  lightStage.update(mixedFrame,decks.some(deck=>!deck.audio.paused),lightStreams);
}
// Sample the preview independently of the slower transport labels, using one
// media-time snapshot per deck for brightness, color and stage movement.
const stopPreviewClock=startPreviewClock(updateLightPreview);
setInterval(()=>{
  $('crossfader').disabled=Boolean(spotifyDeck?.spotifyStarted);
  for(const deck of decks) {
    syncDeckShowProfile(deck);
    if(deck.spotify){
      const active=deck===spotifyDeck,position=active?spotifyLibrary.playback.position:0,duration=deck.spotify.duration/1000;
      const status=deck.panel.querySelector('.dj-analysis');status.textContent='Spotify'+(active&&deck.spotifyStarted&&!spotifyLibrary.playback.state?' · Verbindet …':'');status.dataset.analysis='complete';
      deck.panel.querySelector('.dj-clock').textContent=`${formatTime(position)} / ${formatTime(duration)}`;
      const seek=deck.panel.querySelector('.dj-seek');seek.disabled=!active||!spotifyLibrary.playback.state;seek.max=duration||1;seek.value=position;
      deck.panel.querySelector('.dj-play').disabled=false;deck.panel.querySelector('.dj-play').textContent=active&&!deck.spotifyPaused?'Pause':'Play';
      for(const name of ['cue','set-cue'])deck.panel.querySelector('.dj-'+name).disabled=true;
      deck.panel.querySelector('.dj-unload').disabled=active&&!deck.spotifyPaused;
      continue;
    }
    const plan=deck.track?.plan, audio=deck.audio;
    const passage=plan?.sections.find(section=>audio.currentTime>=section.start&&audio.currentTime<section.end);
    deck.panel.querySelector('.dj-look').textContent=passage?.lookLabel||'';
    paintAnalysis(deck.panel.querySelector('.dj-analysis'),deck.track);
    deck.panel.querySelector('.dj-clock').textContent=`${formatTime(deck.resumeTime??audio.currentTime)} / ${formatTime(plan?.duration)}`;
    const seek=deck.panel.querySelector('.dj-seek');seek.disabled=!plan||deck.resumeTime!=null;seek.max=plan?.duration||1;
    deck.panel.querySelector('.dj-play').textContent=audio.paused?'Play':'Pause';
    for(const name of ['play','cue','set-cue']) deck.panel.querySelector(`.dj-${name}`).disabled=!plan||deck.resumeTime!=null;
    deck.panel.querySelector('.dj-unload').disabled=!deck.track || !audio.paused;
  }
},100);
window.addEventListener('pagehide',()=>{
  browserSession.destroy();queueExportMenu.destroy();
  fullMode.destroy();
  performanceControls.destroy();lightStage.destroy();closed=true;queueRunning=false;queueEpoch++;stopPreviewClock();cancelFade();lifetime.abort();refineController?.abort();for(const worker of workers)worker.terminate();
  for(const deck of decks){deck.audio.pause();if(deck.url)URL.revokeObjectURL(deck.url);}
});
(async()=>{
  await feelings.load();
  try {tracks=(await readLibrary()).sort((a,b)=>a.order-b.order);await Promise.all(tracks.map(restoreShow));const savedQueue=await readQueue();queue=Array.isArray(savedQueue)?savedQueue.filter(validQueueEntry).map(entry=>copyQueueEntry(entry)):[];const storedLists=await readQueueLists();
    queueLists=Array.isArray(storedLists?.lists)?storedLists.lists.filter(list=>typeof list?.id==='string'&&typeof list.name==='string'&&Array.isArray(list.entries)).map(list=>({id:list.id,name:list.name.slice(0,80),entries:list.entries.filter(validQueueEntry).map(entry=>copyQueueEntry(entry))})):[];
    queueSourceName=typeof storedLists?.liveName==='string'?storedLists.liveName.slice(0,80):'';selectedQueueList=queueLists.some(list=>list.id===storedLists?.selected)?storedLists.selected:'';queueListsReady=true;
    renderLibrary();renderQueue();folder=await readFolder();renderFolder();await syncFolder();}
  catch {queueListsReady=true;$('libraryStatus').textContent='Trackliste und Listen können nur für diese Sitzung verwendet werden.';renderLibrary();renderQueue();}
  await browserSession.restore(tracks);renderLibrary();
})();

function cancelFade(disarm = Boolean(fade)) {
  if(disarm)autoFadePaused=true;
  performanceControls.clearTransition();
  if (fade) {
    for(const deck of decks)if(deck.gain)holdAudioParam(deck.gain.gain,context.currentTime);
    fade = null;
    updateGains();
    $('fadeStatus').textContent = 'Übergang abgebrochen';
  }
  if(disarm&&$('autoCrossfade').checked)$('fadeStatus').textContent='Auto-Crossfade pausiert · Play oder Überblenden zum Fortsetzen';
}
function fadeSource() {
  const preferred = Number($('crossfader').value) < .5 ? 0 : 1;
  return !decks[preferred].audio.paused ? preferred : !decks[1-preferred].audio.paused ? 1-preferred : -1;
}
function requestFade(index, fromQueue=false, musical=false, immediate=false) {
  if(!fromQueue)pauseQueue();
  if (fade || index < 0) return;
  const from = decks[index], to = decks[1-index];
  if (spotifyDeck?.spotifyStarted || !from.track?.plan || !to.track?.plan || from.audio.paused) return;
  if(fromQueue&&queue[0]?.provider==='spotify')return;
  if(fromQueue&&queue[0]?.transition&&!matchingSetTransition(queue[0],from.setEntry,from.track.plan,to.track.plan,from.audio.playbackRate,to.audio.playbackRate,from.track,to.track)){pauseQueue('Gespeicherter Übergang passt nicht mehr · bitte neu wählen.');return;}
  autoFadePaused=false;
  const selectedPlan=plannedTransition(from);
  if(selectedPlan?.duration<.1){autoFadePaused=true;const message='Kein freier Abschnitt für den Titelübergang. Schnittüberblendung oder Überblenddauer bitte verkürzen.';if(fromQueue)pauseQueue(message);notice(message,true);return;}
  const job = fade = {from,to,starting:true,fromQueue,epoch:queueEpoch,plan:selectedPlan?.manual?{...selectedPlan,time:immediate?from.audio.currentTime:selectedPlan.time}:musical?(immediate?planTransitionPair(from.track.plan,to.track.plan,{seconds:fadeSeconds(),rateA:from.audio.playbackRate,rateB:to.audio.playbackRate,cue:to.cue,startTime:from.audio.currentTime,adaptive:$('fadeDuration').value==='auto',entryWindow:Number($('transitionEntryWindow').value),cueLocked:Boolean(to.cueLocked),tonalA:transitionTonalSegments(from.track.windows),tonalB:transitionTonalSegments(to.track.windows),preferredStyle:$('transitionPreference').value}):plannedTransition(from)):null};
  $('fadeStatus').textContent = `Deck ${to.name} wird gestartet …`;
  void perform(async () => {
    if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;return;}
    const wasPaused = to.audio.paused;
    try {
      if(from.track.audioCuts?.length||to.track.audioCuts?.length){
        const base=job.plan||planTransitionPair(cutPlan(from.track),cutPlan(to.track),{seconds:fadeSeconds(),cue:to.cue,startTime:from.audio.currentTime,musical:false});
        job.plan=fitCutTransition(base,from.track,to.track,{rateA:from.audio.playbackRate,rateB:to.audio.playbackRate,notBefore:from.audio.currentTime});
      }
      if (wasPaused) {
        to.audio.currentTime = Math.min((job.plan?.manual||from.track.audioCuts?.length||to.track.audioCuts?.length||musical&&$('autoBeat').checked)?(job.plan?.cue??incomingCue(to.track.plan,to.cue)):to.cue, Math.max(0,to.track.plan.duration-.1));
        await toggleDeck(to,true);
      }
      if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;if(wasPaused) to.audio.pause();return;}
      if (to.audio.paused || (from.audio.paused&&!from.audio.ended)) throw Error('Übergang benötigt zwei laufende Decks.');
      // Starting the next decoder may outlast the outgoing track. Its natural
      // end is a valid handover, not a reason to stop or discard a queue item.
      if(fromQueue)consumeQueue(to);
      Object.assign(job,{starting:false,start:from.audio.currentTime,startWall:performance.now(),position:Number($('crossfader').value),
        duration:Math.max(.1,Math.min(job.plan?.duration??fadeSeconds(),keptPassageRemaining(from.track,from.audio.currentTime)/from.audio.playbackRate,keptPassageRemaining(to.track,to.audio.currentTime)/to.audio.playbackRate))});
      job.startAudio=context.currentTime;
      const actual={...job.plan,time:from.audio.currentTime,cue:to.audio.currentTime,duration:job.duration};
      actual.audioProfile=actual.manual?actual.audioProfile:musical&&$('fadeDuration').value==='auto'&&wasPaused?transitionAudioProfile(from.track.windows,to.track.windows,actual,{rateA:from.audio.playbackRate,rateB:to.audio.playbackRate,sameTrack:from.track.id===to.track.id}):null;
      job.plan=actual;
      const options={position:from.index===0?job.position:1-job.position,
        levelA:Number(from.panel.querySelector('.dj-volume').value)*10**(Number(from.panel.querySelector('[data-eq="trim"]').value)/20),
        levelB:Number(to.panel.querySelector('.dj-volume').value)*10**(Number(to.panel.querySelector('[data-eq="trim"]').value)/20)};
      for(const [deck,i] of [[from,0],[to,1]])scheduleTransitionGain(deck.gain.gain,
        Float32Array.from({length:257},(_,n)=>transitionAudioGains(n/256,actual,options)[i]),job.startAudio,job.duration);
      if(job.plan?.style==='bass')performanceControls.startTransition(from,to,job.duration);
      $('fadeStatus').textContent = `Deck ${from.name} → Deck ${to.name} · ${job.duration.toFixed(1)} Sekunden${musical?' · musikalischer Start':''}${job.plan?.label?' · '+job.plan.label:''}`;
    } catch(error) {if(fromQueue)pauseQueue(error.message);cancelFade(true); if(wasPaused)to.audio.pause(); throw error;}
  });
}
$('fadeNow').onclick = () => {
  const source=fadeSource(),next=source>=0?decks[1-source]:null;
  // An early transition to the queued next title still belongs to the queue.
  // Keep its ownership so completion refills the released deck.
  const fromQueue=Boolean(queueRunning&&queue[0]&&next?.queueEntry===queue[0].id);
  requestFade(source,fromQueue,$('autoBeat').checked,true);
};
$('fadeCancel').onclick = () => {pauseQueue();cancelFade(true);};
$('autoCrossfade').onchange = () => {pauseQueue();autoFadePaused=false;
  if (!$('autoCrossfade').checked) cancelFade(false);
  $('fadeStatus').textContent = $('autoCrossfade').checked
    ? 'Auto-Crossfade aktiv'
    : '';
};
setInterval(() => {
  if (closed) return;
  for(const deck of decks)if(!deck.audio.paused)skipTrackCuts(deck);
  if(queueRunning&&!queueBusy&&(!queueDrag||!editingLiveQueue())&&!fade&&queueDeck&&!queueDeck.audio.paused){
    const next=decks[1-queueDeck.index];
    if(queue[0]&&next.queueEntry===queue[0].id&&next.track?.plan&&next.audio.paused){
      const point=plannedTransition(queueDeck);
      if(queueDeck.audio.currentTime>=point.time)requestFade(queueDeck.index,true,$('autoBeat').checked);
    }
  }
  const source = fadeSource();
  $('fadeNow').disabled = Boolean(fade) || source < 0 || !decks[1-source]?.track?.plan;
  $('fadeCancel').hidden = !fade;
  // Reassigning disabled (even false) closes an open native select in Chrome.
  if($('fadeDuration').disabled!==Boolean(fade))$('fadeDuration').disabled=Boolean(fade);
  if (fade && !fade.starting) {
    const job = fade;
    if (job.to.audio.paused || (job.from.audio.paused && !job.from.audio.ended)) {cancelFade(true); return;}
    const elapsed = job.from.audio.ended ? job.duration : context?context.currentTime-job.startAudio:(performance.now()-job.startWall)/1000;
    $('crossfader').value = crossfadePosition(job.position,job.to.index,transitionProgress(elapsed/job.duration,job.plan?.style)*job.duration,job.duration);
    updateGains();
    if (elapsed >= job.duration) {
      performanceControls.clearTransition();
      fade = null; updateGains(); job.from.autoUsed = true;
      if(job.fromQueue)queueDeck=job.to;
      job.from.audio.pause();
      $('fadeStatus').textContent = `Deck ${job.to.name} läuft`;
      renderLibrary();
      if(job.fromQueue)void advanceQueue();
    }
  } else if (!fade && !queueRunning && !autoFadePaused && $('autoCrossfade').checked) {
    const index = automaticFadeSource(decks.map(deck => ({ready:Boolean(deck.track?.plan),paused:deck.audio.paused,
      remaining:deck.audio.currentTime<(deck.track?.plan?.duration||0)?Math.max(.001,(plannedTransition(deck).time-deck.audio.currentTime)/deck.audio.playbackRate+fadeSeconds()):0,used:Boolean(deck.autoUsed||deck.loop)})),Number($('crossfader').value),fadeSeconds());
    if (index >= 0) requestFade(index,false,$('autoBeat').checked);
  }
},25);

function openAnalysisDetails(track) {
  if(!track)return;
  const status=analysisStatus(track,$('djStructure').checked);
  if(!status.detail&&status.kind!=='warning')return;
  const dialog=document.createElement('dialog');dialog.className='dj-analysis-dialog';dialog.setAttribute('aria-labelledby','analysisDetailsTitle');
  dialog.innerHTML='<h2 id="analysisDetailsTitle">Analyse prüfen</h2><p class="analysis-track"></p><p class="analysis-explanation"></p><pre class="analysis-reason"></pre><p class="analysis-result" role="status"></p><div class="analysis-actions"><button type="button" class="button secondary" data-close>Schließen</button><button type="button" class="button primary" data-retry>Analyse erneut starten</button></div>';
  dialog.querySelector('.analysis-track').textContent=track.name;
  dialog.querySelector('.analysis-explanation').textContent=track.plan?'Die Basis-Lichtshow ist spielbereit. Die zusätzliche Analyse ist nicht vollständig.':'Für diesen Track konnte die Analyse nicht abgeschlossen werden.';
  dialog.querySelector('.analysis-reason').textContent=status.detail||status.text;
  const retry=dialog.querySelector('[data-retry]');retry.disabled=Boolean(track.missing||track.pendingChange||track.deleted||track.phase);
  retry.onclick=async()=>{
    retry.disabled=true;
    try{await recalculateShow(track);dialog.close();}
    catch(error){dialog.querySelector('.analysis-result').textContent=error.message;retry.disabled=false;}
  };
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();}});
  const previous=document.activeElement;
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close]').focus();
}
function paintAnalysis(element,track) {
  const status=analysisStatus(track,$('djStructure').checked);
  if(element.textContent!==status.text)element.textContent=status.text;
  element.dataset.analysis=status.kind;
  element.title=status.detail||status.text;
  if(element.analysisDefaultRole===undefined){
    element.analysisDefaultRole=element.getAttribute('role')||'';
    element.addEventListener('click',()=>{if(element.analysisHasDetails)openAnalysisDetails(element.analysisTrack);});
    element.addEventListener('keydown',event=>{if(element.analysisHasDetails&&['Enter',' '].includes(event.key)){event.preventDefault();openAnalysisDetails(element.analysisTrack);}});
  }
  element.analysisTrack=track;
  element.analysisHasDetails=Boolean(status.detail)||status.kind==='warning';
  if(element.analysisHasDetails){element.setAttribute('role','button');element.tabIndex=0;element.setAttribute('aria-label',`${status.text} · ${track?.name||'Track'} · Analysedetails öffnen`);}
  else {element.removeAttribute('tabindex');element.removeAttribute('aria-label');if(element.analysisDefaultRole)element.setAttribute('role',element.analysisDefaultRole);else element.removeAttribute('role');}
}
$('trackSearch').oninput=renderLibrary;
try{const saved=JSON.parse(localStorage.getItem('anydj-library-view-v1')||'null');for(const [id,key] of [['trackFilter','filter'],['trackSort','sort']])if([...$(id).options].some(o=>o.value===saved?.[key]))$(id).value=saved[key];}catch{}
for(const id of ['trackFilter','trackSort'])$(id).onchange=()=>{try{localStorage.setItem('anydj-library-view-v1',JSON.stringify({filter:$('trackFilter').value,sort:$('trackSort').value}));}catch{}renderLibrary();};
function renderFolder() {
  $('folderBar').hidden=!folder;
  $('folderName').textContent=folder?.name||'';
  $('folderName').title=folder?.name||'';
  $('linkFolder').textContent=folder?'Ordner wechseln':'Ordner verbinden';
  $('syncFolder').disabled=folderBusy;
  $('linkFolder').disabled=folderBusy;
  $('disconnectFolder').disabled=folderBusy;
}
async function applyFolderEntries(entries) {
  const changes=folderChanges(tracks,entries,folder.id,new Set(decks.map(d=>d.track?.id).filter(Boolean)));
  const dirty=changes.add.length||changes.update.length||changes.remove.length
    ||changes.pending.some(({track,entry})=>track.missing!==!entry||track.pendingChange!==Boolean(entry))
    ||changes.unchanged.some(({track})=>!track.file||track.missing||track.pendingChange);
  for(const track of changes.remove){await globalThis.anydjFiles?.forget(track.id);track.deleted=true;track.revision=(track.revision||0)+1;}
  tracks=tracks.filter(t=>!changes.remove.includes(t));
  for(const {track,entry} of changes.pending){track.missing=!entry;track.pendingChange=Boolean(entry);}
  for(const {track,entry} of changes.unchanged){track.file=entry.file;track.handle=entry.handle;track.missing=false;track.pendingChange=false;}
  for(const {track,entry} of changes.update) {
    Object.assign(track,{queuePreparationError:null,file:entry.file,handle:entry.handle,name:entry.file.name,size:entry.file.size,lastModified:entry.file.lastModified,
      nativeFile:false,revision:(track.revision||0)+1,feelingAnalysis:null,audioCuts:null,audioCutJoins:null,sectionEdits:null,plan:null,basePlan:null,windows:null,refined:false,structureState:null,phase:null,analysisWarnings:[],failed:false,missing:false,pendingChange:false,state:''});
  }
  for(const entry of changes.add)tracks.push({id:crypto.randomUUID(),addedAt:Date.now(),folderId:folder.id,relativePath:entry.path,
    name:entry.file.name,size:entry.file.size,lastModified:entry.file.lastModified,file:entry.file,handle:entry.handle});
  await Promise.all(tracks.filter(t=>t.folderId===folder.id&&t.file&&!t.nativeFile).map(rememberDesktopFile));
  tracks.forEach((track,index)=>track.order=index);
  if(dirty)renderLibrary();
  if(changes.add.length||changes.update.length||changes.remove.length)await saveFolderChanges(tracks,changes.remove.map(t=>t.id));
  void prepareTracks();
}
async function syncFolder(requestPermission=false) {
  if(!folder||folderBusy||closed)return;
  if(!folder.handle){$('folderStatus').textContent='Zum Aktualisieren Ordner erneut auswählen.';return;}
  folderBusy=true;renderFolder();
  try {
    let permission=await folder.handle.queryPermission({mode:'read'});
    if(permission!=='granted'&&requestPermission)permission=await folder.handle.requestPermission({mode:'read'});
    if(permission!=='granted'){$('folderStatus').textContent='Ordnerzugriff erforderlich.';$('syncFolder').textContent='Zugriff erlauben';return;}
    $('syncFolder').textContent='Aktualisieren';
    const entries=await scanFolder(folder.handle,{signal:lifetime.signal});
    await applyFolderEntries(entries);$('folderStatus').textContent='';
  } catch(error){if(!closed)$('folderStatus').textContent=`Abgleich fehlgeschlagen: ${error.message}`;}
  finally{folderBusy=false;renderFolder();}
}
$('linkFolder').onclick=async()=>{
  if(!window.showDirectoryPicker){$('djFolderFiles').click();return;}
  try {
    const handle=await showDirectoryPicker({id:'anydj-dj-music',mode:'read',startIn:'music'});
    if(folderBusy)return;
    const same=folder?.handle && await handle.isSameEntry(folder.handle);
    folder={id:same?folder.id:crypto.randomUUID(),name:handle.name,handle};
    await saveFolder(folder);renderFolder();await syncFolder();
  } catch(error){if(error.name!=='AbortError')notice(error.message,true);}
};
$('syncFolder').onclick=()=>folder?.handle?syncFolder(true):$('djFolderFiles').click();
$('disconnectFolder').onclick=async()=>{
  if(folderBusy)return;
  folder=null;renderFolder();renderLibrary();$('folderStatus').textContent='';
  try{await saveFolder(null);}catch(error){notice(error.message,true);}
};
$('djFolderFiles').onchange=async event=>{
  const files=[...event.target.files];event.target.value='';if(!files.length||folderBusy)return;
  folderBusy=true;
  try {
    const name=files[0].webkitRelativePath.split('/')[0];
    const entries=files.filter(audioFile).map(file=>({file,handle:null,path:file.webkitRelativePath.split('/').slice(1).join('/')}));
    if(entries.length>2000)throw Error('Maximal 2.000 Tracks pro Ordner.');
    folder={id:!folder?.handle&&folder?.name===name?folder.id:crypto.randomUUID(),name,handle:null};
    await saveFolder(folder);
    await applyFolderEntries(entries);$('folderStatus').textContent='Zum Aktualisieren Ordner erneut auswählen.';
  }catch(error){notice(error.message,true);}finally{folderBusy=false;renderFolder();}
};
setInterval(()=>{if(!document.hidden)void syncFolder();},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void syncFolder();});

async function changeTransitionLibrary(change){
 if(!transitionLibraryReady)throw Error('Übergangsbibliothek noch nicht verfügbar.');
 const task=transitionLibrarySave.catch(()=>{}).then(async()=>{const next=change(structuredClone(transitionVariants));await saveTransitionLibrary(next);transitionVariants=next;renderQueue();renderLibrary();});
 transitionLibrarySave=task;return task;
}
async function storeTransitionVariant(pair,plan){
 const [from,to]=pair.libraryTracks||[];
 if(!from||!to||!tracks.includes(from)||!tracks.includes(to)||pair.identities&&pair.identities.some((id,i)=>id!==fileIdentity([from,to][i])))throw Error('Titelpaar wurde geändert. Bitte erneut öffnen.');
 const value=makeTransitionVariant(from,to,plan,{id:pair.variantId,name:pair.variantName,rateA:pair.from.rate,rateB:pair.to.rate});
 await changeTransitionLibrary(values=>[...values.filter(v=>v.id!==value.id),value]);pair.variantId=value.id;
}
async function editLinkedTransition(from,to,variant){
 const urls=[];
 try{
  if(!from?.plan||!to?.plan)throw Error('Beide Titel zuerst analysieren.');
  const identities=[fileIdentity(from),fileIdentity(to)],files=await Promise.all([ensureFile(from),ensureFile(to)]);
  if(identities.some((id,i)=>id!==fileIdentity([from,to][i])))throw Error('Dateien wurden geändert. Bitte erneut öffnen.');
  urls.push(...files.map(f=>URL.createObjectURL(f)));
  const snapshot=(t,i)=>({name:i?'Nächster Titel':'Ausgehender Titel',track:{name:t.name},waveform:t.waveform,duration:t.plan.duration,audioCuts:structuredClone(t.audioCuts||[]),audioCutJoins:structuredClone(t.audioCutJoins||[]),url:urls[i],rate:i?(variant?.rateB||1):(variant?.rateA||1),pitch:true,volume:1,eq:{trim:0,low:0,mid:0,high:0}});
  const plan=variant&&!variantProblem(variant,from,to)?variant.plan:planTransitionPair(cutPlan(from),cutPlan(to),{cue:0,rateA:variant?.rateA||1,rateB:variant?.rateB||1,seconds:fadeSeconds(),musical:true,adaptive:true,notBefore:0});
  const pair={linkLibrary:true,libraryTracks:[from,to],identities,variantId:variant?.id,variantName:variant?.name||'',from:snapshot(from,0),to:snapshot(to,1),position:0,plan:structuredClone(plan),dispose:()=>urls.forEach(url=>URL.revokeObjectURL(url))};
  if(!transitionEditor.openPair(pair))pair.dispose();
 }catch(error){urls.forEach(url=>URL.revokeObjectURL(url));notice(error.message,true);}
}
function showTransitionLinks(from,context){
 const entries=()=>context?.deck?queue:displayedQueue();
 const source=()=>context?.deck?(context.deck.setEntry||{id:'deck-'+context.deck.index,trackId:from.id}):context?.entry;
 const use=context?{exists:id=>entries().some(e=>e.trackId===id&&e!==source()),apply:async(variant,method)=>{
  if(context.deck){if(queueRunning&&context.deck!==queueDeck)throw Error('Bitte den laufenden Queue-Titel wählen.');if(context.deck.track!==from||context.deck.audio.ended)throw Error('Der Deck-Titel hat sich geändert.');}
  else if(context.listId!==selectedQueueList||!entries().includes(context.entry))throw Error('Warteschlange wurde geändert. Bitte erneut öffnen.');
  const live=context.deck||editingLiveQueue();if(live&&(fade||queueBusy))throw Error('Ein Wechsel oder Ladevorgang läuft. Bitte kurz warten.');
  const to=tracks.find(t=>t.id===variant.toTrackId),issue=variantProblem(variant,from,to,context.deck?.audio.playbackRate||1,1);if(issue)throw Error(issue);
  if(context.deck&&context.deck.audio.currentTime>=variant.plan.time)throw Error('Für diesen Durchlauf zu spät. Einen neuen Übergang erstellen.');
  const files=await Promise.all([ensureFile(from),ensureFile(to)]);void files;
  if(live&&(fade||queueBusy))throw Error('Wiedergabe hat sich geändert. Bitte erneut versuchen.');
  if(context.deck&&(context.deck.track!==from||context.deck.audio.currentTime>=variant.plan.time))throw Error('Für diesen Durchlauf nicht mehr verfügbar.');
  if(!context.deck&&(context.listId!==selectedQueueList||!entries().includes(context.entry)))throw Error('Warteschlange wurde geändert.');
  const previous=source(),snapshot=bindVariant(variant,previous,from,to),list=entries();
  let entry=method==='move'?list.find(e=>e.trackId===to.id&&e!==previous):null;
  if(entry){list.splice(list.indexOf(entry),1);entry={...entry};}else entry={id:crypto.randomUUID(),trackId:to.id};
  entry.transition=snapshot;list.splice(context.deck?0:list.indexOf(previous)+1,0,entry);
  if(context.deck){context.deck.setEntry=previous;selectedQueueList='';queueEpoch++;persistQueue();}
  else{if(live)queueEpoch++;persistDisplayedQueue();}
  renderQueue();void prepareTracks();
 }}:null;
 openTransitionLinks({from,getTracks:()=>tracks,getVariants:()=>transitionVariants,problem:(v,a,b)=>variantProblem(v,a,b,context?(context.deck?.audio.playbackRate||1):v.rateA,context?1:v.rateB)||(!a.file&&!a.handle||!b.file&&!b.handle?'Datei verbinden':context?.deck&&context.deck.audio.currentTime>=v.plan.time?'Für diesen Durchlauf zu spät':''),onUse:use,onEdit:(to,v)=>editLinkedTransition(from,to,v),onDelete:v=>changeTransitionLibrary(values=>values.filter(x=>x.id!==v.id)),onRelink:t=>relink(t)});
}
void (async()=>{try{const values=await readTransitionLibrary();transitionVariants=Array.isArray(values)?values.filter(v=>v?.version===1&&typeof v.id==='string'&&copySetTransition(v)):[];transitionLibraryReady=true;renderQueue();renderLibrary();}catch{notice('Übergangsbibliothek konnte nicht geladen werden.',true);}})();


async function editSetTransition(list,entry){
 const entries=list?.entries||queue,index=entries.indexOf(entry),previous=entries[index-1];
 const from=tracks.find(t=>t.id===previous?.trackId),to=tracks.find(t=>t.id===entry.trackId);
 if(!from?.plan||!to?.plan)return;
 const urls=[];
 try{
  const files=await Promise.all([ensureFile(from),ensureFile(to)]);
  if((list?!queueLists.includes(list):entries!==queue)||entries[index]!==entry||entries[index-1]!==previous)throw Error('Die Reihenfolge wurde geändert. Übergang erneut öffnen.');
  urls.push(...files.map(file=>URL.createObjectURL(file)));
  const snapshot=(track,i)=>({name:i?'Nächster Titel':'Ausgehender Titel',track:{name:track.name},waveform:track.waveform,duration:track.plan.duration,audioCuts:structuredClone(track.audioCuts||[]),audioCutJoins:structuredClone(track.audioCutJoins||[]),url:urls[i],rate:1,pitch:true,volume:1,eq:{trim:0,low:0,mid:0,high:0}});
  const plan=matchingSetTransition(entry,previous,from.plan,to.plan,1,1,from,to)||planTransitionPair(cutPlan(from),cutPlan(to),{cue:0,rateA:1,rateB:1,seconds:fadeSeconds(),musical:true,adaptive:true,notBefore:0,entryWindow:Number($('transitionEntryWindow').value)});
  const pair={identities:[fileIdentity(from),fileIdentity(to)],libraryTracks:[from,to],setlist:{list,entry,previous,fromPlan:from.plan,toPlan:to.plan},from:snapshot(from,0),to:snapshot(to,1),position:0,plan:{...plan},dispose:()=>urls.forEach(url=>URL.revokeObjectURL(url))};
  if(!transitionEditor.openPair(pair))pair.dispose();
 }catch(error){urls.forEach(url=>URL.revokeObjectURL(url));notice(error.message,true);}
}

function persistLists(){
  if(!queueListsReady)return;
  const revision=++queueListRevision,snapshot=structuredClone({lists:queueLists,selected:selectedQueueList,liveName:queueSourceName});
  $('queueSaved').textContent='Speichert …';
  queueListsSave=queueListsSave.then(()=>saveQueueLists(snapshot)).then(()=>{
    if(revision===queueListRevision)$('queueSaved').textContent='Auf diesem Gerät gespeichert.';
    return true;
  }).catch(()=>{if(revision===queueListRevision)$('queueSaved').textContent='Speichern fehlgeschlagen. Änderungen sind nur in diesem Fenster verfügbar.';return false;});
}
function persistDisplayedQueue(){if(viewedQueue())persistLists();else persistQueue();void prepareTracks();}
function renderQueueManager(){
  const select=$('queueSelect'),signature=JSON.stringify([queueSourceName,queueLists.map(({id,name})=>({id,name}))]);
  if(select.dataset.lists!==signature){select.dataset.lists=signature;select.replaceChildren(new Option('Aktuelle Warteschlange'+(queueSourceName?' · '+queueSourceName:''),''),...queueLists.map(list=>new Option(list.name,list.id)));}
  if(select.value!==selectedQueueList)select.value=selectedQueueList;if(select.disabled!==!queueListsReady)select.disabled=!queueListsReady;
  const list=viewedQueue();$('queueNameLabel').hidden=!list;$('queueDeleteList').hidden=!list;
  if($('queueName').ownerDocument.activeElement!==$('queueName'))$('queueName').value=list?.name||'';
  $('queueSaveList').textContent=list?'Setliste speichern':'Als Setliste speichern';
  $('queueSaveList').disabled=$('queueNew').disabled=!queueListsReady;
  $('queueLive').textContent=list&&queueRunning?`${queueSourceName||'Aktuelle Wiedergabe'} läuft weiter · ${queue.length} Titel verbleiben` : '';
  $('enqueueAll').title=list?'In „'+list.name+'“ einreihen':'In aktuelle Warteschlange einreihen';
}
function createQueueList(entries=[]){
  if(!queueListsReady)return;
  let number=1;while(queueLists.some(list=>list.name==='Liste '+number))number++;
  const entryIds=new Map(entries.map(entry=>[entry.sourceEntryId||entry.id,entry.id]));
  const list={id:crypto.randomUUID(),name:'Liste '+number,entries:entries.map(entry=>{
   const copy=copyQueueEntry(entry);delete copy.sourceEntryId;
   if(copy.transition)copy.transition.fromEntryId=entryIds.get(copy.transition.fromEntryId)||copy.transition.fromEntryId;
   return copy;
  })};
  queueLists.push(list);selectedQueueList=list.id;persistLists();renderQueue();$('queueName').closest('.dj-list-options').open=true;$('queueName').focus();$('queueName').select();
}
$('queueSelect').onchange=()=>{const id=$('queueSelect').value;clearQueueDrag();selectedQueueList=id;persistLists();renderQueue();};
$('queueNew').onclick=()=>createQueueList();
$('queueSaveList').onclick=()=>{if(viewedQueue())persistLists();else createQueueList(queue);};
$('queueName').oninput=()=>{const list=viewedQueue();if(!list)return;list.name=$('queueName').value.trim().slice(0,80)||'Unbenannte Liste';persistLists();renderQueue();};
$('queueDeleteList').onclick=()=>{const list=viewedQueue();if(!list||!confirm('Liste „'+list.name+'“ löschen? Die laufende Wiedergabe bleibt erhalten.'))return;queueLists=queueLists.filter(item=>item!==list);selectedQueueList='';persistLists();renderQueue();};

function persistQueue() {
  const snapshot=queue.map(entry=>copyQueueEntry(entry));
  queueSave=queueSave.then(()=>saveQueue(snapshot)).then(()=>true).catch(()=>{notice('Warteschlange konnte nicht gespeichert werden.',true);return false;});
}
function refillShuffle(){
  if(!shuffleEnabled||!queueListsReady)return;
  const queuedIds=new Set(queue.map(entry=>entry.id));
  for(const id of shuffleEntries)if(!queuedIds.has(id))shuffleEntries.delete(id);
  let changed=false;
  while(queue.length<shuffleCount){
    const track=shufflePicker.next(tracks,[...queue.map(e=>e.trackId),...decks.filter(d=>d.track&&!d.autoUsed&&!d.audio.ended).map(d=>d.track.id)]);
    if(!track)break;
    const entry={id:crypto.randomUUID(),trackId:track.id};
    queue.push(entry);shuffleEntries.add(entry.id);changed=true;
  }
  if(changed){persistQueue();void prepareTracks();}
}
$('queueShuffle').onclick=()=>{
  shuffleEnabled=!shuffleEnabled;
  if(shuffleEnabled){
    shufflePicker.reset();selectedQueueList='';persistLists();refillShuffle();
    queueMessage=queue.length?'Shuffle bereit':'Keine verfügbaren Dateien für Shuffle';
  }
  renderQueue();
};
$('queueShuffleCount').value=shuffleCount;
$('queueShuffleCount').onchange=()=>{
  shuffleCount=shuffleLookahead($('queueShuffleCount').value);
  $('queueShuffleCount').value=shuffleCount;
  try{localStorage.setItem('anydj-shuffle-count',String(shuffleCount));}catch{}
  refillShuffle();renderQueue();
};
function enqueue(track) {
  displayedQueue().push({id:crypto.randomUUID(),trackId:track.id});persistDisplayedQueue();renderQueue();
}
function pauseQueue(message='Automatik pausiert') {
  if(!queueRunning&&!message)return;
  if(queueRunning){autoFadePaused=true;queueRunning=false;queueEpoch++;queueMessage=message;renderQueue();}
}
function consumeQueue(deck) {
  if(!deck.queueEntry)return;
  deck.setEntry=queue.find(entry=>entry.id===deck.queueEntry);
  if(deck.setEntry?.sourceEntryId)setPlayed.add(deck.setEntry.sourceEntryId);
  shuffleEntries.delete(deck.queueEntry);queue=queue.filter(entry=>entry.id!==deck.queueEntry);deck.queueEntry=null;
  persistQueue();renderQueue();
}
$('enqueueAll').onclick=()=>{
  for(const track of libraryView())if(!track.missing&&!track.pendingChange)displayedQueue().push({id:crypto.randomUUID(),trackId:track.id});
  persistDisplayedQueue();renderQueue();
};
function editQueue(action,listId=selectedQueueList) {
  if(listId!==selectedQueueList)return;
  if(editingLiveQueue()&&fade?.fromQueue)return;
  if(editingLiveQueue())queueEpoch++;action(displayedQueue());persistDisplayedQueue();renderQueue();
}
const queueExportMenu=createQueueExportMenu($('queueExport'),()=>({entries:displayedQueue(),tracks,ensureFile,name:viewedQueue()?.name||'Aktuelle Warteschlange',options:{seconds:fadeSeconds(),musical:$('autoBeat').checked,adaptive:$('fadeDuration').value==='auto',entryWindow:Number($('transitionEntryWindow').value),preferredStyle:$('transitionPreference').value}}));
$('queueClear').onclick=()=>editQueue(entries=>{if(editingLiveQueue())shuffleEnabled=false;entries.splice(0);});
let queueResumeBusy=false;
function canResumeQueue(){
 return Boolean((editingLiveQueue()||activeSetId===selectedQueueList)&&queueDeck?.setEntry&&
  (queue.length||queueDeck.spotify&&!queueDeck.spotifyEnded||queueDeck.track&&!queueDeck.audio.ended));
}
async function resumeQueue(){
 if(queueResumeBusy)return;
 if(!canResumeQueue())return $('queueStart').onclick();
 if(queueRunning)return;
 if(fade||decks.some(d=>d!==queueDeck&&(!d.audio.paused||d.spotifyStarted&&!d.spotifyPaused)))return 'Zum Fortsetzen bitte den Übergang beenden und das andere Deck pausieren.';
 queueResumeBusy=true;renderQueue();
 const current=queueDeck,entry=current.setEntry,selected=selectedQueueList;
 try{
  await audioReady();
  if(current!==queueDeck||entry!==current.setEntry||selected!==selectedQueueList)return;
  if(current.spotify){if(!current.spotifyEnded&&current.spotifyPaused)await toggleDeck(current,true);}
  else if(current.track&&!current.audio.ended&&current.audio.paused)await toggleDeck(current,true);
  if(current!==queueDeck||entry!==current.setEntry||selected!==selectedQueueList)return;
  queueRunning=true;queueEpoch++;queueMessage='Automatik fortgesetzt';autoFadePaused=false;
 }catch(error){notice(error.message,true);return error.message;}
 finally{queueResumeBusy=false;renderQueue();}
}
$('queuePlay').onclick=async()=>{const error=await resumeQueue();if(error){queueMessage=error;notice(error,true);renderQueue();}};
$('queueStart').onclick=async()=>{
  if(queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList)){pauseQueue();return;}
  if(fade||decks.filter(d=>!d.audio.paused).length>1){notice('Zum Start der Warteschlange bitte den Übergang beenden und nur ein Deck laufen lassen.',true);return;}
  try {
    const selected=viewedQueue();if(selected)pauseQueue();
    await audioReady();
    if(selected&&selected!==viewedQueue())return;
    if(viewedQueue()){shuffleEnabled=false;queueSourceName=viewedQueue().name;activeSetId=viewedQueue().id;setPlayed.clear();queue=viewedQueue().entries.map(entry=>({...copyQueueEntry(entry,crypto.randomUUID()),sourceEntryId:entry.id}));persistQueue();persistLists();}
    queueDeck=spotifyDeck?.spotifyStarted?spotifyDeck:decks.find(d=>!d.audio.paused)||null;
    if(queueDeck?.spotify&&queueDeck.spotifyPaused)await spotifyLibrary.playback.toggle();
    queueRunning=true;queueEpoch++;queueMessage='';autoFadePaused=false;
    renderQueue();
  }catch(error){notice(error.message,true);return error.message;}
};
// Copy library titles into the selected list; queue rows retain their move behavior.
const queueDropZone=document.querySelector('.dj-queue');
function clearLibraryQueueDrop(){
  queueDropActive=false;queueDropZone.classList.remove('dragging');
  if(!queueDrag)for(const row of $('queueList').children)row.classList.remove('drop-before','drop-after');
}
function queueDropKind(event){
  if(!queueListsReady)return null;
  const types=[...(event.dataTransfer?.types||[])];
  if(queueDrag&&types.includes('application/x-anydj-queue'))return editingLiveQueue()&&fade?.fromQueue?null:'move';
  return types.some(type=>['application/x-anydj-track','application/x-anydj-provider-track'].includes(type))?'copy':null;
}
// Resolve against the whole list, including child controls and empty space.
// Store a stable entry ID rather than an index that can change during playback.
function queueDropBefore(y){
  if(editingLiveQueue()&&fade?.fromQueue)return null; // Adding remains safe at the end during a live transition.
  return [...$('queueList').querySelectorAll('[data-queue-id]')].find(row=>{
    const rect=row.getBoundingClientRect();return y<rect.top+rect.height/2;
  })||null;
}
queueDropZone.addEventListener('dragover',event=>{
  const kind=queueDropKind(event);if(!kind)return;
  event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=kind;
  queueDropActive=true;queueDropZone.classList.add('dragging');
  const rows=[...$('queueList').querySelectorAll('[data-queue-id]')];
  for(const row of rows)row.classList.remove('drop-before','drop-after');
  const before=queueDropBefore(event.clientY);
  if(before)before.classList.add('drop-before');else rows.at(-1)?.classList.add('drop-after');
  const list=$('queueList'),bounds=list.getBoundingClientRect();
  if(event.clientY>=bounds.top&&event.clientY<=bounds.bottom){
    if(event.clientY<bounds.top+32)list.scrollTop-=12;else if(event.clientY>bounds.bottom-32)list.scrollTop+=12;
  }
},true);
queueDropZone.addEventListener('dragleave',event=>{if(!queueDropZone.contains(event.relatedTarget))clearLibraryQueueDrop();});
queueDropZone.addEventListener('drop',event=>{
  const kind=queueDropKind(event),beforeId=queueDropBefore(event.clientY)?.dataset.queueId;
  clearLibraryQueueDrop();if(!kind)return;
  event.preventDefault();event.stopPropagation();
  const insert=(entries,entry)=>{const index=entries.findIndex(e=>e.id===beforeId);entries.splice(index<0?entries.length:index,0,entry);};
  if(kind==='move'){
    const source=queueDrag;queueDrag=null;
    editQueue(entries=>{const index=entries.findIndex(e=>e.id===source);if(index<0||source===beforeId)return;const [entry]=entries.splice(index,1);insert(entries,entry);});
    clearQueueDrag();return;
  }
  const copy=entry=>{
    if(editingLiveQueue()&&fade?.fromQueue){displayedQueue().push(entry);persistDisplayedQueue();renderQueue();}
    else editQueue(entries=>insert(entries,entry));
  };
  const provider=event.dataTransfer.getData('application/x-anydj-provider-track');
  if(provider){try{const entry=spotifyQueueEntry(JSON.parse(provider));copy(entry);}catch(error){notice(error.message,true);}return;}
  const track=tracks.find(t=>t.id===event.dataTransfer.getData('application/x-anydj-track'));
  if(!track||track.deleted||track.missing||track.pendingChange){notice('Dieser Titel ist derzeit nicht verfügbar. Bitte die Datei erneut verbinden.',true);return;}
  copy({id:crypto.randomUUID(),trackId:track.id});
},true);
// Provider sources need the same protection as local library rows.
document.addEventListener('dragstart',event=>{
  if(event.defaultPrevented)return;
  if([...(event.dataTransfer?.types||[])].some(type=>['application/x-anydj-track','application/x-anydj-provider-track'].includes(type)))libraryDragging=true;
});
document.addEventListener('dragend',()=>{libraryDragging=false;clearLibraryQueueDrop();renderLibrary();renderQueue();});
function clearQueueDrag() {
  queueDrag=null;
  for(const row of $('queueList').children)row.classList.remove('queue-dragging','drop-before','drop-after');
  renderQueue();
}
function bindQueueDrag(row,id) {
  row.dataset.queueId=id;row.draggable=!(editingLiveQueue()&&fade?.fromQueue);
  const grip=document.createElement('span');grip.className='queue-grip';grip.textContent='⠿';grip.title='Ziehen zum Verschieben';grip.setAttribute('aria-hidden','true');row.prepend(grip);
  row.addEventListener('dragstart',event=>{
    if(editingLiveQueue()&&(fade?.fromQueue||queueBusy)){event.preventDefault();return;}
    queueDrag=id;if(editingLiveQueue())queueEpoch++;event.dataTransfer.effectAllowed='copyMove';
    event.dataTransfer.setData('application/x-anydj-queue',id);row.classList.add('queue-dragging');
    const entry=displayedQueue().find(entry=>entry.id===id);
    if(entry?.provider==='spotify')event.dataTransfer.setData('application/x-anydj-provider-track',JSON.stringify(entry.remote));
    else if(entry?.trackId)event.dataTransfer.setData('application/x-anydj-track',entry.trackId);
  });
  row.addEventListener('dragend',clearQueueDrag);
}

function renderQueue() {
  if(queueDrag||queueDropActive||libraryDragging)return;
  renderQueueManager();
  const editingId=selectedQueueList,queue=displayedQueue(),locked=editingLiveQueue()&&Boolean(fade?.fromQueue);
  $('queueExport').disabled=!queueListsReady||!queue.length;
  $('queueShuffle').disabled=!queueListsReady;
  $('queueShuffle').setAttribute('aria-pressed',String(shuffleEnabled));
  $('queueCount').textContent=queue.length;
  $('queueStart').textContent=editingLiveQueue()?(queueRunning?'Automatik pausieren':'Start'):queueRunning&&activeSetId===selectedQueueList?'Set-Automatik pausieren':'Set von Anfang starten';
  $('queueStart').disabled=!queueListsReady||(!queue.length&&(!queueRunning||!editingLiveQueue()));
  const resumable=canResumeQueue();
  $('queuePlay').disabled=!queueListsReady||queueResumeBusy||Boolean(fade)||queueRunning&&(editingLiveQueue()||activeSetId===selectedQueueList)||(!resumable&&!queue.length);
  $('queuePlay').title=resumable?'Aktuellen Titel an der pausierten Stelle fortsetzen':'Ausgewählte Warteschlange abspielen';
  if(resumable&&!queueRunning){$('queueStart').textContent=editingLiveQueue()?'Nächsten Titel starten':'Set von Anfang starten';}
  $('queueClear').disabled=!queue.length||locked;
  $('queueStatus').textContent=editingLiveQueue()?(/^Automatik läuft(?: · Spotify)?$/.test(queueMessage)?'':queueMessage):'Feste Setliste · Titel bleiben erhalten. Änderungen gelten beim nächsten Set-Start.';
  const byId=new Map(tracks.map(track=>[track.id,track]));
  const signature=JSON.stringify([transitionLibraryReady,transitionVariants,selectedQueueList,activeSetId,[...setPlayed],decks.map(d=>[d.setEntry?.sourceEntryId,d.audio.paused,d.audio.ended]),queue,locked,queue.map(entry=>{const track=byId.get(entry.trackId);return [track?.name,track?.audioCuts,track?.audioCutJoins,Boolean(track?.basePlan?.arrangement),analysisStatus(track,$('djStructure').checked),decks.find(d=>d.queueEntry===entry.id)?.name];})]);
  if(signature===queueSignature)return;queueSignature=signature;
  const scroll=$('queueList').scrollTop;$('queueList').replaceChildren();
  for(const [index,entry] of queue.entries()) {
    const track=entry.provider==='spotify'?entry.remote:byId.get(entry.trackId),deck=decks.find(d=>d.queueEntry===entry.id);
    const li=document.createElement('li'),info=document.createElement('div');info.className='dj-track-info';
    const title=document.createElement('strong');title.textContent=`${index+1}. ${track?.name||'Track fehlt'}`;
    const status=document.createElement('small');
    if(entry.provider==='spotify')status.textContent=(deck?'Deck '+deck.name+' · ':'')+'Spotify';
    else if(!track){status.textContent='Datei erneut hinzufügen oder Eintrag entfernen';status.dataset.analysis='warning';}
    else if(deck){paintAnalysis(status,track);status.textContent=`Deck ${deck.name} · ${status.textContent}`;}
    else if(analysisStatus(track,$('djStructure').checked).kind!=='complete')paintAnalysis(status,track);
    else status.textContent=viewedQueue()?'Bereit':index===0?'Als Nächstes · bereit':'Bereit';
    if(viewedQueue()&&activeSetId===selectedQueueList&&setPlayed.has(entry.id)){const playing=decks.find(d=>d.setEntry?.sourceEntryId===entry.id&&!d.audio.paused&&!d.audio.ended);status.textContent=playing?'Läuft · Deck '+playing.name:'Bereits gespielt';}
    info.append(title,status);li.append(info);
    if(!entry.provider){
      const cut=button('',()=>editTrackAudio(track),!track?.plan||track.missing||track.pendingChange,'Lied schneiden');
      cut.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12 12M8.2 15.8 20 4M14 10l-4 4"/></svg><span>Lied schneiden</span>';li.append(cut);
      const editLight=button('',()=>editSections(track,()=>decks.find(d=>d.track===track)?.audio.currentTime??0),!track?.basePlan?.arrangement,`Lichtshow bearbeiten: ${track?.name||'Track fehlt'}`);
      editLight.dataset.queueLightEditor=entry.id;
      editLight.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 18h6M10 21h4M9 15c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v1H9z"/></svg>';
      if(editLight.disabled)editLight.title=track?'Verfügbar, sobald die Lichtshow berechnet ist':'Titel zuerst wieder hinzufügen';
      li.append(editLight);
    }
    const remove=button('',()=>editQueue(entries=>{const i=entries.findIndex(item=>item.id===entry.id);if(i>=0)entries.splice(i,1);},editingId),locked,'Aus Warteschlange entfernen');remove.classList.add('queue-row-remove');
    remove.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>';li.append(remove);
    if(entry.transition){li.append(button('Übergang entfernen',()=>editQueue(list=>{delete list.find(e=>e.id===entry.id)?.transition;},editingId),locked));const previous=queue[index-1]||(editingLiveQueue()?queueDeck?.setEntry:null),from=byId.get(previous?.trackId);const valid=from?.plan&&track?.plan&&matchingSetTransition(entry,previous,from.plan,track.plan,1,1,from,track);const badge=document.createElement('small');badge.textContent=valid?'Übergang: '+(entry.transition.variantName||'Gespeichert'):'Übergang passt nicht · bitte neu wählen';info.append(badge);}
    title.title=track?.name||'Track fehlt';bindQueueDrag(li,entry.id);groupQueueActions(li,entry);
    if(index<queue.length-1){
     const next=queue[index+1],nextTrack=byId.get(next.trackId),list=viewedQueue();
     const separator=document.createElement('div');separator.className='queue-transition-separator';
     const transitionButton=button('',()=>void editSetTransition(list,next),locked||!transitionLibraryReady||!track||Boolean(entry.provider)||Boolean(next.provider)||!track?.plan||!nextTrack?.plan,`Übergang: ${track?.name||'Titel fehlt'} → ${nextTrack?.name||'nächster Titel'}`);
     transitionButton.className='queue-transition-button';transitionButton.setAttribute('aria-label',transitionButton.title);transitionButton.dataset.queueTransition=entry.id;
     transitionButton.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h3c5 0 5 12 10 12h3M4 18h3c5 0 5-12 10-12h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
     const confirmed=Boolean(track?.plan&&nextTrack?.plan&&matchingSetTransition(next,entry,track.plan,nextTrack.plan,1,1,track,nextTrack));
     const state=confirmed?'confirmed':next.transition?'review':'auto',label=confirmed?'Bestätigt':next.transition?'Prüfen':'Automatisch';
     const control=document.createElement('div');control.className='queue-transition-control';control.dataset.state=state;
     transitionButton.title+=` · ${label}`;transitionButton.setAttribute('aria-label',transitionButton.title);
     control.append(transitionButton);separator.append(control);li.classList.add('has-queue-transition');li.append(separator);
    }
    $('queueList').append(li);
  }
  if(!queue.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Titel aus der Bibliothek mit + zur Warteschlange hinzufügen';$('queueList').append(li);}
  $('queueList').scrollTop=scroll;
}
async function advanceQueue() {
  if(!queueRunning||queueBusy||closed||fade||(queueDrag&&editingLiveQueue()))return;
  queueBusy=true;const epoch=queueEpoch;
  try {
    await perform(async()=>{
      try {
      if(!queueRunning||epoch!==queueEpoch||fade)return;
      if(shuffleEnabled){
        const before=queue.length;
        queue=queue.filter(entry=>{
          if(!shuffleEntries.has(entry.id))return true;
          const track=tracks.find(t=>t.id===entry.trackId);
          if(track&&!track.deleted&&!track.missing&&!track.pendingChange&&!track.failed&&!track.queuePreparationError)return true;
          shuffleEntries.delete(entry.id);return false;
        });
        if(queue.length!==before)persistQueue();
        refillShuffle();
      }
      if(queueDeck?.spotify&&queueDeck.spotifyStarted&&!queueDeck.spotifyEnded){queueMessage='Automatik läuft · Spotify';return;}
      const first=queue[0];
      if(first?.provider==='spotify'){
        const localPlaying=decks.find(d=>!d.audio.paused);
        let target=decks.find(d=>d.queueEntry===first.id);
        if(!target){target=localPlaying?decks[1-localPlaying.index]:queueDeck?decks[1-queueDeck.index]:decks[0];await loadSpotifyDeck(target,first.remote,true);if(epoch!==queueEpoch||!queueRunning)return;target.queueEntry=first.id;}
        if(localPlaying){queueMessage='Als Nächstes · '+first.remote.name+' · Spotify';return;}
        await startSpotifyDeck(target);
        if(epoch!==queueEpoch||!queueRunning){stopSpotify();return;}
        queueDeck=target;consumeQueue(target);queueMessage='Automatik läuft · Spotify';return;
      }
      const playing=queueDeck&&!queueDeck.audio.paused;
      const target=playing?decks[1-queueDeck.index]:decks.find(d=>d.queueEntry===queue[0]?.id)||queueDeck||decks[0];
      const entry=queue[0];
      if(!entry){
        if(playing&&target!==queueDeck&&target.audio.paused&&target.autoUsed&&target.track)await unload(target);
        queueMessage=playing?'Letzter Track läuft':'Warteschlange beendet';
        if(!playing){queueRunning=false;queueEpoch++;}
        return;
      }
      const track=tracks.find(t=>t.id===entry.trackId);
      if(!track)throw Error('Track fehlt. Eintrag entfernen oder Datei erneut hinzufügen.');
      if(track.failed)throw Error(`${track.name}: Analyse fehlgeschlagen.`);
      if(shuffleEntries.has(entry.id)){
        try{await readPreparationFile(track);}catch(error){track.queuePreparationError=error.message;return;}
        if(epoch!==queueEpoch||!queueRunning)return;
      }
      if(target.queueEntry!==entry.id) {
        // Never replace a playing deck, including manual playback started while awaiting a file.
        if(!target.audio.paused)throw Error(`Deck ${target.name} ist noch belegt.`);
        await loadDeck(target,track,true);
        if(epoch!==queueEpoch||!queueRunning)return;
        target.queueEntry=entry.id;renderQueue();
      }
      if(!track.plan){queueMessage=playing?'Nächster Track wird vorbereitet …':'Warte auf Berechnung …';return;}
      if(epoch!==queueEpoch||!queueRunning)return;
      if(!playing) {
        $('crossfader').value=target.index;updateGains();
        target.audio.currentTime=target.cue;await toggleDeck(target,true);
        if(epoch!==queueEpoch||!queueRunning){target.audio.pause();return;}
        queueDeck=target;consumeQueue(target);queueMessage='Automatik läuft';
      } else {
        if(entry.transition&&!matchingSetTransition(entry,queueDeck.setEntry,queueDeck.track?.plan||{},track.plan,queueDeck.audio.playbackRate,target.audio.playbackRate,queueDeck.track,track))throw Error('Gespeicherter Übergang passt nicht mehr. Bitte neu wählen oder aus dem Eintrag entfernen.');
        queueMessage='Automatik läuft';
        const point=plannedTransition(queueDeck);
        if(track.plan&&queueDeck.audio.currentTime>=point.time)requestFade(queueDeck.index,true,$('autoBeat').checked);
      }
      }catch(error){pauseQueue(error.message);notice(error.message,true);}
    });
  }catch(error){pauseQueue(error.message);notice(error.message,true);}
  finally{queueBusy=false;renderQueue();}
}
setInterval(()=>{void advanceQueue();if(!closed)renderQueue();},200);
setInterval(()=>{if(!closed&&queueListsReady&&!preparing&&!refining){void prepareTracks();}},1500);

$('djShowProfile').onchange=()=>{
  showProfile=$('djShowProfile').value;
  try{localStorage.setItem('anydj-dj-show-profile',showProfile);}catch{}
  lightStage.setMovingMood(movingMoodForProfile(showProfile));
  for(const track of tracks)if(track.basePlan&&!SHOW_PROFILES.includes(track.showProfile))replacePlan(track,track.basePlan);
  for(const deck of decks)syncDeckShowProfile(deck);
  updateLightPreview();
};

if(webMode){
  $('demoTracks').onclick=()=>perform(async()=>{
    const button=$('demoTracks');button.disabled=true;
    try{const {createDemoFiles}=await import('./web-demo.js');await addFiles(createDemoFiles().map(file=>({file})));}
    finally{button.disabled=false;}
  });
}

const djTutorial=createDJTutorial();
detachedQueue=createDetachedQueue(queueDropZone,{
 onDragEnd:()=>{libraryDragging=false;queueDrag=null;clearLibraryQueueDrop();renderLibrary();renderQueue();},
 onLayout:repositionQueueActions,onKey:event=>performanceControls.handleShortcut(event),onError:message=>notice(message,true)
});
window.addEventListener('pagehide',()=>djTutorial.destroy(),{once:true});
