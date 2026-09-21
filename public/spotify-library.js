import {selectProvider,providerKeys} from './provider-tabs.js';
import {createSpotifyPlayback} from './spotify-playback.js';
import {SPOTIFY_CLIENT_ID,createSpotifyClient,callbackURL,randomString,spotifyImage,spotifyTrack,playlistID,localSuggestions} from './spotify-client.js';
import {readSpotifyLinks,saveSpotifyLinks} from './dj-library.js';

const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,action)=>{const n=node('button',text,'button secondary');n.type='button';n.onclick=action;return n;};
const link=(text,url)=>{const n=node('a',text);n.href=url;n.target='_blank';n.rel='noopener noreferrer';return n;};
export function createSpotifyLibrary({getTracks,enqueueTracks,saveList,loadLocal,addLocal,enqueueSpotifyTracks,loadSpotify,playSpotify,onSpotifyState,onSpotifyEnded,onSpotifyError}){
  const root=document.getElementById('libraryDrop'),heading=root.querySelector('.dj-library-heading');
  const local=node('div',null,'provider-panel');local.id='localLibrary';
  for(const child of [...root.children])if(child!==heading)local.append(child);
  const panel=node('section',null,'provider-panel spotify-panel');panel.id='spotifyLibrary';panel.hidden=true;
  const tabs=node('div',null,'provider-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Musikquelle');
  const localTab=button('Lokal',()=>select(false)),spotifyTab=button('Spotify',()=>select(true));
  for(const [tab,target,id] of [[localTab,local,'localTab'],[spotifyTab,panel,'spotifyTab']]){
    tab.id=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',target.id);target.setAttribute('role','tabpanel');target.setAttribute('aria-labelledby',id);
    tab.onkeydown=providerKeys;
  }
  tabs.append(localTab,spotifyTab);
  const connectButton=button('+ Verbinden',()=>{if(document.getElementById('tidalTab')?.getAttribute('aria-selected')==='true')root.dispatchEvent(new Event('providerconnect'));else{select(true);showConnection();}});
  const tabbar=node('div',null,'provider-tabbar');tabbar.append(tabs,connectButton);heading.append(tabbar);root.append(local,panel);
  const brand=node('span','Spotify');brand.className='spotify-brand';
  // Spotify icon, displayed beside all Spotify-sourced metadata.
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
  const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('fill','currentColor');path.setAttribute('d','M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.15a.75.75 0 0 1-.34-1.46c4.57-1.05 8.49-.6 11.67 1.33a.75.75 0 0 1 .25 1.03zm1.47-3.28a.94.94 0 0 1-1.29.31c-3.23-1.98-8.16-2.55-11.98-1.39a.94.94 0 0 1-.54-1.8c4.36-1.32 9.8-.68 13.5 1.6a.94.94 0 0 1 .31 1.28zm.13-3.42C15.22 8.3 8.82 8.08 5.12 9.2a1.13 1.13 0 0 1-.65-2.16c4.24-1.28 11.3-1.02 15.79 1.65a1.13 1.13 0 0 1-1.16 1.94z');icon.append(path);brand.prepend(icon);
  const account=node('span','Nicht verbunden','small muted'),manage=button('Verbindung',showConnection),top=node('div',null,'spotify-toolbar');top.append(brand,account,manage);
  const hint=node('p','Spotify-Titel lassen sich abspielen und in die Warteschlange einreihen. Spotify Premium ist erforderlich. Spotify erlaubt über diese Anbindung keine Crossfades. Titel wechseln deshalb ohne Überblendung. Live-Audioanalyse ist für Spotify nicht verfügbar.','small muted');
  const status=node('p',null,'small muted');status.id='spotifyStatus';status.setAttribute('role','status');
  const source=node('select');source.id='spotifySource';source.setAttribute('aria-label','Spotify-Ansicht');source.append(new Option('Playlists','playlists'),new Option('Lieblingssongs','liked'));
  const currentOption=new Option('Aktuelle Titel','tracks');currentOption.disabled=true;source.append(currentOption);
  source.onchange=()=>run(()=>source.value==='liked'?showTracks('me/tracks?limit=50','Lieblingssongs'):showPlaylists());
  const refresh=button('↻',()=>run(()=>currentPath?showTracks(currentPath,currentName):showPlaylists()));refresh.setAttribute('aria-label','Spotify aktualisieren');refresh.title='Spotify aktualisieren';
  const search=node('form',null,'spotify-toolbar'),query=node('input');query.type='search';query.placeholder='Titel, Künstler oder Playlist-Link';query.setAttribute('aria-label','Spotify durchsuchen');
  const searchButton=button('Suchen',null);searchButton.type='submit';search.append(source,query,searchButton,refresh);
  search.onsubmit=e=>{e.preventDefault();void run(async()=>{
    const value=query.value.trim();if(!value)return;
    const id=playlistID(value);
    if(id){const playlist=await client.get('playlists/'+id);await showTracks(`playlists/${id}/items?limit=50`,playlist.name||'Playlist');}
    else await showTracks('search?'+new URLSearchParams({q:value,type:'track',limit:'10'}),'Suche: '+value);
  });};
  const title=node('p','Verbinde Spotify, um deine Playlists und Lieblingssongs zu laden.','small');
  const filter=node('input');filter.type='search';filter.placeholder='Geladene Titel filtern';filter.setAttribute('aria-label','Geladene Spotify-Titel filtern');filter.oninput=renderRows;filter.hidden=true;
  const actions=node('div',null,'spotify-toolbar');actions.hidden=true;
  const enqueue=button('Zugeordnete einreihen',()=>run(async()=>{const items=mappedRows();enqueueTracks(items);status.textContent=`${items.length} lokale Titel eingereiht. ${rows.length-items.length} ohne verfügbare Zuordnung ausgelassen.`;}));
  const save=button('Als DJ-Liste speichern',()=>run(async()=>{const items=mappedRows();await saveList(currentName,items);status.textContent=`DJ-Liste mit ${items.length} lokalen Titeln gespeichert. ${rows.length-items.length} ohne verfügbare Zuordnung ausgelassen.`;}));
  const all=button('Restliche Titel laden',()=>run(async()=>{while(next){if(rows.length>=10000)throw Error('Maximal 10.000 Titel pro Ansicht. Bitte kleinere Playlists verwenden.');await loadPage(next,true);}renderRows();}));
  actions.append(button('Alle einreihen',()=>run(async()=>{enqueueSpotifyTracks(rows.filter(t=>t.available));status.textContent='Spotify-Titel eingereiht.';})),enqueue,save,all);
  const preparation=node('details',null,'spotify-preparation'),preparationTitle=node('summary','Set vorbereiten');preparation.append(preparationTitle,filter,actions);
  const list=node('ol',null,'dj-tracks spotify-tracks');list.id='spotifyTracks';list.tabIndex=0;list.setAttribute('aria-label','Spotify-Inhalte');
  const more=button('Mehr laden',()=>run(async()=>{await loadPage(next,true);renderRows();}));more.hidden=true;
  const help=button('Info',()=>{const d=dialog('Spotify für dein DJ-Set');d.append(hint.cloneNode(true),link('Spotify-Vorgaben','https://developer.spotify.com/policy#iii-some-prohibited-applications'),link('Spotify öffnen','https://open.spotify.com'));d.open();});top.insertBefore(help,manage);
  panel.append(top,search,title,preparation,status,list,more);
  const client=createSpotifyClient();
  const playback=createSpotifyPlayback({client,onAuthorizationRequired:showConnection,onState:onSpotifyState,onEnded:onSpotifyEnded,onError:(message,options)=>{status.textContent=message;onSpotifyError?.(message,options);}});
  let rows=[],next=null,currentPath='',currentName='',mode='playlists',links={},busy=false,revision=0,controller=null,auth=null,active=false,entered=false;
  let mappingReady=false,linksSave=Promise.resolve();
  readSpotifyLinks().then(saved=>{links=saved&&typeof saved==='object'?saved:{};mappingReady=true;renderRows();}).catch(()=>{mappingReady=true;status.textContent='Zuordnungen können momentan nicht geladen werden.';});
  function select(spotify){selectProvider(spotify?'spotifyLibrary':'localLibrary');}
  root.addEventListener('providerchange',e=>{active=e.detail==='spotifyLibrary';if(active){renderRows();if(!entered&&client.connected){entered=true;void run(()=>showPlaylists());}}});
  function updateControls(){
    account.textContent=client.connected?(client.canStream?'Verbunden · Wiedergabe freigegeben':'Verbunden · Wiedergabe noch freigeben'):'Nicht verbunden';
    for(const control of [source,refresh,query,searchButton])control.disabled=busy||!client.connected;
    enqueue.disabled=save.disabled=busy||!mappedRows().length;
    save.title=next?'Zuerst alle Titel laden, um die vollständige Liste zu speichern.':'';save.disabled||=Boolean(next);
    all.hidden=!next||mode!=='tracks';all.disabled=more.disabled=busy;more.hidden=!next;
    panel.setAttribute('aria-busy',String(busy));
  }
  async function run(action){
    if(busy)return;busy=true;status.textContent='Lädt …';updateControls();
    const generation=revision;
    try{await action();if(generation===revision&&status.textContent==='Lädt …')status.textContent='';}
    catch(error){if(generation===revision&&error.name!=='AbortError')status.textContent=error.message;}
    finally{busy=false;updateControls();}
  }
  function begin(){controller?.abort();controller=new AbortController();rows=[];next=null;filter.value='';list.replaceChildren();}
  async function showPlaylists(){begin();mode='playlists';source.value='playlists';currentPath='';currentName='';title.textContent='Deine Playlists';await loadPage('me/playlists?limit=50');renderRows();}
  async function showTracks(path,name){begin();mode='tracks';source.value=path.startsWith('me/tracks')?'liked':'tracks';currentPath=path;currentName=name;title.textContent=name;await loadPage(path);renderRows();}
  async function loadPage(path,append=false){
    if(!path)return;const generation=revision,data=await client.get(path,controller?.signal);
    if(generation!==revision)return;
    const page=data.tracks&&Array.isArray(data.tracks.items)?data.tracks:data;
    if(!Array.isArray(page.items))throw Error('Spotify liefert für diese Playlist keine Titel. Neue App-Zugänge können nur eigene oder gemeinsam bearbeitete Listen lesen.');
    const items=mode==='tracks'?page.items.map(spotifyTrack).filter(Boolean):page.items.filter(p=>p?.id);
    rows=append?[...rows,...items]:items;next=page.next||null;
    if(mode==='tracks')title.textContent=`${currentName} · ${rows.length} Titel geladen${next?' · weitere verfügbar':''}`;
    const omitted=page.items.length-items.length;
    if(omitted)status.textContent=`${omitted} nicht verfügbare Einträge, lokale Spotify-Dateien oder Podcasts auf dieser Seite ausgelassen.`;
  }
  function mapped(remote){const id=links[remote.id];return typeof id==='string'?getTracks().find(t=>t.id===id&&!t.missing&&!t.pendingChange&&(t.file||t.handle)):null;}
  function mappedRows(){return mode==='tracks'?rows.map(mapped).filter(Boolean):[];}
  async function storeMapping(remote,localId){
    const previous=links[remote.id];if(localId)links[remote.id]=localId;else delete links[remote.id];
    const snapshot=structuredClone(links);
    try{linksSave=linksSave.catch(()=>{}).then(()=>saveSpotifyLinks(snapshot));await linksSave;}
    catch(error){if(previous)links[remote.id]=previous;else delete links[remote.id];throw Error('Zuordnung konnte nicht gespeichert werden.');}
    renderRows();
  }
  function renderRows(){
    if(!active)return;list.replaceChildren();preparation.hidden=actions.hidden=filter.hidden=mode!=='tracks';
    preparationTitle.textContent=`Set vorbereiten · ${mappedRows().length} von ${rows.length} lokal verfügbar`;
    const term=filter.value.toLocaleLowerCase();
    for(const remote of rows){
      if(mode==='tracks'&&!`${remote.name} ${remote.artists.join(' ')} ${remote.album}`.toLocaleLowerCase().includes(term))continue;
      const row=node('li'),info=node('div',null,'dj-track-info');
      const openItem=()=>run(()=>mode==='tracks'?playSpotify(remote):showTracks(`playlists/${encodeURIComponent(remote.id)}/items?limit=50`,remote.name));
      const artwork=button('',openItem);
      artwork.className='spotify-artwork';artwork.setAttribute('aria-label',remote.name+(mode==='tracks'?' abspielen':' öffnen'));
      const placeholder=()=>{artwork.replaceChildren(node('span','♫'));};
      const imageURL=mode==='tracks'?remote.image:spotifyImage(remote.images);
      if(imageURL){
        const image=node('img');image.src=imageURL;image.alt='';image.width=48;image.height=48;
        image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.onerror=placeholder;
        artwork.append(image);
      }else placeholder();
      row.append(artwork);
      const titleButton=button(remote.name,openItem);titleButton.className='spotify-title';info.append(titleButton);
      const external=node('details'),externalTitle=node('summary','Mehr');external.append(externalTitle,link('In Spotify öffnen',mode==='tracks'?remote.url:`https://open.spotify.com/playlist/${encodeURIComponent(remote.id)}`));
      if(mode==='playlists'){
        info.append(node('small',remote.owner?.display_name||'Spotify-Playlist'));
        row.append(info,button('Öffnen',openItem),external);
        row.onclick=event=>{if(!event.target.closest('button,a,details'))void openItem();};
      }else{
        const local=mapped(remote),duration=Math.round(remote.duration/1000);
        info.append(node('small',`${remote.artists.join(', ')} · ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}${remote.explicit?' · Explicit':''}`));
        const state=node('small',local?'Lokal: '+local.name:remote.available?'Spotify':'Nicht verfügbar');info.append(state);
        const controls=node('div',null,'spotify-row-actions');
        const play=button('Play',()=>run(()=>playSpotify(remote))),queue=button('Einreihen',()=>run(async()=>{enqueueSpotifyTracks([remote]);status.textContent='Spotify-Titel in der Warteschlange.';}));
        play.disabled=queue.disabled=!remote.available;controls.append(play,queue);
        const extra=external;
        for(const deck of ['A','B'])extra.append(button('Auf Deck '+deck,()=>run(()=>loadSpotify(deck,remote))));
        extra.append(button('Datei zuordnen',()=>chooseMapping(remote)));
        if(local){extra.append(button('Lokale Datei einreihen',()=>run(async()=>enqueueTracks([mapped(remote)]))));for(const deck of ['A','B'])extra.append(button('Lokale Datei auf Deck '+deck,()=>run(()=>loadLocal(deck,mapped(remote)))));}
        controls.append(extra);row.append(info,controls);row.draggable=remote.available;
        row.ondragstart=e=>{e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-anydj-provider-track',JSON.stringify(remote));};
      }
      list.append(row);
    }
    if(!list.children.length)list.append(node('li',client.connected?'Keine Einträge. Wähle Playlists, Lieblingssongs oder suche einen Titel.':'Spotify ist noch nicht verbunden.','dj-empty'));
    updateControls();
  }
  function dialog(titleText){
    const box=node('dialog',null,'spotify-dialog'),heading=node('h2',titleText),close=button('Schließen',()=>box.close());box.append(heading);box.setAttribute('aria-label',titleText);
    const footer=node('div',null,'spotify-toolbar');footer.append(close);box.append(footer);document.body.append(box);box.addEventListener('close',()=>box.remove(),{once:true});
    return {box,footer,open:()=>box.showModal(),append:(...nodes)=>footer.before(...nodes)};
  }
  function chooseMapping(remote){
    if(!mappingReady)return;
    const d=dialog('Lokale Datei zuordnen'),message=node('p',`${remote.artists.join(', ')} – ${remote.name}`),search=node('input');search.type='search';search.placeholder='Lokale Bibliothek durchsuchen';search.setAttribute('aria-label',search.placeholder);
    const options=node('select');options.size=8;options.setAttribute('aria-label','Lokale Audiodatei');
    const suggestions=localSuggestions(remote,getTracks()),suggested=new Set(suggestions.map(t=>t.id));
    const draw=()=>{options.replaceChildren();const term=search.value.toLocaleLowerCase();for(const track of [...suggestions,...getTracks().filter(t=>!suggested.has(t.id)&&!t.missing&&!t.pendingChange)])if(track.name.toLocaleLowerCase().includes(term))options.append(new Option((suggested.has(track.id)?'Vorschlag · ':'')+track.name,track.id));options.value=links[remote.id]||'';};
    search.oninput=draw;draw();
    const error=node('p',null,'small'),save=button('Zuordnung bestätigen',async()=>{if(!options.value){error.textContent='Bitte eine Datei auswählen. Version und Remix prüfen.';return;}try{save.disabled=true;await storeMapping(remote,options.value);d.box.close();}catch(e){error.textContent=e.message;}finally{save.disabled=false;}});
    const file=node('input');file.type='file';file.accept='audio/*,.mp3,.wav,.flac,.ogg,.m4a';file.hidden=true;
    const upload=button('Neue Audiodatei auswählen',()=>file.click());file.onchange=async()=>{try{if(!file.files[0])return;const added=await addLocal(file.files[0]);if(added){await storeMapping(remote,added.id);d.box.close();}}catch(e){error.textContent=e.message;}};
    const clear=button('Zuordnung entfernen',async()=>{try{await storeMapping(remote,null);d.box.close();}catch(e){error.textContent=e.message;}});clear.disabled=!links[remote.id];
    d.append(message,node('p','Vorschläge anhand des Dateinamens. Bitte Künstler, Version und Remix selbst prüfen.','small muted'),search,options,error,file);d.footer.prepend(save,upload,clear);d.open();
  }
  function cancelAuth(){if(!auth)return;clearInterval(auth.timer);auth.channel.close();auth.popup?.close();auth=null;}
  function showConnection(){
    if(document.querySelector('[data-spotify-connection]'))return;
    const needsPlayback=client.connected&&!client.canStream;
    const d=dialog(needsPlayback?'Spotify-Wiedergabe freigeben':'Spotify verbinden'),description=node('p',needsPlayback?'Deine Bibliothek ist verbunden. Für das Abspielen braucht AnyDj zusätzliche Berechtigungen. Bestätige diese einmal bei Spotify; dein Premium-Abo ist davon unabhängig.':'Melde dich bei Spotify an, um deine Bibliothek und die Wiedergabe freizugeben.');
    d.box.dataset.spotifyConnection='true';
    let callback,callbackError;
    try{callback=callbackURL(location.href);}catch(error){callbackError=error.message;}
    const error=node('p',null,'small');error.setAttribute('role','status');
    if(callbackError)error.textContent=callbackError;
    if(location.hostname==='localhost'){
      const address=new URL(location.href);address.hostname='127.0.0.1';address.search='';address.hash='';
      const openLocal=node('a','AnyDj unter 127.0.0.1 öffnen','button secondary');openLocal.href=address.href;
      d.append(openLocal);
    }else if(callback&&['127.0.0.1','[::1]'].includes(location.hostname)){
      const details=node('details'),label=node('summary','Lokale Spotify-Redirect-URI');
      const uri=node('code',callback);uri.style.overflowWrap='anywhere';
      details.append(label,node('p','Diese Adresse in der Spotify-App zusätzlich hinterlegen:','small'),uri);d.append(details);
    }
    const login=button(needsPlayback?'Wiedergabe freigeben':client.connected?'Konto wechseln':'Mit Spotify anmelden',()=>{
      try{
        if(busy)throw Error('Bitte die laufende Spotify-Anfrage abwarten und dann anmelden.');
        if(!callback)throw Error(callbackError);
        const id=SPOTIFY_CLIENT_ID;cancelAuth();
        const nonce=randomString(),channel=new BroadcastChannel('anydj-spotify-'+nonce);
        const popup=window.open(`${callback}#${new URLSearchParams({client:id,channel:nonce})}`,'anydj-spotify-login','popup,width=520,height=760');
        if(!popup){channel.close();throw Error('Bitte Popups für AnyDj erlauben und erneut anmelden.');}
        const started=Date.now();auth={channel,popup};error.textContent='Anmeldung im neuen Fenster abschließen …';
        channel.onmessage=event=>{
          const data=event.data;
          if(!data?.token&&!data?.error)return;
          try{if(data.error)throw Error(data.error);playback.stop();client.install(data.token);revision++;controller?.abort();rows=[];next=null;renderRows();d.box.close();void run(()=>showPlaylists());}
          catch(e){error.textContent=e.message;}finally{cancelAuth();updateControls();}
        };
        auth.timer=setInterval(()=>{if(Date.now()-started>600000){cancelAuth();error.textContent='Anmeldung abgelaufen. Bitte erneut anmelden.';}},1000);
      }catch(e){error.textContent=e.message;}
    });
    login.disabled=!callback;
    const disconnect=button('Verbindung trennen',()=>{revision++;controller?.abort();cancelAuth();playback.stop();onSpotifyError?.('Spotify getrennt.');client.disconnect();rows=[];next=null;currentPath='';title.textContent='Spotify getrennt.';status.textContent='';renderRows();d.box.close();});disconnect.disabled=!client.connected;
    d.append(description,error);d.footer.prepend(login,disconnect);d.open();
  }
  select(false);updateControls();
  window.addEventListener('pagehide',()=>{controller?.abort();cancelAuth();playback.stop();},{once:true});
  return {playback,refresh(){if(active&&mode==='tracks'&&!panel.contains(document.activeElement))renderRows();}};
}
