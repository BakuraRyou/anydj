import {applyShowProfile,SHOW_PROFILES} from './dj-show-profile.js';
import {analysisStatus} from './dj-status.js';
import {startShowClock} from './show-clock.js';
import { analyzeBeats } from './beat-analysis.js';
import { analyzeStyle } from './style-analysis.js';
import { analyzeStructure } from './structure-analysis.js';
import { showFrameAt, transitionFrame } from './show-plan.js';
import { deckGains, mixDeckFrames, fileIdentity, formatTime, crossfadePosition, automaticFadeSource } from './dj-model.js';
import { readLibrary, saveTrack, removeTrack, readFolder, saveFolder, saveFolderChanges, readQueue, saveQueue } from './dj-library.js';

import {scanFolder, folderChanges, audioFile} from './dj-folder.js';

const $ = id => document.getElementById(id);
let showProfile='auto';
try{const saved=localStorage.getItem('wiz-dj-show-profile');if(SHOW_PROFILES.includes(saved))showProfile=saved;}catch{}
$('djShowProfile').value=showProfile;
const design = {arrangement:'auto', mood:'auto', minimum:5, maximum:75};
let token = ''; try { token = sessionStorage.getItem('wiz-web-token') || ''; } catch {}
let tracks = [], context, session = null, sending = false, closed = false;
let folder = null, folderBusy = false;
let preparing = false, refining = false, refineController;
const lifetime = new AbortController(), workers = new Set();
let fade = null;
let queue=[],queueRunning=false,queueBusy=false,queueEpoch=0,queueDeck=null,queueMessage='';
let queueSave=Promise.resolve(),queueSignature='';
let actions = Promise.resolve();
const perform = action => { actions = actions.then(action).catch(error => notice(error.message, true)); return actions; };
function notice(text, error = false) { $('djStatus').hidden = !error; $('djStatus').textContent = error ? text : '';  $('djStatus').className = `notice${error?' warning':''}`; }
async function api(path, body, keepalive = false) {
  const response = await fetch(path, {method:body === undefined?'GET':'POST', headers:{'Content-Type':'application/json','X-WiZ-Local':'1',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body === undefined?{}:{body:JSON.stringify(body)}), keepalive, signal:AbortSignal.timeout(30000)});
  const result = await response.json(); if (!response.ok) throw Error(result.error?.message || `HTTP ${response.status}`); return result;
}
async function persist(track) {
  try { await saveTrack(track); }
  catch { $('libraryStatus').textContent = 'Speichern ist in diesem Browser nicht verfügbar. Die Trackliste bleibt nur bis zum Neuladen erhalten.'; }
}
function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/show-worker.js', {type:'module'}); workers.add(worker);
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
  const audio = new Audio(); audio.preload = 'metadata'; audio.hidden = true; panel.append(audio);
  const deck = {name, index, panel, audio, track:null, cue:0, gain:null, url:null, transition:null};
  panel.querySelector('.dj-play').onclick = () => perform(() => toggleDeck(deck));
  panel.querySelector('.dj-cue').onclick = () => { pauseQueue();cancelFade(); return perform(async () => {audio.pause(); audio.currentTime = deck.cue; deck.transition = null; await stopIfSilent();}); };
  panel.querySelector('.dj-set-cue').onclick = () => {deck.cue = audio.currentTime; panel.querySelector('.dj-cue').textContent = `Cue ${formatTime(deck.cue)}`;};
  panel.querySelector('.dj-unload').onclick = () => {pauseQueue();return perform(async () => {await unload(deck); await syncFolder();});};
  panel.querySelector('.dj-seek').oninput = event => {pauseQueue();cancelFade();if(Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Number(event.target.value)); deck.transition = null;};
  panel.querySelector('.dj-volume').oninput = updateGains;
  audio.onended = () => perform(stopIfSilent);
  audio.onpause = () => { if(queueRunning&&deck===queueDeck&&!audio.ended)pauseQueue();if (fade && (fade.to===deck || (fade.from===deck && !audio.ended))) cancelFade(); if (!closed) void perform(stopIfSilent); };
  audio.onerror = () => perform(async () => {pauseQueue('Datei kann nicht abgespielt werden.');audio.pause(); await stopIfSilent(); notice(`Deck ${name}: Datei kann nicht abgespielt werden. Bitte erneut verknüpfen.`, true);});
  bindDrop(panel, async (files, track) => {const imported = track?[track]:await addFiles(files); if(imported[0]) await loadDeck(deck, imported[0]);});
  return deck;
});
async function audioReady() {
  if (!context) {
    context = new AudioContext();
    for (const deck of decks) {deck.gain = context.createGain(); context.createMediaElementSource(deck.audio).connect(deck.gain); deck.gain.connect(context.destination);}
  }
  await context.resume(); updateGains();
}
function updateGains() {
  const gains = deckGains(Number($('crossfader').value));
  $('mixValue').textContent = `A ${Math.round(gains[0]*100)} % · B ${Math.round(gains[1]*100)} %`;
  for (const deck of decks) if (deck.gain) deck.gain.gain.setTargetAtTime(gains[deck.index]*Number(deck.panel.querySelector('.dj-volume').value), context.currentTime, .015);
}
$('crossfader').oninput = () => {pauseQueue();cancelFade(true); updateGains();};
async function toggleDeck(deck, automatic = false) {
  if (!automatic) {pauseQueue();cancelFade();}
  if (!deck.track?.plan) return;
  if (!deck.audio.paused) {deck.audio.pause(); await stopIfSilent(); return;}
  await audioReady();
  if (!session && $('djLamp').value) {
    const result = await api('/api/music/start', {ip:$('djLamp').value, source:'show', settings:design}); session = result.id;
  }
  try {await deck.audio.play(); notice(`Deck ${deck.name} läuft. Das zweite Deck kann parallel vorbereitet werden.`);}
  catch (error) {await stopIfSilent(); throw error;}
  $('djLamp').disabled = true;
}
async function stopIfSilent() {
  if (decks.some(deck => !deck.audio.paused)) return;
  const old = session; session = null; $('djLamp').disabled = false;
  if (old) {const result = await api('/api/music/stop', {id:old}); if(result.error) throw Error(result.error);}
}
async function stopAll(reason = 'Beide Decks pausiert. Vorheriges Licht wiederhergestellt.') {
  pauseQueue();cancelFade(true); for (const deck of decks) deck.audio.pause(); await stopIfSilent(); notice(reason);
}
$('djStop').onclick = () => {cancelFade(true); return perform(() => stopAll());};
async function unload(deck) {
  deck.audio.pause(); deck.audio.removeAttribute('src'); deck.audio.load();
  if (deck.url) URL.revokeObjectURL(deck.url);
  deck.queueEntry=null;deck.url = null; deck.track = null; deck.transition = null; deck.cue = 0;
  deck.panel.querySelector('.dj-track-title').textContent = 'Track laden';
  deck.panel.querySelector('.dj-cue').textContent = 'Cue';
  drawDeck(deck); await stopIfSilent(); renderLibrary();
}
async function ensureFile(track) {
  if(track.deleted) throw Error('Track nicht mehr verfügbar.');
  if(track.missing || track.pendingChange) throw Error('Datei geändert: Deck entladen und Ordner aktualisieren.');
  if (track.file) return track.file;
  if (!track.handle) throw Error('Bitte diesen Track über „Erneut verknüpfen“ öffnen.');
  // Called from a deck button/drop, so the browser may ask for read permission.
  if (await track.handle.queryPermission({mode:'read'}) !== 'granted' && await track.handle.requestPermission({mode:'read'}) !== 'granted') throw Error('Lesezugriff wurde nicht freigegeben.');
  const file = await track.handle.getFile();
  if (fileIdentity(file) !== fileIdentity(track)) throw Error('Die Datei wurde verändert. Bitte erneut verknüpfen, damit die Show neu berechnet wird.');
  track.file = file; track.state = 'Wartet auf Analyse'; void prepareTracks(); renderLibrary(); return file;
}
async function loadDeck(deck, track, fromQueue=false) {
  if(!fromQueue)pauseQueue();
  if (!deck.audio.paused) throw Error(`Deck ${deck.name} bitte vor dem Laden pausieren.`);
  const file = await ensureFile(track); await unload(deck);
  deck.autoUsed = false; deck.track = track; deck.url = URL.createObjectURL(file); deck.audio.src = deck.url;
  deck.panel.querySelector('.dj-track-title').textContent = track.name;
  deck.panel.querySelector('.dj-track-title').title = track.name;
  drawDeck(deck); renderLibrary();
  void prepareTracks();
}
function drawDeck(deck) {
  const canvas = deck.panel.querySelector('canvas'), ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
  const plan = deck.track?.plan; if (!plan) return;
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
  track.plan=applyShowProfile(plan,showProfile);
  for (const deck of decks) if (deck.track === track) drawDeck(deck);
}
function nextTrack(predicate) {
  return decks.map(deck => deck.track).find(track => track && predicate(track)) || tracks.find(predicate);
}
async function prepareTracks() {
  if (preparing || closed) return; preparing = true;
  try {
    let track;
    while ((track = nextTrack(t => t.file && !t.plan && !t.failed && !t.deleted && (!t.folderId || decks.some(d=>d.track===t)))) && !closed) {
      const revision=track.revision||0;
      try {
        track.phase='Audio wird gelesen …';track.analysisWarnings=[];renderLibrary();
        const decoded = await new OfflineAudioContext(2,1,16000).decodeAudioData(await track.file.arrayBuffer());
        if(decoded.duration<.1 || decoded.duration>900) throw Error('Unterstützt werden Tracks bis 15 Minuten.');
        track.phase='Takt wird erkannt …';renderLibrary();
        const beat = await analyzeBeats(decoded,{token, signal:lifetime.signal});
        if(track.deleted || (track.revision||0)!==revision)continue;
        track.phase='Stilverlauf wird erkannt …';renderLibrary();
        const style = await analyzeStyle(decoded,{token,signal:lifetime.signal});
        if(track.deleted || (track.revision||0)!==revision)continue;
        track.styleMessage=style.message;
        track.analysisWarnings=[...(!beat.grid?[beat.message]:[]),...(!style.style?[style.message]:[])];
        track.phase='Lichtshow wird berechnet …';renderLibrary();
        const channels = Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i).slice());
        const result = await runWorker({channels, rate:16000, options:design, beatGrid:beat.grid,musicStyle:style.style});
        if(track.deleted || (track.revision||0)!==revision) continue;
        track.phase=null;track.structureState='pending';
        track.windows = result.windows; replacePlan(track,result.plan);
        track.state = `Spielbereit · ${beat.message}`;
        renderLibrary(); void refineTracks();
      } catch(error) {if(track.deleted || (track.revision||0)!==revision) continue; track.failed = true; track.state = error.message; renderLibrary();}
    }
  } finally {preparing = false;}
}
async function refineTracks() {
  if(refining || closed || !$('djStructure').checked) return; refining = true;
  try {
    let track;
    while($('djStructure').checked && !closed && (track = nextTrack(t => t.plan && t.windows && !t.refined && !t.deleted))) {
      const revision=track.revision||0;
      refineController = new AbortController(); track.refined = true;track.structureState='running';
      track.state = 'Spielbereit · Songaufbau wird im Hintergrund analysiert …'; renderLibrary();
      try {
        const result = await analyzeStructure(await track.file.arrayBuffer(),track.plan.duration,{token, signal:lifetime.signal, cancelSignal:refineController.signal});
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
      renderLibrary();
    }
  } finally {refining = false; refineController = null;}
}
$('djStructure').onchange = () => {if(!$('djStructure').checked) refineController?.abort(); else void refineTracks();renderLibrary();};
async function addFiles(entries) {
  const added = [];
  for(const {file,handle} of entries) {
    if(!file || (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name))) {notice('Bitte unterstützte Audiodateien auswählen.',true); continue;}
    if(file.size>50*1024*1024) {notice(`${file.name}: maximal 50 MB pro Track.`,true); continue;}
    let track = tracks.find(t => !t.folderId && fileIdentity(t) === fileIdentity(file));
    if(track) {track.file = file; track.handle = handle || track.handle; if(track.failed) {track.failed=false; track.state='Wartet auf Analyse';}}
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
function groupTrackActions(row) {
  const actions=document.createElement('div');actions.className='dj-track-actions';
  for(const child of [...row.children])if(child.tagName==='BUTTON')actions.append(child);
  row.append(actions);
}
function renderLibrary() {
  const scroll=$('trackList').scrollTop;
  $('trackList').replaceChildren(); $('trackCount').textContent=tracks.length;
  const query=$('trackSearch').value.toLocaleLowerCase();
  if(!tracks.length) {const li=document.createElement('li');li.className='dj-empty';li.textContent='Dateien hierher ziehen';$('trackList').append(li);}
  for(const [index,track] of tracks.entries()) {
    if(!`${track.name} ${track.relativePath||''}`.toLocaleLowerCase().includes(query))continue;
    const li=document.createElement('li');li.draggable=true;li.ondragstart=event=>event.dataTransfer.setData('application/x-wiz-track',track.id);
    const info=document.createElement('div');info.className='dj-track-info';
    const name=document.createElement('strong');name.textContent=track.name;name.title=track.relativePath||track.name;
    const state=document.createElement('small');paintAnalysis(state,track);
    info.append(name,state);li.append(info);
    for(const deck of decks) li.append(button(deck.name,()=>loadDeck(deck,track),!deck.audio.paused||track.missing||track.pendingChange,`Auf Deck ${deck.name} laden`));
    li.append(button('+ Queue',()=>enqueue(track),track.missing||track.pendingChange,'In Warteschlange einreihen'));
    if(!track.folderId && (!track.file || track.failed)) li.append(button('↻',()=>relink(track),false,'Erneut verknüpfen'));
    for(const [label,offset] of [['↑',-1],['↓',1]]) li.append(button(label,async()=>{const target=index+offset;[tracks[index],tracks[target]]=[tracks[target],tracks[index]];await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},index+offset<0||index+offset>=tracks.length));
    if(!folder || track.folderId!==folder.id) li.append(button('×',async()=>{track.deleted=true;tracks=tracks.filter(t=>t!==track);await removeTrack(track.id).catch(()=>{});await Promise.all(tracks.map((t,i)=>{t.order=i;return persist(t);}));renderLibrary();},decks.some(d=>d.track===track),'Track entfernen'));
    groupTrackActions(li);$('trackList').append(li);
  }
  if(!$('trackList').children.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Keine Treffer';$('trackList').append(li);}
  $('trackList').scrollTop=scroll;
}
function relink(track) {
  const input=document.createElement('input');input.type='file';input.accept='audio/*';
  input.onchange=()=>perform(async()=>{
    const file=input.files[0];if(!file)return;
    if(fileIdentity(file)!==fileIdentity(track)) throw Error('Bitte dieselbe Datei auswählen. Geänderte Tracks über „+ Dateien“ hinzufügen.');
    track.file=file;track.failed=false;track.state='Wartet auf Analyse';renderLibrary();void prepareTracks();
  });input.click();
}
function frameFor(deck) {
  if(!deck.track?.plan || deck.audio.paused) return null;
  const time=deck.audio.currentTime, transition=deck.transition;
  if(transition && (time<transition.start || time>=transition.start+2)) deck.transition=null;
  return deck.transition?transitionFrame(deck.transition.from,deck.track.plan,time,(time-deck.transition.start)/2):showFrameAt(deck.track.plan,time);
}
setInterval(()=>{
  for(const deck of decks) {
    const plan=deck.track?.plan, audio=deck.audio;
    const passage=plan?.sections.find(section=>audio.currentTime>=section.start&&audio.currentTime<section.end);
    deck.panel.querySelector('.dj-look').textContent=passage?.lookLabel||'';
    paintAnalysis(deck.panel.querySelector('.dj-analysis'),deck.track);
    deck.panel.querySelector('.dj-clock').textContent=`${formatTime(audio.currentTime)} / ${formatTime(plan?.duration)}`;
    const seek=deck.panel.querySelector('.dj-seek');seek.disabled=!plan;seek.max=plan?.duration||1;seek.value=audio.currentTime;
    deck.panel.querySelector('.dj-play').textContent=audio.paused?'Play':'Pause';
    for(const name of ['play','cue','set-cue']) deck.panel.querySelector(`.dj-${name}`).disabled=!plan;
    deck.panel.querySelector('.dj-unload').disabled=!deck.track || !audio.paused;
  }
},100);
const stopLightClock=startShowClock(()=>decks.map((deck,i)=>({key:deck.audio,time:deck.audio.currentTime,rate:deck.audio.playbackRate,
  playing:Boolean(session)&&!deck.audio.paused&&!deck.audio.seeking,weight:deckGains(Number($('crossfader').value))[i]*Number(deck.panel.querySelector('.dj-volume').value),beats:deck.track?.plan?.beatTiming?.times})),async()=>{
  if(sending || !session || decks.every(d=>d.audio.paused)) return;
  const current=session; sending=true;
  try {
    const gains=deckGains(Number($('crossfader').value)).map((value,i)=>value*Number(decks[i].panel.querySelector('.dj-volume').value));
    await api('/api/music/frame',{id:current,params:mixDeckFrames(decks.map(frameFor),gains)});
  } catch(error) {if(current===session) void perform(()=>stopAll().then(()=>notice(`Lichtverbindung unterbrochen: ${error.message}`,true)));}
  finally {sending=false;}
});
window.addEventListener('pagehide',()=>{
  closed=true;queueRunning=false;queueEpoch++;stopLightClock();cancelFade();lifetime.abort();refineController?.abort();for(const worker of workers)worker.terminate();
  for(const deck of decks){deck.audio.pause();if(deck.url)URL.revokeObjectURL(deck.url);}
  const old=session;session=null;if(old)void api('/api/music/stop',{id:old},true).catch(()=>{});
});
(async()=>{
  try {tracks=(await readLibrary()).sort((a,b)=>a.order-b.order);const savedQueue=await readQueue();queue=Array.isArray(savedQueue)?savedQueue.filter(entry=>typeof entry?.id==='string'&&typeof entry.trackId==='string'):[];renderLibrary();renderQueue();folder=await readFolder();renderFolder();await syncFolder();}
  catch {$('libraryStatus').textContent='Trackliste kann nur für diese Sitzung verwendet werden.';renderLibrary();}
  try {
    const result=await api('/api/devices');for(const device of result.devices)$('djLamp').add(new Option(device.name,device.ip));
    notice('Bereit. Musik verknüpfen und auf ein Deck laden. Für Licht eine Lampe auswählen.');
  } catch(error) {notice(`Audio ist verfügbar. Lampen konnten nicht geladen werden: ${error.message}`,true);}
})();

function cancelFade(disarm = Boolean(fade)) {
  if (disarm) $('autoCrossfade').checked = false;
  if (fade) {
    fade = null;
    $('fadeStatus').textContent = 'Übergang abgebrochen';
  }
}
function fadeSource() {
  const preferred = Number($('crossfader').value) < .5 ? 0 : 1;
  return !decks[preferred].audio.paused ? preferred : !decks[1-preferred].audio.paused ? 1-preferred : -1;
}
function requestFade(index, fromQueue=false) {
  if(!fromQueue)pauseQueue();
  if (fade || index < 0) return;
  const from = decks[index], to = decks[1-index];
  if (!from.track?.plan || !to.track?.plan || from.audio.paused) return;
  const job = fade = {from,to,starting:true,fromQueue,epoch:queueEpoch};
  $('fadeStatus').textContent = `Deck ${to.name} wird gestartet …`;
  void perform(async () => {
    if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;return;}
    const wasPaused = to.audio.paused;
    try {
      if (wasPaused) {
        to.audio.currentTime = Math.min(to.cue, Math.max(0,to.track.plan.duration-.1));
        await toggleDeck(to,true);
      }
      if (fade !== job || (fromQueue&&(!queueRunning||job.epoch!==queueEpoch))) {if(fade===job)fade=null;if(wasPaused) to.audio.pause();return;}
      if(fromQueue)consumeQueue(to);
      if (from.audio.paused || to.audio.paused) throw Error('Übergang benötigt zwei laufende Decks.');
      Object.assign(job,{starting:false,start:from.audio.currentTime,position:Number($('crossfader').value),
        duration:Math.max(.1,Math.min(Number($('fadeDuration').value),from.track.plan.duration-from.audio.currentTime,to.track.plan.duration-to.audio.currentTime))});
      $('fadeStatus').textContent = `Deck ${from.name} → Deck ${to.name} · ${job.duration.toFixed(1)} Sekunden`;
    } catch(error) {if(fromQueue)pauseQueue(error.message);cancelFade(true); if(wasPaused)to.audio.pause(); throw error;}
  });
}
$('fadeNow').onclick = () => requestFade(fadeSource());
$('fadeCancel').onclick = () => {pauseQueue();cancelFade(true);};
$('autoCrossfade').onchange = () => {pauseQueue();
  if (!$('autoCrossfade').checked) cancelFade(false);
  $('fadeStatus').textContent = $('autoCrossfade').checked
    ? 'Auto-Crossfade aktiv'
    : '';
};
setInterval(() => {
  if (closed) return;
  const source = fadeSource();
  $('fadeNow').disabled = Boolean(fade) || source < 0 || !decks[1-source]?.track?.plan;
  $('fadeCancel').hidden = !fade;
  $('fadeDuration').disabled = Boolean(fade);
  if (fade && !fade.starting) {
    const job = fade;
    if (job.to.audio.paused || (job.from.audio.paused && !job.from.audio.ended)) {cancelFade(true); return;}
    const elapsed = job.from.audio.ended ? job.duration : job.from.audio.currentTime-job.start;
    $('crossfader').value = crossfadePosition(job.position,job.to.index,elapsed,job.duration);
    updateGains();
    if (elapsed >= job.duration) {
      fade = null; job.from.autoUsed = true; job.from.audio.pause();
      if(job.fromQueue)queueDeck=job.to;
      $('fadeStatus').textContent = `Deck ${job.to.name} läuft`;
      renderLibrary();
    }
  } else if (!fade && !queueRunning && $('autoCrossfade').checked) {
    const index = automaticFadeSource(decks.map(deck => ({ready:Boolean(deck.track?.plan),paused:deck.audio.paused,
      remaining:(deck.track?.plan?.duration||0)-deck.audio.currentTime,used:Boolean(deck.autoUsed)})),Number($('crossfader').value),Number($('fadeDuration').value));
    if (index >= 0) requestFade(index);
  }
},25);

function paintAnalysis(element,track) {
  const status=analysisStatus(track,$('djStructure').checked);
  if(element.textContent!==status.text)element.textContent=status.text;
  element.dataset.analysis=status.kind;
  element.title=status.detail||status.text;
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
    Object.assign(track,{file:entry.file,handle:entry.handle,name:entry.file.name,size:entry.file.size,lastModified:entry.file.lastModified,
      revision:(track.revision||0)+1,plan:null,basePlan:null,windows:null,refined:false,structureState:null,phase:null,analysisWarnings:[],failed:false,missing:false,pendingChange:false,state:''});
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

function persistQueue() {
  const snapshot=queue.map(({id,trackId})=>({id,trackId}));
  queueSave=queueSave.then(()=>saveQueue(snapshot)).catch(()=>notice('Warteschlange konnte nicht gespeichert werden.',true));
}
function enqueue(track) {
  queue.push({id:crypto.randomUUID(),trackId:track.id});persistQueue();renderQueue();
}
function pauseQueue(message='Automatik pausiert') {
  if(!queueRunning&&!message)return;
  if(queueRunning){queueRunning=false;queueEpoch++;queueMessage=message;renderQueue();}
}
function consumeQueue(deck) {
  if(!deck.queueEntry)return;
  queue=queue.filter(entry=>entry.id!==deck.queueEntry);deck.queueEntry=null;
  persistQueue();renderQueue();
}
$('enqueueAll').onclick=()=>{
  const query=$('trackSearch').value.toLocaleLowerCase();
  for(const track of tracks)if(!track.missing&&!track.pendingChange&&`${track.name} ${track.relativePath||''}`.toLocaleLowerCase().includes(query))queue.push({id:crypto.randomUUID(),trackId:track.id});
  persistQueue();renderQueue();
};
function editQueue(action) {
  if(fade?.fromQueue)return;
  queueEpoch++;action();persistQueue();renderQueue();
}
$('queueClear').onclick=()=>editQueue(()=>{queue=[];});
$('queueStart').onclick=async()=>{
  if(queueRunning){pauseQueue();return;}
  if(fade||decks.filter(d=>!d.audio.paused).length>1){notice('Zum Start der Warteschlange bitte den Übergang beenden und nur ein Deck laufen lassen.',true);return;}
  try {
    await audioReady();
    queueDeck=decks.find(d=>!d.audio.paused)||null;
    queueRunning=true;queueEpoch++;queueMessage='';$('autoCrossfade').checked=false;
    renderQueue();
  }catch(error){notice(error.message,true);}
};
function renderQueue() {
  $('queueCount').textContent=queue.length;
  $('queueStart').textContent=queueRunning?'Automatik pausieren':'Start';
  $('queueStart').disabled=!queueRunning&&!queue.length;
  $('queueClear').disabled=!queue.length||Boolean(fade?.fromQueue);
  $('queueStatus').textContent=queueMessage;
  const byId=new Map(tracks.map(track=>[track.id,track]));
  const signature=JSON.stringify([queue,Boolean(fade?.fromQueue),queue.map(entry=>{const track=byId.get(entry.trackId);return [track?.name,analysisStatus(track,$('djStructure').checked),decks.find(d=>d.queueEntry===entry.id)?.name];})]);
  if(signature===queueSignature)return;queueSignature=signature;
  const scroll=$('queueList').scrollTop;$('queueList').replaceChildren();
  for(const [index,entry] of queue.entries()) {
    const track=byId.get(entry.trackId),deck=decks.find(d=>d.queueEntry===entry.id);
    const li=document.createElement('li'),info=document.createElement('div');info.className='dj-track-info';
    const title=document.createElement('strong');title.textContent=`${index+1}. ${track?.name||'Track fehlt'}`;
    const status=document.createElement('small');
    if(!track){status.textContent='Datei erneut hinzufügen oder Eintrag entfernen';status.dataset.analysis='warning';}
    else if(deck){paintAnalysis(status,track);status.textContent=`Deck ${deck.name} · ${status.textContent}`;}
    else status.textContent=index===0?'Als Nächstes':'';
    info.append(title,status);li.append(info);
    for(const [label,offset] of [['↑',-1],['↓',1]])li.append(button(label,()=>editQueue(()=>{[queue[index],queue[index+offset]]=[queue[index+offset],queue[index]];}),Boolean(fade?.fromQueue)||index+offset<0||index+offset>=queue.length,label==='↑'?'Früher abspielen':'Später abspielen'));
    li.append(button('×',()=>editQueue(()=>{queue=queue.filter(item=>item.id!==entry.id);}),Boolean(fade?.fromQueue),'Aus Warteschlange entfernen'));
    title.title=track?.name||'Track fehlt';groupTrackActions(li);$('queueList').append(li);
  }
  if(!queue.length){const li=document.createElement('li');li.className='dj-empty';li.textContent='Tracks mit „+ Queue“ einreihen';$('queueList').append(li);}
  $('queueList').scrollTop=scroll;
}
async function advanceQueue() {
  if(!queueRunning||queueBusy||closed||fade)return;
  queueBusy=true;const epoch=queueEpoch;
  try {
    await perform(async()=>{
      try {
      if(!queueRunning||epoch!==queueEpoch||fade)return;
      const playing=queueDeck&&!queueDeck.audio.paused;
      const target=playing?decks[1-queueDeck.index]:decks.find(d=>d.queueEntry===queue[0]?.id)||queueDeck||decks[0];
      const entry=queue[0];
      if(!entry){
        queueMessage=playing?'Letzter Track läuft':'Warteschlange beendet';
        if(!playing){queueRunning=false;queueEpoch++;}
        return;
      }
      const track=tracks.find(t=>t.id===entry.trackId);
      if(!track)throw Error('Track fehlt. Eintrag entfernen oder Datei erneut hinzufügen.');
      if(track.failed)throw Error(`${track.name}: Analyse fehlgeschlagen.`);
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
        if(track.plan&&queueDeck.track.plan.duration-queueDeck.audio.currentTime<=Number($('fadeDuration').value))requestFade(queueDeck.index,true);
      }
      }catch(error){pauseQueue(error.message);notice(error.message,true);}
    });
  }catch(error){pauseQueue(error.message);notice(error.message,true);}
  finally{queueBusy=false;renderQueue();}
}
setInterval(()=>{void advanceQueue();if(!closed)renderQueue();},200);

$('djShowProfile').onchange=()=>{
  showProfile=$('djShowProfile').value;
  try{localStorage.setItem('wiz-dj-show-profile',showProfile);}catch{}
  for(const track of tracks)if(track.basePlan)replacePlan(track,track.basePlan);
};
