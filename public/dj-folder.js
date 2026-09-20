export const audioFile = file => (file.type?.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)) && file.size<=50*1024*1024;

// Read a full snapshot before changing the library. A denied/failed scan must
// never look like an empty folder and remove existing entries.
export async function scanFolder(handle,{signal}={}) {
  const entries=[];
  async function visit(directory,prefix='',depth=0) {
    signal?.throwIfAborted();
    if(depth>32)throw Error('Zu viele verschachtelte Unterordner.');
    for await(const child of directory.values()) {
      signal?.throwIfAborted();
      const path=prefix+child.name;
      if(child.kind==='directory')await visit(child,path+'/',depth+1);
      else if(child.kind==='file') {
        const file=await child.getFile();
        if(audioFile(file))entries.push({path,handle:child,file});
        if(entries.length>2000)throw Error('Maximal 2.000 Tracks pro Ordner.');
      }
    }
  }
  await visit(handle);
  return entries.sort((a,b)=>a.path.localeCompare(b.path));
}
export function folderChanges(tracks,entries,folderId,pinned=new Set()) {
  const remaining=new Map(entries.map(entry=>[entry.path,entry]));
  const result={add:[],update:[],remove:[],pending:[],unchanged:[]};
  for(const track of tracks.filter(t=>t.folderId)) {
    const entry=track.folderId===folderId?remaining.get(track.relativePath):null;
    if(entry)remaining.delete(track.relativePath);
    if(!entry) {result[pinned.has(track.id)?'pending':'remove'].push(pinned.has(track.id)?{track,entry:null}:track);continue;}
    const changed=track.size!==entry.file.size || track.lastModified!==entry.file.lastModified;
    result[changed?(pinned.has(track.id)?'pending':'update'):'unchanged'].push({track,entry});
  }
  result.add=[...remaining.values()];return result;
}
