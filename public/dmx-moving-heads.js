import {movingDirections} from './dmx-moving-direction.js';
// Visual preview only; these heads do not occupy DMX channels.
import {movingHeadTargets,advanceMovingHeads,followMovingHeads,restingHeads} from './dmx-moving-model.js';
import {createMovingPreparation} from './dmx-moving-plan.js';
import {automaticStage} from './dmx-auto.js';
import {encodeStage,decodeStage} from './dmx-model.js';
const previewEquipment={devices:Array.from({length:4},(_,i)=>({id:`preview-${i}`,type:'spot',cells:1}))};
import {activityAt,movingPresenceAt,movingPresenceLevel,mixMovingPresence} from './dmx-activity.js';
import {projectMovingHeads,movingDevicePoses} from './dmx-layout-model.js';
import {MOVING_MOODS,movingMood} from './dmx-moving-moods.js';
export function createMovingHeads(scene, controls,{getPlans=()=>[],getDevices=null,getLayout=null,getPreviewEnabled=()=>false,onPreview=()=>{},showMoodControl=true,adjustFrame=frame=>frame}={}) {
  const storageKey='anydj-stage-moving-heads';
  let enabled=false,lastTime=null,poses=restingHeads();
  const songTimes=new WeakMap(),directionCache=new WeakMap(),predictionSeconds=.12;
  try{enabled=localStorage.getItem(storageKey)==='true';}catch{}
  let mood='balanced',previousMood='balanced';
  try{mood=movingMood(localStorage.getItem('anydj-moving-mood'));previousMood=mood;}catch{}
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='button secondary';toggle.dataset.movingHeads='';
  toggle.setAttribute('aria-controls','stageMovingHeads');
  toggle.title='Bereitet die Bewegungen deiner Moving Heads pro Lied vor. Ohne Beat-Raster bleiben die Köpfe ruhig.';
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
  let heads=[...row.querySelectorAll('.stage-moving-head')],styles=heads.map(()=>new Map()),deviceSignature='';
  function syncDevices(devices){
    const signature=JSON.stringify(devices.map(d=>[d.id,d.name]));if(signature===deviceSignature)return;deviceSignature=signature;
    const rig=row.querySelector('.stage-moving-rig');rig.replaceChildren();
    for(const [i,d] of devices.entries()){const head=document.createElement('div');head.className='stage-moving-head';head.setAttribute('role','img');head.setAttribute('aria-label',d.name||`Moving Head ${i+1}`);head.innerHTML='<i class="stage-moving-base"></i><div class="stage-moving-yoke"><i class="stage-moving-lens"></i><i class="stage-moving-beam"></i></div>';rig.append(head);}
    heads=[...rig.children];styles=heads.map(()=>new Map());row.setAttribute('aria-label',`${heads.length} virtuelle Moving Heads`);
  }
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
  function prepare(){if((enabled||getPreviewEnabled())&&!disposed)preparation.prepare(getPlans(),mode,mood);}
  function setMood(value){const next=movingMood(value);if(next===mood)return;previousMood=mood;mood=next;moodSelect.value=mood;moodHelp.textContent=MOVING_MOODS[mood].help;try{localStorage.setItem('anydj-moving-mood',mood);}catch{}prepare();}
  moodSelect.onchange=()=>setMood(moodSelect.value);
  function sync(){
    row.hidden=!enabled;scene.dataset.hasMovingHeads=String(enabled);lastTime=null;
    scene.setAttribute('aria-label',enabled?'Moving-Head-Vorschau':'Vorschau statischer Scheinwerfer und Lichtleisten');
    toggle.textContent=enabled?'Moving Heads ausschalten':'Moving Heads einschalten';
    toggle.setAttribute('aria-pressed',String(enabled));
    preparation.setEnabled(enabled||getPreviewEnabled());
    if(!enabled&&!getPreviewEnabled())onPreview([]);
    if(enabled||getPreviewEnabled())queueMicrotask(prepare);
  }
  toggle.onclick=()=>{enabled=!enabled;sync();try{localStorage.setItem(storageKey,String(enabled));}catch{}};
  sync();
  return {
    refresh:sync,
    setMood,
    prepare,
    update(fixtures,frame,time,blackout,streams=[],nextMode='auto',colorLimit=2){
      if(mode!==nextMode){mode=nextMode;prepare();}
      if((!enabled&&!getPreviewEnabled())||document.hidden){lastTime=null;return;}
      const devices=getDevices?.()??Array.from({length:4},(_,i)=>({id:`moving-${i}`}));syncDevices(devices);
      const spots=fixtures.filter(f=>f.profile==='dimmer-rgb');
      let colors=(spots.length?spots:fixtures).flatMap(f=>f.cells);
      // Virtual heads need their own unmasked color source; spot exposure is
      // applied separately from moving presence and must not be inherited.
      // These four virtual heads need a complete formation of their own.
      // Sampling a three/five-spot rig (or a bar) can turn balanced colors into
      // a permanent 3:1 split. Keep the real fixture output untouched.
      if(mode==='auto'&&streams.length){
        const preview=automaticStage(streams,colorLimit,previewEquipment,mode,{movingSource:true});
        const frames=preview.frames.map(cells=>cells.map(frame=>adjustFrame(frame)));
        colors=decodeStage(encodeStage(frames,previewEquipment),previewEquipment).flatMap(f=>f.cells);
      }
      const fallback=!frame||frame.state===false?[0,0,0]:['r','g','b'].map(key=>Math.round(Math.max(0,Math.min(255,Number(frame[key])||0))*Math.max(0,Math.min(100,Number(frame.dimming)||0))/100));
      const lit=!blackout&&[...colors,...fixtures.filter(f=>f.type==='moving').flatMap(f=>f.cells),...(!colors.length?[fallback]:[])].some(rgb=>Math.max(...rgb)>0);
      const prepared=streams.map(s=>s.movingPlan?{...s,movingPose:preparation.read(s.movingPlan,s.songTime,mode,mood)||preparation.read(s.movingPlan,s.songTime,mode,previousMood)||restingHeads()}:{...s,movingMood:mood});
      const hasPlan=prepared.some(s=>s.movingPlan&&s.frame&&s.weight>0);
      // Read the prepared timeline ahead in AUDIO time, including tempo changes.
      // A paused/seeked source never supplies a speculative future movement.
      const elapsed=lastTime===null?0:time-lastTime;
      const aheadSources=prepared.map(s=>{
        if(!s.movingPlan)return s;
        const previous=songTimes.get(s.movingPlan);songTimes.set(s.movingPlan,s.songTime);
        const advance=s.songTime-previous,rate=elapsed>0?advance/elapsed:0;
        const progressing=advance>0&&advance<.3&&rate>=.25&&rate<=4&&s.frame?.state!==false;
        const movingPose=progressing?(preparation.read(s.movingPlan,s.songTime+predictionSeconds*rate,mode,mood)||preparation.read(s.movingPlan,s.songTime+predictionSeconds*rate,mode,previousMood)):null;
        return {...s,movingPose,songTime:progressing?s.songTime+predictionSeconds*rate:s.songTime};
      });
      const aheadTarget=!blackout&&!reducedMotion.matches&&aheadSources.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0).every(s=>s.movingPose)?(movingHeadTargets(aheadSources,mode)||movingHeadTargets(aheadSources.filter(s=>s.movingPlan).map(s=>({...s,frame:s.frame&&s.frame.state!==false?{...s.frame,dimming:100}:s.frame})),mode)):null;

      row.dataset.prepared=String(hasPlan);
      // Keep following a prepared path during musical darkness so the heads
      // reach their next cue before the light returns. Paused decks stay out.
      const target=movingHeadTargets(prepared,mode)||movingHeadTargets(prepared.filter(s=>s.movingPlan).map(s=>({...s,frame:s.frame&&s.frame.state!==false?{...s.frame,dimming:100}:s.frame})),mode);
      if(reducedMotion.matches)poses=restingHeads();
      else if(!blackout&&target&&(lit||hasPlan))poses=(hasPlan?followMovingHeads:advanceMovingHeads)(poses,target,lastTime===null?0:time-lastTime);
      lastTime=time;
      const leader=prepared.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0).sort((a,b)=>b.weight-a.weight)[0];
      const look=leader?.look??leader?.movingPlan?.sections?.find(s=>leader.songTime>=s.start&&leader.songTime<s.end)?.look;
      let designs=leader?.movingPlan&&directionCache.get(leader.movingPlan);
      if(leader?.movingPlan&&(!designs||designs.disco!==(mood==='disco'))){designs={disco:mood==='disco',values:movingDirections(leader.movingPlan,mood==='disco')};directionCache.set(leader.movingPlan,designs);}
      const design=designs?.values.find(d=>d&&leader.songTime>=d.start&&leader.songTime<d.end);
      const calm=leader&&(design?.category==='atmospheric'||leader.motionCharacter==='atmospheric'||['held','quiet','break','outro'].includes(look)||['calm','atmospheric'].includes(mood));
      const mirrored=design?.formation==='mirror';
      // Normal automatic playback uses one rig-wide gesture throughout a song.
      // Switching to repeated pair roles on percussion breaks larger formations.
      const formation=mode==='auto'?((mood==='balanced'||mood==='show')?'designed':mood!=='disco'||calm?'coherent':mirrored?'mirror':null):null;
      const placement={formation,layout:getLayout?.()};
      const devicePoses=movingDevicePoses(poses,devices,placement);
      const projected=getLayout?projectMovingHeads(getLayout(),devicePoses,devices):null;
      const projectedAhead=projected&&aheadTarget?projectMovingHeads(getLayout(),movingDevicePoses(aheadTarget,devices,placement),devices):null;
      row.dataset.layout=String(!!projected);
      const preview=[];
      const exposureSources=!colors.length&&mode==='auto'?streams.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0).map(s=>({weight:s.weight*Math.max(0,s.frame.dimming||0),levels:activityAt(s,heads.length)})):[];
      const exposureTotal=exposureSources.reduce((sum,s)=>sum+s.weight,0);
      const defaultExposure=activityAt({},heads.length);
      const presenceSources=streams.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0);
      const presenceWeight=presenceSources.reduce((sum,s)=>sum+s.weight,0);
      const shutters=mode==='auto'?presenceSources.map(s=>preparation.exposure(s.movingPlan,s.songTime,mode,mood)):[];
      const movingShutter=Math.min(1,...shutters.map(s=>s.level)),cueTransit=shutters.some(s=>s.transfer);
      const movingPresence=mode==='auto'?(presenceWeight?mixMovingPresence(presenceSources.map(s=>({presence:movingPresenceAt({...s,movingMood:mood}),weight:s.weight/presenceWeight}))):streams.length?{level:0,spread:0}:movingPresenceAt({})):null;
      const aheadPresence=projectedAhead&&presenceWeight?mixMovingPresence(aheadSources.filter(s=>s.frame&&s.frame.state!==false&&s.weight>0).map(s=>({presence:movingPresenceAt({...s,movingMood:mood}),weight:s.weight/presenceWeight}))):null;
      const order=heads.map((_,i)=>i).sort((a,b)=>(projected?.[a].position.x??a)-(projected?.[b].position.x??b));
      const ranks=[];order.forEach((i,rank)=>{ranks[i]=rank;});
      heads.forEach((head,i)=>{
        const exposure=mode!=='auto'?1:exposureTotal?exposureSources.reduce((sum,s)=>sum+s.weight*s.levels[i],0)/exposureTotal:defaultExposure[i];
        const own=fixtures.find(f=>f.type==='moving'&&f.id===devices[i].id)?.cells[0];
        const rgb=blackout?[0,0,0]:own?own:colors.length?colors[Math.round(i*(colors.length-1)/Math.max(1,heads.length-1))]:fallback.map(v=>Math.round(v*exposure));
        const basePower=Math.max(...rgb)/255;
        const power=basePower*movingPresenceLevel(movingPresence,ranks[i],heads.length)*movingShutter;
        const color=basePower?rgb.map(v=>Math.round(v/basePower)):rgb;
        const {pan,tilt}=projected?{pan:projected[i].frontPan,tilt:.55+.6*projected[i].tilt/90}:devicePoses[i];
        if(projected)preview.push({...projected[i],motionRange:reducedMotion.matches?0:devices[i].motionRange??1,motionGroup:devices[i].group,motionPresentation:mood==='show'?'show':mood==='balanced'&&mode==='auto'?'auto':undefined,movingShutter,cueTransit,...(movingPresence?{movingPresence,movingPresenceBasePower:basePower}:{}),...(projectedAhead?{motionAhead:{seconds:predictionSeconds,movingPresence:aheadPresence,target:projectedAhead[i].target,motionUV:projectedAhead[i].motionUV,motionFocus:projectedAhead[i].motionFocus}}:{}),color:`rgb(${color.join(',')})`,power});
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
