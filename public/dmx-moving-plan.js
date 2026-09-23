import {stageMotionAt} from './stage-motion.js';
import {movingMood} from './dmx-moving-moods.js';
import {beatPosition} from './dmx-show.js';
import {stageAccentStrength} from './stage-motifs.js';
import {movingHeadTargets,advanceMovingHeads,restingHeads} from './dmx-moving-model.js';
import {movingCues,movingCueAt} from './dmx-moving-cues.js';

export const MOVING_STEP=.05;
const modes=mode=>['wash','follow','alternate'].includes(mode)?mode:'auto';
const blend=(a,b,t)=>a.map((pose,i)=>({pan:pose.pan+(b[i].pan-pose.pan)*t,tilt:pose.tilt+(b[i].tilt-pose.tilt)*t}));
// A bounded cooperative job: no audio decoding and no full-song work in a frame.
export function movingPlanJob(plan,mode='auto',mood='balanced'){
  mood=movingMood(mood);
  if(!Number.isFinite(plan?.duration)||plan.duration<=0)throw Error('Songdauer fehlt.');
  // Bound long recordings to about 2 MiB per choreography.
  const step=Math.max(MOVING_STEP,plan.duration/65535),count=Math.ceil(plan.duration/step)+1;
  const values=new Float32Array(count*8),sections=plan.sections||[],grid=plan.beatGrid?.beats||plan.beatTiming?.times;
  let index=0,sectionIndex=0,pose=restingHeads();
  const starts=sections.map(s=>beatPosition(grid,s.start));
  let cues;
  function target(section,k,time){
    const beat=beatPosition(grid,time),start=starts[k];
    const source={motionCharacter:mood==='balanced'?stageMotionAt(plan,time):null,movingMood:mood,frame:{state:true,dimming:100},weight:1,beat,
      motionBeat:beat!==null&&start!==null&&start!==undefined?beat-start:null,
      look:section?.look,sectionProgress:section?(time-section.start)/Math.max(.001,section.end-section.start):0,
      accentStrength:stageAccentStrength(plan,time)};
    const result=movingHeadTargets([source],modes(mode))||restingHeads();
    if(beat===null)return result;
    // Outside pair covers the room; inside pair stays near the stage centre.
    // Their different depths and mirrored axes make each head serve a role.
    return result.map((p,i)=>({pan:p.pan*(i===0||i===3?1:.55),tilt:Math.max(.55,Math.min(1.15,p.tilt+((i===0||i===3) ? .04 : -.08)))}));
  }
  return {
    result:{version:4,duration:plan.duration,step,values,mode:modes(mode),mood},
    get done(){return index===count;},
    advance(samples=128){
      if(cues===undefined)cues=movingCues(plan,modes(mode),mood);
      const end=Math.min(count,index+samples);
      for(;index<end;index++){
        const time=Math.min(plan.duration,index*step);
        if(cues){
          movingCueAt(cues,time).forEach((p,i)=>{values[index*8+i*2]=p.pan;values[index*8+i*2+1]=p.tilt;});
          continue;
        }
        while(sectionIndex+1<sections.length&&time>=sections[sectionIndex+1].start)sectionIndex++;
        const section=sections[sectionIndex],active=section&&time>=section.start&&time<section.end?section:null;
        let next=target(active,sectionIndex,time);
        const following=sections[sectionIndex+1];
        if(active&&following&&following.start===active.end){
          const lead=Math.min(1,(active.end-active.start)/4),remaining=active.end-time;
          if(remaining<lead){const x=1-remaining/lead;next=blend(next,target(following,sectionIndex+1,time),x*x*(3-2*x));}
        }
        // Bake motor constraints into the timeline, even across section cuts.
        // Substeps also keep long recordings within the same movement limits.
        const substeps=Math.min(8,Math.ceil(step/MOVING_STEP));
        for(let n=0;n<substeps;n++)pose=advanceMovingHeads(pose,next,step/substeps);
        pose.forEach((p,i)=>{values[index*8+i*2]=p.pan;values[index*8+i*2+1]=p.tilt;});
      }
    },
  };
}
export function movingPlanAt(plan,time){
  if(!plan||!Number.isFinite(time))return null;
  const position=Math.max(0,Math.min(plan.duration,time))/plan.step;
  const last=plan.values.length/8-1,lo=Math.min(last,Math.floor(position)),hi=Math.min(last,lo+1),part=position-lo;
  return Array.from({length:4},(_,i)=>{
    const at=key=>plan.values[lo*8+i*2+key]*(1-part)+plan.values[hi*8+i*2+key]*part;
    return {pan:at(0),tilt:at(1)};
  });
}
// Cache belongs to the exact immutable show object. Replacing a show naturally
// invalidates its choreography. No mutation of the stored audio/light plan.
export function createMovingPreparation({schedule=fn=>setTimeout(fn,0),cancel=clearTimeout,onChange=()=>{}}={}){
  let cache=new WeakMap(),queue=[],pending=null,enabled=false,destroyed=false,currentMode='auto',currentMood='balanced';
  const stats=()=>({ready:queue.filter(e=>e.state==='ready').length,total:queue.length,failed:queue.filter(e=>e.state==='failed').length});
  const notify=()=>onChange(stats());
  function tick(){
    pending=null;if(!enabled||destroyed)return;
    const entry=queue.find(e=>e.state==='waiting');if(!entry)return;
    try{
      entry.job??=movingPlanJob(entry.plan,entry.mode,entry.mood);
      entry.job.advance();
      if(entry.job.done){entry.result=entry.job.result;entry.job=null;entry.state='ready';notify();}
    }catch{entry.job=null;entry.state='failed';notify();}
    start();
  }
  function start(){if(enabled&&!destroyed&&pending===null&&queue.some(e=>e.state==='waiting'))pending=schedule(tick);}
  return {
    setEnabled(value){enabled=value;if(!enabled&&pending!==null){cancel(pending);pending=null;}start();},
    prepare(plans,mode='auto',mood='balanced'){
      if(destroyed||!enabled)return;
      currentMode=modes(mode);currentMood=movingMood(mood);
      const key=currentMode+':'+currentMood;
      queue=[...new Set(plans.filter(Boolean))].map(plan=>{
        let variants=cache.get(plan);if(!variants){variants=new Map();cache.set(plan,variants);}
        if(!variants.has(key))variants.set(key,{plan,mode:currentMode,mood:currentMood,state:'waiting',job:null,result:null});
        return variants.get(key);
      });
      notify();start();
    },
    read(plan,time,mode='auto',mood='balanced'){return movingPlanAt(cache.get(plan)?.get(modes(mode)+':'+movingMood(mood))?.result,time);},
    stats,
    destroy(){destroyed=true;enabled=false;if(pending!==null)cancel(pending);pending=null;queue=[];cache=new WeakMap();},
  };
}
