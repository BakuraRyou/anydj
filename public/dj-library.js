import {fileIdentity} from './dj-model.js';
import {SHOW_PLAN_VERSION} from './show-plan.js';
// IndexedDB contains file references, metadata and computed shows, never audio.
let database;
function openDatabase() {
  return database ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open(globalThis.document?.documentElement?.dataset.edition==='web'?'anydj-web-library':'wiz-dj-library',3);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('shows'))request.result.createObjectStore('shows');
      if(!request.result.objectStoreNames.contains('tracks'))request.result.createObjectStore('tracks',{keyPath:'id'});
      if(!request.result.objectStoreNames.contains('settings'))request.result.createObjectStore('settings');
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Andere DJ-Tabs schließen und neu laden.'));
  });
}
async function transaction(mode,action,name='tracks') {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,mode),request=action(tx.objectStore(name));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=tx.onabort=()=>reject(tx.error||Error('Speichern fehlgeschlagen.'));
  });
}
const metadata=track=>({id:track.id,name:track.name,size:track.size,lastModified:track.lastModified,
  cover:track.cover||null,coverKey:track.coverKey||null,hotCues:track.hotCues||null,colorMode:track.colorMode||null,sectionEdits:track.sectionEdits||null,order:track.order,handle:track.handle||null,folderId:track.folderId||null,relativePath:track.relativePath||null});
export const readLibrary=()=>transaction('readonly',store=>store.getAll());
export async function removeTrack(id) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['tracks','shows'],'readwrite');
    tx.objectStore('tracks').delete(id);tx.objectStore('shows').delete(id);
    tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);
  });
}
export const saveTrack=track=>transaction('readwrite',store=>store.put(metadata(track)));
export const readFolder=()=>transaction('readonly',store=>store.get('folder'),'settings');
export const saveFolder=folder=>transaction('readwrite',store=>store.put(folder,'folder'),'settings');
const writeFolderChanges=(tracks,removed)=>transaction('readwrite',store=>{
  for(const id of removed)store.delete(id);
  for(const track of tracks)store.put(metadata(track));
  return {};
});
export const readQueueLists=()=>transaction('readonly',store=>store.get('queueLists'),'settings');
export const saveQueueLists=value=>transaction('readwrite',store=>store.put(value,'queueLists'),'settings');
export const readQueue=()=>transaction('readonly',store=>store.get('queue'),'settings');
export const saveQueue=queue=>transaction('readwrite',store=>store.put(queue,'queue'),'settings');
export const readSpotifyLinks=()=>transaction('readonly',store=>store.get('spotifyLinks'),'settings');
export const saveSpotifyLinks=links=>transaction('readwrite',store=>store.put(links,'spotifyLinks'),'settings');

export async function saveFolderChanges(tracks,removed) {
  await writeFolderChanges(tracks,removed);
  for(const id of removed)await transaction('readwrite',store=>store.delete(id),'shows');
}
export const showSignature=(track,options)=>JSON.stringify([SHOW_PLAN_VERSION,fileIdentity(track),options]);
export function cachedShowMatches(record,track,options) {
  return record?.signature===showSignature(track,options)&&record.plan?.version===SHOW_PLAN_VERSION&&
    Number.isFinite(record.plan.duration)&&record.plan.duration>0&&
    Array.isArray(record.plan.frames)&&record.plan.frames.length>0;
}
export async function readShow(track,options) {
  const record=await transaction('readonly',store=>store.get(track.id),'shows');
  return cachedShowMatches(record,track,options)?record:null;
}
export const saveShow=(track,options)=>transaction('readwrite',store=>store.put({
  signature:showSignature(track,options),plan:track.basePlan,
  waveform:track.waveform||null,windows:track.windows||null,refined:Boolean(track.refined),
  structureState:track.structureState==='running'?'pending':track.structureState,
  analysisWarnings:track.analysisWarnings||[],state:track.state||'',
},track.id),'shows');

export const readTransitionLibrary=()=>transaction('readonly',store=>store.get('transitionLibrary'),'settings');
export const saveTransitionLibrary=value=>transaction('readwrite',store=>store.put(value,'transitionLibrary'),'settings');
