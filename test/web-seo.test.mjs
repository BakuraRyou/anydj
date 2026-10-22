import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {siteURL,seoHTML,sitemap,robots,indexablePages,pageURL} from '../scripts/web-seo.mjs';

test('SEO URLs support HTTPS subdirectories and reject ambiguous public addresses',()=>{
  const base=siteURL('https://example.org/anydj');
  assert.equal(base.href,'https://example.org/anydj/');
  assert.equal(pageURL('index.html',base),base.href);
  assert.equal(pageURL('downloads.html',base),'https://example.org/anydj/downloads.html');
  for(const value of ['http://example.org','https://user:pass@example.org','https://example.org/?a=b','https://example.org/#x'])assert.throws(()=>siteURL(value));
  assert.match(robots(base),/Sitemap: https:\/\/example.org\/anydj\/sitemap.xml/);
  assert.doesNotMatch(robots(base),/Disallow/);
  const xml=sitemap(base);
  assert.equal((xml.match(/<loc>/g)||[]).length,indexablePages.length);
  assert.doesNotMatch(xml,/callback|lastmod|priority/);
});

test('page metadata and structured data use the configured public URL',async()=>{
  for(const name of ['index.html','downloads.html','impressum.html','datenschutz.html']){
    const source=await readFile(new URL('../web/'+name,import.meta.url),'utf8');
    const base=siteURL('https://example.org/preview/');
    const html=seoHTML(source,name,base);
    assert.ok(html.includes(`rel="canonical" href="${pageURL(name,base)}"`));
    const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    assert.equal(graph.find(item=>item['@type']==='WebPage').url,pageURL(name,base));
    assert.doesNotMatch(html,/https:\/\/anydj.de/);
  }
});

test('metadata must exist before structured data is emitted',()=>{
  assert.throws(()=>seoHTML('<head><title>AnyDj</title></head>','index.html',siteURL()),/Beschreibung fehlt/);
});
