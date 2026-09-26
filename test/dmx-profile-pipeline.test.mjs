import test from 'node:test';
import assert from 'node:assert/strict';
import {applyShowProfile,SHOW_PROFILES,movingMoodForProfile} from '../public/dj-show-profile.js';
import {showFrameAt} from '../public/show-plan.js';
import {automaticStage} from '../public/dmx-auto.js';
import {movingCues,movingCueAt,movingCueExposure} from '../public/dmx-moving-cues.js';
import {movingPresenceAt,applyMovingPresence} from '../public/dmx-activity.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
import {largeClubRoom} from '../public/dmx-room-presets.js';
function music({period=.5,barsize=4,energy=.82,vocals=0,drive=.9,duration=96}={}){
 const beats=Array.from({length:Math.floor(duration/period)},(_,i)=>.037+i*period);
 const phrases=Array.from({length:Math.ceil(duration/8)},(_,i)=>({start:i*8,end:Math.min(duration,(i+1)*8),energy,tone:.3+(i%3)*.2,movement:{driving:drive,character:drive?'rhythmic':'atmospheric'},attention:{leader:vocals?'vocals':'drums',confidence:.8}}));
 return {duration,step:.125,sections:[{start:0,end:duration,look:drive?'peak':'held',motif:1}],beatGrid:{beats,downbeats:beats.filter((_,i)=>i%barsize===0)},
  frames:Array.from({length:duration*8},()=>({state:true,dimming:50,r:255,g:20,b:0})),colorPalette:[[255,20,0],[0,100,255]],effectiveOptions:{palette:'custom'},
  beatTiming:{minimum:5,maximum:100,times:beats},arrangement:{step:.125,times:drive?beats:[],accents:drive?beats.map(()=>.55):[],eventSalience:drive?beats.map(()=>.5):[],decays:beats.map(()=>.2),bases:Array(duration*8).fill(.25),lookTrack:Array(duration*8).fill(drive?'peak':'held'),patterns:{phrases},drama:{step:.125,attacks:Array(duration*8).fill(.2),intensity:Array(duration*8).fill(energy),percussion:Array(duration*8).fill(drive),vocalShare:Array(duration*8).fill(vocals)}}};
}

for(const profile of SHOW_PROFILES)test(`${profile}: source, presence and room preserve limits, blackouts and deterministic movement`,()=>{
 const original=music(),saved=structuredClone(original),plan=applyShowProfile(original,profile),mood=movingMoodForProfile(profile);
 const cues=movingCues(plan,'auto',mood),equipment={devices:Array.from({length:8},(_,i)=>({id:'h'+i,type:'moving',cells:1}))};
 function frame(t,zero=false){
  const value=showFrameAt(plan,t),source={movingPlan:plan,songTime:t,look:'peak',weight:1,frame:zero?{...value,dimming:0}:value};
  const colors=automaticStage([source],2,equipment).frames;
  const pose=movingCueAt(cues,t),presence=movingPresenceAt({...source,movingMood:mood}),shutter=movingCueExposure(cues,t).level;
  return {layout:{width:8,depth:6,positions:{}},lights:colors.map((cells,i)=>{
   const f=cells[0],p=pose[i%pose.length];
   return {id:'h'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:p.pan/10,y:1+p.tilt*4},motionUV:{x:p.pan/90+.5,y:p.tilt},motionPresentation:mood==='balanced'?'auto':mood==='show'?'show':undefined,
    color:`rgb(${f.r},${f.g},${f.b})`,power:f.dimming/100,movingPresenceBasePower:f.dimming/100,movingPresence:presence,movingShutter:shutter};
  })};
 }
 const small=newRoomPlan(8,6,4);frame(4).lights.forEach(l=>small.positions[l.id]={...l.position,type:'moving',rotation:0});
 for(const room of [small,largeClubRoom()]){
  const render=(t,zero=false)=>applyRoomPlan(frame(t,zero),room).lights.filter(l=>l.type==='moving');
  const snapshots=[4,12,25,46].map(t=>render(t));
  assert.ok(snapshots.some(ls=>ls.some(l=>l.power>0)),`${profile} cannot silently black out the whole rig`);
  assert.ok(new Set(snapshots.map(ls=>JSON.stringify(ls.map(l=>l.target)))).size>1,'an active song retains motion through room mapping');
  for(const ls of snapshots){
   assert.ok(ls.every(l=>Number.isFinite(l.power)&&l.power>=0&&l.power<=l.movingPresenceBasePower+1e-9));
   assert.ok(ls.every(l=>Number.isFinite(l.target.x)&&Number.isFinite(l.target.y)));
   assert.deepEqual(applyMovingPresence(ls),ls,'room mapping does not multiply presence twice');
  }
  assert.ok(render(12,true).every(l=>l.power===0));
  const first=render(12);render(46);assert.deepEqual(render(12),first);
 }
 assert.deepEqual(original,saved);
});
