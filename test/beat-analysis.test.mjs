import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { BeatAnalysis, MAX_PCM_BYTES } from '../lib/beat-analysis.mjs';
import { validateBeatGrid } from '../public/beat-grid.js';
import { compileShow, showFrameAt } from '../public/show-plan.js';
import { settings } from '../lib/music.mjs';
import { createApp } from '../server.mjs';
import { analyzeBeats } from '../public/beat-analysis.js';

const grid=(duration=2)=>({version:1,source:'beat-this',duration,beats:[.25,.75,1.25,1.75],downbeats:[.25]});
const pcm=()=>Buffer.alloc(2*16000*4);
async function app(t,analysis,extra={}) {
  const {server}=await createApp({demo:true,beatAnalysis:analysis,...extra});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return {base:`http://127.0.0.1:${server.address().port}`,post(body=pcm(),headers={},signal){return fetch(`http://127.0.0.1:${server.address().port}/api/analysis/beats`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-WiZ-Local':'1',...headers},body,signal});}};
}
test('Zeitpunkte müssen zum Audio passen, sortiert und endlich sein; Taktanfänge gehören zu Beats',()=>{
  assert.deepEqual(validateBeatGrid(grid(),2),grid());
  for(const bad of [{...grid(),duration:3},{...grid(),beats:[.5,.5]},{...grid(),beats:[NaN]},{...grid(),beats:[2]},{...grid(),downbeats:[.5]}])assert.throws(()=>validateBeatGrid(bad,2));
  assert.doesNotThrow(()=>validateBeatGrid({...grid(),beats:[],downbeats:[]},2));
});
test('Externe Beats ersetzen Heuristik vollständig und überleben erneutes Rendern',()=>{
  const windows=Array.from({length:100},(_,i)=>({rms:.1,bass:.02,beatSeq:Math.floor(i/10)}));
  const a=compileShow(windows,2,settings(),grid());
  assert.equal(a.beats,4);assert.deepEqual(a.beatGrid,grid());
  assert.equal(a.frames[0].dimming,5);assert.equal(a.frames[2].dimming,75);
  const b=compileShow(windows,2,settings({palette:'ocean'}),a.beatGrid);
  assert.deepEqual(a.frames.map(f=>f.dimming),b.frames.map(f=>f.dimming));
  const silence=compileShow(windows,2,settings(),{...grid(),beats:[],downbeats:[]});
  assert.ok(silence.frames.every(f=>f.dimming===5));
  assert.throws(()=>compileShow(windows,2,settings(),grid(3)));
});
test('Binäre API validiert PCM und cached nur erfolgreiche Ergebnisse',async t=>{
  let calls=0;const analysis=new BeatAnalysis({ready:async()=>{},run:async()=>{calls++;return grid();}});
  const client=await app(t,analysis);
  assert.equal((await fetch(client.base+'/api/analysis/beats').then(r=>r.json())).available,true);
  const first=await client.post();assert.equal(first.status,200);assert.equal((await first.json()).cached,false);
  assert.equal((await (await client.post()).json()).cached,true);assert.equal(calls,1);
  assert.equal((await client.post(Buffer.alloc(6401))).status,400);
  const invalid=pcm();invalid.writeFloatLE(NaN,0);assert.equal((await client.post(invalid)).status,400);
  assert.equal((await client.post(pcm(),{'Content-Type':'application/json'})).status,415);
  assert.equal((await client.post(pcm(),{'X-WiZ-Local':''})).status,403);
  assert.equal((await client.post(pcm(),{Origin:'https://foreign.invalid'})).status,403);
  assert.equal(MAX_PCM_BYTES,57600000);
});
test('Audio-Analyse respektiert den LAN-Zugangscode und verändert das JSON-Limit nicht',async t=>{
  const client=await app(t,new BeatAnalysis({ready:async()=>{},run:async()=>grid()}),{token:'a'.repeat(24)});
  assert.equal((await client.post()).status,401);
  assert.equal((await client.post(pcm(),{Authorization:'Bearer '+'a'.repeat(24)})).status,200);
  const r=await fetch(client.base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-WiZ-Local':'1',Authorization:'Bearer '+'a'.repeat(24)},body:JSON.stringify({padding:'x'.repeat(9000)})});
  assert.equal(r.status,413);
});
test('Fehlendes Modell und defektes Ergebnis führen zu sichtbaren Fehlern',async t=>{
  const missing=await app(t,new BeatAnalysis({ready:async()=>{throw Error('missing');}}));
  assert.equal((await missing.post()).status,503);
  const broken=await app(t,new BeatAnalysis({ready:async()=>{},run:async()=>({...grid(),beats:[-1]})}));
  assert.equal((await broken.post()).status,502);
});
test('Nur eine Analyse gleichzeitig; Abbruch gibt den Platz wieder frei',async t=>{
  let started;const entered=new Promise(resolve=>{started=resolve;});let cancelled=false;
  const analysis=new BeatAnalysis({ready:async()=>{},run:async(_,{signal})=>{started();return new Promise((_,reject)=>signal.addEventListener('abort',()=>{cancelled=true;reject(signal.reason);},{once:true}));}});
  const client=await app(t,analysis),controller=new AbortController();
  const first=client.post(pcm(),{},controller.signal);const rejected=assert.rejects(first);
  await entered;assert.equal((await client.post()).status,409);controller.abort();await rejected;
  for(let i=0;i<100&&analysis.active;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(cancelled,true);assert.equal(analysis.active,null);
});
test('Zeitlimit bricht den Analyseprozess ab und lässt einen neuen Versuch zu',async t=>{
  const analysis=new BeatAnalysis({ready:async()=>{},timeoutMs:50,run:async(_,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
  const client=await app(t,analysis);assert.equal((await client.post()).status,504);assert.equal(analysis.active,null);
});
test('Browser-Fallback ist ausdrücklich sichtbar; Nutzerabbruch wird nicht verschluckt',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async()=>new Response(JSON.stringify({available:false,message:'Modell fehlt.'}),{headers:{'Content-Type':'application/json'}});
  const fallback=await analyzeBeats({},{});assert.equal(fallback.grid,null);assert.match(fallback.message,/Standard-Analyse verwendet: Modell fehlt/);
  const controller=new AbortController();controller.abort();await assert.rejects(analyzeBeats({},{signal:controller.signal}));
  assert.equal((await analyzeBeats({},{engine:'builtin'})).message,'Standard-Analyse');
});

test('Beat-Helligkeit folgt exakten Zeitpunkten statt dem 125-ms-Farbraster',()=>{
  const windows=Array.from({length:100},()=>({rms:.1,bass:.02,beatSeq:0}));
  const irregular={...grid(),beats:[.333,.847,1.361,1.875],downbeats:[.333]};
  const plan=compileShow(windows,2,settings(),irregular);
  assert.equal(showFrameAt(plan,.332).dimming,5);
  assert.equal(showFrameAt(plan,.333).dimming,75);
  assert.ok(showFrameAt(plan,.37).dimming<75);
  assert.equal(showFrameAt(plan,.847).dimming,75);
  assert.ok(showFrameAt(plan,.846).dimming<showFrameAt(plan,.847).dimming);
  // Random access and seeking do not depend on which frames were read before.
  const before=showFrameAt(plan,.333);showFrameAt(plan,1.9);assert.deepEqual(showFrameAt(plan,.333),before);
});

test('Beat-Raster allein erzeugt ohne akustische Anschläge keinen Dauerblinker',()=>{
  const windows=Array.from({length:1000},()=>({rms:.1,bass:.02,beatSeq:0}));
  const beats=Array.from({length:40},(_,i)=>i*.5);
  const bars={version:1,source:'beat-this',duration:20,beats,downbeats:beats.filter((_,i)=>i%4===0)};
  const auto=compileShow(windows,20,settings({arrangement:'auto'}),bars);
  assert.equal(auto.arrangement.times.length,0);
  assert.ok(auto.arrangement.times.every(time=>bars.downbeats.includes(time)));
  const manual=compileShow(windows,20,settings(),bars);
  assert.equal(showFrameAt(manual,2).dimming,showFrameAt(manual,2.5).dimming);
  assert.equal(manual.arrangement,null);
});
