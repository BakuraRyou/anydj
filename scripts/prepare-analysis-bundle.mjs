import {spawn} from 'node:child_process';
import {cp,mkdir,rm,writeFile,access} from 'node:fs/promises';
import {join,resolve,dirname,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readRuntimeFiles,stageRuntime} from './windows-runtime.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'.build','analysis',`${process.platform}-${process.arch}`);
let windowsRuntime;
if(process.platform==='win32'){
 windowsRuntime=join(root,'.build','msvc');
 try{await access(join(windowsRuntime,'manifest.json'));}catch(error){if(error.code!=='ENOENT')throw error;windowsRuntime=join(root,'.venv-beat-this','Scripts','msvc');}
 await readRuntimeFiles(windowsRuntime);
}
const jobs=[
  {name:'beat',venv:'.venv-beat-this',script:'beat-this.py',packages:['beat_this','einops','rotary_embedding_torch']},
  {name:'style',venv:'.venv-style',script:'music-style.py',packages:['scipy','onnxruntime']},
  {name:'structure',venv:'.venv-structure',script:'song-structure.py',packages:['allin1_infer','demucs_infer','madmom_infer','hydra','omegaconf','librosa','lazy_loader']}
];
const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,...(process.platform==='win32'?{PATH:join(dirname(command),'msvc')+delimiter+process.env.PATH}:{}),PYINSTALLER_CONFIG_DIR:join(root,'.build','pyinstaller-cache'),MPLCONFIGDIR:join(root,'.build','matplotlib'),NUMBA_CACHE_DIR:join(root,'.build','numba'),HF_HUB_OFFLINE:'1'}});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${command} beendet mit ${code}`)));
});
await mkdir(output,{recursive:true});
await rm(join(output,'manifest.json'),{force:true});
for(const job of jobs){
  const python=join(root,job.venv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
  await access(python).catch(()=>{throw Error(`Build-Umgebung fehlt: ${python}. Analyse-Abhängigkeiten zuerst auf dem Build-Rechner installieren.`);});
  await run(python,['-m','PyInstaller','--noconfirm','--onedir','--name',job.name,
    '--distpath',join(output,'bin'),'--workpath',join(root,'.build','freeze',job.name),'--specpath',join(root,'.build','spec'),
    '--additional-hooks-dir',join(root,'desktop','hooks'),
    ...job.packages.flatMap(name=>['--collect-all',name]),
    join(root,'scripts',job.script)]);
}
for(const name of ['beat-this','style','structure']){
  await cp(join(root,'data',name),join(output,'models',name),{recursive:true,dereference:true,
    filter:source=>!['numba','matplotlib','.locks','__pycache__'].includes(source.split(/[\\/]/).at(-1))});
}
// Keep a consistent current CRT beside each frozen Python runtime. PyInstaller
// may otherwise collect older DLLs which import Torch successfully only on the
// developer machine, or fail c10.dll initialization (WinError 1114).
if(windowsRuntime)await stageRuntime(windowsRuntime,jobs.map(job=>join(output,'bin',job.name,'_internal')));
await writeFile(join(output,'manifest.json'),JSON.stringify({version:1,platform:process.platform,arch:process.arch,glibc:process.report.getReport().header.glibcVersionRuntime||null,created:new Date().toISOString()},null,2));
console.log(`Analysepaket erstellt: ${resolve(output)}`);
