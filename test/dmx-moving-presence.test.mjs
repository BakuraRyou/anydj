// Alternative moods retain their former occupancy; default scenes have dedicated tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {movingPresenceAt as presenceAt,movingPresenceLevel,applyMovingPresence} from '../public/dmx-activity.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
const movingPresenceAt=source=>presenceAt({...source,movingMood:'energetic'});
const plan={sections:[{start:0,end:10,look:'flow',intensity:.5},{start:10,end:20,look:'held',intensity:.15},{start:20,end:30,look:'peak',intensity:.9}]};
const source=time=>({movingPlan:plan,songTime:time,look:time<10?'flow':time<20?'held':'peak'});
const levels=(time,count=7)=>Array.from({length:count},(_,i)=>movingPresenceLevel(movingPresenceAt(source(time)),i,count));
test('normal passages use a partial rig, quiet passages rest, strong peaks open the rig',()=>{
 for(const count of [4,7,15,31]){
  const normal=levels(5,count),quiet=levels(15,count),peak=levels(25,count);
  assert.ok(normal.filter(v=>v>0).length>=4);
  assert.ok(normal.reduce((a,b)=>a+b,0)<count*.85);
  assert.ok(quiet.every(v=>v===0));
  assert.ok(peak.every(v=>v>.8));
  assert.equal(normal[0],normal.at(-1));
 }
});
test('section entrances fade continuously and beat accents never change the active pair',()=>{
 for(const boundary of [10,20]){
  const before=levels(boundary-.00001),after=levels(boundary+.00001);
  after.forEach((v,i)=>assert.ok(Math.abs(v-before[i])<.0001));
 }
 for(const beat of [0,1,2,3,4,31])assert.deepEqual(movingPresenceAt({...source(5),beat,accentStrength:beat%2}),movingPresenceAt(source(5)));
 assert.ok(levels(10.4)[0]>0&&levels(10.4)[0]<levels(9)[0]);
 assert.equal(levels(12)[0],0);
});
test('a peak label without strong evidence and vocal-led passages stay sparse',()=>{
 for(const extra of [{intensity:.4},{intensity:undefined}]){
  const movingPlan={sections:[{start:0,end:10,look:'peak',...extra}]};
  assert.equal(movingPresenceAt({movingPlan,songTime:5}).spread,0);
 }
 const movingPlan={sections:[{start:0,end:10,look:'peak',intensity:.9}],arrangement:{drama:{step:1,intensity:Array(10).fill(.9),vocalShare:Array(10).fill(.8)}}};
 const presence=movingPresenceAt({movingPlan,songTime:5});
 assert.equal(presence.spread,0);assert.equal(presence.level,.55);
});
test('measured blackouts still win over a strong section',()=>{
 const movingPlan={...plan,arrangement:{blackouts:[{start:24,end:26}]}};
 assert.equal(movingPresenceAt({...source(25),movingPlan}).level,0);
});
test('room expansion reapplies the pair budget once to all seven physical heads',()=>{
 const movingPresence=movingPresenceAt(source(5));
 const scene={layout:{width:8,depth:8},lights:applyMovingPresence(Array.from({length:4},(_,i)=>({id:'s'+i,type:'moving',position:{x:i-1.5,y:6,height:2},target:{x:0,y:2},motionUV:{x:.2+i*.2,y:.4},color:'#ff0000',power:.8,movingPresence,movingPresenceBasePower:.8})))};
 const room=newRoomPlan(8,8,4);
 for(let i=6;i>=0;i--)room.positions['r'+i]={type:'moving',x:i-3,y:6,height:2,rotation:0};
 const lights=applyRoomPlan(scene,room).lights;
 assert.deepEqual(lights.filter(l=>l.power>0).map(l=>l.id).sort(),['r0','r1','r5','r6']);
 lights.filter(l=>l.power>0).forEach(l=>assert.ok(Math.abs(l.power-.6)<1e-8));
 assert.ok(lights.every(l=>l.color==='#ff0000'));
 assert.deepEqual(applyMovingPresence(lights),lights,'presence is not compounded');
 assert.deepEqual(applyMovingPresence([{id:'manual',type:'moving',position:{x:0},power:.8}]),[{id:'manual',type:'moving',position:{x:0},power:.8}]);
 scene.lights.forEach(l=>{l.movingPresenceBasePower=0;l.power=0;});
 assert.ok(applyRoomPlan(scene,room).lights.every(l=>l.power===0),'blackout base stays dark');
});

test('VR interpolation carries the unmasked power and musical density together',async()=>{
 const {createVRPlayback}=await import('../public/dmx-vr-playback.js');
 const playback=createVRPlayback({delay:0});
 const scene=(level,spread,power)=>({layout:{width:8,depth:8},lights:[{id:'a',type:'moving',position:{x:0},target:{x:0,y:0},power,movingPresence:{level,spread},movingPresenceBasePower:power}]});
 playback.push(scene(0,0,0),0);playback.push(scene(.8,1,1),100);
 const light=playback.sample(50).lights[0];
 assert.equal(light.movingPresence.level,.4);assert.equal(light.movingPresence.spread,.5);
 assert.equal(light.movingPresenceBasePower,.5);
});

test('seven heads all participate across ordinary phrases with smooth mirrored handovers',()=>{
 const movingPlan={sections:[{start:0,end:40,look:'flow',intensity:.5}],arrangement:{patterns:{phrases:Array.from({length:4},(_,i)=>({start:i*10,end:(i+1)*10}))}}};
 const at=time=>Array.from({length:7},(_,rank)=>movingPresenceLevel(movingPresenceAt({movingPlan,songTime:time,look:'flow'}),rank,7));
 const used=new Set();
 for(let phrase=0;phrase<4;phrase++){
  const values=at(phrase*10+5);
  values.forEach((v,i)=>{if(v>0)used.add(i);assert.equal(v,values[6-i]);});
  assert.ok(values.filter(v=>v>0).length<7);
  if(phrase){
   const before=at(phrase*10-.00001),after=at(phrase*10+.00001);
   after.forEach((v,i)=>assert.ok(Math.abs(v-before[i])<.0001));
   assert.notDeepEqual(values,at((phrase-1)*10+5));
  }
 }
 assert.equal(used.size,7,'center and all three pairs participate without needing a peak');
 assert.deepEqual(at(5),at(5),'seeking is deterministic');
});
test('strong measured energy opens all heads even without a peak label',()=>{
 const movingPlan={sections:[{start:0,end:10,look:'flow',intensity:.8}]};
 const presence=movingPresenceAt({movingPlan,songTime:5,look:'flow'});
 assert.ok(Array.from({length:7},(_,i)=>movingPresenceLevel(presence,i,7)).every(v=>v>.8));
});

test('low and intermediate energy do not leave only one visible pair or faint extra beams',()=>{
 for(const energy of [.15,.3,.44,.45,.5,.59,.6,.7]){
  const movingPlan={sections:[{start:0,end:12,look:'flow',intensity:energy}]};
  const presence=movingPresenceAt({movingPlan,songTime:5,look:'flow'});
  const levels=Array.from({length:7},(_,i)=>movingPresenceLevel(presence,i,7));
  assert.ok(levels.filter(v=>v>=.5).length>=4);
  assert.ok(levels.every(v=>v===0||v>=.5),'selected heads have useful brightness');
 }
});
