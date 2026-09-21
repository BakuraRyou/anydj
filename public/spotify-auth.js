import {authorization,callbackURL,validateCallback,exchangeToken} from './spotify-client.js';
const status=document.getElementById('authStatus'),key='anydj-spotify-pkce';
let pending;
try{
  const url=new URL(location.href);
  if(url.hash){
    const params=new URLSearchParams(url.hash.slice(1)),clientId=params.get('client'),channel=params.get('channel');
    history.replaceState(null,'',url.pathname);
    if(!/^[a-f0-9]{64}$/.test(channel||''))throw Error('Bitte die Anmeldung aus AnyDj starten.');
    const request=await authorization(clientId,callbackURL(location.href),channel);pending=request.pending;
    sessionStorage.setItem(key,JSON.stringify(pending));location.replace(request.url);
  }else{
    pending=JSON.parse(sessionStorage.getItem(key));sessionStorage.removeItem(key);
    history.replaceState(null,'',url.pathname);
    const body=validateCallback(url.href,pending),token=await exchangeToken(body);
    const channel=new BroadcastChannel('anydj-spotify-'+pending.channel);
    channel.postMessage({token:{...token,clientId:pending.clientId}});channel.close();
    status.textContent='Spotify ist verbunden. Du kannst zu AnyDj zurückkehren.';
    window.close();
  }
}catch(error){
  status.textContent=error.message;
  if(pending?.channel){const channel=new BroadcastChannel('anydj-spotify-'+pending.channel);channel.postMessage({error:error.message});channel.close();}
}
