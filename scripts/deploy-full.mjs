import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {releaseDesktop} from './release-desktop.mjs';
import {readDownloads} from './desktop-downloads.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
try{
 if(args.includes('--help'))console.log('npm run deploy:full [-- --dry-run] [--reuse-analysis] [--skip-desktop-build] [--config PATH]\nBaut native Desktop-App inklusive KI, Downloadseite und Website; veröffentlicht über bestehendes FTPS-Deployment.\n--dry-run: lokale Builds, kein Upload. --skip-desktop-build: bereits bereitgestellte Installer prüfen und verwenden.\nWindows nativ mit npm run release:desktop bauen und .build/desktop-downloads/win32-x64 auf den Deploy-Rechner kopieren.');
 else{
  for(let i=0;i<args.length;i++){if(args[i]==='--config'){if(!args[++i]||args[i].startsWith('--'))throw Error('Konfigurationspfad fehlt');}else if(!['--dry-run','--reuse-analysis','--skip-desktop-build'].includes(args[i]))throw Error('Unbekannte Option: '+args[i]);}
  if(!args.includes('--skip-desktop-build'))await releaseDesktop({reuseAnalysis:args.includes('--reuse-analysis')});
  await readDownloads(join(root,'.build','desktop-downloads'),{required:true});
  const forwarded=args.filter(a=>!['--reuse-analysis','--skip-desktop-build'].includes(a));
  const child=spawn(process.execPath,[join(root,'scripts','deploy.mjs'),...forwarded],{cwd:root,stdio:'inherit'});
  child.once('error',e=>{console.error(e.message);process.exitCode=1;});child.once('exit',code=>{process.exitCode=code??1;});
 }
}catch(e){console.error(e.message);process.exitCode=1;}
