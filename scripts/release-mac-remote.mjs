import {readFile,mkdir,mkdtemp,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {snapshotSources} from './deploy-apps.mjs';
import {readDownloads} from './desktop-downloads.mjs';
export function validateMacConfig(config){
 if(!config||typeof config!=='object')throw Error('Mac-Konfiguration fehlt.');
 for(const key of ['host','user'])if(typeof config[key]!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(config[key]))throw Error('Ungültige Mac-Konfiguration: '+key);
 if(typeof config.buildRoot!=='string'||!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(config.buildRoot))throw Error('Absoluter Mac-buildRoot ohne Leerzeichen oder Traversierung erforderlich.');
 for(const key of ['identityFile','knownHostsFile'])if(config[key]!==undefined&&(typeof config[key]!=='string'||!config[key]||/[\r\n\0]/.test(config[key])))throw Error('Ungültige Mac-Konfiguration: '+key);
 const port=config.port??22;if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger Mac-SSH-Port.');
 return {...config,port};
}
export async function releaseRemoteMac({root,run,initialize=false,reuseAnalysis=false}){
 const file=join(root,'builder','mac-build.json');let config;
 try{config=validateMacConfig(JSON.parse(await readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT')return false;throw error;}
 const common=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10',...(config.identityFile?['-i',resolve(config.identityFile)]:[]),...(config.knownHostsFile?['-o','UserKnownHostsFile='+resolve(config.knownHostsFile)]:[])];
 const remote=config.user+'@'+config.host;
 const ssh=script=>run('ssh',[...common,'-p',String(config.port),remote,"/bin/sh -lc '"+script.replaceAll("'","'\\''")+"'"]);
 const work=await mkdtemp(join(root,'.build','mac-release-'));
 try{
  const job='build-'+Date.now(),base=config.buildRoot,guest=initialize?base:base+'/jobs/'+job;
  const archive=join(work,'source.tar.gz');await snapshotSources(root,join(work,'source'));
  await run('tar',['-czf',archive,'-C',join(work,'source'),'.']);
  await ssh(`set -eu; test "$(uname -s)" = Darwin; command -v node; command -v python3; mkdir -p ${guest}`);
  await run('scp',[...common,'-P',String(config.port),archive,remote+':'+guest+'/source.tar.gz']);
  await ssh(`set -eu; cd ${guest}; tar -xf source.tar.gz; ${initialize?'node scripts/prepare-build-host.mjs':`for name in data .venv-beat-this .venv-style .venv-structure; do test -d ${base}/$name; ln -s ${base}/$name $name; done; ${reuseAnalysis?`mkdir .build; ln -s ${base}/.build/analysis .build/analysis; `:''}npm ci; node scripts/prepare-build-host.mjs --check; CSC_IDENTITY_AUTO_DISCOVERY=false node scripts/release-desktop.mjs${reuseAnalysis?' --reuse-analysis':''}`}`);
  if(initialize){console.log('Mac-Buildumgebung vorbereitet.');return true;}
  const incoming=join(work,'downloads');await mkdir(incoming);
  // SCP globs are restricted to generated release folders on this dedicated host.
  await run('scp',[...common,'-P',String(config.port),'-r',remote+':'+guest+'/.build/desktop-downloads/darwin-*',incoming]);
  const entries=await readDownloads(incoming,{required:true});
  const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  if(entries.length!==1||entries[0].platform!=='darwin'||entries[0].version!==version)throw Error('Mac-Release passt nicht zur aktuellen App-Version.');
  const folder='darwin-'+entries[0].arch,target=join(root,'.build','desktop-downloads',folder),backup=join(work,'previous');let previous=false;
  try{await rename(target,backup);previous=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await rename(join(incoming,folder),target);}catch(error){if(previous)await rename(backup,target);throw error;}
  await ssh(`rm -rf ${guest}`);
  console.log('Mac-Installer geprüft: '+folder);return true;
 }finally{await rm(work,{recursive:true,force:true});}
}
