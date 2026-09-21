import {authorization,callbackURL,validateCallback,exchangeToken} from './tidal-client.js';
const status=document.getElementById('authStatus'),key='anydj-tidal-pkce';let pending;
try{
 const url=new URL(location.href);
 if(url.hash){
  const p=new URLSearchParams(url.hash.slice(1));history.replaceState(null,'',url.pathname);
  if(!/^[a-f0-9]{64}$/.test(p.get('channel')||''))throw Error('Anmeldung bitte aus AnyDj starten.');
  const request=await authorization(p.get('client'),callbackURL(location.href),p.get('channel'));pending=request.pending;
  sessionStorage.setItem(key,JSON.stringify(pending));location.replace(request.url);
 }else{
  pending=JSON.parse(sessionStorage.getItem(key));sessionStorage.removeItem(key);history.replaceState(null,'',url.pathname);
  const token=await exchangeToken(validateCallback(url.href,pending));
  const channel=new BroadcastChannel('anydj-tidal-'+pending.channel);channel.postMessage({token:{...token,clientId:pending.clientId}});channel.close();
  status.textContent='TIDAL ist verbunden. Du kannst zu AnyDj zurückkehren.';window.close();
 }
}catch(e){status.textContent=e.message;if(pending?.channel){const channel=new BroadcastChannel('anydj-tidal-'+pending.channel);channel.postMessage({error:e.message});channel.close();}}
