import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {validateCatalog,validateShow,sampleShow,assetPath} from '../public/landing-show-data.js';
import {createHostedServer} from '../builder/hosting/server.mjs';
const catalog=JSON.parse(await readFile(new URL('../web/demo-shows/catalog.json',import.meta.url)));
const raw=JSON.parse(await readFile(new URL('../web/demo-shows/neon.json',import.meta.url)));
test('all shipped shows have eight devices, valid timelines and matching PCM duration',async()=>{
  for(const entry of validateCatalog(catalog).shows){
    const show=validateShow(JSON.parse(await readFile(new URL('../web/'+entry.show,import.meta.url))));
    const audio=await readFile(new URL('../web/'+show.audio,import.meta.url));
    assert.ok(Math.abs(audio.readUInt32LE(40)/audio.readUInt32LE(28)-show.duration)<.001);
    assert.equal(show.fixtures.filter(f=>f.type==='moving').length,4);
    for(const time of [-1,0,1,show.duration/2,show.duration,show.duration+1]){
      const lights=sampleShow(show,time);assert.equal(lights.length,8);
      assert.ok(lights.every(l=>/^#[0-9a-f]{6}$/.test(l.color)&&l.power>=0&&l.power<=1&&Number.isFinite(l.target.x)));
    }
  }
});
test('seeking samples the same absolute timeline and interpolates midpoint',()=>{
  const show=validateShow(raw),a=show.frames[100],b=show.frames[101],time=(a.time+b.time)/2;
  const expected=(a.lights[0][4]+b.lights[0][4])/2;
  assert.ok(Math.abs(sampleShow(show,time)[0].target.x-expected)<1e-9);
  const before=sampleShow(show,3);sampleShow(show,10);assert.deepEqual(sampleShow(show,3),before);
  assert.equal(sampleShow(show,-10)[0].power,show.frames[0].lights[0][3]);
  assert.equal(sampleShow(show,1000)[0].power,show.frames.at(-1).lights[0][3]);
});
test('invalid or oversized show content and unsafe file references are rejected',()=>{
  for(const path of ['https://example.com/a.wav','./demo-shows/../secret.wav','./demo-shows/%2e%2e/a.wav','//example.com/a','./demo-shows/a.wav?x=1'])assert.throws(()=>assetPath(path));
  for(const change of [v=>v.version=2,v=>delete v.fixtures[0].id,v=>v.duration=Infinity,v=>v.frames[1].time=0,v=>v.frames[0].lights[0][3]=2,v=>v.fixtures[1].id=v.fixtures[0].id,v=>v.fixtures.pop(),v=>v.frames.at(-1).time--,v=>v.audio='./demo-shows/a.html']){
    const value=structuredClone(raw);change(value);assert.throws(()=>validateShow(value));
  }
  assert.throws(()=>validateCatalog({...catalog,shows:catalog.shows.slice(1)}));
});
test('hosted demo audio supports MIME, HEAD and byte ranges under the existing CSP',async t=>{
  const root=await mkdtemp(join(tmpdir(),'anydj-landing-test-'));await mkdir(join(root,'public'));
  await writeFile(join(root,'public','demo.wav'),Buffer.from('0123456789'));
  const server=await createHostedServer({root,watchRestart:false});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});await rm(root,{recursive:true,force:true});});
  const url=`http://127.0.0.1:${server.address().port}/demo.wav`;
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('Content-Type'),'audio/wav');
  const range=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'2345');assert.equal(range.headers.get('Content-Range'),'bytes 2-5/10');
});

test('catalog IDs are explicit strings, never coerced missing values',()=>{
  const value=structuredClone(catalog);delete value.shows[0].id;assert.throws(()=>validateCatalog(value));
});
