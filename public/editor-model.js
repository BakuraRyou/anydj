const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validateCues(value,duration) {
 if(!Array.isArray(value)||!value.length||value.length>500)throw Error('Ein Projekt braucht 1–500 Farbpunkte.');
 const cues=value.map(c=>{
  if(!Number.isFinite(c.time)||c.time<0||c.time>duration||!/^#[0-9a-f]{6}$/i.test(c.color)||!Number.isFinite(c.brightness)||c.brightness<5||c.brightness>100||!Number.isFinite(c.temp)||c.temp<1000||c.temp>10000||!['smooth','cut'].includes(c.transition))throw Error('Ungültiger Farbpunkt.');
  return {time:c.time,color:c.color,brightness:c.brightness,temp:c.temp,transition:c.transition};
 }).sort((a,b)=>a.time-b.time);
 if(cues[0].time!==0||cues.some((c,i)=>i&&c.time-cues[i-1].time<.05))throw Error('Der erste Punkt muss bei 0 liegen. Weitere Punkte brauchen mindestens 0,05 Sekunden Abstand.');
 return cues;
}
export function cueAt(cues,time) {
 let index=0;while(index+1<cues.length&&cues[index+1].time<=time)index++;
 const a=cues[index],b=cues[index+1]??a;
 const f=b===a||b.transition==='cut'?0:clamp((time-a.time)/(b.time-a.time),0,1);
 const rgb=c=>[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16));
 const color=rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*f));
 return {rgb:color,brightness:a.brightness+(b.brightness-a.brightness)*f,temp:Math.round(a.temp+(b.temp-a.temp)*f)};
}
export function editorFrame(cues,time,capabilities,beatFrame=null) {
 const value=cueAt(cues,time),pulse=beatFrame?clamp((beatFrame.dimming-5)/95,0,1):1;
 const params={state:true,dimming:Math.round(5+(value.brightness-5)*pulse)};
 if(capabilities.color===true)[params.r,params.g,params.b]=value.rgb.map(v=>Math.max(1,v));
 else if(capabilities.temperature===true)params.temp=clamp(value.temp,capabilities.minKelvin??2200,capabilities.maxKelvin??6500);
 return params;
}
