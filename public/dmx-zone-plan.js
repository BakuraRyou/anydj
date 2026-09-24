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
    if(inside(target)){
      if(light.type==='moving'){
        const candidates=boxes.flatMap(b=>[{x:b.left-.01,y:target.y},{x:b.right+.01,y:target.y},{x:target.x,y:b.bottom-.01},{x:target.x,y:b.top+.01},...[[b.left-.01,b.bottom-.01],[b.left-.01,b.top+.01],[b.right+.01,b.bottom-.01],[b.right+.01,b.top+.01]].map(([x,y])=>({x,y}))]).filter(p=>p.x>=-w/2&&p.x<=w/2&&p.y>=low&&p.y<=d&&!inside(p));
        candidates.sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y));
        if(candidates.length)target=candidates[0];else power*=.1;
      }else power*=.1;
    }
    return {...light,target,power};
  });
}
export function createZonePlan(host,{getLayout,onChange}){
  const key='anydj-3d-zones-v1';let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
  let settings=zoneSettings(saved),selected=settings.zones[0]?.id||'',fixtures=[],signature='',drag=null;
  const panel=document.createElement('section');panel.className='stage-3d-zone-plan';
  panel.innerHTML=`<h3>Zonen & Lichtrichtung</h3><p>Tische und Sitzbereiche markieren oder einen festen Scheinwerfer auswählen und sein Ziel im Plan setzen.</p><div class="stage-3d-zone-actions"><button type="button" class="button secondary" data-zone-add>Ruhezone hinzufügen</button><select data-zone-fixture aria-label="Scheinwerfer ausrichten"><option value="">Zonen bearbeiten</option></select></div><svg data-zone-map viewBox="0 0 300 240" aria-label="Zonenplan: Ruhezone verschieben oder Lichtziel setzen" role="img"><rect x="10" y="10" width="280" height="220" fill="#142b35" stroke="#638891"/><text x="150" y="25" text-anchor="middle" fill="#c5d7df">HINTEN</text><g data-zone-shapes></g><g data-zone-lights></g><text x="150" y="225" text-anchor="middle" fill="#c5d7df">VORNE</text></svg><div data-zone-fields><label>Ruhezone<select data-zone-select></select></label><label>Name<input data-zone-name maxlength="60"></label><div class="stage-3d-room-fields"><label>Von links (m)<input data-zone-x type="number" min="0" step="0.1"></label><label>Von vorne (m)<input data-zone-y type="number" min="0" step="0.1"></label><label>Breite (m)<input data-zone-width type="number" min="0.1" step="0.1"></label><label>Tiefe (m)<input data-zone-depth type="number" min="0.1" step="0.1"></label></div><button type="button" class="button secondary" data-zone-delete>Zone entfernen</button></div><div data-zone-aim hidden><p>Im Plan das gewünschte Lichtziel anklicken. Die Linie zeigt die Ausrichtung.</p><button type="button" class="button secondary" data-zone-reset>Ausrichtung zurücksetzen</button></div><p data-zone-status role="status"></p><small>Nur 3D-Vorschau: Moving Heads weichen den Zielen in Ruhezonen mit 25 cm Rand aus. Feste Scheinwerfer bleiben ausgerichtet und werden dort abgedimmt. Lichtkegel und Schwenkwege können die Zonen weiterhin streifen.</small>`;
  host.querySelector('.stage-3d-room').append(panel);
  const q=n=>panel.querySelector(`[data-zone-${n}]`),map=q('map'),svg=(tag,attrs,parent)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  function draw(){
    const layout=getLayout(),s=settings.zones.find(z=>z.id===selected);q('shapes').replaceChildren();
    for(const z of settings.zones){const x=10+z.x*280,y=10+(1-z.y-z.depth)*220,width=z.width*280,height=z.depth*220;
      const g=svg('g',{'data-zone-id':z.id},q('shapes'));svg('rect',{x,y,width,height,rx:3,fill:'#b66b4c',opacity:.6,stroke:z.id===selected?'#ffe2a9':'#dd9a79','stroke-width':z.id===selected?3:1},g);const title=svg('title',{},g);title.textContent=z.name;
      const label=svg('text',{x:x+5,y:y+Math.min(18,height-3),fill:'#fff1de','font-size':11,'pointer-events':'none'},g);label.textContent=width>35?z.name.slice(0,Math.max(2,Math.floor((width-10)/7))):'';
      if(z.id===selected)svg('rect',{x:x+width-8,y:y-1,width:9,height:9,fill:'#ffe2a9','data-zone-resize':''},g);
    }
    q('lights').replaceChildren();const id=q('fixture').value,fixture=fixtures.find(f=>f.id===id);
    if(fixture){const aim=settings.aims[id]||{x:fixture.target.x/layout.width+.5,y:fixture.target.y/layout.depth};const x=10+(fixture.position.x/layout.width+.5)*280,y=10+(1-fixture.position.y/layout.depth)*220,tx=10+aim.x*280,ty=10+(1-Math.max(aim.y,(layout.lightMin||0)/layout.depth))*220;svg('line',{x1:x,y1:y,x2:tx,y2:ty,stroke:'#a5eee1','stroke-width':2},q('lights'));svg('circle',{cx:x,cy:y,r:5,fill:'#edf5ff'},q('lights'));svg('circle',{cx:tx,cy:ty,r:7,fill:'none',stroke:'#a5eee1','stroke-width':2},q('lights'));}
    q('fields').hidden=!s||!!id;q('aim').hidden=!id;q('add').disabled=settings.zones.length>=24;
    q('select').replaceChildren(...settings.zones.map(z=>new Option(z.name,z.id)));q('select').value=selected;
    if(s){q('name').value=s.name;for(const n of ['x','y','width','depth'])q(n).value=(s[n]*(n==='x'||n==='width'?layout.width:layout.depth)).toFixed(1);}
  }
  function commit(){settings=zoneSettings(settings);try{localStorage.setItem(key,JSON.stringify(settings));q('status').textContent='Zonenplan gespeichert.';}catch{q('status').textContent='Zonenplan gilt für diese Sitzung.';}draw();onChange();}
  q('add').onclick=()=>{const z={id:crypto.randomUUID(),name:`Ruhezone ${settings.zones.length+1}`,x:.35,y:.35,width:.25,depth:.2};settings.zones.push(z);selected=z.id;q('fixture').value='';commit();};
  q('select').onchange=()=>{selected=q('select').value;draw();};q('fixture').onchange=draw;
  q('delete').onclick=()=>{settings.zones=settings.zones.filter(z=>z.id!==selected);selected=settings.zones[0]?.id||'';commit();};
  q('reset').onclick=()=>{delete settings.aims[q('fixture').value];commit();};
  for(const n of ['name','x','y','width','depth'])q(n).onchange=()=>{const z=settings.zones.find(z=>z.id===selected);if(!z)return;if(n==='name')z.name=q(n).value;else{if(!q(n).checkValidity()||!Number.isFinite(q(n).valueAsNumber)){draw();return;}z[n]=q(n).valueAsNumber/(n==='x'||n==='width'?getLayout().width:getLayout().depth);}commit();};
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse());return {x:clamp((p.x-10)/280,0,1),y:clamp(1-(p.y-10)/220,0,1)};};
  map.onpointerdown=e=>{if(e.button!==0)return;const p=point(e),id=q('fixture').value;if(id){p.y=Math.max(p.y,(getLayout().lightMin||0)/getLayout().depth);settings.aims[id]=p;commit();return;}const node=e.target.closest('[data-zone-id]');if(!node)return;e.preventDefault();selected=node.dataset.zoneId;const z=settings.zones.find(z=>z.id===selected);drag={id:e.pointerId,p,z:{...z},resize:e.target.hasAttribute('data-zone-resize')};map.setPointerCapture(e.pointerId);draw();};
  map.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e),z=settings.zones.find(z=>z.id===selected),dx=p.x-drag.p.x,dy=p.y-drag.p.y;if(drag.resize){z.width=clamp(drag.z.width+dx,.02,1-z.x);z.depth=clamp(drag.z.depth+dy,.02,1-z.y);}else{z.x=clamp(drag.z.x+dx,0,1-z.width);z.y=clamp(drag.z.y+dy,0,1-z.depth);}commit();};
  map.onpointerup=map.onpointercancel=map.onlostpointercapture=()=>{drag=null;};draw();
  return {get value(){return settings;},update(lights){fixtures=[...new Map(lights.filter(l=>l.type!=='moving').map(l=>[l.id,l])).values()];const next=JSON.stringify([getLayout(),fixtures.map(f=>[f.id,f.position,f.target])]);if(next===signature)return;signature=next;const id=q('fixture').value;q('fixture').replaceChildren(new Option('Zonen bearbeiten',''),...fixtures.map((f,i)=>new Option(`${f.type==='bar'?'Lichtleiste':'Scheinwerfer'} ${i+1}`,f.id)));q('fixture').value=fixtures.some(f=>f.id===id)?id:'';draw();},destroy(){panel.remove();}};
}
