import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {fileIdentity} from '../public/dj-model.js';

const dj=await readFile(new URL('../public/dj.js',import.meta.url),'utf8');
const fileSource=dj.slice(dj.indexOf('async function ensureFile('),dj.indexOf('async function loadDeck('));
const ensureFile=runInNewContext(fileSource+';ensureFile',{fileIdentity,rememberDesktopFile:async()=>{},prepareTracks:()=>{},renderLibrary:()=>{}});
const sessionSource=(await readFile(new URL('../public/dj-session.js',import.meta.url),'utf8')).replace('export function','function');

async function restored(track){
 const node=()=>({value:'',checked:true,type:'',options:[],hidden:false,textContent:'',addEventListener(){},dispatchEvent(){},after(){}});
 const nodes=new Map(),root={querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);}};
 const deck={panel:root,audio:{currentTime:0,playbackRate:1,paused:true}};
 const snapshot={version:1,decks:[{trackId:track.id,time:4,cue:2}],mixer:{}};
 const document={...root,documentElement:{dataset:{}},createElement:node,addEventListener(){}};
 const createSession=runInNewContext(sessionSource+';createDJSession',{document,Event,localStorage:{getItem:key=>key==='anydj-dj-session-local'?JSON.stringify(snapshot):null,setItem(){}},setInterval:()=>0,clearInterval(){}});
 const session=createSession({decks:[deck],root,updateGains(){},drawDeck(){},reconnect(){},restoreFile:async(d,options)=>{
  await ensureFile(d.track,options);d.audio.currentTime=d.resumeTime;d.resumeTime=null;d.resumeButton.hidden=true;
 }});
 await session.restore([track]);session.destroy();return deck;
}
const file={name:'song.mp3',size:120,lastModified:1};
const track=extra=>({id:'song',...file,plan:{duration:12},...extra});

test('session restores a File already read by folder sync without requiring a handle',async()=>{
 const deck=await restored(track({file}));
 assert.equal(deck.resumeButton.hidden,true);assert.equal(deck.resumeTime,null);assert.equal(deck.audio.currentTime,4);assert.equal(deck.audio.paused,true);
});

test('startup tries readable handles without querying or requesting a fresh permission',async()=>{
 let reads=0;
 const deck=await restored(track({handle:{queryPermission(){throw Error('Startup must not gate a read on permission status');},requestPermission(){throw Error('Startup must not prompt');},async getFile(){reads++;return file;}}}));
 assert.equal(reads,1);assert.equal(deck.resumeButton.hidden,true);assert.equal(deck.audio.currentTime,4);
});

test('unavailable or changed files keep the reconnect action and saved playback position',async()=>{
 for(const getFile of [async()=>{throw Error('NotAllowedError');},async()=>({...file,size:121})]){
  const deck=await restored(track({handle:{requestPermission(){throw Error('Must not prompt');},getFile}}));
  assert.equal(deck.resumeButton.hidden,false);assert.equal(deck.resumeTime,4);assert.equal(deck.audio.paused,true);
 }
});

test('explicit reconnect still requests permission when necessary',async()=>{
 let granted=false,requests=0;
 const source=track({handle:{async queryPermission(){return granted?'granted':'prompt';},async requestPermission(){requests++;granted=true;return 'granted';},async getFile(){if(!granted)throw Error('NotAllowedError');return file;}}});
 await assert.rejects(ensureFile(source,{requestPermission:false}));assert.equal(requests,0);
 assert.equal(await ensureFile(source),file);assert.equal(requests,1);
});

test('native file references restore an import without a browser handle',async()=>{
 const file=new File(['audio'],'native.wav',{lastModified:123});
 const nativeEnsure=runInNewContext(fileSource+';ensureFile',{File,fileIdentity,anydjFiles:{read:async id=>{assert.equal(id,'native');return {bytes:new TextEncoder().encode('audio'),name:file.name,lastModified:file.lastModified};}},rememberDesktopFile:async()=>{},prepareTracks(){},renderLibrary(){}});
 const track={id:'native',name:file.name,size:file.size,lastModified:file.lastModified,nativeFile:true};
 assert.equal(fileIdentity(await nativeEnsure(track,{requestPermission:false})),fileIdentity(file));
});

test('an old native path can fall back to a still-readable selected handle',async()=>{
 const nativeEnsure=runInNewContext(fileSource+';ensureFile',{fileIdentity,anydjFiles:{read:async()=>{throw Error('ENOENT');}},rememberDesktopFile:async()=>{},prepareTracks(){},renderLibrary(){}});
 const saved=track({handle:{getFile:async()=>file}});
 assert.equal(await nativeEnsure(saved,{requestPermission:false}),file);
});
