import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTO_FORMATIONS,AUTOMATIC_FORMATIONS,selectGroupScore,planSongMovement} from '../public/song-movement-plan.js';
import {groupComposition,automaticGroupMotionAt,showGroupMotionAt} from '../public/dmx-group-motion.js';
const point=(name,phase,rank,count,row)=>groupComposition({composition:name,phase,progress:.5,amount:1,energy:.7,drive:.6,intent:{symmetry:'paired',surface:'floor'}},rank,count,row,4);
test('Automatic has 150 distinct spatial formations with finite, symmetric moving paths',()=>{
 assert.equal(AUTOMATIC_FORMATIONS.length,150);
 assert.equal(new Set(AUTOMATIC_FORMATIONS).size,150);
 const signatures=new Set();
 for(const f of AUTO_FORMATIONS){
  const frames=[.2,1.1,2.4].map(phase=>Array.from({length:4},(_,row)=>Array.from({length:8},(_,rank)=>point(f.name,phase,rank,8,row))));
  signatures.add(JSON.stringify(frames.map(rows=>rows.map(heads=>heads.map(p=>[+p.x.toFixed(5),+p.y.toFixed(5)])))));
  assert.notDeepEqual(frames[0],frames[1],f.name+' evolves');
  for(const count of [2,3,4,8,32])for(let phase=0;phase<6.3;phase+=.3)for(let rank=0;rank<count;rank++){
   const a=point(f.name,phase,rank,count,2),b=point(f.name,phase,count-1-rank,count,2);
   assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1);
   assert.ok(Math.abs(a.x+b.x-1)<1e-8&&Math.abs(a.y-b.y)<1e-8,f.name+' mirrored');
   const next=point(f.name,phase+.0001,rank,count,2);
   assert.ok(Math.hypot(next.x-a.x,next.y-a.y)<.001,f.name+' continuous');
  }
 }
 assert.equal(signatures.size,110,'new entries are geometric variants, not speed/color aliases');
});
function song(energy=.8,drive=.8){const duration=240;return {duration,sections:[{start:0,end:duration,look:'flow'}],arrangement:{patterns:{phrases:Array.from({length:30},(_,i)=>({start:i*8,end:i*8+8,energy:energy+(i%3)*.02,tone:.2+(i%5)*.12,movement:{driving:drive,character:'rhythmic'}}))}}};}
test('extended candidates are selected by music, repeat deterministically and keep Show on its existing catalog',()=>{
 const p=song();p.songMovement=planSongMovement(p);
 const score=selectGroupScore(p,true),names=new Set(score.map(s=>s.motion));
 assert.ok([...names].some(n=>n?.startsWith('auto-')));
 assert.ok(names.size>=8,'long music develops more than a handful of pictures');
 assert.deepEqual(score,selectGroupScore(structuredClone(p),true));
 const calm=selectGroupScore(song(.4,.2),true);
 assert.notDeepEqual(score.map(s=>s.motion),calm.map(s=>s.motion));
 for(const s of calm){const f=AUTO_FORMATIONS.find(f=>f.name===s.motion);if(f)assert.ok(f.gentle);}
 for(let t=1;t<240;t+=8){
  const m=showGroupMotionAt(p,t,{role:'groove'});
  assert.ok(!m?.composition?.startsWith('auto-'),'Show selection is unchanged');
 }
 const held={...p,sectionLighting:[{start:5,end:7,movement:0}]};
 assert.deepEqual(automaticGroupMotionAt(held,5,true),automaticGroupMotionAt(held,6.9,true));
});
test('the live Automatic presence uses the new catalog after room expansion without wall staging',async()=>{
 const {movingPresenceAt}=await import('../public/dmx-activity.js');
 const {applyRoomPlan,wallChoreography}=await import('../public/dmx-ar-model.js');
 const {clubStageRoom}=await import('../public/dmx-room-presets.js');
 const p=song();p.songMovement=planSongMovement(p);
 const selected=selectGroupScore(p,true).find(s=>s.motion?.startsWith('auto-'));
 assert.ok(selected);const time=(selected.start+selected.end)/2;
 const presence=movingPresenceAt({movingPlan:p,songTime:time,movingMood:'balanced'});
 assert.ok(presence.layers.some(l=>l.weight>0&&l.groupMotion?.composition===selected.motion));
 const room=clubStageRoom();
 const lights=Array.from({length:8},(_,i)=>({id:'head'+i,type:'moving',position:{x:i-3.5,y:4,height:3},target:{x:0,y:3},motionUV:{x:.5,y:.5},motionPresentation:'auto',movingPresence:presence,movingPresenceBasePower:1,power:1}));
 const heads=applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights,crowd:[]},room).lights.filter(l=>l.type==='moving');
 assert.ok(heads.some(l=>l.power>0));
 for(const h of heads){assert.equal(h.motionWallBlend,0);assert.deepEqual(wallChoreography(h,room).target,h.target);}
});
