import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {join,basename,extname,isAbsolute} from 'node:path';

const audioExtensions=new Set(['.mp3','.wav','.flac','.ogg','.m4a','.aac']);
const validId=id=>typeof id==='string'&&/^[\w-]{1,128}$/.test(id);
const sameOrigin=(url,origin)=>{try{return new URL(url).origin===origin;}catch{return false;}};

// File System Access handles already encode the user's file/folder selection.
// Regrant read access to those handles for our own renderer after a restart.
export function installLocalReadPermissions(session,{origin,getWindow}){
 // Electron 44 calls file-handle GetStatus with webContents=null. In that
 // case the handle's origin is authoritative; still require our active window
 // and reject foreign origins, non-app windows and every write request.
 const allowed=(contents,requestOrigin,details)=>{
  const owner=getWindow()?.webContents;
  return Boolean(owner&&(contents===null||contents===owner)&&sameOrigin(owner.getURL(),origin)&&sameOrigin(requestOrigin,origin)&&(!details.requestingUrl||sameOrigin(details.requestingUrl,origin))&&details.fileAccessType==='readable');
 };
 session.setPermissionCheckHandler((contents,permission,requestOrigin,details)=>permission==='fileSystem'?allowed(contents,requestOrigin,details):true);
 session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(permission==='fileSystem'?allowed(contents,details.requestingUrl,details):true));
 // Other permission types retain Electron's existing default approval behavior.
}

// Remember paths obtained from user-selected native Files via the sandboxed
// preload. The renderer can subsequently read only registered track IDs.
export async function installLocalAudio({ipcMain,origin,getWindow,directory}){
 const filename=join(directory,'audio-references.json');let records={};
 try{const value=JSON.parse(await readFile(filename,'utf8'));if(value&&typeof value==='object'&&!Array.isArray(value))records=value;}catch(error){if(error.code!=='ENOENT')throw error;}
 let writes=Promise.resolve();
 const save=()=>{const json=JSON.stringify(records);const next=writes.then(async()=>{await mkdir(directory,{recursive:true});await writeFile(filename+'.tmp',json,{mode:0o600});await rename(filename+'.tmp',filename);});writes=next.catch(()=>{});return next;};
 const trusted=event=>event.sender===getWindow()?.webContents&&event.senderFrame===event.sender.mainFrame&&sameOrigin(event.senderFrame?.url,origin);
 const checked=action=>async(event,...args)=>{if(!trusted(event))throw Error('Unzulässiger Dateizugriff.');return action(...args);};
 ipcMain.handle('anydj:remember-audio',checked(async({id,path})=>{
  if(!validId(id)||typeof path!=='string'||!isAbsolute(path)||!audioExtensions.has(extname(path).toLowerCase()))throw Error('Ungültige Audiodatei.');
  const info=await stat(path);if(!info.isFile()||info.size>50*1024*1024)throw Error('Audiodatei nicht unterstützt.');
  Object.defineProperty(records,id,{value:{path,size:info.size,lastModified:Math.trunc(info.mtimeMs)},enumerable:true,configurable:true,writable:true});await save();return true;
 }));
 ipcMain.handle('anydj:read-audio',checked(async id=>{
  if(!validId(id))throw Error('Ungültiger Titel.');
  const record=Object.hasOwn(records,id)?records[id]:null;if(!record)return null;
  const info=await stat(record.path);if(!info.isFile()||info.size!==record.size||Math.trunc(info.mtimeMs)!==record.lastModified)throw Error('Die Audiodatei wurde verändert. Bitte die Datei erneut auswählen.');
  const bytes=await readFile(record.path);if(bytes.length!==record.size)throw Error('Die Audiodatei wurde während des Lesens verändert.');
  return {bytes,name:basename(record.path),lastModified:record.lastModified};
 }));
 ipcMain.handle('anydj:forget-audio',checked(async id=>{if(!validId(id))throw Error('Ungültiger Titel.');delete records[id];await save();}));
}
