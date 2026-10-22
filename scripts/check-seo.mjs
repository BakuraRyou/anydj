// Run after npm run build:web.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexablePages} from './web-seo.mjs';

const titles=new Set(),descriptions=new Set();
for(const name of indexablePages){
  const html=await readFile(new URL('../dist/web/'+name,import.meta.url),'utf8');
  const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title&&description,name);
  assert.ok(!titles.has(title)&&!descriptions.has(description),name);titles.add(title);descriptions.add(description);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1,name);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,name);
  assert.match(html,/<meta name="robots" content="index, follow, max-image-preview:large">/);
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)[1];
  assert.match(canonical,/^https:\/\//);
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.equal(graph.find(item=>item['@type']==='WebPage').url,canonical);
  const image=html.match(/property="og:image" content="([^"]+)"/)[1];
  assert.ok((await readFile(new URL('../dist/web/'+image.split('/').at(-1),import.meta.url))).length);
  if(name==='index.html'){
    assert.ok(graph.some(item=>item['@type']==='SoftwareApplication'));
    assert.match(html,/id="fragen"/);
  }
}
for(const name of ['spotify-callback.html','tidal-callback.html']){
  assert.match(await readFile(new URL('../dist/web/'+name,import.meta.url),'utf8'),/name="robots" content="noindex, follow"/);
}

console.log('SEO geprüft: Titel, Beschreibungen, Canonicals, Überschriften, strukturierte Daten, Vorschaubilder und Callback-noindex.');
