import {transitionAudioGains,scheduleTransitionGain} from './transition-audio.js';
import {transitionBassDb} from './musical-transition.js';
import {formatTime} from './dj-model.js';

// Own media elements and context: rehearsal never seeks or starts either deck.
export function createTransitionPreview({host,getPair,isPlaying,onChoose}){
 const button=document.createElement('button');button.type='button';button.className='button secondary transition-preview-open';button.textContent='Übergang ansehen & probehören';host.append(button);
 const dialog=document.createElement('dialog');dialog.className='dj-transition-preview';
 dialog.innerHTML=`<form method="dialog"><button class="button secondary" aria-label="Vorschau schließen">Schließen</button></form><h2>Übergangsvorschau</h2><p data-tracks></p><label>Vorschlag <select data-alternative aria-label="Übergangsvariante"></select></label><label class="small"><input type="checkbox" data-remember> Ähnliche Übergänge künftig leicht bevorzugen</label><button data-choose class="button secondary">Für Automatik übernehmen</button><p data-timing></p><p data-reason></p><svg viewBox="0 0 500 140" role="img" aria-label="Lautstärkeverlauf: alter Titel wird leiser, neuer Titel lauter"><path d="M20 10V115H480" fill="none" stroke="#526471"/><path data-out fill="none" stroke="#f7ad76" stroke-width="3"/><path data-in fill="none" stroke="#79ced8" stroke-width="3"/><line data-cursor x1="20" x2="20" y1="10" y2="115" stroke="white"/><text x="20" y="135" fill="currentColor">Start</text><text x="445" y="135" fill="currentColor">Ende</text></svg><p class="small">Orange: ausgehender Titel · Türkis: nächster Titel</p><p data-bass class="small"></p><label>Verlauf erkunden <input data-position type="range" min="0" max="100" value="0" step="1"></label><p data-position-label class="small"></p><p class="small">Hörprobe über den Systemausgang bei pausierten Decks. Sie beginnt bis zu zwei Sekunden vor dem geplanten Übergang und endet zwei Sekunden danach. Deck-EQ und Kanalpegel werden übernommen.</p><div class="preview-actions"><button data-play class="button primary">Hörprobe starten</button><button data-stop class="button secondary" disabled>Stoppen</button><label>Probelautstärke <input data-volume type="range" min="0" max="1" step="0.01" value="0.5"></label></div><p data-status role="status"></p>`;
 document.body.append(dialog);const q=s=>dialog.querySelector(s);
 let pair=null,job=null,version=0,alternatives=[];
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
  q('[data-stop]').disabled=true;q('[data-play]').disabled=!pair;q('[data-position]').disabled=false;q('[data-status]').textContent=message;
 }
 function render(){
  q('[data-play]').disabled=!pair;
  for(const selector of ['[data-out]','[data-in]'])q(selector).setAttribute('d','');
  if(pair){
   const {from,to,plan}=pair;
   q('[data-tracks]').textContent=`${from.name}: ${from.track.name} → ${to.name}: ${to.track.name}`;
   q('[data-timing]').textContent=`${plan.label||'Sanfter Übergang'} · ${plan.duration.toFixed(1)} Sekunden · Ausstieg ${formatTime(plan.time)} · Einstieg ${formatTime(plan.cue)} · Tempo bleibt unverändert`;
   q('[data-reason]').textContent=(plan.reason||'Noch keine vollständige Paaranalyse: Übergang nach Zeit und verfügbarem Taktraster.')+(plan.audioProfile?' · RMS-gestützter Kurvenausgleich: bis zu 2 dB während der Überlagerung.':'');
   q('[data-bass]').textContent=plan.style==='bass'?'Bassübergabe: Zuerst wird der alte Bass abgesenkt. Ab der Mitte kommt der neue Bass hinzu.':plan.style==='cut'?'Kurzer Wechsel: Die Titel überlappen nur für einen kurzen, geglätteten Wechsel.':plan.style==='handover'?'Kurze Überlagerung: Der hörbare Wechsel findet zwischen 30 % und 70 % der Übergangsdauer statt.':'Beide Titel werden gleichmäßig ineinander überblendet.';
   for(const [selector,incoming] of [['[data-out]',false],['[data-in]',true]])q(selector).setAttribute('d',Array.from({length:101},(_,i)=>{const gains=transitionAudioGains(i/100,plan,audioOptions(pair));return `${i?'L':'M'}${20+i*4.6},${115-100*gains[incoming?1:0]}`;}).join(' '));
  }else{
   q('[data-tracks]').textContent='Zwei lokale Titel laden, um einen Übergang anzusehen.';
   for(const selector of ['[data-timing]','[data-reason]','[data-bass]'])q(selector).textContent='';
  }
  position(0);
 }
 function open(){
  stop('');pair=getPair();alternatives=pair?(pair.plan.alternatives||[pair.plan]):[];
  q('[data-alternative]').replaceChildren(...alternatives.map((p,i)=>new Option(`${i===0?'Empfehlung: ':''}${p.label} · ${p.duration.toFixed(1)} s · bei ${formatTime(p.time)} → ${formatTime(p.cue)}`,String(i))));
  if(pair){const selected=alternatives.findIndex(p=>p.time===pair.plan.time&&p.cue===pair.plan.cue&&p.style===pair.plan.style&&p.duration===pair.plan.duration);q('[data-alternative]').value=String(Math.max(0,selected));}
  q('[data-choose]').disabled=!pair||alternatives.length<2;
  render();q('[data-status]').textContent=isPlaying()?'Zum Probehören beide Decks pausieren. Die Grafik kannst du bereits erkunden.':'';dialog.showModal();
 }
 q('[data-alternative]').onchange=()=>{stop('');if(pair){pair.plan=alternatives[+q('[data-alternative]').value];render();}};
 q('[data-choose]').onclick=()=>{
  stop('');q('[data-status]').textContent=onChoose?.(pair,pair.plan,q('[data-remember]').checked)?'Variante für diesen Übergang übernommen.':'Plan inzwischen geändert oder Zeitpunkt verstrichen. Vorschau bitte erneut öffnen.';
 };
 const waitMedia=(audio,event,ready)=>ready()?Promise.resolve():new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);audio.removeEventListener(event,done);audio.removeEventListener('error',fail);};
  const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Audiodatei konnte nicht für die Hörprobe geladen werden.'));};
  const timer=setTimeout(fail,10000);audio.addEventListener(event,done,{once:true});audio.addEventListener('error',fail,{once:true});
 });
 async function play(){
  if(!pair||isPlaying()){q('[data-status]').textContent='Zum Probehören beide Decks pausieren.';return;}
  stop('Hörprobe wird vorbereitet …');const token=version;const snapshot=pair;
  const ctx=new AudioContext(),audio=[new Audio(),new Audio()];job={ctx,audio};
  job.timer=setInterval(()=>{if(isPlaying())stop('Hörprobe beendet: Ein Deck läuft.');},30);
  const master=ctx.createGain();master.gain.value=+q('[data-volume]').value;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(ctx.destination);job.master=master;
  q('[data-play]').disabled=true;q('[data-stop]').disabled=false;q('[data-position]').disabled=true;
  try{
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
   if(token!==version)return;if(isPlaying())throw Error('Hörprobe beendet: Ein Deck läuft.');
   nodes[0].gain.gain.value=nodes[0].volume;
   await audio[0].play();if(token!==version)return;
   q('[data-status]').textContent='Hörprobe: Vorlauf zum Wechsel …';
   const lead=Math.min(2,snapshot.plan.time/snapshot.from.rate);
   await new Promise(resolve=>setTimeout(resolve,lead*1000));
   if(token!==version)return;if(isPlaying())throw Error('Hörprobe beendet: Ein Deck läuft.');
   await audio[1].play();if(token!==version)return;
   const start=ctx.currentTime,duration=snapshot.plan.duration;
   nodes.forEach(({gain,bass,volume},i)=>{
    scheduleTransitionGain(gain.gain,Float32Array.from({length:257},(_,n)=>transitionAudioGains(n/256,snapshot.plan,audioOptions(snapshot))[i]*volume),start,duration);
    if(snapshot.plan.style==='bass')bass.gain.setValueCurveAtTime(Float32Array.from({length:257},(_,n)=>transitionBassDb(n/256,Boolean(i))),start,duration);
   });
   q('[data-status]').textContent='Hörprobe läuft · Systemausgang';
   clearInterval(job.timer);job.timer=setInterval(()=>{
    if(isPlaying()){stop('Hörprobe beendet: Ein Deck läuft.');return;}
    const elapsed=ctx.currentTime-start;position(Math.min(100,elapsed/duration*100));
    if(elapsed>=duration)audio[0].pause();
    if(elapsed>=duration+2||audio[1].ended)stop('Hörprobe beendet. Du kannst sie erneut anhören.');
   },30);
  }catch(e){if(token===version)stop(e.message);}
 }
 button.onclick=open;q('[data-play]').onclick=play;q('[data-stop]').onclick=()=>stop();
 q('[data-position]').oninput=e=>position(+e.target.value);
 q('[data-volume]').oninput=()=>{if(job)job.master.gain.setTargetAtTime(+q('[data-volume]').value,job.ctx.currentTime,.02);};
 dialog.addEventListener('close',()=>stop(''));window.addEventListener('pagehide',()=>stop(''),{once:true});
 return {stop};
}
