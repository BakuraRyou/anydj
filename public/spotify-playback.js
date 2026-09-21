// Spotify controls the protected audio output. No stream extraction or analysis.
let sdkPromise;
export function loadSpotifySDK(){
 if(globalThis.Spotify?.Player)return Promise.resolve(globalThis.Spotify);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';script.async=true;
  let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);if(error){script.remove();sdkPromise=null;reject(error);}else resolve(globalThis.Spotify);};
  const timer=setTimeout(()=>finish(Error('Spotify-Player lädt nicht. Bitte erneut versuchen.')),20000);
  globalThis.onSpotifyWebPlaybackSDKReady=()=>finish();
  script.onerror=()=>finish(Error('Spotify-Player konnte nicht geladen werden. Internetverbindung und Browser prüfen.'));
  document.head.append(script);
 });
 return sdkPromise;
}
export function createSpotifyPlayback({client,onState=()=>{},onEnded=()=>{},onError=()=>{},onAuthorizationRequired=()=>{},loadSDK=loadSpotifySDK}){
 let player=null,device=null,pending=null,cancelReady=null,epoch=0,controller=new AbortController(),state=null,poll=null,polling=false;
 let expected=null,started=false,lastAt=0,lastPosition=0;
 function stop(){
  epoch++;clearInterval(poll);poll=null;expected=null;started=false;
  controller.abort();controller=new AbortController();cancelReady?.();cancelReady=null;
  player?.disconnect();player=null;device=null;pending=null;state=null;onState(null);
 }
 function failure(message){stop();onError(message);}
 function ensureAuthorized(){
  if(client.canStream)return;
  onAuthorizationRequired();
  throw Error('Die Spotify-Sitzung hat noch keine Wiedergabefreigabe. Bitte im geöffneten Dialog „Wiedergabe freigeben“ wählen und Spotify erneut verbinden.');
 }
 async function connect(){
  ensureAuthorized();
  if(player&&device)return player;
  if(pending)return pending;
  const generation=epoch;
  pending=(async()=>{
   const SDK=await loadSDK();if(generation!==epoch)throw Error('Spotify-Start abgebrochen.');
   const instance=new SDK.Player({name:'AnyDj',volume:.7,getOAuthToken:cb=>{
    void client.access().then(token=>{if(generation===epoch)cb(token);}).catch(e=>{if(generation===epoch)failure(e.message);});
   }});player=instance;
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>done(Error('Spotify-Player wird nicht bereit. Bitte erneut versuchen.')),20000);
    const done=error=>{clearTimeout(timer);cancelReady=null;error?reject(error):resolve();};
    cancelReady=()=>done(Error('Spotify-Start abgebrochen.'));
    instance.addListener('ready',({device_id})=>{if(generation===epoch){device=device_id;done();}});
    instance.addListener('not_ready',()=>{if(generation===epoch)failure('Spotify-Verbindung unterbrochen. Bitte erneut starten.');});
    for(const [event,message] of [
     ['initialization_error','Dieser Browser unterstützt die geschützte Spotify-Wiedergabe nicht.'],
     ['authentication_error','Bitte Spotify erneut verbinden und die Wiedergabe freigeben.'],
     ['account_error','Spotify Premium wird für die Wiedergabe benötigt.'],
     ['playback_error','Spotify konnte den Titel nicht abspielen.']
    ])instance.addListener(event,()=>{if(generation===epoch){done(Error(message));failure(message);}});
    instance.addListener('autoplay_failed',()=>{if(generation===epoch)onError('Bitte Play am Deck klicken, um die Spotify-Wiedergabe zu erlauben.',{resume:true});});
    Promise.resolve(instance.connect()).then(ok=>{if(!ok)done(Error('Spotify-Verbindung fehlgeschlagen.'));}).catch(done);
   });
   if(generation!==epoch)throw Error('Spotify-Start abgebrochen.');
   const update=value=>{
    if(generation!==epoch)return;
    const current=value?.track_window?.current_track;
    if(expected&&current){
     // Confirm an SDK end event; never advance the queue from a wall-clock alone.
     const nearEnd=state&&!state.paused&&state.duration>0&&lastPosition+Date.now()-lastAt>=state.duration-1500;
     if(started&&(current.id!==expected||(value.paused&&value.position===0&&nearEnd))){stop();onEnded();return;}
     if(current.id===expected&&!value.paused)started=true;
    }
    if(value&&!value.paused&&!expected){failure('Spotify-Titel bitte aus AnyDj starten.');return;}
    state=value;lastPosition=value?.position||0;lastAt=Date.now();onState(value);
   };
   instance.addListener('player_state_changed',update);
   poll=setInterval(()=>{
    if(polling)return;polling=true;
    void instance.getCurrentState().then(update).catch(()=>{}).finally(()=>{polling=false;});
   },500);
   return instance;
  })();
  try{return await pending;}catch(error){if(generation===epoch)stop();throw error;}finally{if(generation===epoch)pending=null;}
 }
 async function play(id,volume=.7){
  if(!/^[a-zA-Z0-9]{22}$/.test(id))throw Error('Ungültiger Spotify-Titel.');
  const activation=player?.activateElement();
  const generation=epoch,instance=await connect();if(generation!==epoch)throw Error('Spotify-Start abgebrochen.');
  await (activation||instance.activateElement());await instance.setVolume(Math.max(0,Math.min(1,volume)));
  if(generation!==epoch)throw Error('Spotify-Start abgebrochen.');
  expected=id;started=false;state=null;
  await client.request('me/player/play?'+new URLSearchParams({device_id:device}),{method:'PUT',body:{uris:['spotify:track:'+id]},signal:controller.signal});
 }
 async function toggle(){
  if(!player||!device||!expected)throw Error('Bitte den Titel erneut starten.');
  const instance=player,generation=epoch;await instance.activateElement();
  if(generation!==epoch)return;
  if(!state||state.paused)await instance.resume();else await instance.pause();
 }
 async function seek(seconds){
  if(!player||!expected)return;
  await player.seek(Math.max(0,Math.min(state?.duration||Infinity,seconds*1000)));
 }
 async function volume(value){if(player)await player.setVolume(Math.max(0,Math.min(1,value)));}
 return {play,toggle,seek,volume,stop,ensureAuthorized,get state(){return state;},get position(){return Math.min(state?.duration||Infinity,(state?.position||0)+(state&&!state.paused?Date.now()-lastAt:0))/1000;}};
}
