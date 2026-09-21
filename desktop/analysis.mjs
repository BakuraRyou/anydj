import {access,readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {constants} from 'node:fs';
import {BeatAnalysis,runBeatProcess} from '../lib/beat-analysis.mjs';
import {StyleAnalysis} from '../lib/style-analysis.mjs';
import {StructureAnalysis} from '../lib/structure-analysis.mjs';

export async function bundledAnalysis(bundle,userData) {
  const manifest=JSON.parse(await readFile(join(bundle,'manifest.json'),'utf8'));
  if(manifest.version!==1||manifest.platform!==process.platform||manifest.arch!==process.arch)
    throw Error('Das KI-Paket passt nicht zu diesem Betriebssystem. Bitte die passende AnyDj-Version installieren.');
  const executable=name=>join(bundle,'bin',name,name+(process.platform==='win32'?'.exe':''));
  const models=join(bundle,'models'),cache=join(userData,'analysis-cache');
  await mkdir(cache,{recursive:true});
  const env={...process.env,HF_HUB_OFFLINE:'1',HF_HOME:join(models,'structure','huggingface'),
    TORCH_HOME:join(models,'structure','torch'),MPLCONFIGDIR:join(cache,'matplotlib'),NUMBA_CACHE_DIR:join(cache,'numba'),
    OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'1',PYTHONUNBUFFERED:'1'};
  delete env.PYTHONHOME;delete env.PYTHONPATH;
  const ready=(name,files)=>async()=>{await access(executable(name),constants.X_OK);for(const file of files)await access(file,constants.R_OK);};
  const beat=join(models,'beat-this','final0.ckpt'),style=join(models,'style','discogs-effnet.onnx'),structure=join(models,'structure');
  const beatReady=ready('beat',[beat]),styleReady=ready('style',[style,join(models,'style','metadata.json')]),structureReady=ready('structure',[join(structure,'ready.json')]);
  await Promise.all([beatReady(),styleReady(),structureReady()]);
  return {
    beatAnalysis:new BeatAnalysis({checkpoint:beat,device:'cpu',ready:beatReady,
      run:(pcm,options)=>runBeatProcess(pcm,{...options,executable:executable('beat'),env})}),
    styleAnalysis:new StyleAnalysis({checkpoint:style,ready:styleReady,
      run:(pcm,options)=>runBeatProcess(pcm,{...options,executable:executable('style'),env,label:'Discogs-EffNet'})}),
    structureAnalysis:new StructureAnalysis({cacheDir:structure,ready:structureReady,
      run:(workDir,{signal})=>runBeatProcess(Buffer.alloc(0),{executable:executable('structure'),checkpoint:join(structure,'ready.json'),device:'cpu',
        signal,env,extraArgs:['--work-dir',workDir],label:'All-In-One'})})
  };
}
