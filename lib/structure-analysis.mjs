import { access, mkdtemp, open, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runBeatProcess } from './beat-analysis.mjs';
import { validateStructure } from '../public/song-structure.js';
import { AppError } from './wiz.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const STRUCTURE_RATE=44100*2*2; // stereo signed PCM16, little endian
export const MAX_STRUCTURE_BYTES=STRUCTURE_RATE*900;
export async function runStructure(workDir,{python,cacheDir,signal}) {
  return runBeatProcess(Buffer.alloc(0),{python,checkpoint:join(cacheDir,'ready.json'),device:'cpu',signal,
    script:join(root,'scripts/song-structure.py'),extraArgs:['--work-dir',workDir],label:'All-In-One',
    env:{...process.env,HF_HUB_OFFLINE:'1',HF_HOME:join(cacheDir,'huggingface'),TORCH_HOME:join(cacheDir,'torch'),MPLCONFIGDIR:join(cacheDir,'matplotlib'),NUMBA_CACHE_DIR:join(cacheDir,'numba'),PYTHONUNBUFFERED:'1'}});
}
export class StructureAnalysis {
  constructor({python=join(root,'.venv-structure/bin/python'),cacheDir=join(root,'data/structure'),run=runStructure,ready}={}) {
    Object.assign(this,{python,cacheDir,run});this.active=null;this.cache=new Map();
    this.ready=ready||(()=>Promise.all([access(python,constants.X_OK),access(join(cacheDir,'ready.json'),constants.R_OK)]));
  }
  async status(){try{await this.ready();return {available:true,busy:Boolean(this.active),experimental:true};}catch{return {available:false,busy:Boolean(this.active),message:'All-In-One ist noch nicht eingerichtet.'};}}
  async handle(req,res) {
    if(this.active)throw new AppError('Die Songstruktur-Analyse ist bereits belegt. Bitte später erneut versuchen.',409);
    if((req.headers['content-type']||'').split(';')[0]!=='application/octet-stream')throw new AppError('Stereo-PCM erwartet.',415);
    const declared=req.headers['content-length'];
    if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX_STRUCTURE_BYTES))throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);
    const controller=new AbortController();this.active=controller;
    const disconnected=()=>{if(!res.writableEnded)controller.abort(new AppError('Analyse abgebrochen.',499));};
    const abortUpload=()=>{if(!req.complete)req.destroy();};
    res.once('close',disconnected);controller.signal.addEventListener('abort',abortUpload);
    let workDir,file;
    try{
      if(!(await this.status()).available)throw new AppError('All-In-One ist noch nicht eingerichtet.',503);
      controller.signal.throwIfAborted();
      workDir=await mkdtemp(join(tmpdir(),'wiz-structure-'));file=await open(join(workDir,'input.pcm'),'wx',0o600);
      let size=0;const hash=createHash('sha256');hash.update('all-in-one-infer-3.1.0/harmonix-all/htdemucs/44100-stereo/instruments-v2');
      for await(const chunk of req){size+=chunk.length;if(size>MAX_STRUCTURE_BYTES)throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);hash.update(chunk);await file.writeFile(chunk);}
      await file.close();file=null;controller.signal.throwIfAborted();
      if(size<STRUCTURE_RATE*5||size%4)throw new AppError('Für den Songaufbau werden 5 Sekunden bis 15 Minuten Audio benötigt.',400);
      const duration=size/STRUCTURE_RATE,key=hash.digest('hex');
      if(this.cache.has(key))return {...this.cache.get(key),cached:true};
      const result=await this.run(workDir,{python:this.python,cacheDir:this.cacheDir,signal:controller.signal});
      controller.signal.throwIfAborted();
      let structure;try{structure=validateStructure(result,duration);}catch{throw new AppError('Ungültige Songstruktur aus dem Modell.',502);}
      this.cache.set(key,structure);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);
      return {...structure,cached:false};
    } finally {
      res.removeListener('close',disconnected);controller.signal.removeEventListener('abort',abortUpload);
      try{await file?.close();if(workDir)await rm(workDir,{recursive:true,force:true});}
      finally{if(this.active===controller)this.active=null;}
    }
  }
  close(){this.active?.abort(new AppError('Server beendet.',503));this.cache.clear();}
}
