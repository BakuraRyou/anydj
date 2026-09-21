import test from 'node:test';
import assert from 'node:assert/strict';
import {DmxConnection,OlaTransport,dmxFrame} from '../lib/dmx.mjs';
function fixture(){
 let online=true,now=0;const sent=[];
 const port={id:'ola:1-O-0',port:'1-O-0',name:'USB Pro',description:'USB',kind:'usb',universe:100,ready:true};
 const transport={async scan(){return {ports:online?[{...port}]:[],universes:[]};},async prepare(){return 100;},async send(u,f){sent.push([...f]);}};
 const dmx=new DmxConnection({transport,clock:()=>now});
 return {dmx,sent,port,transport,unplug(){online=false;},plug(){online=true;},expire(){now=2000;}};
}
test('DMX validates complete frames',()=>{for(const f of [[],Array(512).fill(-1),Array(512).fill(256),Array(512).fill(1.5)])assert.throws(()=>dmxFrame(f));assert.equal(dmxFrame(Array(512).fill(255))[511],255);});
test('plug, explicit start, frames, blackout and reconnect without restart',async()=>{
 const f=fixture();await f.dmx.scan();assert.equal(f.dmx.status().outputs[0].online,true);assert.equal(f.sent.length,0);
 const s=await f.dmx.enable(f.port.id);f.dmx.frame(s.id,Array(512).fill(127));await f.dmx.tick();assert.equal(f.sent.at(-1)[0],127);
 f.unplug();await f.dmx.scan();await f.dmx.session?.stopPromise;assert.equal(f.dmx.status().active,false);assert.ok(f.sent.at(-1).every(x=>x===0));
 f.plug();await f.dmx.scan();assert.equal(f.dmx.status().outputs[0].online,true);assert.equal(f.dmx.status().active,false);await f.dmx.close();
});
test('stale frames trigger blackout; other sessions cannot write or stop',async()=>{
 const f=fixture(),s=await f.dmx.enable(f.port.id);assert.throws(()=>f.dmx.frame('other',Array(512).fill(4)));assert.throws(()=>f.dmx.stop('other'));
 f.dmx.frame(s.id,Array(512).fill(200));await f.dmx.tick();f.expire();await f.dmx.tick();await f.dmx.session?.stopPromise;assert.equal(f.dmx.status().active,false);assert.ok(f.sent.at(-1).every(x=>x===0));
});
test('demo never probes or sends, unavailable and shared ports cannot start',async()=>{
 const d=new DmxConnection({demo:true,transport:{scan(){assert.fail();}}});await d.scan();await assert.rejects(d.enable('x'));await d.close();
 const f=fixture();f.port.ready=false;await assert.rejects(f.dmx.enable(f.port.id));f.unplug();await assert.rejects(f.dmx.enable(f.port.id));assert.equal(f.sent.length,0);
});
test('concurrent starts are serialized and shutdown ends output',async()=>{
 const f=fixture();const starts=await Promise.allSettled([f.dmx.enable(f.port.id),f.dmx.enable(f.port.id)]);assert.equal(starts.filter(s=>s.status==='fulfilled').length,1);await f.dmx.close();assert.equal(f.dmx.status().active,false);
});
test('OLA adapter uses port discovery, exclusive patch and full frame form protocol',async()=>{
 const p={id:'2-O-0',device:'ArtNet',description:'LAN',is_output:true};let patched=false;const writes=[];
 const ola=new OlaTransport({fetcher:async(url,options)=>{
  const path=new URL(url).pathname;let result;
  if(path==='/json/get_ports')result=patched?[]:[p];
  else if(path==='/json/universe_plugin_list')result={universes:patched?[{id:100}]:[]};
  else if(path==='/json/universe_info')result={id:100,input_ports:[],output_ports:[p]};
  else if(path==='/new_universe'){assert.equal(options.body.get('add_ports'),p.id);patched=true;result={ok:true};}
  else if(path==='/set_dmx'){assert.equal(options.body.get('u'),'100');writes.push(options.body.get('d').split(',').map(Number));return new Response('ok');}
  else assert.fail(path);
  return Response.json(result);
 }});
 const snap=await ola.scan();assert.equal(snap.ports[0].kind,'lan');const universe=await ola.prepare(snap.ports[0],snap);await ola.send(universe,Array(512).fill(66));assert.equal(writes[0].length,512);assert.equal(writes[0][511],66);
 assert.equal((await ola.scan()).ports[0].universe,100);
});
test('failed transfer ends session and reports failed blackout',async()=>{
 const f=fixture();await f.dmx.enable(f.port.id);f.transport.send=async()=>{throw Error('unplugged');};await f.dmx.tick();await f.dmx.session?.stopPromise;assert.equal(f.dmx.status().active,false);assert.match(f.dmx.status().outputError,/Abschaltbild/);
});

test('HTTP API protects output with authentication, write header and session ownership',async()=>{
 const {createApp}=await import('../server.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const dir=await mkdtemp(tmpdir()+'/anydj-dmx-api-');
 const f=fixture(),token='dmx-test-token-with-enough-length';
 const app=await createApp({demo:true,dmx:f.dmx,dataDir:dir,token,hosts:new Set(['127.0.0.1','localhost'])});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const req=(path,body,headers={Authorization:'Bearer '+token,'X-AnyDj-Local':'1'})=>fetch(base+'/api/dmx/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 try {
  assert.equal((await req('status',null,{})).status,401);
  assert.equal((await req('start',{target:f.port.id},{Authorization:'Bearer '+token})).status,403);
  const start=await req('start',{target:f.port.id});assert.equal(start.status,200);const {id}=await start.json();
  assert.equal((await req('frame',{id:'wrong',channels:Array(512).fill(80)})).status,409);
  assert.equal((await req('frame',{id,channels:Array(512).fill(80)})).status,202);await f.dmx.tick();assert.equal(f.sent.at(-1)[0],80);
  assert.equal((await req('stop',{id})).status,200);assert.ok(f.sent.at(-1).every(v=>v===0));
 } finally {await f.dmx.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
});
