// Physical output is opt-in and separate from the visual demo.
export function createDmxConnection(parent,onEnable=()=>{}){
  const root=document.createElement('section');root.className='stage-hardware';
  root.innerHTML=`<h3>Echte Lampen verbinden</h3><p>USB zuerst: Schließe ein von OLA unterstütztes USB-DMX-Interface an. Für LAN wähle einen in OLA eingerichteten Art-Net- oder sACN-Ausgang.</p><label>DMX-Ausgang <select aria-label="DMX-Ausgang"></select></label><p role="status" class="dmx-connection-status"></p><button type="button" class="button primary">DMX-Ausgabe einschalten</button><details><summary>Einrichtung und Gerätebelegung</summary><p>Einmalig den lokalen OLA-Dienst installieren und passende USB- bzw. Netzwerk-Plugins aktivieren. AnyDj sucht automatisch auf Port 9090. OLA gehört nicht zum App-Paket.</p><p>Stelle an den Scheinwerfern den Modus Helligkeit/Rot/Grün/Blau (4 Kanäle), an Lichtleisten RGB pro Segment ein. Startadressen stehen unten in der Gerätetabelle. Andere Kanalbelegungen werden derzeit nicht unterstützt.</p><p>Erkannt wird das Interface, nicht jeder angeschlossene Scheinwerfer. Bei LAN bestätigt die Anzeige den lokalen Ausgang, nicht den Empfang am Lichtgerät. Nach einer Trennung die Ausgabe erneut einschalten.</p><a href="https://www.openlighting.org/ola/getting-started/using-ola/" target="_blank" rel="noopener">OLA einrichten</a></details>`;
  parent.append(root);
  const select=root.querySelector('select'),button=root.querySelector('button'),status=root.querySelector('[role=status]');
  const web=document.documentElement.dataset.edition==='web';
  let generation=0,connectionError='',id=null,state=null,latest=new Uint8Array(512),busy=false,sending=false,disposed=false,message='',previewDemo=false,polling=false;
  async function api(path,body,keepalive=false){
    let token='';try{token=sessionStorage.getItem('wiz-web-token')||'';}catch{}
    const res=await fetch('/api/dmx/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),keepalive,signal:AbortSignal.timeout(4000)});
    const data=await res.json();if(!res.ok)throw Error(data.error?.message||data.error||'DMX-Verbindung fehlgeschlagen.');return data;
  }
  function draw(){
    const selected=select.value;select.replaceChildren();
    for(const p of [...(state?.outputs||[])].sort((a,b)=>(a.kind==='lan')-(b.kind==='lan'))){
      const option=document.createElement('option');option.value=p.id;option.textContent=`${p.kind==='lan'?'LAN':'USB / lokal'} · ${p.name} ${p.description}${p.online?'':' · getrennt'}`;option.disabled=!p.online||!p.ready;option.title=p.reason||'';select.append(option);
    }
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    else if([...select.options].some(o=>!o.disabled))select.value=[...select.options].find(o=>!o.disabled).value;
    if(!select.options.length){const o=document.createElement('option');o.textContent='Noch kein Ausgang erkannt';o.value='';select.append(o);}
    select.disabled=busy||Boolean(id)||Boolean(state?.active);
    button.textContent=id?'DMX-Ausgabe ausschalten':'DMX-Ausgabe einschalten';
    button.disabled=busy||web||Boolean(state?.demo)||(!id&&(previewDemo||state?.active||!state?.outputs?.some(p=>p.id===select.value&&p.online&&p.ready)));
    const chosen=state?.outputs?.find(p=>p.id===select.value);
    status.textContent=connectionError||message||state?.outputError||(web?'Echte DMX-Ausgabe benötigt die lokale App.':state?.demo?'App-Demo: Echte DMX-Ausgabe ist deaktiviert.':id?'DMX-Ausgabe aktiv · folgt deiner Musik.':state?.active?'DMX-Ausgabe wird in einem anderen Fenster gesteuert.':previewDemo?'Visuelle Demo läuft. Für echte Lampen Demo beenden und Musik starten.':state?.error||chosen?.reason||(chosen?.online?'Ausgang verfügbar · zum Start einschalten.':'Suche nach DMX-Ausgängen …'));
  }
  async function poll(){
    if(web||disposed||polling)return;polling=true;
    try{state=await api('status');connectionError='';if(id&&!state.active)id=null;draw();}catch(e){connectionError=e.message;draw();}finally{polling=false;}
  }
  async function stop(reason='',keepalive=false){
    generation++;const old=id;id=null;latest=new Uint8Array(512);message=reason;draw();
    if(old)try{state=await api('stop',{id:old},keepalive);}catch(e){message=e.message;}draw();
  }
  button.onclick=async()=>{
    busy=true;message='';draw();
    try{if(id)await stop();else{const attempt=generation;const result=await api('start',{target:select.value});if(disposed||attempt!==generation){await api('stop',{id:result.id},true);return;}state=result;id=result.id;onEnable();}}
    catch(e){message=e.message;}finally{busy=false;draw();}
  };
  select.onchange=()=>{message='';draw();};
  const sendTimer=setInterval(async()=>{
    if(!id||sending||disposed)return;sending=true;const session=id;
    try{await api('frame',{id:session,channels:Array.from(latest)});}catch(e){if(id===session)await stop(e.message);}finally{sending=false;}
  },100);
  const pollTimer=web?null:setInterval(()=>void poll(),2500);
  draw();void poll();
  return {
    get enabled(){return Boolean(id);},
    push(frame){latest=frame;},
    setDemo(value){if(value===previewDemo)return;previewDemo=value;if(!value)message='';if(value)void stop('Visuelle Demo gestartet · DMX-Ausgabe ausgeschaltet.');draw();},
    stop,
    destroy(){disposed=true;clearInterval(sendTimer);clearInterval(pollTimer);void stop('',true);root.remove();},
  };
}
