import {drawWaveform} from './dj-waveform.js';

const time=value=>`${Math.floor(Math.max(0,value)/60)}:${String(Math.floor(Math.max(0,value)%60)).padStart(2,'0')}`;
const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
const setDisabled=(node,value)=>{if(node.disabled!==value)node.disabled=value;};

// A view of the existing decks and mixer; playback stays owned by dj.js.
export function createStageFullTransport(host,{dialog,topControls,canvas,onDeckTools}){
  const section=document.createElement('section');
  section.className='stage-3d-full-transport';section.hidden=true;
  section.setAttribute('aria-label','Decks und Überblendung im Vollbild');
  const deckMarkup=id=>`<article class="stage-3d-mini-deck" data-full-deck="${id}" aria-label="Deck ${id}">
    <div class="stage-3d-mini-heading"><button type="button" class="stage-3d-mini-badge" data-full-deck-tools aria-label="Deck ${id}: Song laden und Tempo einstellen">${id}</button><strong data-full-title>Kein Track geladen</strong><button type="button" class="button" data-full-play disabled aria-label="Deck ${id} abspielen">Play</button></div>
    <div class="stage-3d-mini-timeline"><canvas width="640" height="80" aria-hidden="true"></canvas><input data-full-seek type="range" min="0" max="1" step="0.01" value="0" disabled aria-label="Abspielposition Deck ${id}"></div>
    <div class="stage-3d-mini-clock"><output data-full-position>0:00</output><span data-full-state>Kein Track</span><span data-full-duration>0:00</span></div>
  </article>`;
  section.innerHTML=`${deckMarkup('A')}<div class="stage-3d-mini-mixer">
    <label class="stage-3d-mini-mix-label"><span>A</span><span>Überblendung</span><span>B</span><input data-full-crossfade class="range" type="range" min="0" max="1" step="0.01" value="0" aria-label="Crossfader zwischen Deck A und B"></label>
    <output data-full-mix>A 100 % · B 0 %</output>
    <div class="stage-3d-mini-fade"><label><input data-full-auto type="checkbox"> Auto</label><select data-full-fade-duration aria-label="Dauer der Überblendung"><option value="auto">Automatisch</option><option value="2">2 s</option><option value="4">4 s</option><option value="8">8 s</option><option value="12">12 s</option><option value="20">20 s</option></select><button type="button" class="button" data-full-fade disabled>Überblenden</button></div>
    <label class="stage-3d-mini-profile" hidden>Lichtshow <select data-full-profile aria-label="Lichtshow-Profil"></select></label>
    <p data-full-status></p>
  </div>${deckMarkup('B')}`;
  host.append(section);
  const sizeObserver=new ResizeObserver(()=>host.style.setProperty('--stage-deck-height',section.getBoundingClientRect().height+'px'));sizeObserver.observe(section);
  const q=name=>section.querySelector(`[data-full-${name}]`);
  const cards=[...section.querySelectorAll('[data-full-deck]')].map(element=>({
    element,id:element.dataset.fullDeck,title:element.querySelector('[data-full-title]'),play:element.querySelector('[data-full-play]'),seek:element.querySelector('[data-full-seek]'),
    waveform:element.querySelector('canvas'),position:element.querySelector('[data-full-position]'),duration:element.querySelector('[data-full-duration]'),state:element.querySelector('[data-full-state]')
  }));
  const mixer=section.querySelector('.stage-3d-mini-mixer'),crossfade=q('crossfade'),mix=q('mix'),auto=q('auto'),duration=q('fade-duration'),fade=q('fade'),status=q('status');
  const profile=q('profile'),profileLabel=profile.closest('label');
  const events=new AbortController(),options={signal:events.signal};
  let api=null,active=false,idleTimer=0,updateTimer=0,keyboardFocus=false,hoverPointer=false;
  const pointers=new Set();
  const ownsFocus=()=>section.contains(document.activeElement)||topControls.contains(document.activeElement);
  const hovered=()=>hoverPointer&&(section.matches(':hover')||topControls.querySelector('button')?.matches(':hover'));
  function scheduleHide(){
    clearTimeout(idleTimer);
    if(!active)return;
    idleTimer=setTimeout(()=>{
      if(!dialog.classList.contains('stage-3d-full')||host.querySelector('.stage-3d-workspace.has-tools,.stage-view-menu[open]')||host.querySelector('.stage-view-toolbar')?.contains(document.activeElement)){scheduleHide();return;}
      if(pointers.size||hovered()||document.activeElement===profile||(keyboardFocus&&ownsFocus())){scheduleHide();return;}
      // Return pointer-initiated focus to the scene before hiding its control.
      if(ownsFocus())canvas.focus({preventScroll:true});
      section.inert=true;topControls.inert=true;
      dialog.classList.add('stage-3d-full-idle');
    },3000);
  }
  function reveal(){
    if(!active)return;
    const wasIdle=dialog.classList.contains('stage-3d-full-idle');
    dialog.classList.remove('stage-3d-full-idle');section.inert=false;topControls.inert=false;
    if(wasIdle)update();
    scheduleHide();
  }
  host.addEventListener('stage-tools-change',reveal,options);
  dialog.addEventListener('pointermove',event=>{hoverPointer=event.pointerType==='mouse'||event.pointerType==='pen';reveal();},options);
  dialog.addEventListener('pointerdown',event=>{if(!active)return;keyboardFocus=false;hoverPointer=event.pointerType==='mouse'||event.pointerType==='pen';pointers.add(event.pointerId);reveal();},options);
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{pointers.delete(event.pointerId);if(active)scheduleHide();},options);
  window.addEventListener('blur',()=>{hoverPointer=false;pointers.clear();if(active)scheduleHide();},options);
  dialog.addEventListener('keydown',()=>{keyboardFocus=true;reveal();},{...options,capture:true});
  dialog.addEventListener('focusin',reveal,options);
  dialog.addEventListener('focusout',scheduleHide,options);
  // Keep native Space/arrow behavior in controls; Escape still reaches the dialog.
  section.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation();},options);
  for(const card of cards){
    const edit=card.element.querySelector('[data-full-deck-tools]');edit.title='Song laden und Tempo einstellen';edit.onclick=()=>onDeckTools?.(card.id);
    card.play.onclick=()=>{if(!card.play.disabled){api?.toggle(card.id);update();}};
    card.seek.oninput=()=>{if(!card.seek.disabled){api?.seek(card.id,Number(card.seek.value));update();}};
  }
  crossfade.oninput=()=>{api?.setCrossfade?.(Number(crossfade.value));update();};
  auto.onchange=()=>{api?.setAutoCrossfade?.(auto.checked);update();};
  duration.onchange=()=>{api?.setFadeDuration?.(duration.value);update();};
  profile.onchange=()=>{api?.setShowProfile?.(profile.value);update();};
  fade.onclick=()=>{api?.fade?.();update();};
  function update(){
    if(!active||!api||document.hidden||dialog.classList.contains('stage-3d-full-idle'))return;
    const currentProfile=api.getShowProfile?.();
    if(currentProfile!=null&&profile.value!==currentProfile)profile.value=currentProfile;
    const decks=api.getDecks();
    for(const card of cards){
      const d=decks.find(deck=>deck.id===card.id)||{};
      const position=Math.max(0,Number(d.position)||0),length=Math.max(0,Number(d.duration)||0);
      setText(card.title,d.title||'Kein Track geladen');card.title.title=d.title||'Kein Track geladen';
      setText(card.play,d.playing?'Pause':'Play');setDisabled(card.play,!d.canPlay);
      card.play.setAttribute('aria-label',`Deck ${card.id} ${d.playing?'pausieren':'abspielen'}`);
      card.element.classList.toggle('is-playing',Boolean(d.playing));
      setDisabled(card.seek,!d.canSeek);card.seek.max=length||1;card.seek.value=position;
      card.seek.setAttribute('aria-valuetext',`${time(position)} von ${time(length)}`);
      setText(card.position,time(position));setText(card.duration,time(length));
      setText(card.state,d.playing?'Spielt':d.title?'Pausiert':'Kein Track');
      drawWaveform(card.waveform,d.waveform,position,length,[],card.id==='A'?'#f6ac7b':'#77d2dc');
    }
    const state=api.getMixer?.();mixer.hidden=!state;
    if(state){
      crossfade.value=state.position;setDisabled(crossfade,!state.canCrossfade);
      setText(mix,state.mix);crossfade.setAttribute('aria-valuetext',state.mix);
      auto.checked=state.auto;setDisabled(auto,!state.canAuto);
      duration.value=state.duration;setDisabled(duration,!state.canDuration);
      setDisabled(fade,!state.canFade);setText(fade,state.fading?'Abbrechen':'Überblenden');
      setText(status,state.status||'');status.title=state.status||'';
    }
  }
  function setActive(value){
    active=value;clearTimeout(idleTimer);clearInterval(updateTimer);pointers.clear();keyboardFocus=false;
    section.hidden=!active||!api;section.inert=!active;topControls.inert=false;
    dialog.classList.remove('stage-3d-full-idle');
    if(active){reveal();update();updateTimer=setInterval(update,100);}
  }
  return {
    setApi(value){
      api=value;
      const choices=api?.getShowProfiles?.()||[];
      profile.replaceChildren(...choices.map(choice=>new Option(choice.label,choice.value)));
      profileLabel.hidden=!choices.length;
      section.hidden=!active||!api;update();
    },
    setActive,
    destroy(){setActive(false);sizeObserver.disconnect();events.abort();section.remove();}
  };
}
