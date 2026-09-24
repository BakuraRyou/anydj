import {stageLayout,fixturePosition} from './dmx-layout-model.js';
const NS='http://www.w3.org/2000/svg',KEY='anydj-stage-layout-v1';
const svgNode=(name,attrs={})=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
export function createStageLayout({getFixtures=()=>[],onChange=()=>{}}={}){
  let layout=stageLayout(),selected='moving-0',preview=[],drag=null,signature='',nodes=new Map(),returnFocus;
  const fixtureLights=new Map();
  try{layout=stageLayout(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{}
  const dialog=document.createElement('dialog');dialog.className='stage-layout-dialog';dialog.id='stageLayoutDialog';dialog.setAttribute('aria-labelledby','stageLayoutTitle');
  dialog.innerHTML=`<div class="stage-layout-heading"><div><span class="stage-badge">BÜHNENAUFBAU</span><h2 id="stageLayoutTitle">Bühne & Geräte aufstellen</h2></div><button type="button" class="button secondary" data-layout-close>Schließen</button></div>
  <p>Ziehe die Geräte an ihre Position. Die Draufsicht zeigt ihre tatsächlichen Abstände und die Lichtziele auf dem Bühnenboden.</p>
  <div class="stage-layout-dimensions"><label>Bühnenbreite (m)<input data-layout-width type="number" min="2" max="30" step="0.1"></label><label>Bühnentiefe (m)<input data-layout-depth type="number" min="2" max="30" step="0.1"></label><button type="button" class="button secondary" data-layout-symmetry>Moving Heads symmetrisch aufstellen</button></div>
  <div class="stage-layout-workspace"><div class="stage-layout-map"><svg data-layout-map role="group" aria-label="Bühnenplan. Gerät auswählen und ziehen oder mit Pfeiltasten verschieben."></svg><p class="small">Draufsicht · Publikum unten · Raster 1 m<br>MH = Moving Head · S = Scheinwerfer · L = Lichtleiste</p></div>
  <fieldset class="stage-layout-inspector"><legend>Gerät positionieren</legend><label>Gerät<select data-layout-device></select></label><label>Links / rechts (m)<input data-layout-x type="number" step="0.1"></label><label>Abstand zur Vorderkante (m)<input data-layout-y type="number" step="0.1"></label><label>Montagehöhe (m)<input data-layout-height type="number" min="0.3" max="12" step="0.1"></label><p data-layout-aim class="small"></p><p class="small">Pfeiltasten: 10 cm · Umschalt: 50 cm. Die Mitte der Bühne ist X = 0.</p></fieldset></div>
  <p data-layout-status role="status">Änderungen werden automatisch gespeichert.</p><p class="small">Geometrische Vorschau mit generischen Geräten. Gehäuse, Optik und mechanische Grenzen sind nicht herstellerspezifisch nachgebildet.</p>`;
  const content=document.createElement('div');content.className='stage-layout-content';content.append(...dialog.childNodes);dialog.append(content);
  let mounted=false;
  document.body.append(dialog);
  const q=name=>content.querySelector(`[data-layout-${name}]`),svg=q('map');
  for(const input of dialog.querySelectorAll('input'))input.required=true;
  function fixtures(){return [...Array.from({length:4},(_,i)=>({id:`moving-${i}`,name:`Moving Head ${i+1}`,label:`MH${i+1}`,type:'moving'})),...getFixtures().map(f=>({id:`fixture-${f.id}`,name:f.name,label:(f.type==='bar'?'L':'S')+(f.name.match(/\d+$/)?.[0]||'1'),type:f.type}))];}
  function position(f,list){const group=list.filter(v=>v.type===f.type),p=fixturePosition(layout,f.id,group.indexOf(f),group.length);return layout.positions[f.id]||{...p,y:layout.depth*(f.type==='moving'?.85:f.type==='bar'?.25:.55)};}
  function lightFor(f,list){
    if(f.type==='moving')return preview.find(v=>v.id===f.id);
    const rgb=fixtureLights.get(f.id);if(!rgb)return null;
    const p=position(f,list),target={x:p.x,y:layout.depth*.1},dy=p.y-target.y;
    return {target,color:`rgb(${rgb.join(',')})`,power:Math.max(...rgb)>0?1:0,pan:0,tilt:Math.atan2(p.height,Math.abs(dy))*180/Math.PI,distance:Math.hypot(dy,p.height)};
  }
  function point(p){return {x:p.x+layout.width/2,y:layout.depth-p.y};}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(layout));q('status').textContent='Bühnenaufbau gespeichert.';}catch{q('status').textContent='Speichern nicht möglich. Der Aufbau gilt für diese Sitzung.';}onChange();}
  function inspector(){
    const list=fixtures(),f=list.find(f=>f.id===selected)||list[0];selected=f.id;
    const p=position(f,list);q('device').value=selected;
    for(const key of ['x','y','height'])q(key).value=p[key].toFixed(2);
    q('x').min=-layout.width/2;q('x').max=layout.width/2;q('y').min=0;q('y').max=layout.depth;
  }
  function draw(){
    if(!dialog.open&&!mounted)return;
    const list=fixtures(),key=JSON.stringify([layout.width,layout.depth,list]);
    if(signature!==key){
      signature=key;nodes.clear();svg.replaceChildren();q('device').replaceChildren();
      svg.setAttribute('viewBox',`-0.65 -0.65 ${layout.width+1.3} ${layout.depth+1.65}`);
      svg.style.aspectRatio=String((layout.width+1.3)/(layout.depth+1.65));
      svg.append(svgNode('rect',{x:0,y:0,width:layout.width,height:layout.depth,fill:'#101f2c',stroke:'#7893a5','stroke-width':.04}));
      for(let x=1;x<layout.width;x++)svg.append(svgNode('line',{x1:x,x2:x,y1:0,y2:layout.depth,stroke:'#253d4d','stroke-width':.02}));
      for(let y=1;y<layout.depth;y++)svg.append(svgNode('line',{x1:0,x2:layout.width,y1:y,y2:y,stroke:'#253d4d','stroke-width':.02}));
      const front=svgNode('text',{x:layout.width/2,y:layout.depth+.65,'text-anchor':'middle','font-size':.27,fill:'#acc5d3'});front.textContent='VORDERKANTE · PUBLIKUM';svg.append(front);
      const beams=svgNode('g',{'pointer-events':'none'});svg.append(beams);
      for(const f of list){
        q('device').add(new Option(f.name,f.id));
        const beam=svgNode('line',{'stroke-width':.07,opacity:0}),target=svgNode('circle',{r:.13,fill:'none','stroke-width':.04,opacity:0});beams.append(beam,target);
        const node=svgNode('g',{tabindex:0,role:'button','aria-label':`${f.name} positionieren`,'data-layout-fixture':f.id});
        node.append(svgNode(f.type==='bar'?'rect':'circle',f.type==='bar'?{x:-.35,y:-.13,width:.7,height:.26,rx:.06}:{r:.22}));
        const label=svgNode('text',{y:-.35,'text-anchor':'middle','font-size':.24,fill:'#e8f3fa'});label.textContent=f.label;node.append(label);svg.append(node);
        node.append(svgNode('circle',{'data-layout-hit':'',r:.4,fill:'transparent'}));
        node.addEventListener('pointerdown',e=>{e.preventDefault();selected=f.id;drag={id:f.id,pointer:e.pointerId};node.setPointerCapture(e.pointerId);node.focus();inspector();draw();});
        node.addEventListener('pointermove',e=>{if(drag?.id!==f.id||drag.pointer!==e.pointerId)return;const matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());setPosition({x:Math.round((p.x-layout.width/2)*10)/10,y:Math.round((layout.depth-p.y)*10)/10},false);});
        const end=()=>{if(drag?.id===f.id){drag=null;persist();}};
        node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end);
        node.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selected=f.id;inspector();draw();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();selected=f.id;const p=position(f,fixtures()),step=e.shiftKey?.5:.1;setPosition({x:p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:p.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)});});
        nodes.set(f.id,{node,beam,target});
      }
      inspector();
    }
    for(const f of list){const p=point(position(f,list)),{node,beam,target}=nodes.get(f.id);node.setAttribute('transform',`translate(${p.x} ${p.y})`);node.setAttribute('aria-pressed',String(f.id===selected));node.firstChild.setAttribute('fill',f.id===selected?'#b4ebcf':f.type==='moving'?'#427ea0':'#526170');node.firstChild.setAttribute('stroke','#d9edf7');node.firstChild.setAttribute('stroke-width',.035);node.querySelector('[data-layout-hit]').setAttribute('r',Math.max(.3,(layout.width+1.3)*16/(svg.clientWidth||600)));
      const light=lightFor(f,list);if(light){const t=point(light.target);for(const [key,value] of Object.entries({x1:p.x,y1:p.y,x2:t.x,y2:t.y,stroke:light.color,opacity:light.power}))beam.setAttribute(key,value);for(const [key,value] of Object.entries({cx:t.x,cy:t.y,stroke:light.color,opacity:light.power}))target.setAttribute(key,value);}else{beam.setAttribute('opacity',0);target.setAttribute('opacity',0);}}
    const selectedFixture=list.find(f=>f.id===selected),aim=selectedFixture&&lightFor(selectedFixture,list);
    q('aim').textContent=aim?`Pan ${aim.pan.toFixed(1)}° · Tilt ${aim.tilt.toFixed(1)}° · Lichtweg ${aim.distance.toFixed(2)} m`:'Starte einen Track oder die Demo, um die Lichtziele zu sehen.';
  }
  function setPosition(changes,save=true){const list=fixtures(),f=list.find(f=>f.id===selected);if(!f)return;layout=stageLayout({...layout,positions:{...layout.positions,[selected]:{...position(f,list),...changes}}});inspector();draw();if(save)persist();else onChange();}
  for(const key of ['width','depth'])q(key).onchange=()=>{if(!q(key).checkValidity()){q(key).reportValidity();q(key).value=layout[key];return;}layout=stageLayout({...layout,[key]:q(key).valueAsNumber});draw();inspector();persist();};
  for(const key of ['x','y','height'])q(key).onchange=()=>{if(!q(key).checkValidity()||!Number.isFinite(q(key).valueAsNumber)){q(key).reportValidity();inspector();return;}setPosition({[key]:q(key).valueAsNumber});};
  q('device').onchange=()=>{selected=q('device').value;inspector();draw();};
  q('symmetry').onclick=()=>{for(let i=0;i<4;i++)delete layout.positions[`moving-${i}`];draw();inspector();persist();};
  q('close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{for(let node=returnFocus?.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;returnFocus?.focus();});
  return {
    mount(host){mounted=true;host.append(content);for(const key of ['width','depth'])q(key).value=layout[key];draw();inspector();return ()=>{mounted=false;dialog.append(content);};},
    get value(){return layout;},
    open(trigger=document.activeElement){returnFocus=trigger;for(const key of ['width','depth'])q(key).value=layout[key];if(!dialog.open)dialog.showModal();draw();inspector();},
    update(value){preview=value;draw();},
    setLights(fixtures){fixtureLights.clear();for(const f of fixtures){const rgb=[0,1,2].map(c=>Math.round(f.cells.reduce((sum,rgb)=>sum+rgb[c],0)/Math.max(1,f.cells.length)));fixtureLights.set(`fixture-${f.id}`,rgb);}draw();},
    destroy(){dialog.remove();},
  };
}
