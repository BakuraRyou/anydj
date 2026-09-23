import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
function run(command,args,{capture=false}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:root,stdio:['ignore',capture?'pipe':'inherit','inherit']});let output='';
    child.stdout?.on('data',chunk=>{output+=chunk;});
    child.once('error',()=>reject(Error(`Programm nicht verfügbar: ${command}. Node.js 22+ und Python 3 werden benötigt.`)));
    child.once('exit',code=>code===0?resolve(output):reject(Error(`Deployment-Schritt fehlgeschlagen (Exit ${code}).`)));
  });
}
export async function health(url,fetcher=fetch){
  let response;
  try{response=await fetcher(url,{signal:AbortSignal.timeout(5000),redirect:'manual',cache:'no-store'});}
  catch(error){throw Error(['TimeoutError','AbortError'].includes(error.name)?'Healthcheck: Zeitüberschreitung.':'Healthcheck: Verbindung fehlgeschlagen. DNS, HTTPS-Zertifikat und Erreichbarkeit prüfen.');}
  if(response.status===404)throw Error('HTTP 404 auf /healthz: Die Domain erreicht den AnyDj-Server nicht. Node.js-Aktivierung und App-/Document-Root in Plesk prüfen.');
  if(response.status>=300&&response.status<400)throw Error(`HTTP ${response.status}: Weiterleitung statt Healthcheck. publicUrl auf die endgültige HTTPS-Domain setzen.`);
  if(!response.ok)throw Error(`HTTP ${response.status} auf /healthz. Plesk-Logs auf Startfehler prüfen.`);
  let data;
  try{data=await response.json();}catch{throw Error('HTTP 200, aber kein JSON von AnyDj. Domain-Zuordnung und Document Root prüfen.');}
  if(data?.app!=='anydj'||data.status!=='ok'||typeof data.instance!=='string'||!data.instance||typeof data.release!=='string')throw Error('Keine gültige AnyDj-Serverantwort. Domain-Zuordnung prüfen.');
  return data;
}
export async function pruneAfterHealthcheck({action,release,url,cleanup,readHealth=health}){
  if(!['deploy','rollback'].includes(action))return null;
  const status=await readHealth(url);
  if(status.release!==release)throw Error('Keine Bereinigung: Der Healthcheck bestätigt nicht mehr das aktivierte Release.');
  return cleanup(release);
}
async function main(){
  const args=process.argv.slice(2),allowed=new Set(['--dry-run','--check','--restart','--crash','--rollback','--skip-health','--skip-build','--with-downloads','--config']);
  let configFile=join(root,'builder','ftp','.env');
  for(let i=0;i<args.length;i++){
    if(!allowed.has(args[i]))throw Error('Unbekannte Option: '+args[i]);
    if(args[i]==='--config'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Pfad nach --config fehlt.');configFile=resolve(args[++i]);}
  }
  if(['--check','--restart','--rollback'].filter(flag=>args.includes(flag)).length>1)throw Error('Nur eine Deployment-Aktion wählen.');
  if(args.includes('--crash')&&!args.includes('--restart'))throw Error('--crash benötigt --restart.');
  const action=args.includes('--check')?'check':args.includes('--rollback')?'rollback':args.includes('--restart')?(args.includes('--crash')?'crash':'restart'):'deploy';
  if(args.includes('--skip-build')&&action!=='deploy')throw Error('--skip-build ist nur für Deployments vorgesehen.');
  if(args.includes('--with-downloads')&&action!=='deploy')throw Error('--with-downloads ist nur für Deployments vorgesehen.');
  let config;
  try{config=JSON.parse(await readFile(configFile,'utf8'));}catch{throw Error('builder/ftp/.env fehlt oder enthält kein gültiges JSON. Vorlage: builder/ftp/.env.example');}
  if(typeof config?.localDir!=='string'||!config.localDir.startsWith('/')||/[\r\n\0]/.test(config.localDir)||config.localDir.split('/').some(p=>p==='.'||p==='..'))throw Error('Absoluten FTP-Zielpfad ohne . oder .. in localDir eintragen; / ist erlaubt.');
  config.localDir='/'+config.localDir.split('/').filter(Boolean).join('/');
  let healthURL;
  if(config.publicUrl){
    const url=new URL(config.publicUrl);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('publicUrl muss die HTTPS-Domain ohne Pfad, Zugangsdaten oder Parameter sein.');
    healthURL=new URL('/healthz',url);
  }
  if(action==='deploy'){
    if(args.includes('--skip-build')){
      let manifest;
      try{manifest=JSON.parse(await readFile(join(root,'dist','hosting','current.json'),'utf8'));}
      catch{throw Error('Vorbereitetes Hosting-Paket fehlt. Zuerst npm run build:hosting ausführen oder --skip-build weglassen.');}
      if(!/^\d{14}-[a-f0-9]{12}$/.test(manifest?.release))throw Error('Ungültiges vorbereitetes Hosting-Release. npm run build:hosting erneut ausführen.');
      if(manifest.preserveDownloads!==!args.includes('--with-downloads'))throw Error('Hosting-Paket passt nicht zum gewählten Download-Modus. Ohne --skip-build neu bauen; Installer nur mit --with-downloads veröffentlichen.');
      for(const file of ['index.js','package.json','public/index.html','public/downloads.html',`releases/${manifest.release}/server.mjs`]){
        await access(join(root,'dist','hosting',file)).catch(()=>{throw Error('Hosting-Paket unvollständig: '+file);});
      }
      console.log('Build übersprungen: vorhandenes dist/hosting wird verwendet. Neuere Quelländerungen sind darin möglicherweise nicht enthalten.');
    }else await run(process.execPath,[join(root,'scripts','build-hosting.mjs'),...(args.includes('--with-downloads')?['--with-downloads']:[])]);
  }
  console.log(`Plesk ${action}: ${config.localDir} · ${config.secure===false?'FTP':'FTPS'}`);
  if(action==='deploy')console.log(args.includes('--with-downloads')?'Website und bereitgestellte Installer veröffentlichen.':'Website inklusive Downloadseite aktualisieren; veröffentlichte Installer und Downloadkarten bleiben erhalten.');
  if(args.includes('--dry-run')){
    console.log('Nur vorbereitet. Keine Verbindung zum Server hergestellt.');return;
  }
  let before;
  if(action==='crash'){
    if(!healthURL)throw Error('Für --crash publicUrl konfigurieren, damit Passenger vor dem Neustart geweckt und danach geprüft wird.');
    before=await health(healthURL); // Start an idle Passenger process before writing its marker.
  }else if(action==='restart'&&healthURL){try{before=await health(healthURL);}catch{}}
  const output=await run('python3',[join(root,'builder','ftp','deploy.py'),'--config',configFile,'--action',action,
    ...(action==='deploy'?['--bundle',join(root,'dist','hosting')]:[])],{capture:true});
  const result=JSON.parse(output);
  if(action==='check'){console.log(`FTP-Zugang erfolgreich. Zielverzeichnis ${result.targetExists?'vorhanden':'noch nicht vorhanden; wird beim Deploy angelegt'}.`);return;}
  console.log(`Release ${result.release} · ${action==='crash'?'globaler Fehler angefordert':'Passenger-Neustart angefordert'}.`);
  if(!healthURL||args.includes('--skip-health')){console.log('Live-Start nicht geprüft; keine Release-Bereinigung. Plesk-Node.js-Konfiguration und /healthz prüfen.');return;}
  console.log('Warte auf die neue Node.js-Instanz …');
  const deadline=Date.now()+45000;
  let lastIssue='Noch keine Antwort.',reportedIssue='',healthy=false;
  while(Date.now()<deadline){
    try{const status=await health(healthURL);if(status.release===result.release&&(!before||status.instance!==before.instance)){healthy=true;break;}
      lastIssue=status.release!==result.release?'AnyDj antwortet noch mit einem anderen Release.':'AnyDj antwortet noch mit der bisherigen Instanz.';
    }catch(error){lastIssue=error.message;}
    if(lastIssue!==reportedIssue){console.log(lastIssue);reportedIssue=lastIssue;}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!healthy)throw Error(`Dateien/Restart-Anforderung wurden übertragen, aber der Live-Start ist nicht bestätigt. Keine Release-Bereinigung. ${lastIssue} Startup-Datei: index.js. Details: builder/README.md.`);
  console.log('AnyDj ist gestartet und erreichbar.');
  const pruned=await pruneAfterHealthcheck({action,release:result.release,url:healthURL,cleanup:async release=>{
    console.log('Alte Releases bereinigen; aktives Release und zwei Rückfallversionen bleiben erhalten …');
    return JSON.parse(await run('python3',[join(root,'builder','ftp','deploy.py'),'--config',configFile,'--action','prune','--expected-release',release],{capture:true}));
  }});
  if(pruned)console.log(`Bereinigung abgeschlossen: ${pruned.removed.length} alte Releases entfernt, ${pruned.kept.length} behalten.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
