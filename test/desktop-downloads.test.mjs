import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256,readDownloads,buildDownloads} from '../scripts/desktop-downloads.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'anydj-downloads-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=join(root,'source');await mkdir(join(source,'win32-x64'),{recursive:true});const name='AnyDj-0.1.0-win-x64.exe',file=join(source,'win32-x64',name);await writeFile(file,'test installer');const manifest={schema:1,platform:'win32',arch:'x64',analysis:true,version:'0.1.0',files:[{name,size:14,sha256:await sha256(file)}]};const manifestFile=join(source,'win32-x64','manifest.json');await writeFile(manifestFile,JSON.stringify(manifest));return {root,source,file,manifest,manifestFile};}
test('download page publishes verified full installers, hash and size, and no dead links for absent platforms',async t=>{const {root,source}=await fixture(t);const output=join(root,'public');const html=await buildDownloads(source,output,'<!-- DOWNLOAD_CARDS -->');assert.match(html,/Windows-Installer/);assert.match(html,/Noch kein vollständiges Installationspaket/);assert.match(html,/SHA-256/);assert.equal((html.match(/href="\.\/downloads\//g)||[]).length,1);assert.equal(await readFile(join(output,'downloads','AnyDj-0.1.0-win-x64.exe'),'utf8'),'test installer');});
test('corrupted installers and lite manifests fail closed',async t=>{const {source,file,manifest,manifestFile}=await fixture(t);await writeFile(file,'evil installer');await assert.rejects(readDownloads(source),/SHA-256/);manifest.analysis=false;await writeFile(manifestFile,JSON.stringify(manifest));await assert.rejects(readDownloads(source),/Ungültiges/);});
test('unsafe filenames and incomplete formats are rejected',async t=>{const {source,manifest,manifestFile}=await fixture(t);manifest.files[0].name='../secret.exe';await writeFile(manifestFile,JSON.stringify(manifest));await assert.rejects(readDownloads(source),/Ungültiger/);manifest.files=[];await writeFile(manifestFile,JSON.stringify(manifest));await assert.rejects(readDownloads(source),/Ungültiges/);});
test('empty web build remains usable; full deploy requires actual installers',async t=>{const root=await mkdtemp(join(tmpdir(),'anydj-no-downloads-'));t.after(()=>rm(root,{recursive:true,force:true}));assert.deepEqual(await readDownloads(root),[]);await assert.rejects(readDownloads(root,{required:true}),/Keine vollständigen/);});

test('website-only build ignores even broken local installers and creates no download links',async t=>{
 const {root,source,file}=await fixture(t);await writeFile(file,'broken');
 const output=join(root,'public');
 const html=await buildDownloads(source,output,'<!-- DOWNLOAD_CARDS -->',{includeInstallers:false});
 assert.doesNotMatch(html,/href="\.\/downloads\//);
 assert.match(html,/Noch kein vollständiges Installationspaket/);
 await assert.rejects(readFile(join(output,'downloads','AnyDj-0.1.0-win-x64.exe')),{code:'ENOENT'});
});

test('Mac downloads validate both architectures and label DMG links accurately',async t=>{
 const root=await mkdtemp(join(tmpdir(),'anydj-mac-downloads-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const arch of ['x64','arm64']){
  const dir=join(root,'darwin-'+arch);await mkdir(dir);
  const name=`AnyDj-0.1.0-mac-${arch}.dmg`,file=join(dir,name);await writeFile(file,'test dmg');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({schema:1,platform:'darwin',arch,analysis:true,version:'0.1.0',files:[{name,size:8,sha256:await sha256(file)}]}));
 }
 const entries=await readDownloads(root);assert.deepEqual(entries.map(e=>e.arch),['x64','arm64']);
 const html=await buildDownloads(root,join(root,'output'),'<!-- DOWNLOAD_CARDS -->');
 assert.match(html,/macOS \(Apple Silicon\)/);assert.match(html,/macOS \(Intel\)/);
 assert.equal((html.match(/href="\.\/downloads\//g)||[]).length,2);
 const manifestPath=join(root,'darwin-arm64','manifest.json');const manifest=JSON.parse(await readFile(manifestPath));manifest.arch='x64';await writeFile(manifestPath,JSON.stringify(manifest));
 await assert.rejects(readDownloads(root),/Ungültiges/);
});
