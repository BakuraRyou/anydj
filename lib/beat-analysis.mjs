import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AppError } from './wiz.mjs';
import { validateBeatGrid } from '../public/beat-grid.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export const MAX_PCM_BYTES=16000*900*4;

export function runBeatProcess(pcm,{python,checkpoint,device,signal,script=join(root,'scripts/beat-this.py'),extraArgs=[],env=process.env,label='Beat This!',executable}) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const child=spawn(executable||python,[...(executable?[]:[script]),'--checkpoint',checkpoint,'--device',device,...extraArgs],{stdio:['pipe','pipe','pipe'],env});
    let stdout='',stderr='',failure;
    const abort=()=>{failure=signal.reason;child.kill('SIGKILL');};
    signal.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',chunk=>{
      stdout+=chunk;
      if(stdout.length>512*1024){failure=new AppError('Beat-Ergebnis zu groß.',502);child.kill('SIGKILL');}
    });
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8192);});
    child.on('error',()=>{failure=new AppError(`${label} konnte nicht gestartet werden. Installation prüfen.`,503);});
    child.stdin.on('error',()=>{}); // Process failures are reported by close.
    child.on('close',code=>{
      signal.removeEventListener('abort',abort);
      if(failure){reject(failure);return;}
      if(code!==0){console.error(`${label}:`,stderr);reject(new AppError(`${label} konnte das Lied nicht analysieren. Die bisherige Analyse bleibt verfügbar.`,502));return;}
      try{resolve(JSON.parse(stdout));}catch{reject(new AppError(`Ungültige Antwort von ${label}.`,502));}
    });
    child.stdin.end(pcm);
  });
}

export class BeatAnalysis {
  constructor({python=process.env.WIZ_BEAT_PYTHON||join(root,'.venv-beat-this/bin/python'),
    checkpoint=process.env.WIZ_BEAT_MODEL||join(root,'data/beat-this/final0.ckpt'),
    device=process.env.WIZ_BEAT_DEVICE||'cpu',run=runBeatProcess,ready}={}) {
    this.python=python;this.checkpoint=checkpoint;this.device=device;this.run=run;
    this.ready=ready||(()=>Promise.all([access(python,constants.X_OK),access(checkpoint,constants.R_OK)]));
    this.cache=new Map();this.active=null;
  }
  async status() {
    try{await this.ready();return {available:true,model:'final0',device:this.device,busy:Boolean(this.active)};}
    catch{return {available:false,model:'final0',busy:Boolean(this.active),message:'Beat This! ist noch nicht installiert. Standard-Analyse bleibt verfügbar.'};}
  }
  async handle(req,res) {
    if(this.active)throw new AppError('Beat This! analysiert bereits ein Lied. Bitte danach erneut versuchen.',409);
    if((req.headers['content-type']||'').split(';')[0]!=='application/octet-stream')throw new AppError('PCM-Audiodaten erwartet.',415);
    const declared=req.headers['content-length'];
    if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX_PCM_BYTES))throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);
    const controller=new AbortController();this.active=controller;
    const disconnected=()=>{if(!res.writableEnded)controller.abort(new AppError('Beat-Analyse abgebrochen.',499));};
    const abortUpload=()=>{if(!req.complete)req.destroy();};
    res.once('close',disconnected);controller.signal.addEventListener('abort',abortUpload);
    try {
      if(!(await this.status()).available)throw new AppError('Beat This! ist nicht installiert. Bitte Standard wählen oder die Installation ausführen.',503);
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>MAX_PCM_BYTES)throw new AppError('Audio ist zu groß (maximal 15 Minuten).',413);chunks.push(chunk);}
      controller.signal.throwIfAborted();
      if(size<6400||size%4)throw new AppError('Ungültige PCM-Länge.',400);
      const pcm=Buffer.concat(chunks),duration=size/64000;
      for(let i=0;i<size;i+=4){const v=pcm.readFloatLE(i);if(!Number.isFinite(v)||Math.abs(v)>4)throw new AppError('Ungültige PCM-Werte.',400);}
      const key=createHash('sha256').update(pcm).digest('hex');
      if(this.cache.has(key))return {...this.cache.get(key),cached:true};
      const result=await this.run(pcm,{python:this.python,checkpoint:this.checkpoint,device:this.device,signal:controller.signal});
      controller.signal.throwIfAborted();
      let grid;
      try{grid=validateBeatGrid(result,duration);}catch{throw new AppError('Ungültige Beat-Analyse.',502);}
      const safe={...grid,model:'final0',device:['cpu','cuda'].includes(result.device)?result.device:this.device};
      this.cache.set(key,safe);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);
      return {...safe,cached:false};
    } finally {
      res.removeListener('close',disconnected);controller.signal.removeEventListener('abort',abortUpload);
      if(this.active===controller)this.active=null;
    }
  }
  close(){this.active?.abort(new AppError('Server beendet.',503));this.cache.clear();}
}
