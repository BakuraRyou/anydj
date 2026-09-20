// IndexedDB contains references and metadata, never song contents.
let database;
function openDatabase() {
  return database ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open('wiz-dj-library',2);
    request.onupgradeneeded=()=>{
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
  order:track.order,handle:track.handle||null,folderId:track.folderId||null,relativePath:track.relativePath||null});
export const readLibrary=()=>transaction('readonly',store=>store.getAll());
export const removeTrack=id=>transaction('readwrite',store=>store.delete(id));
export const saveTrack=track=>transaction('readwrite',store=>store.put(metadata(track)));
export const readFolder=()=>transaction('readonly',store=>store.get('folder'),'settings');
export const saveFolder=folder=>transaction('readwrite',store=>store.put(folder,'folder'),'settings');
export const saveFolderChanges=(tracks,removed)=>transaction('readwrite',store=>{
  for(const id of removed)store.delete(id);
  for(const track of tracks)store.put(metadata(track));
  return {};
});
export const readQueue=()=>transaction('readonly',store=>store.get('queue'),'settings');
export const saveQueue=queue=>transaction('readwrite',store=>store.put(queue,'queue'),'settings');
