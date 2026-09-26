import {createRoomMotors} from './dmx-light-geometry.js';
import {roomMusicalAim,respectRoomVolumes,alignRoomFormation} from './dmx-ar-model.js';
import {createMovingPreview} from './dmx-vr-playback.js';
import {createARPlanner} from './dmx-ar-planner.js';
import {createVRShare} from './dmx-vr-share.js';
import {createVRSetup} from './dmx-vr-setup.js';
import {createStageVR} from './dmx-stage-vr.js';
import {createZoneMotion} from './dmx-zone-motion.js';
import {createZonePlan,zoneLights} from './dmx-zone-plan.js';
import {createStageWorkspace} from './dmx-stage-workspace.js';
import {createRoomSettings,roomLayout,roomLights} from './dmx-room.js';
import {createStageTransport} from './dmx-stage-transport.js';
import {createStageFullTransport} from './dmx-stage-full.js';
import {fixturePosition} from './dmx-layout-model.js';
// Optional preview adapter. Remove this module and its hooks in dmx-stage.js
// to remove the feature. The renderer is loaded only on first activation.
export function createStage3d(host,controls,{getLayout,mountLighting,onFixturePosition,getFixtureAims,setFixtureAim,onZonePlan,onToggle=()=>{},onShareChange=()=>{}}){
  const arStylesheet=document.createElement('link');arStylesheet.rel='stylesheet';arStylesheet.href=new URL('./dmx-ar.css',import.meta.url).href;document.head.append(arStylesheet);
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./dmx-stage-3d.css',import.meta.url).href;document.head.append(stylesheet);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='button secondary';toggle.dataset.stage3dToggle='';toggle.textContent='3D-Bühne einschalten';toggle.setAttribute('aria-pressed','false');controls.append(toggle);
  const panel=document.createElement('section');panel.className='stage-3d';panel.hidden=true;panel.setAttribute('aria-label','3D-Bühnenvorschau');
  panel.innerHTML=`<div class="stage-3d-heading"><strong>3D-Bühne <small>Simulation</small></strong><button type="button" class="button secondary" data-stage3d-full aria-haspopup="dialog" aria-pressed="false">Full</button><button type="button" class="button secondary" data-stage3d-expand>Große Ansicht</button><button type="button" class="button secondary" data-camera="reset">Kamera zurücksetzen</button></div><canvas tabindex="0" role="img" aria-label="Räumliche Lichtbühne. Mit Linksziehen oder Alt plus Pfeiltasten drehen, mit Rechtsziehen verschieben, mit Mausrad, Plus und Minus vorwärts oder rückwärts bewegen."></canvas><div class="stage-3d-full-controls" hidden><span>FULL · Esc zum Verlassen</span><button type="button" class="button secondary" data-stage3d-full-close>Full schließen</button></div><div class="stage-3d-tools"><button type="button" class="button secondary" data-camera="front">Publikum</button><button type="button" class="button secondary" data-camera="top">Draufsicht</button><button type="button" class="button secondary" data-camera="in" aria-label="Vorwärts bewegen">+</button><button type="button" class="button secondary" data-camera="out" aria-label="Rückwärts bewegen">−</button><button type="button" class="button secondary" data-dancer aria-pressed="false">Auf die Tanzfläche</button><span data-camera-help>Links ziehen: drehen · Rechts ziehen: verschieben · Mausrad / + / −: vor / zurück</span></div><fieldset class="stage-3d-dancer" hidden><legend>Dein Standort auf der Tanzfläche</legend><svg data-dancer-map viewBox="0 0 240 140" role="img" aria-label="Standort wählen: Bühne oben, Tanzfläche darunter"><rect x="10" y="4" width="220" height="25" rx="3" fill="#476174"/><text x="120" y="21" text-anchor="middle" fill="#edf6fa">BÜHNE</text><rect x="10" y="34" width="220" height="96" rx="3" fill="#183b42" stroke="#638891"/><path data-dancer-direction fill="none" stroke="#9ee7d6" stroke-width="2"/><circle data-dancer-dot r="5" fill="#b8ffe6"/></svg><div class="stage-3d-location"><label>Links / rechts <input data-dancer-x type="range" step="0.1" value="0"></label><label>Abstand zur Bühne <input data-dancer-distance type="range" min="0.4" step="0.1" value="3"></label><label>Augenhöhe <select data-dancer-height><option value="1.2">1,20 m</option><option value="1.5">1,50 m</option><option value="1.7" selected>1,70 m</option><option value="1.9">1,90 m</option></select></label><output data-dancer-position></output></div><div class="stage-3d-walk"><button type="button" class="button secondary" data-walk="forward">Vorwärts</button><button type="button" class="button secondary" data-walk="back">Zurück</button><button type="button" class="button secondary" data-walk="left">Schritt links</button><button type="button" class="button secondary" data-walk="right">Schritt rechts</button></div><label class="stage-3d-aim"><input type="checkbox" data-dancer-aim> Moving Heads auf die Tanzfläche richten · nur diese Vorschau</label></fieldset><p role="status">Vereinfachte Lichtvorschau · Aufbau aus „Bühne & Geräte aufstellen“</p>`;
  const scene=host.querySelector('.stage-scene');
  if(scene)scene.after(panel);else host.append(panel);
  const marker=document.createComment('stage-3d-home');panel.before(marker);
  const dialog=document.createElement('dialog');dialog.className='stage-3d-dialog';dialog.setAttribute('aria-label','Große 3D-Bühnenvorschau');document.body.append(dialog);
  const expand=panel.querySelector('[data-stage3d-expand]');
  const fullButton=panel.querySelector('[data-stage3d-full]'),fullControls=panel.querySelector('.stage-3d-full-controls');
  let workspace=null,vr=null,share=null,planner=null;
  let full=false,returnExpanded=false,returnFocus=expand;
  const transport=createStageTransport(panel,{isVisible:()=>dialog.open});
  const fullTransport=createStageFullTransport(panel,{dialog,topControls:fullControls,canvas:panel.querySelector('canvas'),onDeckTools:id=>{transport.vrCommand({action:'select',deck:id});workspace.show('music');}});
  dialog.addEventListener('keydown',event=>{if(event.target===canvas&&navigateKey(event))return;if(event.target.closest('[data-layout-map],.light-editor,.stage-ar-planner,.stage-3d-inspector,.stage-3d-tool-tabs,.stage-3d-full-transport,.stage-3d-full-controls'))return;transport.handleShortcut(event);if(event.defaultPrevented)event.stopPropagation();},{capture:true});
  function leaveFull(){
    stopWalking();
    full=false;fullTransport.setActive(returnExpanded);dialog.classList.remove('stage-3d-full');fullControls.hidden=true;fullButton.setAttribute('aria-pressed','false');fullButton.textContent='Vollbild';
    if(returnExpanded){fullButton.focus();requestDraw();}else dialog.close();
  }
  fullButton.onclick=()=>{
    if(full){leaveFull();return;}returnFocus=fullButton;
    returnExpanded=dialog.open;full=true;
    dialog.classList.add('stage-3d-full');fullControls.hidden=false;fullControls.querySelector('span').textContent=camera.mode==='dancer'?'WASD: gehen · Links ziehen: umsehen · Rechts ziehen: verschieben · Mausrad: vor / zurück · Esc: Vollbild verlassen':'Mausrad: vor / zurück · Links ziehen: drehen · Rechts ziehen: verschieben · Esc: Vollbild verlassen';fullButton.setAttribute('aria-pressed','true');fullButton.textContent='Fensteransicht';
    if(!dialog.open){dialog.append(panel);expand.textContent='Schließen';dialog.showModal();}
    dialog.scrollTop=0;canvas.focus({preventScroll:true});fullTransport.setActive(true);requestDraw();
  };
  panel.querySelector('[data-stage3d-full-close]').onclick=leaveFull;
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(full)leaveFull();else dialog.close();});
  expand.onclick=()=>{returnFocus=expand;if(dialog.open){dialog.close();return;}dialog.append(panel);expand.textContent='Schließen';dialog.showModal();fullTransport.setActive(true);requestDraw();};
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();if(workspace?.dismiss())return;if(full)leaveFull();else dialog.close();}});
  dialog.addEventListener('close',()=>{void vr?.stop();stopWalking();if(disposed)return;workspace?.close();full=false;fullTransport.setActive(false);dialog.classList.remove('stage-3d-full');fullControls.hidden=true;fullButton.setAttribute('aria-pressed','false');fullButton.textContent='Vollbild';marker.after(panel);expand.textContent='Große Ansicht';returnFocus.focus();requestDraw();});
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d'),status=panel.querySelector('[role=status]');
  let enabled=false,disposed=false,visible=true,renderer=null,graphics=null,moveCamera=null,loading=null,raf=0,viewportSize=null,lights=[],moving=[],drag=null;
  const room=createRoomSettings(panel,{getLayout,onChange:()=>{if(room.value.enabled){dancer.y=Math.max(.15,dancer.y);q('dancer-aim').checked=false;}syncDancer();requestDraw();}});
  const viewLayout=()=>planner?.layout||(room.value.enabled?roomLayout(room.value):{...getLayout(),environmentBrightness:room.value.environmentBrightness});
  const roomMotors=createRoomMotors(),zoneMotion=createZoneMotion(),movingFrames=createMovingPreview();
  const zones=createZonePlan(panel,{getAims:getFixtureAims,onAim:setFixtureAim,getLayout:viewLayout,onPosition:(id,p)=>{const source=getLayout();onFixturePosition?.(id,{x:(p.x-.5)*source.width,y:p.y*source.depth});},onChange:()=>requestDraw()});
  const initial=()=>({yaw:.32,pitch:.55,zoom:1});let camera=initial(),overview=initial();
  const cameraKey='anydj-3d-camera-v1';let cameraSaveTimer=null,cameraStorageReady=false,lastCameraSave='';
  function cleanCamera(value,ego=false){
    const keys=ego?['x','y','eyeHeight','yaw','pitch','zoom']:['yaw','pitch','zoom'];
    if(!value||keys.some(key=>!Number.isFinite(value[key])||Math.abs(value[key])>100000)||value.zoom<=0)return null;
    const result=Object.fromEntries(keys.map(key=>[key,value[key]]));
    if(ego)result.mode='dancer';
    else if(value.eye!==undefined){if(!Array.isArray(value.eye)||value.eye.length!==3||value.eye.some(v=>!Number.isFinite(v)||Math.abs(v)>100000))return null;result.eye=[...value.eye];}
    return result;
  }
  function saveCamera(){
    clearTimeout(cameraSaveTimer);cameraSaveTimer=null;
    if(!cameraStorageReady)return;
    const value=JSON.stringify({version:1,ego:camera.mode==='dancer',overview:cleanCamera(camera.mode==='dancer'?overview:camera),dancer:cleanCamera(dancer,true)});
    if(value===lastCameraSave)return;
    try{localStorage.setItem(cameraKey,value);lastCameraSave=value;}catch{} // Browsers may disable local storage.
  }
  function queueCameraSave(){if(cameraStorageReady&&cameraSaveTimer===null)cameraSaveTimer=setTimeout(saveCamera,250);}

  onZonePlan?.(zones);
  const dancer={mode:'dancer',x:0,y:room.value.enabled?room.value.depth*.25:-Math.min(3,getLayout().depth),eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
  const controlCache=new Map(),q=name=>{if(!controlCache.has(name))controlCache.set(name,panel.querySelector(`[data-${name}]`));return controlCache.get(name);},dancerButton=q('dancer'),dancerTools=panel.querySelector('.stage-3d-dancer');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const walkingKeys=new Set();let lastWalkTime=0,fastWalk=false;
  function stopWalking(){walkingKeys.clear();lastWalkTime=0;fastWalk=false;}
  let crowdMotion=null,music={};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let crowdEnabled=false,placingPeople=false,crowdMapLayout='';
  let crowd=Array.from({length:8},(_,i)=>({x:.15+(i%4)*.23,y:.25+Math.floor(i/4)*.48}));
  const crowdButton=document.createElement('button');crowdButton.type='button';crowdButton.className='button secondary';crowdButton.dataset.crowdToggle='';crowdButton.hidden=true;crowdButton.textContent='Tanzende Gäste';crowdButton.setAttribute('aria-pressed','false');
  const placeButton=document.createElement('button');placeButton.type='button';placeButton.className='button secondary';placeButton.dataset.crowdPlace='';placeButton.hidden=true;placeButton.textContent='Gäste platzieren';
  panel.querySelector('.stage-3d-tools').append(crowdButton,placeButton);
  const crowdTools=document.createElement('div');crowdTools.hidden=true;crowdTools.className='stage-3d-crowd-tools';
  crowdTools.innerHTML='<p data-crowd-note role="status"></p><button type="button" class="button secondary" data-crowd-clear>Alle Gäste entfernen</button><button type="button" class="button secondary" data-crowd-done>Platzieren beenden</button>';
  dancerTools.prepend(crowdTools);
  const dots=document.createElementNS('http://www.w3.org/2000/svg','g');dots.dataset.crowdDots='';dots.setAttribute('pointer-events','none');q('dancer-map').append(dots);
  function syncCrowd(){
    const mapLayout=viewLayout();crowdMapLayout=`${mapLayout.width}/${mapLayout.depth}/${!!mapLayout.room}`;
    crowdButton.setAttribute('aria-pressed',String(crowdEnabled));placeButton.hidden=!crowdEnabled;
    crowdTools.hidden=!placingPeople;
    q('crowd-note').textContent=`${crowd.length} / 12 Gäste · Im Plan tippen, um einen Gast hinzuzufügen. Auf einen vorhandenen Gast tippen, um ihn zu entfernen.`;
    dots.replaceChildren();
    if(crowdEnabled){
      const layout=viewLayout(),depth=layout.room?layout.depth:Math.max(4,layout.depth);
      for(const person of crowd){
        const px=(person.x-.5)*Math.max(0,layout.width-1.2),distance=.6+person.y*Math.max(0,depth-1.2);
        const dot=document.createElementNS(dots.namespaceURI,'circle');dot.setAttribute('cx',10+(px/layout.width+.5)*220);dot.setAttribute('cy',34+(layout.room?1-distance/depth:distance/depth)*96);dot.setAttribute('r','4');dot.setAttribute('fill','#ffd3a5');dots.append(dot);
      }
    }
  }
  crowdButton.onclick=()=>{crowdEnabled=!crowdEnabled;placingPeople=false;syncCrowd();requestDraw();};
  placeButton.onclick=()=>{if(camera.mode!=='dancer')setDancer(true);placingPeople=true;workspace.show('position');syncCrowd();};
  q('crowd-clear').onclick=()=>{crowd=[];syncCrowd();requestDraw();};
  q('crowd-done').onclick=()=>{placingPeople=false;syncCrowd();};
  function syncDancer(){
    const layout=viewLayout(),club=!!layout.room,depth=club?layout.depth:Math.max(4,layout.depth),half=layout.width/2;
    const heightSelect=q('dancer-height');
    if(![...heightSelect.options].some(o=>Number(o.value)===dancer.eyeHeight)){
      let free=heightSelect.querySelector('[data-free-height]');
      if(!free){free=document.createElement('option');free.dataset.freeHeight='';heightSelect.append(free);}
      free.value=String(dancer.eyeHeight);free.textContent=`${dancer.eyeHeight.toFixed(2)} m (frei)`;
    }
    heightSelect.value=String(dancer.eyeHeight);
    q('dancer-x').min=Math.min(-half+.15,dancer.x);q('dancer-x').max=Math.max(half-.15,dancer.x);q('dancer-x').value=dancer.x;
    q('dancer-distance').min=Math.min(club?.15:.4,club?dancer.y:-dancer.y);q('dancer-distance').max=Math.max(depth-.15,club?dancer.y:-dancer.y);q('dancer-distance').value=club?dancer.y:-dancer.y;
    q('dancer-distance').parentElement.firstChild.textContent=club?'Abstand zur Vorderwand ':'Abstand zur Bühne ';
    q('dancer-map').querySelector('text').textContent=club?'RAUM HINTEN':'BÜHNE';
    q('dancer-map').setAttribute('aria-label',club?'Standort im gemeinsamen Raum wählen':'Standort wählen: Bühne oben, Tanzfläche darunter');
    q('dancer-aim').closest('label').hidden=club;
    q('dancer-position').textContent=`${dancer.x.toFixed(1)} m seitlich · ${(club?dancer.y:-dancer.y).toFixed(1)} m ${club?'von vorne':'vor der Bühne'}`;
    const x=10+(dancer.x/ layout.width+.5)*220,y=34+(club?1-dancer.y/depth:-dancer.y/depth)*96;
    q('dancer-dot').setAttribute('cx',x);q('dancer-dot').setAttribute('cy',y);
    q('dancer-direction').setAttribute('d',`M ${x} ${y} l ${-Math.sin(dancer.yaw)*16} ${-Math.cos(dancer.yaw)*16}`);
    if(crowdMapLayout!==`${layout.width}/${layout.depth}/${club}`)syncCrowd();
  }
  function setDancer(value){
    stopWalking();
    if(!value){placingPeople=false;syncCrowd();}
    if(value){overview={...camera};camera=dancer;syncDancer();}else camera={...overview};
    dancerTools.hidden=!value;dancerButton.setAttribute('aria-pressed',String(value));dancerButton.textContent='Im Raum';dancerButton.setAttribute('aria-label',value?'Ego-Perspektive verlassen':'Raum aus der Ego-Perspektive ansehen');
    for(const b of panel.querySelectorAll('[data-camera=front],[data-camera=top]'))b.setAttribute('aria-pressed',String(!value&&b.dataset.camera===(camera.pitch>1.4?'top':'front')));
    q('camera-help').textContent=value?'3D anklicken · WASD / Pfeile: gehen · Links ziehen: umsehen · Rechts ziehen: verschieben · Mausrad: vor / zurück · Umschalt: schneller':'Links ziehen: drehen · Rechts ziehen: verschieben · Mausrad / + / −: vor / zurück';
    canvas.setAttribute('aria-label',value?'Blick von der Tanzfläche. Linksziehen zum Umsehen, Rechtsziehen zum Verschieben. WASD oder Pfeiltasten zum Gehen, Umschalt für schnelleres Gehen, Mausrad für vor und zurück.':'Räumliche Lichtbühne. Linksziehen oder Alt plus Pfeiltasten zum Drehen, Rechtsziehen zum Verschieben, Plus und Minus zum Vorwärts- und Rückwärtsbewegen.');
    for(const action of ['in','out'])panel.querySelector(`[data-camera=${action}]`).disabled=false;
    workspace?.show(value?'position':'');
    requestDraw();
  }
  dancerButton.textContent='Im Raum';dancerButton.setAttribute('aria-label','Raum aus der Ego-Perspektive ansehen');
  dancerButton.onclick=()=>{setDancer(camera.mode!=='dancer');canvas.focus({preventScroll:true});};
  q('dancer-map').onpointerdown=e=>{
    const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*240,y=(e.clientY-r.top)/r.height*140;
    if(x<10||x>230||y<34||y>130)return;
    const layout=viewLayout(),depth=layout.room?layout.depth:Math.max(4,layout.depth);
    const px=((x-10)/220-.5)*layout.width,distance=(layout.room?1-(y-34)/96:(y-34)/96)*depth;
    if(placingPeople){
      const index=[...dots.children].findIndex(dot=>Math.hypot(Number(dot.getAttribute('cx'))-x,Number(dot.getAttribute('cy'))-y)<8);
      if(index>=0)crowd.splice(index,1);
      else if(crowd.length<12)crowd.push({x:clamp(px/Math.max(.1,layout.width-1.2)+.5,0,1),y:clamp((distance-.6)/Math.max(.1,depth-1.2),0,1)});
      syncCrowd();requestDraw();return;
    }
    dancer.x=px;dancer.y=layout.room?distance:-distance;syncDancer();requestDraw();
  };
  q('dancer-x').oninput=e=>{dancer.x=Number(e.target.value);syncDancer();requestDraw();};
  q('dancer-distance').oninput=e=>{dancer.y=(viewLayout().room?1:-1)*Number(e.target.value);syncDancer();requestDraw();};
  q('dancer-height').onchange=e=>{dancer.eyeHeight=Number(e.target.value);requestDraw();};
  q('dancer-aim').onchange=()=>{status.textContent=q('dancer-aim').checked?'Moving Heads auf Tanzfläche · abweichende Lichtziele nur in dieser 3D-Vorschau':'Vereinfachte Lichtvorschau · Aufbau aus „Bühne & Geräte aufstellen“';requestDraw();};
  function walk(action){
    const forward=action==='forward'?.35:action==='back'?-.35:0,right=action==='right'?.35:action==='left'?-.35:0;
    moveDancer(forward,right);requestDraw();
  }
  function moveDancer(forward,right){
    dancer.x+=-Math.sin(dancer.yaw)*forward+Math.cos(dancer.yaw)*right;
    dancer.y+=Math.cos(dancer.yaw)*forward+Math.sin(dancer.yaw)*right;syncDancer();
  }
  panel.querySelectorAll('[data-walk]').forEach(b=>b.onclick=()=>walk(b.dataset.walk));
  let resolution=1.5,renderAverage=0,slowFrames=0,fastFrames=0;
  const requestDraw=()=>{queueCameraSave();if(!disposed&&enabled&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);};
  function draw(){
    raf=0;if(vr?.active||!enabled||disposed||!visible||document.hidden||!renderer||!ctx)return;
    transport.update();
    const {width,height}=viewportSize||canvas.getBoundingClientRect();if(!width||!height)return;
    const scale=Math.min(window.devicePixelRatio||1,resolution);
    if(canvas.width!==Math.round(width*scale)||canvas.height!==Math.round(height*scale)){canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);}
    if(camera.mode==='dancer'){
      if(walkingKeys.size){
        const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastWalkTime)/1000));lastWalkTime=now;
        const forward=Number(walkingKeys.has('forward'))-Number(walkingKeys.has('back')),right=Number(walkingKeys.has('right'))-Number(walkingKeys.has('left'));
        const distance=(fastWalk?3:1.5)*dt/(Math.hypot(forward,right)||1);moveDancer(forward*distance,right*distance);
      }else syncDancer();
    }
    const scene=vrScene(performance.now()/1000);
    const renderStart=performance.now();
    ctx.setTransform(scale,0,0,scale,0,0);renderer(ctx,width,height,scene.layout,scene.lights,camera,scene.crowd,scene.motion);
    renderAverage=renderAverage*.9+(performance.now()-renderStart)*.1;
    slowFrames=renderAverage>16?slowFrames+1:0;fastFrames=renderAverage<8?fastFrames+1:0;
    // Hysteresis keeps quality stable; only rendering resolution changes, never show timing.
    if(slowFrames>=30&&resolution>.75){resolution=Math.max(.75,Math.min(scale,resolution)-.25);slowFrames=fastFrames=0;}
    else if(fastFrames>=180&&resolution<1.5){resolution=Math.min(1.5,resolution+.25);slowFrames=fastFrames=0;}
    if(walkingKeys.size||planner?.active&&planner.moving||roomMotors.active()||movingFrames.active(performance.now()))requestDraw();
  }
  function vrScene(now,raw=false,interpolate=true){
    const heads=interpolate?movingFrames.sample(performance.now()):moving;
    const layout=getLayout(),previewMoving=q('dancer-aim').checked?heads.map(h=>({...h,target:{x:h.target.x,y:-Math.max(4,layout.depth)*(.1+.8*h.target.y/layout.depth)},...(h.motionAhead?{motionAhead:{...h.motionAhead,target:{x:h.motionAhead.target.x,y:-Math.max(4,layout.depth)*(.1+.8*h.motionAhead.target.y/layout.depth)}}}:{})})):heads;
    const mapped=planner?.active?[...lights,...heads]:room.value.enabled?roomLights([...lights,...heads],layout,room.value):[...lights,...previewMoving];
    if(!vr?.active)zones.update(mapped);
    const view=viewLayout();
    if(planner?.active){const result={layout:{...layout},lights:mapped,crowd:crowdEnabled?crowd:[],motion:reducedMotion.matches?0:(crowdEnabled&&crowdMotion?crowdMotion(music,now):0)};return raw?result:planner.scene(result);}
    const result={layout:{...view,positions:layout.positions,zones:zones.value.zones},lights:zoneMotion.update(mapped.map(light=>light.type==='moving'?light:zoneLights([light],view,zones.value)[0]),view,zones.value,now),crowd:crowdEnabled?crowd:[],motion:reducedMotion.matches?0:(crowdEnabled&&crowdMotion?crowdMotion(music,now):0)};
    result.lights=alignRoomFormation(result.lights.map(light=>q('dancer-aim').checked?light:roomMusicalAim(light,result.layout)),result.layout).map(light=>respectRoomVolumes(roomMotors(light,result.layout,now),result.layout));
    return raw?result:planner?.scene(result)||result;
  }
  async function activate(value=!enabled,{expandView=true}={}){
    enabled=value;panel.hidden=!enabled;toggle.textContent=enabled?'3D-Bühne ausschalten':'3D-Bühne einschalten';toggle.setAttribute('aria-pressed',String(enabled));
    if(!enabled){void vr?.stop();stopWalking();cancelAnimationFrame(raf);raf=0;if(dialog.open)dialog.close();}onToggle(enabled);
    if(!enabled)return;
    if(expandView&&!dialog.open){expand.click();returnFocus=toggle;}
    if(!ctx){status.textContent='Die 3D-Vorschau ist in diesem Browser nicht verfügbar.';return;}
    try{
      loading??=import('./dmx-stage-desktop.js').then(async module=>{
        const value=await module.createDesktopRenderer(canvas,{onInvalidate:requestDraw});
        if(disposed){value.destroy();return;}
        graphics=value;renderer=value.render;moveCamera=module.moveStageCamera;crowdMotion??=module.createCrowdMotion();
      });
      await loading;if(!disposed)requestDraw();
    }
    catch{loading=null;status.textContent='3D-Vorschau konnte nicht geladen werden. Zum erneuten Versuch aus- und einschalten.';}
  }
  toggle.onclick=()=>activate();
  function change(action){
    if(camera.mode==='dancer'){
      if(action==='reset'){const layout=viewLayout();dancer.x=0;dancer.y=layout.room?layout.depth*.25:-Math.min(3,layout.depth);dancer.eyeHeight=1.7;q('dancer-height').value='1.7';dancer.yaw=0;dancer.pitch=0;syncDancer();requestDraw();return;}
      if(action==='in'||action==='out'){moveDancer(action==='in'?.6:-.6,0);requestDraw();return;}
      setDancer(false);
    }
    if(action==='reset')camera=initial();
    if(action==='front')camera={yaw:0,pitch:.3,zoom:1};
    if(action==='top')camera={yaw:0,pitch:Math.PI/2-.01,zoom:1};
    if(action==='in'||action==='out')advanceCamera(action==='in'?1:-1);
    for(const b of panel.querySelectorAll('[data-camera=front],[data-camera=top]'))b.setAttribute('aria-pressed',String(b.dataset.camera===(camera.pitch>1.4?'top':'front')));
    requestDraw();
  }
  function advanceCamera(amount,sideways=0){
    if(!moveCamera)return;
    const layout=viewLayout(),size=viewportSize||canvas.getBoundingClientRect(),step=Math.max(.35,Math.max(layout.width,layout.depth)*.06);
    camera=moveCamera(layout,camera,Math.max(1,size.width),Math.max(1,size.height),amount*step,sideways*step);
  }
  panel.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>change(b.dataset.camera));
  canvas.oncontextmenu=e=>{if(enabled)e.preventDefault();};
  canvas.onpointerdown=e=>{if(![0,2].includes(e.button)||drag)return;e.preventDefault();drag={id:e.pointerId,button:e.button,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});};
  canvas.onpointermove=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(!(e.buttons&(drag.button===2?2:1))){drag=null;return;}
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(drag.button===2){
      if(moveCamera){
        const layout=viewLayout(),size=viewportSize||canvas.getBoundingClientRect(),scale=Math.max(layout.width,layout.depth)/Math.max(1,size.height)*(e.shiftKey?3:1);
        const next=moveCamera(layout,camera,Math.max(1,size.width),Math.max(1,size.height),0,-dx*scale,dy*scale);
        if(camera.mode==='dancer'){
          Object.assign(dancer,next);syncDancer();
          const select=q('dancer-height');let free=select.querySelector('[data-free-height]');
          if(!free){free=document.createElement('option');free.dataset.freeHeight='';select.append(free);}
          free.value=String(dancer.eyeHeight);free.textContent=`${dancer.eyeHeight.toFixed(2)} m (frei)`;select.value=free.value;
        }else camera=next;
      }
    }else{
      camera.yaw-=dx*.008;camera.pitch=Math.max(camera.mode==='dancer'||camera.eye?-1.2:.12,Math.min(camera.mode==='dancer'||camera.eye?1.2:Math.PI/2-.01,camera.pitch+dy*.006));
    }
    drag={...drag,x:e.clientX,y:e.clientY};requestDraw();
  };
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(drag?.id===e.pointerId)drag=null;};
  const movementAction=e=>({KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'}[e.code]||{w:'forward',s:'back',a:'left',d:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'}[e.key]);
  function navigateKey(e){
    if(e.ctrlKey||e.metaKey||e.isComposing)return false;
    const action=movementAction(e);
    if(camera.mode==='dancer'&&action){
      e.preventDefault();e.stopPropagation();
      // Keep the previous Alt shortcuts as single steps; plain WASD is continuous.
      if(e.altKey)walk(action);else{if(!walkingKeys.size)lastWalkTime=performance.now();walkingKeys.add(action);fastWalk=e.shiftKey;requestDraw();}
      return true;
    }
    if(camera.mode==='dancer'&&e.key==='Shift'){fastWalk=true;return false;}
    if(['+','=','-'].includes(e.key)){e.preventDefault();e.stopPropagation();change(e.key==='-'?'out':'in');return true;}
    if(e.key.startsWith('Arrow')&&(!dialog.open||e.altKey)){
      e.preventDefault();e.stopPropagation();camera.yaw+=(e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0);camera.pitch=clamp(camera.pitch+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0),camera.eye?-1.2:.12,camera.eye?1.2:Math.PI/2-.01);requestDraw();return true;
    }
    return false;
  }
  canvas.onkeydown=e=>{if(!e.defaultPrevented)navigateKey(e);};
  const releaseKey=e=>{const action=movementAction(e);if(action)walkingKeys.delete(action);if(e.key==='Shift')fastWalk=false;if(!walkingKeys.size)lastWalkTime=0;};
  window.addEventListener('keyup',releaseKey);
  window.addEventListener('blur',stopWalking);
  canvas.addEventListener('blur',stopWalking);
  canvas.addEventListener('wheel',e=>{
    if(e.ctrlKey||e.metaKey||!enabled)return;
    e.preventDefault();
    const unit=e.deltaMode===1?16:e.deltaMode===2?(viewportSize?.height||600):1;
    if(camera.mode==='dancer')moveDancer(clamp(-e.deltaY*unit*.006,-.8,.8)*(e.shiftKey?3:1),clamp(e.deltaX*unit*.006,-.8,.8)*(e.shiftKey?3:1));
    else advanceCamera(clamp(-e.deltaY*unit*.01,-3,3)*(e.shiftKey?3:1),clamp(e.deltaX*unit*.01,-3,3)*(e.shiftKey?3:1));
    requestDraw();
  },{passive:false});
  const resize=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;viewportSize={width,height};requestDraw();});resize.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else{stopWalking();cancelAnimationFrame(raf);raf=0;}});intersection.observe(canvas);
  const visibility=()=>{if(document.hidden){saveCamera();stopWalking();cancelAnimationFrame(raf);raf=0;}else requestDraw();};document.addEventListener('visibilitychange',visibility);
  workspace=createStageWorkspace(panel,{mountLighting,transport,zones,onFit:()=>requestDraw()});
  planner=createARPlanner(panel.querySelector('[data-workspace-page=room]'),{onStartAR:()=>arButton.click(),getScene:()=>vrScene(performance.now()/1000,true),onChange:()=>{panel.querySelector('.stage-3d-room').hidden=planner.active;syncDancer();requestDraw();}});
  panel.querySelector('.stage-3d-room').hidden=planner.active;
  workspace.setRoomPlanner(planner);
  const onXRCommand=command=>{if(command.action==='room-plan'){planner.use(command.plan);return;}return transport.vrCommand(command);};
  const arButton=document.createElement('button');arButton.type='button';arButton.className='button secondary';arButton.dataset.stageAr='';arButton.textContent='AR starten';arButton.disabled=true;panel.querySelector('.stage-3d-tools').append(arButton);
  const vrButton=document.createElement('button');vrButton.type='button';vrButton.className='button secondary';vrButton.dataset.stageVr='';vrButton.textContent='VR starten';vrButton.setAttribute('aria-pressed','false');panel.querySelector('.stage-3d-tools').append(vrButton);
  const vrStatus=document.createElement('span');vrStatus.className='stage-vr-status';vrStatus.setAttribute('role','status');panel.querySelector('.stage-3d-tools').append(vrStatus);
  const vrSetup=createVRSetup(panel.querySelector('.stage-3d-tools'),{onRefresh:()=>vr?.checkSupport()});
  vr=createStageVR({arButton,planner,onSupport:state=>vrSetup.update(state),button:vrButton,status:vrStatus,getScene:now=>({...vrScene(now,true),transport:transport.vrState(),roomPlan:planner.active?planner.plan:null}),onCommand:onXRCommand,getOrigin:()=>dancer,onActive:active=>{stopWalking();if(active){if(camera.mode!=='dancer')setDancer(true);cancelAnimationFrame(raf);raf=0;}else requestDraw();}});
  share=createVRShare(panel.querySelector('.stage-3d-tools'),{onStateChange:onShareChange,onCommand:onXRCommand,getScene:()=>({...vrScene(performance.now()/1000,true,false),transport:transport.vrState(),roomPlan:planner.active?planner.plan:null,origin:{x:dancer.x,y:dancer.y,yaw:dancer.yaw,eyeHeight:dancer.eyeHeight}})});
  workspace.organizeTools();
  const title=panel.querySelector('.stage-3d-heading strong'),secret=document.createElement('button');
  secret.type='button';secret.className='stage-3d-secret';secret.dataset.crowdSecret='';secret.innerHTML=title.innerHTML;title.replaceChildren(secret);
  let taps=0,lastTap=0;
  secret.onclick=()=>{
    const now=performance.now();taps=now-lastTap<1500?taps+1:1;lastTap=now;
    if(taps<3)return;taps=0;crowdButton.hidden=false;crowdEnabled=!crowdEnabled;placingPeople=false;syncCrowd();requestDraw();
    status.textContent='Easter Egg entdeckt · Tanzende Gäste lassen sich über die Werkzeugleiste ein- und ausschalten oder platzieren.';
  };
  // Restore after the room planner and controls exist, before the first visible frame.
  try{
    const saved=JSON.parse(localStorage.getItem(cameraKey)||'null');
    const savedOverview=cleanCamera(saved?.overview),savedDancer=cleanCamera(saved?.dancer,true);
    if(saved?.version===1&&typeof saved.ego==='boolean'&&savedOverview&&savedDancer){
      camera=savedOverview;overview={...savedOverview};Object.assign(dancer,savedDancer);
      if(saved.ego)setDancer(true);else syncDancer();
    }
  }catch{}
  const quickFull=document.createElement('button');
  quickFull.type='button';quickFull.className='button secondary stage-3d-quick-full';
  quickFull.setAttribute('aria-label','3D-Vorschau direkt im Vollbild öffnen');
  quickFull.title='3D-Vorschau im Vollbild öffnen';quickFull.setAttribute('aria-haspopup','dialog');
  quickFull.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  quickFull.onclick=()=>{fullButton.click();returnFocus=quickFull;};
  panel.append(quickFull);
  cameraStorageReady=true;
  window.addEventListener('pagehide',saveCamera);
  return {
    get isOpen(){return dialog.open;},
    setEnabled:value=>activate(value,{expandView:false}),
    open:trigger=>{if(!dialog.open)expand.click();returnFocus=trigger||expand;},
    openTools:name=>workspace.show(name),
    openDevices:trigger=>{void activate(true,{expandView:false});if(!dialog.open)expand.click();returnFocus=trigger||expand;workspace.show('fixtures');},
    setTransport:api=>{transport.setApi(api);fullTransport.setApi(api);},
    get enabled(){return enabled;},
    get sharing(){return Boolean(share?.wanted||share?.active);},
    get needsScene(){return enabled||Boolean(share?.wanted||share?.active);},
    update(fixtures,heads,musicState={}){
      music=musicState;
      if(!enabled&&!share?.wanted&&!share?.active)return;
      transport.update();workspace?.update();
      const layout=getLayout();moving=heads.map(h=>({...h,type:'moving'}));movingFrames.push(moving,layout,performance.now());
      const counts=new Map(),indices=new Map();
      for(const fixture of fixtures)counts.set(fixture.type,(counts.get(fixture.type)||0)+1);
      lights=fixtures.flatMap(f=>{
        const index=indices.get(f.type)||0,id=`fixture-${f.id}`;indices.set(f.type,index+1);
        const p=layout.positions[id]||{...fixturePosition(layout,id,index,counts.get(f.type)),y:layout.depth*(f.type==='bar'?.25:.55)};
        return f.cells.map((rgb,i)=>{
          const power=Math.max(...rgb)/255,color=power?rgb.map(v=>Math.round(v/power)):[0,0,0];
          const x=p.x+(f.type==='bar'?(i-(f.cells.length-1)/2)*.22:0);
          return {id,type:f.type,position:{...p,x},target:{x,y:layout.depth*.1},color:`rgb(${color.join(',')})`,power};
        });
      });requestDraw();
    },
    destroy(){disposed=true;graphics?.destroy();saveCamera();cameraStorageReady=false;window.removeEventListener('pagehide',saveCamera);planner?.destroy();arStylesheet.remove();share?.destroy();vrSetup.destroy();vr?.destroy();stopWalking();window.removeEventListener('keyup',releaseKey);window.removeEventListener('blur',stopWalking);workspace.destroy();zoneMotion.reset();zones.destroy();room.destroy();transport.destroy();fullTransport.destroy();disposed=true;cancelAnimationFrame(raf);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);dialog.close();dialog.remove();marker.remove();panel.remove();toggle.remove();stylesheet.remove();}
  };
}
