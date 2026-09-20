import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {StructureAnalysis,STRUCTURE_RATE} from '../lib/structure-analysis.mjs';
import {createApp} from '../server.mjs';
const result={version:1,source:'all-in-one',duration:5,segments:[{start:0,end:5,label:'intro'}]};
async function app(t,analysis,extra={}) {
  const {server}=await createApp({demo:true,structureAnalysis:analysis,...extra});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  return {base,post(body=Buffer.alloc(STRUCTURE_RATE*5),headers={},signal){return fetch(base+'/api/analysis/structure',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-WiZ-Local':'1',...headers},body,signal});}};
}
test('Songstruktur-API cached validierte Ergebnisse und entfernt temporäres Audio',async t=>{
  let count=0,dir;const analysis=new StructureAnalysis({ready:async()=>{},run:async path=>{dir=path;count++;assert.equal((await readFile(join(path,'input.pcm'))).length,STRUCTURE_RATE*5);return result;}});
  const client=await app(t,analysis);
  const first=await client.post();assert.equal(first.status,200);assert.equal((await first.json()).cached,false);
  await assert.rejects(access(dir));
  assert.equal((await (await client.post()).json()).cached,true);assert.equal(count,1);
  assert.equal((await client.post(Buffer.alloc(3))).status,400);
  assert.equal((await client.post(undefined,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await client.post(undefined,{'X-WiZ-Local':''})).status,403);
  assert.equal((await client.post(undefined,{Origin:'https://foreign.invalid'})).status,403);
});
test('Songstruktur-API schützt LAN-Zugang und meldet fehlendes Modell und kaputtes Ergebnis',async t=>{
  const analysis=new StructureAnalysis({ready:async()=>{},run:async()=>({...result,duration:10})});
  const client=await app(t,analysis,{token:'a'.repeat(24)});
  assert.equal((await client.post()).status,401);
  assert.equal((await client.post(undefined,{Authorization:'Bearer '+'a'.repeat(24)})).status,502);
  analysis.ready=async()=>{throw Error('missing');};
  assert.equal((await client.post(undefined,{Authorization:'Bearer '+'a'.repeat(24)})).status,503);
});
test('Abbruch beendet Inferenz, räumt Dateien auf und gibt den Analyseplatz frei',async t=>{
  let dir,entered;const started=new Promise(resolve=>entered=resolve);
  const analysis=new StructureAnalysis({ready:async()=>{},run:async(path,{signal})=>{dir=path;entered();await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});}});
  const client=await app(t,analysis),controller=new AbortController();
  const pending=client.post(undefined,{},controller.signal);const rejected=assert.rejects(pending);
  await started;assert.equal((await client.post()).status,409);controller.abort();await rejected;
  for(let i=0;i<100&&analysis.active;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(analysis.active,null);await assert.rejects(access(dir));
});
