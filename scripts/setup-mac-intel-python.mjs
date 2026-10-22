import {mkdir,writeFile,chmod,symlink,lstat,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

if(process.platform!=='darwin'||process.arch!=='x64')throw Error('Dieses Setup ist für native Intel-Macs.');
if(!process.argv[2])throw Error('Absoluten AnyDj-Buildordner angeben.');
const root=resolve(process.argv[2]),tools=join(root,'tools');await mkdir(tools,{recursive:true});
const archive=join(tools,'uv-0.13.4.tar.gz');
const checksum='7be2dcd316122f4b3e5a0a7889f6248266c14425374e105ff7dc9779184603a6';
const response=await fetch('https://github.com/astral-sh/uv/releases/download/0.13.4/uv-x86_64-apple-darwin.tar.gz');
if(!response.ok)throw Error('uv-Download: HTTP '+response.status);
const body=Buffer.from(await response.arrayBuffer());
if(createHash('sha256').update(body).digest('hex')!==checksum)throw Error('uv-Prüfsumme stimmt nicht.');
await writeFile(archive,body);
const env={...process.env,UV_PYTHON_INSTALL_DIR:join(tools,'python'),UV_PYTHON_BIN_DIR:join(tools,'bin'),UV_CACHE_DIR:join(root,'cache','uv')};
const run=(file,args,capture=false)=>new Promise((accept,reject)=>{
 const child=spawn(file,args,{env,stdio:['ignore',capture?'pipe':'inherit','inherit']});let output='';
 if(capture)child.stdout.on('data',chunk=>output+=chunk);
 child.once('error',reject);child.once('close',code=>code===0?accept(output.trim()):reject(Error(file+': Exit '+code)));
});
await run('/usr/bin/tar',['-xzf',archive,'-C',tools]);
const uv=join(tools,'uv-x86_64-apple-darwin','uv');await chmod(uv,0o755);
await run(uv,['python','install','3.11']);
const python=await run(uv,['python','find','--managed-python','3.11'],true);
await run(python,['-c',"import platform,sys,venv,ssl; assert sys.version_info[:2] == (3,11) and platform.machine() == 'x86_64'; print(sys.executable)"]);
const link=join(tools,'python-intel');
try{const info=await lstat(link);if(!info.isSymbolicLink())throw Error('Python-Ziel ist keine Setup-Verknüpfung.');await unlink(link);}catch(error){if(error.code!=='ENOENT')throw error;}
await symlink(python,link);
await writeFile(join(tools,'python-intel.json'),JSON.stringify({python:link,version:await run(python,['--version'],true),uv:'0.13.4'},null,2)+'\n');
console.log('Intel-Mac Build-Python: '+link);
