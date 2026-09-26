/**
 * @deprecated LEGACY DEVICE MANAGER — DO NOT EXTEND OR USE AS THE DEVICE UI.
 * The current Gerätemanager is the room planner in dmx-ar-planner.js,
 * compacted by dmx-device-manager.js inside the 3D workspace's Geräte tab.
 * This module is retained for legacy stage-layout data and preview adapters.
 * Do not restore its standalone dialog or mount its UI in the workspace.
 * See /AGENTS.md before making device-manager changes.
 */
import {fixtureKey} from './dmx-model.js';
import {stageLayout,fixturePosition,rotateAssembly} from './dmx-layout-model.js';
const NS='http://www.w3.org/2000/svg',KEY='anydj-stage-layout-v1';
const svgNode=(name,attrs={})=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
export function createStageLayout({getFixtures=()=>[],onProperties=()=>{},onChange=()=>{}}={}){
  let layout=stageLayout(),selected='moving-0',preview=[],drag=null,signature='',nodes=new Map(),returnFocus;
  const fixtureLights=new Map();let selection=new Set();
  const groupList=document.createElement('div');groupList.className='stage-assembly-list';groupList.setAttribute('aria-label','Eigene Gerätegruppen');let groupListSignature='';
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');layout=stageLayout(saved);
    if(!saved?.targets){const old=JSON.parse(localStorage.getItem('anydj-3d-zones-v1')||'null');for(const [id,p] of Object.entries(old?.aims||{}))layout.targets[id]={x:(p.x-.5)*layout.width,y:p.y*layout.depth};localStorage.setItem(KEY,JSON.stringify(layout));}
  }catch{}
  const dialog=document.createElement('dialog');dialog.className='stage-layout-dialog';dialog.id='stageLayoutDialog';dialog.setAttribute('aria-labelledby','stageLayoutTitle');
  dialog.innerHTML=`<div class="stage-layout-heading"><div><span class="stage-badge">BÜHNENAUFBAU</span><h2 id="stageLayoutTitle">Gerätemanager</h2></div><button type="button" class="button secondary" data-layout-close>Schließen</button></div>
  <p>Geräte hinzufügen, auswählen und direkt im Plan aufstellen. Änderungen werden automatisch gespeichert.</p>
  <div class="stage-layout-dimensions"><label>Bühnenbreite (m)<input data-layout-width type="number" min="2" max="30" step="0.1"></label><label>Bühnentiefe (m)<input data-layout-depth type="number" min="2" max="30" step="0.1"></label><button type="button" class="button secondary" data-layout-symmetry>Moving Heads symmetrisch aufstellen</button></div>
  <div class="stage-layout-workspace"><div class="stage-layout-map"><svg data-layout-map role="group" aria-label="Bühnenplan. Gerät auswählen und ziehen oder mit Pfeiltasten verschieben."></svg><p class="small">Draufsicht · Publikum unten · Raster 1 m<br>MH = Moving Head · S = Scheinwerfer · L = Lichtleiste</p></div>
  <fieldset class="stage-layout-inspector"><legend>Auswahl konfigurieren</legend><output data-layout-selection></output><div class="stage-assembly-controls"><button type="button" class="button secondary" data-layout-link>Auswahl fest gruppieren</button><label>Zu vorhandener Gerätegruppe<select data-layout-join-group></select></label><button type="button" class="button secondary" data-layout-join>Auswahl hinzufügen</button><div data-layout-assembly hidden><label>Gerätegruppe<input data-layout-assembly-name maxlength="60"></label><label>Drehung (°)<input data-layout-rotation type="number" min="-360" max="360" step="1"></label><div class="stage-controls"><button type="button" class="button secondary" data-layout-turn>+90° drehen</button><button type="button" class="button secondary" data-layout-detach>Aktuellen Scheinwerfer herauslösen</button><button type="button" class="button secondary" data-layout-unlink>Gruppe auflösen</button></div><p class="small">Drehpunkt: Gruppenmitte. Lichtziele bleiben an ihrem Ort.</p></div></div><label>Name<input data-layout-name maxlength="60"></label><label>Lichtgruppe<select data-layout-group><option value="0">Links</option><option value="1">Rechts</option><option value="2">Hintergrund</option></select></label><label>Lichtstärke (%)<input data-layout-gain type="number" min="0" max="100" step="1"></label><label data-layout-motion-label>Bewegungsbereich (%)<input data-layout-motion type="number" min="0" max="100" step="1"></label><label data-layout-target-x-label>Lichtziel links / rechts (m)<input data-layout-target-x type="number" step="0.1"></label><label data-layout-target-y-label>Lichtziel von vorne (m)<input data-layout-target-y type="number" step="0.1"></label><label>Gerät<select data-layout-device></select></label><label>Links / rechts (m)<input data-layout-x type="number" step="0.1"></label><label>Abstand zur Vorderkante (m)<input data-layout-y type="number" step="0.1"></label><label>Montagehöhe (m)<input data-layout-height type="number" min="0.3" max="12" step="0.1"></label><button type="button" class="button secondary" data-layout-reset-target>Lichtziel zurücksetzen</button><p data-layout-aim class="small"></p><p class="small">Pfeiltasten: 10 cm · Umschalt: 50 cm. Die Mitte der Bühne ist X = 0.</p></fieldset></div>
  <p data-layout-status role="status">Änderungen werden automatisch gespeichert.</p><p class="small">Geometrische Vorschau mit generischen Geräten. Gehäuse, Optik und mechanische Grenzen sind nicht herstellerspezifisch nachgebildet.</p>`;
  const content=document.createElement('div');content.className='stage-layout-content';content.append(...dialog.childNodes);dialog.append(content);
  let mounted=false,zones=null,zoneLayer=null,zoneSignature='';
  // Legacy UI stays detached; only its layout/preview adapters are retained.
  const controls=new Map(),q=name=>{if(!controls.has(name))controls.set(name,content.querySelector(`[data-layout-${name}]`));return controls.get(name);},svg=q('map');
  let drawFrame=0,mapWidth=600,mapVisible=true,disposed=false;
  const attributes=new WeakMap();
  function attr(node,key,value){const text=String(value);let values=attributes.get(node);if(!values){values=new Map();attributes.set(node,values);}if(values.get(key)===text)return;values.set(key,text);node.setAttribute(key,text);}
  const scheduleDraw=()=>{if(!disposed&&!document.hidden&&(dialog.open||mounted)&&!drawFrame)drawFrame=requestAnimationFrame(()=>{drawFrame=0;draw(true);});};
  const resize=new ResizeObserver(entries=>{mapWidth=entries[0].contentRect.width||600;scheduleDraw();});resize.observe(svg);
  const intersection=new IntersectionObserver(entries=>{mapVisible=entries[0].isIntersecting;if(mapVisible)scheduleDraw();});intersection.observe(svg);
  const visibility=()=>{if(!document.hidden)scheduleDraw();};document.addEventListener('visibilitychange',visibility);
  for(const input of dialog.querySelectorAll('input'))input.required=true;
  function fixtures(){return getFixtures().map(f=>({...f,id:fixtureKey(f),label:(f.type==='moving'?'MH':f.type==='bar'?'L':'S')+(f.name.match(/\d+$/)?.[0]||'')}));}

  function position(f,list){const group=list.filter(v=>v.type===f.type),p=fixturePosition(layout,f.id,group.indexOf(f),group.length);return layout.positions[f.id]||{...p,y:layout.depth*(f.type==='moving'?.85:f.type==='bar'?.25:.55)};}
  function lightFor(f,list){
    if(f.type==='moving')return preview.find(v=>v.id===f.id);
    const rgb=fixtureLights.get(f.id)||[160,200,210];
    const p=position(f,list),target=layout.targets[f.id]||{x:p.x,y:layout.depth*.1},dy=p.y-target.y;
    return {target,color:`rgb(${rgb.join(',')})`,power:Math.max(...rgb)>0?1:0,pan:Math.atan2(target.x-p.x,dy)*180/Math.PI,tilt:Math.atan2(p.height,Math.hypot(target.x-p.x,dy))*180/Math.PI,distance:Math.hypot(target.x-p.x,dy,p.height)};
  }
  function assembly(id=selected){return layout.assemblies.find(g=>g.members.includes(id));}
  function expandSelection(){for(const id of [...selection])for(const member of assembly(id)?.members||[])selection.add(member);}
  function point(p){return {x:p.x+layout.width/2,y:layout.depth-p.y};}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(layout));q('status').textContent='Bühnenaufbau gespeichert.';}catch{q('status').textContent='Speichern nicht möglich. Der Aufbau gilt für diese Sitzung.';}onChange();}
  function inspector(){
    const list=fixtures(),f=list.find(f=>f.id===selected)||list[0];
    selection=new Set([...selection].filter(id=>list.some(f=>f.id===id)));
    for(const input of content.querySelectorAll('input,select'))if(input.closest('.stage-layout-inspector'))input.disabled=!f;
    if(!f){q('join').disabled=true;q('assembly').hidden=true;q('link').disabled=true;q('selection').textContent='Gerät hinzufügen, um den Aufbau zu beginnen.';return;}selected=f.id;if(!selection.has(selected))selection=new Set([selected]);
    expandSelection();
    const groupKey=JSON.stringify(layout.assemblies);
    if(groupKey!==groupListSignature){groupListSignature=groupKey;groupList.replaceChildren();
      for(const g of layout.assemblies){const button=document.createElement('button');button.type='button';button.className='button secondary';button.dataset.selectAssembly=g.id;button.textContent=`${g.name} · ${g.members.length} Scheinwerfer`;groupList.append(button);}
    }
    for(const button of groupList.children)button.setAttribute('aria-pressed',String(assembly()?.id===button.dataset.selectAssembly));
    const group=assembly();q('assembly').hidden=!group;
    const joinValue=q('join-group').value;q('join-group').replaceChildren(...layout.assemblies.filter(g=>g!==group).map(g=>new Option(g.name,g.id)));if([...q('join-group').options].some(o=>o.value===joinValue))q('join-group').value=joinValue;q('join').disabled=q('join-group').disabled=!q('join-group').options.length;
    q('detach').textContent=`${f.name} herauslösen`;
    q('link').disabled=selection.size<2||Boolean(group&&group.members.length===selection.size);
    if(group){q('assembly-name').value=group.name;q('rotation').value=Number(group.rotation.toFixed(2));}
    const p=position(f,list);q('device').value=selected;
    q('selection').textContent=group?`${group.name} · ${selection.size} Geräte fest verbunden`:selection.size>1?`${selection.size} Geräte ausgewählt · Position gemeinsam verschieben`:f.name;
    q('name').value=selection.size===1?f.name:'';q('name').disabled=selection.size!==1;q('group').value=f.group??0;q('gain').value=f.gain??100;
    const chosen=list.filter(f=>selection.has(f.id)),moving=chosen.every(f=>f.type==='moving'),fixed=chosen.every(f=>f.type!=='moving');
    q('motion-label').hidden=!moving;q('motion').value=Math.round((f.motionRange??1)*100);
    q('target-x-label').hidden=q('target-y-label').hidden=q('reset-target').hidden=!fixed;
    const target=layout.targets[f.id]||{x:p.x,y:layout.depth*.1};q('target-x').value=target.x.toFixed(2);q('target-y').value=target.y.toFixed(2);
    content.querySelectorAll('[data-select-device]').forEach(input=>input.checked=selection.has(input.dataset.selectDevice));
    content.querySelectorAll('[data-position-device]').forEach(b=>b.setAttribute('aria-pressed',String(selection.has(b.dataset.positionDevice))));
    for(const key of ['x','y','height'])q(key).value=p[key].toFixed(2);
    q('x').min=-layout.width/2;q('x').max=layout.width/2;q('y').min=0;q('y').max=layout.depth;
  }
  function draw(liveOnly=false){
    if(drawFrame){cancelAnimationFrame(drawFrame);drawFrame=0;}
    if(disposed||(!dialog.open&&!mounted))return;
    const list=fixtures(),key=JSON.stringify([layout.width,layout.depth,list]);
    if(signature!==key){
      liveOnly=false;
      const added=signature?list.filter(f=>!nodes.has(f.id)):[];if(added.length){selected=added.at(-1).id;selection=new Set([selected]);}
      layout.assemblies=layout.assemblies.map(g=>({...g,members:g.members.filter(id=>list.some(f=>f.id===id))})).filter(g=>g.members.length>1);
      signature=key;nodes.clear();svg.replaceChildren();q('device').replaceChildren();
      svg.setAttribute('viewBox',`-0.65 -0.65 ${layout.width+1.3} ${layout.depth+1.65}`);
      svg.style.aspectRatio=String((layout.width+1.3)/(layout.depth+1.65));
      svg.append(svgNode('rect',{x:0,y:0,width:layout.width,height:layout.depth,fill:'#101f2c',stroke:'#7893a5','stroke-width':.04}));
      for(let x=1;x<layout.width;x++)svg.append(svgNode('line',{x1:x,x2:x,y1:0,y2:layout.depth,stroke:'#253d4d','stroke-width':.02}));
      for(let y=1;y<layout.depth;y++)svg.append(svgNode('line',{x1:0,x2:layout.width,y1:y,y2:y,stroke:'#253d4d','stroke-width':.02}));
      const front=svgNode('text',{x:layout.width/2,y:layout.depth+.65,'text-anchor':'middle','font-size':.27,fill:'#acc5d3'});front.textContent='VORDERKANTE · PUBLIKUM';svg.append(front);
      zoneLayer=svgNode('g');svg.append(zoneLayer);zoneSignature='';
      const beams=svgNode('g',{'pointer-events':'none'});svg.append(beams);
      for(const f of list){
        q('device').add(new Option(f.name,f.id));
        const beam=svgNode('line',{'stroke-width':.07,opacity:0}),target=svgNode('circle',{r:.13,fill:'none','stroke-width':.04,opacity:0});beams.append(beam,target);
        if(f.type!=='moving'){target.style.pointerEvents='all';target.style.cursor='crosshair';target.setAttribute('data-layout-target',f.id);target.addEventListener('pointerdown',e=>{e.preventDefault();selected=f.id;selection=new Set([selected]);drag={id:f.id,pointer:e.pointerId,aim:true};target.setPointerCapture(e.pointerId);inspector();});target.addEventListener('pointermove',e=>{if(!drag?.aim||drag.pointer!==e.pointerId)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());layout.targets[f.id]={x:p.x-layout.width/2,y:layout.depth-p.y};layout=stageLayout(layout);inspector();draw();onChange();});const endAim=()=>{if(drag?.aim){drag=null;persist();}};target.addEventListener('pointerup',endAim);target.addEventListener('pointercancel',endAim);target.addEventListener('lostpointercapture',endAim);}
        const node=svgNode('g',{tabindex:0,role:'button','aria-label':`${f.name} positionieren`,'data-layout-fixture':f.id});
        node.append(svgNode(f.type==='bar'?'rect':'circle',f.type==='bar'?{x:-.35,y:-.13,width:.7,height:.26,rx:.06}:{r:.22}));
        const label=svgNode('text',{y:-.35,'text-anchor':'middle','font-size':.24,fill:'#e8f3fa'});label.textContent=f.label;node.append(label);svg.append(node);
        node.append(svgNode('circle',{'data-layout-hit':'',r:.4,fill:'transparent'}));
        node.addEventListener('pointerdown',e=>{e.preventDefault();selected=f.id;if(e.shiftKey)selection.add(selected);else if(!selection.has(selected))selection=new Set([selected]);drag={id:f.id,pointer:e.pointerId};node.setPointerCapture(e.pointerId);node.focus();inspector();draw();});
        node.addEventListener('pointermove',e=>{if(drag?.aim||drag?.id!==f.id||drag.pointer!==e.pointerId)return;const matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());setPosition({x:Math.round((p.x-layout.width/2)*10)/10,y:Math.round((layout.depth-p.y)*10)/10},false);});
        const end=()=>{if(drag?.id===f.id){drag=null;persist();}};
        node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end);
        node.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selected=f.id;inspector();draw();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();selected=f.id;const p=position(f,fixtures()),step=e.shiftKey?.5:.1;setPosition({x:p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:p.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)});});
        nodes.set(f.id,{node,beam,target,hit:node.querySelector('[data-layout-hit]')});
      }
      inspector();
    }
    if(zones&&zoneLayer){
      const current=JSON.stringify(zones.value.zones);
      if(current!==zoneSignature&&!drag?.zone){zoneSignature=current;zoneLayer.replaceChildren();
        for(const z of zones.value.zones){
          const node=svgNode('rect',{x:z.x*layout.width,y:(1-z.y-z.depth)*layout.depth,width:z.width*layout.width,height:z.depth*layout.depth,fill:'#ad7755',opacity:.55,stroke:'#ffd4a0','stroke-width':.04,'data-layout-zone':z.id});zoneLayer.append(node);
          const title=svgNode('title');title.textContent=z.name;node.append(title);
          node.addEventListener('pointerdown',e=>{e.preventDefault();zones.selectZone(z.id);drag={zone:z.id,pointer:e.pointerId,start:new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),value:{...z}};node.setPointerCapture(e.pointerId);});
          node.addEventListener('pointermove',e=>{if(drag?.zone!==z.id||drag.pointer!==e.pointerId)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());const x=Math.max(0,Math.min(1-z.width,drag.value.x+(p.x-drag.start.x)/layout.width)),y=Math.max(0,Math.min(1-z.depth,drag.value.y-(p.y-drag.start.y)/layout.depth));node.setAttribute('x',x*layout.width);node.setAttribute('y',(1-y-z.depth)*layout.depth);zones.setZone(z.id,{x,y});});
          const finish=()=>{if(drag?.zone===z.id){drag=null;zoneSignature='';draw();}};node.addEventListener('pointerup',finish);node.addEventListener('pointercancel',finish);node.addEventListener('lostpointercapture',finish);
        }
      }
    }
    if(!liveOnly||mapVisible)for(const f of list){const p=point(position(f,list)),{node,beam,target,hit}=nodes.get(f.id);attr(node,'transform',`translate(${p.x} ${p.y})`);attr(node,'aria-pressed',String(selection.has(f.id)));attr(node.firstChild,'fill',f.id===selected?'#b4ebcf':selection.has(f.id)?'#79bba4':f.type==='moving'?'#427ea0':'#526170');attr(node.firstChild,'stroke','#d9edf7');attr(node.firstChild,'stroke-width',.035);attr(hit,'r',Math.max(.3,(layout.width+1.3)*16/mapWidth));
      const light=lightFor(f,list);if(light){const t=point(light.target);for(const [key,value] of Object.entries({x1:p.x,y1:p.y,x2:t.x,y2:t.y,stroke:light.color,opacity:Math.max(.35,light.power)}))attr(beam,key,value);for(const [key,value] of Object.entries({cx:t.x,cy:t.y,stroke:light.color,opacity:Math.max(.35,light.power)}))attr(target,key,value);}else{attr(beam,'opacity',0);attr(target,'opacity',0);}}
    const selectedFixture=list.find(f=>f.id===selected),aim=selectedFixture&&lightFor(selectedFixture,list);
    const aimText=aim?`Pan ${aim.pan.toFixed(1)}° · Tilt ${aim.tilt.toFixed(1)}° · Lichtweg ${aim.distance.toFixed(2)} m`:'Starte einen Track oder die Demo, um die Lichtziele zu sehen.';if(q('aim').textContent!==aimText)q('aim').textContent=aimText;
  }
  function setPosition(changes,save=true){const list=fixtures(),f=list.find(f=>f.id===selected);if(!f)return;if(!selection.has(selected))selection=new Set([selected]);expandSelection();const base=position(f,list),chosen=list.filter(f=>selection.has(f.id)||f.id===selected);let dx=changes.x===undefined?0:changes.x-base.x,dy=changes.y===undefined?0:changes.y-base.y;
    let dh=changes.height===undefined?0:changes.height-base.height;
    for(const item of chosen){const p=position(item,list);dh=Math.max(.3-p.height,Math.min(12-p.height,dh));dx=Math.max(-layout.width/2-p.x,Math.min(layout.width/2-p.x,dx));dy=Math.max(-p.y,Math.min(layout.depth-p.y,dy));}
    for(const item of chosen){const p=position(item,list);layout.positions[item.id]={...p,x:p.x+dx,y:p.y+dy,...(changes.height===undefined?{}:{height:p.height+dh})};}layout=stageLayout(layout);inspector();draw();if(save)persist();else onChange();}
  for(const key of ['width','depth'])q(key).onchange=()=>{if(!q(key).checkValidity()){q(key).reportValidity();q(key).value=layout[key];return;}const size=q(key).valueAsNumber;if(layout.assemblies.some(g=>g.members.some(id=>{const p=layout.positions[id];return key==='width'?Math.abs(p.x)>size/2:p.y>size;}))){q(key).value=layout[key];q('status').textContent='Die Gerätegruppe passt nicht in diese Maße. Bitte zuerst die Gruppe verschieben.';return;}layout=stageLayout({...layout,[key]:size});draw();inspector();persist();};
  for(const key of ['x','y','height'])q(key).onchange=()=>{if(!q(key).checkValidity()||!Number.isFinite(q(key).valueAsNumber)){q(key).reportValidity();inspector();return;}setPosition({[key]:q(key).valueAsNumber});};
  q('link').onclick=()=>{
    expandSelection();if(selection.size<2)return;
    const list=fixtures();for(const f of list.filter(f=>selection.has(f.id)))layout.positions[f.id]={...position(f,list)};
    layout.assemblies=layout.assemblies.filter(g=>!g.members.some(id=>selection.has(id)));
    layout.assemblies.push({id:crypto.randomUUID(),name:'Gerätegruppe '+(layout.assemblies.length+1),members:[...selection],rotation:0});
    inspector();draw();persist();
  };
  q('join').onclick=()=>{
    const group=layout.assemblies.find(g=>g.id===q('join-group').value);if(!group)return;
    expandSelection();const list=fixtures();for(const f of list.filter(f=>selection.has(f.id)))layout.positions[f.id]={...position(f,list)};
    const ids=new Set([...group.members,...selection]);
    layout.assemblies=layout.assemblies.filter(g=>g===group||!g.members.some(id=>selection.has(id)));
    group.members=[...ids];group.rotation=0;selection=ids;inspector();draw();persist();
  };
  q('detach').onclick=()=>{const g=assembly();if(!g)return;g.members=g.members.filter(id=>id!==selected);layout.assemblies=layout.assemblies.filter(g=>g.members.length>1);selection=new Set([selected]);inspector();draw();persist();};
  q('unlink').onclick=()=>{const g=assembly();if(!g)return;layout.assemblies=layout.assemblies.filter(v=>v!==g);inspector();draw();persist();};
  q('assembly-name').onchange=()=>{const g=assembly();if(!g)return;g.name=q('assembly-name').value.trim()||'Gerätegruppe';inspector();persist();};
  function rotate(degrees){const g=assembly();if(!g)return;const next=rotateAssembly(layout,g.id,degrees);if(!next){q('status').textContent='Für diese Drehung fehlt Platz. Verschiebe die Gruppe weiter in den Raum.';inspector();return;}layout=next;inspector();draw();persist();}
  q('rotation').onchange=()=>rotate(q('rotation').valueAsNumber);
  q('turn').onclick=()=>rotate((assembly()?.rotation||0)+90);
  q('device').onchange=()=>{selected=q('device').value;selection=new Set([selected]);inspector();draw();};
  q('reset-target').onclick=()=>{for(const id of selection)delete layout.targets[id];inspector();draw();persist();};
  q('symmetry').onclick=()=>{for(const f of fixtures().filter(f=>f.type==='moving'&&!assembly(f.id)))delete layout.positions[f.id];draw();inspector();persist();};
  q('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{for(let node=returnFocus?.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;returnFocus?.focus();});
  content.addEventListener('click',event=>{const groupButton=event.target.closest('[data-select-assembly]');if(groupButton){const group=layout.assemblies.find(g=>g.id===groupButton.dataset.selectAssembly);if(group){selected=group.members[0];selection=new Set(group.members);inspector();draw();}return;}const button=event.target.closest('[data-position-device]');if(!button)return;selected=button.dataset.positionDevice;selection=new Set([selected]);inspector();draw();q('device').focus();});
  content.addEventListener('change',e=>{const id=e.target.dataset.selectDevice;if(!id)return;if(e.target.checked){selection.add(id);selected=id;}else{for(const member of assembly(id)?.members||[id])selection.delete(member);if(!selection.has(selected))selected=[...selection][0]||id;}inspector();draw();});
  for(const [key,property] of [['name','name'],['group','group'],['gain','gain'],['motion','motionRange']])q(key).onchange=()=>{if(!q(key).checkValidity())return;onProperties([...selection],{[property]:key==='name'?q(key).value:Number(q(key).value)/(key==='motion'?100:1)});inspector();draw();};
  for(const axis of ['x','y'])q(`target-${axis}`).onchange=()=>{const value=q(`target-${axis}`).valueAsNumber;if(!Number.isFinite(value))return;for(const f of fixtures().filter(f=>selection.has(f.id)&&f.type!=='moving'))layout.targets[f.id]={...(layout.targets[f.id]||{x:position(f,fixtures()).x,y:layout.depth*.1}),[axis]:value};layout=stageLayout(layout);inspector();draw();persist();};
  return {
    attachZones(value){zones=value;content.querySelector('.stage-device-inventory')?.append(zones.panel);},
    getAims(){return Object.fromEntries(Object.entries(layout.targets).map(([id,p])=>[id,{x:p.x/layout.width+.5,y:p.y/layout.depth}]));},
    setAim(id,p){if(p)layout.targets[id]={x:(p.x-.5)*layout.width,y:p.y*layout.depth};else delete layout.targets[id];layout=stageLayout(layout);draw();persist();},
    attachEquipment(section){
      content.classList.add('stage-device-manager');
      const body=document.createElement('div');body.className='stage-device-manager-body';
      const inventory=document.createElement('section');inventory.className='stage-device-inventory';inventory.setAttribute('aria-label','Geräteliste');
      const placement=document.createElement('section');placement.className='stage-device-placement';placement.setAttribute('aria-label','Aufstellung');
      const title=document.createElement('h3');title.textContent='Aufstellung';placement.append(title);
      const dimensions=q('width').closest('.stage-layout-dimensions');
      while(dimensions.nextSibling)placement.append(dimensions.nextSibling);
      placement.insertBefore(dimensions,title.nextSibling);
      section.open=true;inventory.append(groupList,section);
      const hint=document.createElement('p');hint.className='small';hint.textContent='Scheinwerfer über die Kästchen auswählen und unter „Auswahl fest gruppieren“ zu einem eigenen Gerät zusammenfassen. Weitere Scheinwerfer lassen sich später hinzufügen.';inventory.append(hint);if(zones)inventory.append(zones.panel);
      body.append(inventory,placement);content.append(body);
    },
    mount(host){mounted=true;host.append(content);for(const key of ['width','depth'])q(key).value=layout[key];draw();inspector();return ()=>{mounted=false;dialog.append(content);};},
    setFixturePosition(id,changes){if(!fixtures().some(f=>f.id===id))return;selected=id;selection=new Set([id]);setPosition(changes);},
    get value(){return layout;},
    open(trigger=document.activeElement){returnFocus=trigger;for(const key of ['width','depth'])q(key).value=layout[key];if(!dialog.open)dialog.showModal();draw();inspector();},
    update(value){preview=value;scheduleDraw();},
    setLights(fixtures){fixtureLights.clear();for(const f of fixtures){const rgb=[0,1,2].map(c=>Math.round(f.cells.reduce((sum,rgb)=>sum+rgb[c],0)/Math.max(1,f.cells.length)));fixtureLights.set(`fixture-${f.id}`,rgb);}scheduleDraw();},
    destroy(){disposed=true;cancelAnimationFrame(drawFrame);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);dialog.remove();},
  };
}
