import {TIDAL_CLIENT_ID,createTidalClient,callbackURL,nonce,apiURL,resources,normalizeResource,playlistID} from './tidal-client.js';
import {selectProvider,providerKeys} from './provider-tabs.js';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action)=>{const b=node('button',text,'button secondary');b.type='button';b.onclick=action;return b;};
const link=(text,url)=>{const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
export function createTidalLibrary({getTracks,enqueueTracks,loadLocal}){
 const root=document.getElementById('libraryDrop'),client=createTidalClient();
 const panel=node('section',null,'provider-panel spotify-panel');panel.id='tidalLibrary';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tidalTab');
 const tab=button('TIDAL',()=>selectProvider(panel.id));tab.id='tidalTab';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tab.setAttribute('aria-selected','false');tab.tabIndex=-1;tab.onkeydown=providerKeys;
 root.querySelector('[role=tablist]').append(tab);root.append(panel);
 const top=node('div',null,'spotify-toolbar'),brand=node('strong','TIDAL'),account=node('span',null,'small muted');
 top.append(brand,account,button('Verbindung',showConnection),button('Info',()=>{const d=dialog('TIDAL');d.append(node('p','Playlists, Lieblingssongs und Suche sind verfügbar, soweit deine TIDAL-App dafür freigegeben ist. Für die Decks eine eigene lokale Datei zuordnen. TIDAL-Streaming ist hier noch nicht freigeschaltet.'));}));
 const refresh=button('↻',()=>run(()=>currentPath?showPage(currentPath,mode,title.textContent):collection(source.value)));refresh.setAttribute('aria-label','TIDAL aktualisieren');refresh.title='TIDAL aktualisieren';top.append(refresh);
 const source=node('select');source.id='tidalSource';source.setAttribute('aria-label','TIDAL-Ansicht');source.append(new Option('Playlists','playlists'),new Option('Lieblingssongs','tracks'));
 source.onchange=()=>run(()=>collection(source.value));
 const query=node('input');query.placeholder='Titel, Künstler oder TIDAL-Playlist-Link';query.setAttribute('aria-label','TIDAL durchsuchen');
 const search=node('form',null,'spotify-toolbar'),submit=button('Suchen');submit.type='submit';search.append(source,query,submit);
 search.onsubmit=e=>{e.preventDefault();void run(async()=>{
  const term=query.value.trim();if(!term)return;const id=playlistID(term);
  if(id){await openPlaylist(id,'Playlist');return;}
  const doc=await client.get('searchResults?'+new URLSearchParams({'filter[query]':term,countryCode:country,include:'tracks'}),controller.signal);
  const result=resources(doc)[0];if(!result)throw Error('TIDAL liefert keine Suchergebnisse.');
  await showPage(`searchResults/${encodeURIComponent(result.id)}/relationships/tracks?`+new URLSearchParams({countryCode:country,include:'tracks'}),'tracks','Suche: '+term);
 });};
 const title=node('p','Verbinde TIDAL, um deine Bibliothek zu öffnen.','small'),status=node('p',null,'small muted');status.id='tidalStatus';status.setAttribute('role','status');
 const list=node('ol',null,'dj-tracks spotify-tracks');list.id='tidalTracks';list.tabIndex=0;list.setAttribute('aria-label','TIDAL-Inhalte');
 const more=button('Mehr laden',()=>run(()=>page(next,true)));more.hidden=true;
 const enqueue=button('Zugeordnete einreihen',()=>run(async()=>{const tracks=rows.map(mapped).filter(Boolean);if(!tracks.length)throw Error('Zuerst eine lokale Datei zuordnen.');enqueueTracks(tracks);status.textContent=`${tracks.length} lokale Titel eingereiht.`;}));enqueue.hidden=true;
 panel.append(top,search,title,enqueue,status,list,more);
 let active=false,entered=false,busy=false,revision=0,controller=new AbortController(),auth=null,rows=[],next=null,currentPath='',mode='playlists',country='DE',links={};
 try{links=JSON.parse(sessionStorage.getItem('anydj-tidal-links'))||{};}catch{}
 root.addEventListener('providerchange',e=>{active=e.detail===panel.id;if(active){render();if(!entered&&client.connected){entered=true;void run(()=>collection('playlists'));}}});
 root.addEventListener('providerconnect',()=>{if(active)showConnection();});
 function controls(){account.textContent=client.connected?'Verbunden':'Nicht verbunden';for(const c of [source,query,submit,refresh])c.disabled=busy||Boolean(auth)||!client.connected;more.disabled=busy;more.hidden=!next;enqueue.hidden=mode!=='tracks';enqueue.disabled=busy||!rows.some(mapped);panel.setAttribute('aria-busy',String(busy));}
 async function run(action){
  if(busy)return;busy=true;const generation=revision;status.textContent='Lädt …';controls();
  try{await action();if(generation===revision&&status.textContent==='Lädt …')status.textContent='';}
  catch(e){if(generation===revision&&e.name!=='AbortError')status.textContent=e.message;}
  finally{busy=false;controls();}
 }
 async function collection(type){
  const me=await client.get('users/me',controller.signal);const value=me.data?.attributes?.country;if(/^[A-Z]{2}$/.test(value))country=value;
  await showPage(`userCollection${type==='tracks'?'Tracks':'Playlists'}/me/relationships/items?include=items`,type,type==='tracks'?'Lieblingssongs':'Deine Playlists');
 }
 async function openPlaylist(id,name){await showPage(`playlists/${encodeURIComponent(id)}/relationships/items?`+new URLSearchParams({include:'items',countryCode:country}),'tracks',name);}
 async function showPage(path,type,name){controller.abort();controller=new AbortController();rows=[];next=null;mode=type;title.textContent=name;currentPath=path;render();await page(path,false);}
 async function page(path,append){
  if(!path)return;const generation=revision,doc=await client.get(path,controller.signal),ordered=resources(doc).filter(r=>r.type===mode);
  const included=[...(doc.included||[])],full=new Map();
  // Hydrate relationships explicitly; IDs alone have no cover/title information.
  for(let i=0;i<ordered.length;i+=20){
   const ids=[...new Set(ordered.slice(i,i+20).map(r=>r.id))];
   const params=new URLSearchParams({'filter[id]':ids.join(','),countryCode:country,include:mode==='tracks'?'artists,albums.coverArt':'coverArt'});
   const details=await client.get(mode+'?'+params,controller.signal);included.push(...(details.included||[]));for(const r of resources(details))full.set(r.id,r);
  }
  if(generation!==revision)return;
  const items=ordered.map(r=>full.get(r.id)||r).filter(r=>r.attributes).map(r=>normalizeResource(r,included));
  rows=append?[...rows,...items]:items;
  const href=typeof doc.links?.next==='string'?doc.links.next:doc.links?.next?.href;next=href?apiURL(href,apiURL(path)):null;
  if(next===apiURL(path))next=null;
  status.textContent=`${rows.length} ${mode==='tracks'?'Titel':'Playlists'} geladen`+(items.length<resources(doc).length?' · Nicht verfügbare Einträge ausgelassen':'');render();
 }
 function mapped(remote){const id=links[remote.id];return remote.type==='tracks'?getTracks().find(t=>t.id===id&&!t.missing&&!t.pendingChange&&(t.file||t.handle)):null;}
 let dragging=false;
 list.addEventListener('dragstart',event=>{if(!event.defaultPrevented&&[...(event.dataTransfer?.types||[])].some(type=>['application/x-wiz-track','application/x-anydj-provider-track'].includes(type)))dragging=true;});
 document.addEventListener('dragend',()=>{if(dragging){dragging=false;render();}});
 function render(){
  if(dragging)return;
  if(!active){controls();return;}list.replaceChildren();
  for(const remote of rows){
   const row=node('li'),info=node('div',null,'dj-track-info'),open=()=>mode==='playlists'?run(()=>openPlaylist(remote.id,remote.name)):chooseMapping(remote);
   const art=button('',open);art.className='spotify-artwork';art.setAttribute('aria-label',remote.name+(mode==='playlists'?' öffnen':' · lokale Datei zuordnen'));
   if(remote.image){const img=node('img');img.draggable=false;img.src=remote.image;img.alt='';img.width=48;img.height=48;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>art.replaceChildren(node('span','♫'));art.append(img);}else art.append(node('span','♫'));
   const name=button(remote.name,open);name.className='spotify-title';info.append(name);
   const extra=node('details');extra.append(node('summary','Mehr'),link('In TIDAL öffnen',`https://tidal.com/browse/${remote.type==='tracks'?'track':'playlist'}/${encodeURIComponent(remote.id)}`));
   if(mode==='playlists'){row.append(art,info,button('Öffnen',open),extra);row.onclick=e=>{if(!e.target.closest('button,a,details'))void open();};}
   else{
    const local=mapped(remote);info.append(node('small',remote.artists.join(', ')+' · '+Math.floor(remote.duration/60)+':'+String(Math.floor(remote.duration%60)).padStart(2,'0')),node('small',local?'Lokal: '+local.name:'Lokale Datei zuordnen'));
    const actions=node('div',null,'spotify-row-actions'),queue=button('Einreihen',()=>run(async()=>{const track=mapped(remote);if(!track)throw Error('Lokale Datei nicht verfügbar.');enqueueTracks([track]);status.textContent='Lokale Datei eingereiht.';}));queue.disabled=!local;queue.title=local?'Zugeordnete lokale Datei einreihen':'TIDAL-Streaming noch nicht freigeschaltet. Bitte lokale Datei zuordnen.';
    extra.append(button('Datei zuordnen',()=>chooseMapping(remote)));
    if(local)for(const deck of ['A','B'])extra.append(button('Auf Deck '+deck,()=>run(()=>loadLocal(deck,mapped(remote)))));
    actions.append(queue,extra);row.append(art,info,actions);
    row.draggable=Boolean(local);row.ondragstart=e=>{const track=mapped(remote);if(!track){e.preventDefault();return;}e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-wiz-track',track.id);};
   }list.append(row);
  }
  if(!rows.length)list.append(node('li',client.connected?'Keine Einträge. Suche einen Titel oder öffne eine Playlist.':'TIDAL noch nicht verbunden.','dj-empty'));controls();
 }
 function dialog(name){const d=node('dialog',null,'spotify-dialog');d.setAttribute('aria-label',name);d.append(node('h2',name));const footer=node('div',null,'spotify-toolbar');footer.append(button('Schließen',()=>d.close()));d.append(footer);document.body.append(d);d.onclose=()=>d.remove();d.showModal();return {box:d,footer,append:(...nodes)=>footer.before(...nodes)};}
 function chooseMapping(remote){
  const d=dialog('Lokale Datei zuordnen'),select=node('select');select.setAttribute('aria-label','Lokale Audiodatei');select.append(new Option('Datei auswählen',''));
  for(const t of getTracks().filter(t=>!t.missing&&!t.pendingChange&&(t.file||t.handle)))select.append(new Option(t.name,t.id));select.value=links[remote.id]||'';
  const error=node('p',null,'small');d.append(node('p',remote.name+' · '+remote.artists.join(', ')),select,error);
  d.footer.prepend(button('Zuordnung bestätigen',()=>{try{if(!select.value)throw Error('Bitte eine lokale Datei auswählen.');const updated={...links,[remote.id]:select.value};sessionStorage.setItem('anydj-tidal-links',JSON.stringify(updated));links=updated;d.box.close();render();}catch(e){error.textContent=e.message;}}),button('Zuordnung entfernen',()=>{try{const updated={...links};delete updated[remote.id];sessionStorage.setItem('anydj-tidal-links',JSON.stringify(updated));links=updated;d.box.close();render();}catch(e){error.textContent=e.message;}}));
 }
 function cancelAuth(){if(!auth)return;clearInterval(auth.timer);auth.channel.close();auth.popup?.close();auth=null;}
 function reset(){revision++;controller.abort();controller=new AbortController();rows=[];next=null;entered=false;currentPath='';country='DE';title.textContent='TIDAL';}
 function showConnection(){
  if(document.querySelector('[data-tidal-connection]'))return;
  const d=dialog('TIDAL verbinden');d.box.dataset.tidalConnection='true';d.box.addEventListener('close',()=>{cancelAuth();controls();},{once:true});
  const id=node('input');id.placeholder='TIDAL Client-ID';id.setAttribute('aria-label','TIDAL Client-ID');id.autocomplete='off';
  try{id.value=TIDAL_CLIENT_ID||localStorage.getItem('anydj-tidal-client-id')||'';}catch{id.value=TIDAL_CLIENT_ID;}
  const config=node('details');config.open=!id.value;config.append(node('summary','Einmalige Einrichtung'),node('p','Client-ID deiner TIDAL-App. Kein Client Secret eingeben.','small'),id,link('TIDAL Developer Dashboard','https://developer.tidal.com/dashboard'));
  const error=node('p',null,'small');error.setAttribute('role','status');let callback;
  try{callback=callbackURL(location.href);const uri=node('code',callback);uri.style.overflowWrap='anywhere';config.append(node('p','Diese Redirect URI in der TIDAL-App hinterlegen:','small'),uri);}catch(e){error.textContent=e.message;}
  const login=button(client.connected?'Erneut anmelden':'Mit TIDAL anmelden',()=>{
   try{
    if(busy)throw Error('Bitte die laufende TIDAL-Anfrage abwarten.');
    if(!callback)throw Error('Bitte AnyDj über HTTPS öffnen.');
    const clientId=TIDAL_CLIENT_ID||id.value.trim();if(!/^[A-Za-z0-9_-]{8,128}$/.test(clientId))throw Error('Bitte eine gültige TIDAL Client-ID eingeben.');
    localStorage.setItem('anydj-tidal-client-id',clientId);cancelAuth();const channelId=nonce(),channel=new BroadcastChannel('anydj-tidal-'+channelId);
    const popup=window.open(callback+'#'+new URLSearchParams({client:clientId,channel:channelId}),'anydj-tidal-login','popup,width=520,height=760');if(!popup){channel.close();throw Error('Bitte Popups für AnyDj erlauben.');}
    auth={channel,popup};controls();const started=Date.now();error.textContent='Anmeldung im neuen Fenster abschließen …';
    channel.onmessage=e=>{if(!e.data?.token&&!e.data?.error)return;try{if(e.data.error)throw Error(e.data.error);client.install(e.data.token);reset();links={};sessionStorage.removeItem('anydj-tidal-links');render();d.box.close();entered=true;void run(()=>collection('playlists'));}catch(err){error.textContent=err.message;}finally{cancelAuth();controls();}};
    auth.timer=setInterval(()=>{if(Date.now()-started>600000){cancelAuth();controls();error.textContent='Anmeldung abgelaufen. Bitte erneut anmelden.';}},1000);
   }catch(e){error.textContent=e.message;}
  });
  const disconnect=button('Verbindung trennen',()=>{cancelAuth();client.disconnect();reset();links={};sessionStorage.removeItem('anydj-tidal-links');status.textContent='';render();d.box.close();});disconnect.disabled=!client.connected;
  d.append(config,error);d.footer.prepend(login,disconnect);
 }
 window.addEventListener('pagehide',()=>{controller.abort();cancelAuth();},{once:true});controls();
 return {refresh(){if(active&&!panel.contains(document.activeElement))render();}};
}
