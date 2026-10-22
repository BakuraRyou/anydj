import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,access,chmod,readdir,stat,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {snapshotSources,validateConfig} from './deploy-apps.mjs';
import {sha256} from './desktop-downloads.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const initController=new AbortController();
export const defaults={name:'anydj-win11',user:'anydj-build',port:22,buildRoot:'C:/AnyDjBuild',mac:'52:54:00:ad:11:01',nodeVersion:'22.22.1',pythonVersion:'3.14.4'};
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export function answerFile({user,password}){
 return String.raw`<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
 <settings pass="windowsPE">
  <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
   <SetupUILanguage><UILanguage>en-US</UILanguage></SetupUILanguage><InputLocale>en-US</InputLocale><SystemLocale>en-US</SystemLocale><UILanguage>en-US</UILanguage><UserLocale>en-US</UserLocale>
  </component>
  <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
   <DiskConfiguration><Disk wcm:action="add"><DiskID>0</DiskID><WillWipeDisk>true</WillWipeDisk><CreatePartitions>
    <CreatePartition wcm:action="add"><Order>1</Order><Type>EFI</Type><Size>260</Size></CreatePartition>
    <CreatePartition wcm:action="add"><Order>2</Order><Type>MSR</Type><Size>16</Size></CreatePartition>
    <CreatePartition wcm:action="add"><Order>3</Order><Type>Primary</Type><Extend>true</Extend></CreatePartition>
   </CreatePartitions><ModifyPartitions>
    <ModifyPartition wcm:action="add"><Order>1</Order><PartitionID>1</PartitionID><Format>FAT32</Format><Label>System</Label></ModifyPartition>
    <ModifyPartition wcm:action="add"><Order>2</Order><PartitionID>3</PartitionID><Format>NTFS</Format><Label>Windows</Label><Letter>C</Letter></ModifyPartition>
   </ModifyPartitions></Disk><WillShowUI>OnError</WillShowUI></DiskConfiguration>
   <ImageInstall><OSImage><InstallFrom><MetaData wcm:action="add"><Key>/IMAGE/NAME</Key><Value>Windows 11 Pro</Value></MetaData></InstallFrom><InstallTo><DiskID>0</DiskID><PartitionID>3</PartitionID></InstallTo><WillShowUI>OnError</WillShowUI></OSImage></ImageInstall>
   <UserData><AcceptEula>true</AcceptEula><FullName>AnyDj Build</FullName><Organization>AnyDj</Organization><ProductKey><Key>VK7JG-NPHTM-C97JM-9MPGT-3V66T</Key><WillShowUI>Never</WillShowUI></ProductKey></UserData>
  </component>
 </settings>
 <settings pass="specialize">
  <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"><ComputerName>ANYDJ-WINBUILD</ComputerName><TimeZone>W. Europe Standard Time</TimeZone></component>
  <component name="Microsoft-Windows-Deployment" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"><RunSynchronous><RunSynchronousCommand wcm:action="add"><Order>1</Order><Path>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\AnyDjInit\schedule.ps1</Path></RunSynchronousCommand></RunSynchronous></component>
 </settings>
 <settings pass="oobeSystem">
  <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"><InputLocale>en-US</InputLocale><SystemLocale>en-US</SystemLocale><UILanguage>en-US</UILanguage><UserLocale>en-US</UserLocale></component>
  <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
   <OOBE><HideEULAPage>true</HideEULAPage><HideOnlineAccountScreens>true</HideOnlineAccountScreens><HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE><ProtectYourPC>3</ProtectYourPC></OOBE>
   <UserAccounts><LocalAccounts><LocalAccount wcm:action="add"><Name>${xml(user)}</Name><DisplayName>AnyDj Build</DisplayName><Group>Users</Group><Password><Value>${xml(password)}</Value><PlainText>true</PlainText></Password></LocalAccount></LocalAccounts></UserAccounts>
   <AutoLogon><Enabled>true</Enabled><LogonCount>1</LogonCount><Username>${xml(user)}</Username><Password><Value>${xml(password)}</Value><PlainText>true</PlainText></Password></AutoLogon>
  </component>
 </settings>
</unattend>
`;
}
export function initOptions(args){
 const result={};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(['--iso','--iso-sha256'].includes(arg)){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Wert fehlt: '+arg);result[arg.slice(2)]=args[++i];}
  else if(['--check','--prepare-only','--accept-windows-license','--skip-linux','--mac-only'].includes(arg))result[arg.slice(2)]=true;
  else throw Error('Unbekannte Option: '+arg);
 }
 if(result['iso-sha256']&&!/^[a-fA-F0-9]{64}$/.test(result['iso-sha256']))throw Error('Ungültige ISO-Prüfsumme.');
 return result;
}
async function main(){
 if(process.argv.includes('--help')){console.log('npm run init:apps [-- --iso PATH] [--iso-sha256 HASH] [--prepare-only] [--check] [--skip-linux] [--mac-only]\nErzeugt lokale VM-Konfiguration und Schlüssel, installiert Windows in einer neuen KVM-VM und bereitet native Build-Abhängigkeiten vor.\nWindows-ISO und gültige Lizenz erforderlich. --accept-windows-license bestätigt die Lizenz für unbeaufsichtigte Aufrufe.\n--prepare-only erzeugt nur lokale Dateien; --check prüft nur Voraussetzungen.\nMac optional über builder/mac-build.json auf einem vorhandenen Apple-Rechner.');return;}
 const options=initOptions(process.argv.slice(2));
 if(process.platform!=='linux'||process.arch!=='x64')throw Error('init:apps benötigt einen Linux-x64-Host.');
 const run=(file,args,{capture=false,quiet=false,cleanup=false}={})=>new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:root,env:{...process.env,LC_ALL:'C'},signal:cleanup?undefined:initController.signal,stdio:['inherit',capture||quiet?'pipe':'inherit',quiet?'pipe':'inherit']});let output='';
  child.stdout?.on('data',chunk=>output+=chunk);child.stderr?.on('data',()=>{});
  child.once('error',reject);child.once('exit',code=>code===0?resolve(output.trim()):reject(Error(`${file}: Exit ${code}`)));
 });
 const virsh=(args,cleanup=false)=>run('virsh',['--connect','qemu:///system',...args],{capture:true,cleanup});
 const required=['virsh','virt-install','genisoimage','7z','ssh','scp','ssh-keygen','qemu-system-x86_64','swtpm'];
 if(!options.check&&!options['prepare-only']&&!options['mac-only']){
  let missing=false;
  for(const name of required)try{await run('bash',['-c','command -v "$1"','check',name],{capture:true});}catch{missing=true;}
  if(missing){
   console.log('Fehlende VM-Werkzeuge über Ubuntu-Pakete installieren; sudo kann im Terminal ein Passwort verlangen.');
   await run('sudo',['apt-get','update']);
   await run('sudo',['apt-get','install','-y','qemu-system-x86','libvirt-daemon-system','libvirt-clients','virtinst','virt-manager','ovmf','swtpm','swtpm-tools','genisoimage','7zip','openssh-client','python3-venv']);
  }
 }
 const local=join(root,'.build','vm'),keys=join(local,'ssh');
 const configFile=join(root,'builder','windows-vm.json');
 if(options['mac-only']){await mkdir(join(root,'.build'),{recursive:true});const {releaseRemoteMac}=await import('./release-mac-remote.mjs');if(!await releaseRemoteMac({root,run,initialize:true}))throw Error('Mac fehlt. Zuerst builder/mac-build.json für einen vorhandenen Apple-Rechner anlegen.');return;}
 if(options.check){
  await access('/dev/kvm');await virsh(['list','--all']);
  for(const command of required)await run('bash',['-c','command -v "$1"','check',command],{capture:true});
  console.log('KVM und Werkzeuge erreichbar. Keine VM angelegt.');return;
 }
 await mkdir(keys,{recursive:true,mode:0o700});await chmod(local,0o700);await chmod(keys,0o700);
 const key=join(keys,'id_ed25519'),hostKey=join(keys,'ssh_host_ed25519_key');
 for(const path of [key,hostKey]){try{await access(path);}catch{await run('ssh-keygen',['-q','-t','ed25519','-N','','-f',path]);}await chmod(path,0o600);}
 let config;
 try{config=JSON.parse(await readFile(configFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;config={...defaults,identityFile:key,knownHostsFile:join(keys,'known_hosts'),host:'auto',managed:true,vmUUID:randomUUID()};await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});}
 validateConfig({...config,host:config.host==='auto'?'localhost':config.host});
 if(!config.managed)throw Error('init:apps verändert keine manuell konfigurierte VM. Bestehenden SSH-Zugang und Buildumgebung verwenden.');
 if(options['prepare-only']){console.log('Konfiguration und SSH-Schlüssel vorbereitet: '+configFile);return;}
 await access('/dev/kvm').catch(()=>{throw Error('KVM-Zugriff fehlt. Host-Einrichtung: desktop/windows-vm.md');});
 const names=(await virsh(['list','--all','--name'])).split('\n');
 const exists=names.includes(config.name);
 if(exists&&(!config.vmUUID||await virsh(['domuuid',config.name])!==config.vmUUID))throw Error('Vorhandene VM gehört nicht zu dieser init-Konfiguration. Keine Änderungen vorgenommen.');
 if(!config.vmUUID){config.vmUUID=randomUUID();await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});}
 let iso=options.iso;
 if(!exists){
  if(!iso){
   const media=join(local,'media');await mkdir(media,{recursive:true});
   const candidates=[];
   for(const dir of [media,join(homedir(),'Downloads')])try{for(const name of await readdir(dir))if(/windows.*\.iso$/i.test(name)||/^Win11.*\.iso$/i.test(name))candidates.push(join(dir,name));}catch{}
   if(candidates.length===1)iso=candidates[0];
  }
  if(!iso&&process.stdin.isTTY){
   console.log('Windows-11-x64-ISO von https://www.microsoft.com/en-us/software-download/windows11 herunterladen.');
   const prompt=createInterface({input:process.stdin,output:process.stdout});try{iso=await prompt.question('Pfad zur ISO: ');}finally{prompt.close();}
  }
  if(!iso)throw Error('Windows-ISO fehlt. ISO nach .build/vm/media/windows11.iso laden, dann npm run init:apps erneut ausführen. Offizielle Quelle: https://www.microsoft.com/en-us/software-download/windows11');
  iso=resolve(iso);if((await stat(iso)).size<1024**3)throw Error('Windows-ISO ist unvollständig.');
  if(options['iso-sha256']&&await sha256(iso)!==options['iso-sha256'].toLowerCase())throw Error('ISO-Prüfsumme stimmt nicht.');
  let accepted=options['accept-windows-license'];
  if(!accepted&&process.stdin.isTTY){const prompt=createInterface({input:process.stdin,output:process.stdout});try{accepted=(await prompt.question('Gültige Windows-Lizenz vorhanden und Windows-Lizenzbedingungen für diese VM akzeptiert? [ja/NEIN] ')).trim().toLowerCase()==='ja';}finally{prompt.close();}}
  if(!accepted)throw Error('Windows-Installation benötigt deine Bestätigung der Windows-Lizenzbedingungen. init:apps im Terminal ausführen oder --accept-windows-license verwenden.');
  const seed=join(local,'seed');await mkdir(seed,{recursive:true,mode:0o700});
  await writeFile(join(seed,'Autounattend.xml'),answerFile({user:config.user,password:randomBytes(32).toString('base64url')+'!aA1'}),{mode:0o600});
  const oem=join(seed,'sources','$OEM$','$1','AnyDjInit');await mkdir(oem,{recursive:true});
  const {cp}=await import('node:fs/promises');
  await cp(join(root,'scripts','vm','windows-bootstrap.ps1'),join(oem,'bootstrap.ps1'));
  for(const suffix of ['','.pub'])await cp(hostKey+suffix,join(oem,'ssh_host_ed25519_key'+suffix));
  await writeFile(join(oem,'bootstrap.json'),JSON.stringify({user:config.user,publicKey:(await readFile(key+'.pub','utf8')).trim(),nodeVersion:config.nodeVersion??defaults.nodeVersion,pythonVersion:config.pythonVersion??defaults.pythonVersion}));
  await writeFile(join(oem,'schedule.ps1'),`$ErrorActionPreference='Stop'\n$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\\AnyDjInit\\bootstrap.ps1'\n$trigger=New-ScheduledTaskTrigger -AtLogOn\nRegister-ScheduledTask -TaskName 'AnyDjBootstrap' -Action $action -Trigger $trigger -User 'SYSTEM' -RunLevel Highest -Force | Out-Null\n`);
  const installISO=join(local,'windows-unattended.iso');
  // Microsoft media uses UDF; force this reader instead of the tiny ISO9660 fallback tree.
  const tree=join(local,'windows-tree');await rm(tree,{recursive:true,force:true});
  await run('7z',['x','-tudf','-y','-bd','-bso0','-o'+tree,iso]);
  await cp(seed,tree,{recursive:true});
  await access(join(tree,'efi','microsoft','boot','efisys_noprompt.bin'));
  await rm(join(tree,'boot','bootfix.bin'),{force:true});
  await run('genisoimage',['-quiet','-udf','-allow-limited-size','-iso-level','3','-J','-joliet-long','-r','-V','ANYDJ_WIN11','-b','boot/etfsboot.com','-no-emul-boot','-boot-load-size','8','-eltorito-alt-boot','-e','efi/microsoft/boot/efisys_noprompt.bin','-no-emul-boot','-o',installISO,tree]);
  const pool='default';
  try{await virsh(['pool-info',pool]);}catch{await virsh(['pool-define-as',pool,'dir','--target','/var/lib/libvirt/images']);await virsh(['pool-build',pool]);}
  if(!(await virsh(['pool-info',pool])).includes('running'))await virsh(['pool-start',pool]);
  const volume=config.name+'-install-'+randomUUID()+'.iso';
  await virsh(['vol-create-as',pool,volume,String((await stat(installISO)).size),'--format','raw']);
  await run('virsh',['--connect','qemu:///system','vol-upload','--pool',pool,volume,installISO]);
  const mediaPath=await virsh(['vol-path','--pool',pool,volume]);
  config.installVolume=volume;await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});
  await run('virt-install',['--connect','qemu:///system','--name',config.name,'--uuid',config.vmUUID,'--memory','8192','--vcpus','4','--cpu','host-passthrough','--virt-type','kvm','--machine','q35','--osinfo','win11','--boot','uefi,firmware.feature0.name=secure-boot,firmware.feature0.enabled=yes,firmware.feature1.name=enrolled-keys,firmware.feature1.enabled=yes','--tpm','backend.type=emulator,backend.version=2.0,model=tpm-crb','--disk','pool=default,size=128,format=qcow2,bus=sata','--cdrom',mediaPath,'--network','network=default,model=e1000e,mac='+config.mac,'--graphics','spice,listen=127.0.0.1','--video','vga','--noautoconsole','--wait','0']);
 }
 console.log('Warte auf Windows-Installation und SSH (bis zu 60 Minuten). Fortschritt in virt-manager.');
 if((await virsh(['domstate',config.name]))==='shut off')await virsh(['start',config.name]);
 const hostPublic=(await readFile(hostKey+'.pub','utf8')).trim().split(/\s+/).slice(0,2).join(' ');
 const deadline=Date.now()+60*60*1000;let host=config.host,connected=false,resumes=0;
 while(Date.now()<deadline){
  if(initController.signal.aborted)throw Error('init:apps abgebrochen.');
  if(await virsh(['domstate',config.name])==='shut off'){
   if(++resumes>3)throw Error('Windows-Installation beendet sich wiederholt. Konsole in virt-manager prüfen.');
   console.log('Windows-Installation nach erstem Neustart fortsetzen …');await virsh(['start',config.name]);
  }
  if(host==='auto'){
   const leases=await virsh(['net-dhcp-leases','default','--mac',config.mac]);
   const match=leases.match(/\b(\d+\.\d+\.\d+\.\d+)\/\d+/);if(match)host=match[1];
  }
  if(host!=='auto'){
   await writeFile(config.knownHostsFile,`[${host}]:${config.port} ${hostPublic}\n${host} ${hostPublic}\n`,{mode:0o600});
   try{await run('ssh',['-i',config.identityFile,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+config.knownHostsFile,'-o','ConnectTimeout=5','-p',String(config.port),config.user+'@'+host,'powershell.exe','-NoProfile','-NonInteractive','-Command','"if (!(Test-Path C:/AnyDjInit/bootstrap-ready)) { exit 1 }"'],{quiet:true});connected=true;break;}catch{}
  }
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!connected)throw Error('Windows/SSH nicht bereit. In virt-manager C:\\AnyDjInit\\bootstrap.log und bootstrap-error.txt prüfen. init:apps kann erneut ausgeführt werden.');
 if(config.installVolume){
  if(!new RegExp('^'+config.name+'-install-[a-f0-9-]+\\.iso$').test(config.installVolume))throw Error('Unbekanntes Installationsvolume; keine Bereinigung.');
  await virsh(['change-media',config.name,'sdb','--eject','--live','--config']);
  await virsh(['vol-delete','--pool','default',config.installVolume]);delete config.installVolume;
  for(const name of ['seed','windows-tree','windows-unattended.iso'])await rm(join(local,name),{recursive:true,force:true});
 }
 config.host=host;await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});
 const source=join(local,'source');await rm(source,{recursive:true,force:true});await snapshotSources(root,source);
 await run('python3',[join(root,'scripts','vm','prepare-msvc.py')]);
 const {cp}=await import('node:fs/promises');
 await cp(join(local,'msvc','ready'),join(source,'.build','msvc'),{recursive:true});
 const archive=join(local,'init-source.tar.gz');await run('tar',['-czf',archive,'-C',source,'.']);
 const common=['-i',config.identityFile,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+config.knownHostsFile];
 await run('scp',[...common,'-P',String(config.port),archive,config.user+'@'+host+':'+config.buildRoot+'/init-source.tar.gz']);
 const guest=`$ErrorActionPreference='Stop'; $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'); Set-Location '${config.buildRoot}'; tar.exe -xf init-source.tar.gz; if ($LASTEXITCODE -ne 0) {exit $LASTEXITCODE}; node.exe scripts/prepare-build-host.mjs; exit $LASTEXITCODE`;
 try{await run('ssh',[...common,'-p',String(config.port),config.user+'@'+host,'powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(guest,'utf16le').toString('base64')]);}
 finally{await virsh(['shutdown',config.name],true);}
 if(!options['skip-linux']){
  try{await access(join(root,'node_modules','electron-builder','cli.js'));}catch{await run('npm',['ci']);}
  try{await run(process.execPath,[join(root,'scripts','prepare-build-host.mjs'),'--check']);}
  catch{await run(process.execPath,[join(root,'scripts','prepare-build-host.mjs')]);}
 }
 const {releaseRemoteMac}=await import('./release-mac-remote.mjs');
 await releaseRemoteMac({root,run,initialize:true});
 config.ready=true;await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});
 console.log('Windows- und Linux-Buildumgebungen eingerichtet. Nächster Befehl: npm run deploy:apps');
}
async function entry(){
 if(process.argv.includes('--help')||process.argv.includes('--check'))return main();
 const lock=join(root,'.build','init-apps.lock');await mkdir(join(root,'.build'),{recursive:true});
 await mkdir(lock).catch(error=>{if(error.code==='EEXIST')throw Error('init:apps läuft bereits, oder verwaiste Sperre: '+lock);throw error;});
 const interrupt=()=>initController.abort();process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{return await main();}finally{await rm(lock,{recursive:true,force:true});process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))entry().catch(error=>{console.error(error.message);process.exitCode=1;});
