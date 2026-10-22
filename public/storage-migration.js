// Discover previous names by purpose so upgrades do not depend on old branding.
export function migrateStorageKey(storage,target,suffix){
  let value;
  try{
    value=storage.getItem(target);
    const previous=Array.from({length:storage.length},(_,i)=>storage.key(i))
      .filter(key=>key!==target&&key?.endsWith(suffix));
    for(const key of previous){
      if(value===null){value=storage.getItem(key);if(value!==null)storage.setItem(target,value);}
      storage.removeItem(key);
    }
  }catch{/* A disabled store must not prevent playback or local access. */}
  return value;
}

function openPrevious(factory,name){
  return new Promise((resolve,reject)=>{
    const request=factory.open(name);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Andere DJ-Tabs schließen und neu laden.'));
  });
}
function snapshot(db){
  const names=Array.from(db.objectStoreNames);
  if(!names.length)return Promise.resolve([]);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readonly');
    const entries=names.map(name=>{
      const store=tx.objectStore(name);
      return {name,keyPath:store.keyPath,keys:store.getAllKeys(),values:store.getAll()};
    });
    tx.oncomplete=()=>resolve(entries.map(({name,keyPath,keys,values})=>({name,keyPath,keys:keys.result,values:values.result})));
    tx.onerror=tx.onabort=()=>reject(tx.error||Error('Vorhandene Bibliothek konnte nicht gelesen werden.'));
  });
}
function copyMissing(db,entries){
  const names=entries.map(entry=>entry.name);
  if(!names.length)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');
    for(const entry of entries){
      const store=tx.objectStore(entry.name);
      entry.keys.forEach((key,index)=>{
        const request=store.count(key);
        request.onsuccess=()=>{if(!request.result){
          if(store.keyPath===null)store.put(entry.values[index],key);
          else store.put(entry.values[index]);
        }};
      });
    }
    tx.oncomplete=()=>resolve();
    tx.onerror=tx.onabort=()=>reject(tx.error||Error('Bibliothek konnte nicht übernommen werden. Die bisherigen Daten bleiben erhalten.'));
  });
}
export async function migrateLibraryDatabase(factory,target){
  if(typeof factory.databases!=='function')throw Error('Bitte aktualisiere deinen Browser, damit vorhandene Bibliotheken sicher übernommen werden können.');
  const candidates=(await factory.databases()).filter(db=>db.name!==target.name&&db.name?.endsWith('-dj-library'));
  for(const candidate of candidates){
    const source=await openPrevious(factory,candidate.name);
    try{
      const entries=await snapshot(source);
      if(entries.some(entry=>!target.objectStoreNames.contains(entry.name)))throw Error('Unbekannte Bibliotheksdaten. Die bisherigen Daten bleiben erhalten.');
      await copyMissing(target,entries);
    }finally{source.close();}
    // Deletion follows a committed copy. An open old tab may defer cleanup.
    await new Promise(resolve=>{
      const request=factory.deleteDatabase(candidate.name);
      request.onsuccess=request.onerror=request.onblocked=()=>resolve();
    });
  }
}
