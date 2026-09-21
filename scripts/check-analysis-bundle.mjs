import {bundledAnalysis} from '../desktop/analysis.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const exec=promisify(execFile),work=await mkdtemp(join(tmpdir(),'anydj-bundle-check-'));
const bundle=resolve(process.argv[2]||`.build/analysis/${process.platform}-${process.arch}`);
const song=resolve(process.argv[3]||'RobbieWilliamsBoddies.mp3');
try {
  await exec('ffmpeg',['-v','error','-y','-i',song,'-t','60','-f','f32le','-ar','16000','-ac','1',join(work,'mono.pcm')]);
  await exec('ffmpeg',['-v','error','-y','-i',song,'-t','60','-f','s16le','-ar','44100','-ac','2',join(work,'input.pcm')]);
  // Freeze bootloaders must run without a system Python or development environment.
  process.env.PATH=work;process.env.PYTHONPATH='/nonexistent';process.env.PYTHONHOME='/nonexistent';
  process.chdir(work);
  const engines=await bundledAnalysis(bundle,work),pcm=await readFile(join(work,'mono.pcm'));
  const results={};
  for(const [name,engine] of Object.entries(engines)){
    const started=performance.now(),signal=new AbortController().signal;
    const result=name==='structureAnalysis'?await engine.run(work,{signal}):await engine.run(pcm,{signal,checkpoint:engine.checkpoint,device:'cpu'});
    if(name==='beatAnalysis'&&result.beats.length<10)throw Error('Beat grid missing');
    if(name==='styleAnalysis'&&!result.segments.length)throw Error('Style segments missing');
    if(name==='structureAnalysis'&&(!result.segments.length||!result.instruments))throw Error('Structure/instruments missing');
    results[name]={seconds:Math.round((performance.now()-started)/100)/10,source:result.source,beats:result.beats?.length,segments:result.segments?.length,instruments:Boolean(result.instruments)};
    console.log(JSON.stringify({[name]:results[name]}));
  }
  console.log(JSON.stringify({portableAnalysis:true,results},null,2));
} finally {await rm(work,{recursive:true,force:true});}
