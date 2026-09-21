// Offline CPU benchmark, no result-cache hits or lamp commands.
// Usage: node scripts/benchmark-full-analysis.mjs path/to/song.mp3 [result.json]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {cpus,totalmem,platform,arch,tmpdir,loadavg} from 'node:os';
import {join,basename,resolve} from 'node:path';
import {BeatAnalysis} from '../lib/beat-analysis.mjs';
import {StyleAnalysis} from '../lib/style-analysis.mjs';
import {StructureAnalysis} from '../lib/structure-analysis.mjs';
import {settings} from '../lib/music.mjs';
import {validateBeatGrid} from '../public/beat-grid.js';
import {validateMusicStyle} from '../public/music-style.js';
import {validateStructure} from '../public/song-structure.js';
import {compileShow} from '../public/show-plan.js';

const [input,output='reports/full-analysis-benchmark.json']=process.argv.slice(2);
if(!input)throw Error('Usage: node scripts/benchmark-full-analysis.mjs song.mp3 [result.json]');
const exec=promisify(execFile),work=await mkdtemp(join(tmpdir(),'anydj-full-analysis-'));
const result={date:new Date().toISOString(),file:basename(input),
  hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/2**30,platform:platform(),arch:arch(),loadAtStart:loadavg()},
  method:'CPU; fresh subprocesses; no result cache; installed models; FFmpeg decoding; same show-worker code; excludes browser, HTTP and IndexedDB overhead',stages:{}};
const measure=async(name,fn)=>{const start=performance.now();console.log(`${name}: started`);const value=await fn();result.stages[name]=(performance.now()-start)/1000;console.log(`${name}: ${result.stages[name].toFixed(3)} s`);return value;};
let rendered;
globalThis.self={postMessage:data=>{if(data.error)throw Error(data.error);if(data.plan)rendered=data;}};
await import('../public/show-worker.js');
const started=performance.now(),signal=new AbortController().signal;
try{
  const channels=await measure('decode16kStereo',async()=>{
    await exec('ffmpeg',['-v','error','-i',resolve(input),'-ar','16000','-ac','2','-f','f32le',join(work,'stereo.pcm')]);
    const bytes=await readFile(join(work,'stereo.pcm'));
    const channels=[new Float32Array(bytes.length/8),new Float32Array(bytes.length/8)];
    for(let i=0;i<channels[0].length;i++){channels[0][i]=bytes.readFloatLE(i*8);channels[1][i]=bytes.readFloatLE(i*8+4);}
    return channels;
  });
  const duration=result.durationSeconds=channels[0].length/16000;
  const pcm=await measure('downmix',()=>{
    const pcm=Buffer.alloc(channels[0].length*4);
    for(let i=0;i<channels[0].length;i++)pcm.writeFloatLE((channels[0][i]+channels[1][i])/2,i*4);
    return pcm;
  });
  const beat=new BeatAnalysis({device:'cpu'}),style=new StyleAnalysis(),structure=new StructureAnalysis();
  const grid=await measure('beatThis',async()=>validateBeatGrid(await beat.run(pcm,{...beat,signal}),duration));
  const musicStyle=await measure('discogsEffnet',async()=>validateMusicStyle(await style.run(pcm,{...style,signal}),duration));
  const options=settings({arrangement:'auto',mood:'auto',minimum:5,maximum:100});
  await measure('signalAnalysisAndBaseShow',()=>self.onmessage({data:{channels,rate:16000,options,beatGrid:grid,musicStyle}}));
  result.playableSeconds=(performance.now()-started)/1000;
  await measure('decode44kStereo',()=>exec('ffmpeg',['-v','error','-i',resolve(input),'-ar','44100','-ac','2','-f','s16le',join(work,'input.pcm')]));
  const refined=await measure('allInOneDemucsInstruments',async()=>validateStructure(await structure.run(work,{...structure,signal}),duration));
  const plan=await measure('refinedShow',()=>compileShow(rendered.windows,duration,options,grid,refined,musicStyle));
  result.totalSeconds=(performance.now()-started)/1000;
  result.realTimeFactor=result.totalSeconds/duration;
  result.beats=grid.beats.length;result.sections=plan.sections.length;result.instrumentFrames=refined.instruments.drums.length;
}catch(error){result.error=error.message;result.elapsedSeconds=(performance.now()-started)/1000;process.exitCode=1;}
finally{
  await rm(work,{recursive:true,force:true});
  await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
