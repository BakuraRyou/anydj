import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { AppError } from './wiz.mjs';
import { runBeatProcess, MAX_PCM_BYTES } from './beat-analysis.mjs';
import { validateMusicStyle } from '../public/music-style.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export const runStyleProcess=(pcm,options)=>runBeatProcess(pcm,{...options,script:join(root,'scripts/music-style.py'),label:'Discogs-EffNet',env:{...process.env,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'1'}});
export class StyleAnalysis {
  constructor({python=join(root,'.venv-style/bin/python'),
    checkpoint=join(root,'data/style/discogs-effnet.onnx'),
    device='cpu',run=runStyleProcess,ready,timeoutMs=180000}={}) {
    this.python=python;this.checkpoint=checkpoint;this.device=device;this.run=run;this.timeoutMs=timeoutMs;
    this.ready=ready||(()=>Promise.all([access(python,constants.X_OK),access(checkpoint,constants.R_OK),access(join(dirname(checkpoint),'metadata.json'),constants.R_OK)]));
    this.cache=new Map();this.active=null;
  }
  async status() {
    try{await this.ready();return {available:true,model:'discogs-effnet',device:this.device,busy:Boolean(this.active)};}
    catch{return {available:false,model:'discogs-effnet',busy:Boolean(this.active),message:'Stilerkennung ist noch nicht installiert. Standard-Analyse bleibt verfügbar.'};}
  }
  async handle(req,res) {
    if(this.active)throw new AppError('Stilerkennung analysiert bereits ein Lied. Bitte danach erneut versuchen.',409);
    if((req.headers['content-type']||'').split(';')[0]!=='application/octet-stream')throw new AppError('PCM-Audiodaten erwartet.',415);
    const declared=req.headers['content-length'];
    if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX_PCM_BYTES))throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);
    const controller=new AbortController();this.active=controller;
    const timer=setTimeout(()=>controller.abort(new AppError('Stilanalyse dauerte zu lange. Erneut versuchen.',504)),this.timeoutMs);
    const disconnected=()=>{if(!res.writableEnded)controller.abort(new AppError('Stilanalyse abgebrochen.',499));};
    const abortUpload=()=>{if(!req.complete)req.destroy();};
    res.once('close',disconnected);controller.signal.addEventListener('abort',abortUpload);
    try {
      if(!(await this.status()).available)throw new AppError('Stilerkennung ist nicht installiert. Bitte die Installation ausführen.',503);
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>MAX_PCM_BYTES)throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);chunks.push(chunk);}
      controller.signal.throwIfAborted();
      if(size<64000||size%4)throw new AppError('Ungültige PCM-Länge.',400);
      const pcm=Buffer.concat(chunks),duration=size/64000;
      for(let i=0;i<size;i+=4){const v=pcm.readFloatLE(i);if(!Number.isFinite(v)||Math.abs(v)>4)throw new AppError('Ungültige PCM-Werte.',400);}
      const key=createHash('sha256').update(pcm).digest('hex');
      if(this.cache.has(key))return {...this.cache.get(key),cached:true};
      const result=await this.run(pcm,{python:this.python,checkpoint:this.checkpoint,device:this.device,signal:controller.signal});
      controller.signal.throwIfAborted();
      let style;
      try{style=validateMusicStyle(result,duration);}catch{throw new AppError('Ungültige Stilanalyse.',502);}
      const safe={...style,elapsedSeconds:Number.isFinite(result.elapsedSeconds)?result.elapsedSeconds:undefined};
      this.cache.set(key,safe);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);
      return {...safe,cached:false};
    } finally {
      clearTimeout(timer);res.removeListener('close',disconnected);controller.signal.removeEventListener('abort',abortUpload);
      if(this.active===controller)this.active=null;
    }
  }
  close(){this.active?.abort(new AppError('Server beendet.',503));this.cache.clear();}
}
