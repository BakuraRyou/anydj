import test from 'node:test';
import assert from 'node:assert/strict';
import {clubStageRoom} from '../public/dmx-room-presets.js';
import {GROUP_COMPOSITIONS,groupComposition} from '../public/dmx-group-motion.js';
import {SHOW_FORMS,showScorePose} from '../public/show-score.js';
import {createRoomPreview} from '../public/dmx-ar-model.js';
for(const mode of ['auto','show'])for(const zones of [false,true])test(`${mode}: paired stage paths survive wall routing and motors, zones=${zones}`,()=>{
const room=clubStageRoom();if(!zones)room.zones=[];
const render=createRoomPreview();let worst={error:0};
for(let i=0;i<=180;i++){
 const scene={layout:{width:8,depth:6,positions:{}},lights:Array.from({length:8},(_,j)=>({id:'h'+j,type:'moving',position:{x:j-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:mode,power:1,movingPresenceBasePower:1,movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,groupMotion:{composition:'crossed-banks',progress:.4,phase:i/30,energy:.8,amount:1,intent:{symmetry:'paired',extent:1.2,articulation:.3}}}}))};
 const heads=render(scene,room,false,i/30).lights.filter(l=>l.type==='moving');
 for(const a of heads.filter(l=>l.position.x<0)){const b=heads.find(l=>Math.abs(l.position.x+a.position.x)<.001&&l.position.y===a.position.y);if(!b)continue;const error=Math.hypot(a.target.x+b.target.x,a.target.y-b.target.y,(a.target.z??0)-(b.target.z??0));if(error>worst.error)worst={error,time:i/30,ids:[a.id,b.id],targets:[a.target,b.target],power:[a.power,b.power]};}
}
assert.ok(worst.error<1e-6,JSON.stringify(worst));
});

test('paired catalog trajectories and handovers retain opposite pan and equal depth',()=>{
 for(const composition of GROUP_COMPOSITIONS)for(const count of [3,8])for(let phase=0;phase<12;phase+=.13){
  const motion={composition,progress:.4,phase,energy:.8,amount:1,intent:{symmetry:'paired',extent:1.2}};
  const paired=Array.from({length:count},(_,rank)=>groupComposition(motion,rank,count,2,6));
  paired.forEach((p,i)=>{const q=paired[count-1-i];assert.ok(Math.abs(p.x+q.x-1)<1e-9&&Math.abs(p.y-q.y)<1e-9,composition);});
  const fade={...motion,from:{...motion,composition:'breathing-arch'},blend:.37};
  const a=groupComposition(fade,0,count,2,6),b=groupComposition(fade,count-1,count,2,6);
  assert.ok(Math.abs(a.x+b.x-1)<1e-9&&Math.abs(a.y-b.y)<1e-9);
 }
 for(const form of SHOW_FORMS)for(let time=0;time<16;time+=.23){
  const p=showScorePose({form,start:0,end:16,role:'groove',direction:1,energy:.8,movementIntent:{symmetry:'paired',motionDrive:.8,pace:1.2}},time);
  assert.ok(p.every((v,i)=>Math.abs(v.pan+p[3-i].pan)<1e-9&&Math.abs(v.tilt-p[3-i].tilt)<1e-9),form);
 }
});
