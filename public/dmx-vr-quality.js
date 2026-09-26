// Adjust soft haze and peripheral shading only. The room, UI, fixture output,
// timing and central XR framebuffer resolution never change with load.
export function createVRQuality(){
  let previous=null,lastChange=-Infinity,frames=0,missed=0,expensive=0,good=0,level=0;
  const state={level:0,intervalMs:0,budgetMs:0,missedFrames:0};
  return {state,sample(time,frameRate,cpuMs=0){
    const dt=previous===null?0:time-previous;previous=time;
    if(!Number.isFinite(frameRate)||frameRate<30||frameRate>240||dt<=0||dt>250){frames=missed=expensive=good=0;return state;}
    const budget=1000/frameRate;state.intervalMs=dt;state.budgetMs=budget;
    const gap=dt>budget*1.4;
    if(gap){missed++;state.missedFrames+=Math.max(1,Math.round(dt/budget)-1);}
    if(cpuMs>budget*.85)expensive++;
    good=!gap&&cpuMs<budget*.55?good+1:0;
    frames++;
    if(frames>=60&&time-lastChange>=1500){
      if((missed>=8||expensive>=30)&&level<2){level++;lastChange=time;good=0;}
      else if(good>=240&&level>0){level--;lastChange=time;good=0;}
      frames=missed=expensive=0;
    }
    state.level=level;return state;
  },scale(base){return Math.max(Math.min(base,.25),base*Math.pow(.75,level));}};
}
