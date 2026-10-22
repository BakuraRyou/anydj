// Offline room replay; never sends device commands.
// node scripts/review-automatic-fast-switches.mjs plan-or-review.json report.json [baseline-activity-module]
// Constant input isolates membership gates. Source-dimmer input also replays the
// saved plan's brightness, but not UI equipment, motor travel or GPU rendering.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {movingPresenceAt} from '../public/dmx-activity.js';
import {applyRoomPlan} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
import {showFrameAt} from '../public/show-plan.js';
const [input,output,baselinePath]=process.argv.slice(2);
if(!input||!output)throw Error('Expected input.json output.json [baseline-activity-module]');
const saved=JSON.parse(readFileSync(input)),plan=saved.plan||saved;
if(plan.showProfile&&plan.showProfile!=='auto')throw Error('Expected Automatic plan');
const baseline=baselinePath?(await import(pathToFileURL(resolve(baselinePath)))).movingPresenceAt:null;
const room=clubStageRoom(),hz=100;
function replay(presenceAt,sourceDimmer){
 let previous,fastTicks=0,maxHeadStep=0,fixtureCount=0;
 const example=[];
 for(let tick=0;tick<plan.duration*hz;tick++){
  const time=tick/hz,section=plan.sections.find(s=>time>=s.start&&time<s.end);
  const frame=sourceDimmer?showFrameAt(plan,time):{state:true,r:255,g:255,b:255,dimming:100};
  const power=frame.state===false?0:frame.dimming/100;
  const presence=presenceAt({movingPlan:plan,songTime:time,movingMood:'balanced',look:section?.look,frame,weight:1,flicker:100});
  const scene={layout:{width:8,depth:6,positions:{}},lights:Array.from({length:4},(_,i)=>({
   id:'head'+i,type:'moving',position:{x:i-1.5,y:4,height:3},target:{x:i-1.5,y:2},
   color:'#ffffff',power,movingPresenceBasePower:power,movingPresence:presence,motionPresentation:'auto'
  }))};
  const levels=applyRoomPlan(scene,room).lights.filter(l=>l.type==='moving').map(l=>l.power);
  fixtureCount=levels.length;
  if(previous){
   const steps=levels.map((v,i)=>Math.abs(v-previous[i]));
   maxHeadStep=Math.max(maxHeadStep,...steps);
   // Count 10 ms sample intervals, not complete flashes or individual heads.
   if(steps.filter(v=>v>.25).length>=8)fastTicks++;
  }
  if(time>=76&&time<=77&&tick%2===0)example.push({time,lit:levels.filter(v=>v>.1).length,totalPower:levels.reduce((a,b)=>a+b,0)});
  previous=levels;
 }
 return {fixtureCount,fastTicks,maxHeadStep,example};
}
const result={duration:plan.duration,sampleHz:hz,threshold:'At least 8 heads change power by >0.25 in one 10 ms sample interval',
 limitations:'Offline preset room; source-dimmer replay excludes saved equipment, RGB output, motor shutters and GPU rendering.',
 current:{constant:replay(movingPresenceAt,false),sourceDimmer:replay(movingPresenceAt,true)},
 ...(baseline?{before:{constant:replay(baseline,false),sourceDimmer:replay(baseline,true)}}:{})};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,(_,v)=>Array.isArray(v)?`(${v.length} samples in report)`:v,2));
