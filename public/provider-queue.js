// Provider entries live only in the browser's saved queues, never on the server.
export function spotifyQueueEntry(track,id=crypto.randomUUID()){
 if(!track||!/^[a-zA-Z0-9]{22}$/.test(track.id)||track.available===false)throw Error('Spotify-Titel nicht verfügbar.');
 return {id,trackId:'spotify:'+track.id,provider:'spotify',remote:{id:track.id,name:String(track.name||'Spotify-Titel'),artists:Array.isArray(track.artists)?track.artists.map(String):[],duration:Number.isFinite(track.duration)?Math.max(0,track.duration):0,image:typeof track.image==='string'?track.image:null}};
}
export function validQueueEntry(entry){
 if(!entry||typeof entry.id!=='string'||typeof entry.trackId!=='string')return false;
 return entry.provider==='spotify'?Boolean(entry.remote&&/^[a-zA-Z0-9]{22}$/.test(entry.remote.id)&&entry.trackId==='spotify:'+entry.remote.id):!entry.provider&&!entry.trackId.startsWith('spotify:');
}
export function copyQueueEntry(entry,id=entry.id){
 if(!validQueueEntry(entry))throw Error('Ungültiger Warteschlangeneintrag.');
 return entry.provider==='spotify'?spotifyQueueEntry(entry.remote,id):{id,trackId:entry.trackId};
}
