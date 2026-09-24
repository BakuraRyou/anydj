import {createStageWorkspace} from './dmx-stage-workspace.js';
import {createRoomSettings,roomLayout,roomLights} from './dmx-room.js';
import {createStageTransport} from './dmx-stage-transport.js';
import {fixturePosition} from './dmx-layout-model.js';
// Optional preview adapter. Remove this module and its hooks in dmx-stage.js
// to remove the feature. The renderer is loaded only on first activation.
export function createStage3d(host,controls,{getLayout,mountLayout,mountLighting,onToggle=()=>{}}){
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./dmx-stage-3d.css',import.meta.url).href;document.head.append(stylesheet);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='button secondary';toggle.dataset.stage3dToggle='';toggle.textContent='3D-Bühne einschalten';toggle.setAttribute('aria-pressed','false');controls.append(toggle);
  const panel=document.createElement('section');panel.className='stage-3d';panel.hidden=true;panel.setAttribute('aria-label','3D-Bühnenvorschau');
  panel.innerHTML=`<div class="stage-3d-heading"><strong>3D-Bühne <small>Simulation</small></strong><button type="button" class="button secondary" data-stage3d-full aria-haspopup="dialog" aria-pressed="false">Full</button><button type="button" class="button secondary" data-stage3d-expand>Große Ansicht</button><button type="button" class="button secondary" data-camera="reset">Kamera zurücksetzen</button></div><canvas tabindex="0" role="img" aria-label="Räumliche Lichtbühne. Mit Ziehen oder Alt plus Pfeiltasten drehen, mit Plus und Minus zoomen."></canvas><div class="stage-3d-full-controls" hidden><span>FULL · Esc zum Verlassen</span><button type="button" class="button secondary" data-stage3d-full-close>Full schließen</button></div><div class="stage-3d-tools"><button type="button" class="button secondary" data-camera="front">Publikum</button><button type="button" class="button secondary" data-camera="top">Draufsicht</button><button type="button" class="button secondary" data-camera="in" aria-label="Vergrößern">+</button><button type="button" class="button secondary" data-camera="out" aria-label="Verkleinern">−</button><button type="button" class="button secondary" data-dancer aria-pressed="false">Auf die Tanzfläche</button><span data-camera-help>Ziehen: drehen · + / −: Zoom</span></div><fieldset class="stage-3d-dancer" hidden><legend>Dein Standort auf der Tanzfläche</legend><svg data-dancer-map viewBox="0 0 240 140" role="img" aria-label="Standort wählen: Bühne oben, Tanzfläche darunter"><rect x="10" y="4" width="220" height="25" rx="3" fill="#476174"/><text x="120" y="21" text-anchor="middle" fill="#edf6fa">BÜHNE</text><rect x="10" y="34" width="220" height="96" rx="3" fill="#183b42" stroke="#638891"/><path data-dancer-direction fill="none" stroke="#9ee7d6" stroke-width="2"/><circle data-dancer-dot r="5" fill="#b8ffe6"/></svg><div class="stage-3d-location"><label>Links / rechts <input data-dancer-x type="range" step="0.1" value="0"></label><label>Abstand zur Bühne <input data-dancer-distance type="range" min="0.4" step="0.1" value="3"></label><label>Augenhöhe <select data-dancer-height><option value="1.2">1,20 m</option><option value="1.5">1,50 m</option><option value="1.7" selected>1,70 m</option><option value="1.9">1,90 m</option></select></label><output data-dancer-position></output></div><div class="stage-3d-walk"><button type="button" class="button secondary" data-walk="forward">Vorwärts</button><button type="button" class="button secondary" data-walk="back">Zurück</button><button type="button" class="button secondary" data-walk="left">Schritt links</button><button type="button" class="button secondary" data-walk="right">Schritt rechts</button></div><label class="stage-3d-aim"><input type="checkbox" data-dancer-aim> Moving Heads auf die Tanzfläche richten · nur diese Vorschau</label></fieldset><p role="status">Vereinfachte Lichtvorschau · Aufbau aus „Bühne & Geräte aufstellen“</p>`;
  const scene=host.querySelector('.stage-scene');
  if(scene)scene.after(panel);else host.append(panel);
  const marker=document.createComment('stage-3d-home');panel.before(marker);
  const dialog=document.createElement('dialog');dialog.className='stage-3d-dialog';dialog.setAttribute('aria-label','Große 3D-Bühnenvorschau');document.body.append(dialog);
  const expand=panel.querySelector('[data-stage3d-expand]');
  const fullButton=panel.querySelector('[data-stage3d-full]'),fullControls=panel.querySelector('.stage-3d-full-controls');
  let workspace=null;
  let full=false,returnExpanded=false,returnFocus=expand;
  const transport=createStageTransport(panel,{isVisible:()=>dialog.open&&!full});
  dialog.addEventListener('keydown',event=>{if(event.target.closest('[data-layout-map],.light-editor'))return;transport.handleShortcut(event);if(event.defaultPrevented)event.stopPropagation();},{capture:true});
  function leaveFull(){
    full=false;dialog.classList.remove('stage-3d-full');fullControls.hidden=true;fullButton.setAttribute('aria-pressed','false');
    if(returnExpanded){fullButton.focus();requestDraw();}else dialog.close();
  }
  fullButton.onclick=()=>{
    if(full)return;returnFocus=fullButton;
    returnExpanded=dialog.open;full=true;
    dialog.classList.add('stage-3d-full');fullControls.hidden=false;fullButton.setAttribute('aria-pressed','true');
    if(!dialog.open){dialog.append(panel);expand.textContent='Schließen';dialog.showModal();}
    dialog.scrollTop=0;canvas.focus({preventScroll:true});requestDraw();
  };
  panel.querySelector('[data-stage3d-full-close]').onclick=leaveFull;
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(full)leaveFull();else dialog.close();});
  expand.onclick=()=>{returnFocus=expand;if(dialog.open){dialog.close();return;}dialog.append(panel);expand.textContent='Schließen';dialog.showModal();requestDraw();};
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(full)leaveFull();else dialog.close();}});
  dialog.addEventListener('close',()=>{if(disposed)return;workspace?.close();full=false;dialog.classList.remove('stage-3d-full');fullControls.hidden=true;fullButton.setAttribute('aria-pressed','false');marker.after(panel);expand.textContent='Große Ansicht';returnFocus.focus();requestDraw();});
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d'),status=panel.querySelector('[role=status]');
  let enabled=false,disposed=false,visible=true,renderer=null,loading=null,raf=0,lights=[],moving=[],drag=null;
  const room=createRoomSettings(panel,{getLayout,onChange:()=>{if(room.value.enabled){dancer.y=Math.max(.15,dancer.y);q('dancer-aim').checked=false;}syncDancer();requestDraw();}});
  const viewLayout=()=>room.value.enabled?roomLayout(room.value):getLayout();
  const initial=()=>({yaw:.32,pitch:.55,zoom:1});let camera=initial(),overview=initial();
  const dancer={mode:'dancer',x:0,y:room.value.enabled?room.value.depth*.25:-Math.min(3,getLayout().depth),eyeHeight:1.7,yaw:0,pitch:0,zoom:1};
  const q=name=>panel.querySelector(`[data-${name}]`),dancerButton=q('dancer'),dancerTools=panel.querySelector('.stage-3d-dancer');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
    dancer.x=clamp(dancer.x,-half+.15,half-.15);dancer.y=clamp(dancer.y,club?.15:-depth+.15,club?depth-.15:-.4);
    q('dancer-x').min=-half+.15;q('dancer-x').max=half-.15;q('dancer-x').value=dancer.x;
    q('dancer-distance').min=club?.15:.4;q('dancer-distance').max=depth-.15;q('dancer-distance').value=club?dancer.y:-dancer.y;
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
    if(!value){placingPeople=false;syncCrowd();}
    if(value){overview={...camera};camera=dancer;syncDancer();}else camera={...overview};
    dancerTools.hidden=!value;dancerButton.setAttribute('aria-pressed',String(value));dancerButton.textContent='Auf die Tanzfläche';
    q('camera-help').textContent=value?'Ziehen: umsehen · Alt + WASD / Pfeiltasten: gehen':'Ziehen: drehen · + / −: Zoom';
    canvas.setAttribute('aria-label',value?'Blick von der Tanzfläche. Ziehen zum Umsehen. Alt plus WASD oder Pfeiltasten zum Gehen.':'Räumliche Lichtbühne. Ziehen oder Alt plus Pfeiltasten zum Drehen, Plus und Minus zum Zoomen.');
    for(const action of ['in','out'])panel.querySelector(`[data-camera=${action}]`).disabled=value;
    workspace?.show(value?'position':'');
    requestDraw();
  }
  dancerButton.onclick=()=>setDancer(camera.mode!=='dancer');
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
  q('dancer-distance').oninput=e=>{dancer.y=(room.value.enabled?1:-1)*Number(e.target.value);syncDancer();requestDraw();};
  q('dancer-height').onchange=e=>{dancer.eyeHeight=Number(e.target.value);requestDraw();};
  q('dancer-aim').onchange=()=>{status.textContent=q('dancer-aim').checked?'Moving Heads auf Tanzfläche · abweichende Lichtziele nur in dieser 3D-Vorschau':'Vereinfachte Lichtvorschau · Aufbau aus „Bühne & Geräte aufstellen“';requestDraw();};
  function walk(action){
    const forward=action==='forward'?.35:action==='back'?-.35:0,right=action==='right'?.35:action==='left'?-.35:0;
    dancer.x+=-Math.sin(dancer.yaw)*forward+Math.cos(dancer.yaw)*right;
    dancer.y+=Math.cos(dancer.yaw)*forward+Math.sin(dancer.yaw)*right;syncDancer();requestDraw();
  }
  panel.querySelectorAll('[data-walk]').forEach(b=>b.onclick=()=>walk(b.dataset.walk));
  const requestDraw=()=>{if(!disposed&&enabled&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);};
  function draw(){
    raf=0;if(!enabled||disposed||!visible||document.hidden||!renderer||!ctx)return;
    transport.update();
    const {width,height}=canvas.getBoundingClientRect();if(!width||!height)return;
    const scale=Math.min(window.devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(width*scale)||canvas.height!==Math.round(height*scale)){canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);}
    if(camera.mode==='dancer')syncDancer();
    const layout=getLayout(),previewMoving=q('dancer-aim').checked?moving.map(h=>({...h,target:{x:h.target.x,y:-Math.max(4,layout.depth)*(.1+.8*h.target.y/layout.depth)}})):moving;
    ctx.setTransform(scale,0,0,scale,0,0);renderer(ctx,width,height,viewLayout(),room.value.enabled?roomLights([...lights,...moving],layout,room.value):[...lights,...previewMoving],camera,crowdEnabled?crowd:[],reducedMotion.matches?0:performance.now()/1000);
  }
  async function activate(){
    enabled=!enabled;panel.hidden=!enabled;toggle.textContent=enabled?'3D-Bühne ausschalten':'3D-Bühne einschalten';toggle.setAttribute('aria-pressed',String(enabled));
    if(!enabled){cancelAnimationFrame(raf);raf=0;if(dialog.open)dialog.close();}onToggle(enabled);
    if(!enabled)return;
    if(!dialog.open){expand.click();returnFocus=toggle;}
    if(!ctx){status.textContent='Die 3D-Vorschau ist in diesem Browser nicht verfügbar.';return;}
    try{loading??=import('./dmx-stage-3d-renderer.js');renderer=(await loading).renderStage3d;requestDraw();}
    catch{loading=null;status.textContent='3D-Vorschau konnte nicht geladen werden. Zum erneuten Versuch aus- und einschalten.';}
  }
  toggle.onclick=activate;
  function change(action){
    if(camera.mode==='dancer'){
      if(action==='reset'){dancer.yaw=0;dancer.pitch=0;syncDancer();requestDraw();return;}
      if(action==='in'||action==='out')return;
      setDancer(false);
    }
    if(action==='reset')camera=initial();
    if(action==='front')camera={yaw:0,pitch:.3,zoom:1};
    if(action==='top')camera={yaw:0,pitch:Math.PI/2-.01,zoom:1};
    if(action==='in'||action==='out')camera.zoom=Math.max(.55,Math.min(1.7,camera.zoom*(action==='in'?1.1:1/1.1)));
    for(const b of panel.querySelectorAll('[data-camera=front],[data-camera=top]'))b.setAttribute('aria-pressed',String(b.dataset.camera===action||(action==='reset'&&b.dataset.camera==='front')));
    requestDraw();
  }
  panel.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>change(b.dataset.camera));
  canvas.onpointerdown=e=>{if(e.button!==0||drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();};
  canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;camera.yaw-=(e.clientX-drag.x)*.008;camera.pitch=Math.max(camera.mode==='dancer'? -1.2:.12,Math.min(camera.mode==='dancer'?1.2:Math.PI/2-.01,camera.pitch+(e.clientY-drag.y)*.006));drag={id:e.pointerId,x:e.clientX,y:e.clientY};requestDraw();};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{drag=null;};
  canvas.onkeydown=e=>{if(dialog.open&&!e.altKey&&!['+','=','-'].includes(e.key))return;if(camera.mode==='dancer'){
    const action={w:'forward',s:'back',a:'left',d:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'}[e.key.length===1?e.key.toLowerCase():e.key];
    if(action&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopPropagation();walk(action);}return;
  }if(['+','=','-'].includes(e.key)){e.preventDefault();change(e.key==='-'?'out':'in');}else if(e.key.startsWith('Arrow')){e.preventDefault();camera.yaw+=(e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0);camera.pitch=Math.max(.12,Math.min(Math.PI/2-.01,camera.pitch+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)));requestDraw();}};
  const resize=new ResizeObserver(requestDraw);resize.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else{cancelAnimationFrame(raf);raf=0;}});intersection.observe(canvas);
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else requestDraw();};document.addEventListener('visibilitychange',visibility);
  workspace=createStageWorkspace(panel,{mountLayout,mountLighting,transport,onFit:()=>requestDraw()});
  const title=panel.querySelector('.stage-3d-heading strong'),secret=document.createElement('button');
  secret.type='button';secret.className='stage-3d-secret';secret.dataset.crowdSecret='';secret.innerHTML=title.innerHTML;title.replaceChildren(secret);
  let taps=0,lastTap=0;
  secret.onclick=()=>{
    const now=performance.now();taps=now-lastTap<1500?taps+1:1;lastTap=now;
    if(taps<3)return;taps=0;crowdButton.hidden=false;crowdEnabled=!crowdEnabled;placingPeople=false;syncCrowd();requestDraw();
    status.textContent='Easter Egg entdeckt · Tanzende Gäste lassen sich über die Werkzeugleiste ein- und ausschalten oder platzieren.';
  };
  return {
    get isOpen(){return dialog.open;},
    openTools:name=>workspace.show(name),
    setTransport:transport.setApi,
    get enabled(){return enabled;},
    update(fixtures,heads){
      if(!enabled)return;
      transport.update();workspace?.update();
      const layout=getLayout();moving=heads.map(h=>({...h,type:'moving'}));
      lights=fixtures.flatMap(f=>{
        const group=fixtures.filter(other=>other.type===f.type),id=`fixture-${f.id}`;
        const p=layout.positions[id]||{...fixturePosition(layout,id,group.indexOf(f),group.length),y:layout.depth*(f.type==='bar'?.25:.55)};
        return f.cells.map((rgb,i)=>{
          const power=Math.max(...rgb)/255,color=power?rgb.map(v=>Math.round(v/power)):[0,0,0];
          const x=p.x+(f.type==='bar'?(i-(f.cells.length-1)/2)*.22:0);
          return {type:f.type,position:{...p,x},target:{x,y:layout.depth*.1},color:`rgb(${color.join(',')})`,power};
        });
      });requestDraw();
    },
    destroy(){workspace.destroy();room.destroy();transport.destroy();disposed=true;cancelAnimationFrame(raf);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);dialog.close();dialog.remove();marker.remove();panel.remove();toggle.remove();stylesheet.remove();}
  };
}
