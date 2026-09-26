import test from 'node:test';
import assert from 'node:assert/strict';
import {planShowScore,showScorePose,SHOW_FORMS} from '../public/show-score.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {motionDuration} from '../public/dmx-moving-model.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {lightReview} from '../public/light-review.js';
import {roomSurfaceChoreography,newRoomPlan,roomPlanLayout,roomMusicalAim} from '../public/dmx-ar-model.js';
import {movingDevicePoses,projectMovingHeads} from '../public/dmx-layout-model.js';
function music({period=.5,barsize=4,energy=.82,vocals=0,drive=.9,duration=96}={}){
 const beats=Array.from({length:Math.floor(duration/period)},(_,i)=>.037+i*period);
 const phrases=Array.from({length:Math.ceil(duration/8)},(_,i)=>({start:i*8,end:Math.min(duration,(i+1)*8),energy,tone:.3+(i%3)*.2,movement:{driving:drive,character:drive?'rhythmic':'atmospheric'},attention:{leader:vocals?'vocals':'drums',confidence:.8}}));
 return {duration,step:.125,sections:[{start:0,end:duration,look:drive?'peak':'held',motif:1}],beatGrid:{beats,downbeats:beats.filter((_,i)=>i%barsize===0)},
  frames:Array.from({length:duration*8},()=>({state:true,dimming:50,r:255,g:20,b:0})),colorPalette:[[255,20,0],[0,100,255]],effectiveOptions:{palette:'custom'},
  beatTiming:{minimum:5,maximum:100,times:beats},arrangement:{step:.125,times:drive?beats:[],accents:drive?beats.map(()=>.55):[],eventSalience:drive?beats.map(()=>.5):[],decays:beats.map(()=>.2),bases:Array(duration*8).fill(.25),lookTrack:Array(duration*8).fill(drive?'peak':'held'),patterns:{phrases},drama:{step:.125,intensity:Array(duration*8).fill(energy),percussion:Array(duration*8).fill(drive),vocalShare:Array(duration*8).fill(vocals)}}};
}
test('sustained loud music develops pictures across phrases without a permanent impact or random playback',()=>{
 for(const period of [.4,.5,.7]){
  const base=music({period}),snapshot=structuredClone(base),plan=applyShowProfile(base,'show');
  assert.deepEqual(base,snapshot);
  assert.ok(new Set(plan.showScore.map(p=>p.form)).size>=5);
  assert.ok(plan.showScore.every(p=>p.role==='groove'));
  assert.ok(plan.showScore.every((p,i)=>!i||p.form!==plan.showScore[i-1].form));
  assert.deepEqual(plan.showScore,applyShowProfile(structuredClone(base),'show').showScore);
  const cues=movingCues(plan,'auto','show');
  assert.ok(cues.length<base.beatGrid.beats.length/2,'motor targets leave space for complete pictures');
  assert.ok(new Set(cues.map(c=>c.formation)).size>=5,'forms survive reachability planning');
  for(let i=1;i<cues.length;i++){
   const c=cues[i];assert.ok(motionDuration(cues[i-1].pose,c.pose,.8)<=c.travel+1e-7);
   assert.ok(c.travel<=c.time-cues[i-1].time+1e-7);
   assert.deepEqual(movingCueAt(cues,c.time),c.pose);
  }
  const at=movingCueAt(cues,21.357);movingCueAt(cues,80);assert.deepEqual(movingCueAt(cues,21.357),at);
  assert.ok(cues.some((c,i)=>i&&c.time-c.travel>cues[i-1].time+.4),'readable holds between movements');
 }
});
test('all six families have distinct targets; constant pads do not rotate forms',()=>{
 const poses=SHOW_FORMS.map(form=>showScorePose({form,start:0,end:8,role:'groove',direction:1,energy:.8},4));
 assert.equal(new Set(poses.map(JSON.stringify)).size,6);
 const plan=applyShowProfile(music({drive:0,energy:.3}),'show');
 assert.equal(new Set(plan.showScore.map(p=>p.form)).size,1);
 assert.equal(plan.showCues.length,0);
 assert.equal(movingCues(plan,'auto','show').length,1);
});
test('contrasts, builds and vocals alter composition; uniform strong attacks do not become repeated hits',()=>{
 const base=music(),vocal=music({vocals:.8});
 const voice=applyShowProfile(vocal,'show'),plain=applyShowProfile(base,'show');
 assert.notDeepEqual(plain.showScore.map(p=>p.form),voice.showScore.map(p=>p.form));
 assert.ok(voice.showScore[0].occupancy<plain.showScore[0].occupancy);
 const contrasted=music();contrasted.arrangement.drama.intensity=contrasted.arrangement.drama.intensity.map((v,i)=>i<64?.35:v);
 const contrast=planShowScore(contrasted);assert.ok(contrast.some(p=>p.featured));
 const build=music();build.arrangement.drama.intensity=build.arrangement.drama.intensity.map((v,i)=>.3+Math.min(1,i/64)*.6);
 assert.ok(planShowScore(build).some(p=>p.role==='build'));
 const hits=plain.showCues.filter(c=>c.action==='hit');assert.ok(hits.length<=plain.showScore.length);
 const score=plain.showScore[1],colors=plain.showCues.filter(c=>c.time>=score.start&&c.time<score.end);
 assert.ok(colors.every(c=>c.r===colors[0].r&&c.g===colors[0].g&&c.b===colors[0].b));
});
test('three-beat bars, off-grid arrivals, manual holds and no-grid material remain usable',()=>{
 const plan=applyShowProfile(music({period:.47,barsize:3}),'show');
 const cues=movingCues(plan,'auto','show');
 assert.ok(cues.some(c=>c.time>.037&&plan.beatGrid.downbeats.includes(c.time)));
 const edited={...plan,sectionLighting:[{start:17.21,end:29.43,movement:0,rhythm:'none'}]};
 const held=movingCues(edited,'auto','show');
 assert.deepEqual(movingCueAt(held,17.21),movingCueAt(held,29.429));
 assert.ok(held.filter(c=>c.time>=29.43).every(c=>c.time-c.travel>=29.43-1e-8));
 const free=music({drive:0});delete free.beatGrid;
 assert.equal(movingCues(applyShowProfile(free,'show'),'auto','show').length,1);
});
test('phrase occupancy is symmetric for any head count and manual rhythm wins',()=>{
 const plan=applyShowProfile(music({vocals:.8}),'show'),time=4.8;
 const presence=movingPresenceAt({movingPlan:plan,movingMood:'show',songTime:time});
 for(const n of [1,2,7,8,20]){
  const levels=Array.from({length:n},(_,i)=>movingPresenceLevel(presence,i,n));
  assert.deepEqual(levels,[...levels].reverse());
  assert.ok(levels.some(v=>v>0));if(n>=7)assert.ok(levels.some(v=>v===0));
 }
 const manual={...plan,sectionLighting:[{start:0,end:96,rhythm:'none',movement:1}]};
 assert.equal(movingPresenceAt({movingPlan:manual,movingMood:'show',songTime:time}).mask,'all');
});
test('convergence uses real mount positions and heights, including predicted room aim',()=>{
 const room=newRoomPlan(10,10,4),positions=[[-3,8,2.8],[-1,9,1],[2,8,3],[3,9,1.5]];
 positions.forEach(([x,y,height],i)=>room.positions['h'+i]={type:'moving',x,y,height,rotation:0,size:{width:.3,depth:.3,height:.4}});
 const layout=roomPlanLayout(room),devices=positions.map((_,i)=>({id:'h'+i}));
 const pose=showScorePose({form:'converge',start:0,end:8,role:'groove',direction:1,energy:.8},4);
 const lights=projectMovingHeads(layout,movingDevicePoses(pose,devices,{formation:'designed',layout}),devices);
 const focus={x:.25,y:4.5,z:2.4};
 for(const l of lights){
  const light={...l,type:'moving',motionPresentation:'show',power:1};
  const actual=roomSurfaceChoreography(light,layout),origin={...l.position,z:l.position.height};
  const t=(focus.y-origin.y)/(actual.target.y-origin.y);
  assert.ok(Math.abs(origin.x+(actual.target.x-origin.x)*t-focus.x)<1e-7);
  assert.ok(Math.abs(origin.z+(actual.target.z-origin.z)*t-focus.z)<1e-7);
  const ahead=roomMusicalAim({...light,motionFocus:0,motionAhead:{seconds:.12,target:l.target,motionUV:l.motionUV,motionFocus:1}},layout);
  assert.deepEqual(ahead.motionAhead.target,actual.target);
 }
});
test('review exports the active show score and the actual show movement',()=>{
 const plan=applyShowProfile(music(),'show'),review=lightReview(plan,{time:21.37});
 assert.equal(review.reference.movementMood,'show');
 assert.deepEqual(review.decisions.showScore,plan.showScore);
 assert.deepEqual(review.snapshot.pose,movingCueAt(movingCues(plan,'auto','show'),21.37));
});
test('a dark transfer prepares a quiet-to-active entrance before the actual beat',async()=>{
 const {movingCueExposure}=await import('../public/dmx-moving-cues.js');
 const base=music({duration:24});
 base.sections=[{start:0,end:4,look:'held'},{start:4,end:24,look:'peak'}];
 base.arrangement.drama.percussion=base.arrangement.drama.percussion.map((v,i)=>i<32?0:v);
 base.arrangement.drama.intensity=base.arrangement.drama.intensity.map((v,i)=>i<32?.2:v);
 base.arrangement.times=base.arrangement.times.filter(t=>t>=4);
 const plan=applyShowProfile(base,'show'),cues=movingCues(plan,'auto','show');
 const entry=cues.find(c=>c.role==='arrival');assert.ok(entry);
 assert.equal(entry.time,4);assert.ok(entry.darkTravel);
 assert.equal(movingCueExposure(cues,entry.time-entry.travel*.5).level,0);
});
test('focus survives predictive playback and respects fixture motion range',async()=>{
 const {createMovingPreview}=await import('../public/dmx-vr-playback.js');
 const preview=createMovingPreview(),layout={width:10,depth:10,positions:{h:{x:0,y:8,height:2}}};
 const light={id:'h',type:'moving',power:1,position:layout.positions.h,target:{x:1,y:3,z:1},motionFocus:0,motionUV:{x:.5,y:.5},motionAhead:{seconds:.1,target:{x:1,y:3,z:1},motionUV:{x:.5,y:.5},motionFocus:1}};
 preview.push([light],layout,1000);
 assert.ok(Math.abs(preview.sample(1050)[0].motionFocus-.5)<1e-7);
 const [projected]=projectMovingHeads(layout,[{pan:10,tilt:.8,focus:1}],[{id:'h',motionRange:0}]);
 assert.equal(projected.motionFocus,0);
});
test('unmetered changing sustained music develops from measured expression without invented beat accents',()=>{
 const base=music({drive:0,energy:.6,duration:24});delete base.beatGrid;
 base.sections=[{start:0,end:24,look:'flow'}];
 base.arrangement.patterns.phrases=[{start:0,end:24,energy:.6,tone:.6,movement:{driving:0,character:'atmospheric'}}];
 base.arrangement.motionEnvelope=Array.from({length:96},(_,i)=>({time:i*.25,energy:.35+i*.004,tone:.3+i*.004}));
 const plan=applyShowProfile(base,'show'),cues=movingCues(plan,'auto','show');
 assert.equal(plan.showCues.length,0);assert.ok(plan.showScore.every(p=>p.role==='flow'));
 assert.ok(cues.length>2);assert.ok(cues.slice(1).every(c=>base.arrangement.motionEnvelope.some(p=>p.time===c.time)));
});
