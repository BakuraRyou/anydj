import {lightFootprint} from './dmx-light-geometry.js';
const clamp=v=>Math.max(0,Math.min(1,v));
// Preview composition after routing: never alter a safe target, open a shutter,
// or compensate a blackout. Only accompanying beams yield to the lead figure.
export function sceneReadability(lights){
 if(!lights.some(l=>['auto','show'].includes(l.motionPresentation)))return lights;
 const entries=lights.filter(l=>l.power>0&&l.target&&l.position&&['moving','spot','bar'].includes(l.type)).map(light=>{
  const f=lightFootprint(light);
  return {light,radius:Math.max(.2,Math.min(4,f.radius*Math.sqrt(f.stretch))),surface:light.wallIndex>=0?'wall:'+light.wallIndex:light.targetSurface||'floor'};
 });
 const buckets=new Map(),cell=8;
 for(const entry of entries){
  const t=entry.light.target,key=entry.surface+':'+Math.floor(t.x/cell)+':'+Math.floor(t.y/cell);
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(entry);
 }
 const values=new Map();
 for(const a of entries){
  let overlap=0,leadOverlap=0;const t=a.light.target,cx=Math.floor(t.x/cell),cy=Math.floor(t.y/cell);
  for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const b of buckets.get(a.surface+':'+x+':'+y)||[]){
   if(a===b)continue;
   const u=b.light.target,r=a.radius+b.radius,d=Math.hypot(t.x-u.x,t.y-u.y,(t.z??0)-(u.z??0));
   if(d>=r)continue;
   const influence=(1-d*d/(r*r))**2*clamp(b.light.power);
   overlap+=influence;leadOverlap+=influence*clamp(b.light.sceneLead??0);
  }
  const lead=clamp(a.light.sceneLead??0),support=a.light.sceneGain<1;
  const spatialGain=support?1-.18*(1-lead)*leadOverlap/(1+leadOverlap):1;
  // A soft knee acts only on crowded receiving surfaces. The source/lens and
  // lead beam retain their intensity; sparse rigs have no exposure penalty.
  const surfaceGain=Math.max(.55,1/Math.sqrt(1+Math.max(0,overlap-3)*.18));
  values.set(a.light,{...a.light,power:a.light.power*spatialGain,surfaceGain,spatialGain,surfaceOverlap:overlap});
 }
 return lights.map(l=>values.get(l)||l);
}
