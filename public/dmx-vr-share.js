const resumeKey='anydj-vr-share-resume';
export function createVRShare(host,{getScene,onCommand=()=>{},onStateChange=()=>{}}){
  const root=document.createElement('details');root.className='stage-vr-share';root.innerHTML='<summary>VR-Vorschau verbinden</summary><p>Übertrage diesen Aufbau und die laufende Lichtshow. Musik bleibt am Rechner.</p><button type="button" class="button secondary" data-share-start>Übertragung starten</button><div data-share-links hidden><label>Im Headset öffnen<select aria-label="Vorschau-Adresse"></select></label><input type="text" readonly aria-label="Adresse für die VR-Vorschau"><button type="button" class="button secondary" data-share-copy>Adresse kopieren</button><p>Kopplungscode: <output data-share-code></output></p><p data-share-network></p><p><a data-share-test target="_blank" rel="noopener">Testzugang ohne Code öffnen</a></p></div><p data-share-resume>Eine laufende Übertragung startet beim nächsten App-Start automatisch. „Übertragung beenden“ schaltet den automatischen Start aus.</p><p role="status"></p>';
  host.append(root);const button=root.querySelector('[data-share-start]'),status=root.querySelector('[role=status]'),links=root.querySelector('[data-share-links]'),select=root.querySelector('select'),input=root.querySelector('input');
  let commandMessage='',commandMessageId=0,ack=[];const applied=new Set();
  let session=null,sending=false,disposed=false,suspended=false,busy=false,epoch=0,nextSend=0,retryAt=0,wanted=false;
  try{wanted=localStorage.getItem(resumeKey)==='true';}catch{}
  function remember(value){wanted=value;try{localStorage.setItem(resumeKey,String(value));}catch{root.querySelector('[data-share-resume]').textContent='Der automatische Start konnte auf diesem Gerät nicht gespeichert werden.';}}
  function resetUI(){links.hidden=true;button.textContent=wanted?'Automatischen Start beenden':'Übertragung starten';button.disabled=busy;}
  async function closeSession(old){if(old)try{await api('stop',{id:old.id,owner:old.owner},true);}catch{}}
  async function release(){epoch++;const old=session;session=null;busy=false;resetUI();if(!disposed)onStateChange();await closeSession(old);}
  async function stop(){remember(false);retryAt=0;await release();if(!wanted&&!disposed)status.textContent='Übertragung beendet · automatischer Start ausgeschaltet.';}
  async function start(){
    if(disposed||suspended||busy||session)return;
    const own=++epoch;busy=true;button.disabled=true;
    try{
      const result=await api('start',{});
      if(disposed||suspended||epoch!==own){await closeSession(result);return;}
      session=result;remember(true);ack=[];applied.clear();commandMessage='';commandMessageId=0;nextSend=0;retryAt=0;
      select.replaceChildren(...result.urls.map(url=>new Option(new URL(url).host,new URL(url).origin)));input.value=select.value;
      root.querySelector('[data-share-test]').href=select.value+'/vr-test';root.querySelector('[data-share-code]').textContent=result.code;
      links.hidden=false;button.textContent='Übertragung beenden';
      root.querySelector('[data-share-network]').textContent=result.secure?'Im gleichen Netzwerk öffnen. Das HTTPS-Zertifikat muss der Brille bekannt sein.':'Live-Vorschau über HTTP. Für „VR starten“ benötigt der Server HTTPS mit einem von der Brille akzeptierten Zertifikat.';
      status.textContent='Übertragung gestartet · warte auf die Brille …';onStateChange();void publish();
    }catch(error){
      if(disposed||suspended||epoch!==own)return;
      retryAt=performance.now()+5000;resetUI();status.textContent=error.message+(wanted?' · Automatischer Start wird erneut versucht.':'');
    }finally{if(epoch===own){busy=false;if(!disposed)button.disabled=false;}}
  }
  async function api(action,body,keepalive=false){let token='';try{token=sessionStorage.getItem('wiz-web-token')||'';}catch{}const response=await fetch('/api/vr-preview/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),keepalive,signal:AbortSignal.timeout(4000)});const data=await response.json();if(!response.ok){const error=Error(data.error?.message||'Übertragung fehlgeschlagen.');error.status=response.status;throw error;}return data;}
  button.onclick=()=>{if(session||wanted)void stop();else void start();};
  select.onchange=()=>{input.value=select.value;root.querySelector('[data-share-test]').href=select.value+'/vr-test';};
  root.querySelector('[data-share-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='Adresse kopiert · in der Brille öffnen und Zahlencode eingeben.';}catch{input.focus();input.select();status.textContent='Markierte Adresse kopieren.';}};
  async function publish(){if(!session||sending||disposed||suspended||performance.now()<nextSend)return;sending=true;const current=session;try{const result=await api('frame',{id:current.id,owner:current.owner,scene:{...getScene(),controlMessage:commandMessage,controlMessageId:commandMessageId},ack});if(session!==current||disposed)return;for(const command of result.commands||[]){if(applied.has(command.id))continue;applied.add(command.id);try{await onCommand(command);commandMessage=command.action==='room-plan'?'Raum und Aufstellung am Rechner übernommen.':'';}catch(error){commandMessage=error.message;}commandMessageId=command.id;ack.push(command.id);}ack=ack.slice(-100);if(applied.size>200){const keep=[...applied].slice(-100);applied.clear();keep.forEach(id=>applied.add(id));}nextSend=performance.now()+(result.viewers?0:450);if(session===current)status.textContent=result.viewers?`${result.viewers} Vorschau verbunden · Änderungen werden live übertragen.`:'Übertragung bereit · Adresse im Headset öffnen und Code eingeben.';}catch(error){nextSend=performance.now()+1000;if(session===current&&error.status===404){session=null;retryAt=performance.now()+1000;resetUI();onStateChange();status.textContent='Vorschau abgelaufen · Übertragung wird automatisch neu gestartet.';}else if(session===current)status.textContent=`Verbindung unterbrochen: ${error.message} Erneuter Versuch läuft.`;}finally{sending=false;}}
  const timer=setInterval(()=>{if(disposed||suspended)return;if(wanted&&!session&&!busy&&performance.now()>=retryAt)void start();else void publish();},50);
  const unload=()=>{suspended=true;void release();};
  const restore=()=>{suspended=false;if(wanted)void start();};
  window.addEventListener('pagehide',unload);window.addEventListener('pageshow',restore);
  // The owning stage finishes initialization before the first state callback.
  queueMicrotask(()=>{if(disposed||suspended)return;if(wanted){onStateChange();void start();}});
  return {get active(){return Boolean(session);},get wanted(){return wanted&&!disposed&&!suspended;},stop,destroy(){disposed=true;clearInterval(timer);window.removeEventListener('pagehide',unload);window.removeEventListener('pageshow',restore);void release();root.remove();}};
}
