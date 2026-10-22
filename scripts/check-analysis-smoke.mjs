// Portable, deterministic inference probe; requires no music files or ffmpeg.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {bundledAnalysis} from '../desktop/analysis.mjs';

const bundle=resolve(process.argv[2]||`.build/analysis/${process.platform}-${process.arch}`);
const work=await mkdtemp(join(tmpdir(),'anydj-analysis-smoke-'));
const old={PATH:process.env.PATH,PYTHONHOME:process.env.PYTHONHOME,PYTHONPATH:process.env.PYTHONPATH};
const signal=AbortSignal.timeout(10*60*1000);
const seconds=8;
const sample=time=>.15*Math.sin(2*Math.PI*220*time)+.35*Math.exp(-45*(time%.5))*Math.sin(2*Math.PI*70*time);
try{
 const mono=Buffer.alloc(16000*seconds*4),stereo=Buffer.alloc(44100*seconds*4);
 for(let i=0;i<16000*seconds;i++)mono.writeFloatLE(sample(i/16000),i*4);
 for(let i=0;i<44100*seconds;i++){const value=Math.round(sample(i/44100)*32767);stereo.writeInt16LE(value,i*4);stereo.writeInt16LE(value,i*4+2);}
 await writeFile(join(work,'input.pcm'),stereo);
 // Bundles must run independently of developer Python and PATH programs.
 process.env.PATH=work;process.env.PYTHONHOME=join(work,'missing');process.env.PYTHONPATH=join(work,'missing');
 const engines=await bundledAnalysis(bundle,work);
 for(const [name,engine] of Object.entries(engines)){
  const result=name==='structureAnalysis'?await engine.run(work,{signal}):await engine.run(mono,{signal,checkpoint:engine.checkpoint,device:'cpu'});
  if(!result||result.version!==1||Math.abs(result.duration-seconds)>.1)throw Error('Ungültiges Inferenzergebnis: '+name);
  if(name==='beatAnalysis'&&!Array.isArray(result.beats))throw Error('Beat-Ergebnis fehlt.');
  if(name!=='beatAnalysis'&&!result.segments?.length)throw Error('Analyse-Segmente fehlen: '+name);
  if(name==='structureAnalysis'&&!result.instruments)throw Error('Instrumentanalyse fehlt.');
  console.log('Portable KI-Inferenz geprüft: '+name+' ('+result.source+')');
 }
}finally{
 for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 await rm(work,{recursive:true,force:true});
}
