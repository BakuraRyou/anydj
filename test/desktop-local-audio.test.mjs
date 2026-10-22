import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installLocalAudio,installLocalReadPermissions} from '../desktop/local-audio.mjs';

test('native references survive restart, restrict reads to registered IDs, detect changes and forget removed tracks',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'anydj-native-audio-'));
 try{
  const path=join(directory,'song.wav');await writeFile(path,'audio fixture');
  const handlers=new Map(),ipcMain={handle:(name,fn)=>handlers.set(name,fn)};
  const window={webContents:{mainFrame:{url:'http://127.0.0.1:36931/dj'}}};
  const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
  const install=()=>installLocalAudio({directory,ipcMain,origin:'http://127.0.0.1:36931',getWindow:()=>window});
  await install();const call=(name,...args)=>handlers.get('anydj:'+name)(event,...args);
  assert.equal(await call('read-audio','unknown'),null);
  await assert.rejects(handlers.get('anydj:read-audio')({...event,senderFrame:{url:event.senderFrame.url}},'song'),/Unzulässig/);
  await call('remember-audio',{id:'song',path});await install();
  const result=await call('read-audio','song');assert.equal(result.name,'song.wav');assert.equal(Buffer.from(result.bytes).toString(),'audio fixture');assert.equal(result.lastModified,Math.trunc((await stat(path)).mtimeMs));
  await writeFile(path,'changed fixture');await assert.rejects(call('read-audio','song'),/verändert/);
  await call('forget-audio','song');await install();assert.equal(await call('read-audio','song'),null);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('restored handles get read access only in the trusted app, never write access',()=>{
 const origin='http://127.0.0.1:36931',window={webContents:{getURL:()=>origin+'/dj'}};let check,request;
 installLocalReadPermissions({setPermissionCheckHandler:fn=>check=fn,setPermissionRequestHandler:fn=>request=fn},{origin,getWindow:()=>window});
 const details={fileAccessType:'readable',isMainFrame:false,requestingUrl:origin+'/dj'};
 assert.equal(check(window.webContents,'fileSystem',origin,details),true);
 assert.equal(check(null,'fileSystem',origin,{fileAccessType:'readable',filePath:'/music/song.wav',isDirectory:false,isMainFrame:false}),true);
 assert.equal(check(null,'fileSystem','https://example.com',details),false);
 assert.equal(check(null,'fileSystem',origin,{...details,fileAccessType:'writable'}),false);
 assert.equal(check(window.webContents,'fileSystem',origin,{...details,fileAccessType:'writable'}),false);
 assert.equal(check(window.webContents,'fileSystem','https://example.com',details),false);
 assert.equal(check({},'fileSystem',origin,details),false);
 assert.equal(check(window.webContents,'fileSystem',origin,{...details,requestingUrl:'https://example.com'}),false);
 let granted;request(window.webContents,'fileSystem',value=>granted=value,details);assert.equal(granted,true);
});
