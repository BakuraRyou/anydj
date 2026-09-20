'use strict';
const $ = id => document.getElementById(id);
const player = $('musicPlayer');
let token = ''; try { token = sessionStorage.getItem('wiz-web-token') || ''; } catch {}
let id = null, source = null, busy = false, generation = 0, frameTimer, statusTimer, sending = false, checking = false;
let context, analyser, fileNode, captureNode, silentGain, stream, objectURL;
let latestLevel = { rms: 0, bass: 0, energy: 0, bassEnergy: 0, beatSeq: 0 };
let displayedBeat = 0;
let canSystem = false, ready = false;
let startingShow = false;
let chosenFile, showPlan, showWindows, planning = false, analysisJob = 0, analysisWorker;
const plannedMode = () => $('mp3Mode').value === 'show';
let beatAbort, structureAbort, structureRunning=false, showStructure=null, showTransition=null;
let showModule, stopShowClock;
const showTools = () => showModule ??= import('/show-plan.js');
const optionFields = { mood: 'musicMood', mode: 'musicMode', intensity: 'musicIntensity', minimum: 'musicMinimum', maximum: 'musicMaximum', smoothing: 'musicSmoothing', speed: 'musicSpeed', saturation: 'musicSaturation', palette: 'musicPalette', dynamics: 'musicDynamics', colorA: 'musicColorA', colorB: 'musicColorB', toneFollow: 'musicToneFollow' };
const numberFields = new Set(['intensity', 'minimum', 'maximum', 'smoothing', 'speed', 'saturation', 'toneFollow']);
const options = () => ({...Object.fromEntries(Object.entries(optionFields).map(([key, field]) => [key, numberFields.has(key) ? Number($(field).value) : $(field).value])), arrangement: $('manualTuning').checked ? 'manual' : 'auto', ...(!$('manualTuning').checked ? {mood:'auto'} : {})});
let liveDesign = null;
function applyDesign(values) { for(const [key,field] of Object.entries(optionFields)) if(values[key]!==undefined) $(field).value=values[key]; }
function automaticStatus() {
  const design=plannedMode()?showPlan?.automatic:liveDesign;
  $('automaticStatus').textContent=$('manualTuning').checked?'Manuelle Feinabstimmung für dieses Lied aktiv.':design?`${design.label} · ${design.description}`:'Automatik bereit · Die Gestaltung wird aus der Musik gewählt.';
}
const preferenceKey = 'wiz-music-preferences-v1';
function savePreferences() {
  try { localStorage.setItem(preferenceKey, JSON.stringify({ version: 2, options: options(), mp3Mode: preferredMp3Mode, beatEngine: $('beatEngine').value, offset: Number($('showOffset').value), volume: player.volume, muted: player.muted })); } catch {}
}
function restorePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (!saved || ![1,2].includes(saved.version)) return;
    for (const [key, field] of Object.entries(optionFields)) {
      const node = $(field), value = saved.options?.[key];
      if (numberFields.has(key)) {
        if (Number.isFinite(value) && value >= Number(node.min) && value <= Number(node.max)) node.value = value;
      } else if (node.type === 'color') { if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) node.value = value; }
      else if ([...node.options].some(o => o.value === value)) node.value = value;
    }
    if (Number($('musicMinimum').value) > Number($('musicMaximum').value)) $('musicMinimum').value = $('musicMaximum').value;
    if (['builtin', 'beat-this'].includes(saved.beatEngine)) $('beatEngine').value = saved.beatEngine;
    if (saved.version === 2 && ['live', 'show'].includes(saved.mp3Mode)) $('mp3Mode').value = saved.mp3Mode;
    if (Number.isFinite(saved.offset) && Math.abs(saved.offset) <= 500) $('showOffset').value = saved.offset;
    if (Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) player.volume = saved.volume;
    if (typeof saved.muted === 'boolean') player.muted = saved.muted;
  } catch {}
}
restorePreferences();
let preferredMp3Mode = $('mp3Mode').value;
player.addEventListener('volumechange', savePreferences);
$('showOffset').addEventListener('input', () => { optionLabels(); savePreferences(); });
function message(text, error = false) { $('musicStatus').textContent = text; $('musicStatus').className = `notice${error ? ' warning' : ''}`; }
async function api(path, data, keepalive = false) {
  const headers = { 'Content-Type': 'application/json', 'X-WiZ-Local': '1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }), keepalive, signal: AbortSignal.timeout(path === '/api/connection' ? 30000 : 12000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
  return result;
}
function controls() {
  $('musicLamp').disabled = !$('musicLamp').options.length || connectionChecking || busy || Boolean(id);
  $('systemStart').disabled = !ready || !canSystem || busy || Boolean(id);
  $('tabStart').disabled = !ready || !navigator.mediaDevices?.getDisplayMedia || busy || Boolean(id);
  $('musicStop').disabled = !id && !busy;
  $('musicFile').disabled = !ready || busy || Boolean(id);
  $('dropZone').setAttribute('aria-disabled', String(busy || Boolean(id)));
  $('mp3Mode').disabled = busy || Boolean(id);
  $('beatEngine').disabled = busy || Boolean(id) || !plannedMode();
  optionLabels();
  if (busy) for (const field of Object.values(optionFields)) $(field).disabled = true;
}
const bandNames = ['Bass · 40–180 Hz', 'Tiefmitten · 180–500 Hz', 'Mitten · 500–1500 Hz', 'Präsenz · 1500–3500 Hz', 'Höhen · 3500–6000 Hz'];
for (const [i, name] of bandNames.entries()) {
  const row = document.createElement('div'); row.className = 'sound-band';
  const label = document.createElement('span'); label.textContent = name;
  const bar = document.createElement('meter'); bar.id = `soundBand${i}`; bar.min = 0; bar.max = 1; bar.value = 0; bar.setAttribute('aria-label', name);
  const value = document.createElement('span'); value.id = `soundBandValue${i}`; value.textContent = '0 %';
  row.append(label, bar, value); $('soundBands').append(row);
}
function soundMeter(level) {
  for (let i=0;i<5;i++) { const value=level.bands?.[i]??0; $(`soundBand${i}`).value=value; $(`soundBandValue${i}`).textContent=`${Math.round(value*100)} %`; }
  if (!level.bands || !(level.rms > 0.001)) { $('soundDetails').textContent='Warte auf Klangdaten …'; return; }
  const melody=level.melodyConfidence>0.08 ? `Dominanter Tonanteil ${Math.round(180*10**level.melodyTone)} Hz` : 'Kein eindeutiger Tonanteil';
  $('soundDetails').textContent=`${source==='show'?'Vorab-Analyse':'Live-Analyse'} · ${melody} · Klanghelligkeit ${Math.round((level.tone??0)*100)} % · Harmonischer Schwerpunkt ${Math.round((level.harmonicConfidence??0)*100)} % · Geräuschhaftigkeit ${Math.round((level.flatness??0)*100)} % · Klangwechsel ${Math.round((level.flux??0)*100)} %`;
}
function meter(level) {
  const sound = source==='show' && showWindows ? showWindows[Math.min(showWindows.length-1,Math.floor(player.currentTime/0.02))] : level;
  soundMeter(sound ?? level);
  const value = Math.round((level.energy ?? 0) * 100), bass = Math.round((level.bassEnergy ?? 0) * 100);
  $('levelBar').style.width = `${value}%`; $('bassBar').style.width = `${bass}%`;
  $('audioValue').textContent = `${value} %`; $('bassValue').textContent = `${bass} %`;
  const active = level.rms > 0.001;
  $('levelText').textContent = active ? `Audiopegel aktiv · ${Math.round(20 * Math.log10(level.rms))} dBFS · Bass ${level.bass > 0.00001 ? Math.round(20 * Math.log10(level.bass)) : '−∞'} dBFS` : 'Warte auf Musik an der gewählten Quelle …';
  if ((level.beatSeq ?? 0) > displayedBeat) {
    $('beatIndicator').classList.remove('hit'); void $('beatIndicator').offsetWidth; $('beatIndicator').classList.add('hit');
  }
  displayedBeat = level.beatSeq ?? 0;
  $('tempoStatus').textContent = (level.confidence ?? 0) >= 0.65 ? `${level.bpm} BPM · Rhythmus erkannt` : 'Beat-Suche · noch kein stabiles Tempo';
}
async function audioContext() {
  if (!context) context = new AudioContext();
  if (!analyser) {
    await context.audioWorklet.addModule('/audio-worklet.js');
    analyser = new AudioWorkletNode(context, 'music-analysis', { outputChannelCount: [2] });
    analyser.port.onmessage = event => { const previousBeat = latestLevel.beatSeq; latestLevel = event.data; if (id && source !== 'system') { meter(latestLevel); if (source !== 'show' && latestLevel.beatSeq > previousBeat) void sendAudioFrame(); } };
    analyser.onprocessorerror = () => { if (id) void stop('Audioanalyse unterbrochen. Bitte die Seite neu laden.'); };
    fileNode = context.createMediaElementSource(player); fileNode.connect(analyser); analyser.connect(context.destination);
  }
  latestLevel = { rms: 0, bass: 0, energy: 0, bassEnergy: 0, beatSeq: 0 };
  analyser.port.postMessage('reset');
  await context.resume();
}
async function sendAudioFrame() {
  if (sending || !id || source === 'system') return;
  const current = id; sending = true;
  try {
    if (source === 'show') {
      if (!showPlan || player.paused || player.seeking) return;
      const { showFrameAt, transitionFrame } = await showTools();
      const frameTime=player.currentTime+Number($('showOffset').value)/1000;
      if(showTransition&&(player.currentTime<showTransition.start||player.currentTime>=showTransition.start+2))showTransition=null;
      const params = showTransition?transitionFrame(showTransition.from,showPlan,frameTime,(player.currentTime-showTransition.start)/2):showFrameAt(showPlan,frameTime);
      const section = showPlan.sections.find(s => player.currentTime >= s.start && player.currentTime < s.end);
      $('showPosition').textContent = section ? `${section.lookLabel?section.lookLabel+' · ':''}${section.title??section.kind}${section.estimated?' (KI-Schätzung)':''} · ${Math.floor(player.currentTime)} s / ${Math.round(showPlan.duration)} s` : '';
      const score=showPlan.score;
      if(score) {
        const point=score.track[Math.min(score.track.length-1,Math.floor(player.currentTime/score.step))];
        const phrase=score.phrases.find(p=>player.currentTime>=p.start&&player.currentTime<p.end);
        const motif=score.motifs[phrase?.motif];
        $('melodyPosition').textContent=(point?.confidence ? `Tonspur folgt · ${Math.round(440*2**((point.midi-69)/12))} Hz` : 'Tonspur unsicher')+(motif?.occurrences>1 ? ` · wiederkehrendes Motiv ${motif.id+1}` : '');
      }
      if(showPlan.colorDrivers) {
        const driver=showPlan.colorDrivers[Math.min(showPlan.colorDrivers.length-1,Math.max(0,Math.floor((player.currentTime+Number($('showOffset').value)/1000)/showPlan.step)))];
        $('melodyPosition').textContent += ` · ${{hold:'Farbfläche gehalten',passage:'Abschnitt und Klangbogen führen',melody:'Melodie führt',blend:'Melodie und Klangbild kombiniert',spectrum:'Klangbild führt',pause:'Pause · Farbposition gehalten'}[driver]}`;
      }
      updateMoodStatus(player.currentTime);
      const sound=showWindows?.[Math.min(showWindows.length-1,Math.floor(player.currentTime/0.02))];
      if(sound?.bands){
        const dominant=sound.bands.indexOf(Math.max(...sound.bands));
        const traits=[`${['Bass','Tiefmitten','Mitten','Präsenz','Höhen'][dominant]} betont`];
        if(sound.harmonicConfidence>0.2)traits.push('ausgeprägte Tonanteile');
        if(sound.flatness>0.25)traits.push('geräuschhafte Klangtextur');
        if(sound.flux>0.2)traits.push('deutlicher Klangwechsel');
        $('showSound').textContent=traits.join(' · ');
      }
      await api('/api/music/frame', { id: current, params });
      if (id === current) {
        $('showSwatch').style.backgroundColor = `rgb(${params.r},${params.g},${params.b})`;
        $('showOutput').textContent = `An Server übergeben · RGB ${params.r} / ${params.g} / ${params.b} · Helligkeit ${params.dimming} %`;
      }
    } else await api('/api/music/frame', { id: current, ...latestLevel });
  }
  catch (error) { if (id === current) void stop(error.message); }
  finally { sending = false; }
}
function cleanup() {
  showTransition=null;
  stopShowClock?.(); stopShowClock=null;
  clearInterval(frameTimer); clearInterval(statusTimer);
  renderWorker?.terminate(); finishRender?.(null); renderWorker=null; finishRender=null;
  if (stream) { for (const track of stream.getTracks()) track.stop(); stream = null; }
  captureNode?.disconnect(); captureNode = null; silentGain?.disconnect(); silentGain = null;
  if (analyser && context) { analyser.disconnect(); analyser.connect(context.destination); }
  player.pause();
  meter({ rms: 0, bass: 0, energy: 0, bassEnergy: 0 });
  $('showSound').textContent = '';
  $('showOutput').textContent = 'Lichtshow pausiert';
  $('mp3Mode').value = preferredMp3Mode;
  $('showPanel').hidden = !plannedMode() || !showPlan;
}
async function stop(reason = '') {
  const old = id; id = null; source = null; generation++; busy = true; cleanup(); controls();
  try {
    if (old) {
      const result = await api('/api/music/stop', { id: old });
      if(result.error || reason)ready=false;
      message(result.error || reason || (result.restored ? 'Musik gestoppt. Vorheriges Licht wiederhergestellt.' : 'Musik gestoppt.'), Boolean(result.error));
    } else if (reason) message(reason, true);
  } catch (error) { message(`${error.message} Der Server beendet die Sitzung nach spätestens zehn Sekunden ohne Verbindung.`, true); }
  finally { busy = false; controls(); if(showWindows && plannedMode())void rebuildShow(); }
}
async function start(kind, selectedStream = null) {
  if (busy || id || !ready) { if (kind === 'file') player.pause(); selectedStream?.getTracks().forEach(t => t.stop()); return; }
  if (kind !== 'file' && plannedMode()) {
    $('mp3Mode').value = 'live'; analysisJob++; structureAbort?.abort(); structureRunning=false; beatAbort?.abort(); analysisWorker?.terminate(); planning = false; $('showPanel').hidden = true;
  }
  if (kind === 'file' && plannedMode()) {
    if (planning || !showPlan) { player.pause(); message('Bitte zuerst die Lichtshow fertig analysieren lassen.', true); return; }
    kind = 'show';
  }
  busy = true; source = kind; const run = ++generation; controls();
  try {
    if (kind === 'show') {
      startingShow = true; player.pause();
      const plan=await renderPlan(options());
      if(!plan || run!==generation)return;
      commitShow(plan);
    }
    if (!['file', 'show'].includes(kind)) player.pause();
    if (kind !== 'system') await audioContext();
    if (selectedStream) {
      stream = selectedStream;
      captureNode = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      analyser.disconnect(); silentGain = context.createGain(); silentGain.gain.value = 0;
      captureNode.connect(analyser); analyser.connect(silentGain); silentGain.connect(context.destination);
      stream.getTracks().forEach(t => t.addEventListener('ended', () => { if (id && source === 'tab') void stop('Audiofreigabe beendet.'); }, { once: true }));
    }
    const result = await api('/api/music/start', { ip: $('musicLamp').value, source: kind, settings: options() });
    if (run !== generation || (kind === 'file' && player.paused)) { await api('/api/music/stop', { id: result.id }); selectedStream?.getTracks().forEach(t => t.stop()); return; }
    id = result.id; source = kind;
    if (kind === 'show') { await player.play(); startingShow = false; }
    message(kind === 'system' ? 'Rechner-Audio aktiv. Starte Musik in deinem Player.' : kind === 'show' ? `Vorbereitete Lichtshow läuft · Klangfarben V${showPlan.version} · synchron zum Player.` : kind === 'file' ? 'Live-MP3 aktiv. Die Lampe folgt dem Live-Effekt; die vorbereitete Klangfarben-Show ist ausgeschaltet.' : 'Geteilter Tab steuert die Lampe.');
    if(kind==='show') {
      const {startShowClock}=await import('/show-clock.js');
      if(run!==generation)return;
      stopShowClock=startShowClock(()=>[{key:player,time:player.currentTime+Number($('showOffset').value)/1000,
        playing:Boolean(id)&&!player.paused&&!player.seeking,rate:player.playbackRate,weight:1,beats:showPlan?.beatTiming?.times}],sendAudioFrame);
    } else if (kind !== 'system') { frameTimer = setInterval(sendAudioFrame, 100); void sendAudioFrame(); }
    statusTimer = setInterval(async () => {
      if (checking || !id) return; checking = true; const current = id;
      try {
        const status = await api('/api/music/status', { id: current });
        if (id !== current) return;
        if (!status.active) { id = null; ready=false; cleanup(); controls(); message(status.error || 'Musik beendet. Vorheriges Licht wiederhergestellt.', Boolean(status.error)); }
        else {
          if (kind === 'system') meter(status.level);
          if(status.automatic){liveDesign=status.automatic;automaticStatus();}
        }
      } catch (error) { if (id === current) void stop(error.message); }
      finally { checking = false; }
    }, kind === 'system' ? 125 : 2000);
  } catch (error) { selectedStream?.getTracks().forEach(t => t.stop()); if (id) await stop(error.message); else { cleanup(); message(error.message, true); } }
  finally { startingShow = false; busy = false; controls(); }
}
function updateMoodStatus(time=0) {
  if(!plannedMode()){$('moodStatus').textContent='Stimmungsmodus ist für die Vorab-Show verfügbar.';return;}
  if(options().mood!=='auto'){$('moodStatus').textContent='Stimmungsmodus aus · gewählte Farbpalette.';return;}
  const mood=showPlan?.moods?.find(m=>time>=m.start&&time<m.end);
  $('moodStatus').textContent=mood?`Stimmung: ${mood.label} · ${mood.mode==='major'?'Dur-Tendenz':mood.mode==='minor'?'Moll-Tendenz':'Tonart unklar'}${mood.held?' · Palette beibehalten':''}`:'Stimmungsmodus an · wartet auf Analyse.';
}
function renderShow() {
  if(!$('manualTuning').checked&&showPlan.effectiveOptions)applyDesign(showPlan.effectiveOptions);
  optionLabels();
  updateMoodStatus(player.currentTime);
  $('showTimeline').replaceChildren();
  for (const section of showPlan.sections) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `show-section section-${['Ruhig','Aufbau','Intensiv','Fließend'].indexOf(section.kind)}`;
    button.style.flexGrow = String(section.end - section.start);
    button.textContent = section.title??section.kind; button.title = `${section.lookLabel?section.lookLabel+' · ':''}${section.title??section.kind}${section.estimated?' (KI-Schätzung)':''}: ${Math.floor(section.start)}–${Math.ceil(section.end)} s · Farbfamilie ${(section.motif ?? 0)+1}`;
    button.addEventListener('click', () => { player.currentTime = section.start; });
    $('showTimeline').append(button);
  }
  const score=showPlan.score, melody=$('showMelody').getContext('2d');
  melody.clearRect(0,0,600,72);melody.strokeStyle='#a7edc8';melody.lineWidth=2;melody.beginPath();
  let drawing=false;
  for(const point of score?.track??[]) {
    const x=point.time/showPlan.duration*600,y=66-point.position*60;
    if(!point.confidence){drawing=false;continue;}
    if(drawing)melody.lineTo(x,y);else melody.moveTo(x,y);drawing=true;
  }
  melody.stroke();
  $('melodySummary').textContent=score ? `Melodieverlauf · ${score.notes.length} Tonsegmente · ${score.phrases.length} mögliche Phrasen · ${score.motifs.filter(m=>m.occurrences>1).length} wiederkehrende Motive · ${Math.round(score.coverage*100)} % nutzbare Tonspur. Lücken: Das Klangbild übernimmt sanft.` : 'Keine Melodiespur verfügbar.';
  const preview = $('showColors').getContext('2d');
  for (let x=0; x<600; x++) {
    const frame = showPlan.frames[Math.min(showPlan.frames.length-1, Math.floor(x/600*showPlan.frames.length))];
    preview.fillStyle = `rgb(${frame.r},${frame.g},${frame.b})`; preview.fillRect(x,0,1,24);
  }
  $('analysisProgress').value = 100;
  $('analysisStatus').textContent = `Lichtshow bereit · ${Math.round(showPlan.duration)} Sekunden · ${showPlan.automatic?(showPlan.musicStyle?'Stilverlauf berücksichtigt':'automatisch gestaltet'):'manuell abgestimmt'}`;
}
let renderWorker, finishRender, optionRevision = 0;
function renderPlan(config) {
  renderWorker?.terminate(); finishRender?.(null);
  if (!showWindows || !showPlan) return Promise.resolve(null);
  return new Promise((resolve,reject) => {
    const worker=renderWorker=new Worker('/show-worker.js',{type:'module'});
    finishRender=resolve;
    const done=()=>{worker.terminate();if(renderWorker===worker){renderWorker=null;finishRender=null;}};
    worker.onmessage=({data})=>{done();if(data.error)reject(Error(data.error));else resolve(data.plan);};
    worker.onerror=()=>{done();reject(Error('Lichtverlauf konnte nicht aktualisiert werden.'));};
    worker.postMessage({kind:'render',windows:showWindows,duration:showPlan.duration,options:config,beatGrid:showPlan.beatGrid,structure:showStructure,musicStyle:showPlan.musicStyle});
  });
}
function commitShow(plan) {
  if(showPlan&&id&&source==='show'&&Boolean(showPlan.structure)!==Boolean(plan.structure))showTransition={from:showPlan,start:player.currentTime};
  showPlan=plan;renderShow();
}
async function refineStructure() {
  if(!chosenFile||!showPlan||!plannedMode()||structureRunning)return;
  const job=analysisJob,track=chosenFile;structureAbort?.abort();
  const controller=structureAbort=new AbortController();structureRunning=true;controls();
  $('structureStatus').textContent='Zusätzliche KI-Analyse startet. Du kannst die Musik bereits abspielen.';
  try {
    const bytes=await track.arrayBuffer();
    const {analyzeStructure}=await import('/structure-analysis.js');
    if(job!==analysisJob)return;
    const result=await analyzeStructure(bytes,showPlan.duration,{token,cancelSignal:controller.signal,onStatus:text=>{if(job===analysisJob)$('structureStatus').textContent=text;}});
    if(job!==analysisJob)return;
    $('structureStatus').textContent=result.message;
    if(result.structure){
      showStructure=result.structure;optionRevision++;
      if(id&&source==='show')await sendSettings();else await rebuildShow();
      if(job===analysisJob&&showPlan?.structure)$('structureStatus').textContent=result.message+(id?' · ab der aktuellen Liedposition übernommen.':' · für die Wiedergabe übernommen.');
    }
  } catch(error) {if(job===analysisJob)$('structureStatus').textContent='Bisherige Show bleibt aktiv: '+error.message;}
  finally{if(job===analysisJob){structureRunning=false;controls();}}
}
$('structureStart').addEventListener('click',()=>void refineStructure());
$('structureCancel').addEventListener('click',()=>structureAbort?.abort());
async function rebuildShow() {
  const job=analysisJob,revision=optionRevision;
  try {
    const plan=await renderPlan(options());
    if(!plan || job!==analysisJob || revision!==optionRevision || id)return;
    commitShow(plan);
  } catch(error) { if(job===analysisJob)message(error.message,true); }
}
async function prepareShow() {
  if (!chosenFile || id || busy) return;
  const job = ++analysisJob; structureAbort?.abort(); structureRunning=false; showStructure=null; showTransition=null; beatAbort?.abort(); beatAbort = new AbortController(); analysisWorker?.terminate(); showPlan = showWindows = null; planning = true;
  $('showPanel').hidden = false; $('analysisProgress').removeAttribute('value');
  $('structureStatus').textContent='Optional: Songaufbau im Hintergrund verfeinern. Musik und Licht können dabei weiterlaufen.';
  $('showTimeline').replaceChildren(); $('analysisStatus').textContent = 'MP3 wird für die Analyse gelesen …';
  try {
    if (chosenFile.size > 50 * 1024 * 1024) throw Error('Vorab-Analyse unterstützt MP3 bis 50 MB. Für größere Dateien ist Live zur Musik verfügbar.');
    if (!Number.isFinite(player.duration)) await new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); player.removeEventListener('loadedmetadata', done); resolve(); };
      const timer = setTimeout(() => { player.removeEventListener('loadedmetadata', done); reject(Error('MP3-Dauer konnte nicht gelesen werden.')); }, 10000);
      player.addEventListener('loadedmetadata', done, { once: true });
    });
    if (job !== analysisJob) return;
    if (player.duration > 900) throw Error('Vorab-Analyse unterstützt Lieder bis 15 Minuten. Für längere Dateien bitte Live zur Musik wählen.');
    const bytes = await chosenFile.arrayBuffer();
    if (job !== analysisJob) return;
    const decoder = new OfflineAudioContext(2, 1, 16000);
    const decoded = await decoder.decodeAudioData(bytes);
    if (job !== analysisJob) return;
    const { analyzeBeats } = await import('/beat-analysis.js');
    if (job !== analysisJob) return;
    const beatResult = await analyzeBeats(decoded, { engine: $('beatEngine').value, token, signal: beatAbort.signal, onStatus: text => { if(job === analysisJob) $('beatStatus').textContent = text; } });
    if (job !== analysisJob) return;
    $('beatStatus').textContent = beatResult.message;
    const {analyzeStyle}=await import('/style-analysis.js');
    const styleResult=await analyzeStyle(decoded,{token,signal:beatAbort.signal,onStatus:text=>{if(job===analysisJob)$('analysisStatus').textContent=text;}});
    if(job!==analysisJob)return;
    $('analysisStatus').title=styleResult.message;
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i).slice());
    const worker = analysisWorker = new Worker('/show-worker.js', { type: 'module' });
    worker.onmessage = async event => {
      if (job !== analysisJob) return;
      const data = event.data;
      if (data.progress !== undefined) { $('analysisProgress').value = data.progress; $('analysisStatus').textContent = `Lied wird analysiert und Lichtshow erstellt … ${data.progress} %`; return; }
      worker.terminate(); analysisWorker = null; planning = false;
      if (data.error) { $('analysisStatus').textContent = data.error; message(data.error, true); return; }
      showPlan = data.plan; showWindows = data.windows;
      await rebuildShow();
      if (job === analysisJob) message('Lichtshow fertig. Drücke Play – Musik und vorbereiteter Ablauf starten zusammen.');
    };
    worker.onerror = () => { if (job === analysisJob) { worker.terminate(); analysisWorker = null; planning = false; $('analysisStatus').textContent = 'Analyse fehlgeschlagen. Datei erneut laden oder Live-Modus wählen.'; } };
    worker.postMessage({ channels, rate: decoded.sampleRate, options: options(), beatGrid: beatResult.grid,musicStyle:styleResult.style }, channels.map(c => c.buffer));
  } catch (error) { if (job === analysisJob) { planning = false; $('analysisStatus').textContent = error.message; message(error.message, true); } }
}
$('beatEngine').addEventListener('change', () => { savePreferences(); if(plannedMode()) void prepareShow(); });
$('mp3Mode').addEventListener('change', () => {
  preferredMp3Mode = $('mp3Mode').value;
  savePreferences();
  analysisJob++; structureAbort?.abort(); structureRunning=false; beatAbort?.abort(); analysisWorker?.terminate(); analysisWorker = null; planning = false;
  player.pause(); controls();
  $('beatStatus').textContent = plannedMode() ? 'Bereit für die Vorab-Analyse.' : 'Live-Modus verwendet die schnelle Standard-Erkennung.';
  if (plannedMode()) void prepareShow(); else { $('showPanel').hidden = true; message('Live-Modus bereit. MP3 im Player starten.'); }
});
player.addEventListener('seeked', () => { showTransition=null; if (source === 'show' && id) void sendAudioFrame(); });
function file(file) {
  if (busy || id) { message('Bitte den laufenden Musikeffekt vor einem Dateiwechsel stoppen.', true); return; }
  if (!file || !/\.mp3$/i.test(file.name)) { message('Bitte eine MP3-Datei auswählen.', true); return; }
  if (file.size > 200 * 1024 * 1024) { message('Die MP3 darf maximal 200 MB groß sein.', true); return; }
  analysisJob++; structureAbort?.abort(); structureRunning=false; beatAbort?.abort(); analysisWorker?.terminate(); analysisWorker = null; planning = false; showPlan = showWindows = null; chosenFile = file;
  $('manualTuning').checked=false;$('fineTuning').open=false;liveDesign=null;automaticStatus();
  player.pause(); player.removeAttribute('src'); player.load(); if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = URL.createObjectURL(file); player.src = objectURL; player.hidden = false;
  $('fileName').textContent = file.name;
  if (plannedMode()) void prepareShow(); else { $('showPanel').hidden = true; message('MP3 bereit. Drücke Play im Player, um Musik und Licht zu starten.'); }
}
$('musicFile').addEventListener('change', event => file(event.target.files[0]));
$('dropZone').addEventListener('click', () => { if (!busy && !id) $('musicFile').click(); });
$('dropZone').addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); $('dropZone').click(); } });
for (const name of ['dragover', 'drop']) window.addEventListener(name, event => event.preventDefault());
$('dropZone').addEventListener('dragover', () => $('dropZone').classList.add('dragging'));
$('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('dragging'));
$('dropZone').addEventListener('drop', event => { $('dropZone').classList.remove('dragging'); file(event.dataTransfer.files[0]); });
player.addEventListener('play', () => { if (!id) void start('file'); else if (!['file', 'show'].includes(source)) player.pause(); });
player.addEventListener('pause', () => { if (!startingShow && (id || busy) && ['file', 'show'].includes(source)) void stop(); });
player.addEventListener('ended', () => { if (id) void stop(); });
player.addEventListener('error', () => { void stop('Diese Datei konnte nicht als MP3 abgespielt werden.'); });
$('systemStart').addEventListener('click', () => start('system'));
$('tabStart').addEventListener('click', async () => {
  try {
    const capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: 'include' });
    if (!capture.getAudioTracks().length) { capture.getTracks().forEach(t => t.stop()); throw new Error('Es wurde kein Ton freigegeben. Einen Browser-Tab mit aktivierter Audiofreigabe wählen oder Rechner-Audio verwenden.'); }
    await start('tab', capture);
  } catch (error) { message(error.name === 'NotAllowedError' ? 'Audiofreigabe abgebrochen.' : error.message, true); }
});
$('musicStop').addEventListener('click', () => stop());
const descriptions = {
  soft: 'Eine Farbe deiner Palette folgt sanft der Lautstärke.',
  bass: 'Eine Farbe deiner Palette pulsiert mit der Bassenergie.',
  color: 'Die Farben deiner Palette gehen fließend ineinander über; die Musik steuert die Helligkeit.',
  disco: 'Beats steuern die Lichtintensität. Tonanteile, Frequenzverteilung und harmonische Schwerpunkte steuern die Farben; Klangwechsel beschleunigen die Übergänge. Bei 0 % Klangfarben folgt die Farbe jeweils acht Beats.',
};
function optionLabels() {
  $('structureStart').disabled=!showPlan||!chosenFile||!plannedMode()||busy||structureRunning;
  $('structureCancel').hidden=!structureRunning;
  $('manualSettings').disabled=!$('manualTuning').checked||busy;
  automaticStatus();
  const o = options();
  const prepared = plannedMode();
  for (const field of Object.values(optionFields)) $(field).disabled = false;
  $('musicMode').disabled = prepared;
  $('musicMood').disabled = !prepared;
  $('musicPaletteLabel').textContent=prepared&&o.mood==='auto'?'Startpalette bei unklarer Stimmung':'Farbpalette';
  updateMoodStatus(player.currentTime);
  for (const [field, text] of Object.entries({ intensityLabel: o.intensity.toLocaleString('de-DE'), minimumLabel: `${o.minimum} %`, maximumLabel: `${o.maximum} %`, smoothingLabel: `${Math.round(o.smoothing * 100)} %`, speedLabel: `${o.speed.toLocaleString('de-DE')} ×`, saturationLabel: `${o.saturation} %` })) $(field).textContent = text;
  $('customColors').hidden = o.palette !== 'custom';
  $('musicSpeed').disabled = !prepared && !['disco', 'color'].includes(o.mode);
  $('effectDescription').textContent = prepared ? 'Beats steuern die Helligkeit. Steigende und fallende Tonfolgen bewegen die Farbe; gehaltene Töne halten ihre Position. Bei unsicherer Tonspur übernimmt das Klangbild sanft. Wiederkehrende Motive teilen einen Farbverlauf.' : descriptions[o.mode];
  $('musicSmoothing').disabled = false;
  $('musicToneFollow').disabled = !prepared && !['disco', 'color'].includes(o.mode);
  $('showOffset').disabled = !prepared;
  $('toneFollowLabel').textContent = `${Math.round(o.toneFollow * 100)} %`;
  $('showOffsetLabel').textContent = `${$('showOffset').value} ms`;
  $('musicDynamics').disabled = !prepared && o.mode === 'disco';
  $('musicIntensity').disabled = !prepared && o.mode === 'disco';
}
let settingsPending = false, settingsSending = false;
async function sendSettings() {
  settingsPending = true;
  if (settingsSending) return;
  settingsSending = true;
  try {
    while (settingsPending && id) {
      settingsPending = false;
      const current=id,revision=optionRevision,job=analysisJob,config=options();
      try {
        const plan=source==='show'?await renderPlan(config):null;
        if(id!==current || job!==analysisJob)break;
        if(revision!==optionRevision){settingsPending=true;continue;}
        if(source==='show'&&!plan)continue;
        await api('/api/music/settings', { id: current, settings: config });
        if(id!==current)break;
        // Swap the score at the player's current position after the server has
        // accepted matching limits. Playback and the audio analysis keep going.
        if(plan){commitShow(plan);void sendAudioFrame();}
        if(revision!==optionRevision)settingsPending=true;
      } catch(error) { if(id===current)message(error.message,true); }
    }
  } finally { settingsSending = false; }
}
let settingsTimer;
$('manualTuning').addEventListener('change',()=>{
  if($('manualTuning').checked){const selected=plannedMode()?showPlan?.effectiveOptions:liveDesign?.options;if(selected)applyDesign(selected);}
  optionRevision++;optionLabels();savePreferences();
  clearTimeout(settingsTimer);
  if(id)void sendSettings();else if(showWindows&&plannedMode())void rebuildShow();
});
for (const name of Object.values(optionFields)) {
  $(name).addEventListener('input', () => {
    optionRevision++;
    if (name === 'musicMinimum' && Number($('musicMinimum').value) > Number($('musicMaximum').value)) $('musicMaximum').value = $('musicMinimum').value;
    if (name === 'musicMaximum' && Number($('musicMaximum').value) < Number($('musicMinimum').value)) $('musicMinimum').value = $('musicMaximum').value;
    optionLabels(); savePreferences();
    clearTimeout(settingsTimer); settingsTimer = setTimeout(() => { if (id) void sendSettings(); else if (showWindows && plannedMode()) void rebuildShow(); }, 180);
  });
}
optionLabels();
window.addEventListener('pagehide', () => { renderWorker?.terminate(); finishRender?.(null); analysisJob++; structureAbort?.abort(); structureRunning=false; beatAbort?.abort(); analysisWorker?.terminate(); const old = id; id = null; generation++; cleanup(); if (old) void api('/api/music/stop', { id: old }, true).catch(() => {}); });
let connectionChecking = false;
async function checkMusicConnection() {
  if (connectionChecking || id || busy) return;
  connectionChecking = true; ready = false; controls();
  message('Lampe wird geprüft und bei Bedarf automatisch gesucht …');
  try {
    const ip = $('musicLamp').value;
    const result = await api('/api/connection', ip ? { ip } : {});
    $('musicLamp').replaceChildren();
    for (const device of result.devices) $('musicLamp').add(new Option(device.name, device.ip));
    if (result.device) { $('musicLamp').value = result.device.ip; try { localStorage.setItem('wiz-selected', result.device.ip); } catch {} }
    ready = result.state === 'ready';
    message(ready ? 'Lampe verbunden. Wähle eine MP3 oder starte Rechner-Audio.' : result.message, !ready);
    if (result.setupUrl) { const link = document.createElement('a'); link.href = result.setupUrl; link.textContent = ' WLAN-Einrichtung öffnen'; $('musicStatus').append(link); }
  } catch (error) { message(error.message, true); }
  finally { connectionChecking = false; controls(); }
}
$('musicLamp').addEventListener('change', checkMusicConnection);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!id&&!busy)void checkMusicConnection();});
window.addEventListener('online',()=>{if(!id&&!busy)void checkMusicConnection();});
setInterval(() => { if (!ready && !document.hidden) void checkMusicConnection(); }, 7000);
(async () => {
  try {
    const meta = await api('/api/meta');
    canSystem = !meta.demo && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const result = await api('/api/devices');
    for (const device of result.devices) $('musicLamp').add(new Option(device.name, device.ip));
    try { const savedLamp = localStorage.getItem('wiz-selected'); if (result.devices.some(d => d.ip === savedLamp)) $('musicLamp').value = savedLamp; } catch {}
    await checkMusicConnection();
  } catch (error) { message(`${error.message} Gegebenenfalls auf der Startseite anmelden.`, true); }
  controls();
})();
