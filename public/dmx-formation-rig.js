import {catalogFormation} from './dmx-formation-catalog.js';
// Discover wide rows and compact opposing banks from physical mounting gaps.
// IDs, preset names and saved room data do not define a fixture's show role.
export function formationRigRoles(groups,positions){
 const rows=new Map();
 for(const [id,role] of groups){
  if(!rows.has(role.group))rows.set(role.group,[]);
  rows.get(role.group).push({id,role,p:positions[id]});
 }
 const classified=[...rows.values()].map(members=>{
  const sorted=[...members].sort((a,b)=>a.p.x-b.p.x),gaps=sorted.slice(1).map((f,i)=>f.p.x-sorted[i].p.x);
  const ordered=gaps.filter(v=>v>0).sort((a,b)=>a-b),median=ordered[Math.floor(ordered.length/2)]??0;
  const middle=Math.floor(sorted.length/2),centerGap=gaps[middle-1]??0;
  const banks=sorted.length>=8&&median>0&&centerGap>median*4&&centerGap>2;
  return {members,family:banks?'banks':'rows',height:members.reduce((sum,f)=>sum+f.p.height,0)/members.length};
 });
 if(!classified.some(r=>r.family==='banks')||!classified.some(r=>r.family==='rows'))return null;
 const result=new Map();
 for(const family of ['banks','rows']){
  const own=classified.filter(r=>r.family===family).sort((a,b)=>a.height-b.height||a.members[0].role.row-b.members[0].role.row);
  own.forEach((row,index)=>row.members.forEach(f=>result.set(f.id,{family,row:index,groups:own.length})));
 }
 return result;
}
export function formationRigPresence(presence,role){
 if(!presence||!role)return presence;
 if(presence.layers)return {...presence,layers:presence.layers.map(p=>formationRigPresence(p,role))};
 if(presence.groupMotion?.presentation!=='strobe')return presence;
 return {...presence,groupMotion:{...presence.groupMotion,rigFamily:role.family,rigRow:role.row,rigGroups:role.groups}};
}
const planeShapes=new Set(['parallel-lines','horizontal-sheets','vertical-curtain','crossed-sheets','diagonal-plane','opposed-diagonals','rake','split-curtain']);
export function formationRigFixtureRole(family,story){
 if(!family||!story)return null;
 const shape=story.shape??story.theme,leader=catalogFormation(shape)?.family??(planeShapes.has(shape)?'rows':'banks');
 return family===leader?'lead':'frame';
}
