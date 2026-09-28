import test from 'node:test';
import assert from 'node:assert/strict';
import {showPictureLayers} from '../public/show-score.js';
import {movingPresenceLevel} from '../public/dmx-activity.js';
const plan={showProfile:'show',showScore:[
 {start:0,end:8,index:0,role:'groove',occupancy:.5,supportGain:1},
 {start:8,end:16,index:1,role:'groove',occupancy:.5,supportGain:0},
 {start:16,end:20,index:2,role:'silence',occupancy:0,supportGain:0}],
 beatGrid:{beats:Array.from({length:41},(_,i)=>i*.5)}};
const presence=time=>({layers:showPictureLayers(plan,time).map(({picture:p,weight})=>({weight,mask:'show-score',level:1,occupancy:p.occupancy,selection:p.index%2}))});
test('show membership crossfades without losing reflected pairs; silence remains immediate',()=>{
 for(const n of [2,7,8,48]){
  let prior;
  for(let t=7.99;t<10;t+=.01){
   const values=Array.from({length:n},(_,i)=>movingPresenceLevel(presence(t),i,n));
   assert.deepEqual(values,[...values].reverse());
   if(prior)assert.ok(values.every((v,i)=>Math.abs(v-prior[i])<.02));
   assert.ok(values.some(v=>v>0));prior=values;
  }
  assert.ok(Array.from({length:n},(_,i)=>movingPresenceLevel(presence(16),i,n)).every(v=>v===0));
 }
});
test('saved support attenuation no longer darkens Show output relative to ordinary source intensity',async()=>{
 const {automaticStage}=await import('../public/dmx-auto.js');
 const source={frame:{state:true,r:255,g:80,b:0,dimming:70},weight:1,look:'peak',movingPlan:plan,movingMood:'show',songTime:10};
 const equipment={devices:[{id:'wash',type:'spot',cells:1},{id:'head',type:'moving',cells:1}]};
 const output=automaticStage([source],2,equipment).frames;
 assert.ok(output[0][0].dimming>0);
 const staticOnly=automaticStage([source],2,{devices:[equipment.devices[0]]}).frames;
 assert.ok(staticOnly[0][0].dimming>0,'a rig without moving heads keeps its supporting lights');
 assert.ok(output[1][0].dimming>0);
 const automatic=automaticStage([{...source,movingPlan:{...plan,showProfile:'balanced'}}],2,equipment).frames;
 assert.equal(output[0][0].dimming,automatic[0][0].dimming);
 assert.equal(output[1][0].dimming,automatic[1][0].dimming);
});

test('show poses preserve reflected pairs even when the song requests drifting automatic motion',async()=>{
 const {showScorePose,SHOW_FORMS}=await import('../public/show-score.js');
 for(const form of SHOW_FORMS){
  const pose=showScorePose({form,start:0,end:8,role:'groove',direction:1,energy:.8,movementIntent:{symmetry:'drifting',pace:1}},3);
  assert.ok(pose.every((p,i)=>Math.abs(p.pan+pose[3-i].pan)<1e-9&&p.tilt===pose[3-i].tilt));
 }
});

test('show actions enter and leave the current exposure without a first-frame blackout',()=>{
 for(const count of [2,7,8,48])for(const action of ['launch','answer'])for(const phase of [0,1])for(const wavePhase of [null,.23,.66]){
  const base={mask:'show-score',level:1,occupancy:.5,selection:phase,wavePhase};
  for(let rank=0;rank<count;rank++){
   const ordinary=movingPresenceLevel(base,rank,count);
   const at=progress=>movingPresenceLevel({...base,mask:'show-action',action,phase,progress,amount:1},rank,count);
   assert.equal(at(0),ordinary);
   assert.ok(Math.abs(at(.001)-ordinary)<.001);
   assert.equal(at(1),ordinary);
   assert.ok(Math.abs(at(.999)-ordinary)<.001);
   assert.equal(at(.4),movingPresenceLevel({...base,mask:'show-action',action,phase,progress:.4,amount:1},count-1-rank,count));
  }
 }
});


test('legacy wave metadata cannot add a second dimmer to selected moving heads',()=>{
 for(const wavePhase of [0,.1,.25,.5,.75,1])for(let rank=0;rank<8;rank++){
  const p={mask:'show-score',level:.7,occupancy:.5,selection:0};
  assert.equal(movingPresenceLevel({...p,wavePhase},rank,8),movingPresenceLevel(p,rank,8));
 }
});

test('show handover retains outgoing geometry when entering a held picture',async()=>{
 const {movingPresenceAt}=await import('../public/dmx-activity.js');
 const {presenceComposition}=await import('../public/dmx-group-motion.js');
 const {SONG_MOVEMENT_VERSION}=await import('../public/song-movement-plan.js');
 const p={duration:16,showProfile:'show',sections:[{start:0,end:16,look:'flow'}],
  arrangement:{step:.1,bases:Array(160).fill(.7),times:[],accents:[]},
  songMovement:{version:SONG_MOVEMENT_VERSION,passages:[{start:0,end:16,motion:'opening-lines',composition:'parallel-sweep',coordination:'ordered',energy:.7,drive:.6,direction:1,motionDrive:.6}]},
  showScore:[{start:0,end:8,index:0,role:'flow',occupancy:.5},{start:8,end:16,index:1,role:'held',occupancy:.5}]};
 const at=t=>movingPresenceAt({movingPlan:p,movingMood:'show',songTime:t});
 const before=presenceComposition(at(8-.000001),0,8,0,2);
 assert.ok(before?.weight>0,'the outgoing figure must have real group geometry');
 const start=presenceComposition(at(8),0,8,0,2);
 assert.deepEqual(start,before,'a new held picture must not erase outgoing geometry on entry');
 const middle=presenceComposition(at(8.9),0,8,0,2);
 assert.ok(middle.weight>0&&middle.weight<start.weight,'geometry returns to the held pose gradually');
 assert.equal(presenceComposition(at(10),0,8,0,2),null);
 assert.deepEqual(at(8.9),at(8.9),'handover remains deterministic when seeking');
 p.showScore[0].role='held';p.showScore[1].role='flow';
 assert.equal(presenceComposition(at(8),0,8,0,2),null,'a moving figure also enters gradually from a held picture');
 assert.ok(presenceComposition(at(8.9),0,8,0,2)?.weight>0);
});

test('continuing show motion uses the musical interval instead of waiting then rushing',async()=>{
 const {showMovingCues,movingCueAt}=await import('../public/dmx-moving-cues.js');
 const p={duration:16,beatGrid:{beats:Array.from({length:33},(_,i)=>i*.5),downbeats:[0,4,8,12,16]},
  showScore:[{start:0,end:16,index:0,role:'groove',form:'wings',direction:1,energy:.7,scale:1,rhythmic:true,movementIntent:{pace:.25,motionDrive:.6}}]};
 const cues=showMovingCues(p);
 assert.ok(cues.length>=4);
 for(let i=1;i<cues.length;i++){
  assert.equal(cues[i].travel,cues[i].time-cues[i-1].time);
  assert.equal(cues[i].continuous,true);
 }
 const t=cues[2].time,h=.001,pan=t=>movingCueAt(cues,t)[0].pan;
 const left=(pan(t)-pan(t-h))/h,right=(pan(t+h)-pan(t))/h;
 assert.ok(Math.abs(left)>.01,'ordinary waypoint should not force a stop');
 assert.ok(Math.abs(left-right)<.01,'velocity must survive the waypoint');
 assert.ok(Number.isFinite(movingCueAt(cues,t+.1)[0].focus),'continuous interpolation preserves spatial focus');
 const held=structuredClone(p);held.sectionLighting=[{start:2,end:3,movement:0}];
 const hc=showMovingCues(held);
 assert.deepEqual(movingCueAt(hc,2.1),movingCueAt(hc,2.9),'explicit holds stay still');
 const hit=structuredClone(p);hit.showScore[0].featured=true;
 assert.ok(showMovingCues(hit).every(c=>!c.continuous),'featured entrances retain deliberate articulation');
});
