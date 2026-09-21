import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'dist','web');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
// Only public code/styles. Never include models, music, device configuration or server files.
for(const file of await readdir(join(root,'public'))){
  if(/\.(js|css)$/.test(file)||file==='tutorial.json')await cp(join(root,'public',file),join(output,file));
}
let dj=await readFile(join(root,'public','dj.html'),'utf8');
dj=dj.replace('<html lang="de">','<html lang="de" data-edition="web">')
 .replace('<title>AnyDj · DJ</title>','<title>AnyDj · Web-Demo</title>')
 .replaceAll('href="/','href="./').replaceAll('src="/','src="./')
 .replace('class="brand" href="./"','class="brand" href="./index.html"')
 .replace(/<nav>.*?<\/nav>/,'<nav><a href="./index.html">Über die Demo</a><button id="demoTracks" class="button secondary" type="button">Demo-Tracks laden</button></nav>')
 .replace('<label for="djLamp">Licht</label>','<label for="djLamp" hidden>Licht</label>')
 .replace('<select id="djLamp">','<select id="djLamp" hidden>')
 .replace('<details class="dj-settings">','<details class="dj-settings" hidden>')
 .replace('Lampenverbindung wird geprüft …','Web-Demo · Analyse direkt auf deinem Gerät.')
 .replace('Auto Beat</label>','Auto Beat (Desktop)</label>');
await writeFile(join(output,'dj.html'),dj);
await cp(join(root,'public','spotify-callback.html'),join(output,'spotify-callback.html'));
for(const name of ['index.html','web.css'])await cp(join(root,'web',name),join(output,name));
console.log('Web-Version erstellt: dist/web/ — Inhalt auf HTTPS-Webspace hochladen. Kein Node.js/Python-Server erforderlich.');
