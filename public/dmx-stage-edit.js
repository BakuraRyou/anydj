import {cleanLook} from './dmx-show.js';
import {insideRoom} from './dmx-ar-model.js';

// Picking uses CSS pixels, just like stageCamera, independent of render quality.
export function pickStageLight(lights,project,x,y,radius=22){
  let best=null,score=Infinity;
  for(const light of lights){
    if(!['moving','spot','bar'].includes(light.type)||!light.position)continue;
    const p=project([light.position.x,light.position.y,light.position.height]);
    if(p.depth<=.08)continue;
    const distance=Math.hypot(p.x-x,p.y-y);
    if(distance<=radius&&(distance<score||distance===score&&p.depth<best.depth)){best={id:light.id,depth:p.depth};score=distance;}
  }
  return best?.id||null;
}

// Freeze the visible membership and arrangement as individual cues in this phase.
export function reformFixtureCues(phase,target,members,anchor,formation='focus',spread=2,boundary){
  if(!members.length)throw Error('Wähle zuerst ein Gerät oder eine Gruppe.');
  if(!['focus','keep','line','fan'].includes(formation)||!Number.isFinite(spread)||spread<0||spread>60)throw Error('Ungültige Formation.');
  if(!Number.isFinite(anchor?.x)||!Number.isFinite(anchor?.y))throw Error('Ungültiges Lichtziel.');
  const unique=[...new Map(members.map(m=>[m.targetId,m])).values()].sort((a,b)=>a.position.x-b.position.x||a.position.y-b.position.y||a.targetId.localeCompare(b.targetId));
  const center=unique.reduce((s,m)=>({x:s.x+m.target.x/unique.length,y:s.y+m.target.y/unique.length}),{x:0,y:0});
  const cues=structuredClone(phase.fixtures||[]),group=cues.find(c=>c.target===target);
  unique.forEach((member,i)=>{
    const offset=unique.length===1?0:i/(unique.length-1)-.5;
    const aim=formation==='keep'?{x:anchor.x+member.target.x-center.x,y:anchor.y+member.target.y-center.y}:formation==='fan'?{x:anchor.x+Math.sin(offset*Math.PI)*spread/2,y:anchor.y+(1-Math.cos(offset*Math.PI))*spread/2}:{x:anchor.x+(formation==='line'?offset*spread:0),y:anchor.y};
    if(boundary&&!insideRoom([aim.x,aim.y],boundary))throw Error('Die Formation liegt außerhalb des Raums. Wähle ein anderes Ziel oder eine kleinere Breite.');
    let cue=cues.find(c=>c.target===member.targetId);
    if(!cue){cue={target:member.targetId,look:cleanLook(group?.look||{animation:'follow'})};cues.push(cue);}
    cue.aim=aim;
  });
  return cues;
}
