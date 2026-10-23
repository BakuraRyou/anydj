import {AUDIO_EXPORT_FORMATS,audioExportFormat} from './audio-export-formats.js';
import {planQueueExport} from './queue-export-plan.js';
import {exportQueueAudio} from './queue-audio-export.js';
import {formatTime,fileIdentity} from './dj-model.js';
const MP4={id:'mp4',label:'MP4',extension:'mp4',description:'3D-Lichtshow mit Musik · H.264 / AAC · 30 FPS'};
const exportFormats=()=>window.anydjVideo?[...AUDIO_EXPORT_FORMATS,MP4]:AUDIO_EXPORT_FORMATS;
const exportFormat=id=>id==='mp4'?MP4:audioExportFormat(id);

export function openQueueExport({entries,tracks,options,ensureFile,videoSetup=null,onVideoTiming,name='Warteschlange',format='mp3'}){
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='dj-export-dialog';dialog.setAttribute('aria-label','Warteschlange exportieren');
 dialog.innerHTML='<header><h2>Warteschlange exportieren</h2><button type="button" class="button secondary" data-close>Schließen</button></header><p data-summary></p><p class="small">Exportiert die beim Öffnen enthaltenen Titel von Anfang an, mit gespeicherten Schnitten und Übergängen. Die Reihenfolge bleibt fest. Deck-EQ, Live-Loops, Crossfader und Masterlautstärke verändern den Export nicht. Exportpegel: 80 % mit Begrenzer.</p><ol data-tracks></ol><div class="dj-export-options"><label>Audioformat<select data-format></select></label><label data-quality>MP3-Qualität<select data-bitrate><option value="192">192 kbit/s</option><option value="320">320 kbit/s</option></select></label><p class="small" data-format-info></p></div><progress max="1" value="0" aria-label="Exportfortschritt"></progress><p data-status role="status"></p><div class="cut-actions"><button type="button" class="button primary" data-start>MP3 erstellen</button><button type="button" class="button secondary" data-cancel disabled>Abbrechen</button><a class="button primary" data-download hidden>MP3 herunterladen</a></div><p class="small" data-mp3-license>MP3-Encoder: <a href="https://github.com/zhuker/lamejs" target="_blank" rel="noopener">lamejs / LAME</a> · <a href="./lame-license.txt" target="_blank" rel="noopener">Lizenz</a> · <a href="./lame-source.js" download>Encoder-Quelltext</a>. Die Audiodateien bleiben auf deinem Gerät.</p>';
 document.body.append(dialog);const q=s=>dialog.querySelector(s);let schedule,controller,url,busy=false,dead=false;
 q('[data-format]').parentElement.firstChild.textContent='Exportformat';
 const videoOptions=document.createElement('label');videoOptions.hidden=true;videoOptions.innerHTML='Videoauflösung<select data-video-size><option value="1080">1920 × 1080 · Full HD</option><option value="720">1280 × 720 · HD</option></select>';
 q('.dj-export-options').append(videoOptions);
 const performanceInfo=document.createElement('p');performanceInfo.className='small muted';performanceInfo.hidden=true;performanceInfo.dataset.videoPerformance='';q('[data-status]').after(performanceInfo);
 const showPerformance=value=>{
  if(dead)return;performanceInfo.hidden=false;
  const device=value.renderer.replace(/^ANGLE \(/,'').replace(/, (OpenGL|Vulkan|D3D)[\s\S]*/,'').replace(/\)$/,'');
  performanceInfo.textContent='Grafik: '+device+(value.frames?` · ${value.rate.toFixed(1)} Bilder/s · ca. ${formatTime(value.remaining)} verbleibend`:'');
 };
 for(const entry of exportFormats())q('[data-format]').append(new Option(entry.label,entry.id));
 q('[data-format]').value=exportFormat(format).id;
 const syncFormat=()=>{const entry=exportFormat(q('[data-format]').value);q('[data-quality]').hidden=entry.id!=='mp3';q('[data-mp3-license]').hidden=entry.id!=='mp3';videoOptions.hidden=entry.id!=='mp4';q('[data-format-info]').textContent=entry.description+(entry.id==='mp4'?' · Aktueller Raum und gewählte 3D-Kamera · maximal 6 Stunden':' · Stereo');q('[data-start]').textContent=entry.label+' erstellen';};
 syncFormat();
 q('[data-format]').onchange=()=>{if(url){URL.revokeObjectURL(url);url=null;}q('[data-download]').hidden=true;status('');syncFormat();};
 // Copy every property used in planning before asynchronous file permission work.
 try{
  const included=new Set(entries.map(entry=>entry.trackId));
  const snapshot=tracks.filter(t=>included.has(t.id)).map(t=>({...t,plan:structuredClone(t.plan),stageMotifs:structuredClone(t.stageMotifs),audioCuts:structuredClone(t.audioCuts||[]),audioCutJoins:structuredClone(t.audioCutJoins||[])}));
  schedule=planQueueExport(structuredClone(entries),snapshot,{...options});
  q('[data-summary]').textContent=`${name} · ${schedule.rows.length} Titel · ${formatTime(schedule.duration)}`;
  for(const row of schedule.rows){const li=document.createElement('li');li.textContent=row.track.name+(row.outgoing?' · '+row.outgoing.plan.label:'');q('[data-tracks]').append(li);}
 }catch(error){q('[data-status]').textContent=error.message;q('[data-start]').disabled=true;}
 const status=text=>{q('[data-status]').textContent=text;};
 function state(value){busy=value;dialog.dataset.exporting=String(value);q('[data-start]').disabled=value||!schedule;q('[data-bitrate]').disabled=value;q('[data-format]').disabled=value;q('[data-video-size]').disabled=value;q('[data-cancel]').disabled=!value;}
 const beforeLeave=event=>{if(busy||url){event.preventDefault();event.returnValue='';}};
 window.addEventListener('beforeunload',beforeLeave);
 q('[data-download]').onclick=()=>{window.removeEventListener('beforeunload',beforeLeave);};
 q('[data-start]').onclick=async()=>{
  if(busy||!schedule)return;const entry=exportFormat(q('[data-format]').value);state(true);controller=new AbortController();const {signal}=controller;
  window.addEventListener('beforeunload',beforeLeave);
  if(url){URL.revokeObjectURL(url);url=null;}q('[data-download]').hidden=true;performanceInfo.hidden=true;
  try{
   const files=[];
   for(const row of schedule.rows){
    signal.throwIfAborted();status('Datei prüfen: '+row.track.name);
    const original=tracks.find(t=>t.id===row.track.id);
    if(!original||fileIdentity(original)!==fileIdentity(row.track))throw Error('Ein Titel wurde entfernt oder geändert. Export neu öffnen.');
    const file=await ensureFile(original);signal.throwIfAborted();
    if(fileIdentity(file)!==fileIdentity(row.track))throw Error('Die Audiodatei wurde geändert. Export neu öffnen.');
    files.push(file);
   }
   const onProgress=(value,text)=>{if(!dead){q('progress').value=value;status(`${Math.round(value*100)} % · ${text}`);}};
   if(entry.id==='mp4'){
    const {exportQueueVideo}=await import('./queue-video-export.js'),height=Number(q('[data-video-size]').value);
    const result=await exportQueueVideo(schedule,files,{setup:videoSetup,signal,width:height===720?1280:1920,height,onProgress,onTiming:onVideoTiming,onPerformance:showPerformance});
    if(!dead)status('MP4 gespeichert: '+result.name);return;
   }
   const blob=await exportQueueAudio(schedule,files,{signal,format:entry.id,bitrate:Number(q('[data-bitrate]').value),onProgress});
   signal.throwIfAborted();url=URL.createObjectURL(blob);q('[data-download]').href=url;q('[data-download]').download='AnyDj-Mix-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+entry.extension;q('[data-download]').textContent=entry.label+' herunterladen';q('[data-download]').hidden=false;status(entry.label+' bereit · bitte herunterladen.');
  }catch(error){if(!dead)status(error.name==='AbortError'?'Export abgebrochen.':error.message);}
  finally{if(!dead)state(false);}
 };
 q('[data-cancel]').onclick=()=>{controller?.abort();status('Export wird abgebrochen …');};
 q('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dead=true;controller?.abort();if(url)URL.revokeObjectURL(url);window.removeEventListener('beforeunload',beforeLeave);dialog.remove();previous?.isConnected&&previous.focus();},{once:true});
 dialog.showModal();
}


export function createQueueExportMenu(button,getOptions){
 const menu=document.createElement('div');menu.id='queueExportMenu';menu.className='dj-export-menu';menu.setAttribute('popover','auto');menu.setAttribute('aria-label','Playlist exportieren');
 button.textContent='⋯';button.title='Warteschlange exportieren';button.setAttribute('aria-label','Warteschlange exportieren');button.setAttribute('popovertarget',menu.id);button.setAttribute('aria-expanded','false');
 for(const format of exportFormats()){const action=document.createElement('button');action.type='button';action.dataset.exportFormat=format.id;const label=document.createElement('strong'),detail=document.createElement('span');label.textContent='Als '+format.label+' exportieren';detail.textContent=format.description;action.append(label,detail);action.onclick=()=>{menu.hidePopover();button.focus({preventScroll:true});openQueueExport({...getOptions(),format:format.id});};menu.append(action);}
 button.parentElement.append(menu);
 const position=()=>{const {innerWidth,innerHeight}=button.ownerDocument.defaultView;const r=button.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;menu.style.left=Math.max(12,Math.min(r.right-w,innerWidth-w-12))+'px';menu.style.top=Math.max(12,Math.min(r.bottom+h+8<=innerHeight?r.bottom+8:r.top-h-8,innerHeight-h-12))+'px';};
 menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');button.setAttribute('aria-expanded',String(open));if(open){position();menu.querySelector('button').focus({preventScroll:true});}});
 const move=()=>{if(menu.matches(':popover-open'))position();};window.addEventListener('resize',move);document.addEventListener('scroll',move,true);
 // The button and menu can move together into a desktop document.
 const observer=new ResizeObserver(move);observer.observe(button);
 return {destroy(){observer.disconnect();window.removeEventListener('resize',move);document.removeEventListener('scroll',move,true);menu.remove();}};
}
