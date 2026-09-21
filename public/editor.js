import {validateCues,cueAt,editorFrame} from './editor-model.js';
import {showFrameAt} from './show-plan.js';
import {analyzeBeats} from './beat-analysis.js';
const $=id=>document.getElementById(id),audio=$('editorAudio');
const config={mode:'disco',minimum:5,maximum:100,intensity:1.5,smoothing:.5,speed:1,toneFollow:.8,palette:'sunset',saturation:100,dynamics:'balanced',colorA:'#ff0080',colorB:'#00dfff',mood:'off'};
let devices=[],device,ready=false,cues=[],selected=0,duration=0,hash='',wave=[],plan,worker,url,loadJob=0,id=null,busy=false,sending=false,history=[],statusChecking=false;
let beatAbort, chosenEditorFile;
let future=[],zoom=1,beatTimes=[],timelineDirty=true,drag=null;
let token='';try{token=sessionStorage.getItem('wiz-web-token')||'';}catch{}
const message=(text,error=false)=>{$('editorStatus').textContent=text;$('editorStatus').className=`notice${error?' warning':''}`;};
async function api(path,data,keepalive=false){
 const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1',...(token?{Authorization:`Bearer ${token}`}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),keepalive,signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok)throw Error(result.error?.message||'Anfrage fehlgeschlagen.');return result;
}
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const key=()=>hash&&device?`wiz-editor-v1:${hash}:${device.mac||device.ip}`:null;
function save(){if(!key())return;try{localStorage.setItem(key(),JSON.stringify({version:1,cues,beat:$('editorBeat').checked}));$('editorSaved').textContent='Entwurf für dieses Lied und diese Lampe gespeichert.';}catch{$('editorSaved').textContent='Browser-Speicher nicht verfügbar oder voll. Entwurf bleibt nur in dieser Sitzung.';}}
function load(){
 cues=[{time:0,color:'#ff7700',brightness:75,temp:2700,transition:'smooth'}];history=[];future=[];selected=0;$('editorBeat').checked=true;
 try{const stored=JSON.parse(localStorage.getItem(key()));if(stored?.version===1){cues=validateCues(stored.cues,duration);$('editorBeat').checked=stored.beat!==false;}}catch{message('Gespeicherter Entwurf konnte nicht gelesen werden. Ein neuer Verlauf wurde angelegt.',true);}
 render();
}
function snapshot(){history.push(JSON.stringify({cues,selected}));future=[];if(history.length>50)history.shift();}
function undo(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length||busy)return;to.push(JSON.stringify({cues,selected}));const state=JSON.parse(from.pop());cues=state.cues;selected=state.selected;save();render();}
function controls(){
 $('editorBeatEngine').disabled=busy||Boolean(id);
 $('editorLamp').disabled=busy||Boolean(id);$('editorFile').disabled=busy||Boolean(id);
 $('editorFields').disabled=busy||!plan||!device;$('editorBeat').disabled=busy||!plan;
 $('editorStart').disabled=!plan||!ready||busy||Boolean(id)||device?.capabilities?.brightness!==true;
 $('editorStop').disabled=!id;$('editorUndo').disabled=busy||!history.length;
 $('editorAdd').disabled=busy||!plan||cues.length>=500;
 $('editorRedo').disabled=busy||!future.length;$('editorDuplicate').disabled=busy||!plan||cues.length>=500;$('editorPlay').disabled=busy||!plan;
}
function render(){
 timelineDirty=true;controls();$('editorWorkspace').hidden=!plan;
 const caps=device?.capabilities??{};
 $('cueColorGroup').hidden=caps.color!==true;$('cueTempGroup').hidden=caps.color===true||caps.temperature!==true;
 $('editorCapabilities').textContent=caps.color===true?'Farblampe · Farben und Helligkeit':caps.temperature===true?'Weißlichtlampe · Weißtemperatur und Helligkeit':caps.brightness===true?'Dimmbare Lampe · Helligkeit':'Fähigkeiten noch unklar oder nicht dimmbar. Lichtwiedergabe gesperrt.';
 $('cueTemp').min=caps.minKelvin??2200;$('cueTemp').max=caps.maxKelvin??6500;
 const c=cues[selected];if(!c)return;
 $('editorSelectionLabel').textContent=selected===0?'Startfarbe · 0:00':`Punkt ${selected+1} · ${clock(c.time)}`;
 $('cueTime').value=c.time.toFixed(2);$('cueTime').max=duration;$('cueTime').disabled=selected===0;
 $('cueColor').value=c.color;$('cueTemp').value=c.temp;$('cueKelvin').textContent=`${$('cueTemp').value} K`;
 $('cueBrightness').value=c.brightness;$('cueBrightnessValue').textContent=`${Math.round(c.brightness)} %`;
 $('cueTransition').value=c.transition;$('cueTransition').disabled=selected===0;$('editorDelete').disabled=selected===0;
 $('editorCues').replaceChildren();
 for(const [i,cue] of cues.entries()){
  const button=document.createElement('button');button.className='button secondary editor-cue';button.type='button';button.setAttribute('aria-pressed',String(i===selected));
  const swatch=document.createElement('span');swatch.style.background=caps.color===true?cue.color:'#fff0d0';swatch.className='editor-cue-dot';
  button.append(swatch,document.createTextNode(`${clock(cue.time)} · ${caps.color===true?cue.color:caps.temperature===true?`${cue.temp} K`:`${cue.brightness} %`}`));
  button.addEventListener('click',()=>{selected=i;audio.currentTime=cue.time;render();});$('editorCues').append(button);
 }
 renderMarkers();preview();
}
function preview(){
 if(!plan)return;
 const time=audio.currentTime,params=editorFrame(cues,time,device?.capabilities??{},$('editorBeat').checked?showFrameAt(plan,time):null);
 const color=params.r!==undefined?`rgb(${params.r},${params.g},${params.b})`:params.temp<4000?'#ffd498':'#e2efff';
 $('editorOrb').style.background=color;$('editorOrb').style.opacity=String(.15+params.dimming/100*.85);
 $('editorPreview').textContent=`${clock(time)} · ${params.dimming} %${params.temp?` · ${params.temp} K`:''} · Vorschau`;
 $('editorClock').textContent=`${clock(time)} / ${clock(duration)}`;$('editorSeek').value=time;
 drawTimeline();$('editorPlayhead').style.left=`${time/duration*100}%`;$('editorPlay').textContent=audio.paused?'▶ Anhören':'Ⅱ Pause';
}
function eventTime(event){const rect=$('editorTimelineContent').getBoundingClientRect();return Math.max(0,Math.min(duration,(event.clientX-rect.left)/rect.width*duration));}
function snapTime(time,free=false){
 time=Math.max(0,Math.min(duration,time));
 if(!free&&$('editorSnap').checked&&beatTimes.length){let best=time,distance=.15;for(const beat of beatTimes){const delta=Math.abs(beat-time);if(delta<distance){best=beat;distance=delta;}}time=best;}
 return Math.max(0,Math.min(duration,Math.round(time*100)/100));
}
function renderMarkers(){
 const container=$('editorMarkers'),focused=container.contains(document.activeElement);container.replaceChildren();
 for(const [i,cue] of cues.entries()){
  const button=document.createElement('button');button.type='button';button.className='editor-marker';button.dataset.cue=String(i);button.setAttribute('aria-pressed',String(i===selected));
  button.setAttribute('aria-label',`Punkt ${i+1}, ${cue.time.toFixed(2)} Sekunden${i===0?', fester Startpunkt':', mit Pfeiltasten verschiebbar'}`);
  button.title=`${clock(cue.time)} · ${i===0?'Startpunkt': 'Ziehen zum Verschieben'}`;button.style.left=`${cue.time/duration*100}%`;button.style.setProperty('--cue-color',device?.capabilities?.color===true?cue.color:'#fff0d0');button.textContent=i===selected?'◆':'●';
  if(i===0)button.style.transform='none';else if(cue.time>=duration)button.style.transform='translateX(-100%)';
  button.addEventListener('focus',()=>{if(selected!==i){selected=i;if(audio.paused)audio.currentTime=cue.time;render();}});
  button.addEventListener('click',e=>{e.stopPropagation();selected=i;if(audio.paused)audio.currentTime=cue.time;render();container.children[i]?.focus({preventScroll:true});});
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0||busy)return;e.preventDefault();e.stopPropagation();selected=i;if(audio.paused)audio.currentTime=cue.time;render();container.children[i]?.focus({preventScroll:true});
   if(i===0)return;
   drag={cue,index:i,x:e.clientX,start:cue.time,moved:false,future:[...future]};$('editorTimelineContent').setPointerCapture(e.pointerId);
  });container.append(button);
 }
 if(focused)container.children[selected]?.focus({preventScroll:true});
}
function drawTimeline(){
 const canvas=$('editorTimeline'),width=Math.min(16000,Math.max(320,Math.round($('editorTimelineScroll').clientWidth*zoom)));
 $('editorTimelineContent').style.width=`${zoom*100}%`;
 if(canvas.width!==width){canvas.width=width;timelineDirty=true;}
 if(!timelineDirty)return;timelineDirty=false;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,140);
 for(let x=0;x<width;x++){
  const t=x/width*duration,p=cueAt(cues,t);ctx.fillStyle=device?.capabilities?.color===true?`rgb(${p.rgb.join(',')})`:'#dce8ee';ctx.fillRect(x,110,1,30);
  ctx.fillStyle='#a7edc8';const amplitude=wave[Math.floor(x/width*wave.length)]??0;ctx.fillRect(x,55-amplitude*45,1,Math.max(1,amplitude*90));
 }
 ctx.fillStyle='#ffffff22';for(const t of beatTimes)ctx.fillRect(t/duration*width,0,1,110);
 for(const [i,c] of cues.entries()){ctx.fillStyle=i===selected?'#fff':'#ffffff66';ctx.fillRect(c.time/duration*width,0,i===selected?2:1,140);}
 const ruler=$('editorRuler');ruler.replaceChildren();const step=[.5,1,2,5,10,15,30,60,120].find(v=>v/duration*width>=65)??180;
 for(let t=0;t<duration;t+=step){const label=document.createElement('span');label.style.left=`${t/duration*100}%`;label.textContent=clock(t)+(step<1?`.${Math.round(t%1*10)}`:'');ruler.append(label);}
}
$('editorTimelineContent').addEventListener('pointermove',event=>{
 if(!drag)return;
 if(!drag.moved&&Math.abs(event.clientX-drag.x)<4)return;
 if(!drag.moved){snapshot();drag.moved=true;}
 const scroll=$('editorTimelineScroll'),rect=scroll.getBoundingClientRect();if(event.clientX>rect.right-24)scroll.scrollLeft+=12;else if(event.clientX<rect.left+24)scroll.scrollLeft-=12;
 const lower=cues[drag.index-1].time+.051,upper=(cues[drag.index+1]?.time??duration+.051)-.051;
 drag.cue.time=Math.max(lower,Math.min(upper,snapTime(eventTime(event),event.altKey)));
 if(audio.paused)audio.currentTime=drag.cue.time;
 const marker=$('editorMarkers').children[drag.index];marker.style.left=`${drag.cue.time/duration*100}%`;
 $('cueTime').value=drag.cue.time.toFixed(2);$('editorSelectionLabel').textContent=`Punkt ${selected+1} · ${drag.cue.time.toFixed(2)} s`;timelineDirty=true;preview();
});
function endDrag(cancel=false){
 if(!drag)return;
 if(drag.moved){if(cancel){const state=JSON.parse(history.pop());cues=state.cues;selected=state.selected;future=drag.future;}else save();}
 drag=null;render();
}
$('editorTimelineContent').addEventListener('pointerup',()=>endDrag());
$('editorTimelineContent').addEventListener('pointercancel',()=>endDrag(true));
$('editorZoom').addEventListener('change',()=>{
 zoom=Number($('editorZoom').value);timelineDirty=true;preview();
 $('editorTimelineScroll').scrollLeft=audio.currentTime/duration*$('editorTimelineContent').clientWidth-$('editorTimelineScroll').clientWidth/2;
});
window.addEventListener('resize',()=>{timelineDirty=true;preview();});
async function togglePreview(){if(!plan||busy)return;if(!audio.paused)audio.pause();else try{await audio.play();}catch(error){message(error.message,true);}}
$('editorPlay').addEventListener('click',()=>void togglePreview());
document.addEventListener('keydown',event=>{
 if(!plan||busy||event.altKey||(event.target.isContentEditable||event.target.closest('input,select,textarea')))return;
 const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
 if(command&&key==='z'){event.preventDefault();undo(event.shiftKey);return;}
 if(command&&key==='y'){event.preventDefault();undo(true);return;}
 if(command&&key==='d'){event.preventDefault();addPoint(audio.currentTime,true);return;}
 if(command)return;
 if(key==='escape'&&drag){event.preventDefault();endDrag(true);return;}
 if(/^[1-6]$/.test(key)&&device?.capabilities?.color===true){event.preventDefault();$('cueColor').value=['#ff3300','#ffbf00','#36ff00','#00dfff','#3333ff','#ff00cc'][Number(key)-1];$('cueColor').dispatchEvent(new Event('change'));return;}
 if(key==='n'){event.preventDefault();addPoint();return;}
 if(key==='delete'||key==='backspace'){event.preventDefault();$('editorDelete').click();return;}
 if(event.code==='Space'&&!event.target.closest('button')){event.preventDefault();void togglePreview();return;}
 if(key==='arrowleft'||key==='arrowright'){
  if(!event.target.closest('#editorTimelineScroll'))return;event.preventDefault();const direction=key==='arrowleft'?-1:1;
  if(event.target.closest('.editor-marker')){
   if(selected===0)return;
   const c=cues[selected],lower=cues[selected-1].time+.051,upper=(cues[selected+1]?.time??duration+.051)-.051;
   snapshot();c.time=Math.max(lower,Math.min(upper,Math.round((c.time+direction*(event.shiftKey ? .5 : .05))*100)/100));
   if(audio.paused)audio.currentTime=c.time;save();render();
  }else{audio.currentTime=Math.max(0,Math.min(duration,audio.currentTime+direction*(event.shiftKey?5:1)));preview();}
 }
});

async function chooseLamp(preserve=false){
 if(busy||id)return;
 ready=false;busy=true;controls();const ip=$('editorLamp').value;if(!ip){busy=false;controls();return;}
 device=devices.find(d=>d.ip===ip)??device;
 try{
  message('Lampe wird geprüft …');const result=await api('/api/connection',{ip,force:true});
  device=result.device??devices.find(d=>d.ip===ip);ready=result.state==='ready';
  if(device&&device.ip!==ip){const option=$('editorLamp').selectedOptions[0];option.value=device.ip;option.textContent=device.name;}
  if(plan&&!preserve)load();else render();message(result.message,!ready);
 }catch(error){message(error.message,true);}finally{busy=false;controls();}
}
async function file(file){
 if(id||busy)return;if(!file||!file.name.toLowerCase().endsWith('.mp3')){message('Bitte eine MP3 auswählen.',true);return;}
 if(file.size>50*1024*1024){message('Der Editor unterstützt MP3-Dateien bis 50 MB und 15 Minuten.',true);return;}
 chosenEditorFile=file;
 const job=++loadJob;beatAbort?.abort();beatAbort=new AbortController();worker?.terminate();audio.pause();plan=null;hash='';busy=true;controls();$('editorWorkspace').hidden=true;$('editorFields').disabled=true;
 $('editorFilename').textContent=file.name;$('editorProgress').hidden=false;$('editorProgress').value=0;
 try{
  const bytes=await file.arrayBuffer();hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const decoded=await new OfflineAudioContext(2,1,16000).decodeAudioData(bytes);
  if(job!==loadJob)return;if(decoded.duration>900)throw Error('Bitte ein Lied mit maximal 15 Minuten auswählen.');
  duration=decoded.duration;wave=Array.from({length:8000},(_,k)=>{let peak=0;const samples=decoded.getChannelData(0);for(let i=Math.floor(k/8000*samples.length);i<Math.floor((k+1)/8000*samples.length);i++)peak=Math.max(peak,Math.abs(samples[i]));return peak;});
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);audio.src=url;audio.hidden=false;$('editorSeek').max=duration;
  const beatResult=await analyzeBeats(decoded,{engine:$('editorBeatEngine').value,token,signal:beatAbort.signal,onStatus:text=>{if(job===loadJob)$('editorBeatStatus').textContent=text;}});
  if(job!==loadJob)return;
  $('editorBeatStatus').textContent=beatResult.message;
  const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i).slice());
  worker=new Worker('/show-worker.js',{type:'module'});
  worker.onmessage=({data})=>{
   if(job!==loadJob)return;if(data.progress!==undefined){$('editorProgress').value=data.progress;message(`Musik wird vorbereitet … ${data.progress} %`);return;}
   worker.terminate();worker=null;busy=false;$('editorProgress').hidden=true;
   if(data.error){message(data.error,true);controls();return;}
   document.body.classList.add('editor-loaded');plan=data.plan;beatTimes=plan.beatGrid?.beats??data.windows.flatMap((w,i)=>w.beatSeq>(data.windows[i-1]?.beatSeq??0)?[i*.02]:[]);zoom=1;$('editorZoom').value='1';load();message('Bereit. Stelle im Lied wählen, Punkt setzen und Farbe auswählen.');
  };
  worker.onerror=()=>{worker?.terminate();worker=null;busy=false;message('Analyse fehlgeschlagen. Bitte Datei erneut laden.',true);controls();};
  worker.postMessage({channels,rate:decoded.sampleRate,options:config,beatGrid:beatResult.grid},channels.map(c=>c.buffer));
 }catch(error){if(job!==loadJob)return;busy=false;message(error.message,true);$('editorProgress').hidden=true;controls();}
}
$('editorBeatEngine').addEventListener('change',()=>{if(chosenEditorFile&&!busy&&!id)void file(chosenEditorFile);});
$('editorFile').addEventListener('change',e=>void file(e.target.files[0]));
for(const event of ['dragover','drop'])window.addEventListener(event,e=>e.preventDefault());
$('editorDrop').addEventListener('drop',e=>void file(e.dataTransfer.files[0]));
$('editorLamp').addEventListener('change',()=>void chooseLamp());
$('editorTimeline').addEventListener('click',e=>{if(plan&&!busy){audio.currentTime=eventTime(e);$('editorTimelineScroll').focus({preventScroll:true});preview();}});
$('editorTimeline').addEventListener('dblclick',e=>{if(plan&&!busy)addPoint(eventTime(e));});
$('editorSeek').addEventListener('input',()=>{audio.currentTime=Number($('editorSeek').value);preview();});
function addPoint(at=audio.currentTime,copy=false){
 if(!plan||busy||cues.length>=500)return;
 let time=snapTime(at);if(copy&&cues.some(c=>Math.abs(c.time-time)<.05))time=Math.min(duration,time+.5);
 if(cues.some(c=>Math.abs(c.time-time)<.05)){selected=cues.findIndex(c=>Math.abs(c.time-time)<.05);render();return;}
 snapshot();const sample=cueAt(cues,time),c=copy?{...cues[selected],time}:{time,color:'#'+sample.rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),temp:sample.temp,brightness:Math.round(sample.brightness),transition:'smooth'};
 cues.push(c);cues.sort((a,b)=>a.time-b.time);selected=cues.indexOf(c);audio.currentTime=time;save();render();
 $('editorMarkers').children[selected]?.focus({preventScroll:true});
}
$('editorAdd').addEventListener('click',()=>addPoint());
$('editorDuplicate').addEventListener('click',()=>addPoint(audio.currentTime,true));
for(const [field,key] of [['cueTime','time'],['cueColor','color'],['cueTemp','temp'],['cueBrightness','brightness'],['cueTransition','transition']]){
 $(field).addEventListener('change',()=>{
  const c=cues[selected];if(!c)return;
 $('editorSelectionLabel').textContent=selected===0?'Startfarbe · 0:00':`Punkt ${selected+1} · ${clock(c.time)}`;const old={...c};snapshot();c[key]=['time','temp','brightness'].includes(key)?Number($(field).value):$(field).value;
  try{validateCues(cues,duration);cues.sort((a,b)=>a.time-b.time);selected=cues.indexOf(c);save();}catch(error){Object.assign(c,old);history.pop();message(error.message,true);}render();
 });
}
for(const color of ['#ff3300','#ffbf00','#36ff00','#00dfff','#3333ff','#ff00cc']){const button=document.createElement('button');button.type='button';button.className='swatch';button.style.background=color;const number=['#ff3300','#ffbf00','#36ff00','#00dfff','#3333ff','#ff00cc'].indexOf(color);const name=['Rot','Gold','Grün','Türkis','Blau','Pink'][number];button.setAttribute('aria-label',name);button.title=`${name} · Taste ${number+1}`;button.addEventListener('click',()=>{$('cueColor').value=color;$('cueColor').dispatchEvent(new Event('change'));});$('editorSwatches').append(button);}
$('editorDelete').addEventListener('click',()=>{if(selected===0)return;snapshot();cues.splice(selected,1);selected=Math.max(0,selected-1);save();render();});
$('editorUndo').addEventListener('click',()=>undo());
$('editorRedo').addEventListener('click',()=>undo(true));
$('editorBeat').addEventListener('change',()=>{save();preview();});
async function frame(){if(!id||sending||audio.paused||audio.seeking)return;const current=id;sending=true;try{await api('/api/music/frame',{id:current,params:editorFrame(cues,audio.currentTime,device.capabilities,$('editorBeat').checked?showFrameAt(plan,audio.currentTime):null)});}catch(error){if(id===current)await stop(error.message);}finally{sending=false;}}
async function stop(reason=''){
 const old=id;id=null;if(old)busy=true;audio.pause();controls();
 if(old)try{const result=await api('/api/music/stop',{id:old});message(result.error||reason||'Gestoppt. Vorheriges Licht wiederhergestellt.',Boolean(result.error||reason));}catch(error){message(error.message,true);}finally{busy=false;controls();}
}
$('editorStart').addEventListener('click',async()=>{
 if(!plan||!ready||id||busy)return;busy=true;controls();audio.pause();
 try{const result=await api('/api/music/start',{ip:device.ip,source:'show',settings:config});id=result.id;if(audio.currentTime>=duration-.1)audio.currentTime=0;await audio.play();await frame();if(id)message('Deine Lichtshow läuft. Farbpunkte lassen sich währenddessen bearbeiten.');}catch(error){if(id)await stop(error.message);else message(error.message,true);}finally{busy=false;controls();}
});
$('editorStop').addEventListener('click',()=>void stop());
audio.addEventListener('pause',()=>{if(id&&!busy)void stop();});audio.addEventListener('ended',()=>{if(id)void stop();});
audio.addEventListener('timeupdate',preview);audio.addEventListener('seeked',()=>{preview();void frame();});
setInterval(()=>{preview();void frame();},125);
setInterval(async()=>{if(!id||statusChecking)return;statusChecking=true;const current=id;try{const result=await api('/api/music/status',{id:current});if(id===current&&!result.active){id=null;audio.pause();ready=false;controls();message(result.error||'Lichtsitzung beendet.',true);}}catch(error){if(id===current)await stop(error.message);}finally{statusChecking=false;}},2000);
setInterval(()=>{if(!ready&&!busy&&!id&&!document.hidden&&device)void chooseLamp(true);},7000);
window.addEventListener('pagehide',()=>{loadJob++;beatAbort?.abort();worker?.terminate();if(url)URL.revokeObjectURL(url);const old=id;id=null;if(old)void api('/api/music/stop',{id:old},true).catch(()=>{});});
try{
 const result=await api('/api/devices');devices=result.devices;
 if(!devices.length){const found=await api('/api/connection',{});devices=found.devices;}
 for(const d of devices)$('editorLamp').add(new Option(d.name,d.ip));
 try{const selectedLamp=localStorage.getItem('wiz-selected');if(devices.some(d=>d.ip===selectedLamp))$('editorLamp').value=selectedLamp;}catch{}
 if(devices.length)await chooseLamp();else{message('Noch keine Lampe gespeichert. Bitte zuerst auf der Lampenseite verbinden.',true);controls();}
}catch(error){message(`${error.message} Gegebenenfalls auf der Lampenseite anmelden.`,true);controls();}
