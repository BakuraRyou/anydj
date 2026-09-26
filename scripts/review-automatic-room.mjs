// Offline analysis of a prepared plan in the 192-fixture room; no lamp commands.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/review-automatic-room.mjs prepared-plan.json');
const {movingCues,movingCueAt}=await import(root+'public/dmx-moving-cues.js');
const {lightingScenes,lightingGestures}=await import(root+'public/dmx-light-scenes.js');
const {movingPresenceAt}=await import(root+'public/dmx-activity.js');
const {showFrameAt}=await import(root+'public/show-plan.js');
const {projectMovingHeads,movingDevicePoses}=await import(root+'public/dmx-layout-model.js');
const {largeClubRoom}=await import(root+'public/dmx-room-presets.js');
const {applyRoomPlan}=await import(root+'public/dmx-ar-model.js');
const plan=JSON.parse(readFileSync(input)),cues=movingCues(plan,'auto','balanced'),scenes=lightingScenes(plan),gestures=lightingGestures(plan),room=largeClubRoom();
const layout={width:8,depth:6,positions:{}},devices=Array.from({length:8},(_,i)=>({id:'h'+i}));
function frame(t){
 const value=showFrameAt(plan,t),power=value.state===false?0:value.dimming/100,color=`rgb(${value.r},${value.g},${value.b})`,presence=movingPresenceAt({movingPlan:plan,songTime:t,movingMood:'balanced'});
 const heads=projectMovingHeads(layout,movingDevicePoses(movingCueAt(cues,t),devices,{formation:'designed',layout}),devices).map(l=>({...l,type:'moving',power,color,motionPresentation:'auto',movingPresence:presence,movingPresenceBasePower:power}));
 const source={layout,crowd:[],lights:[...heads,...['spot','bar'].map((type,i)=>({id:type,type,power,color,position:{x:i,y:4,height:3},target:{x:i,y:2}}))]};
 return applyRoomPlan(source,room);
}
const samples=[];for(let t=0;t<plan.duration;t+=.25){const scene=frame(t),heads=scene.lights.filter(l=>l.type==='moving');samples.push({time:t,pose:movingCueAt(cues,t),active:heads.filter(l=>l.power>.02).length,rows:[...new Set(heads.filter(l=>l.power>.02).map(l=>l.position.y))],power:scene.lights.reduce((s,l)=>s+l.power,0)});}
const r=v=>+v.toFixed(3),span=xs=>r(Math.max(...xs)-Math.min(...xs));
const windows=[];for(let start=0;start<plan.duration;start+=8){const local=samples.filter(s=>s.time>=start&&s.time<start+8),moves=cues.filter(c=>c.time>=start&&c.time<start+8);windows.push({start,end:Math.min(plan.duration,start+8),panSpan:Math.max(...[0,1,2,3].map(i=>span(local.map(s=>s.pose[i].pan)))),tiltSpan:Math.max(...[0,1,2,3].map(i=>span(local.map(s=>s.pose[i].tilt)))),moves:moves.length,forms:[...new Set(moves.map(c=>c.formation).filter(Boolean))],active:[Math.min(...local.map(s=>s.active)),Math.max(...local.map(s=>s.active))],rowSets:[...new Set(local.map(s=>s.rows.join(',')))],power:[r(Math.min(...local.map(s=>s.power))),r(Math.max(...local.map(s=>s.power)))]});}
const changes=[];for(const c of cues)if(c.formation&&c.formation!==changes.at(-1)?.formation)changes.push({time:r(c.time),formation:c.formation});
const report={method:'Fresh local full audio analysis; automatic/balanced profile, minimum 5 maximum 100; actual 192 fixture preset. Eight virtual moving sources, shared RGB static source, no saved user overrides, deck mix, routing or motor smoothing.',duration:plan.duration,sections:plan.sections.map(({start,end,look})=>({start,end,look})),sceneTimeline:scenes.map(({start,end,kind,energy,drive,vocals,sectionIndex})=>({start,end,kind,energy:r(energy),drive:r(drive),vocals:r(vocals),sectionIndex})),movementCues:cues.length,gestures:gestures.length,accents:gestures.filter(g=>g.accent>0).length,changes,windows};
writeFileSync(process.argv[3]||root+'reports/pretty-fly-automatic-analysis.json',JSON.stringify(report,null,2));
for(const t of [16,48,80,128])writeFileSync('/tmp/pretty-fly-scene-'+t+'.json',JSON.stringify(frame(t)));
console.log(JSON.stringify(report,null,2));
