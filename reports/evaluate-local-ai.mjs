// Standalone feasibility check; never sends commands to lamps.
// node reports/evaluate-local-ai.mjs [--infer]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AudioAnalysis } from '../public/audio-analysis.js';
import { SpectralAnalysis, spectralFlux } from '../public/spectral-analysis.js';
import { pitchCandidates, trackMelody } from '../public/melody-analysis.js';
import { compileShow } from '../public/show-plan.js';
import { validateCues } from '../public/editor-model.js';
import { settings } from '../lib/music.mjs';

const output = new URL('./local-ai-evaluation.json', import.meta.url);
if (!process.argv.includes('--infer') && !process.argv.includes('--bounded')) {
  const file = new URL('../RobbieWilliamsBoddies.mp3', import.meta.url);
  const decoded = spawnSync('ffmpeg', ['-v','error','-i',file.pathname,'-f','f32le','-ar','16000','-ac','2','pipe:1'], {maxBuffer: 200 * 1024 * 1024});
  if (decoded.status !== 0) throw Error(decoded.stderr?.toString() || 'ffmpeg failed');
  const started = performance.now();
  const count = decoded.stdout.length / 8;
  const channels = [new Float32Array(count), new Float32Array(count)];
  for (let i=0;i<count;i++) for(let c=0;c<2;c++) channels[c][i]=decoded.stdout.readFloatLE(i*8+c*4);
  const windows=[], analysis=new AudioAnalysis(16000,l=>windows.push(l));
  for(let i=0;i<count;i++) analysis.pushFrame(channels,i);
  const spectrum=new SpectralAnalysis(16000,4096), features=[];
  let previous;
  for(let i=0;i<windows.length;i+=4) {
    const feature=spectrum.at(channels,Math.round((i+2)*16000*.02));
    feature.flux=spectralFlux(previous,feature);previous=feature;
    features.push({...feature,pitches:pitchCandidates(spectrum.power,16000,spectrum.size)});
    for(let j=i;j<Math.min(i+4,windows.length);j++)Object.assign(windows[j],feature);
  }
  const melody=trackMelody(features);
  for(let i=0;i<windows.length;i++) {
    const point=melody[Math.floor(i/4)];windows[i].leadMidi=point.midi;windows[i].leadConfidence=point.confidence;
  }
  const plan=compileShow(windows,count/16000,settings());
  // Select at most 12 actual heuristic section boundaries across the song.
  // These are demonstration anchors, not verified verses or choruses.
  const indices=[...new Set(Array.from({length:Math.min(12,plan.sections.length)},(_,i)=>Math.floor(i*(plan.sections.length-1)/Math.max(1,Math.min(12,plan.sections.length)-1))))];
  const anchors=indices.map((index,id)=>{
    const s=plan.sections[index];return {id,time:s.start,kind:s.kind,motif:s.motif,energy:+s.energy.toFixed(3)};
  });
  const result={date:new Date().toISOString(),audio:{file:'RobbieWilliamsBoddies.mp3',sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),duration:plan.duration},baseline:{analysisSeconds:(performance.now()-started)/1000,beats:plan.beats,sections:plan.sections.length,frames:plan.frames.length,melodyCoverage:plan.score.coverage,anchors},limitations:['FFmpeg decode at 16 kHz; browser decoding may differ slightly.','Anchor selection is a smoke test, not a full arrangement.','No musical ground truth or physical lamp measurement.'],runs:[]};
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} else if (process.argv.includes('--bounded')) {
  const result=JSON.parse(readFileSync(output,'utf8'));
  result.boundedRuns=[];
  const motifIds=[...new Set(result.baseline.anchors.map(a=>String(a.motif)))];
  for(const style of ['calm','dramatic']) {
    const colors=style==='calm'?['#163CFF','#007FCC','#5833EE','#AD44FF']:['#FF3300','#FF7700','#FF0080','#FF1493'];
    const properties=Object.fromEntries(motifIds.map(id=>[id,{type:'string',enum:colors}]));
    const schema={type:'object',additionalProperties:false,required:motifIds,properties};
    const start=performance.now();
    try {
      const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3.5:4b',stream:false,think:false,keep_alive:'2m',format:schema,options:{temperature:0,seed:42,num_ctx:4096,num_predict:500},messages:[{role:'system',content:'Choose a coherent color per musical motif. Return only the required JSON mapping motif IDs to allowed colors. Prefer distinct colors for different motifs. Timing, brightness and transitions are handled by the application.'},{role:'user',content:JSON.stringify({style,colors,anchors:result.baseline.anchors})}]}),signal:AbortSignal.timeout(60000)});
      const data=await response.json();if(!response.ok)throw Error(JSON.stringify(data));
      const mapping=JSON.parse(data.message.content);
      if(Object.keys(mapping).length!==motifIds.length||!motifIds.every(id=>Object.hasOwn(mapping,id)&&colors.includes(mapping[id])))throw Error('Invalid motif mapping');
      // Demonstration compiler: all structural and range constraints are host-owned.
      const cues=validateCues(result.baseline.anchors.map(a=>({time:a.time,color:mapping[String(a.motif)],brightness:style==='calm'?35:65,temp:2700,transition:style==='dramatic'&&a.kind==='Intensiv'?'cut':'smooth'})),result.audio.duration);
      result.boundedRuns.push({style,wallSeconds:(performance.now()-start)/1000,loadSeconds:data.load_duration/1e9,outputTokens:data.eval_count,editorValidationPassed:true,motifMapping:mapping,distinctColors:new Set(Object.values(mapping)).size,cues});
    }catch(error){result.boundedRuns.push({style,wallSeconds:(performance.now()-start)/1000,error:error.message});}
    writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    const {cues,...summary}=result.boundedRuns.at(-1);console.log(JSON.stringify(summary));
  }
} else {
  const result=JSON.parse(readFileSync(output,'utf8'));
  const schema={type:'object',additionalProperties:false,required:['cues'],properties:{cues:{type:'array',minItems:result.baseline.anchors.length,maxItems:result.baseline.anchors.length,items:{type:'object',additionalProperties:false,required:['id','color','brightness','temp','transition'],properties:{id:{type:'integer'},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},brightness:{type:'integer',minimum:5,maximum:75},temp:{type:'integer',minimum:2200,maximum:6500},transition:{type:'string',enum:['smooth','cut']}}}}}};
  const psBefore=await fetch('http://127.0.0.1:11434/api/ps').then(r=>r.json());
  result.loadedModelsBefore=psBefore.models?.map(m=>m.name);
  for(const style of ['calm','dramatic','calm']) {
    const body={model:'qwen3.5:4b',stream:false,think:false,keep_alive:'2m',format:schema,options:{temperature:0,seed:42,num_ctx:4096,num_predict:1800},messages:[{role:'system',content:'Design lighting cues from measured musical features. Return exactly one cue for each supplied anchor id, in input order. Never invent timestamps or song structure. Same motif must use exactly the same color. Brightness is a ceiling on an existing beat envelope, not a new beat. Calm style: all transitions smooth, brightness <=45, blue/violet colors. Dramatic style: brightness >=55, warm red/orange/pink colors; cuts only for Intensiv anchors. Temperature 2700. Output the required JSON only.'},{role:'user',content:JSON.stringify({style,anchors:result.baseline.anchors})}]};
    const start=performance.now();
    try {
      const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
      const data=await response.json();if(!response.ok)throw Error(JSON.stringify(data));
      const content=JSON.parse(data.message.content), cues=content.cues;
      const idsValid=cues.length===result.baseline.anchors.length&&cues.every((c,i)=>c.id===result.baseline.anchors[i].id);
      if(!idsValid)throw Error('Missing, reordered or invented anchor IDs');
      const editorCues=validateCues(cues.map((c,i)=>({...c,time:result.baseline.anchors[i].time})),result.audio.duration);
      const motifs=new Map();let motifConsistent=true;
      for(let i=0;i<cues.length;i++){const m=result.baseline.anchors[i].motif,col=cues[i].color.toLowerCase();if(motifs.has(m)&&motifs.get(m)!==col)motifConsistent=false;motifs.set(m,col);}
      const brightnessValid=cues.every(c=>c.brightness>=5&&c.brightness<=75);
      const styleRulesValid=cues.every((c,i)=>style==='calm'?c.transition==='smooth'&&c.brightness<=45:c.brightness>=55&&(c.transition!=='cut'||result.baseline.anchors[i].kind==='Intensiv'));
      result.runs.push({style,wallSeconds:(performance.now()-start)/1000,loadSeconds:data.load_duration/1e9,promptTokens:data.prompt_eval_count,outputTokens:data.eval_count,tokensPerSecond:data.eval_count/(data.eval_duration/1e9),doneReason:data.done_reason,idsValid,editorValidationPassed:true,brightnessValid,styleRulesValid,motifConsistent,cues:editorCues});
    } catch(error) {result.runs.push({style,wallSeconds:(performance.now()-start)/1000,error:error.message});}
    writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    const {cues,...summary}=result.runs.at(-1);console.log(JSON.stringify(summary));
  }
  const ps=await fetch('http://127.0.0.1:11434/api/ps').then(r=>r.json());
  result.modelRuntime=ps.models?.filter(m=>m.name==='qwen3.5:4b').map(m=>({name:m.name,digest:m.digest,size:m.size,sizeVram:m.size_vram,contextLength:m.context_length}));
  result.repeatedCalmIdentical=result.runs.length===3&&Boolean(result.runs[0].cues)&&Boolean(result.runs[2].cues)&&JSON.stringify(result.runs[0].cues)===JSON.stringify(result.runs[2].cues);
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');
}
