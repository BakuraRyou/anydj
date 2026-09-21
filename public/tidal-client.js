// Public REST API only. Playback requires separately approved player access.
export const TIDAL_CLIENT_ID='';
export const TIDAL_SCOPES='user.read collection.read playlists.read';
export const TIDAL_TOKEN_URL='https://auth.tidal.com/v1/oauth2/token';
const API='https://openapi.tidal.com/v2/';
export const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export function callbackURL(href){
 const u=new URL('./tidal-callback.html',href);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)))throw Error('Für TIDAL bitte die lokale HTTPS-Entwicklungsadresse öffnen.');
 return u.href;
}
export async function authorization(clientId,redirect,channel){
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(clientId))throw Error('Bitte die TIDAL Client-ID eintragen. Kein Client Secret.');
 const verifier=nonce(),state=nonce(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 const query=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:TIDAL_SCOPES,state,code_challenge:challenge,code_challenge_method:'S256'});
 return {url:'https://login.tidal.com/authorize?'+query,pending:{clientId,redirect,channel,verifier,state,created:Date.now()}};
}
export function validateCallback(href,pending,now=Date.now()){
 const u=new URL(href),p=u.searchParams;
 if(!pending||u.origin+u.pathname!==pending.redirect||!p.get('state')||p.get('state')!==pending.state||now-pending.created>600000||now<pending.created)throw Error('TIDAL-Anmeldung abgelaufen oder ungültig. Bitte erneut verbinden.');
 if(p.has('error'))throw Error(p.get('error')==='access_denied'?'TIDAL-Anmeldung abgebrochen.':'TIDAL-Anmeldung abgelehnt. App-Freigaben und Redirect-URI prüfen.');
 if(!p.get('code'))throw Error('TIDAL hat keinen Anmeldecode zurückgegeben.');
 return {client_id:pending.clientId,redirect_uri:pending.redirect,grant_type:'authorization_code',code:p.get('code'),code_verifier:pending.verifier,scope:TIDAL_SCOPES};
}
export async function exchangeToken(body,fetcher=fetch){
 const r=await fetcher(TIDAL_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
 const data=await r.json();
 if(!r.ok)throw Object.assign(Error('TIDAL-Anmeldung fehlgeschlagen. Client-ID, Redirect-URI und App-Berechtigungen prüfen.'),{status:r.status});
 if(typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))throw Error('Ungültige TIDAL-Anmeldeantwort.');
 return {...data,expiresAt:Date.now()+data.expires_in*1000};
}
export function apiURL(path,base=API){
 const u=new URL(path,base);
 if(u.origin!==new URL(API).origin||!u.pathname.startsWith('/v2/')||u.username||u.password)throw Error('Ungültige TIDAL-API-Adresse.');
 return u.href;
}
export function createTidalClient({storage,fetcher=fetch}={}){
 if(!storage){try{storage=globalThis.sessionStorage;}catch{}}
 storage||={getItem:()=>null,removeItem:()=>{},setItem:()=>{throw Error('Bitte Sitzungsspeicher für TIDAL erlauben.');}};
 const key='anydj-tidal-session';let token=null,epoch=0,refreshing=null,blockedUntil=0;
 try{token=JSON.parse(storage.getItem(key));}catch{}
 const disconnect=()=>{epoch++;refreshing=null;token=null;storage.removeItem(key);};
 function install(value){if(!value?.access_token||!value?.clientId)throw Error('Ungültige TIDAL-Sitzung.');storage.setItem(key,JSON.stringify(value));token=value;epoch++;refreshing=null;}
 async function access(force=false){
  if(!token)throw Error('Bitte TIDAL verbinden.');
  if(!force&&token.expiresAt>Date.now()+60000)return token.access_token;
  if(refreshing)return refreshing;
  const generation=epoch,current=token;
  const task=(async()=>{
   try{
    if(!current.refresh_token)throw Object.assign(Error('Bitte TIDAL erneut verbinden.'),{status:401});
    const next=await exchangeToken({grant_type:'refresh_token',refresh_token:current.refresh_token,client_id:current.clientId},fetcher);
    if(epoch!==generation)throw Error('TIDAL-Verbindung wurde geändert.');
    token={...current,...next};storage.setItem(key,JSON.stringify(token));return token.access_token;
   }catch(e){if(epoch===generation&&[400,401].includes(e.status))disconnect();throw e;}
  })();refreshing=task;
  try{return await task;}finally{if(refreshing===task)refreshing=null;}
 }
 async function get(path,signal){
  const url=apiURL(path),generation=epoch;
  if(Date.now()<blockedUntil)throw Error(`TIDAL-Anfragelimit: bitte ${Math.ceil((blockedUntil-Date.now())/1000)} Sekunden warten.`);
  for(let attempt=0;attempt<2;attempt++){
   const bearer=await access(attempt===1);signal?.throwIfAborted();
   if(epoch!==generation)throw Error('TIDAL-Verbindung wurde geändert.');
   const timeout=AbortSignal.timeout(20000);
   const r=await fetcher(url,{headers:{Authorization:'Bearer '+bearer,Accept:'application/vnd.api+json'},signal:signal?AbortSignal.any([signal,timeout]):timeout});
   if(epoch!==generation)throw Error('TIDAL-Verbindung wurde geändert.');
   if(r.status===401&&attempt===0)continue;
   const data=await r.json().catch(()=>({}));
   if(r.ok)return data;
   if(r.status===401){disconnect();throw Error('TIDAL-Sitzung abgelaufen. Bitte erneut verbinden.');}
   if(r.status===403)throw Error('TIDAL hat diesen Zugriff nicht freigegeben. App-Berechtigungen für user.read, collection.read und playlists.read prüfen.');
   if(r.status===429){const seconds=Math.max(1,Number(r.headers.get('Retry-After'))||60);blockedUntil=Date.now()+seconds*1000;throw Error(`TIDAL-Anfragelimit: bitte ${seconds} Sekunden warten.`);}
   if(r.status===404)throw Error('TIDAL-Inhalt nicht gefunden oder nicht verfügbar.');
   throw Error(`TIDAL-Anfrage fehlgeschlagen (HTTP ${r.status}).`);
  }
 }
 return {get,install,disconnect,get connected(){return Boolean(token?.access_token);}};
}
export function resources(doc){const data=Array.isArray(doc.data)?doc.data:doc.data?[doc.data]:[];const map=new Map((doc.included||[]).map(r=>[r.type+':'+r.id,r]));return data.map(r=>({...map.get(r.type+':'+r.id),...r}));}
export function durationSeconds(value){const m=/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value||'');return m?(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0):0;}
export function artworkURL(value){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&['resources.tidal.com','images.tidal.com'].includes(u.hostname))return u.href;}catch{}return null;}
export function normalizeResource(resource,included=[]){
 const map=new Map(included.map(r=>[r.type+':'+r.id,r]));const deref=r=>map.get(r?.type+':'+r?.id)||r;
 const related=(r,name)=>{const d=r?.relationships?.[name]?.data;return (Array.isArray(d)?d:d?[d]:[]).map(deref);};
 const r=deref(resource),a=r.attributes||{},album=related(r,'albums')[0];
 const art=related(r,'coverArt')[0]||related(album,'coverArt')[0];
 const image=(art?.attributes?.files||[]).slice().sort((a,b)=>(a.meta?.width||640)-(b.meta?.width||640)).map(f=>artworkURL(f.href)).find(Boolean)||null;
 return {id:String(r.id),type:r.type,name:a.title||a.name||'TIDAL-Titel',artists:related(r,'artists').map(r=>r.attributes?.name).filter(Boolean),duration:durationSeconds(a.duration),image};
}
export function playlistID(value){
 const text=value.trim();if(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(text))return text;
 try{const u=new URL(text);if(u.protocol==='https:'&&['tidal.com','www.tidal.com','listen.tidal.com'].includes(u.hostname))return /^\/(?:browse\/)?playlist\/([a-f0-9-]{36})\/?$/i.exec(u.pathname)?.[1]||null;}catch{}return null;
}
