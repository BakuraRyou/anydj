// Short jitter buffer for network scenes. Head/controller tracking remains immediate.
export function createVRPlayback({delay=120}={}){
  let frames=[];
  return {
    push(scene,time){
      if(frames.length&&time-frames.at(-1).time>1000)frames=[];
      frames.push({scene,time});if(frames.length>32)frames.shift();
    },
    sample(now){
      if(!frames.length)return null;
      const latest=frames.at(-1).scene,time=now-delay;
      while(frames.length>2&&frames[1].time<=time)frames.shift();
      const a=frames[0],b=frames[1]||a,t=Math.max(0,Math.min(1,(time-a.time)/Math.max(1,b.time-a.time)));
      const mix=(x,y)=>x+(y-x)*t,old=new Map(a.scene.lights.map(l=>[l.id,l]));
      // Do not interpolate a room edit or changed fixture topology through old geometry.
      const compatible=a.scene.layout.width===b.scene.layout.width&&a.scene.layout.depth===b.scene.layout.depth;
      const scene=compatible?{...b.scene,motion:mix(a.scene.motion||0,b.scene.motion||0),lights:b.scene.lights.map(light=>{
        const prev=old.get(light.id);if(!prev||prev.type!==light.type)return light;
        return {...light,power:mix(prev.power,light.power),target:{x:mix(prev.target.x,light.target.x),y:mix(prev.target.y,light.target.y)}};
      })}:b.scene;
      // Controls use the latest confirmed state, independent of visual buffering.
      return {...scene,transport:latest.transport,controlMessage:latest.controlMessage};
    },
  };
}
