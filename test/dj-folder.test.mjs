import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanFolder,folderChanges} from '../public/dj-folder.js';
const file=(name,size=12,lastModified=1)=>({name,size,lastModified,type:'audio/mpeg'});
const handle=(name)=>({kind:'file',name,getFile:async()=>file(name)});
const dir=(name,children)=>({name,kind:'directory',async *values(){yield* children;}});
test('folder scan recurses and preserves relative paths',async()=>{
 const entries=await scanFolder(dir('music',[handle('a.mp3'),dir('album',[handle('a.mp3')]),{kind:'file',name:'note.txt',getFile:async()=>({name:'note.txt',size:5,type:'text/plain'})}]));
 assert.deepEqual(entries.map(e=>e.path),['a.mp3','album/a.mp3']);
});
test('failed and aborted scans reject instead of returning partial inventories',async()=>{
 await assert.rejects(scanFolder(dir('music',[handle('a.mp3'),{kind:'file',name:'b.mp3',getFile:async()=>{throw Error('unreadable');}}])),/unreadable/);
 const controller=new AbortController();controller.abort();await assert.rejects(scanFolder(dir('music',[]),{signal:controller.signal}),{name:'AbortError'});
});
test('reconciliation updates metadata, leaves manual tracks, and defers loaded changes',()=>{
 const track=(id,path,size=12)=>({id,folderId:'folder',relativePath:path,size,lastModified:1});
 const tracks=[track('same','same.mp3'),track('update','update.mp3'),track('remove','remove.mp3'),track('playing','playing.mp3'),{id:'manual'}];
 const entries=['same','update','playing','new'].map(name=>({path:name+'.mp3',file:file(name+'.mp3',name==='same'?12:24)}));
 const result=folderChanges(tracks,entries,'folder',new Set(['playing']));
 assert.deepEqual(result.update.map(x=>x.track.id),['update']);assert.deepEqual(result.remove.map(x=>x.id),['remove']);assert.equal(result.pending[0].track.id,'playing');assert.equal(result.add[0].path,'new.mp3');assert.equal(result.unchanged[0].track.id,'same');
});
test('switching folders defers loaded deletions and removes previous folder entries',()=>{
 const result=folderChanges([{id:'a',folderId:'old'},{id:'b',folderId:'old'}],[],'new',new Set(['a']));
 assert.equal(result.pending[0].entry,null);assert.equal(result.remove[0].id,'b');
});
