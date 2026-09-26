// Offline replay in Club-Bühne · Publikum & Hintergrund; no lamp commands.
// Fixed source colors/intensity and room motors; does not reproduce live UI state.
// Target travel is measured in metres after surface routing and motor simulation.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url).href;
const input=process.argv[2];
if(!input||!process.argv[3])throw Error('Usage: node scripts/review-song-movement.mjs prepared-plan.json output.json');
const {movingCues,movingCueAt}=await import(root+'public/dmx-moving-cues.js');
const {movingPresenceAt}=await import(root+'public/dmx-activity.js');
const {showFrameAt}=await import(root+'public/show-plan.js');
const {projectMovingHeads,movingDevicePoses}=await import(root+'public/dmx-layout-model.js');
const {clubStageRoom}=await import(root+'public/dmx-room-presets.js');
const {createRoomPreview}=await import(root+'public/dmx-ar-model.js');
const plan=JSON.parse(readFileSync(input)),cues=movingCues(plan,'auto','balanced'),room=clubStageRoom();
const layout={width:8,depth:6,positions:{}},devices=Array.from({length:8},(_,i)=>({id:'h'+i}));
const preview=createRoomPreview();
function frame(t){
 const value=showFrameAt(plan,t),power=value.state===false?0:value.dimming/100,color=`rgb(${value.r},${value.g},${value.b})`,presence=movingPresenceAt({movingPlan:plan,songTime:t,movingMood:'balanced'});
 const heads=projectMovingHeads(layout,movingDevicePoses(movingCueAt(cues,t),devices,{formation:'designed',layout}),devices).map(l=>({...l,type:'moving',power,color,motionPresentation:'auto',movingPresence:presence,movingPresenceBasePower:power}));
 const source={layout,crowd:[],lights:[...heads,...['spot','bar'].map((type,i)=>({id:type,type,power,color,position:{x:i,y:4,height:3},target:{x:i,y:2}}))]};
 return preview(source,room,false,t);
}
let previous,total=0;const snapshots=[];
for(let i=0;i<=54*30;i++){const t=i/30,s=frame(t),heads=s.lights.filter(l=>l.type==='moving');if(t>=40&&previous)total+=heads.reduce((sum,l,j)=>sum+Math.hypot(l.target.x-previous[j].target.x,l.target.y-previous[j].target.y,(l.target.z??0)-(previous[j].target.z??0)),0)/heads.length;if([40,44,48,52].includes(t))snapshots.push(s);previous=heads;}
const result={room:room.name,interval:[40,54],sampleHz:30,meanTargetTravel:total,snapshots};
writeFileSync(process.argv[3],JSON.stringify(result));console.log(JSON.stringify({...result,snapshots:undefined}));
