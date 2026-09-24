const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
export function zoneSettings(raw={}){
  const zones=(Array.isArray(raw?.zones)?raw.zones:[]).filter(z=>z&&typeof z==='object').slice(0,24).map((z,i)=>{
    const width=clamp(finite(z.width,.2),.02,1),depth=clamp(finite(z.depth,.2),.02,1);
    return {id:String(z.id||i),name:String(z.name||'Ruhezone').slice(0,60),x:clamp(finite(z.x,.4),0,1-width),y:clamp(finite(z.y,.4),0,1-depth),width,depth};
  });
  const aims={};for(const [id,p] of Object.entries(raw?.aims||{}))if(p&&typeof p==='object')aims[id]={x:clamp(finite(p.x,.5),0,1),y:clamp(finite(p.y,.5),0,1)};
  return {zones,aims};
}
export function zoneLights(lights,layout,settings){
  const low=layout.lightMin||0,w=layout.width,d=layout.depth,margin=.25;
  const boxes=settings.zones.map(z=>({left:(z.x-.5)*w-margin,right:(z.x+z.width-.5)*w+margin,bottom:z.y*d-margin,top:(z.y+z.depth)*d+margin}));
  const inside=p=>boxes.some(b=>p.x>=b.left&&p.x<=b.right&&p.y>=b.bottom&&p.y<=b.top);
  return lights.map(light=>{
    const aim=light.type!=='moving'&&settings.aims[light.id];
    let target=aim?{x:(aim.x-.5)*w,y:clamp(aim.y*d,low,d)}:{...light.target},power=light.power;
    // Moving heads are routed continuously by dmx-zone-motion.js.
    if(light.type!=='moving'&&inside(target))power*=.1;
    return {...light,target,power};
  });
}
export function createZonePlan(host,{getLayout,onChange,onPosition,getAims,onAim}){
  const key='anydj-3d-zones-v1';let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
  let settings=zoneSettings(saved),selected=settings.zones[0]?.id||'',fixtures=[],signature='',drag=null;
  const panel=document.createElement('section');panel.className='stage-3d-zone-plan';
  panel.innerHTML=`<h3>Zonen & Lichtrichtung</h3><p>Tische und Sitzbereiche markieren oder einen festen Scheinwerfer auswählen und sein Ziel im Plan setzen.</p><div class="stage-3d-zone-actions"><button type="button" class="button secondary" data-zone-add>Ruhezone hinzufügen</button><select data-zone-fixture aria-label="Scheinwerfer ausrichten"><option value="">Zonen bearbeiten</option></select></div><svg data-zone-map viewBox="0 0 300 240" aria-label="Zonenplan: Ruhezone verschieben oder Lichtziel setzen" role="img"><rect x="10" y="10" width="280" height="220" fill="#142b35" stroke="#638891"/><text x="150" y="25" text-anchor="middle" fill="#c5d7df">HINTEN</text><g data-zone-shapes></g><g data-zone-lights></g><text x="150" y="225" text-anchor="middle" fill="#c5d7df">VORNE</text></svg><p data-zone-help></p><div data-zone-fields><label>Ruhezone<select data-zone-select></select></label><label>Name<input data-zone-name maxlength="60"></label><div class="stage-3d-room-fields"><label>Von links (m)<input data-zone-x type="number" min="0" step="0.1"></label><label>Von vorne (m)<input data-zone-y type="number" min="0" step="0.1"></label><label>Breite (m)<input data-zone-width type="number" min="0.1" step="0.1"></label><label>Tiefe (m)<input data-zone-depth type="number" min="0.1" step="0.1"></label></div><button type="button" class="button secondary" data-zone-delete>Zone entfernen</button></div><div data-zone-aim hidden><p>Den offenen Zielkreis ziehen oder im Plan ein neues Lichtziel anklicken.</p><button type="button" class="button secondary" data-zone-reset>Ausrichtung zurücksetzen</button></div><p data-zone-status role="status"></p><small>Nur 3D-Vorschau: Moving Heads umfahren Ruhezonen mit flüssigen Wegen. Ist kein freier Weg möglich, wird weich abgeblendet. Feste Scheinwerfer bleiben ausgerichtet und werden dort abgedimmt. Lichtkegel und Schwenkwege können die Zonen weiterhin streifen.</small>`;
  host.querySelector('.stage-3d-room').append(panel);
  const q=n=>panel.querySelector(`[data-zone-${n}]`),map=q('map'),svg=(tag,attrs,parent)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  function setAim(id,p){if(onAim)onAim(id,p);else if(p)settings.aims[id]=p;else delete settings.aims[id];}
  function draw(){
    if(getAims)settings.aims=getAims();
    const layout=getLayout(),s=settings.zones.find(z=>z.id===selected);q('shapes').replaceChildren();
    for(const z of settings.zones){const x=10+z.x*280,y=10+(1-z.y-z.depth)*220,width=z.width*280,height=z.depth*220;
      const g=svg('g',{'data-zone-id':z.id},q('shapes'));svg('rect',{x,y,width,height,rx:3,fill:'#b66b4c',opacity:.6,stroke:z.id===selected?'#ffe2a9':'#dd9a79','stroke-width':z.id===selected?3:1},g);const title=svg('title',{},g);title.textContent=z.name;
      const label=svg('text',{x:x+5,y:y+Math.min(18,height-3),fill:'#fff1de','font-size':11,'pointer-events':'none'},g);label.textContent=width>35?z.name.slice(0,Math.max(2,Math.floor((width-10)/7))):'';
      if(z.id===selected)svg('rect',{x:x+width-8,y:y-1,width:9,height:9,fill:'#ffe2a9','data-zone-resize':''},g);
    }
    q('lights').replaceChildren();const id=q('fixture').value;
    for(const fixture of [...fixtures].sort((a,b)=>(a.id===id)-(b.id===id))){
      const active=fixture.id===id,aim=settings.aims[fixture.id]||{x:fixture.target.x/layout.width+.5,y:fixture.target.y/layout.depth};
      const x=10+(fixture.position.x/layout.width+.5)*280,y=10+(1-fixture.position.y/layout.depth)*220,tx=10+aim.x*280,ty=10+(1-Math.max(aim.y,(layout.lightMin||0)/layout.depth))*220;
      svg('line',{x1:x,y1:y,x2:tx,y2:ty,stroke:active?'#a5eee1':'#718c99','stroke-width':active?2.5:1.5},q('lights'));
      const body=svg('circle',{cx:x,cy:y,r:7,fill:active?'#edf5ff':'#9aafba','data-zone-device':fixture.id},q('lights'));svg('title',{},body).textContent='Gerät verschieben';
      const handle=svg('circle',{cx:tx,cy:ty,r:9,fill:'#142b35',stroke:active?'#a5eee1':'#9aafba','stroke-width':2,'data-zone-target':fixture.id},q('lights'));
      svg('title',{},handle).textContent=`${q('fixture').querySelector(`option[value="${CSS.escape(fixture.id)}"]`)?.textContent||'Scheinwerfer'}: Zielkreis ziehen`;
    }
    q('help').textContent=fixtures.length?'Gefüllten Punkt ziehen: Gerät verschieben. Offenen Kreis ziehen: Licht ausrichten.':'Keine festen Scheinwerfer vorhanden. Im Gerätemanager einen Scheinwerfer hinzufügen.';
    q('fields').hidden=!s||!!id;q('aim').hidden=!id;q('add').disabled=settings.zones.length>=24;
    q('select').replaceChildren(...settings.zones.map(z=>new Option(z.name,z.id)));q('select').value=selected;
    if(s){q('name').value=s.name;for(const n of ['x','y','width','depth'])q(n).value=(s[n]*(n==='x'||n==='width'?layout.width:layout.depth)).toFixed(1);}
  }
  function commit(){if(getAims)settings.aims=getAims();settings=zoneSettings(settings);try{localStorage.setItem(key,JSON.stringify(settings));q('status').textContent='Zonenplan gespeichert.';}catch{q('status').textContent='Zonenplan gilt für diese Sitzung.';}draw();onChange();}
  q('add').onclick=()=>{const z={id:crypto.randomUUID(),name:`Ruhezone ${settings.zones.length+1}`,x:.35,y:.35,width:.25,depth:.2};settings.zones.push(z);selected=z.id;q('fixture').value='';commit();};
  q('select').onchange=()=>{selected=q('select').value;draw();};q('fixture').onchange=draw;
  q('delete').onclick=()=>{settings.zones=settings.zones.filter(z=>z.id!==selected);selected=settings.zones[0]?.id||'';commit();};
  q('reset').onclick=()=>{setAim(q('fixture').value,null);commit();};
  for(const n of ['name','x','y','width','depth'])q(n).onchange=()=>{const z=settings.zones.find(z=>z.id===selected);if(!z)return;if(n==='name')z.name=q(n).value;else{if(!q(n).checkValidity()||!Number.isFinite(q(n).valueAsNumber)){draw();return;}z[n]=q(n).valueAsNumber/(n==='x'||n==='width'?getLayout().width:getLayout().depth);}commit();};
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse());return {x:clamp((p.x-10)/280,0,1),y:clamp(1-(p.y-10)/220,0,1)};};
  map.onpointerdown=e=>{if(e.button!==0)return;const p=point(e),body=e.target.closest('[data-zone-device]');if(body){e.preventDefault();q('fixture').value=body.dataset.zoneDevice;const f=fixtures.find(f=>f.id===body.dataset.zoneDevice),l=getLayout();drag={id:e.pointerId,device:body.dataset.zoneDevice,offset:{x:f.position.x/l.width+.5-p.x,y:f.position.y/l.depth-p.y}};if(e.buttons)map.setPointerCapture(e.pointerId);draw();return;}const handle=e.target.closest('[data-zone-target]');if(handle)q('fixture').value=handle.dataset.zoneTarget;const id=q('fixture').value;if(id){e.preventDefault();drag={id:e.pointerId,fixture:id};if(e.buttons)map.setPointerCapture(e.pointerId);p.y=Math.max(p.y,(getLayout().lightMin||0)/getLayout().depth);setAim(id,p);commit();return;}const node=e.target.closest('[data-zone-id]');if(!node)return;e.preventDefault();selected=node.dataset.zoneId;const z=settings.zones.find(z=>z.id===selected);drag={id:e.pointerId,p,z:{...z},resize:e.target.hasAttribute('data-zone-resize')};map.setPointerCapture(e.pointerId);draw();};
  map.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e);if(drag.device){onPosition?.(drag.device,{x:clamp(p.x+drag.offset.x,0,1),y:clamp(p.y+drag.offset.y,0,1)});return;}if(drag.fixture){p.y=Math.max(p.y,(getLayout().lightMin||0)/getLayout().depth);setAim(drag.fixture,p);commit();return;}const z=settings.zones.find(z=>z.id===selected),dx=p.x-drag.p.x,dy=p.y-drag.p.y;if(drag.resize){z.width=clamp(drag.z.width+dx,.02,1-z.x);z.depth=clamp(drag.z.depth+dy,.02,1-z.y);}else{z.x=clamp(drag.z.x+dx,0,1-z.width);z.y=clamp(drag.z.y+dy,0,1-z.depth);}commit();};
  map.onpointerup=map.onpointercancel=map.onlostpointercapture=()=>{drag=null;};draw();
  return {panel,selectZone(id){selected=id;q('fixture').value='';draw();},setZone(id,changes){const z=settings.zones.find(z=>z.id===id);if(z){Object.assign(z,changes);commit();}},get value(){return {...settings,aims:getAims?.()||settings.aims};},update(lights){const groups=new Map();for(const l of lights.filter(l=>l.type!=='moving')){if(!groups.has(l.id))groups.set(l.id,[]);groups.get(l.id).push(l);}fixtures=[...groups.values()].map(cells=>({...cells[0],position:{...cells[0].position,x:cells.reduce((sum,l)=>sum+l.position.x,0)/cells.length}}));const next=JSON.stringify([getLayout(),fixtures.map(f=>[f.id,f.position,f.target])]);if(next===signature)return;signature=next;const id=q('fixture').value;q('fixture').replaceChildren(new Option('Zonen bearbeiten',''),...fixtures.map((f,i)=>new Option(`${f.type==='bar'?'Lichtleiste':'Scheinwerfer'} ${i+1}`,f.id)));q('fixture').value=fixtures.some(f=>f.id===id)?id:'';draw();},destroy(){panel.remove();}};
}
