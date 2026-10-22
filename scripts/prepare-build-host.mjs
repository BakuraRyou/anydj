import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,access,rm,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const root=resolve(process.env.ANYDJ_BUILD_ENV_ROOT||sourceRoot);
const macIntel=process.platform==='darwin'&&process.arch==='x64';
const run=(file,args)=>new Promise((resolve,reject)=>{
 const child=spawn(file,args,{cwd:root,stdio:'inherit',env:{...process.env,MPLCONFIGDIR:join(root,'.build','matplotlib'),NUMBA_CACHE_DIR:join(root,'.build','numba')}});
 child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${file}: Exit ${code}. Build-Umgebung wurde nicht als bereit markiert.`)));
});
const jobs=[['beat-this','beat-this-requirements.txt','prepare-beat.py',['beat_this','torch','torchaudio','certifi']],['style','style-requirements.lock','prepare-style.py',['numpy','scipy','onnxruntime','certifi']],['structure','structure-requirements.lock','prepare-structure.py',['allin1_infer','demucs_infer','madmom_infer','torch','torchaudio','certifi']]];
try{
 if(process.argv.includes('--help')){console.log('node scripts/prepare-build-host.mjs [--check]\nRichtet native Python-Analyseumgebungen, PyInstaller und lokale Modelle ein.\n--check prüft vorhandene Umgebungen und Modelle ohne Installation. ANYDJ_BUILD_PYTHON wählt den Python-Interpreter.');}
 else{
  if(process.argv.slice(2).some(arg=>arg!=='--check'))throw Error('Unbekannte Option.');
  const check=process.argv.includes('--check');
  await mkdir(join(root,'.build'),{recursive:true});
  await rm(join(root,'.build','build-host-ready.json'),{force:true});
  const crt=join(root,'.build','msvc');let localCRT=false;
  if(process.platform==='win32')try{await access(join(crt,'manifest.json'));localCRT=true;}catch{}
  if(localCRT){
   const script="$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; foreach ($file in Get-ChildItem -LiteralPath '"+crt.replaceAll("'","''")+"' -Filter '*.dll') { $signature=Get-AuthenticodeSignature $file.FullName; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') { throw ('Invalid Microsoft runtime signature: '+$file.Name) } }; Write-Output 'Microsoft runtime signatures verified'";
   await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]);
  }
  for(const [name,requirements,prepare,imports] of jobs){
   const venv=join(root,'.venv-'+name),python=join(venv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
   if(!check){
    await run(process.env.ANYDJ_BUILD_PYTHON||(process.platform==='win32'?'python.exe':'python3'),['-m','venv',venv]);
    if(localCRT){
     await cp(crt,join(venv,'Scripts','msvc'),{recursive:true});
     await writeFile(join(venv,'Lib','site-packages','sitecustomize.py'),"import os\n_anydj_crt_directory = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'Scripts', 'msvc'))\n_anydj_crt_handle = os.add_dll_directory(_anydj_crt_directory)\n");
    }
    await run(python,['-m','pip','install','--upgrade','pip']);
    if(name!=='style')await run(python,['-m','pip','install',...(process.platform==='darwin'?[]:['--index-url','https://download.pytorch.org/whl/cpu']),macIntel?'torch==2.2.2':'torch==2.14.0'+(process.platform==='darwin'?'':'+cpu'),macIntel?'torchaudio==2.2.2':'torchaudio==2.11.0'+(process.platform==='darwin'?'':'+cpu')]);
    await run(python,['-m','pip','install',...(macIntel?['-c',join(sourceRoot,'scripts','mac-intel-constraints.txt')]:[]),'-r',join(sourceRoot,'scripts',macIntel?name+'-mac-intel-requirements.txt':requirements),'pyinstaller==6.22.0']);
    await run(python,[join(sourceRoot,'scripts',prepare),...(name==='structure'?['--download']:[])]);
   }
   const machines=process.arch==='arm64'?['arm64','aarch64']:['x86_64','amd64'];
   await run(python,['-c','import sys, platform; assert sys.platform == '+JSON.stringify(process.platform)+' and platform.machine().lower() in '+JSON.stringify(machines)+', "Python architecture does not match Node"']);
   await run(python,['-c',imports.map(name=>'import '+name).join('; ')+'; import PyInstaller; print("Native environment ready")']);
  }
  await access(join(root,'data','beat-this','final0.ckpt'));
  for(const name of ['discogs-effnet.onnx','metadata.json'])await access(join(root,'data','style',name));
  const manifest=JSON.parse(await readFile(join(root,'data','structure','ready.json'),'utf8'));
  if(manifest.version!==1||manifest.weights?.length<9)throw Error('Strukturmodelle unvollständig.');
  await mkdir(join(root,'.build'),{recursive:true});
  await writeFile(join(root,'.build','build-host-ready.json'),JSON.stringify({platform:process.platform,arch:process.arch,checked:new Date().toISOString()},null,2)+'\n');
  console.log('Native Build-Abhängigkeiten und Modellpfade geprüft.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
