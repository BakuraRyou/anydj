import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStructure} from '../public/structure-analysis.js';
test('client preserves instrument results without a deadline',async t=>{
 const oldFetch=globalThis.fetch,oldContext=globalThis.OfflineAudioContext;
 t.mock.method(AbortSignal,'timeout',()=>{throw Error('Unexpected analysis deadline');});
 t.after(()=>{globalThis.fetch=oldFetch;globalThis.OfflineAudioContext=oldContext;});
 globalThis.OfflineAudioContext=class{async decodeAudioData(){return {duration:5,length:220500,numberOfChannels:1,getChannelData:()=>new Float32Array(220500)};}};
 let posted=false;
 globalThis.fetch=async(url,options)=>{
  if(!options.method)return {ok:true,json:async()=>({available:true})};
  posted=true;assert.equal(options.headers['X-Analysis-Budget-Ms'],undefined);
  return {ok:true,json:async()=>({version:1,source:'all-in-one',duration:5,segments:[{start:0,end:5,label:'intro'}],elapsedSeconds:1,
   instruments:{version:1,source:'htdemucs',step:.1,drums:Array(50).fill(.1),bass:Array(50).fill(.1),vocals:Array(50).fill(.1),other:Array(50).fill(.1)}})};
 };
 const result=await analyzeStructure(new ArrayBuffer(0),5,{});
 assert.equal(posted,true);assert.equal(result.structure.instruments.drums.length,50);assert.match(result.message,/Instrumente/);

});

test('lost connection retries once only when the service is idle',async t=>{
 const oldFetch=globalThis.fetch,oldContext=globalThis.OfflineAudioContext;
 t.after(()=>{globalThis.fetch=oldFetch;globalThis.OfflineAudioContext=oldContext;});
 globalThis.OfflineAudioContext=class{async decodeAudioData(){return {duration:5,length:220500,numberOfChannels:1,getChannelData:()=>new Float32Array(220500)};}};
 let posts=0,busy=false;
 globalThis.fetch=async(url,options)=>{
  if(!options.method)return {ok:true,json:async()=>({available:true,busy})};
  if(++posts===1)throw new TypeError('Failed to fetch');
  return {ok:true,json:async()=>({version:1,source:'all-in-one',duration:5,segments:[{start:0,end:5,label:'intro'}]})};
 };
 assert.ok((await analyzeStructure(new ArrayBuffer(0),5)).structure);assert.equal(posts,2);
 posts=0;busy=true;
 const blocked=await analyzeStructure(new ArrayBuffer(0),5);
 assert.equal(posts,1);assert.equal(blocked.structure,null);assert.match(blocked.message,/arbeitet noch/);
 globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
 const offline=await analyzeStructure(new ArrayBuffer(0),5);
 assert.match(offline.message,/Analysedienst unterbrochen/);assert.doesNotMatch(offline.message,/Failed to fetch/);
});


