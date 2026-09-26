import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
import {largeClubRoom} from '../public/dmx-room-presets.js';
import {applyMovingPresence,movingPresenceAt} from '../public/dmx-activity.js';
import {lightingGestures,gesturePose} from '../public/dmx-light-scenes.js';
const plan={duration:32,sections:[{start:0,end:32,look:'flow',intensity:.6}],beatGrid:{downbeats:Array.from({length:16},(_,i)=>i*2)},arrangement:{times:Array.from({length:64},(_,i)=>i*.5),eventSalience:Array.from({length:64},(_,i)=>i===10?.9:.1),patterns:{phrases:[{start:0,end:32,energy:.6,tone:.4,movement:{driving:.8},attention:{leader:'drums',confidence:.9}}]}}};
function source(power=1){
 const presence=movingPresenceAt({movingPlan:plan,songTime:10,movingMood:'balanced'});
 return {layout:{width:8,depth:8},lights:['moving','moving','moving','moving','spot','bar'].map((type,i)=>({id:'source'+i,type,position:{x:i-3,y:6,height:3},target:{x:0,y:2},motionUV:{x:i/6,y:.4},power,color:'#20aaff',...(type==='moving'?{motionPresentation:'auto',movingPresence:presence,movingPresenceBasePower:power}:{})}))};
}
test('192-fixture automatic room limits additive wash power and uses selected moving rows',()=>{
 const scene=source(),saved=structuredClone(scene),room=largeClubRoom(),result=applyRoomPlan(scene,room).lights;
 assert.deepEqual(scene,saved);
 const heads=result.filter(l=>l.type==='moving'),wash=result.filter(l=>l.type==='spot'||l.type==='bar');
 assert.equal(heads.length,72);assert.equal(wash.length,120);
 assert.ok(heads.filter(l=>l.power>0).length<=36);
 assert.ok(wash.every(l=>l.power<=.36),'broad washes cannot all run at original full power');
 assert.ok(result.reduce((sum,l)=>sum+l.power,0)<60,'full-source synthetic frame stays under 60 fixture-equivalents');
 assert.ok(result.filter(l=>l.power>0).every(l=>l.color==='#20aaff'));
 assert.deepEqual(applyMovingPresence(result),result,'reapplying presence does not erase the brightness budget');
 assert.ok(applyRoomPlan(source(0),room).lights.every(l=>l.power===0));
 const one=source();one.lights.find(l=>l.type==='spot').power=0;
 const dark=applyRoomPlan(one,room).lights;
 result.filter(l=>l.type==='bar').forEach(l=>assert.equal(dark.find(p=>p.id===l.id).power,l.power,'other fixture types do not brighten when a source blacks out'));
 const again=applyRoomPlan(scene,room);assert.deepEqual(again.lights,result);
});
test('small rooms and explicit show lighting retain their authored brightness',()=>{
 const scene=source(),room=newRoomPlan(8,8,4);
 scene.lights.forEach(l=>room.positions[l.id]={...l.position,type:l.type,rotation:0});
 const small=applyRoomPlan(scene,room).lights;
 assert.ok(small.filter(l=>l.type!=='moving').every(l=>l.power===1));
 const show={...scene,lights:scene.lights.map(l=>({...l,motionPresentation:l.type==='moving'?'show':undefined}))};
 assert.ok(applyRoomPlan(show,largeClubRoom()).lights.filter(l=>['spot','bar'].includes(l.type)).every(l=>l.power===1));
});
test('ordinary percussion gets small movements and measured standouts get larger strokes',()=>{
 const gestures=lightingGestures(plan),bars=gestures.filter(g=>g.kind==='bar');
 assert.ok(bars.length>4);
 const poses=bars.map(gesturePose);
 for(let head=0;head<4;head++){
  assert.ok(Math.max(...poses.map(p=>p[head].pan))-Math.min(...poses.map(p=>p[head].pan))<1.5);
  assert.ok(Math.max(...poses.map(p=>p[head].tilt))-Math.min(...poses.map(p=>p[head].tilt))<.02);
 }
 const accent=gestures.find(g=>g.kind==='accent');assert.ok(accent);
 assert.notDeepEqual(gesturePose(accent),gesturePose(bars[0]));
});
