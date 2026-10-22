import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat,symlink,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,delimiter,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './desktop-downloads.mjs';

export const run=(file,args,{cwd,env=process.env}={})=>new Promise((accept,reject)=>{
 // PowerShell passes quoted arguments to .cmd shims without cmd.exe string
 // interpolation of paths (the existing hosts use custom pnpm.cmd wrappers).
 if(process.platform==='win32'&&(/\.cmd$/i.test(file)||file==='pnpm')){
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const script='$ErrorActionPreference="Stop"; & '+[file,...args].map(quote).join(' ')+'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }';
  file='powershell.exe';args=['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')];
 }
 const child=spawn(file,args,{cwd,env,stdio:'inherit'});
 child.once('error',reject);
 child.once('close',(code,signal)=>code===0?accept():reject(Error(`${file}: Exit ${code??signal}`)));
});

export async function verifySources(workspace){
 const plan=JSON.parse(await readFile(join(workspace,'source-plan.json'),'utf8'));
 if(plan.schema!==1||!Array.isArray(plan.files)||!plan.files.length)throw Error('Quellmanifest fehlt oder ist ungültig.');
 const seen=new Set();
 for(const item of plan.files){
  if(typeof item.path!=='string'||item.path.startsWith('/')||item.path.includes('\\')||item.path.split('/').some(p=>!p||p==='.'||p==='..'||p.includes(':'))||seen.has(item.path))throw Error('Ungültiger Quellpfad.');
  seen.add(item.path);
  const file=join(workspace,...item.path.split('/'));
  const actual=await realpath(file),base=await realpath(workspace);
  if(!actual.startsWith(base+sep)||(await lstat(file)).isSymbolicLink()||await sha256(file)!==item.sha256)throw Error('Quellprüfsumme stimmt nicht: '+item.path);
 }
 return plan;
}

export async function buildWorkspace(workspace,target,{reuseAnalysis=false,syncOnly=false,execute=run}={}){
 const plan=await verifySources(workspace);
 if(process.platform!==target.platform)throw Error('Falsches Build-Betriebssystem: '+process.platform+' statt '+target.platform);
 if(!['x64',...(process.platform==='darwin'?['arm64']:[])].includes(process.arch))throw Error('Nicht unterstützte native Architektur: '+process.arch);
 if(syncOnly)return;
 const environment=resolve(target.environmentRoot||join(target.root,'cache'));
 await mkdir(environment,{recursive:true});
 const attach=async(name)=>{
  const source=join(environment,name),destination=join(workspace,name);
  await mkdir(source,{recursive:true});await mkdir(dirname(destination),{recursive:true});
  try{await lstat(destination);throw Error('Cache-Pfad bereits in Quellen vorhanden: '+name);}catch(error){if(error.code!=='ENOENT')throw error;}
  await symlink(source,destination,process.platform==='win32'?'junction':'dir');
 };
 for(const name of ['data','.venv-beat-this','.venv-style','.venv-structure','.build/analysis','.build/msvc'])await attach(name);
 const env={...process.env,ANYDJ_BUILD_ENV_ROOT:environment,PATH:[dirname(process.execPath),...(target.pnpm?[dirname(target.pnpm)]:[]),process.env.PATH].join(delimiter),
  ...(target.python?{ANYDJ_BUILD_PYTHON:target.python}:{}),...(target.unsigned?{CSC_IDENTITY_AUTO_DISCOVERY:'false'}:{})};
 await execute(target.pnpm||'pnpm',['install','--frozen-lockfile'],{cwd:workspace,env});
 await mkdir(join(environment,'.build'),{recursive:true});
 const stamp=join(environment,'.build','deploy-all-environment.json');
 const hash=createHash('sha256');
 for(const name of ['prepare-build-host.mjs','prepare-beat.py','prepare-style.py','prepare-structure.py','beat-this-requirements.txt','style-requirements.lock','structure-requirements.lock',...(process.platform==='darwin'&&process.arch==='x64'?['mac-intel-constraints.txt','beat-this-mac-intel-requirements.txt','style-mac-intel-requirements.txt','structure-mac-intel-requirements.txt']:[])])hash.update(await readFile(join(workspace,'scripts',name)));
 hash.update(process.platform+process.arch+(target.python||''));
 const fingerprint=hash.digest('hex');
 let previous;try{previous=JSON.parse(await readFile(stamp,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const script=name=>join(workspace,'scripts',name);
 if(previous?.fingerprint!==fingerprint){
  // Adopt existing native environments before downloading them again.
  let ready=false;
  try{await execute(process.execPath,[script('prepare-build-host.mjs'),'--check'],{cwd:workspace,env});ready=true;}catch{}
  if(!ready||previous)await execute(process.execPath,[script('prepare-build-host.mjs')],{cwd:workspace,env});
  await writeFile(stamp,JSON.stringify({fingerprint})+'\n');
 }else await execute(process.execPath,[script('prepare-build-host.mjs'),'--check'],{cwd:workspace,env});
 await execute(process.execPath,[script('release-desktop.mjs'),...(reuseAnalysis?['--reuse-analysis']:[])],{cwd:workspace,env});
 console.log('Desktop-Build abgeschlossen: '+target.platform+'/'+process.arch+' · '+plan.version);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 readFile(join(workspace,'build-target.json'),'utf8').then(JSON.parse).then(({target,options})=>buildWorkspace(workspace,target,options)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
