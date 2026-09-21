import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.includes('--help')) {
  console.log(`AnyDj Desktop-Paket erstellen\n\nnpm run pack                  Installer für dieses Betriebssystem\nnpm run pack -- --linux        Linux: AppImage und .deb (x64)\nnpm run pack -- --win          Windows: Setup.exe (x64)\nnpm run pack -- --all --lite   Beide Basisversionen (ggf. Wine nötig)\nnpm run pack -- --dir          Nur ausführbaren App-Ordner erstellen\n\nAusgabe: dist/\nEnthält Oberfläche, Node.js, Chromium, lokale Lichtsteuerung und Standardanalyse.\nStandard: vollständiges KI-Paket. Vorher npm run pack:analysis ausführen.\n--lite erstellt ausdrücklich nur die Basisversion.\nBuild-Werkzeuge werden nur auf dem Entwicklerrechner benötigt.`);
} else {
  const allowed=new Set(['--linux','--win','--all','--dir','--lite']);
  for(const arg of args)if(!allowed.has(arg))throw Error(`Unbekannte Option: ${arg}. Siehe npm run pack -- --help`);
  const targets=args.filter(arg=>!['--dir','--lite'].includes(arg));
  if(targets.length>1)throw Error('Bitte genau ein Ziel auswählen: --linux, --win oder --all.');
  const target=targets[0]||(process.platform==='win32'?'--win':process.platform==='linux'?'--linux':null);
  if(!target)throw Error('Bitte --linux oder --win angeben.');
  const flags=target==='--all'?['--linux','--win']:[target];
  if(args.includes('--dir'))flags.push('--dir');
  let cli;
  try{cli=require.resolve('electron-builder/cli.js');}
  catch{throw Error('Build-Abhängigkeiten fehlen. Zuerst npm ci ausführen.');}
  const full=!args.includes('--lite');
  const platform=target==='--win'?'win32':target==='--linux'?'linux':null;
  if(full&&!platform)throw Error('Vollständige KI-Pakete getrennt pro Betriebssystem bauen, nicht mit --all.');
  const bundle=join(root,'.build','analysis',`${platform}-x64`);
  if(full){
    let manifest;try{manifest=JSON.parse(await readFile(join(bundle,'manifest.json'),'utf8'));}catch{throw Error('KI-Paket fehlt. Zuerst npm run pack:analysis auf dem Zielbetriebssystem ausführen. Nur für eine bewusste Basisversion: --lite.');}
    if(manifest.version!==1||manifest.platform!==platform||manifest.arch!=='x64')throw Error('Unpassendes KI-Paket. Bitte neu bauen.');
  }
  await mkdir(join(root,'.build'),{recursive:true});
  await writeFile(join(root,'.build','build-flavor.json'),JSON.stringify({analysis:full}));
  console.log(full?'Desktop-Paket inklusive lokaler KI-Laufzeiten und Modelle.':'Bewusste Basisversion ohne KI (--lite).');
  const child=spawn(process.execPath,[cli,...flags,'--x64','--config','desktop/build-config.cjs','--publish','never'],{cwd:root,stdio:'inherit',env:{...process.env,ANYDJ_ANALYSIS_BUNDLE:full?bundle:''}});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
}
