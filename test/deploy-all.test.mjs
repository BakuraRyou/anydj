import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseOptions,validateConfig,createSnapshot,excludeSource,remoteCommand,sshArgs,collectDownloads,deployTargets,checkTargets,completeDeployment} from '../scripts/deploy-all.mjs';
import {verifySources,buildWorkspace} from '../scripts/deploy-all-worker.mjs';
import {sha256,platforms} from '../scripts/desktop-downloads.mjs';
import {readRuntimeFiles,stageRuntime} from '../scripts/windows-runtime.mjs';

const config={mac:{host:'erik@mac.local',root:'/Users/erik/AnyDj Build',node:'/opt/homebrew/bin/node'},windows:{host:'erik@windows',root:'C:\\Users\\erik\\AnyDj Build',node:'C:\\Program Files\\nodejs\\node.exe'}};
async function temporary(fn){const root=await mkdtemp(join(tmpdir(),'anydj-deploy-all-'));try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
async function source(root){
 await mkdir(join(root,'scripts'),{recursive:true});
 await writeFile(join(root,'package.json'),JSON.stringify({version:'1.2.3'}));
 await writeFile(join(root,'scripts','new-untracked.mjs'),'export const value=42;');
 for(const name of ['prepare-build-host.mjs','prepare-beat.py','prepare-style.py','prepare-structure.py','beat-this-requirements.txt','style-requirements.lock','structure-requirements.lock'])await writeFile(join(root,'scripts',name),'fixture');
}
async function installers(root,platform='linux',version='1.2.3'){
 const folder=join(root,platform+'-x64');await mkdir(folder,{recursive:true});const files=[];
 for(const format of platforms[platform]){
  const name=`AnyDj-${version}-${platform}-x64.${format}`,path=join(folder,name);await writeFile(path,'installer for '+platform);
  files.push({name,size:(await stat(path)).size,sha256:await sha256(path)});
 }
 await writeFile(join(folder,'manifest.json'),JSON.stringify({schema:1,platform,arch:'x64',analysis:true,version,files}));
 return folder;
}

test('options and paths are explicit; all three targets are required',()=>{
 assert.equal(parseOptions(['--','--sync-only','--config=/tmp/custom.json']).config,'/tmp/custom.json');
 assert.equal(parseOptions(['--reuse-analysis']).reuseAnalysis,true);
 assert.deepEqual(parseOptions(['--target=mac']).targets,['mac']);
 assert.equal(parseOptions(['--publish-only','--ftp-config=/tmp/ftp.json']).ftpConfig,'/tmp/ftp.json');
 assert.equal(parseOptions(['--build-only']).buildOnly,true);
 assert.throws(()=>parseOptions(['--publish-only','--sync-only']));
 assert.throws(()=>parseOptions(['--publish-only','--build-only']));
 for(const args of [['--config'],['--deploy'],['--dry-run','--check']])assert.throws(()=>parseOptions(args));
 const targets=validateConfig(config);assert.deepEqual(targets.map(t=>t.platform),['linux','darwin','win32']);
 assert.equal(targets[1].port,22);
 for(const value of [{}, {...config,mac:{...config.mac,host:'-oProxyCommand=bad'}},{...config,windows:{...config.windows,root:'C:\\Build\\..\\Other'}},{...config,mac:{...config.mac,port:0}},{...config,mac:{...config.mac,node:'/bin/node\nshutdown'}}])assert.throws(()=>validateConfig(value));
 assert.equal(validateConfig({...config,mac:{...config.mac,name:'linux'}})[1].name,'mac');
 assert.throws(()=>validateConfig({...config,linux:{root:'/tmp/project/builds'}},{root:'/tmp/project'}),/\.build/);
});

test('snapshot includes uncommitted files and lockfiles, excludes secrets and native caches, verifies copied bytes',()=>temporary(async root=>{
 const src=join(root,'project'),out=join(root,'snapshot');await source(src);
 await writeFile(join(src,'pnpm-lock.yaml'),'lockfile');
 await writeFile(join(src,'custom-ftp.json'),'private credentials');
 for(const path of ['.env','.aws/access','node_modules/pkg/index.js','data/music.db','.build/huge','builder/windows-vm.json','builder/ftp/config.json','deploy-all.json','song.mp3']){
  await mkdir(join(src,path,'..'),{recursive:true});await writeFile(join(src,path),'private');
 }
 const plan=await createSnapshot(src,out,{excludePaths:[join(src,'custom-ftp.json')]});
 await assert.rejects(readFile(join(out,'custom-ftp.json')),{code:'ENOENT'});
 assert.ok(plan.files.some(f=>f.path==='pnpm-lock.yaml'));assert.ok(plan.files.some(f=>f.path==='scripts/new-untracked.mjs'));
 assert.equal(plan.files.some(f=>f.path.includes('private')),false);
 assert.equal((await verifySources(out)).version,'1.2.3');
 for(const path of ['.env','.aws/access','node_modules/pkg/index.js','data/music.db','.build/huge','builder/windows-vm.json','builder/ftp/config.json','deploy-all.json','song.mp3'])await assert.rejects(readFile(join(out,path)),{code:'ENOENT'});
 await writeFile(join(out,'scripts/new-untracked.mjs'),'changed');await assert.rejects(verifySources(out),/Quellprüfsumme/);
}));

test('symlinks, Windows-invalid names and case collisions fail before transfer',()=>temporary(async root=>{
 for(const type of ['symlink','colon','case']){
  const src=join(root,type);await source(src);
  if(type==='symlink')await symlink('/etc/passwd',join(src,'secret'));
  if(type==='colon')await writeFile(join(src,'bad:name'),'bad');
  if(type==='case'){await writeFile(join(src,'Readme'),'one');await writeFile(join(src,'README'),'two');}
  await assert.rejects(createSnapshot(src,join(root,type+'-out')),/Symlink|portabler|kollidiert/);
 }
 assert.equal(excludeSource('builder/ftp/.env.example'),false);
 assert.equal(excludeSource('deploy-all.example.json'),false);
 assert.equal(excludeSource('web/demo-shows/neon.wav'),false);
}));

test('Windows uses encoded PowerShell and POSIX commands preserve apostrophes/spaces',()=>{
 const [,,windows]=validateConfig(config);
 const command=remoteCommand(windows,"C:\\Users\\O'Brien\\Build Space\\worker.mjs");
 const decoded=Buffer.from(command.split(' ').at(-1),'base64').toString('utf16le');
 assert.match(decoded,/O''Brien/);assert.match(decoded,/exit \$LASTEXITCODE/);
 assert.ok(sshArgs(windows).includes('StrictHostKeyChecking=yes'));assert.ok(sshArgs(windows,true).includes('-P'));
 assert.ok(sshArgs({...windows,identityAgent:'/run/user/1000/gcr/ssh'},true).includes('IdentityAgent=/run/user/1000/gcr/ssh'));
 const mac=remoteCommand(validateConfig(config)[1],"/Users/O'Brien/Build Space/worker.mjs");assert.ok(mac.startsWith('/bin/sh -lc '));
});

test('installer validation preserves previous downloads on corruption or version mismatch',()=>temporary(async root=>{
 const old=join(root,'old'),incoming=join(root,'incoming');await installers(old,'linux','1.0.0');
 const folder=await installers(incoming);await assert.rejects(collectDownloads(incoming,old,'linux','9.9.9'),/Build-Auftrag/);
 assert.equal(JSON.parse(await readFile(join(old,'linux-x64','manifest.json'),'utf8')).version,'1.0.0');
 const file=(await readdir(folder)).find(name=>name.endsWith('.deb'));await writeFile(join(folder,file),'corrupt');
 await assert.rejects(collectDownloads(incoming,old,'linux','1.2.3'),/SHA-256/);
 await installers(incoming);await collectDownloads(incoming,old,'linux','1.2.3');
 assert.equal(JSON.parse(await readFile(join(old,'linux-x64','manifest.json'),'utf8')).version,'1.2.3');
}));

test('native worker installs frozen dependencies, provisions caches and builds full releases',()=>temporary(async root=>{
 const src=join(root,'project'),work=join(root,'workspace');await source(src);await createSnapshot(src,work);
 const calls=[];let firstCheck=true;
 await buildWorkspace(work,{platform:process.platform,root:join(root,'cache-root'),pnpm:'/tools/pnpm',unsigned:true},{execute:async(file,args,options)=>{
  calls.push([file,args]);assert.equal(options.env.CSC_IDENTITY_AUTO_DISCOVERY,'false');
  assert.equal(options.env.ANYDJ_BUILD_ENV_ROOT,join(root,'cache-root','cache'));
  if(args[0]?.endsWith('prepare-build-host.mjs')&&args[1]==='--check'&&firstCheck){firstCheck=false;throw Error('not ready');}
 }});
 assert.deepEqual(calls[0],['/tools/pnpm',['install','--frozen-lockfile']]);
 assert.ok(calls.some(([,args])=>args[0]?.endsWith('prepare-build-host.mjs')&&args.length===1));
 const last=calls.at(-1)[1];assert.ok(last[0].endsWith('release-desktop.mjs'));assert.equal(last.includes('--lite'),false);assert.equal(last.includes('--reuse-analysis'),false);
 assert.ok((await stat(join(work,'data'))).isDirectory());
}));

test('sync-only verifies sources without installing dependencies or creating caches',()=>temporary(async root=>{
 const src=join(root,'project'),work=join(root,'workspace');await source(src);await createSnapshot(src,work);
 await buildWorkspace(work,{platform:process.platform,root:join(root,'cache-root')},{syncOnly:true,execute:async()=>assert.fail()});
 await assert.rejects(stat(join(root,'cache-root')),{code:'ENOENT'});
 await assert.rejects(buildWorkspace(work,{platform:'invalid'},{syncOnly:true}),/Build-Betriebssystem/);
}));

test('orchestrator transfers the snapshot, collects validated releases and attempts targets after failure',()=>temporary(async root=>{
 const src=join(root,'project'),snapshot=join(root,'snapshot');await source(src);const plan=await createSnapshot(src,snapshot);
 const targets=validateConfig(config,{root});const work=join(root,'work');await mkdir(work);
 const calls=[];
 await deployTargets({targets,snapshot,plan,archive:join(root,'source.tar.gz'),runtimeArchive:join(root,'msvc.tar.gz'),work,options:{},root,execute:async(file,args)=>{
  calls.push([file,args]);
  if(file===process.execPath)await installers(join(targets[0].root,'runs',plan.job,'source','.build','desktop-downloads'));
  if(file==='scp'&&args.includes('-r')){
   const platform=args.some(a=>a.includes('mac.local:'))?'darwin':'win32';
   await installers(join(args.at(-1),'desktop-downloads'),platform);
  }
 }});
 for(const platform of ['linux','darwin','win32'])assert.ok((await stat(join(root,'.build','desktop-downloads',platform+'-x64','manifest.json'))).isFile());
 assert.equal(calls.filter(([file,args])=>file==='scp'&&!args.includes('-r')).length,3);
 let windowsAttempted=false;
 await assert.rejects(deployTargets({targets:targets.slice(1),snapshot,plan,archive:'/tmp/source.tar.gz',work,options:{syncOnly:true},root,execute:async(file,args)=>{
  if(file==='ssh'&&args.includes('erik@mac.local'))throw Error('Mac unavailable');
  if(file==='ssh'&&args.includes('erik@windows'))windowsAttempted=true;
 }}),/Mac unavailable/);
 assert.equal(windowsAttempted,true);
}));

test('Windows runtime staging validates every DLL before replacing bundled files',()=>temporary(async root=>{
 const src=join(root,'crt'),out=join(root,'output');await mkdir(src);const files=[];
 for(const name of ['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll']){
  const file=join(src,name);await writeFile(file,'signed fixture bytes');files.push({name,size:(await stat(file)).size,sha256:await sha256(file)});
 }
 await writeFile(join(src,'manifest.json'),JSON.stringify({schema:1,files}));
 assert.equal((await readRuntimeFiles(src)).files.length,3);
 await stageRuntime(src,[out]);assert.equal(await readFile(join(out,'msvcp140.dll'),'utf8'),'signed fixture bytes');
 await writeFile(join(src,'msvcp140.dll'),'corrupt');
 await assert.rejects(stageRuntime(src,[out]),/Prüfsumme/);
 assert.equal(await readFile(join(out,'msvcp140.dll'),'utf8'),'signed fixture bytes');
}));

test('preflight checks every target even when an SSH target fails',async()=>{
 const called=[];
 await assert.rejects(checkTargets(validateConfig(config),{execute:async(file,args)=>{called.push(file);if(file==='ssh')throw Error('connection refused');}}),/mac.*connection refused[\s\S]*windows.*connection refused/);
 assert.equal(called.filter(file=>file==='ssh').length,2);
});

test('publishes once after successful builds, and never after build or installer validation failures',()=>temporary(async root=>{
 const downloadsRoot=join(root,'.build','desktop-downloads');
 for(const platform of ['linux','darwin','win32'])await installers(downloadsRoot,platform);
 const events=[],targets=validateConfig(config,{root});
 const execute=async(file,args)=>{events.push('publish');assert.ok(args.includes('--skip-desktop-build'));assert.deepEqual(args.slice(-2),['--config','/tmp/ftp.json']);};
 const base={root,targets,version:'1.2.3',options:{ftpConfig:'/tmp/ftp.json'},execute};
 await completeDeployment({...base,build:async()=>events.push('build')});assert.deepEqual(events,['build','publish']);
 events.length=0;
 await assert.rejects(completeDeployment({...base,build:async()=>{throw Error('Mac failed');}}),/Mac failed/);assert.deepEqual(events,[]);
 await assert.rejects(completeDeployment({...base,version:'9.9.9',build:async()=>{}}),/Installer-Version/);assert.deepEqual(events,[]);
 await writeFile(join(downloadsRoot,'win32-x64','AnyDj-1.2.3-win32-x64.exe'),'corrupt');
 await assert.rejects(completeDeployment({...base,build:async()=>{}}),/SHA-256/);assert.deepEqual(events,[]);
}));

test('build-only and sync-only never publish; publish-only skips all native builds and supports upload preview',async()=>{
 const events=[],targets=validateConfig(config);
 const base={targets,version:'1.2.3',build:async()=>events.push('build'),downloads:async()=>targets.map(target=>({platform:target.platform,version:'1.2.3'})),execute:async(file,args)=>{events.push('publish');assert.ok(args.includes('--dry-run'));}};
 for(const options of [{buildOnly:true},{syncOnly:true}]){events.length=0;await completeDeployment({...base,options});assert.deepEqual(events,['build']);}
 events.length=0;await completeDeployment({...base,options:{publishOnly:true,dryRun:true}});assert.deepEqual(events,['publish']);
 await assert.rejects(completeDeployment({...base,options:{publishOnly:true},downloads:async()=>[]}),/Installer fehlt/);
});
