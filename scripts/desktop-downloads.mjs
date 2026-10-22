import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat,realpath,cp,mkdir} from 'node:fs/promises';
import {join,sep} from 'node:path';
export const platforms={linux:['AppImage','deb'],win32:['exe'],darwin:['dmg']};
export async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function readDownloads(root,{required=false}={}){
 const entries=[];
 for(const platform of Object.keys(platforms))for(const arch of (platform==='darwin'?['x64','arm64']:['x64'])){
  const dir=join(root,`${platform}-${arch}`);let manifest;
  try{manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(manifest.schema!==1||manifest.platform!==platform||manifest.arch!==arch||manifest.analysis!==true||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)||!Array.isArray(manifest.files)||manifest.files.length!==platforms[platform].length)throw Error('Ungültiges vollständiges Desktop-Release: '+dir);
  const base=await realpath(dir),formats=new Set();
  for(const item of manifest.files){
   if(!/^AnyDj-[a-zA-Z0-9._-]+\.(?:AppImage|deb|exe|dmg)$/.test(item.name)||!platforms[platform].includes(item.name.split('.').at(-1))||!Number.isSafeInteger(item.size)||item.size<=0||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Ungültiger Download-Eintrag: '+dir);
   const format=item.name.split('.').at(-1);if(formats.has(format))throw Error('Doppeltes Installerformat');formats.add(format);
   const file=await realpath(join(dir,item.name));
   if(!file.startsWith(base+sep)||(await stat(file)).size!==item.size||await sha256(file)!==item.sha256)throw Error('Desktop-Datei oder SHA-256 stimmt nicht: '+item.name);
   entries.push({...item,platform,arch,version:manifest.version,glibc:typeof manifest.glibc==='string'&&/^\d+\.\d+$/.test(manifest.glibc)?manifest.glibc:null,file});
  }
 }
 if(required&&!entries.length)throw Error('Keine vollständigen Desktop-Pakete vorhanden. Zuerst npm run release:desktop ausführen.');
 return entries;
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function buildDownloads(source,output,template,{includeInstallers=true}={}){
 const entries=includeInstallers?await readDownloads(source):[];if(entries.length)await mkdir(join(output,'downloads'),{recursive:true});
 for(const entry of entries)await cp(entry.file,join(output,'downloads',entry.name));
 const cards=Object.entries(platforms).map(([platform])=>{
  const files=entries.filter(e=>e.platform===platform),linux=platform==='linux',mac=platform==='darwin';
  return `<article class="download-card ${files.length?'is-available':'is-pending'}"><div class="download-card-header"><span class="os-icon" aria-hidden="true">${linux?'&gt;_':mac?'⌘':'⊞'}</span><span class="availability">${files.length?'Zum Download verfügbar':'Noch nicht verfügbar'}</span></div><h3>${linux?'Linux':mac?'macOS':'Windows'}</h3><p class="release-meta">${files.length?'Version '+escape(files[0].version)+' · ':''}${mac?(files.length?[...new Set(files.map(file=>file.arch==='arm64'?'Apple Silicon':'Intel'))].join(' / '):'Intel / Apple Silicon'):'x64'} · vollständige Desktop-App</p>${files.length?files.map(f=>`<div class="installer"><a class="button button-primary download-link" download href="./downloads/${encodeURIComponent(f.name)}">${f.name.endsWith('.deb')?'Debian / Ubuntu (.deb)':f.name.endsWith('.exe')?'Windows-Installer (.exe)':f.name.endsWith('.dmg')?'macOS ('+(f.arch==='arm64'?'Apple Silicon':'Intel')+')':'AppImage herunterladen'} <span>${(f.size/1024/1024).toFixed(0)} MiB ↓</span></a><details><summary>SHA-256-Prüfsumme anzeigen</summary><code>${f.sha256}</code></details></div>`).join('')+`<p class="requirements-note">${linux?`AppImage ausführbar machen und starten oder das .deb-Paket installieren.${files[0].glibc?' <strong>Benötigt glibc '+escape(files[0].glibc)+' oder neuer.</strong>':''}`:mac?'DMG öffnen und AnyDj in den Programme-Ordner ziehen.':'Installer öffnen und den Installationsschritten folgen.'} Lokale KI-Modelle sind enthalten.</p>`:'<p class="download-pending">Noch kein vollständiges Installationspaket veröffentlicht.</p><p class="pending-copy">Sobald ein Paket bereitsteht, findest du es hier. Bis dahin kannst du Mix und Lichtvorschau in der Web-Demo ausprobieren.</p><a class="text-link" href="./dj.html">Im Browser ausprobieren ↗</a>'}</article>`;
 }).join('\n');
 return template.replace('<!-- DOWNLOAD_CARDS -->',cards);
}
