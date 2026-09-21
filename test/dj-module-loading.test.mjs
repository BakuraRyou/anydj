import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server.mjs';

test('development server serves the entire static DJ module dependency graph',async t=>{
 const dataDir=await mkdtemp(join(tmpdir(),'anydj-module-test-'));
 const {server}=await createApp({demo:true,dataDir});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dataDir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,pending=['/dj.js'],visited=new Set();
 while(pending.length){
  const path=pending.pop();if(visited.has(path))continue;visited.add(path);
  const response=await fetch(base+path);
  assert.equal(response.status,200,`${path} must be served`);
  assert.match(response.headers.get('content-type'),/javascript/,path);
  const source=await response.text();
  for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"](\.[^'"]+)['"]/g))pending.push(new URL(match[1],base+path).pathname);
 }
 assert.ok(visited.has('/dj-shuffle.js'));
 assert.ok(visited.size>20);
});
