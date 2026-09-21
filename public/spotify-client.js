// Spotify playback uses its own protected SDK; analysis and mixing use local files.
// Public application identifier; no client secret is used by this PKCE client.
export const SPOTIFY_CLIENT_ID='70131f8aa1374f0ea9768b10210d3cc6';
export const SPOTIFY_SCOPES='playlist-read-private playlist-read-collaborative user-library-read streaming user-read-email user-read-private user-modify-playback-state';
const API='https://api.spotify.com/v1/';
export const TOKEN_URL='https://accounts.spotify.com/api/token';
export function callbackURL(href){
  const url=new URL('./spotify-callback.html',href);
  if(url.hostname==='localhost'){
    const local=new URL(href);local.hostname='127.0.0.1';local.search='';local.hash='';
    throw Error(`Spotify erlaubt localhost auch mit HTTPS nicht. Öffne AnyDj unter ${local.href} und starte die Anmeldung dort erneut.`);
  }
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname)))
    throw Error('Spotify benötigt HTTPS oder http://127.0.0.1. Öffne AnyDj unter dieser Adresse statt localhost oder einer LAN-IP.');
  return url.href;
}
export function randomString(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
export async function authorization(clientId,redirect,channel){
  if(!/^[a-f0-9]{32}$/i.test(clientId))throw Error('Bitte eine gültige Spotify Client ID eingeben (32 Zeichen).');
  const verifier=randomString(),state=randomString();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const params=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect,state,
    scope:SPOTIFY_SCOPES,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'});
  return {url:`https://accounts.spotify.com/authorize?${params}`,pending:{clientId,redirect,channel,verifier,state,created:Date.now()}};
}
export function validateCallback(url,pending,now=Date.now()){
  const params=new URL(url).searchParams;
  if(!pending||!params.get('state')||params.get('state')!==pending.state||now-pending.created>600000||now<pending.created)
    throw Error('Anmeldung abgelaufen oder ungültig. Bitte in AnyDj erneut verbinden.');
  if(params.has('error'))throw Error(params.get('error')==='access_denied'?'Spotify-Anmeldung abgebrochen.':'Spotify-Anmeldung fehlgeschlagen.');
  if(!params.get('code'))throw Error('Spotify hat keinen Anmeldecode zurückgegeben.');
  return {grant_type:'authorization_code',code:params.get('code'),redirect_uri:pending.redirect,client_id:pending.clientId,code_verifier:pending.verifier};
}
export async function exchangeToken(body,fetcher=fetch){
  const response=await fetcher(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error('Spotify-Anmeldung konnte nicht erneuert werden. Bitte erneut verbinden.'),{status:response.status});
  if(typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))throw Error('Ungültige Antwort bei der Spotify-Anmeldung.');
  return {...data,expiresAt:Date.now()+data.expires_in*1000};
}
export function apiURL(path){
  const url=new URL(path,API);
  if(url.origin!=='https://api.spotify.com'||!url.pathname.startsWith('/v1/')||url.username||url.password)
    throw Error('Ungültige Spotify-API-Adresse.');
  return url.href;
}
export function createSpotifyClient({storage,fetcher=fetch,key='anydj-spotify-session'}={}){
  if(!storage){try{storage=globalThis.sessionStorage;}catch{} }
  storage||={getItem:()=>null,removeItem:()=>{},setItem:()=>{throw Error('Bitte Sitzungsspeicher für die Spotify-Anmeldung erlauben.');}};
  let token=null,refreshing=null,epoch=0,blockedUntil=0;
  try{token=JSON.parse(storage.getItem(key));}catch{}
  function install(value){
    if(!value?.access_token||!value?.clientId)throw Error('Ungültige Spotify-Sitzung.');
    storage.setItem(key,JSON.stringify(value));token=value;epoch++;
  }
  function disconnect(){epoch++;token=null;storage.removeItem(key);}
  async function access(force=false){
    if(!token)throw Error('Bitte Spotify verbinden.');
    if(!force&&token.expiresAt>Date.now()+60000)return token.access_token;
    if(refreshing)return refreshing;
    const current=token,generation=epoch;
    refreshing=(async()=>{
      try{
        if(!current.refresh_token)throw Object.assign(Error('Bitte Spotify erneut verbinden.'),{status:401});
        const next=await exchangeToken({grant_type:'refresh_token',refresh_token:current.refresh_token,client_id:current.clientId},fetcher);
        if(generation!==epoch)throw Error('Spotify-Verbindung wurde geändert.');
        token={...current,...next};storage.setItem(key,JSON.stringify(token));return token.access_token;
      }catch(error){if(generation===epoch&&[400,401].includes(error.status))disconnect();throw error;}
      finally{refreshing=null;}
    })();
    return refreshing;
  }
  async function request(path,{signal,method='GET',body}={}){
    const url=apiURL(path),generation=epoch;
    if(Date.now()<blockedUntil)throw Error(`Spotify pausiert Anfragen. Bitte in ${Math.ceil((blockedUntil-Date.now())/1000)} Sekunden erneut versuchen.`);
    for(let attempt=0;attempt<2;attempt++){
      const bearer=await access(attempt===1);
      signal?.throwIfAborted();
      const timeout=AbortSignal.timeout(20000);
      let response;
      try{response=await fetcher(url,{method,headers:{Authorization:`Bearer ${bearer}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:signal?AbortSignal.any([signal,timeout]):timeout});}
      catch(error){if(error.name==='AbortError')throw error;throw Error('Spotify ist nicht erreichbar. Bitte Internetverbindung prüfen und erneut versuchen.');}
      if(epoch!==generation)throw Error('Spotify-Verbindung wurde geändert.');
      if(response.status===401&&attempt===0)continue;
      const data=await response.json().catch(()=>({}));
      if(response.ok)return data;
      if(response.status===401){disconnect();throw Error('Spotify-Sitzung abgelaufen. Bitte erneut verbinden.');}
      if(response.status===429){
        const seconds=Math.max(1,Number(response.headers.get('Retry-After'))||60);blockedUntil=Date.now()+seconds*1000;
        throw Error(data.error?.reason==='QUOTA_EXCEEDED'?'Spotify-API-Kontingent aufgebraucht. Bitte später erneut versuchen.':`Zu viele Spotify-Anfragen. Bitte ${seconds} Sekunden warten.`);
      }
      if(response.status===403&&method!=='GET')throw Error('Spotify-Wiedergabe nicht freigegeben. Premium und erneute Anmeldung mit Wiedergabeberechtigung erforderlich.');
      if(response.status===403)throw Error('Spotify verweigert den Zugriff. Prüfe App-Freigabe und Premium des App-Inhabers. Playlist-Inhalte können auf eigene oder gemeinsam bearbeitete Listen beschränkt sein.');
      if(response.status===404)throw Error('Spotify-Inhalt ist nicht verfügbar oder für diese App nicht freigegeben.');
      throw Error(`Spotify ist momentan nicht erreichbar (HTTP ${response.status}). Bitte erneut versuchen.`);
    }
  }
  return {get:(path,signal)=>request(path,{signal}),request,access,install,disconnect,
    get canStream(){const scopes=new Set((token?.scope||'').split(' '));return ['streaming','user-read-email','user-read-private','user-modify-playback-state'].every(scope=>scopes.has(scope));},get connected(){return Boolean(token?.access_token);}};
}
// Accept only Spotify artwork CDNs; images are fetched directly by the browser.
export function spotifyImage(images){
  if(!Array.isArray(images))return null;
  for(const image of [...images].sort((a,b)=>(a?.width||640)-(b?.width||640))){
    try{
      const url=new URL(image?.url);
      if(url.protocol==='https:'&&!url.username&&!url.password&&
        ['scdn.co','spotifycdn.com'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)))return url.href;
    }catch{}
  }
  return null;
}
export function spotifyTrack(entry){
  const raw=entry?.item??entry?.track??entry;
  if(!raw||raw.type!=='track'||!raw.id||raw.is_local)return null;
  return {id:raw.id,name:raw.name||'Unbenannter Titel',artists:(raw.artists||[]).map(a=>a.name).filter(Boolean),
    album:raw.album?.name||'',image:spotifyImage(raw.album?.images),duration:Number(raw.duration_ms)||0,explicit:Boolean(raw.explicit),
    available:raw.is_playable!==false,url:`https://open.spotify.com/track/${encodeURIComponent(raw.id)}`};
}
export function playlistID(value){
  const text=value.trim();
  if(/^[a-zA-Z0-9]{22}$/.test(text))return text;
  if(/^spotify:playlist:[a-zA-Z0-9]{22}$/.test(text))return text.split(':')[2];
  try{const url=new URL(text);if(url.protocol==='https:'&&url.hostname==='open.spotify.com')return url.pathname.match(/^\/(?:intl-[a-z]+\/)?playlist\/([a-zA-Z0-9]{22})\/?$/)?.[1]||null;}catch{}
  return null;
}
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// Suggestions never become playable mappings without an explicit user choice.
export function localSuggestions(remote,locals){
  const title=normalize(remote.name),artist=normalize(remote.artists[0]||'');
  return locals.filter(t=>!t.missing&&!t.pendingChange).map(track=>{
    const name=normalize(track.name.replace(/\.[^.]+$/,''));
    const titleMatch=title&&(` ${name} `).includes(` ${title} `);
    return {track,score:titleMatch?(artist&&(` ${name} `).includes(` ${artist} `)?2:1):0};
  }).filter(x=>x.score).sort((a,b)=>b.score-a.score).map(x=>x.track);
}
