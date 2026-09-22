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
import {applyTrackColors} from './dj-color-modes.js';
import {createColorPicker} from './dj-color-picker.js';
import {applySectionLighting} from './section-lighting.js';
import {openSectionEditor} from './section-editor.js';
import {applyShowProfile,SHOW_PROFILES} from './dj-show-profile.js';
import {analysisStatus,transitionStatus} from './dj-status.js';
import {startShowClock} from './show-clock.js';
import { analyzeBeats } from './beat-analysis.js';
import { analyzeStyle } from './style-analysis.js';
import { analyzeStructure } from './structure-analysis.js';
import { showFrameAt, transitionFrame } from './show-plan.js';
import { deckGains, mixDeckFrames, fileIdentity, formatTime, crossfadePosition, automaticFadeSource } from './dj-model.js';
import { readShow, saveShow, readLibrary, saveTrack, removeTrack, readFolder, saveFolder, saveFolderChanges, readQueue, saveQueue, readQueueLists, saveQueueLists } from './dj-library.js';

import {scanFolder, folderChanges, audioFile} from './dj-folder.js';

const $ = id => document.getElementById(id);
let lightTuning;
const adjustLight=frame=>tuneLightFrame(frame,lightTuning?.settings);
const lightStage=createDmxStage($('openLightStage'),{adjustFrame:adjustLight});
const webMode=document.documentElement.dataset.edition==='web';
if(webMode){$('djStructure').checked=false;$('djStructure').disabled=true;}
let showProfile='auto';
try{const saved=localStorage.getItem('wiz-dj-show-profile');if(SHOW_PROFILES.includes(saved))showProfile=saved;}catch{}
$('djShowProfile').value=showProfile;
const design = {arrangement:'auto', mood:'auto', minimum:5, maximum:100,...(webMode?{analysisMode:'browser'}:{})};
let token = ''; try { token = sessionStorage.getItem('wiz-web-token') || ''; } catch {}
let tracks = [], context, session = null, sending = false, closed = false;
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
let queueLists=[],selectedQueueList='',queueSourceName='',queueListsReady=false,queueListsSave=Promise.resolve(),queueListRevision=0;
const viewedQueue=()=>queueLists.find(list=>list.id===selectedQueueList);
const displayedQueue=()=>viewedQueue()?.entries||queue;
const editingLiveQueue=()=>!viewedQueue();
let queueSave=Promise.resolve(),queueSignature='',queueDrag=null;
let libraryDragging=false,queueDropActive=false;
let actions = Promise.resolve();
let connectionChecking = false, connectionReady = false, connectionIP = '';
try { connectionIP = localStorage.getItem('wiz-selected') || ''; } catch {}
let selectedLampIP=connectionIP, lampSelectionRevision=0;
try { if(localStorage.getItem('wiz-dj-light-enabled')==='false')selectedLampIP=''; } catch {}
const perform = action => { actions = actions.then(action).catch(error => notice(error.message, true)); return actions; };
function notice(text, error = false) { $('djStatus').hidden = !error; $('djStatus').textContent = error ? text : '';  $('djStatus').className = `notice${error?' warning':''}`; }
async function api(path, body, keepalive = false) {
  if(webMode)throw Error('Lampensteuerung ist in der lokalen App verfügbar.');
  const response = await fetch(path, {method:body === undefined?'GET':'POST', headers:{'Content-Type':'application/json','X-AnyDj-Local':'1',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body === undefined?{}:{body:JSON.stringify(body)}), keepalive, signal:AbortSignal.timeout(30000)});
  const result = await response.json(); if (!response.ok) throw Object.assign(Error(result.error?.message || `HTTP ${response.status}`), {status:response.status}); return result;
}
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
  panel.innerHTML = `<h2>DECK ${name}</h2><div class="dj-track-title">Track laden</div><canvas width="640" height="64" aria-label="Vorbereiteter Lichtverlauf"></canvas><p class="dj-look small"></p><p class="dj-analysis small muted" role="status">Leer</p><label>Position <input class="dj-seek range" type="range" min="0" max="1" value="0" step="0.1" disabled></label><output class="dj-clock">0:00 / 0:00</output><div class="dj-buttons"><button class="button primary dj-play" disabled>Play</button><button class="button secondary dj-cue" disabled>Cue</button><button class="button secondary dj-set-cue" disabled>Cue setzen</button><button class="button secondary dj-unload" disabled>Entladen</button></div><label>Lautstärke <input class="dj-volume range" type="range" min="0" max="1" value="1" step="0.01"></label>`;
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
  edit.onclick=()=>editSections(deck.track,()=>deck.audio.currentTime);
  panel.querySelector('.dj-play').onclick = () => perform(() => toggleDeck(deck));
  panel.querySelector('.dj-cue').onclick = () => { pauseQueue();cancelFade(); return perform(async () => {audio.pause(); audio.currentTime = deck.cue; deck.loop=null; deck.transition = null; await stopIfSilent();}); };
  panel.querySelector('.dj-set-cue').title='Cue exakt festlegen · Shift-Klick: Cue aufheben';
  panel.querySelector('.dj-set-cue').onclick = event => {deck.cue = event.shiftKey?0:audio.currentTime; deck.cueLocked=!event.shiftKey; panel.querySelector('.dj-cue').textContent = `Cue ${formatTime(deck.cue)}`;};
  panel.querySelector('.dj-unload').onclick = () => {pauseQueue();return perform(async () => {await unload(deck); await syncFolder();});};
  panel.querySelector('.dj-seek').oninput = event => deck.spotify?void spotifyLibrary.playback.seek(Number(event.target.value)).catch(e=>notice(e.message,true)):performanceControls.seek(deck,Number(event.target.value));
  panel.querySelector('.dj-volume').oninput = updateGains;
  audio.onseeking = () => {deck.pairPlan=null;};
  audio.onended = () => perform(stopIfSilent);
  audio.onpause = () => { if(!providerSwitch&&queueRunning&&deck===queueDeck&&!audio.ended)pauseQueue();if (fade && (fade.to===deck || (fade.from===deck && !audio.ended))) cancelFade(); if (!closed) void perform(stopIfSilent); };
  audio.onerror = () => perform(async () => {pauseQueue('Datei kann nicht abgespielt werden.');audio.pause(); await stopIfSilent(); notice(`Deck ${name}: Datei kann nicht abgespielt werden. Bitte erneut verknüpfen.`, true);});
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
simplifyDJLayout(decks,mixer);
const fullButton=document.createElement('button');fullButton.type='button';fullButton.className='button secondary';fullButton.textContent='Full';fullButton.title='Party-Lichtshow im Vollbild öffnen';
mixer.querySelector('.dj-light-heading').append(fullButton);
const fullMode=createFullMode(fullButton,{adjustFrame:adjustLight});
lightTuning=createLightTuning(lightStage.tuningHost,()=>updateLightPreview());
lightTuning.root.open=true;
const tuneButton=document.createElement('button');tuneButton.type='button';tuneButton.className='button secondary';tuneButton.textContent='Licht feinjustieren';tuneButton.onclick=()=>lightStage.openSettings('tuning');
mixer.querySelector('.dj-light-settings').append(tuneButton);
createTransitionPreview({host:document.querySelector('.dj-mixer-transition'),
 isPlaying:()=>Boolean(spotifyDeck?.spotifyStarted&&!spotifyDeck.spotifyPaused)||decks.some(d=>!d.audio.paused),
 getPair:()=>{
  const source=fadeSource(),from=decks[source>=0?source:Number($('crossfader').value)<.5?0:1],to=decks[1-from.index];
  if(fade||!from.track?.plan||!to.track?.plan||!from.url||!to.url||from.resumeTime!=null||to.resumeTime!=null)return null;
  if(queueRunning&&to.queueEntry!==queue[0]?.id)return null;
  const plan=plannedTransition(from);if(!plan.duration)return null;
  const snapshot=d=>({name:d.name,track:{name:d.track.name},url:d.url,rate:d.audio.playbackRate,pitch:d.audio.preservesPitch,
   volume:Number(d.panel.querySelector('.dj-volume').value),eq:Object.fromEntries([...d.panel.querySelectorAll('[data-eq]')].map(e=>[e.dataset.eq,Number(e.value)]))});
  return {source:from,token:plan,position:from.index===0?Number($('crossfader').value):1-Number($('crossfader').value),from:snapshot(from),to:snapshot(to),plan:{...plan}};
 },
 onChoose:(pair,choice,remember)=>{
  const from=pair.source;
  if(fade||plannedTransition(from)!==pair.token||from.audio.currentTime>choice.time)return false;
  if(remember){$('transitionPreference').value=choice.style;$('transitionPreference').dispatchEvent(new Event('change'));from.pairPlan.keys[15]=choice.style;}
  from.pairPlan.value={...choice,alternatives:pair.token.alternatives};pair.token=from.pairPlan.value;
  return true;
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
      void stopIfSilent().catch(e=>notice(e.message,true));
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
  try{cancelFade(true);lightStage.stop();for(const d of decks)d.audio.pause();await stopIfSilent();}
  finally{providerSwitch=false;}
  stopSpotify();spotifyDeck=deck;deck.spotifyStarted=true;deck.spotifyEnded=false;deck.spotifyPaused=true;
  $('crossfader').value=deck.index;updateGains();
  try{await spotifyLibrary.playback.play(deck.spotify.id,Number(deck.panel.querySelector('.dj-volume').value)*Number(document.querySelector('[data-master]').value));}
  catch(error){deck.spotifyStarted=false;throw error;}
}
document.querySelector('[data-master]').addEventListener('input',()=>{if(spotifyDeck)updateGains();});
const browserSession=createDJSession({decks,updateGains,drawDeck,restoreFile:restoreDeckFile,
  reconnect:deck=>{if(deck.track?.handle)void perform(()=>restoreDeckFile(deck));else if(deck.track)relink(deck.track);}});
async function restoreDeckFile(deck){
  const track=deck.track;if(!track||deck.resumeTime==null)return;
  const file=await ensureFile(track);if(deck.track!==track)return;
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
function plannedTransition(deck){
  const next=decks[1-deck.index];
  if(!next?.track?.plan||(queueRunning&&next.queueEntry!==queue[0]?.id))return transitionPoint(deck.track?.plan,fadeSeconds(),deck.audio.playbackRate,$('autoBeat').checked);
  const keys=[deck.track?.plan,next.track.plan,next.cue,deck.audio.playbackRate,next.audio.playbackRate,fadeSeconds(),$('autoBeat').checked,$('fadeDuration').value==='auto',next.queueEntry,deck.track,next.track,Number($('transitionEntryWindow').value),Boolean(next.cueLocked),deck.track?.windows,next.track.windows,$('transitionPreference').value];
  if(!deck.pairPlan||!keys.every((key,i)=>key===deck.pairPlan.keys[i]))deck.pairPlan={keys,value:planTransitionPair(keys[0],keys[1],{cue:keys[2],rateA:keys[3],rateB:keys[4],seconds:keys[5],musical:keys[6],adaptive:keys[7],notBefore:deck.audio.currentTime,entryWindow:keys[11],cueLocked:keys[12],tonalA:transitionTonalSegments(keys[13]),tonalB:transitionTonalSegments(keys[14]),preferredStyle:keys[15]})};
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
  if (!deck.audio.paused) {deck.audio.pause(); await stopIfSilent(); return;}
  stopSpotify();await audioReady();
  if (!webMode && !session && $('djLamp').value) {
    if (!connectionReady) throw Error($('djConnection').textContent);
    const result = await api('/api/music/start', {ip:$('djLamp').value, source:'show', settings:design}); session = result.id;
  }
  prepareDeckStart(deck);
  try {await deck.audio.play(); if(!automatic){autoFadePaused=false;if($('autoCrossfade').checked)$('fadeStatus').textContent='Auto-Crossfade aktiv';} notice(`Deck ${deck.name} läuft. Das zweite Deck kann parallel vorbereitet werden.`);}
  catch (error) {await stopIfSilent(); throw error;}
  $('djLamp').disabled = true;
}
async function stopIfSilent() {
  if (decks.some(deck => !deck.audio.paused)) return;
  const old = session; session = null; $('djLamp').disabled = false;
  if (old) {const result = await api('/api/music/stop', {id:old}); if(result.error) throw Error(result.error);}
}
async function stopAll(reason = 'Beide Decks pausiert. Vorheriges Licht wiederhergestellt.') {
  stopSpotify();pauseQueue();cancelFade(true); for (const deck of decks) deck.audio.pause(); await stopIfSilent(); notice(reason);
}
$('djStop').onclick = () => {lightStage.stop();cancelFade(true); return perform(() => stopAll());};
async function unload(deck) {
  if(deck===spotifyDeck)stopSpotify();
  deck.spotify=null;deck.spotifyStarted=false;deck.spotifyEnded=false;deck.panel.querySelector('.spotify-deck-cover')?.remove();deck.panel.querySelector('.spotify-deck-link')?.remove();deck.panel.querySelector('.spotify-deck-brand')?.remove();deck.panel.querySelector('.dj-waveform').hidden=false;
  deck.resumeTime=null;if(deck.resumeButton)deck.resumeButton.hidden=true;
  performanceControls.reset(deck);
  deck.audio.pause(); deck.audio.playbackRate=1; deck.audio.removeAttribute('src'); deck.audio.load();
  if (deck.url) URL.revokeObjectURL(deck.url);
  deck.queueEntry=null;deck.url = null; deck.track = null; deck.transition = null; deck.cue = 0; deck.cueLocked=false;
  deck.panel.querySelector('.dj-track-title').textContent = 'Track laden';
  deck.panel.querySelector('.dj-cue').textContent = 'Cue';
  drawDeck(deck); await stopIfSilent(); renderLibrary();
}
async function ensureFile(track) {
  if(track.deleted) throw Error('Track nicht mehr verfügbar.');
  if(track.missing || track.pendingChange) throw Error('Datei geändert: Deck entladen und Ordner aktualisieren.');
  track.queuePreparationError=null;
  if (track.file) return track.file;
  if (!track.handle) throw Error('Bitte diesen Track über „Erneut verknüpfen“ öffnen.');
  // Called from a deck button/drop, so the browser may ask for read permission.
  if (await track.handle.queryPermission({mode:'read'}) !== 'granted' && await track.handle.requestPermission({mode:'read'}) !== 'granted') throw Error('Lesezugriff wurde nicht freigegeben.');
  const file = await track.handle.getFile();
  if (fileIdentity(file) !== fileIdentity(track)) throw Error('Die Datei wurde verändert. Bitte erneut verknüpfen, damit die Show neu berechnet wird.');
  track.file = file; if(!track.plan)track.state = 'Wartet auf Analyse'; void prepareTracks(); renderLibrary(); return file;
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
  track.basePlan=plan;
  track.plan=applySectionLighting(applyTrackColors(applyShowProfile(plan,showProfile),track.colorMode),track.sectionEdits||[]);
  track.stageMotifs=prepareStageMotifs(track.plan);
  for (const deck of decks) if (deck.track === track) drawDeck(deck);
}
function editSections(track,position=()=>0) {
  if(!track?.basePlan?.arrangement)return;
  openSectionEditor({track,plan:applyTrackColors(applyShowProfile(track.basePlan,showProfile),track.colorMode),position,onSave:async edits=>{
    const old=track.sectionEdits;track.sectionEdits=edits;
    try{await saveTrack(track);}catch(error){track.sectionEdits=old;throw error;}
    replacePlan(track,track.basePlan);renderLibrary();
  }});
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
        const style = webMode?{style:null,message:'Lokale Signalanalyse'}:await analyzeStyle(decoded,{token,signal:lifetime.signal});
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
    else {track = {id:crypto.randomUUID(),name:file.name,size:file.size,lastModified:file.lastModified,order:tracks.length,file,handle:handle||null,state:'Wartet auf Analyse'}; tracks.push(track);}
    await persist(track); added.push(track);
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
    const track = tracks.find(t => t.id === event.dataTransfer.getData('application/x-wiz-track'));
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
    if(compact&&child.getAttribute('aria-label')==='In Warteschlange einreihen'){child.textContent='+ Warteschlange';child.classList.add('dj-enqueue');actions.append(child);}
    else if(compact){child.textContent=child.getAttribute('aria-label')||child.textContent;more.append(child);}
    else actions.append(child);
  }
  if(compact)actions.append(more);
  row.append(actions);
}
const localCovers=createLocalCovers({save:persist,changed:()=>renderLibrary()});
function renderLibrary() {
  spotifyLibrary.refresh();
  tidalLibrary.refresh();
  if(libraryDragging)return;
  const scroll=$('trackList').scrollTop;
  $('trackList').replaceChildren(); $('trackCount').textContent=tracks.length;
  const query=$('trackSearch').value.toLocaleLowerCase();
  if(!tracks.length) {const li=document.createElement('li');li.className='dj-empty';li.textContent='Dateien hierher ziehen';$('trackList').append(li);}
  for(const [index,track] of tracks.entries()) {
    if(!`${track.name} ${track.relativePath||''}`.toLocaleLowerCase().includes(query))continue;
    const li=document.createElement('li');li.draggable=true;li.ondragstart=event=>{libraryDragging=true;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-wiz-track',track.id);};
    li.ondragend=()=>{libraryDragging=false;clearLibraryQueueDrop();renderLibrary();};
    const info=document.createElement('div');info.className='dj-track-info';
    const name=document.createElement('strong');name.textContent=track.name;name.title=track.relativePath||track.name;
    const state=document.createElement('small');paintAnalysis(state,track);
    const label=document.createElement('div');label.className='dj-track-label';label.append(name,state);info.append(label);localCovers.attach(info,track);li.append(info);
    for(const deck of decks) li.append(button(deck.name,()=>loadDeck(deck,track),!deck.audio.paused||track.missing||track.pendingChange,`Auf Deck ${deck.name} laden`));
    const enqueueButton=button('+ Queue',()=>{},track.missing||track.pendingChange,'In Warteschlange einreihen');enqueueButton.onclick=()=>enqueue(track);li.append(enqueueButton);
    if((!track.folderId && (!track.file || track.failed))||track.queuePreparationError) li.append(button('↻',()=>relink(track),false,'Erneut verknüpfen'));
    li.append(button('Abschnitte',()=>editSections(track),!track.basePlan?.arrangement,'Abschnittslicht bearbeiten'));
    li.append(button('Neu berechnen',()=>recalculateShow(track),Boolean(track.phase)||track.missing||track.pendingChange,'Lichtshow neu berechnen'));
    for(const [label,offset] of [['↑',-1],['↓',1]]) li.append(button(label,async()=>{const target=index+offset;[tracks[index],tracks[target]]=[tracks[target],tracks[index]];await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},index+offset<0||index+offset>=tracks.length,label==='↑'?'In Bibliothek nach oben':'In Bibliothek nach unten'));
    if(!folder || track.folderId!==folder.id) li.append(button('×',async()=>{track.deleted=true;tracks=tracks.filter(t=>t!==track);await removeTrack(track.id).catch(()=>{});await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},decks.some(d=>d.track===track),'Track entfernen'));
    groupTrackActions(li,true);$('trackList').append(li);
  }
  if(!$('trackList').children.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Keine Treffer';$('trackList').append(li);}
  $('trackList').scrollTop=scroll;
}
async function recalculateShow(track) {
  if(track.phase||track.deleted)return;
  if(!track.file&&!track.handle){relink(track,true);return;}
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
    track.file=file;track.queuePreparationError=null;track.failed=false;for(const deck of decks)if(deck.track===track&&deck.resumeTime!=null)await restoreDeckFile(deck);if(recalculate){await recalculateShow(track);return;}if(!track.plan)track.state='Wartet auf Analyse';renderLibrary();void prepareTracks();
  });input.click();
}
function frameFor(deck,time=deck.audio.currentTime) {
  if(!deck.track?.plan || deck.audio.paused) return null;
  const transition=deck.transition;
  if(transition && (time<transition.start || time>=transition.start+2)) deck.transition=null;
  return deck.transition?transitionFrame(deck.transition.from,deck.track.plan,time,(time-deck.transition.start)/2):showFrameAt(deck.track.plan,time);
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
    const frame=current[i]||(deck.track?.plan?showFrameAt(deck.track.plan,times[i]):null);
    paintColorPoint(`preview${deck.name}`,frame,`Deck ${deck.name}${deck.audio.paused?' · pausiert':''}`);
  }
  const weights=deckGains(Number($('crossfader').value)).map((w,i)=>w*Number(decks[i].panel.querySelector('.dj-volume').value));
  const active=current.some((frame,i)=>frame&&weights[i]>0);
  const mixedFrame=active?mixDeckFrames(current,weights):null;
  paintColorPoint('previewMix',mixedFrame,'Lichtmix · berechnete Vorschau');
  const lightStreams=decks.map((deck,i)=>{
    const plan=deck.track?.plan,time=times[i];
    const section=plan?.sections?.find(s=>time>=s.start&&time<s.end);
    const motif=deck.track?.stageMotifs?.[plan?.sections?.indexOf(section)];
    const absoluteBeat=beatPosition(plan?.beatGrid?.beats||plan?.beatTiming?.times,time);
    const grid=plan?.beatGrid?.beats||plan?.beatTiming?.times;
    const firstBeat=grid?.findIndex(t=>t>=motif?.start);
    const startBeat=motif?(beatPosition(grid,motif.start)??(firstBeat>=0?firstBeat:null)):null;
    return {motifColor:motif?.color,motionBeat:absoluteBeat!==null&&startBeat!==null?absoluteBeat-startBeat:null,frame:current[i],weight:weights[i],beat:beatPosition(plan?.beatGrid?.beats||plan?.beatTiming?.times,time),look:section?.look,sectionProgress:section?(time-section.start)/Math.max(.001,section.end-section.start):0,
      accentStrength:stageAccentStrength(plan,time),washDimming:stageWashDimming(plan,time),sectionKey:section?`${deck.track.id}:${section.start}`:null,sectionName:section?`${deck.track.name} · ${section.title||section.label||section.lookLabel||'Abschnitt'}`:''};
  });
  fullMode.update(mixedFrame,lightStreams);
  lightStage.update(mixedFrame,decks.some(deck=>!deck.audio.paused),lightStreams);
}
// Sample the preview independently of the slower transport labels, using one
// media-time snapshot per deck for brightness, color and stage movement.
const stopPreviewClock=startShowClock(()=>decks.map((deck,i)=>({key:deck.audio,time:deck.audio.currentTime,rate:deck.audio.playbackRate,
  playing:!deck.audio.paused&&!deck.audio.seeking,weight:deckGains(Number($('crossfader').value))[i]*Number(deck.panel.querySelector('.dj-volume').value),
  beats:deck.track?.plan?.beatTiming?.times})),updateLightPreview,16);
setInterval(()=>{
  $('crossfader').disabled=Boolean(spotifyDeck?.spotifyStarted);
  for(const deck of decks) {
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
    const seek=deck.panel.querySelector('.dj-seek');seek.disabled=!plan||deck.resumeTime!=null;seek.max=plan?.duration||1;seek.value=deck.resumeTime??audio.currentTime;
    deck.panel.querySelector('.dj-play').textContent=audio.paused?'Play':'Pause';
    for(const name of ['play','cue','set-cue']) deck.panel.querySelector(`.dj-${name}`).disabled=!plan||deck.resumeTime!=null;
    deck.panel.querySelector('.dj-unload').disabled=!deck.track || !audio.paused;
  }
},100);
const stopLightClock=startShowClock(()=>decks.map((deck,i)=>({key:deck.audio,time:deck.audio.currentTime,rate:deck.audio.playbackRate,
  playing:Boolean(session)&&!deck.audio.paused&&!deck.audio.seeking,weight:deckGains(Number($('crossfader').value))[i]*Number(deck.panel.querySelector('.dj-volume').value),beats:deck.track?.plan?.beatTiming?.times})),async()=>{
  if(sending || !session || decks.every(d=>d.audio.paused)) return;
  const current=session; sending=true;
  try {
    const gains=deckGains(Number($('crossfader').value)).map((value,i)=>value*Number(decks[i].panel.querySelector('.dj-volume').value));
    const frame=adjustLight(mixDeckFrames(decks.map(deck=>frameFor(deck)),gains));
    await api('/api/music/frame',{id:current,params:frame.state?frame:{state:false}});
  } catch(error) {if(current===session) void perform(()=>stopAll().then(()=>notice(`Lichtverbindung unterbrochen: ${error.message}`,true)));}
  finally {sending=false;}
});
window.addEventListener('pagehide',()=>{
  browserSession.destroy();
  fullMode.destroy();
  performanceControls.destroy();lightStage.destroy();closed=true;queueRunning=false;queueEpoch++;stopLightClock();stopPreviewClock();cancelFade();lifetime.abort();refineController?.abort();for(const worker of workers)worker.terminate();
  for(const deck of decks){deck.audio.pause();if(deck.url)URL.revokeObjectURL(deck.url);}
  const old=session;session=null;if(old)void api('/api/music/stop',{id:old},true).catch(()=>{});
});
(async()=>{
  try {tracks=(await readLibrary()).sort((a,b)=>a.order-b.order);await Promise.all(tracks.map(restoreShow));const savedQueue=await readQueue();queue=Array.isArray(savedQueue)?savedQueue.filter(validQueueEntry).map(entry=>copyQueueEntry(entry)):[];const storedLists=await readQueueLists();
    queueLists=Array.isArray(storedLists?.lists)?storedLists.lists.filter(list=>typeof list?.id==='string'&&typeof list.name==='string'&&Array.isArray(list.entries)).map(list=>({id:list.id,name:list.name.slice(0,80),entries:list.entries.filter(validQueueEntry).map(entry=>copyQueueEntry(entry))})):[];
    queueSourceName=typeof storedLists?.liveName==='string'?storedLists.liveName.slice(0,80):'';selectedQueueList=queueLists.some(list=>list.id===storedLists?.selected)?storedLists.selected:'';queueListsReady=true;
    renderLibrary();renderQueue();folder=await readFolder();renderFolder();await syncFolder();}
  catch {queueListsReady=true;$('libraryStatus').textContent='Trackliste und Listen können nur für diese Sitzung verwendet werden.';renderLibrary();renderQueue();}
  await browserSession.restore(tracks);renderLibrary();
})();

// Begin connecting as soon as the page opens, independently of library restore
// or playback. Keep progress visible even while other DJ messages change.
async function checkDJConnection() {
  if(webMode){$('djLamp').value='';$('djConnection').textContent='';$('djConnection').hidden=true;return;}
  if (closed || session || connectionChecking) return;
  connectionChecking = true;
  const selectionRevision=lampSelectionRevision;
  try {
    const selected = selectedLampIP;
    const ip = selected || connectionIP;
    const result = await api('/api/connection', ip ? {ip} : {});
    if (closed || selectionRevision!==lampSelectionRevision) return;
    const lampOptions=[['Nur Audio',''],...result.devices.map(device=>[device.name,device.ip])];
    connectionIP = result.device?.ip || '';
    if(selected) {
      selectedLampIP=connectionIP||selected;
      try { localStorage.setItem('wiz-selected',selectedLampIP); } catch {}
      if(!lampOptions.some(([,ip])=>ip===selectedLampIP))lampOptions.push(['Letzte Lampe · '+selectedLampIP,selectedLampIP]);
    }
    const lampSelect=$('djLamp');
    // Preserve the native popup during unchanged connection polls.
    if(JSON.stringify([...lampSelect.options].map(o=>[o.text,o.value]))!==JSON.stringify(lampOptions))
      lampSelect.replaceChildren(...lampOptions.map(([name,ip])=>new Option(name,ip)));
    if(lampSelect.value!==selectedLampIP)lampSelect.value=selectedLampIP;
    connectionReady = result.state === 'ready' || result.state === 'music';
    $('djConnection').textContent = result.message;
    $('djConnection').dataset.state = result.state;
  } catch (error) {
    if(selectionRevision!==lampSelectionRevision)return;
    connectionReady = false;
    if (error.status === 404) connectionIP = '';
    $('djConnection').textContent = `Lampenverbindung: ${error.message}. Automatische Prüfung läuft weiter.`;
    $('djConnection').dataset.state = 'offline';
  } finally {
    connectionChecking = false;
    if(selectionRevision!==lampSelectionRevision)void checkDJConnection();
  }
}
$('djLamp').addEventListener('change', () => {
  selectedLampIP=$('djLamp').value;lampSelectionRevision++;
  try {
    localStorage.setItem('wiz-dj-light-enabled',String(Boolean(selectedLampIP)));
    if(selectedLampIP)localStorage.setItem('wiz-selected',selectedLampIP);
  } catch {}
  connectionReady = false; void checkDJConnection();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkDJConnection(); });
window.addEventListener('online', () => { void checkDJConnection(); });
setInterval(() => { if (!document.hidden) void checkDJConnection(); }, 7000);
void checkDJConnection();

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
  autoFadePaused=false;
  const job = fade = {from,to,starting:true,fromQueue,epoch:queueEpoch,plan:musical?(immediate?planTransitionPair(from.track.plan,to.track.plan,{seconds:fadeSeconds(),rateA:from.audio.playbackRate,rateB:to.audio.playbackRate,cue:to.cue,startTime:from.audio.currentTime,adaptive:$('fadeDuration').value==='auto',entryWindow:Number($('transitionEntryWindow').value),cueLocked:Boolean(to.cueLocked),tonalA:transitionTonalSegments(from.track.windows),tonalB:transitionTonalSegments(to.track.windows),preferredStyle:$('transitionPreference').value}):plannedTransition(from)):null};
  $('fadeStatus').textContent = `Deck ${to.name} wird gestartet …`;
  void perform(async () => {
    if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;return;}
    const wasPaused = to.audio.paused;
    try {
      if (wasPaused) {
        to.audio.currentTime = Math.min(musical&&$('autoBeat').checked?(job.plan?.cue??incomingCue(to.track.plan,to.cue)):to.cue, Math.max(0,to.track.plan.duration-.1));
        await toggleDeck(to,true);
      }
      if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;if(wasPaused) to.audio.pause();return;}
      if (to.audio.paused || (from.audio.paused&&!from.audio.ended)) throw Error('Übergang benötigt zwei laufende Decks.');
      // Starting the next decoder may outlast the outgoing track. Its natural
      // end is a valid handover, not a reason to stop or discard a queue item.
      if(fromQueue)consumeQueue(to);
      Object.assign(job,{starting:false,start:from.audio.currentTime,startWall:performance.now(),position:Number($('crossfader').value),
        duration:Math.max(.1,Math.min(job.plan?.duration??fadeSeconds(),(from.track.plan.duration-from.audio.currentTime)/from.audio.playbackRate,(to.track.plan.duration-to.audio.currentTime)/to.audio.playbackRate))});
      job.startAudio=context.currentTime;
      const actual={...job.plan,time:from.audio.currentTime,cue:to.audio.currentTime,duration:job.duration};
      actual.audioProfile=musical&&$('fadeDuration').value==='auto'&&wasPaused?transitionAudioProfile(from.track.windows,to.track.windows,actual,{rateA:from.audio.playbackRate,rateB:to.audio.playbackRate,sameTrack:from.track.id===to.track.id}):null;
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
  for(const track of changes.remove){track.deleted=true;track.revision=(track.revision||0)+1;}
  tracks=tracks.filter(t=>!changes.remove.includes(t));
  for(const {track,entry} of changes.pending){track.missing=!entry;track.pendingChange=Boolean(entry);}
  for(const {track,entry} of changes.unchanged){track.file=entry.file;track.handle=entry.handle;track.missing=false;track.pendingChange=false;}
  for(const {track,entry} of changes.update) {
    Object.assign(track,{queuePreparationError:null,file:entry.file,handle:entry.handle,name:entry.file.name,size:entry.file.size,lastModified:entry.file.lastModified,
      revision:(track.revision||0)+1,sectionEdits:null,plan:null,basePlan:null,windows:null,refined:false,structureState:null,phase:null,analysisWarnings:[],failed:false,missing:false,pendingChange:false,state:''});
  }
  for(const entry of changes.add)tracks.push({id:crypto.randomUUID(),folderId:folder.id,relativePath:entry.path,
    name:entry.file.name,size:entry.file.size,lastModified:entry.file.lastModified,file:entry.file,handle:entry.handle});
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
    const handle=await showDirectoryPicker({id:'wiz-dj-music',mode:'read',startIn:'music'});
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
  if(document.activeElement!==$('queueName'))$('queueName').value=list?.name||'';
  $('queueSaveList').textContent=list?'Liste speichern':'Als Liste speichern';
  $('queueSaveList').disabled=$('queueNew').disabled=!queueListsReady;
  $('queueLive').textContent=list&&queueRunning?`${queueSourceName||'Aktuelle Wiedergabe'} läuft weiter · ${queue.length} Titel verbleiben` : '';
  $('enqueueAll').title=list?'In „'+list.name+'“ einreihen':'In aktuelle Warteschlange einreihen';
}
function createQueueList(entries=[]){
  if(!queueListsReady)return;
  let number=1;while(queueLists.some(list=>list.name==='Liste '+number))number++;
  const list={id:crypto.randomUUID(),name:'Liste '+number,entries:entries.map(e=>copyQueueEntry(e,crypto.randomUUID()))};
  queueLists.push(list);selectedQueueList=list.id;persistLists();renderQueue();document.querySelector('.dj-list-options').open=true;$('queueName').focus();$('queueName').select();
}
$('queueSelect').onchange=()=>{const id=$('queueSelect').value;clearQueueDrag();selectedQueueList=id;persistLists();renderQueue();};
$('queueNew').onclick=()=>createQueueList();
$('queueSaveList').onclick=()=>{if(viewedQueue())persistLists();else createQueueList(queue);};
$('queueName').oninput=()=>{const list=viewedQueue();if(!list)return;list.name=$('queueName').value.trim().slice(0,80)||'Unbenannte Liste';persistLists();renderQueue();};
$('queueDeleteList').onclick=()=>{const list=viewedQueue();if(!list||!confirm('Liste „'+list.name+'“ löschen? Die laufende Wiedergabe bleibt erhalten.'))return;queueLists=queueLists.filter(item=>item!==list);selectedQueueList='';persistLists();renderQueue();};

function persistQueue() {
  const snapshot=queue.map(entry=>copyQueueEntry(entry));
  queueSave=queueSave.then(()=>saveQueue(snapshot)).catch(()=>notice('Warteschlange konnte nicht gespeichert werden.',true));
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
  shuffleEntries.delete(deck.queueEntry);queue=queue.filter(entry=>entry.id!==deck.queueEntry);deck.queueEntry=null;
  persistQueue();renderQueue();
}
$('enqueueAll').onclick=()=>{
  const query=$('trackSearch').value.toLocaleLowerCase();
  for(const track of tracks)if(!track.missing&&!track.pendingChange&&`${track.name} ${track.relativePath||''}`.toLocaleLowerCase().includes(query))displayedQueue().push({id:crypto.randomUUID(),trackId:track.id});
  persistDisplayedQueue();renderQueue();
};
function editQueue(action,listId=selectedQueueList) {
  if(listId!==selectedQueueList)return;
  if(editingLiveQueue()&&fade?.fromQueue)return;
  if(editingLiveQueue())queueEpoch++;action(displayedQueue());persistDisplayedQueue();renderQueue();
}
$('queueClear').onclick=()=>editQueue(entries=>{if(editingLiveQueue())shuffleEnabled=false;entries.splice(0);});
$('queueStart').onclick=async()=>{
  if(queueRunning&&editingLiveQueue()){pauseQueue();return;}
  if(fade||decks.filter(d=>!d.audio.paused).length>1){notice('Zum Start der Warteschlange bitte den Übergang beenden und nur ein Deck laufen lassen.',true);return;}
  try {
    const selected=viewedQueue();if(selected)pauseQueue();
    await audioReady();
    if(selected&&selected!==viewedQueue())return;
    if(viewedQueue()){shuffleEnabled=false;queueSourceName=viewedQueue().name;queue=viewedQueue().entries.map(entry=>copyQueueEntry(entry,crypto.randomUUID()));selectedQueueList='';persistQueue();persistLists();}
    queueDeck=spotifyDeck?.spotifyStarted?spotifyDeck:decks.find(d=>!d.audio.paused)||null;
    if(queueDeck?.spotify&&queueDeck.spotifyPaused)await spotifyLibrary.playback.toggle();
    queueRunning=true;queueEpoch++;queueMessage='';autoFadePaused=false;
    renderQueue();
  }catch(error){notice(error.message,true);}
};
// Copy library titles into the selected list; queue rows retain their move behavior.
const queueDropZone=document.querySelector('.dj-queue');
function clearLibraryQueueDrop(){
  queueDropActive=false;queueDropZone.classList.remove('dragging');
  if(!queueDrag)for(const row of $('queueList').children)row.classList.remove('drop-before','drop-after');
}
function acceptsLibraryDrop(event){return [...(event.dataTransfer?.types||[])].some(type=>['application/x-wiz-track','application/x-anydj-provider-track'].includes(type))&&queueListsReady&&!(editingLiveQueue()&&fade?.fromQueue);}
queueDropZone.addEventListener('dragover',event=>{
  if(!acceptsLibraryDrop(event))return;
  event.preventDefault();event.dataTransfer.dropEffect='copy';queueDropActive=true;queueDropZone.classList.add('dragging');
  for(const item of $('queueList').children)item.classList.remove('drop-before','drop-after');
  const row=event.target.closest('[data-queue-id]');
  if(row){const rect=row.getBoundingClientRect();row.classList.add(event.clientY<rect.top+rect.height/2?'drop-before':'drop-after');}
  const list=$('queueList'),bounds=list.getBoundingClientRect();
  if(event.clientY<bounds.top+32)list.scrollTop-=12;else if(event.clientY>bounds.bottom-32)list.scrollTop+=12;
});
queueDropZone.addEventListener('dragleave',event=>{if(!queueDropZone.contains(event.relatedTarget))clearLibraryQueueDrop();});
queueDropZone.addEventListener('drop',event=>{
  const accepted=acceptsLibraryDrop(event);clearLibraryQueueDrop();
  if(!accepted)return;
  event.preventDefault();event.stopPropagation();
  const provider=event.dataTransfer.getData('application/x-anydj-provider-track');
  if(provider){
    try{
      const entry=spotifyQueueEntry(JSON.parse(provider));
      const row=event.target.closest('[data-queue-id]'),rect=row?.getBoundingClientRect();
      editQueue(entries=>{const index=entries.findIndex(e=>e.id===row?.dataset.queueId);entries.splice(index<0?entries.length:index+(event.clientY>=rect.top+rect.height/2?1:0),0,entry);});
    }catch(error){notice(error.message,true);}return;
  }
  const track=tracks.find(t=>t.id===event.dataTransfer.getData('application/x-wiz-track'));
  if(!track||track.deleted||track.missing||track.pendingChange)return;
  const row=event.target.closest('[data-queue-id]'),id=row?.dataset.queueId,rect=row?.getBoundingClientRect();
  const after=rect&&event.clientY>=rect.top+rect.height/2;
  editQueue(entries=>{const index=entries.findIndex(entry=>entry.id===id);entries.splice(index<0?entries.length:index+(after?1:0),0,{id:crypto.randomUUID(),trackId:track.id});});
});
document.addEventListener('dragend',clearLibraryQueueDrop);
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
    queueDrag=id;if(editingLiveQueue())queueEpoch++;event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('application/x-anydj-queue',id);row.classList.add('queue-dragging');
  });
  row.addEventListener('dragend',clearQueueDrag);
  row.addEventListener('dragover',event=>{
    if(!queueDrag||(editingLiveQueue()&&fade?.fromQueue))return;
    event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
    for(const item of $('queueList').children)item.classList.remove('drop-before','drop-after');
    const rect=row.getBoundingClientRect();
    row.classList.add(event.clientY<rect.top+rect.height/2?'drop-before':'drop-after');
    const list=$('queueList'),bounds=list.getBoundingClientRect();
    if(event.clientY<bounds.top+32)list.scrollTop-=12;
    else if(event.clientY>bounds.bottom-32)list.scrollTop+=12;
  });
  row.addEventListener('drop',event=>{
    if(!queueDrag)return;
    event.preventDefault();event.stopPropagation();
    const source=queueDrag,rect=row.getBoundingClientRect(),after=event.clientY>=rect.top+rect.height/2;
    queueDrag=null;
    editQueue(queue=>{
      const from=queue.findIndex(entry=>entry.id===source);
      if(from<0||source===id||!queue.some(entry=>entry.id===id))return;
      const [entry]=queue.splice(from,1),to=queue.findIndex(entry=>entry.id===id);
      queue.splice(to+(after?1:0),0,entry);
    });
    clearQueueDrag();
  });
}
function renderQueue() {
  if(queueDrag||queueDropActive)return;
  renderQueueManager();
  const editingId=selectedQueueList,queue=displayedQueue(),locked=editingLiveQueue()&&Boolean(fade?.fromQueue);
  $('queueShuffle').disabled=!queueListsReady;
  $('queueShuffle').setAttribute('aria-pressed',String(shuffleEnabled));
  $('queueCount').textContent=queue.length;
  $('queueStart').textContent=editingLiveQueue()?(queueRunning?'Automatik pausieren':'Start'):'Liste starten';
  $('queueStart').disabled=!queueListsReady||(!queue.length&&(!queueRunning||!editingLiveQueue()));
  $('queueClear').disabled=!queue.length||locked;
  $('queueStatus').textContent=editingLiveQueue()?(/^Automatik läuft(?: · Spotify)?$/.test(queueMessage)?'':queueMessage):'Vorbereitung · Änderungen beeinflussen die laufende Warteschlange nicht.';
  const byId=new Map(tracks.map(track=>[track.id,track]));
  const signature=JSON.stringify([selectedQueueList,queue,locked,queue.map(entry=>{const track=byId.get(entry.trackId);return [track?.name,analysisStatus(track,$('djStructure').checked),decks.find(d=>d.queueEntry===entry.id)?.name];})]);
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
    else status.textContent=index===0?'Als Nächstes · bereit':'Bereit';
    info.append(title,status);li.append(info);
    for(const [label,offset] of [['↑',-1],['↓',1]])li.append(button(label,()=>editQueue(entries=>{const current=entries.findIndex(item=>item.id===entry.id),target=current+offset;if(current>=0&&target>=0&&target<entries.length)[entries[current],entries[target]]=[entries[target],entries[current]];},editingId),locked||index+offset<0||index+offset>=queue.length,label==='↑'?'Früher abspielen':'Später abspielen'));
    li.append(button('×',()=>editQueue(entries=>{const i=entries.findIndex(item=>item.id===entry.id);if(i>=0)entries.splice(i,1);},editingId),locked,'Aus Warteschlange entfernen'));
    title.title=track?.name||'Track fehlt';bindQueueDrag(li,entry.id);groupTrackActions(li);$('queueList').append(li);
  }
  if(!queue.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Titel aus der Bibliothek mit „+ Warteschlange“ hinzufügen';$('queueList').append(li);}
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
  try{localStorage.setItem('wiz-dj-show-profile',showProfile);}catch{}
  for(const track of tracks)if(track.basePlan)replacePlan(track,track.basePlan);
};

if(webMode){
  $('demoTracks').onclick=()=>perform(async()=>{
    const button=$('demoTracks');button.disabled=true;
    try{const {createDemoFiles}=await import('./web-demo.js');await addFiles(createDemoFiles().map(file=>({file})));}
    finally{button.disabled=false;}
  });
}

const djTutorial=createDJTutorial();
window.addEventListener('pagehide',()=>djTutorial.destroy(),{once:true});
