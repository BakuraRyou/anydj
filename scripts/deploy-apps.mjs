import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,rename,rm,cp,lstat,readdir} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDownloads} from './desktop-downloads.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function parseOptions(args){
 const options={vmConfig:join(root,'builder','windows-vm.json'),deployArgs:[],reuseAnalysis:false,check:false};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(['--vm-config','--config'].includes(arg)){
   const value=args[++i];if(!value||value.startsWith('--'))throw Error('Pfad fehlt nach '+arg);
   if(arg==='--vm-config')options.vmConfig=resolve(value);else options.deployArgs.push(arg,resolve(value));
  }else if(arg==='--reuse-analysis')options.reuseAnalysis=true;
  else if(arg==='--check')options.check=true;
  else if(arg==='--dry-run')options.deployArgs.push(arg);
  else throw Error('Unbekannte Option: '+arg);
 }
 return options;
}
export function validateConfig(config){
 if(!config||typeof config!=='object')throw Error('VM-Konfiguration fehlt.');
 const patterns={name:/^[a-zA-Z0-9_-]+$/,host:/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/,user:/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,buildRoot:/^[A-Za-z]:\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/};
 for(const [key,pattern] of Object.entries(patterns))if(typeof config[key]!=='string'||!pattern.test(config[key]))throw Error('Ungültige VM-Konfiguration: '+key);
 for(const key of ['identityFile','knownHostsFile'])if(config[key]!==undefined&&(typeof config[key]!=='string'||!config[key]||/[\r\n\0]/.test(config[key])))throw Error('Ungültige '+key+'.');
 const port=config.port??22;if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger SSH-Port.');
 return {...config,port};
}
const psQuote=value=>"'"+value.replaceAll("'","''")+"'";
export function guestScript(config,job,{reuseAnalysis=false}={}){
 const workspace=config.buildRoot+'/jobs/'+job;
 return `$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
function Native([string]$program, [string[]]$arguments) {
 & $program @arguments
 if ($LASTEXITCODE -ne 0) { throw "$program failed: exit $LASTEXITCODE" }
}
$base = ${psQuote(config.buildRoot)}
$work = ${psQuote(workspace)}
if (Test-Path $work) { throw 'Job directory already exists' }
New-Item -ItemType Directory -Path $work -Force | Out-Null
Native 'tar.exe' @('-xf', "$base/jobs/$job.tar.gz", '-C', $work)
foreach ($name in @('data', '.venv-beat-this', '.venv-style', '.venv-structure')) {
 if (!(Test-Path "$base/$name")) { throw "Windows build prerequisite missing: $base/$name" }
 New-Item -ItemType Junction -Path "$work/$name" -Target "$base/$name" | Out-Null
}
${reuseAnalysis?`New-Item -ItemType Directory -Path "$work/.build" -Force | Out-Null
New-Item -ItemType Junction -Path "$work/.build/analysis" -Target "$base/.build/analysis" | Out-Null`:''}
Set-Location $work
Native 'npm.cmd' @('ci')
Native 'node.exe' @('scripts/prepare-build-host.mjs', '--check')
Native 'node.exe' @('scripts/release-desktop.mjs'${reuseAnalysis?", '--reuse-analysis'":''})
`;
}
export function guestCleanup(config,job,{reuseAnalysis=false}={}){
 const work=config.buildRoot+'/jobs/'+job;
 return `$ErrorActionPreference='Stop'
$work=${psQuote(work)}
foreach ($name in @('data','.venv-beat-this','.venv-style','.venv-structure'${reuseAnalysis?",'.build/analysis'":''})) {
 $path="$work/$name"
 if (Test-Path $path) {
  if (!((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Expected junction: $path" }
  cmd.exe /d /c rmdir $path.Replace('/', '\\')
  if ($LASTEXITCODE -ne 0) { throw "Cannot detach junction: $path" }
 }
}
Remove-Item -LiteralPath $work -Recurse -Force
Remove-Item -LiteralPath ${psQuote(config.buildRoot+'/jobs/'+job+'.tar.gz')} -Force
`;
}
export async function withBuildVM({run,state,waitReady,build,shutdown}){
 if(!['running','shut off'].includes(state))throw Error('VM muss ausgeschaltet oder bereits gestartet sein; aktueller Zustand: '+state);
 let started=false, failure;
 try{
  if(state==='shut off'){await run('start');started=true;}
  await waitReady();
  return await build();
 }catch(error){failure=error;throw error;}
 finally{if(started)try{await shutdown();}catch(error){if(failure)throw new AggregateError([failure,error],failure.message+'; VM-Cleanup: '+error.message);throw error;}}
}
// Only explicit application sources are copied; reject links into private host files.
export async function snapshotSources(source,destination){
 await mkdir(destination,{recursive:true});
 const copy=async(from,to)=>{
  const info=await lstat(from);if(info.isSymbolicLink())throw Error('Symlink in Build-Quellen nicht erlaubt: '+from);
  if(info.isDirectory()){
   await mkdir(to,{recursive:true});
   for(const name of await readdir(from)){
    if(name.startsWith('.')||name==='__pycache__'||name.endsWith('.log'))continue;
    await copy(join(from,name),join(to,name));
   }
  }else if(info.isFile())await cp(from,to);
  else throw Error('Unzulässige Build-Quelldatei: '+from);
 };
 for(const name of ['package.json','package-lock.json','server.mjs','public','lib','desktop','scripts'])await copy(join(source,name),join(destination,name));
}
async function main(){
 if(process.argv.includes('--help')){
  console.log('npm run deploy:apps [-- --vm-config PATH] [--config FTP_JSON] [--reuse-analysis] [--dry-run] [--check]\nLinux bauen und veröffentlichen, Windows-VM bei Bedarf starten, Windows nativ bauen, prüfen und veröffentlichen.\nSelbst gestartete VM wird auch bei Fehlern heruntergefahren; bereits laufende VM bleibt an.\n--dry-run führt echte Builds und VM-Zugriffe aus, aber keinen FTPS-Upload.\n--check prüft nur lokale Konfiguration und VM-Zustand, startet keine VM.\nEinrichtung: desktop/windows-vm.md');return;
 }
 const options=parseOptions(process.argv.slice(2));
 if(process.platform!=='linux'||process.arch!=='x64')throw Error('deploy:apps benötigt einen Linux-x64-Host.');
 const saved=JSON.parse(await readFile(options.vmConfig,'utf8').catch(()=>{throw Error('Build-Umgebung fehlt. Zuerst npm run init:apps ausführen.');}));
 if(saved.managed&&!saved.ready)throw Error('Windows-Einrichtung noch nicht abgeschlossen. npm run init:apps ausführen.');
 const config=validateConfig(saved);
 await mkdir(join(root,'.build'),{recursive:true});
 const lock=join(root,'.build','deploy-apps.lock');
 await mkdir(lock).catch(error=>{if(error.code==='EEXIST')throw Error('deploy:apps läuft bereits, oder verwaiste Sperre: '+lock);throw error;});
 const controller=new AbortController();const interrupt=()=>controller.abort();
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 const logs=join(root,'.build','deploy-apps-logs');await mkdir(logs,{recursive:true});
 const logFile=join(logs,new Date().toISOString().replaceAll(':','-')+'.log');
 const log=createWriteStream(logFile);console.log('Build-Log: '+logFile);
 const run=(command,args,{capture=false,cleanup=false,timeout=2*60*60*1000}={})=>new Promise((accept,reject)=>{
  const child=spawn(command,args,{cwd:root,env:{...process.env,LC_ALL:'C'},stdio:['ignore','pipe','pipe'],signal:cleanup?undefined:controller.signal});let output='';
  const timer=setTimeout(()=>child.kill('SIGTERM'),timeout);
  child.stdout.on('data',chunk=>{log.write(chunk);if(capture)output+=chunk;else process.stdout.write(chunk);});
  child.stderr.on('data',chunk=>{log.write(chunk);process.stderr.write(chunk);});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',(code,signal)=>{clearTimeout(timer);code===0?accept(output.trim()):reject(Error(`${command}: Exit ${code??signal}. Log: ${logFile}`));});
 });
 const virsh=(args,extra={})=>run('virsh',['--connect','qemu:///system',...args],extra);
 const sshArgs=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5',...(config.identityFile?['-i',resolve(config.identityFile)]:[]),...(config.knownHostsFile?['-o','UserKnownHostsFile='+resolve(config.knownHostsFile)]:[])];
 const remote=config.user+'@'+config.host;
 const powershell=(script)=>['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')];
 const ssh=(script)=>run('ssh',[...sshArgs,'-p',String(config.port),remote,...powershell(script)],{timeout:2*60*60*1000});
 let work;
 try{
  if(config.managed&&config.vmUUID&&await virsh(['domuuid',config.name],{capture:true})!==config.vmUUID)throw Error('VM-UUID passt nicht zur eingerichteten Build-VM.');
  const state=await virsh(['domstate',config.name],{capture:true});
  if(!['running','shut off'].includes(state))throw Error('VM nicht bereit: '+state);
  if(options.check){console.log('Konfiguration und VM-Zustand geprüft: '+state+'. SSH/Windows-Build noch nicht geprüft.');return;}
  work=await mkdtemp(join(root,'.build','deploy-apps-'));
  await snapshotSources(root,join(work,'source'));
  const job='build-'+Date.now();
  const archive=join(work,job+'.tar.gz');
  await run('tar',['-czf',archive,'-C',join(work,'source'),'.']);
  const nodeScript=(name,args=[])=>run(process.execPath,[join(root,'scripts',name),...args]);
  console.log('Linux bauen und veröffentlichen …');
  await nodeScript('release-desktop.mjs',options.reuseAnalysis?['--reuse-analysis']:[]);
  await nodeScript('deploy-full.mjs',['--skip-desktop-build',...options.deployArgs]);
  console.log('Windows-VM und nativen Build vorbereiten …');
  await withBuildVM({state,run:()=>virsh(['start',config.name]),waitReady:async()=>{
   const deadline=Date.now()+300000;
   while(true){
    try{await ssh("$ErrorActionPreference='Stop'; $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'); if (!(Get-Command node.exe -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue) -or !(Get-Command tar.exe -ErrorAction SilentlyContinue)) { exit 1 }; Write-Output 'Build guest ready'");break;}
    catch(error){if(controller.signal.aborted||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,3000));}
   }
  },build:async()=>{
   await ssh(`New-Item -ItemType Directory -Force -Path ${psQuote(config.buildRoot+'/jobs')} | Out-Null`);
   await run('scp',[...sshArgs,'-P',String(config.port),archive,remote+':'+config.buildRoot+'/jobs/'+job+'.tar.gz']);
   await ssh(guestScript(config,job,options));
   const incoming=join(work,'downloads');await mkdir(incoming);
   await run('scp',[...sshArgs,'-P',String(config.port),'-r',remote+':'+config.buildRoot+'/jobs/'+job+'/.build/desktop-downloads/win32-x64',incoming]);
   const entries=await readDownloads(incoming,{required:true});
   const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
   if(entries.length!==1||entries[0].platform!=='win32'||entries[0].version!==version)throw Error('Windows-Release passt nicht zur aktuellen App-Version.');
   const target=join(root,'.build','desktop-downloads','win32-x64'),backup=join(work,'previous-windows');let previous=false;
   try{await rename(target,backup);previous=true;}catch(error){if(error.code!=='ENOENT')throw error;}
   try{await rename(join(incoming,'win32-x64'),target);}catch(error){if(previous)await rename(backup,target);throw error;}
   await ssh(guestCleanup(config,job,options));
  },shutdown:async()=>{
   console.log('Eigens gestartete Windows-VM herunterfahren …');
   await virsh(['shutdown',config.name],{cleanup:true,timeout:15000});
   const deadline=Date.now()+120000;
   while(Date.now()<deadline){if(await virsh(['domstate',config.name],{capture:true,cleanup:true,timeout:15000})==='shut off')return;await new Promise(resolve=>setTimeout(resolve,2000));}
   throw Error('VM fährt nicht herunter. Bitte in virt-manager prüfen; kein erzwungenes Ausschalten.');
  }});
  const {releaseRemoteMac}=await import('./release-mac-remote.mjs');
  const mac=await releaseRemoteMac({root,run,reuseAnalysis:options.reuseAnalysis});
  console.log(mac?'Linux-, Windows- und Mac-Releases geprüft; veröffentlichen …':'Linux- und Windows-Releases geprüft; veröffentlichen …');
  await nodeScript('deploy-full.mjs',['--skip-desktop-build',...options.deployArgs]);
 }finally{
  if(work)await rm(work,{recursive:true,force:true});
  await rm(lock,{recursive:true,force:true});log.end();
  process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
