import {readFile,writeFile,mkdir,mkdtemp,readdir,lstat,copyFile,chmod,rm,rename,cp} from 'node:fs/promises';
import {join,resolve,dirname,posix,win32} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sha256,readDownloads,platforms} from './desktop-downloads.mjs';
import {run} from './deploy-all-worker.mjs';
import {readRuntimeFiles} from './windows-runtime.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const psQuote=value=>"'"+value.replaceAll("'","''")+"'";
const psCommand=script=>'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(script,'utf16le').toString('base64');
const relative=(target,...parts)=>(target.platform==='win32'?win32:posix).join(target.root,...parts);

export function parseOptions(args){
 const options={config:join(ROOT,'deploy-all.json'),reuseAnalysis:false,syncOnly:false,dryRun:false,check:false,buildOnly:false,publishOnly:false,targets:['linux','mac','windows']};
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(arg==='--')continue;
  if(arg==='--target'||arg.startsWith('--target=')){
   const value=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];
   if(!['linux','mac','windows'].includes(value))throw Error('--target benötigt linux, mac oder windows.');
   options.targets=[value];
  }else if(['--config','--init-from','--ftp-config'].includes(arg)||['--config=','--init-from=','--ftp-config='].some(prefix=>arg.startsWith(prefix))){
   const key=arg.split('=')[0],value=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];
   if(!value||value.startsWith('--'))throw Error('Pfad fehlt nach '+key);
   options[{'--config':'config','--init-from':'initFrom','--ftp-config':'ftpConfig'}[key]]=resolve(value);
  }else if(arg==='--reuse-analysis')options.reuseAnalysis=true;
  else if(arg==='--sync-only')options.syncOnly=true;
  else if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--check')options.check=true;
  else if(arg==='--build-only')options.buildOnly=true;
  else if(arg==='--publish-only')options.publishOnly=true;
  else throw Error('Unbekannte Option: '+arg);
 }
 if([options.dryRun,options.check,!!options.initFrom].filter(Boolean).length>1)throw Error('--dry-run, --check und --init-from getrennt verwenden.');
 if(options.publishOnly&&(options.buildOnly||options.syncOnly||options.check||options.initFrom||options.reuseAnalysis))throw Error('--publish-only nicht mit Build-/Sync-/Check-Optionen kombinieren.');
 return options;
}

export function validateConfig(config,{root=ROOT}={}){
 if(!config||typeof config!=='object'||!config.mac||!config.windows)throw Error('deploy-all.json benötigt mac und windows. Siehe docs/deploy-all.md.');
 const targets=[{name:'linux',platform:'linux',root:join(root,'.build','deploy-all','linux'),environmentRoot:root,...config.linux},
  {...config.mac,name:'mac',platform:'darwin'},{...config.windows,name:'windows',platform:'win32'}];
 for(const target of targets){
  const windows=target.platform==='win32';
  if(target.name!=='linux'&&(typeof target.host!=='string'||!/^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(target.host)))throw Error('Ungültiges SSH-Ziel: '+target.name);
  for(const key of ['root','environmentRoot','node','pnpm','python']){
   const value=target[key];if(value===undefined&&key!=='root')continue;
   const absolute=typeof value==='string'&&(windows?/^[A-Za-z]:[\\/]/.test(value):value.startsWith('/'));
   if(!absolute||/[\r\n\0]/.test(value)||value.split(/[\\/]/).some(p=>p==='..'||p==='.'))throw Error('Absoluter, eindeutiger Pfad erforderlich: '+target.name+'.'+key);
   if(key==='root'&&value.split(/[\\/]/).filter(Boolean).length<3)throw Error('Eigenen Build-Unterordner verwenden: '+target.name);
  }
  if(target.platform!=='linux'&&!target.node)throw Error('Node-Pfad fehlt: '+target.name);
  for(const key of ['identityFile','knownHostsFile','identityAgent'])if(target[key]!==undefined&&(typeof target[key]!=='string'||!target[key]||/[\r\n\0]/.test(target[key])))throw Error('Ungültiger SSH-Pfad: '+key);
  if(target.runtimeSource!==undefined&&(typeof target.runtimeSource!=='string'||!target.runtimeSource.startsWith('/')||/[\r\n\0]/.test(target.runtimeSource)))throw Error('runtimeSource muss ein absoluter Linux-Pfad sein.');
  target.port??=22;
  if(!Number.isInteger(target.port)||target.port<1||target.port>65535)throw Error('Ungültiger SSH-Port.');
  if(target.unsigned!==undefined&&typeof target.unsigned!=='boolean')throw Error('unsigned muss true oder false sein.');
 }
 if(targets[0].platform!=='linux'||targets[0].name!=='linux')throw Error('Linux-Ziel ungültig.');
 const localRoot=resolve(targets[0].root),sourceRoot=resolve(root);
 if((localRoot===sourceRoot||localRoot.startsWith(sourceRoot+'/'))&&!localRoot.startsWith(join(sourceRoot,'.build')+'/'))throw Error('Linux-Buildordner innerhalb des Projekts muss unter .build/ liegen.');
 return targets;
}

const excludedDirs=new Set(['.git','.aws','.ssh','.gnupg','.codex','.agents','.certs','.build','.temp','node_modules','dist','release','data','__pycache__','.venv','.venv-beat-this','.venv-style','.venv-structure']);
export function excludeSource(path){
 const parts=path.split('/'),name=parts.at(-1);
 return parts.some(part=>excludedDirs.has(part))||/^\.env(?:\.|$)/.test(name)&&!name.endsWith('.example')||
  /(?:^|[-_.])(?:credentials|gcloud|service-account|id_rsa|id_ed25519)(?:[-_.]|$)/i.test(name)||
  /\.(?:pem|key|p12|pfx|log|ses)$/i.test(name)||
  !/^(?:public|web|desktop)\//.test(path)&&/\.(?:mp3|wav|flac|m4a|ogg|mp4|webm|aac)$/i.test(name)||
  ['deploy-all.json','source-plan.json','build-target.json','.npmrc','.netrc'].includes(name)||
  /^builder\/(?:windows-vm|mac-build)\.json$/.test(path)||
  path.startsWith('builder/ftp/')&&!name.endsWith('.example')&&!/\.(?:py|md)$/.test(name);
}

export async function createSnapshot(source,destination,{excludePaths=[]}={}){
 const privateFiles=new Set(excludePaths.map(file=>resolve(file)));
 const files=[],folded=new Set();await mkdir(destination,{recursive:true});
 const walk=async(path='')=>{
  for(const name of (await readdir(join(source,path))).sort()){
   const relative=path?path+'/'+name:name;if(excludeSource(relative)||privateFiles.has(resolve(source,relative)))continue;
   const from=join(source,relative),info=await lstat(from);
   if(info.isSymbolicLink())throw Error('Symlink in Projektquellen nicht erlaubt: '+relative);
   if(/[<>:"\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw Error('Nicht portabler Dateiname: '+relative);
   const key=relative.toLowerCase();if(folded.has(key))throw Error('Groß-/Kleinschreibung kollidiert: '+relative);folded.add(key);
   if(info.isDirectory()){await mkdir(join(destination,relative),{recursive:true});await walk(relative);}
   else if(info.isFile()){
    const to=join(destination,relative);await copyFile(from,to);await chmod(to,info.mode&0o777);
    files.push({path:relative,sha256:await sha256(to),size:info.size});
   }else throw Error('Keine reguläre Projektdatei: '+relative);
  }
 };
 await walk();
 const {version}=JSON.parse(await readFile(join(destination,'package.json'),'utf8'));
 const plan={schema:1,job:randomUUID(),version,files};
 await writeFile(join(destination,'source-plan.json'),JSON.stringify(plan,null,2)+'\n');return plan;
}

export function remoteCommand(target,script,args=[]){
 if(target.platform==='win32')return psCommand('$ErrorActionPreference="Stop"; $env:Path=[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User"); & '+[target.node,script,...args].map(psQuote).join(' ')+'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }');
 return '/bin/sh -lc '+quote('/usr/bin/caffeinate -i '+[target.node,script,...args].map(quote).join(' '));
}
export function sshArgs(target,scp=false){
 return ['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=4',
  ...(target.identityFile?['-i',resolve(target.identityFile)]:[]),...(target.identityAgent?['-o','IdentityAgent='+target.identityAgent]:[]),...(target.knownHostsFile?['-o','UserKnownHostsFile='+resolve(target.knownHostsFile)]:[]),scp?'-P':'-p',String(target.port)];
}
const sftpPath=(target,path)=>target.host+':'+(target.platform==='win32'?'/'+path.replaceAll('\\','/'):path);
const nodeEval=(target,js)=>remoteCommand(target,'-e',["eval(Buffer.from('"+Buffer.from(js).toString('base64')+"','base64').toString())"]);

export async function checkTargets(targets,{execute=run,root=ROOT}={}){
 const errors=[];
 for(const target of targets)try{
  const windows=target.platform==='win32';
  const pnpm=target.pnpm||'pnpm',python=target.python||(windows?'python.exe':'python3');
  const tools=[['tar',['--version']],[python,['--version']]];
  if(windows)tools.push(['powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$ErrorActionPreference="Stop"; & '+psQuote(pnpm)+' --version; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }','utf16le').toString('base64')]]);
  else tools.push([pnpm,['--version']]);
  const js=`const cp=require('child_process'),path=require('path');if(process.platform!==${JSON.stringify(target.platform)}||!['x64',...(process.platform==='darwin'?['arm64']:[])].includes(process.arch)||Number(process.versions.node.split('.')[0])<22)throw Error('Node/Betriebssystem/Architektur passt nicht');console.log(process.platform,process.arch,process.version);process.env.PATH=path.dirname(process.execPath)+path.delimiter+process.env.PATH;for(const [file,args] of ${JSON.stringify(tools)}){const r=cp.spawnSync(file,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(file+' nicht bereit');}`;
  if(target.name==='linux')await execute(process.execPath,['-e',js],{cwd:root});
  else await execute('ssh',[...sshArgs(target),target.host,nodeEval(target,js)],{cwd:root});
  console.log(`[${target.name}] Node, Python, pnpm und tar bereit.`);
 }catch(error){errors.push(`[${target.name}] ${error.message}`);}
 if(errors.length)throw Error(errors.join('\n'));
}

export async function collectDownloads(incoming,destination,platform,version){
 const entries=await readDownloads(incoming,{required:true});
 if(entries.some(e=>e.platform!==platform||e.version!==version)||entries.length!==platforms[platform].length||new Set(entries.map(e=>e.arch)).size!==1)throw Error('Installer passen nicht zum Build-Auftrag: '+platform);
 const folder=platform+'-'+entries[0].arch,target=join(destination,folder),backup=join(incoming,'previous');
 await mkdir(destination,{recursive:true});let previous=false;
 try{await rename(target,backup);previous=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 try{await rename(join(incoming,folder),target);}catch(error){if(previous)await rename(backup,target);throw error;}
 return target;
}

export async function completeDeployment({options,targets,version,build,root=ROOT,execute=run,downloads=readDownloads}){
 // A rejected build must never reach the publishing step.
 if(!options.publishOnly)await build();
 if(options.syncOnly||options.buildOnly)return;
 const entries=await downloads(join(root,'.build','desktop-downloads'),{required:true});
 if(entries.some(entry=>entry.version!==version))throw Error('Veröffentlichung abgebrochen: Installer-Version stimmt nicht mit package.json überein.');
 for(const target of targets)if(!entries.some(entry=>entry.platform===target.platform))throw Error('Veröffentlichung abgebrochen: Installer fehlt für '+target.name);
 console.log('Geprüfte Installer und Downloadseite veröffentlichen …');
 await execute(process.execPath,[join(root,'scripts','deploy-full.mjs'),'--skip-desktop-build',...(options.ftpConfig?['--config',options.ftpConfig]:[]),...(options.dryRun?['--dry-run']:[])],{cwd:root});
}

export async function deployTargets({targets,snapshot,plan,archive,runtimeArchive,work,options,root=ROOT,execute=run}){
 const failures=[];
 await Promise.all(targets.map(async target=>{
  const remote=target.name!=='linux',workspace=relative(target,'runs',plan.job,'source');
  const downloads='desktop-downloads';
  console.log(`[${target.name}] ${options.syncOnly?'Synchronisieren':'Synchronisieren und nativ bauen'} …`);
  try{
   const settings={target,options:{syncOnly:options.syncOnly,reuseAnalysis:options.reuseAnalysis}};
   if(remote){
    const ssh=command=>execute('ssh',[...sshArgs(target),target.host,command],{cwd:root});
    const prepare=`const fs=require('fs');fs.mkdirSync(${JSON.stringify(workspace)},{recursive:true});`;
    await ssh(nodeEval(target,prepare));
    const upload=relative(target,'runs',plan.job,'source.tar.gz');
    await execute('scp',[...sshArgs(target,true),archive,sftpPath(target,upload)],{cwd:root});
    if(target.platform==='win32'&&runtimeArchive){
     const uploaded=relative(target,'runs',plan.job,'msvc.tar.gz'),cache=(target.environmentRoot||relative(target,'cache'))+'/.build/msvc';
     await execute('scp',[...sshArgs(target,true),runtimeArchive,sftpPath(target,uploaded)],{cwd:root});
     const unpack=`const fs=require('fs'),cp=require('child_process');fs.mkdirSync(${JSON.stringify(cache)},{recursive:true});const r=cp.spawnSync('tar',['-xzf',${JSON.stringify(uploaded)},'-C',${JSON.stringify(cache)}],{stdio:'inherit'});process.exit(r.status||0);`;
     await ssh(nodeEval(target,unpack));
    }
    const extract=`const cp=require('child_process'),fs=require('fs');const r=cp.spawnSync('tar',['-xzf',${JSON.stringify(upload)},'-C',${JSON.stringify(workspace)}],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);fs.writeFileSync(${JSON.stringify(relative(target,'runs',plan.job,'source','build-target.json'))},${JSON.stringify(JSON.stringify(settings))});`;
    await ssh(nodeEval(target,extract));
    await ssh(remoteCommand(target,relative(target,'runs',plan.job,'source','scripts','deploy-all-worker.mjs')));
    if(!options.syncOnly){
     const incoming=join(work,'incoming-'+target.name);await mkdir(incoming);
     await execute('scp',[...sshArgs(target,true),'-r',sftpPath(target,relative(target,'runs',plan.job,'source','.build',downloads)),incoming],{cwd:root});
     const result=await collectDownloads(join(incoming,downloads),join(root,'.build',downloads),target.platform,plan.version);
     console.log(`[${target.name}] Installer geprüft: ${result}`);
    }
   }else{
    await mkdir(dirname(workspace),{recursive:true});await cp(snapshot,workspace,{recursive:true,errorOnExist:true,force:false});
    await writeFile(join(workspace,'build-target.json'),JSON.stringify(settings));
    await execute(process.execPath,[join(workspace,'scripts','deploy-all-worker.mjs')],{cwd:workspace});
    if(!options.syncOnly){
     const incoming=join(work,'incoming-linux');await cp(join(workspace,'.build',downloads),incoming,{recursive:true});
     console.log('[linux] Installer geprüft: '+await collectDownloads(incoming,join(root,'.build',downloads),'linux',plan.version));
    }
   }
   console.log(`[${target.name}] Quellen: ${workspace}`);
  }catch(error){failures.push(new Error(`[${target.name}] ${error.message}`));console.error(failures.at(-1).message);}
 }));
 if(failures.length)throw new AggregateError(failures,failures.map(e=>e.message).join('\n'));
}

export async function main(args=process.argv.slice(2)){
 if(args.includes('--help')){console.log('pnpm run deploy:all [--config SSH_JSON] [--ftp-config FTP_JSON] [--check | --dry-run | --sync-only | --publish-only] [--build-only] [--reuse-analysis] [--target linux|mac|windows]\nSynchronisiert Quellen, baut native Desktop-Installer und veröffentlicht anschließend Website und Downloadseite über FTPS.\n--build-only: ohne Veröffentlichung; --publish-only: vorhandene geprüfte Installer ohne neue Builds veröffentlichen.\n--check: SSH und Werkzeuge; --dry-run: nur lokaler Quell-Snapshot; --publish-only --dry-run: Hosting-Paket ohne Upload vorbereiten.\n--init-from PATH: Animatus-Verbindungen in eine neue lokale deploy-all.json übernehmen.\nEinrichtung: docs/deploy-all.md');return;}
 const options=parseOptions(args);
 if(process.platform!=='linux')throw Error('deploy:all auf dem Linux-Rechner starten.');
 if(options.initFrom){
  const original=JSON.parse(await readFile(options.initFrom,'utf8'));
  const config={linux:{root:join(ROOT,'.build','deploy-all','linux'),environmentRoot:ROOT}};
  for(const name of ['mac','windows']){
   const old=original[name];if(!old)throw Error('Animatus-Ziel fehlt: '+name);
   const paths=name==='windows'?win32:posix;
   config[name]={host:old.host,root:paths.join(paths.dirname(old.root),'AnyDj Build'),node:old.node,pnpm:old.pnpm,...(name==='mac'?{unsigned:old.unsigned??true}:{})};
   for(const key of ['port','identityFile','knownHostsFile','identityAgent','python'])if(old[key]!==undefined)config[name][key]=old[key];
  }
  validateConfig(config);await writeFile(options.config,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('AnyDj-Verbindungen gespeichert: '+options.config);return;
 }
 const targets=validateConfig(JSON.parse(await readFile(options.config,'utf8').catch(error=>{if(error.code==='ENOENT')throw Error('deploy-all.json fehlt. Siehe docs/deploy-all.md oder --init-from.');throw error;}))).filter(target=>options.targets.includes(target.name));
 if(options.check){await checkTargets(targets);return;}
 await mkdir(join(ROOT,'.build'),{recursive:true});
 const locks=[];let work;
 try{
  for(const target of targets){
   const lock=join(ROOT,'.build','deploy-all-'+target.name+'.lock');
   await mkdir(lock).catch(error=>{if(error.code==='EEXIST')throw Error('Build für '+target.name+' läuft bereits oder Sperre ist verwaist: '+lock);throw error;});locks.push(lock);
  }
  if(!options.buildOnly&&!options.syncOnly&&(!options.dryRun||options.publishOnly)){
   const lock=join(ROOT,'.build','deploy-all-publish.lock');
   await mkdir(lock).catch(error=>{if(error.code==='EEXIST')throw Error('Eine Veröffentlichung läuft bereits oder Sperre ist verwaist: '+lock);throw error;});locks.push(lock);
   try{JSON.parse(await readFile(options.ftpConfig||join(ROOT,'builder','ftp','.env'),'utf8'));}
   catch{throw Error('FTP-Konfiguration fehlt oder enthält kein gültiges JSON. builder/ftp/.env einrichten oder --ftp-config angeben.');}
  }
  if(options.publishOnly){
   const {version}=JSON.parse(await readFile(join(ROOT,'package.json'),'utf8'));
   await completeDeployment({options,targets,version});
   console.log(options.dryRun?'Downloadseite und Hosting-Paket lokal vorbereitet.':'Geprüfte Desktop-Installer auf der Downloadseite veröffentlicht.');return;
  }
  work=await mkdtemp(join(ROOT,'.build','deploy-all-'));const snapshot=join(work,'source'),plan=await createSnapshot(ROOT,snapshot,{excludePaths:[options.config,...(options.ftpConfig?[options.ftpConfig]:[])]});
  console.log(`${plan.files.length} Projektdateien · ${(plan.files.reduce((sum,f)=>sum+f.size,0)/1024/1024).toFixed(1)} MiB · Version ${plan.version} · Auftrag ${plan.job}`);
  if(options.dryRun){console.log('Quell-Snapshot geprüft. Keine SSH-Verbindung und kein Build.');return;}
  await checkTargets(targets);
  const archive=join(work,'source.tar.gz');await run('tar',['-czf',archive,'-C',snapshot,'.'],{cwd:ROOT});
  let runtimeArchive;const windows=targets.find(target=>target.platform==='win32');
  if(windows&&!options.syncOnly){
   const runtime=windows.runtimeSource||join(ROOT,'.build','vm','msvc','ready');
   try{await readRuntimeFiles(runtime);}catch(error){
    if(error.code!=='ENOENT'||windows.runtimeSource)throw error;
    await run('python3',[join(ROOT,'scripts','vm','prepare-msvc.py')],{cwd:ROOT});
   }
   const manifest=await readRuntimeFiles(runtime),staged=join(work,'msvc');await mkdir(staged);
   for(const file of manifest.files)await copyFile(join(runtime,file.name),join(staged,file.name));
   await writeFile(join(staged,'manifest.json'),JSON.stringify(manifest));
   runtimeArchive=join(work,'msvc.tar.gz');await run('tar',['-czf',runtimeArchive,'-C',staged,'.'],{cwd:ROOT});
  }
  await completeDeployment({options,targets,version:plan.version,build:()=>deployTargets({targets,snapshot,plan,archive,runtimeArchive,work,options})});
  console.log(options.syncOnly?'Quellstände aller ausgewählten Ziele synchronisiert.':options.buildOnly?'Desktop-Builds abgeschlossen. Installer: .build/desktop-downloads/':'Desktop-Builds abgeschlossen und auf der Downloadseite veröffentlicht.');
 }finally{if(work)await rm(work,{recursive:true,force:true});for(const lock of locks)await rm(lock,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
