const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,f,a,b)=>clamp(Number.isFinite(v)?v:f,a,b);
export function roomSettings(value={},layout={width:8,depth:6}){
  const depth=number(value?.depth,Math.max(4,layout.depth*2),2,60);
  return {enabled:value?.enabled===true,width:number(value?.width,layout.width,2,60),depth,height:number(value?.height,4,2,15),reach:number(value?.reach,depth,.5,depth)};
}
export function roomLayout(room){
  return {width:room.width,depth:room.depth,height:room.height,positions:{},room:true,lightMin:room.depth-room.reach};
}
export function roomLights(lights,source,room){
  const low=room.depth-room.reach;
  return lights.map(light=>({...light,
    position:{x:clamp(light.position.x/source.width*room.width,-room.width/2,room.width/2),y:clamp(light.position.y/source.depth*room.depth,0,room.depth),height:clamp(light.position.height,.3,room.height-.3)},
    target:{x:clamp(light.target.x/source.width*room.width,-room.width/2,room.width/2),y:low+clamp(light.target.y/source.depth,0,1)*room.reach}}));
}
export function createRoomSettings(host,{getLayout,onChange}){
  const key='anydj-3d-room-v1';let saved;
  try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  let value=roomSettings(saved,getLayout());
  const details=document.createElement('details');details.className='stage-3d-room';
  details.innerHTML='<summary>Raum & Lichtfläche</summary><label class="stage-3d-room-enable"><input data-room-enabled type="checkbox"> Gemeinsamer Club-Raum · Tanzfläche und Lichtfläche kombinieren</label><div class="stage-3d-room-fields"><label>Breite (m)<input data-room-width type="number" min="2" max="60" step="0.1" required></label><label>Länge (m)<input data-room-depth type="number" min="2" max="60" step="0.1" required></label><label>Höhe (m)<input data-room-height type="number" min="2" max="15" step="0.1" required></label><label>Licht reicht (m)<input data-room-reach type="range" min="0.5" step="0.1"><output data-room-distance></output></label></div><svg data-room-map viewBox="0 0 240 180" role="img" aria-label="Raumplan: Lichtgrenze nach vorne oder hinten ziehen"><rect x="10" y="10" width="220" height="160" fill="#152c35" stroke="#638891"/><rect data-room-lit x="10" y="10" width="220" fill="#39786c" opacity=".6"/><text x="120" y="27" text-anchor="middle" fill="#edf6fa">RAUM HINTEN</text><g data-room-boundary><line x1="10" x2="230" stroke="#b8ffe6" stroke-width="3"/><rect x="10" y="-12" width="220" height="24" fill="transparent"/><rect x="90" y="-5" width="60" height="10" rx="5" fill="#b8ffe6"/></g><text x="120" y="159" text-anchor="middle" fill="#edf6fa">VORNE</text></svg><p>Grüne Fläche: Lichtbereich. Ziehe die helle Grenze, um ihn anzupassen.</p><details class="stage-3d-detail"><summary>Hinweise zur Vorschau</summary><p>Die ganze Raumfläche bleibt begehbar. Gerätepositionen werden aus dem Aufbau proportional übernommen. Raum und Lichtgrenze gelten nur für die 3D-Vorschau.</p></details><p data-room-status role="status"></p>';
  host.querySelector('.stage-3d-tools').after(details);
  const q=name=>details.querySelector(`[data-room-${name}]`),map=q('map');let drag=null;
  function sync(){
    q('enabled').checked=value.enabled;
    for(const name of ['width','depth','height','reach']){q(name).value=value[name];q(name).disabled=!value.enabled;}
    q('reach').max=value.depth;q('distance').textContent=`${value.reach.toFixed(1)} m von hinten · Grenze ${(value.depth-value.reach).toFixed(1)} m von vorne`;
    map.toggleAttribute('hidden',!value.enabled);q('lit').setAttribute('height',160*value.reach/value.depth);q('boundary').setAttribute('transform',`translate(0 ${10+160*value.reach/value.depth})`);
  }
  function commit(changes){value=roomSettings({...value,...changes},getLayout());sync();try{localStorage.setItem(key,JSON.stringify(value));q('status').textContent='Raum gespeichert.';}catch{q('status').textContent='Raum gilt für diese Sitzung; Speichern nicht möglich.';}onChange();}
  q('enabled').onchange=()=>commit({enabled:q('enabled').checked});
  for(const name of ['width','depth','height'])q(name).onchange=()=>{if(!q(name).checkValidity()){q(name).reportValidity();q(name).value=value[name];return;}commit({[name]:q(name).valueAsNumber});};
  q('reach').oninput=()=>commit({reach:Number(q('reach').value)});
  const move=e=>{const matrix=map.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());commit({reach:Math.round((point.y-10)/160*value.depth*10)/10});};
  map.onpointerdown=e=>{if(e.button!==0||!value.enabled)return;drag=e.pointerId;map.setPointerCapture(drag);move(e);};
  map.onpointermove=e=>{if(e.pointerId===drag)move(e);};
  map.onpointerup=map.onpointercancel=map.onlostpointercapture=()=>{drag=null;};
  sync();
  return {get value(){return value;},destroy(){details.remove();}};
}
