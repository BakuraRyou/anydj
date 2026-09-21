// Real CPU benchmark: no warm result cache, no lamp commands. Supply local files.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {BeatAnalysis} from '../lib/beat-analysis.mjs';
import {StyleAnalysis} from '../lib/style-analysis.mjs';
import {StructureAnalysis} from '../lib/structure-analysis.mjs';
import {validateStructure} from '../public/song-structure.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {compileShow} from '../public/show-plan.js';
const exec=promisify(execFile),results=[];
const options={arrangement:'auto',mood:'auto',minimum:5,maximum:75,palette:'sunset',saturation:100,toneFollow:.8,smoothing:.5,speed:1,intensity:1,dynamics:'balanced'};
let rendered;
globalThis.self={postMessage:data=>{if(data.error)throw Error(data.error);if(data.plan)rendered=data;}};
await import('../public/show-worker.js');
for(const file of process.argv.slice(2)){
 const work=await mkdtemp(join(tmpdir(),'wiz-instrument-benchmark-')),started=performance.now();
 try{
  await exec('ffmpeg',['-v','error','-i',file,'-ar','44100','-ac','2','-f','s16le',join(work,'input.pcm')]);
  await exec('ffmpeg',['-v','error','-i',file,'-ar','16000','-ac','1','-f','f32le',join(work,'mono.pcm')]);
  const pcm=await readFile(join(work,'mono.pcm')),duration=pcm.length/64000;
  const beat=new BeatAnalysis(),style=new StyleAnalysis(),structure=new StructureAnalysis();
  const baseStart=performance.now();
  const grid=await beat.run(pcm,{...beat,signal:AbortSignal.timeout(Math.min(180000,Math.round(duration*500)))});
  const musicStyle=await style.run(pcm,{...style,signal:AbortSignal.timeout(Math.min(180000,Math.round(duration*300)))});
  const channels=[new Float32Array(pcm.buffer.slice(pcm.byteOffset,pcm.byteOffset+pcm.byteLength))];
  self.onmessage({data:{channels,rate:16000,options,beatGrid:grid,musicStyle}});
  const baseSeconds=(performance.now()-baseStart)/1000;
  const budget=Math.floor(Math.min(180000,duration*750,duration*850-(performance.now()-started)));
  const modelStart=performance.now();
  const raw=await structure.run(work,{...structure,signal:AbortSignal.timeout(Math.max(1,budget))});
  const refined=validateStructure(raw,duration);
  const plan=compileShow(rendered.windows,duration,options,grid,refined,musicStyle);
  const old=compileShow(rendered.windows,duration,options,grid,{...refined,instruments:undefined},musicStyle);
  const disco=applyShowProfile(plan,'disco');
  await writeFile('/tmp/anydj-section-'+basename(file)+'.json',JSON.stringify({duration,plan,old:plan.choreographyBaseFrames,auto:plan.frames,disco:disco.frames,events:disco.colorEvents}));
  const entry={automaticColorEvents:plan.colorEvents.length,discoColorEvents:disco.colorEvents.length,file:basename(file),duration,baseSeconds,refinementSeconds:(performance.now()-modelStart)/1000,totalSeconds:(performance.now()-started)/1000,budgetSeconds:budget/1000,
   envelopeFrames:refined.instruments.drums.length,sections:plan.arrangement.passages.map(s=>({start:s.start,end:s.end,label:s.label,role:s.role,look:s.look,intensity:s.intensity,colorEvents:disco.colorEvents.filter(e=>e.time>=s.start&&e.time<s.end).length})),
   accentsBefore:old.arrangement.times.length,accentsAfter:plan.arrangement.times.length};
  entry.fasterThanSong=entry.totalSeconds<duration;results.push(entry);console.log(JSON.stringify(entry));
 }catch(error){results.push({file:basename(file),error:error.message,elapsedSeconds:(performance.now()-started)/1000});console.error(error);}
 finally{await rm(work,{recursive:true,force:true});}
 await writeFile(new URL('../reports/section-contrast-benchmark.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
}
if(!results.length||results.some(r=>r.error||!r.fasterThanSong))process.exitCode=1;
