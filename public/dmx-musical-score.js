import {selectGroupScore} from './song-movement-plan.js';
import {lightingSceneAt,lightingScenes} from './dmx-light-scenes.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=x=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
const cache=new WeakMap();
// One musical decision timeline for Automatic and its Strobo interpretation.
// Rendering may fit phases on copies; it must not select another song story.
export function musicalStageScore(plan){
 if(!plan)return [];
 if(!cache.has(plan))cache.set(plan,selectGroupScore(plan,true));
 return cache.get(plan);
}
// Both modes consume the already prepared audio-time brightness curve. Keep
// this recovery identical; neither a wash average nor another onset detector
// may replace its attack/release timing in Strobo.
export function musicalSourceDimming(source){
 const raw=clamp(source.frame?.dimming||0,0,100),plan=source.movingPlan,time=source.songTime;
 if(!raw||source.frame?.state===false||!plan||!Number.isFinite(time))return raw;
 if(plan.sectionLighting?.some(s=>time>=s.start&&time<s.end))return raw;
 const scene=lightingSceneAt(plan,time);if(!scene)return raw;
 const strength=s=>!s||s.kind==='silence'||s.kind==='sculpture'?0:ease((s.energy-.55)/.3);
 const previous=lightingScenes(plan)[scene.index-1],blend=ease((time-scene.start)/.8);
 const intensity=strength(previous)+(strength(scene)-strength(previous))*blend;
 const ceiling=clamp(plan.effectiveOptions?.maximum??plan.beatTiming?.maximum??100,0,100);
 if(raw>=ceiling)return raw;
 const normalized=raw/ceiling;
 const lifted=Math.min(raw*2.5,ceiling*Math.sqrt(normalized));
 return raw+(lifted-raw)*intensity;
}
