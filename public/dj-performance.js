import {holdAudioParam} from './transition-audio.js';
import {transitionBassDb} from './musical-transition.js';
import {dbGain,audioEnvelope,cleanCues,loopRange,tempoAt,jumpBeats} from './dj-performance-model.js';
const time=value=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
export async function discoverAudioOutputs(mediaDevices,{requestAccess=false}={}){
 let stream;
 try{
  if(requestAccess)stream=await mediaDevices.getUserMedia({audio:true});
  // Enumerate while access is active: some browsers only expose all devices then.
  const devices=await mediaDevices.enumerateDevices();
  return {outputs:devices.filter(d=>d.kind==='audiooutput'),inputs:devices.filter(d=>d.kind==='audioinput').length};
 }finally{stream?.getTracks().forEach(track=>track.stop());}
}
export function createPerformance({decks,mixer,ready,manual,save,report,sync}){
 const outputEvents=new EventTarget();
 const notifyOutput=()=>outputEvents.dispatchEvent(new Event('change'));
 let ctx,master,masterMeter,limiter,cueBus,cueAudio,cueDestination,outputs={},dead=false,recorder,recordDestination,recordUrl,recordTimer,outputBusy=false,outputEpoch=0,recordPending=false;
 const grid=d=>d.track?.plan?.beatGrid?.beats||d.track?.plan?.beatTiming?.times;
 const clampTime=(d,t)=>Math.max(0,Math.min((Number.isFinite(d.audio.duration)?d.audio.duration:d.track?.plan?.duration||0)-.01,t));
 const host=document.createElement('div');host.className='dj-master';
 host.innerHTML='<label>Master <input data-master type="range" min="0" max="1" step="0.01" value="0.8"><output data-master-value>80 %</output></label><div class="dj-level"><meter data-master-meter min="0" max="1" low="0.1" high="0.9" optimum="0.5" value="0" aria-label="Masterpegel"></meter><span data-peak>−∞ dBFS</span></div><details class="dj-routing"><summary>Audioausgänge & Vorhören</summary><p>Master und Kopfhörer müssen unterschiedliche physische Ausgänge sein. Beim Ausfall eines Ausgangs wird Vorhören ausgeschaltet.</p><button type="button" data-output="master" class="button secondary">Master-Ausgang wählen</button><button type="button" data-output="cue" class="button secondary">Kopfhörer wählen</button><p data-routing role="status">Master: Systemausgang · Vorhören aus</p><label>Kopfhörerlautstärke <input data-cue-level type="range" min="0" max="1" step="0.01" value="0.5"></label></details><details class="dj-shortcuts"><summary>Tastenkürzel</summary><p>Deck A: Q Play/Pause, W Cue, 1–4 Hotcues.<br>Deck B: O Play/Pause, P Cue, 7–0 Hotcues.<br>Shift + Hotcue löscht die Marke. Leere Marke: setzen; belegte Marke: anspringen. In Eingabefeldern sind Kürzel aus.</p></details>';
 mixer.append(host);const routingHost=host.querySelector('.dj-routing');
 const q=s=>host.querySelector(s)||(routingHost.matches(s)?routingHost:routingHost.querySelector(s));
 const recording=document.createElement('div');recording.className='dj-recording';
 recording.innerHTML='<button type="button" class="button secondary" data-record>Mix aufnehmen</button><a data-download hidden>Aufnahme herunterladen</a><p data-record-status role="status" class="small muted"></p>';
 host.append(recording);
 q('[data-download]').onclick=()=>{recordPending=false;};
 const beforeLeave=e=>{if(recordPending||recorder?.state==='recording'){e.preventDefault();e.returnValue='';}};
 window.addEventListener('beforeunload',beforeLeave);
 q('[data-record]').disabled=!globalThis.MediaRecorder;
 q('[data-record]').onclick=async()=>{
  q('[data-record]').disabled=true;
  try{
   if(recorder?.state==='recording'){recorder.stop();return;}
   await ready();
   if(!recordDestination){recordDestination=ctx.createMediaStreamDestination();limiter.connect(recordDestination);}
   const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw Error('Dieser Browser unterstützt kein passendes Aufnahmeformat.');
   recorder=new MediaRecorder(recordDestination.stream,{mimeType:mime,audioBitsPerSecond:192000});
   const chunks=[];let bytes=0;
   recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>128*1024*1024&&recorder.state==='recording')recorder.stop();}};
   recorder.onstop=()=>{recordPending=true;q('[data-record]').disabled=false;clearTimeout(recordTimer);q('[data-record]').textContent='Mix aufnehmen';if(recordUrl)URL.revokeObjectURL(recordUrl);recordUrl=URL.createObjectURL(new Blob(chunks,{type:mime}));q('[data-download]').href=recordUrl;q('[data-download]').download='AnyDj-Mix-'+new Date().toISOString().replace(/[:.]/g,'-')+(mime.includes('ogg')?'.ogg':'.webm');q('[data-download]').hidden=false;q('[data-record-status]').textContent='Aufnahme bereit · bitte vor dem Schließen herunterladen.';};
   recorder.onerror=()=>{q('[data-record]').disabled=false;q('[data-record-status]').textContent='Aufnahme fehlgeschlagen.';};
   recorder.start(1000);q('[data-record]').disabled=false;q('[data-download]').hidden=true;q('[data-record]').textContent='Aufnahme beenden';q('[data-record-status]').textContent='Master-Mix wird aufgenommen · maximal 2 Stunden / 128 MB.';
   recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},7200000);
  }catch(e){q('[data-record]').disabled=false;report(e.message);}
 };

 const outputSupport=Boolean(navigator.mediaDevices?.enumerateDevices&&AudioContext.prototype.setSinkId&&HTMLMediaElement.prototype.setSinkId);
 const fallback=document.createElement('label');fallback.textContent='Verfügbarer Ausgang';
 const outputSelect=document.createElement('select');outputSelect.setAttribute('aria-label','Verfügbarer Audioausgang');fallback.append(outputSelect);
 const refresh=document.createElement('button');refresh.type='button';refresh.className='button secondary';refresh.textContent='Audioausgänge aktualisieren';
 refresh.dataset.refreshOutputs='';
 const deviceStatus=document.createElement('p');deviceStatus.setAttribute('role','status');deviceStatus.dataset.outputDevices='';
 q('[data-output]').before(fallback,refresh);
 fallback.hidden=refresh.hidden=Boolean(navigator.mediaDevices?.selectAudioOutput)||!outputSupport;
 const unlock=document.createElement('button');unlock.type='button';unlock.className='button secondary';unlock.textContent='Audioausgänge freigeben';unlock.dataset.unlockOutputs='';
 const unlockHint=document.createElement('p');unlockHint.textContent='Falls Ausgänge fehlen: Der Browser benötigt kurz Mikrofonzugriff, um Audiogeräte freizugeben. Das Mikrofon wird danach sofort wieder geschlossen.';
 unlock.hidden=unlockHint.hidden=fallback.hidden||!navigator.mediaDevices?.getUserMedia;refresh.after(unlock,unlockHint,deviceStatus);
 unlock.onclick=()=>refreshOutputs({requestAccess:true});
 let available=[];
 let discoveryEpoch=0;
 async function refreshOutputs({requestAccess=false}={}){
  const epoch=++discoveryEpoch,selected=outputSelect.value;
  unlock.disabled=refresh.disabled=true;
  try{
   const {outputs,inputs}=await discoverAudioOutputs(navigator.mediaDevices,{requestAccess});
   if(dead||epoch!==discoveryEpoch)return;
   available=outputs.filter(d=>d.deviceId&&!['default','communications'].includes(d.deviceId));
   outputSelect.replaceChildren(...available.map((d,i)=>new Option(d.label||`Audioausgang ${i+1}`,d.deviceId)));
   if(available.some(d=>d.deviceId===selected))outputSelect.value=selected;
   // Keep the system default visible, but never mistake its alias for a separate cue output.
   if(!available.length){
    outputSelect.add(new Option(outputs.length?'Ausgänge noch nicht freigegeben':'Keine Wiedergabeausgänge sichtbar',''));
    deviceStatus.textContent=`${outputs.length?'Der Browser zeigt bisher nur einen anonymen Eintrag oder den Systemstandard.':'Der Browser meldet keine Wiedergabeausgänge.'} „Audioausgänge freigeben“ wählen und den Gerätezugriff erlauben. ${inputs?`${inputs} Audioeingang/-eingänge erkannt; Mikrofone sind keine Wiedergabeausgänge.`:''}`;
   }else deviceStatus.textContent=`${available.length} Wiedergabeausgänge verfügbar. Ausgang in der Liste wählen und als Master oder Kopfhörer zuweisen.`;
  }catch(e){
   if(dead||epoch!==discoveryEpoch)return;
   deviceStatus.textContent=e.name==='NotAllowedError'?'Gerätezugriff wurde blockiert. Mikrofonberechtigung für AnyDj im Browser bzw. Betriebssystem erlauben und erneut freigeben.':e.name==='NotFoundError'?'Kein Mikrofon für die Gerätefreigabe vorhanden. Einen Browser mit direkter Ausgangswahl verwenden oder die Audiogeräte im Betriebssystem prüfen.':'Audiogeräte konnten nicht gelesen werden: '+e.message;
  }finally{if(epoch===discoveryEpoch){unlock.disabled=refresh.disabled=false;}}
 }
 refresh.onclick=()=>refreshOutputs();if(outputSupport)void refreshOutputs();
 q('.dj-routing').addEventListener('toggle',()=>{if(!dead&&routingHost.open&&outputSupport&&!unlock.disabled)void refreshOutputs();});
 for(const b of routingHost.querySelectorAll('[data-output]')){b.disabled=!outputSupport;b.onclick=()=>chooseOutput(b.dataset.output);}
 if(!outputSupport)q('[data-routing]').textContent='Getrenntes Vorhören ist in diesem Browser nicht verfügbar. Master nutzt den Systemausgang.';
 function muteCue(){for(const d of decks){d.monitor=false;if(d.cueGain)d.cueGain.gain.setValueAtTime(0,ctx.currentTime);}if(cueAudio)cueAudio.pause();outputs.cue=null;notifyOutput();}
 async function chooseOutput(kind){
  if(outputBusy)return;outputBusy=true;const epoch=outputEpoch;
  routingHost.querySelectorAll('[data-output]').forEach(b=>b.disabled=true);
  try{
   muteCue();
   const device=navigator.mediaDevices.selectAudioOutput?await navigator.mediaDevices.selectAudioOutput():available.find(d=>d.deviceId===outputSelect.value);
   if(!device){await refreshOutputs({requestAccess:true});throw Error('Bitte jetzt einen Wiedergabeausgang in der Liste wählen und erneut zuweisen. Hinweise zur Gerätefreigabe stehen oberhalb.');}
   if(!device.deviceId||['default','communications'].includes(device.deviceId))throw Error('Bitte einen ausdrücklich benannten physischen Ausgang wählen.');
   if(kind==='cue'&&!outputs.master)throw Error('Zuerst einen eigenen Master-Ausgang wählen.');
   if(kind==='cue'&&(device.deviceId===outputs.master.deviceId||(device.groupId&&device.groupId===outputs.master.groupId)))throw Error('Kopfhörer benötigen einen anderen Ausgang als der Master.');
   await ready();
   if(kind==='master')await ctx.setSinkId(device.deviceId);
   else {await cueAudio.setSinkId(device.deviceId);await cueAudio.play();}
   if(epoch!==outputEpoch||dead){muteCue();return;}
   outputs[kind]=device;
   q('[data-routing]').textContent=`Master: ${outputs.master?.label||'Systemausgang'} · Kopfhörer: ${outputs.cue?.label||'aus'}`;
  }catch(e){muteCue();q('[data-routing]').textContent='Vorhören aus · '+e.message;}
  finally{outputBusy=false;notifyOutput();routingHost.querySelectorAll('[data-output]').forEach(b=>b.disabled=!outputSupport);}
 }
 const deviceChanged=()=>{outputEpoch++;outputs.master=null;muteCue();q('[data-routing]').textContent='Audiogeräte geändert · Master und Kopfhörer bitte erneut wählen.';if(outputSupport&&!unlock.disabled)void refreshOutputs();};
 navigator.mediaDevices?.addEventListener('devicechange',deviceChanged);
 q('[data-master]').oninput=()=>{q('[data-master-value]').textContent=Math.round(+q('[data-master]').value*100)+' %';if(master)master.gain.setTargetAtTime(+q('[data-master]').value,ctx.currentTime,.015);};
 q('[data-cue-level]').oninput=()=>{if(cueBus)cueBus.gain.setTargetAtTime(+q('[data-cue-level]').value,ctx.currentTime,.015);};
 // Seeking changes the song position, not ownership of queue/fade automation.
 function seek(d,t,keepLoop=false){if(!d.track?.plan||d.resumeTime!=null)return;if(!keepLoop)d.loop=null;d.audio.currentTime=clampTime(d,t);d.transition=null;}
 function hotcue(d,i,clear=false){
  if(!d.track?.plan||d.resumeTime!=null)return;
  d.track.hotCues=cleanCues(d.track.hotCues,d.track.plan.duration);
  if(clear){d.track.hotCues[i]=null;void save(d.track);}
  else if(d.track.hotCues[i]===null){d.track.hotCues[i]=d.audio.currentTime;void save(d.track);}
  else seek(d,d.track.hotCues[i]);
 }
 for(const d of decks){
  d.manualRate=1;d.loop=null;d.monitor=false;
  const section=document.createElement('div');section.className='dj-performance';
  section.innerHTML=`<div class="dj-performance-readout"><strong data-bpm>— BPM</strong><span data-remaining>Rest —</span></div><canvas class="dj-waveform" width="640" height="80" aria-label="Audio-Wellenform Deck ${d.name}"></canvas><div class="dj-level"><meter data-level min="0" max="1" value="0" aria-label="Kanalpegel Deck ${d.name}"></meter><span data-db>−∞ dBFS</span></div><div class="dj-tempo"><label>Tempo <input data-tempo type="range" min="-16" max="16" step="0.1" value="0"><output data-tempo-value>0 %</output></label><button data-tempo-reset class="button secondary">Reset</button><button data-sync class="button secondary" title="Tempo und Beatposition einmalig an das laufende andere Deck angleichen">Sync</button><label class="dj-keylock"><input data-keylock type="checkbox" checked> Tonhöhe halten</label></div><div class="dj-hotcues" aria-label="Hotcues Deck ${d.name}">${[0,1,2,3].map(i=>`<button class="button secondary" data-hotcue="${i}" title="Klick: setzen oder anspringen; Shift-Klick: löschen">${i+1} · Setzen</button>`).join('')}</div><div class="dj-loop"><label>Loop <select data-loop-size>${[1,2,4,8,16].map(n=>`<option ${n===4?'selected':''} value="${n}">${n} Beats</option>`).join('')}</select></label><button class="button secondary" data-loop aria-pressed="false">Loop an</button><button class="button secondary" data-jump="-1" aria-label="4 Beats zurück">−4 Beats</button><button class="button secondary" data-jump="1" aria-label="4 Beats vor">+4 Beats</button></div><p data-loop-info class="small muted" role="status">Loops benötigen ein Beat-Raster.</p><details class="dj-eq"><summary>Klang · Gain & Dreiband-EQ</summary><div class="dj-eq-grid">${[['trim','Gain',-12,6],['low','Bass',-24,6],['mid','Mitten',-24,6],['high','Höhen',-24,6]].map(([key,label,min,max])=>`<label>${label} <output data-value="${key}">0 dB</output><input data-eq="${key}" type="range" min="${min}" max="${max}" value="0" step="1"></label>`).join('')}</div><button class="button secondary" data-eq-reset>Klang zurücksetzen</button></details><button class="button secondary dj-monitor" aria-pressed="false" disabled>Auf Kopfhörern vorhören</button>`;
  section.querySelectorAll('input[type=range]').forEach(input=>input.classList.add('range'));
  d.panel.append(section);d.performanceElement=section;const find=s=>section.querySelector(s);
  d.panel.querySelector('canvas').setAttribute('aria-label',`Lichtverlauf Deck ${d.name}`);
  d.panel.querySelector('.dj-track-title').after(section.querySelector('.dj-performance-readout'),section.querySelector('.dj-waveform'));
  d.panel.querySelector('.dj-volume').closest('label').after(section.querySelector('.dj-level'));
  const adjust=()=>{for(const input of section.querySelectorAll('[data-eq]')){section.querySelector(`[data-value="${input.dataset.eq}"]`).textContent=input.value+' dB';const node=d.eq?.[input.dataset.eq];if(node)node.gain.setTargetAtTime(input.dataset.eq==='trim'?dbGain(+input.value):+input.value,ctx.currentTime,.015);}};
  section.querySelectorAll('[data-eq]').forEach(input=>input.oninput=adjust);
  find('[data-eq-reset]').onclick=()=>{section.querySelectorAll('[data-eq]').forEach(input=>input.value=0);adjust();};
  const changeTempo=()=>{manual();d.manualRate=1+Number(find('[data-tempo]').value)/100;d.audio.playbackRate=d.manualRate;};
  find('[data-tempo]').oninput=changeTempo;find('[data-tempo-reset]').onclick=()=>{find('[data-tempo]').value=0;changeTempo();};
  find('[data-keylock]').onchange=()=>d.audio.preservesPitch=find('[data-keylock]').checked;
  find('[data-sync]').onclick=()=>{manual();try{sync(d);}catch(e){report(e.message);}};
  find('[data-loop]').onclick=()=>{
   if(d.loop){d.loop=null;return;}
   const range=loopRange(grid(d),d.audio.currentTime,+find('[data-loop-size]').value,d.track?.plan?.duration);
   if(!range){find('[data-loop-info]').textContent='An dieser Position kein vollständiges Beat-Raster verfügbar.';return;}
   manual();d.loop=range;seek(d,range.start,true);
  };
  find('[data-loop-size]').onchange=()=>{d.loop=null;};
  section.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const target=jumpBeats(grid(d),d.audio.currentTime,Number(b.dataset.jump)*4);if(target!==null)seek(d,target);});
  let deleteCue=false;
  const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.className='button secondary';deleteButton.textContent='Löschen';deleteButton.title='Danach die zu löschende Hotcue-Marke wählen';deleteButton.setAttribute('aria-pressed','false');
  section.querySelector('.dj-hotcues').append(deleteButton);
  deleteButton.onclick=()=>{deleteCue=!deleteCue;deleteButton.setAttribute('aria-pressed',String(deleteCue));};
  section.querySelectorAll('[data-hotcue]').forEach(b=>b.onclick=e=>{hotcue(d,+b.dataset.hotcue,e.shiftKey||deleteCue);deleteCue=false;deleteButton.setAttribute('aria-pressed','false');});
  find('.dj-monitor').onclick=async()=>{try{await ready();if(!outputs.cue)return;d.monitor=!d.monitor;await cueAudio.play();}catch(e){muteCue();report(e.message);}};
 }
 function connect(context){
  ctx=context;ctx.addEventListener('sinkchange',muteCue);master=ctx.createGain();master.gain.value=+.8;masterMeter=ctx.createAnalyser();masterMeter.fftSize=1024;
  limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;
  master.connect(masterMeter);masterMeter.connect(limiter);limiter.connect(ctx.destination);
  cueBus=ctx.createGain();cueBus.gain.value=+.5;cueDestination=ctx.createMediaStreamDestination();cueBus.connect(cueDestination);
  cueAudio=new Audio();cueAudio.srcObject=cueDestination.stream;cueAudio.onerror=()=>{muteCue();q('[data-routing]').textContent='Kopfhörerausgabe fehlgeschlagen · Vorhören aus.';};
  for(const d of decks){
   d.eq={trim:ctx.createGain(),low:ctx.createBiquadFilter(),mid:ctx.createBiquadFilter(),high:ctx.createBiquadFilter()};
   Object.assign(d.eq.low,{type:'lowshelf'});d.eq.low.frequency.value=250;
   d.eq.mid.type='peaking';d.eq.mid.frequency.value=1000;d.eq.mid.Q.value=.7;
   d.eq.high.type='highshelf';d.eq.high.frequency.value=4000;
   const source=ctx.createMediaElementSource(d.audio);source.connect(d.eq.trim);d.eq.trim.connect(d.eq.low);d.eq.low.connect(d.eq.mid);d.eq.mid.connect(d.eq.high);
   d.meter=ctx.createAnalyser();d.meter.fftSize=1024;d.eq.high.connect(d.meter);
   d.gain=ctx.createGain();d.gain.gain.value=0;d.transitionFilter=ctx.createBiquadFilter();d.transitionFilter.type='lowshelf';d.transitionFilter.frequency.value=250;d.transitionFilter.gain.value=0;
   d.meter.connect(d.transitionFilter);d.transitionFilter.connect(d.gain);d.channelGain=ctx.createGain();d.gain.connect(d.channelGain);d.channelGain.connect(master);
   d.cueGain=ctx.createGain();d.cueGain.gain.value=0;d.meter.connect(d.cueGain);d.cueGain.connect(cueBus);
   for(const input of d.performanceElement.querySelectorAll('[data-eq]'))d.eq[input.dataset.eq].gain.value=input.dataset.eq==='trim'?dbGain(+input.value):+input.value;
  }
  master.gain.value=+q('[data-master]').value;cueBus.gain.value=+q('[data-cue-level]').value;
 }
 function meter(node,element,label){if(!node)return;const data=new Float32Array(node.fftSize);node.getFloatTimeDomainData(data);let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));element.value=Math.min(1,peak);label.textContent=peak>0.00001?`${(20*Math.log10(peak)).toFixed(1)} dBFS${peak>=1?' · zu laut':''}`:'−∞ dBFS';label.classList.toggle('dj-overload',peak>=1);}
 function update(){
  if(dead)return;
  for(const d of decks){
   const root=d.panel,find=s=>root.querySelector(s),duration=d.track?.plan?.duration||0,position=d.resumeTime??d.audio.currentTime,beats=grid(d);
   if(d.loop&&!d.audio.paused&&!d.audio.seeking&&position>=d.loop.end){d.audio.currentTime=d.loop.start+(position-d.loop.end)%(d.loop.end-d.loop.start);d.transition=null;}
   const bpm=tempoAt(beats,position);find('[data-bpm]').textContent=bpm?`${(bpm*d.audio.playbackRate).toFixed(1)} BPM`:'— BPM';
   find('[data-remaining]').textContent=d.spotify?'Spotify':duration?'Rest '+time((duration-position)/d.audio.playbackRate):'Rest —';
   find('[data-tempo-value]').textContent=((d.audio.playbackRate-1)*100).toFixed(1)+' %';
   const cues=cleanCues(d.track?.hotCues,duration);
   root.querySelectorAll('[data-hotcue]').forEach((b,i)=>{b.disabled=!duration||d.resumeTime!=null;b.textContent=`${i+1} · ${cues[i]===null?'Setzen':time(cues[i])}`;b.setAttribute('aria-label',`Hotcue ${i+1} ${cues[i]===null?'setzen':'bei '+time(cues[i])+' anspringen'} · Shift zum Löschen`);});
   find('[data-tempo]').disabled=!duration;find('[data-sync]').disabled=!duration||!decks.some(other=>other!==d&&other.track?.plan);
   find('[data-loop]').disabled=!duration||d.resumeTime!=null;find('[data-loop]').textContent=d.loop?'Loop aus':'Loop an';find('[data-loop]').setAttribute('aria-pressed',String(Boolean(d.loop)));
   if(d.loop)find('[data-loop-info]').textContent=`Loop ${time(d.loop.start)} – ${time(d.loop.end)}`;else if(find('[data-loop-info]').textContent.startsWith('Loop '))find('[data-loop-info]').textContent='Loops benötigen ein Beat-Raster.';
   root.querySelectorAll('[data-jump]').forEach(b=>b.disabled=!beats?.length);
   const monitor=find('.dj-monitor');monitor.disabled=!outputs.cue||!duration;monitor.setAttribute('aria-pressed',String(d.monitor));
   if(d.cueGain)d.cueGain.gain.setTargetAtTime(d.monitor&&outputs.cue?1:0,ctx.currentTime,.01);
   meter(d.meter,find('[data-level]'),find('[data-db]'));
   const canvas=find('.dj-waveform'),paint=canvas.getContext('2d');paint.clearRect(0,0,640,80);
   if(d.track?.waveform?.version===2){
    const {peaks,rms}=d.track.waveform;paint.fillStyle=d.index?'#77d2dc':'#f6ac7b';
    for(const [values,alpha] of [[peaks,.22],[rms,1]]){
     paint.globalAlpha=alpha;
     values.forEach((v,i)=>{if(v>0)paint.fillRect(i*640/values.length,40-v*34,640/values.length,v*68);});
    }
    paint.globalAlpha=1;
   }
   if(duration){paint.fillStyle='#fff';paint.fillRect(position/duration*640,0,2,80);for(const t of cues)if(t!==null){paint.fillStyle='#a7edc8';paint.fillRect(t/duration*640,0,2,10);}}
  }
  meter(masterMeter,q('[data-master-meter]'),q('[data-peak]'));
 }
 host.querySelectorAll('input[type=range]').forEach(input=>input.classList.add('range'));
 const timer=setInterval(update,30);
 function reset(d){d.loop=null;d.manualRate=1;d.monitor=false;d.performanceElement.querySelector('[data-tempo]').value=0;d.performanceElement.querySelector('[data-loop-info]').textContent='Loops benötigen ein Beat-Raster.';}
 async function waveform(track,file){if(track.waveform?.version===2||!file)return;try{const buffer=await new OfflineAudioContext(2,1,16000).decodeAudioData(await file.arrayBuffer());if(!dead)track.waveform=audioEnvelope(buffer);}catch{/* Playback and light analysis report file errors separately. */}}
 function key(e){if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,select,textarea,[contenteditable],dialog'))return;const k=/^Digit[0-9]$/.test(e.code)?e.code.slice(-1):e.key.toLowerCase();let d,action;if(['q','w','1','2','3','4'].includes(k)){d=decks[0];action=k==='q'?'play':k==='w'?'cue':+k-1;}else if(['o','p','7','8','9','0'].includes(k)){d=decks[1];action=k==='o'?'play':k==='p'?'cue':['7','8','9','0'].indexOf(k);}else return;e.preventDefault();if(typeof action==='number')hotcue(d,action,e.shiftKey);else d.panel.querySelector('.dj-'+action).click();}
 window.addEventListener('keydown',key);
 function clearTransition(){for(const d of decks)if(d.transitionFilter){const gain=d.transitionFilter.gain;holdAudioParam(gain,ctx.currentTime);gain.setTargetAtTime(0,ctx.currentTime,.02);}}
 function startTransition(from,to,duration){
  clearTransition();
  for(const [d,incoming] of [[from,false],[to,true]]){
   const gain=d.transitionFilter?.gain;if(!gain)continue;
   gain.cancelScheduledValues(ctx.currentTime);
   const curve=Float32Array.from({length:65},(_,i)=>transitionBassDb(i/64,incoming));
   gain.setValueCurveAtTime(curve,ctx.currentTime,Math.max(.1,duration));
  }
 }
 return {connect,reset,waveform,seek,clearTransition,startTransition,
  routingHost:q('.dj-routing'),
  getPreviewOutput:()=>!dead&&!outputBusy&&outputs.master&&outputs.cue?{...outputs.cue}:null,
  subscribeOutput(listener){outputEvents.addEventListener('change',listener);return ()=>outputEvents.removeEventListener('change',listener);},
  destroy(){clearTransition();dead=true;outputEpoch++;ctx?.removeEventListener('sinkchange',muteCue);clearInterval(timer);clearTimeout(recordTimer);if(recorder?.state==='recording'){recorder.onstop=null;recorder.stop();}recordDestination?.stream.getTracks().forEach(t=>t.stop());if(recordUrl)URL.revokeObjectURL(recordUrl);muteCue();cueAudio?.srcObject?.getTracks().forEach(t=>t.stop());if(cueAudio)cueAudio.srcObject=null;window.removeEventListener('keydown',key);window.removeEventListener('beforeunload',beforeLeave);navigator.mediaDevices?.removeEventListener('devicechange',deviceChanged);}};
}
