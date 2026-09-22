import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,readdir,stat,writeFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {platforms,sha256,readDownloads} from './desktop-downloads.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(file,args=[],env={})=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'scripts',file),...args],{cwd:root,stdio:'inherit',env:{...process.env,...env}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${file}: Exit ${code}`)));});
export async function releaseDesktop({reuseAnalysis=false}={}){
 const platform=process.platform;
 if(!platforms[platform]||process.arch!=='x64')throw Error('Vollständige Releases nativ auf Linux x64 oder Windows x64 bauen.');
 if(!reuseAnalysis)await run('prepare-analysis-bundle.mjs');
 const analysis=JSON.parse(await readFile(join(root,'.build','analysis',`${platform}-x64`,'manifest.json'),'utf8'));
 if(analysis.version!==1||analysis.platform!==platform||analysis.arch!=='x64')throw Error('Passendes KI-Paket fehlt.');
 const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 const downloads=join(root,'.build','desktop-downloads');await mkdir(downloads,{recursive:true});
 const work=await mkdtemp(join(root,'.build','desktop-release-'));
 try{
  await run('pack.mjs',[platform==='linux'?'--linux':'--win'],{ANYDJ_DESKTOP_OUTPUT:join(work,'pack')});
  const staged=join(work,`${platform}-x64`);await mkdir(staged);
  const files=[];
  for(const format of platforms[platform]){
   const matches=(await readdir(join(work,'pack'))).filter(n=>n.startsWith(`AnyDj-${version}-`)&&n.endsWith('.'+format));
   if(matches.length!==1)throw Error('Erwarteter Installer fehlt oder ist mehrdeutig: '+format);
   const name=matches[0],file=join(work,'pack',name);const size=(await stat(file)).size;
   files.push({name,size,sha256:await sha256(file)});await rename(file,join(staged,name));
  }
  await writeFile(join(staged,'manifest.json'),JSON.stringify({schema:1,platform,arch:'x64',analysis:true,version,glibc:analysis.glibc||null,files},null,2)+'\n');
  await readDownloads(work,{required:true});
  const target=join(downloads,`${platform}-x64`),backup=join(work,'previous');let previous=false;
  try{await rename(target,backup);previous=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(staged,target);}catch(e){if(previous)await rename(backup,target);throw e;}
  console.log('Vollständiges Desktop-Release vorbereitet: '+target);
 }finally{await rm(work,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.includes('--help'))console.log('npm run release:desktop [-- --reuse-analysis]\nBaut native vollständige Installer und SHA-256-Manifest unter .build/desktop-downloads/<platform>-x64.\n--reuse-analysis verwendet das bereits erstellte KI-Paket. Keine Veröffentlichung.');
 else if(args.some(a=>a!=='--reuse-analysis')){console.error('Unbekannte Release-Option');process.exitCode=1;}
 else releaseDesktop({reuseAnalysis:args.includes('--reuse-analysis')}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
