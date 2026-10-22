// Replay Automatic's spatial colors without a browser, GPU or lamp connection.
// Usage: node scripts/review-automatic-color-jumps.mjs review.json report.json [colors=2]
import {readFileSync,writeFileSync} from 'node:fs';
import {automaticStage} from '../public/dmx-auto.js';
import {showFrameAt} from '../public/show-plan.js';
import {songPaletteAt} from '../public/song-palette.js';
import {stageMotionAt} from '../public/stage-motion.js';
import {stageAccentStrength} from '../public/stage-motifs.js';

const [input,output,limitArg='2']=process.argv.slice(2),limit=Number(limitArg);
if(!input||!output)throw Error('Expected review.json report.json');
if(![1,2,3,4].includes(limit))throw Error('Expected 1–4 colors.');
const saved=JSON.parse(readFileSync(input)),plan=saved.plan||saved;
if(plan.showProfile&&plan.showProfile!=='auto')throw Error('Use an Automatic plan.');
const hz=50,equipment={devices:Array.from({length:4},(_,i)=>({id:'spot-'+i,type:'spot',cells:1}))};
const jumps=[];let previous;
for(let tick=0;tick<plan.duration*hz;tick++){
  const time=tick/hz,section=plan.sections.find(s=>time>=s.start&&time<s.end);
  const frame=showFrameAt(plan,time),palette=songPaletteAt(plan,time);
  const source={movingPlan:plan,songTime:time,motionCharacter:stageMotionAt(plan,time),frame,palette,weight:1,
    look:section?.look,sectionProgress:(time-section.start)/(section.end-section.start),accentStrength:stageAccentStrength(plan,time)};
  const result=automaticStage([source],limit,equipment,'auto'),frames=result.frames.flat();
  const current={time,frame,palette,frames,look:source.look,colorCount:result.palette.length};
  if(previous){
    const inputStep=Math.hypot(...['r','g','b'].map(k=>frame[k]-previous.frame[k]));
    const colorStep=Math.max(...frames.map((f,i)=>Math.hypot(...['r','g','b'].map(k=>f[k]-previous.frames[i][k]))));
    if(colorStep>=100&&inputStep<=10)jumps.push({time,colorStep,inputStep,
      beforeLook:previous.look,afterLook:current.look,beforeCount:previous.colorCount,afterCount:current.colorCount,
      sourceBefore:previous.frame,sourceAfter:frame,
      colorsBefore:previous.frames.map(f=>[f.r,f.g,f.b]),colorsAfter:frames.map(f=>[f.r,f.g,f.b])});
  }
  previous=current;
}
const report={title:saved.title||'',method:'Deterministic 50 Hz replay of exported plan, four representative spot roles; source palette, motion character and accents. Colors before room routing. No subjective audio assessment, rendered pixels or hardware measurement.',
  duration:plan.duration,planVersion:plan.version,profile:plan.showProfile||'auto',colorLimit:limit,sampleHz:hz,
  structureAvailable:Boolean(plan.structure),sectionCount:plan.sections.length,
  twoSecondSections:plan.sections.filter(s=>s.end-s.start<=2.001).length,
  largeColorJumpsWithNearlyUnchangedSource:jumps.length,jumps};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({jumps:jumps.length,times:jumps.map(j=>j.time),countSwitches:jumps.filter(j=>j.beforeCount!==j.afterCount).length}));
