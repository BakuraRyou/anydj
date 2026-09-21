import test from 'node:test';
import assert from 'node:assert/strict';
import {health,pruneAfterHealthcheck} from '../scripts/deploy.mjs';

test('healthcheck reports hosting routing errors, redirects and startup failures',async()=>{
  for(const [status,message] of [[404,/Node.js-Aktivierung/],[302,/Weiterleitung/],[503,/Startfehler/]]){
    await assert.rejects(health('https://example.test/healthz',async()=>new Response('host page',{status})),message);
  }
  await assert.rejects(health('https://example.test/healthz',async()=>new Response('<html>default page</html>')),/kein JSON/);
  await assert.rejects(health('https://example.test/healthz',async()=>new Response('null')),/gültige AnyDj/);
});
test('healthcheck validates application identity and preserves release and instance',async()=>{
  const expected={app:'anydj',status:'ok',release:'release',instance:'new-process'};
  assert.deepEqual(await health('https://example.test/healthz',async(url,options)=>{
    assert.equal(options.redirect,'manual');return new Response(JSON.stringify(expected));
  }),expected);
  await assert.rejects(health('https://example.test/healthz',async()=>new Response(JSON.stringify({...expected,app:'other'}))),/gültige AnyDj/);
});
test('healthcheck explains connection errors without exposing response or error contents',async()=>{
  await assert.rejects(health('https://example.test/healthz',async()=>{throw new TypeError('private connection detail');}),/DNS, HTTPS-Zertifikat/);
  await assert.rejects(health('https://example.test/healthz',async()=>{throw new DOMException('timeout','TimeoutError');}),/Zeitüberschreitung/);
});
test('cleanup runs only for the confirmed deployed release, never on HTTP failure or mismatch',async()=>{
  let calls=0;
  const options={action:'deploy',release:'new',url:'https://example.test/healthz',cleanup:async release=>{calls++;assert.equal(release,'new');return 'done';}};
  await assert.rejects(pruneAfterHealthcheck({...options,readHealth:async()=>{throw Error('HTTP 404');}}),/404/);
  await assert.rejects(pruneAfterHealthcheck({...options,readHealth:async()=>({release:'old'})}),/nicht mehr/);
  assert.equal(calls,0);
  assert.equal(await pruneAfterHealthcheck({...options,readHealth:async()=>({release:'new'})}),'done');
  assert.equal(calls,1);
  assert.equal(await pruneAfterHealthcheck({...options,action:'restart'}),null);
  assert.equal(calls,1);
});
