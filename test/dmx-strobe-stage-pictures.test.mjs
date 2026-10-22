import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeScoreAt,strobeComposition,strobeFixtureRole} from '../public/dmx-strobe-score.js';
import {applyRoomPlan,newRoomPlan} from '../public/dmx-ar-model.js';
const song=()=>({duration:8,showProfile:'strobe',showScore:[{start:0,end:8,role:'groove',energy:.8,rhythmic:true,tone:.5}],
 sections:[{start:0,end:8,look:'peak'}],beatGrid:{beats:Array.from({length:16},(_,i)=>i*.5),downbeats:[0,2,4,6,8]},
 arrangement:{times:[0,.5,1,1.5,2,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5],accents:Array(15).fill(.6),eventSources:Array(15).fill('onset')}});
const sample=(p,t,n)=>Array.from({length:n},(_,i)=>strobeComposition(strobeScoreAt(p,t),i,n));
test('production strobe entrances expose complete mirrored units on even and odd rigs',()=>{
 const p=song();
 for(const n of [2,3,4,7,8,16,48])for(const t of [.05,.55,1.05,1.55,3.05]){
  const row=sample(p,t,n);
  assert.ok(row.some(c=>c.level>0));
  row.forEach((c,i)=>{
   assert.equal(c.fixtureRole,row[n-1-i].fixtureRole);
   assert.equal(c.level,row[n-1-i].level,'a crossing cannot lose its opposing ray');
  });
 }
});
test('small rigs retain a lead pair instead of assigning all heads to dormant roles on arrival',()=>{
 for(const n of [2,3,4,5,6])for(const phase of [0,1,2,3])
  assert.ok(Array.from({length:n},(_,i)=>strobeFixtureRole(i,n,0,phase)).includes('lead'));
});
test('the same rhythmic slot recalls the same pair after a missing attack, without inventing that attack',()=>{
 const p=song(),a=sample(p,1.05,32),b=sample(p,3.05,32);
 assert.deepEqual(a.filter(c=>c.fixtureRole==='lead').map(c=>c.level),b.filter(c=>c.fixtureRole==='lead').map(c=>c.level));
 assert.equal(strobeScoreAt(p,2.55).music.active.filter(e=>e.role==='lead').length,0);
});
test('crosses, fans, parallel rays and wings are distinct full stage pictures',()=>{
 const base=strobeScoreAt(song(),1.05),poses=formation=>Array.from({length:8},(_,rank)=>strobeComposition(
  {...base,music:{...base.music,sequence:{...base.music.sequence,formation}}},rank,8));
 const cross=poses('cross'),fan=poses('fan'),parallel=poses('parallel'),wings=poses('wings');
 assert.ok(cross[0].x>.5&&cross.at(-1).x<.5);
 assert.ok(fan[0].x<.5&&fan.at(-1).x>.5);
 assert.ok(parallel.every(c=>c.x===.5));
 assert.equal(new Set(wings.map(c=>c.x)).size,2);
 assert.notDeepEqual(cross.map(c=>[c.x,c.y]),fan.map(c=>[c.x,c.y]));
});
test('a configured movement area constrains parallel rays without collapsing them into one floor spot',()=>{
 const room=newRoomPlan(10,8,4),p=song(),base=strobeScoreAt(p,1.05);
 const motion={...base,music:{...base.music,sequence:{...base.music.sequence,formation:'parallel'}}};
 const lights=Array.from({length:4},(_,i)=>{
  const position={x:-3+i*2,y:6,height:3,type:'moving',rotation:0};
  room.positions['h'+i]={...position,motionArea:{x:.1,y:.05,width:.8,depth:.9}};
  return {id:'h'+i,type:'moving',position,target:{x:0,y:2},motionUV:{x:.5,y:.5},power:.8,
   movingPresenceBasePower:.8,movingPresence:{level:1,spread:1,groupMotion:motion},motionPresentation:'strobe'};
 });
 const mapped=applyRoomPlan({layout:{width:10,depth:8,positions:{}},lights},room).lights;
 mapped.forEach(l=>{
  assert.ok(Math.abs(l.target.x-l.position.x)<1e-8,'parallel rays retain each mount’s horizontal origin');
  assert.ok(l.target.x>=-4&&l.target.x<=4&&l.target.y>=.4&&l.target.y<=7.6,'the saved area remains authoritative');
 });
});
