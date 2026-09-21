import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setupHTTP} from '../lib/setup-http.mjs';

async function fixture(t,handler) {
  const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  return `http://127.0.0.1:${server.address().port}`;
}
test('Setup-POST sendet explizite Länge, kanonische Header und keine Keepalive-Verbindung',async t=>{
  let calls=0;
  const body=JSON.stringify({ssid:'Küche'});
  const base=await fixture(t,(req,res)=>{
    calls++;
    assert.ok(req.rawHeaders.includes('Content-Length'));
    assert.ok(req.rawHeaders.includes('Content-Type'));
    assert.equal(req.headers['content-length'],String(Buffer.byteLength(body)));
    assert.equal(req.headers.connection,'close');assert.equal(req.headers['transfer-encoding'],undefined);
    let received='';req.on('data',chunk=>{received+=chunk;});
    req.on('end',()=>{assert.equal(received,body);res.writeHead(200,{'Content-Type':'application/json'});res.write('{"status":');res.end('5}');});
  });
  const result=await setupHTTP(base+'/pairing',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(1000)});
  assert.equal(result.ok,true);assert.deepEqual(await result.json(),{status:5});assert.equal(calls,1);
});
test('Setup-HTTP begrenzt auch das Warten auf den Antwortkörper ohne POST-Wiederholung',async t=>{
  let calls=0;
  const base=await fixture(t,(_req,res)=>{calls++;res.writeHead(200);res.write('unvollständig');});
  await assert.rejects(setupHTTP(base+'/pairing',{method:'POST',body:'{}',signal:AbortSignal.timeout(80)}));
  assert.equal(calls,1);
});
test('Setup-HTTP folgt keiner Weiterleitung und liest leere Abschlussantworten',async t=>{
  let calls=0;
  const base=await fixture(t,(req,res)=>{calls++;if(req.url==='/redirect'){res.writeHead(302,{Location:'/complete'});res.end();}else{res.writeHead(204);res.end();}});
  const redirect=await setupHTTP(base+'/redirect');assert.equal(redirect.ok,false);assert.equal(calls,1);
  const complete=await setupHTTP(base+'/complete',{method:'POST',body:'{}'});
  assert.equal(complete.ok,true);assert.equal((await complete.arrayBuffer()).byteLength,0);
});
