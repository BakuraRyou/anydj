// Diagnose missing desktop tags and false positives without running a model.
// Desktop structure input uses the real validator/compile path and its schema;
// it is an explicit fixture, not a claim of executing All-In-One inference.
import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {compileShow} from '../public/show-plan.js';
import {inferFeelings,feelingIds,FEELING_PROFILES} from '../public/feeling-tags.js';
const input=resolve(process.argv[2]||'RobbieWilliamsBoddies.mp3'),work=await mkdtemp(join(tmpdir(),'anydj-feeling-repro-'));
const rate=16000,options={arrangement:'auto',mood:'auto',minimum:5,maximum:100};
let result;
const previousSelf=globalThis.self;
globalThis.self={postMessage(value){if(value.plan||value.error)result=value;}};
await import('../public/show-worker.js');
function analyze(channel){
 result=null;self.onmessage({data:{channels:[channel],rate,options}});
 if(result?.error)throw Error(result.error);assert.ok(result?.plan);return result;
}
const summarize=plan=>{
 const analysis=inferFeelings(plan);
 return {sectionEnergy:plan.sections.map(s=>s.energy??null),moodSegments:plan.moods.length,
  moodEnergyRange:[Math.min(...plan.moods.map(m=>m.energy)),Math.max(...plan.moods.map(m=>m.energy))],
  tags:feelingIds({feelingAnalysis:analysis}).map(id=>FEELING_PROFILES[id]),analysis};
};
try{
 const tone=analyze(Float32Array.from({length:20*rate},(_,i)=>.08*Math.sin(2*Math.PI*220*i/rate))).plan;
 assert.ok(feelingIds({feelingAnalysis:inferFeelings(tone)}).includes('wild'),'Reproduction expects the uncorrected false positive');
 const pcm=join(work,'excerpt.pcm');
 await promisify(execFile)('ffmpeg',['-v','error','-ss','30','-t','30','-i',input,'-ac','1','-ar',String(rate),'-f','f32le',pcm]);
 const bytes=await readFile(pcm),channel=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const browser=analyze(channel),duration=channel.length/rate;
 const structure={version:1,source:'all-in-one',duration,segments:browser.plan.sections.map((s,i)=>({start:s.start,end:s.end,label:i%2?'chorus':'verse'}))};
 const desktop=compileShow(browser.windows,duration,options,browser.plan.beatGrid??null,structure);
 assert.deepEqual(desktop.moods,browser.plan.moods);
 assert.ok(feelingIds({feelingAnalysis:inferFeelings(browser.plan)}).length);
 assert.equal(feelingIds({feelingAnalysis:inferFeelings(desktop)}).length,0,'Reproduction expects the uncorrected desktop failure');
 // Diagnostic counterfactual: restore only the measured energy metadata lost
 // when the compiler replaces browser sections with desktop structure sections.
 const energyRestored={...desktop,sections:desktop.sections.map((s,i)=>({...s,energy:browser.plan.sections[i].energy}))};
 assert.deepEqual(inferFeelings(energyRestored),inferFeelings(browser.plan));
 const report={input:basename(input),excerpt:{start:30,duration},desktopStructure:'schema fixture passed through real validation and show compilation; no model inference executed',
  browser:summarize(browser.plan),withDesktopStructure:summarize(desktop),withOnlyMeasuredSectionEnergyRestored:summarize(energyRestored),
  identicalMoodSegments:true,constantTone:{frequencyHz:220,duration:20,rhythm:false,...summarize(tone)},
  causes:['Desktop structure sections have no energy field; the feeling silence guard returns empty scores.','Mood drive uses within-song loudness normalization and tags a sustained tone as driving/wild without rhythm evidence.']};
 const output=new URL('../reports/feeling-analysis-reproduction.json',import.meta.url);await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{globalThis.self=previousSelf;await rm(work,{recursive:true,force:true});}
