import test from 'node:test';
import assert from 'node:assert/strict';
import {planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupMotionAt,groupComposition} from '../public/dmx-group-motion.js';
import {movingPresenceAt,movingPresenceLevel,applyMovingPresence} from '../public/dmx-activity.js';
import {lightingSceneAt,scenePresence} from '../public/dmx-light-scenes.js';

function song({tempo=120,drive=.8,energy=[.4,.9,.55],seconds=12}={}){
 const duration=energy.length*seconds;
 const p={duration,sections:energy.map((intensity,i)=>({start:i*seconds,end:(i+1)*seconds,look:i===1?'peak':'flow',intensity})),
  beatGrid:{downbeats:Array.from({length:Math.ceil(duration/(240/tempo))},(_,i)=>i*240/tempo)},
  arrangement:{bassAttacks:[{time:seconds,strength:1}],patterns:{phrases:energy.map((e,i)=>({start:i*seconds,end:(i+1)*seconds,energy:e,tone:.45,movement:{driving:drive,character:drive>=.45?'rhythmic':'atmospheric'}}))}}};
 p.songMovement=planSongMovement(p);return p;
}
test('measured entrances expose the new picture promptly without snapping the motor path',()=>{
 for(const tempo of [75,120,174]){
  const p=song({tempo}),time=12.15;
  const presence=movingPresenceAt({movingPlan:p,songTime:time,movingMood:'balanced'});
  const motion=automaticGroupMotionAt(p,time,true);
  assert.ok(presence.layers[1].weight>=.8,'a recognised entrance must not wait for motor travel');
  assert.ok(motion.from&&motion.blend<.25,'motors retain a continuous handover');
  for(const boundary of [12,24])for(const rank of [0,1,4,7]){
   const a=groupComposition(automaticGroupMotionAt(p,boundary-1e-6,true),rank,8);
   const b=groupComposition(automaticGroupMotionAt(p,boundary+1e-6,true),rank,8);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-4);
  }
 }
});
test('short Automatic passages complete the handover and develop their own figure',()=>{
 for(const seconds of [1,2])for(const drive of [.2,.55,.85]){
  const p=song({drive,seconds,energy:[.5,.65,.5]});
  const start=seconds,end=start+seconds*.25;
  assert.ok(automaticGroupMotionAt(p,start+seconds*.1,true)?.from,'the entrance still blends');
  assert.equal(automaticGroupMotionAt(p,start+seconds*.5,true)?.from,undefined,'the body uses the incoming figure');
  for(const boundary of [start,end])for(let rank=0;rank<8;rank++){
   const before=groupComposition(automaticGroupMotionAt(p,boundary-1e-6,true),rank,8);
   const after=groupComposition(automaticGroupMotionAt(p,boundary+1e-6,true),rank,8);
   assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<1e-4,'the shorter handover remains continuous');
  }
 }
});
test('measured bass and role accents take precedence over the reserve membership',()=>{
 for(const count of [2,3,8,32])for(const mask of ['bass-chase','roles']){
  const musical={level:.9,mask,phase:0,age:.12,duration:.4,roles:[1,.66,.66,1],accentAge:.12,accentDuration:.6};
  const presence={...musical,participation:{fraction:.65,selection:2}};
  for(let rank=0;rank<count;rank++)assert.equal(movingPresenceLevel(presence,rank,count),movingPresenceLevel(musical,rank,count));
  const render=presence=>applyMovingPresence(Array.from({length:count},(_,i)=>({id:`h${i}`,type:'moving',position:{x:i,y:0},movingPresenceBasePower:.8,movingPresence:presence})));
  assert.deepEqual(render(presence).map(l=>l.power),render(musical).map(l=>l.power));
 }
});
test('quiet and sustained material keeps a flowing exposure transition, independent of tempo',()=>{
 for(const tempo of [75,120,174])for(const drive of [.2,.55,.85]){
  const p=song({tempo,drive,energy:[.45,.55,.4]});
  const presence=movingPresenceAt({movingPlan:p,songTime:12.15,movingMood:'balanced'});
  assert.ok(presence.layers[1].weight<.5,'ordinary change is not promoted to a drop');
  const original=movingPresenceAt({movingPlan:p,songTime:12.6});
  movingPresenceAt({movingPlan:p,songTime:32});
  assert.deepEqual(movingPresenceAt({movingPlan:p,songTime:12.6}),original,'seeks reproduce the same transition');
 }
});
test('automatic accents preserve physical membership and measured darkness still wins',()=>{
 const p=song();p.arrangement.bassAttacks.push({time:14.13,strength:.9},{time:14.63,strength:1});
 const dark=structuredClone(p);dark.arrangement.blackouts=[{start:14,end:16}];
 const time=14.95,musical=scenePresence(lightingSceneAt(p,time),p,time);
 assert.equal(musical.mask,'bass-chase');
 for(const count of [2,3,8,32]){
  const presence=movingPresenceAt({movingPlan:p,songTime:time});
  const actual=Array.from({length:count},(_,rank)=>movingPresenceLevel(presence,rank,count));
  const base=movingPresenceAt({movingPlan:p,songTime:time,flicker:0});
  const expected=Array.from({length:count},(_,rank)=>movingPresenceLevel(base,rank,count));
  assert.deepEqual(actual.map(v=>v>0),expected.map(v=>v>0));
  actual.forEach((v,i)=>assert.ok(v>=expected[i]&&v<=Math.min(1,expected[i]*1.15)+1e-9));
  assert.ok(actual.some((v,i)=>v>expected[i]));
  const blackout=movingPresenceAt({movingPlan:dark,songTime:time});
  assert.ok(Array.from({length:count},(_,rank)=>movingPresenceLevel(blackout,rank,count)).every(v=>v===0));
 }
});
test('accent membership rejoins its reserve continuously at both ends',()=>{
 for(const count of [2,3,8,32]){
  const policy={fraction:.65,selection:1};
  const level=(age,rank)=>movingPresenceLevel({level:1,mask:'roles',roles:[1,1,1,1],accentAge:age,accentDuration:.6,participation:policy},rank,count);
  for(let rank=0;rank<count;rank++){
   assert.equal(level(0,rank),level(.6,rank));
   assert.equal(level(.12,rank),1);
   for(const boundary of [0,.025,.525,.6])assert.ok(Math.abs(level(boundary+1e-6,rank)-level(boundary-1e-6,rank))<1e-4);
  }
 }
});

// Dense bass attacks must not turn a sustained automatic picture into a chase.
test('five bass notes per second retain the picture across fixture counts and seeks',()=>{
 const p=song({energy:[.75,.8,.75],seconds:12});
 p.showProfile='auto';
 p.arrangement.bassAttacks=Array.from({length:150},(_,i)=>({time:2+i*.2,strength:.95,duration:.08}));
 for(const count of [2,3,8,32,48,192]){
  let previous;let accented=false;
  for(let tick=400;tick<700;tick++){
   const time=tick/100,levels=flicker=>{
    const presence=movingPresenceAt({movingPlan:p,songTime:time,flicker});
    return Array.from({length:count},(_,rank)=>movingPresenceLevel(presence,rank,count));
   };
   const base=levels(0),soft=levels(30),actual=levels(100);
   actual.forEach((v,i)=>{
    assert.equal(v>0,base[i]>0,'bass must not open reserves or close existing heads');
    assert.ok(v>=soft[i]-1e-9&&soft[i]>=base[i]-1e-9);
    assert.ok(v<=Math.min(1,base[i]*1.15)+1e-9);
    if(previous)assert.ok(Math.abs(v-previous[i])<.05,`no abrupt note-driven group exchange: count=${count} t=${time} rank=${i} previous=${previous[i]} current=${v} base=${base[i]}`);
    if(v>base[i]+.001)accented=true;
   });
   previous=actual;
  }
  assert.ok(accented,'the music retains gentle expression');
 }
 const source={movingPlan:p,songTime:5.07,flicker:100};
 const first=movingPresenceAt(source);
 movingPresenceAt({...source,songTime:30});
 assert.deepEqual(movingPresenceAt(source),first);
 assert.deepEqual(movingPresenceAt({...source,movingPlan:JSON.parse(JSON.stringify(p))}),first);
});
