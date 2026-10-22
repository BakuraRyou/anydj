import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function httpApp(t, options = {}) {
  const app = await createApp({ demo: true, ...options });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise(resolve => { app.server.closeAllConnections(); app.server.close(resolve); }));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, method = 'GET', data, extraHeaders = {}) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-AnyDj-Local': '1', ...extraHeaders },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return { ...app, base, call };
}

test('removed lamp routes and scripts stay unavailable; root opens the DJ console',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'anydj-without-lamps-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const saved='old device data, deliberately invalid JSON';
  await writeFile(join(directory,'devices.json'),saved);
  const {base,call}=await httpApp(t,{dataDir:directory});
  for(const route of ['/api/devices','/api/discover','/api/connection','/api/devices/192.168.1.2/pilot','/api/music/start','/api/music/frame','/api/music/status','/api/music/settings','/api/music/stop']){
    for(const method of ['GET','POST'])assert.equal((await call(route,method,method==='POST'?{}:undefined)).status,404,route);
  }
  for(const route of ['/music','/editor','/app.js','/music.js','/editor.js','/setup'])assert.equal((await fetch(base+route)).status,404,route);
  const html=await (await fetch(base+'/')).text();
  assert.match(html,/src="\/dj.js"/);assert.doesNotMatch(html,/djLamp|djConnection|Lampen suchen/);
  assert.equal(await readFile(join(directory,'devices.json'),'utf8'),saved);
});

test('local host, origin, token and write-header checks still protect DMX',async t=>{
  const token='test-web-token-1234567890';
  const {base,call}=await httpApp(t,{token});
  assert.equal((await call('/api/meta')).body.tokenRequired,true);
  assert.equal((await call('/api/dmx/status')).status,401);
  const authorization={Authorization:`Bearer ${token}`};
  assert.equal((await call('/api/dmx/status','GET',undefined,authorization)).status,200);
  assert.equal((await call('/api/dmx/stop','POST',{},authorization)).status,200);
  for(const extraHeaders of [{'X-AnyDj-Local':''},{Origin:'https://evil.example'},{'Sec-Fetch-Site':'cross-site'}]){
    assert.equal((await call('/api/dmx/stop','POST',{}, {...authorization,...extraHeaders})).status,403);
  }
  const oldHeader=await fetch(base+'/api/dmx/stop',{method:'POST',headers:{...authorization,'Content-Type':'application/json','X-Legacy-Local':'1'},body:'{}'});
  assert.equal(oldHeader.status,403);
  const badHost=await new Promise((resolve,reject)=>{
    http.get(base+'/api/meta',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);
  });
  assert.equal(badHost,403);
});

test('DJ-Seite liefert Styles und den statischen lokalen Modulbaum aus', async t => {
  const {base}=await httpApp(t);
  const page=await fetch(`${base}/dj`);
  assert.equal(page.status,200);
  const html=await page.text();
  const pending=[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(match=>new URL(match[1],base).href);
  const visited=new Set();
  while(pending.length){
    const url=pending.pop();if(visited.has(url))continue;visited.add(url);
    const response=await fetch(url);
    assert.equal(response.status,200,`${url} muss erreichbar sein`);
    assert.match(response.headers.get('content-type')||'',url.endsWith('.css')?/text\/css/:/(?:text|application)\/javascript/,url);
    const source=await response.text();
    if(url.endsWith('.js')){
      for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+\.js)["']/g))pending.push(new URL(match[1],url).href);
    }
    if(url.endsWith('.css')){
      for(const match of source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g))pending.push(new URL(match[1],url).href);
    }
  }
  assert.ok(visited.has(`${base}/dj-full.js`));
  assert.ok(visited.has(`${base}/dj-full.css`));
  assert.ok(visited.has(`${base}/dj-theme.css`));
  assert.ok(visited.has(`${base}/design-tokens.css`));
  assert.ok(visited.has(`${base}/dmx-participation.js`));
  assert.ok(visited.has(`${base}/dmx-focus.js`));
});
