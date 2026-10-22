import {siteURL,seoHTML,sitemap,robots} from './web-seo.mjs';
import {validateLandingShows} from './validate-landing-shows.mjs';
import {buildDownloads} from './desktop-downloads.mjs';
import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'dist','web');
const seoBase=siteURL(process.env.ANYDJ_SITE_URL);
const analytics=JSON.parse(await readFile(join(root,'web','analytics-config.json'),'utf8'));
const measurementId=process.env.ANYDJ_GA_MEASUREMENT_ID??analytics.measurementId;
if(typeof measurementId!=='string'||(measurementId!==''&&!/^G-[A-Z0-9]{6,}$/.test(measurementId)))throw Error('Ungültige Analytics-Mess-ID: G-… oder eine leere Zeichenfolge verwenden.');
const consent=await readFile(join(root,'web','consent.html'),'utf8');
function privacyLayout(html){
 return html.replace('</head>','<link rel="stylesheet" href="./privacy.css"><script type="module" src="./privacy.js"></script></head>')
  .replace('</body>',consent+'\n</body>');
}
await validateLandingShows(join(root,'web'));
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await writeFile(join(output,'analytics-config.js'),`export const measurementId=${JSON.stringify(measurementId)};\n`);
// Only public code/styles. Never include models, private music, device configuration or server files.
for(const file of await readdir(join(root,'public'))){
  if(/\.(js|css)$/.test(file)||file==='lame-license.txt'||file==='tutorial.json'||file==='animatus-small.svg')await cp(join(root,'public',file),join(output,file));
}
await cp(join(root,'web','demo-shows'),join(output,'demo-shows'),{recursive:true});
let dj=await readFile(join(root,'public','dj.html'),'utf8');
dj=dj.replace('<html lang="de">','<html lang="de" data-edition="web">')
 .replace('<title>AnyDj · DJ</title>','<title>DJ-Software im Browser ausprobieren | AnyDj Web-Demo</title><meta name="description" content="Mixe deine Musik auf zwei Decks und teste deine Lichtshow in der 3D-Vorschau. Öffne die AnyDj Web-Demo direkt im Browser, ohne Installation.">')
 .replaceAll('href="/','href="./').replaceAll('src="/','src="./')
 .replace(/<nav>.*?<\/nav>/,'<nav><a href="./">Über AnyDj</a><a href="./downloads.html">Desktop-App</a><button id="demoTracks" class="button secondary" type="button">Demo-Tracks laden</button></nav>')
 .replace('</header>', '</header><aside class="web-analysis-notice" aria-labelledby="webAnalysisTitle"><div><h1 id="webAnalysisTitle">Dein DJ-Pult im Browser · AnyDj Web-Demo</h1><p>Für deine Lichtshow: Akzente auf Kick und Taktanfang, ruhigere Breaks und Lichtwechsel passend zu den Songabschnitten. Die Desktop-App liefert dafür die vollständige Musikanalyse und steuert unterstützte DMX-Lichter.</p></div><a class="button primary" href="./downloads.html" target="_blank" rel="noopener">Desktop-App herunterladen <span class="web-analysis-new-tab">(neuer Tab)</span></a></aside>')
 .replace('<details class="dj-settings">','<details class="dj-settings" hidden>')
 .replace('Auto Beat</label>','Auto Beat (Desktop)</label>')
 .replace('</main>', '</main><footer class="web-legal-footer"><nav aria-label="Rechtliche Informationen"><a href="./impressum.html" target="_blank" rel="noopener">Impressum (neuer Tab)</a><a href="./datenschutz.html" target="_blank" rel="noopener">Datenschutz (neuer Tab)</a><button type="button" class="privacy-settings" data-privacy-settings hidden>Cookie-Einstellungen</button></nav></footer>');
await writeFile(join(output,'dj.html'),seoHTML(privacyLayout(dj),'dj.html',seoBase));
for(const name of ['spotify-callback.html','tidal-callback.html']){
 const callback=await readFile(join(root,'public',name),'utf8');
 await writeFile(join(output,name),callback.replace('</head>','<meta name="robots" content="noindex, follow"></head>'));
}
const header=await readFile(join(root,'web','header.html'),'utf8'),footer=await readFile(join(root,'web','footer.html'),'utf8');
function siteLayout(html,name){
 const active=markup=>markup.replace(/<nav[\s\S]*?<\/nav>/g,nav=>nav.replace(`href="./${name}"`, `href="./${name}" aria-current="page"`));
 html=html.replaceAll('href="./index.html','href="./');
 const normalize=markup=>markup.replaceAll('href="./index.html','href="./');
 return seoHTML(privacyLayout(html.replace('<!-- SITE_HEADER -->',normalize(active(header.trim()))).replace('<!-- SITE_FOOTER -->',normalize(active(footer.trim())))),name,seoBase);
}
for(const name of ['index.html','impressum.html','datenschutz.html'])await writeFile(join(output,name),siteLayout(await readFile(join(root,'web',name),'utf8'),name));
for(const name of ['web.css','privacy.css','privacy.js','product-preview.webp','landing-show.js','landing-show.css','landing-show-poster.webp'])await cp(join(root,'web',name),join(output,name));
console.log(measurementId?'Google Analytics vorbereitet: Laden nur nach Einwilligung.':'Google Analytics deaktiviert: keine Mess-ID konfiguriert.');
console.log('Web-Version erstellt: dist/web/ — Inhalt auf HTTPS-Webspace hochladen. Kein Node.js/Python-Server erforderlich.');

await writeFile(join(output,'downloads.html'),await buildDownloads(join(root,'.build','desktop-downloads'),output,siteLayout(await readFile(join(root,'web','downloads.html'),'utf8'),'downloads.html'),{includeInstallers:process.argv.includes('--with-downloads')}));

await writeFile(join(output,'sitemap.xml'),sitemap(seoBase));
await writeFile(join(output,'robots.txt'),robots(seoBase));
console.log(`SEO-Adressen: ${seoBase.href}`);
