import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,cp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createHostedServer} from '../builder/hosting/server.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'anydj-hosting-test-'));
  await mkdir(join(root,'public'));await mkdir(join(root,'tmp'));
  await writeFile(join(root,'public','index.html'),'<h1>AnyDj</h1>');await writeFile(join(root,'public','dj.html'),'DJ');
  await writeFile(join(root,'public','spotify-callback.html'),'callback');
  await writeFile(join(root,'public','product-preview.webp'),'preview-fixture');
  await writeFile(join(root,'secret.txt'),'DO NOT SERVE');
  t.after(()=>rm(root,{recursive:true,force:true}));return root;
}
test('hosted server serves web edition and health, never local APIs or private files',async t=>{
  const root=await fixture(t);await symlink(join(root,'secret.txt'),join(root,'public','leak.html'));
  await writeFile(join(root,'public','.env'),'secret');
  const server=await createHostedServer({root,release:'test',watchRestart:false});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/AnyDj/);
  const csp=home.headers.get('Content-Security-Policy');
  assert.match(csp,/https:\/\/api.spotify.com/);
  assert.match(csp,/script-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp,/connect-src[^;]*https:\/\/\*\.google-analytics\.com/);
  assert.doesNotMatch(csp,/unsafe-eval/);
  assert.equal(await (await fetch(base+'/dj')).text(),'DJ');
  assert.equal((await fetch(base+'/spotify-callback.html?code=example')).status,200);
  const preview=await fetch(base+'/product-preview.webp');assert.equal(preview.status,200);assert.equal(preview.headers.get('Content-Type'),'image/webp');assert.equal(await preview.text(),'preview-fixture');
  const health=await (await fetch(base+'/healthz')).json();assert.equal(health.app,'anydj');assert.equal(health.release,'test');assert.ok(health.instance);
  assert.equal((await fetch(base+'/healthz',{method:'HEAD'})).status,200);
  assert.equal(await (await fetch(base+'/',{method:'HEAD'})).text(),'');
  for(const path of ['/api/devices','/current.json','/.env','/leak.html','/%2e%2e/secret.txt','/%2eenv','/foo%00.html','/foo%5cbar.html'])assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(base+'/healthz',{method:'POST'})).status,405);
});
test('global crash restart exits nonzero once; new instance accepts marker baseline',async t=>{
  const root=await fixture(t),module=new URL('../builder/hosting/server.mjs',import.meta.url).href;
  const launch=()=>{
    const code=`import {createHostedServer} from ${JSON.stringify(module)};const s=await createHostedServer({root:process.argv[1],release:'test'});s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`;
    const child=spawn(process.execPath,['--input-type=module','-e',code,root],{stdio:['ignore','pipe','pipe']});let errors='';
    child.stderr.on('data',chunk=>{errors+=chunk;});
    t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
    const port=new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',chunk=>resolve(Number(String(chunk).trim())));});
    return {child,port,error:()=>errors};
  };
  const first=launch(),firstPort=await first.port;
  const firstID=(await (await fetch(`http://127.0.0.1:${firstPort}/healthz`)).json()).instance;
  const exit=once(first.child,'exit',{signal:AbortSignal.timeout(10000)});
  await writeFile(join(root,'tmp','anydj-crash-restart'),'restart-one');
  const [code]=await exit;assert.equal(code,1);assert.match(first.error(),/ANYDJ_REQUESTED_RESTART/);
  const next=launch(),port=await next.port;
  await new Promise(resolve=>setTimeout(resolve,1300));
  const health=await (await fetch(`http://127.0.0.1:${port}/healthz`)).json();assert.notEqual(health.instance,firstID);assert.equal(next.child.exitCode,null);
  const stopped=once(next.child,'exit');next.child.kill('SIGTERM');await stopped;
});
test('Plesk CommonJS bootstrap loads selected ESM release and rejects traversal',async t=>{
  const root=await fixture(t),release='20260101000000-aaaaaaaaaaaa';
  await mkdir(join(root,'releases',release),{recursive:true});
  await cp(join(root,'public'),join(root,'releases',release,'public'),{recursive:true});
  await cp(new URL('../builder/hosting/server.mjs',import.meta.url),join(root,'releases',release,'server.mjs'));
  await cp(new URL('../builder/hosting/index.js',import.meta.url),join(root,'index.js'));
  await writeFile(join(root,'package.json'),JSON.stringify({type:'commonjs'}));
  await writeFile(join(root,'current.json'),JSON.stringify({release}));
  const child=spawn(process.execPath,[join(root,'index.js')],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
  const [chunk]=await once(child.stdout,'data',{signal:AbortSignal.timeout(10000)});assert.match(String(chunk),/AnyDj hosting started/);
  const exit=once(child,'exit');child.kill('SIGTERM');assert.equal((await exit)[0],0);
  await writeFile(join(root,'current.json'),JSON.stringify({release:'../../outside'}));
  const invalid=spawn(process.execPath,[join(root,'index.js')],{stdio:['ignore','ignore','pipe']});let error='';invalid.stderr.on('data',data=>{error+=data;});
  assert.equal((await once(invalid,'exit',{signal:AbortSignal.timeout(10000)}))[0],1);assert.match(error,/Invalid AnyDj release manifest/);
});

test('installer downloads support HEAD, streaming ranges and invalid-range rejection',async t=>{
 const root=await fixture(t);await mkdir(join(root,'public','downloads'));await writeFile(join(root,'public','downloads','AnyDj.exe'),'0123456789');await writeFile(join(root,'public','downloads.html'),'Downloads');
 const server=await createHostedServer({root,watchRestart:false});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base=`http://127.0.0.1:${server.address().port}`,url=base+'/downloads/AnyDj.exe';
 assert.equal(await (await fetch(base+'/downloads')).text(),'Downloads');
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('Content-Length'),'10');assert.equal(head.headers.get('Content-Disposition'),'attachment');assert.equal(await head.text(),'');
 const part=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(part.status,206);assert.equal(part.headers.get('Content-Range'),'bytes 2-5/10');assert.equal(await part.text(),'2345');
 assert.equal(await (await fetch(url,{headers:{Range:'bytes=-3'}})).text(),'789');
 for(const range of ['bytes=50-','bytes=5-2','bytes=-0','bytes=0-1,5-6'])assert.equal((await fetch(url,{headers:{Range:range}})).status,416);
 assert.equal(await (await fetch(url)).text(),'0123456789');
});
