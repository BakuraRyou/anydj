import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
import {SONG_MOVEMENT_VERSION} from '../public/song-movement-plan.js';
import {applyRoomPlan,wallChoreography} from '../public/dmx-ar-model.js';
import {clubStageRoom} from '../public/dmx-room-presets.js';
const passage=(start,end)=>({start,end,motion:'rising-steps',composition:'depth-wave',coordination:'layered',motionDrive:.6,energy:.8,drive:.6,direction:1,symmetry:'paired',surface:'floor'});
function plan(split){return {beatGrid:{downbeats:Array.from({length:20},(_,i)=>i*2)},songMovement:{version:SONG_MOVEMENT_VERSION,passages:split?[passage(0,8),passage(8,10),passage(10,24)]:[passage(0,24)]}};}
test('short analysis fragments neither restart nor accelerate a continuing periodic figure',()=>{
 const whole=plan(false),split=plan(true);
 for(let t=1;t<23;t+=.1){
  const a=automaticGroupMotionAt(whole,t),b=automaticGroupMotionAt(split,t);
  assert.ok(Math.abs(a.phase-b.phase)<1e-8);
 }
});
test('Automatic keeps depth waves in the room while Show retains coordinated wall staging',()=>{
 const room=clubStageRoom();room.zones=[]; // Isolate surface choice from exclusion routing.
 for(const mode of ['auto','show'])for(const surface of ['floor','wall'])for(const phase of [0,1,2,3]){
  const motion={...passage(0,24),phase,progress:.5,amount:1,intent:{symmetry:'paired',surface}};
  const scene={layout:{width:8,depth:6,positions:{}},lights:Array.from({length:8},(_,i)=>({id:'h'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:mode,movingPresence:{level:1,mask:'all',rowFraction:1,groupMotion:motion},power:1}))};
  const heads=applyRoomPlan(scene,room).lights.filter(l=>l.type==='moving'&&room.positions[l.id].wallTarget);
  assert.equal(heads.length,24);
  assert.equal(new Set(heads.map(l=>l.motionWallBlend)).size,1);
  for(const light of heads){
   const mapped=wallChoreography(light,room);
   if(mode==='auto'||surface==='floor')assert.deepEqual(mapped.target,light.target);
   else assert.equal(mapped.wallIndex,room.positions[light.id].wallTarget.wall);
  }
 }
});
test('surface handover is shared and continuous across every member',()=>{
 const from={...passage(0,8),progress:.88,phase:1,intent:{surface:'floor'}};
 const current={...passage(8,16),progress:.12,phase:1,intent:{surface:'wall'},from};
 for(const blend of [0,.1,.5,.9,1])for(let row=0;row<6;row++)for(let rank=0;rank<8;rank++){
  assert.equal(groupComposition({...current,blend},rank,8,row,6).wallBlend,blend);
 }
});
test('planned wall figures retain depth movement as height instead of collapsing onto a line',()=>{
 const room=clubStageRoom();room.zones=[];
 const [id,p]=Object.entries(room.positions).find(([,p])=>p.wallTarget);
 const light={id,type:'moving',position:p,modelSize:p.size,power:1,target:{x:0,y:20},motionSymmetry:'paired',motionWallBlend:1};
 const a=wallChoreography({...light,motionUV:{x:.25,y:.25}},room);
 const b=wallChoreography({...light,motionUV:{x:.25,y:.75}},room);
 assert.equal(a.wallIndex,p.wallTarget.wall);assert.equal(b.wallIndex,p.wallTarget.wall);
 assert.ok(b.target.z-a.target.z>2,'front/back choreography remains visibly distinct on the wall');
 assert.equal(a.target.x,b.target.x);
 const mirror=wallChoreography({...light,motionUV:{x:.75,y:.75}},room);
 assert.ok(Math.abs(b.target.z-mirror.target.z)<1e-9);
 assert.ok(Math.abs(b.target.x+mirror.target.x)<1e-9);
});
test('sustained peaks hand surfaces over at phrase boundaries without oscillating every fragment',async()=>{
 const {planSongMovement}=await import('../public/song-movement-plan.js');
 const sections=Array.from({length:5},(_,i)=>({start:i*14,end:(i+1)*14,look:'peak',motif:1,intensity:.85}));
 const p={duration:70,sections,arrangement:{patterns:{phrases:sections.map(s=>({...s,energy:.85,tone:.5,movement:{driving:.7}}))}}};
 const score=planSongMovement(p);
 assert.ok(score.passages.some(p=>p.surface==='floor'),'peak labels cannot force a wall picture');
 const plan={...p,songMovement:score};
 for(let i=1;i<score.passages.length;i++){
  const current=score.passages[i],previous=score.passages[i-1];
  const at=automaticGroupMotionAt(plan,current.start);
  assert.ok(at.from);assert.equal(at.blend,0);
  assert.equal(groupComposition(at,0,8,0,6).wallBlend,previous.surface==='wall'?1:0);
  const after=groupComposition(automaticGroupMotionAt(plan,current.start+2),0,8,0,6);
  assert.equal(after.wallBlend,current.surface==='wall'?1:0);
 }
});

test('Automatic ignores explicit and legacy wall projection without changing the requested trajectory',async()=>{
 const {roomSurfaceChoreography}=await import('../public/dmx-ar-model.js');
 const room=clubStageRoom();room.zones=[];
 const [id,p]=Object.entries(room.positions).find(([,p])=>p.wallTarget);
 for(const motionWallBlend of [undefined,0,.5,1]){
  const light={id,type:'moving',position:p,modelSize:p.size,power:.6,target:{x:2,y:20},motionUV:{x:.6,y:.9},motionPresentation:'auto',motionWallBlend};
  assert.deepEqual(wallChoreography(light,room),light);
 }
 const layout={width:20,depth:30,height:8,room:true};
 const light={id:'free',type:'moving',position:{x:2,y:20,height:6},target:{x:4,y:12},power:.7,motionUV:{x:.6,y:.55},motionPresentation:'auto'};
 assert.deepEqual(roomSurfaceChoreography(light,layout),light,'legacy perimeter fallback cannot invent a wall target');
});

test('Automatic wall-tagged compositions remain animated and illuminated after room motors',async()=>{
 const {createRoomPreview}=await import('../public/dmx-ar-model.js');
 const room=clubStageRoom(),preview=createRoomPreview();let first,last;
 for(let tick=0;tick<=120;tick++){
  const time=tick/15,progress=.12+.76*tick/120;
  const motion={...passage(0,10),progress,phase:time*.7,amount:1,intent:{symmetry:'paired',surface:'wall'}};
  const scene={layout:{width:8,depth:6,positions:{}},crowd:[],lights:Array.from({length:8},(_,i)=>({id:'h'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:'auto',movingPresence:{level:1,mask:'all',rowFraction:1,groupMotion:motion},power:1}))};
  const heads=preview(scene,room,false,time).lights.filter(l=>l.type==='moving');
  assert.ok(heads.some(l=>l.power>.01),'removing wall staging must not remove the active rig');
  assert.ok(heads.filter(l=>l.power>.01).every(l=>(l.target.z??0)<.05),'authored floor figures reach the floor after motor simulation');
  if(tick===30)first=heads.map(l=>l.target);
  last=heads.map(l=>l.target);
 }
 assert.ok(last.some((t,i)=>Math.hypot(t.x-first[i].x,t.y-first[i].y)>.5),'the figure still evolves');
});
