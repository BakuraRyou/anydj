// Visual preview only; these heads do not occupy DMX channels.
import {movingHeadTargets,advanceMovingHeads,followMovingHeads,restingHeads} from './dmx-moving-model.js';
import {createMovingPreparation} from './dmx-moving-plan.js';
import {activityAt} from './dmx-activity.js';
import {projectMovingHeads} from './dmx-layout-model.js';
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
export function createMovingHeads(scene, controls,{getPlans=()=>[],getLayout=null,onPreview=()=>{},showMoodControl=true}={}) {
  const storageKey='anydj-stage-moving-heads';
  let enabled=false,lastTime=null,poses=restingHeads();
  try{enabled=localStorage.getItem(storageKey)==='true';}catch{}
  let mood='balanced',previousMood='balanced';
  try{mood=movingMood(localStorage.getItem('anydj-moving-mood'));previousMood=mood;}catch{}
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='button secondary';toggle.dataset.movingHeads='';
  toggle.setAttribute('aria-controls','stageMovingHeads');
  toggle.title='Bereitet pro Lied vier Bewegungsspuren vor. Ohne Beat-Raster bleiben die Köpfe ruhig.';
  const row=document.createElement('section');
  row.id='stageMovingHeads';row.className='stage-moving-heads';
  row.setAttribute('aria-label','Vier virtuelle Moving Heads');
  row.innerHTML='<span class="stage-moving-title">MOVING HEADS · SIMULATION</span><div class="stage-moving-rig">'+Array.from({length:4},(_,i)=>`<div class="stage-moving-head" role="img" aria-label="Moving Head ${i+1}"><i class="stage-moving-base"></i><div class="stage-moving-yoke"><i class="stage-moving-lens"></i><i class="stage-moving-beam"></i></div></div>`).join('')+'</div>';
  scene.prepend(row);controls.append(toggle);
  const moodControl=document.createElement('label');moodControl.className='stage-moving-mood';moodControl.dataset.movingMoodControl='';moodControl.append('Grundstimmung · Moving Heads');
  const moodSelect=document.createElement('select');moodSelect.dataset.movingMood='';
  for(const [value,profile] of Object.entries(MOVING_MOODS))moodSelect.add(new Option(profile.name,value));
  moodSelect.value=mood;
  const moodHelp=document.createElement('span');moodHelp.className='small';moodHelp.textContent=MOVING_MOODS[mood].help;
  moodControl.append(moodSelect,moodHelp);if(showMoodControl)controls.append(moodControl);
  const heads=[...row.querySelectorAll('.stage-moving-head')];
  const styles=heads.map(()=>new Map());
  function setStyle(index,key,value){
    if(styles[index].get(key)===value)return;
    styles[index].set(key,value);heads[index].style.setProperty(key,value);
  }
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let mode='auto',disposed=false;
  const title=row.querySelector('.stage-moving-title');
  const preparation=createMovingPreparation({onChange({ready,total,failed}){
    title.textContent=failed?'MOVING HEADS · Vorbereitung teilweise fehlgeschlagen':ready<total?`MOVING HEADS · Vorbereitung ${ready}/${total}`:total?'MOVING HEADS · Choreografie bereit':'MOVING HEADS · SIMULATION';
  }});
  function prepare(){if(enabled&&!disposed)preparation.prepare(getPlans(),mode,mood);}
  function setMood(value){const next=movingMood(value);if(next===mood)return;previousMood=mood;mood=next;moodSelect.value=mood;moodHelp.textContent=MOVING_MOODS[mood].help;try{localStorage.setItem('anydj-moving-mood',mood);}catch{}prepare();}
  moodSelect.onchange=()=>setMood(moodSelect.value);
  function sync(){
    row.hidden=!enabled;scene.dataset.hasMovingHeads=String(enabled);lastTime=null;
    scene.setAttribute('aria-label',enabled?'Moving-Head-Vorschau':'Vorschau statischer Scheinwerfer und Lichtleisten');
    toggle.textContent=enabled?'Moving Heads ausschalten':'Moving Heads einschalten';
    toggle.setAttribute('aria-pressed',String(enabled));
    preparation.setEnabled(enabled);
    if(!enabled)onPreview([]);
    if(enabled)queueMicrotask(prepare);
  }
  toggle.onclick=()=>{enabled=!enabled;sync();try{localStorage.setItem(storageKey,String(enabled));}catch{}};
  sync();
  return {
    setMood,
    prepare,
    update(fixtures,frame,time,blackout,streams=[],nextMode='auto'){
      if(mode!==nextMode){mode=nextMode;prepare();}
      if(!enabled||document.hidden){lastTime=null;return;}
      const spots=fixtures.filter(f=>f.profile==='dimmer-rgb');
      const colors=(spots.length?spots:fixtures).flatMap(f=>f.cells);
      const fallback=!frame||frame.state===false?[0,0,0]:['r','g','b'].map(key=>Math.round(Math.max(0,Math.min(255,Number(frame[key])||0))*Math.max(0,Math.min(100,Number(frame.dimming)||0))/100));
      const lit=!blackout&&(colors.length?colors:[fallback]).some(rgb=>Math.max(...rgb)>0);
      const prepared=streams.map(s=>s.movingPlan?{...s,movingPose:preparation.read(s.movingPlan,s.songTime,mode,mood)||preparation.read(s.movingPlan,s.songTime,mode,previousMood)||restingHeads()}:{...s,movingMood:mood});
      const hasPlan=prepared.some(s=>s.movingPlan&&s.frame&&s.weight>0);
      row.dataset.prepared=String(hasPlan);
      // Keep following a prepared path during musical darkness so the heads
      // reach their next cue before the light returns. Paused decks stay out.
      const target=movingHeadTargets(prepared,mode)||movingHeadTargets(prepared.filter(s=>s.movingPlan).map(s=>({...s,frame:s.frame&&s.frame.state!==false?{...s.frame,dimming:100}:s.frame})),mode);
      if(reducedMotion.matches)poses=restingHeads();
      else if(!blackout&&target&&(lit||hasPlan))poses=(hasPlan?followMovingHeads:advanceMovingHeads)(poses,target,lastTime===null?0:time-lastTime);
      lastTime=time;
      const projected=getLayout?projectMovingHeads(getLayout(),poses):null;
      row.dataset.layout=String(!!projected);
      const preview=[];
      const exposureSources=!colors.length&&mode==='auto'?streams.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0).map(s=>({weight:s.weight*Math.max(0,s.frame.dimming||0),levels:activityAt(s,heads.length)})):[];
      const exposureTotal=exposureSources.reduce((sum,s)=>sum+s.weight,0);
      const defaultExposure=activityAt({},heads.length);
      heads.forEach((head,i)=>{
        const exposure=mode!=='auto'?1:exposureTotal?exposureSources.reduce((sum,s)=>sum+s.weight*s.levels[i],0)/exposureTotal:defaultExposure[i];
        const rgb=blackout?[0,0,0]:colors.length?colors[Math.round(i*(colors.length-1)/(heads.length-1))]:fallback.map(v=>Math.round(v*exposure));
        const power=Math.max(...rgb)/255;
        const color=power?rgb.map(v=>Math.round(v/power)):rgb;
        const {pan,tilt}=projected?{pan:projected[i].frontPan,tilt:.55+.6*projected[i].tilt/90}:poses[i];
        if(projected)preview.push({...projected[i],color:`rgb(${color.join(',')})`,power});
        if(projected)setStyle(i,'--head-position',String((projected[i].position.x/getLayout().width+.5)*100));
        setStyle(i,'--head-pan',`${pan.toFixed(2)}deg`);
        setStyle(i,'--head-tilt',tilt.toFixed(3));
        setStyle(i,'--stage-beam-color',`rgb(${color.join(',')})`);
        setStyle(i,'--stage-power',String(power));
      });
      onPreview(preview);
    },
    destroy(){disposed=true;preparation.destroy();row.remove();toggle.remove();moodControl.remove();},
  };
}
