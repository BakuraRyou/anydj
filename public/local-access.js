import {migrateStorageKey} from './storage-migration.js';
// Keep access to existing installations when upgrading their session storage.
export function readAccessToken(){
  try{return migrateStorageKey(sessionStorage,'anydj-web-token','-web-token')||'';}catch{return '';}
}
export async function ensureLocalAccess(){
  let token=readAccessToken();
  const check=async()=>{
    const response=await fetch('/api/meta',{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Lokaler Server ist nicht erreichbar.');
    return response.json();
  };
  if(!(await check()).tokenRequired)return token;
  const dialog=document.createElement('dialog');
  dialog.innerHTML='<form><h2>Dein Zugang zu AnyDj</h2><p>Gib den Web-Zugangscode aus dem Server-Terminal ein.</p><label for="localAccessToken">Web-Zugangscode</label><input id="localAccessToken" type="password" autocomplete="current-password" required><p role="status"></p><button class="button primary" type="submit">Verbinden</button></form>';
  document.body.append(dialog);dialog.addEventListener('cancel',event=>event.preventDefault());dialog.showModal();
  return new Promise(resolve=>{
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const button=dialog.querySelector('button');button.disabled=true;
      token=dialog.querySelector('input').value;
      try{
        if((await check()).tokenRequired)throw Error('Der Zugangscode stimmt nicht.');
        try{sessionStorage.setItem('anydj-web-token',token);}catch{}
        dialog.close();dialog.remove();resolve(token);
      }catch(error){dialog.querySelector('[role="status"]').textContent=error.message;}
      finally{button.disabled=false;}
    };
  });
}
