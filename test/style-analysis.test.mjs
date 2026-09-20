import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {StyleAnalysis} from '../lib/style-analysis.mjs';
import {STYLE_FAMILIES} from '../public/music-style.js';
import {analyzeStyle} from '../public/style-analysis.js';
import {createApp} from '../server.mjs';
const pcm=()=>Buffer.alloc(128000);
const result={version:1,source:'discogs-effnet',duration:2,segments:[{start:0,end:2,scores:Object.fromEntries(STYLE_FAMILIES.map(name=>[name,.2])),tags:[]}]};
async function app(t,analysis,extra={}) {
 const {server}=await createApp({demo:true,styleAnalysis:analysis,...extra});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base=`http://127.0.0.1:${server.address().port}`;
 return {base,post:(body=pcm(),headers={},signal)=>fetch(base+'/api/analysis/style',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-WiZ-Local':'1',...headers},body,signal})};
}
test('style API validates PCM and caches successful model output',async t=>{
 let calls=0;const client=await app(t,new StyleAnalysis({ready:async()=>{},run:async()=>{calls++;return result;}}));
 assert.equal((await client.post()).status,200);assert.equal((await(await client.post()).json()).cached,true);assert.equal(calls,1);
 const bad=pcm();bad.writeFloatLE(NaN);assert.equal((await client.post(bad)).status,400);
 assert.equal((await client.post(Buffer.alloc(64000-1))).status,400);
 assert.equal((await client.post(pcm(),{'Content-Type':'application/json'})).status,415);
 assert.equal((await client.post(pcm(),{'X-WiZ-Local':''})).status,403);
});
test('style inference requires access token and rejects invalid timelines',async t=>{
 const client=await app(t,new StyleAnalysis({ready:async()=>{},run:async()=>({...result,duration:3})}),{token:'a'.repeat(24)});
 assert.equal((await client.post()).status,401);
 assert.equal((await client.post(pcm(),{Authorization:'Bearer '+'a'.repeat(24)})).status,502);
});
test('one style job at a time; cancellation releases the slot',async t=>{
 let enter;const entered=new Promise(resolve=>enter=resolve);
 const analysis=new StyleAnalysis({ready:async()=>{},run:async(_,{signal})=>{enter();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 const client=await app(t,analysis),controller=new AbortController();const rejected=assert.rejects(client.post(pcm(),{},controller.signal));
 await entered;assert.equal((await client.post()).status,409);controller.abort();await rejected;
 for(let i=0;i<100&&analysis.active;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(analysis.active,null);
});
test('missing style model falls back explicitly; cancellation is propagated',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async()=>new Response(JSON.stringify({available:false,message:'Modell fehlt.'}));
 assert.deepEqual(await analyzeStyle({}),{style:null,message:'Stilerkennung nicht verfügbar: Modell fehlt.'});
 const controller=new AbortController();controller.abort();await assert.rejects(analyzeStyle({},{signal:controller.signal}));
});
