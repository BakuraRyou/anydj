import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeScoreAt,strobeComposition,strobeFixtureRole} from '../public/dmx-strobe-score.js';
import {createRoomMotors,roomBeamHit} from '../public/dmx-light-geometry.js';
import {newRoomPlan,roomPlanLayout} from '../public/dmx-ar-model.js';

const song=()=>({duration:16,showProfile:'strobe',showScore:[
 {start:0,end:8,role:'groove',rhythmic:true,energy:.8,tone:.5,form:'cross'},
 {start:8,end:16,role:'groove',rhythmic:true,energy:.8,tone:.5,form:'parallel'}],
 sections:[{start:0,end:16,look:'peak'}],beatGrid:{beats:Array.from({length:33},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10,12,14]},
 arrangement:{times:Array.from({length:32},(_,i)=>i*.5),accents:Array(32).fill(.6),eventSources:Array(32).fill('onset')}});
const row=(plan,time,count=8,extra={})=>Array.from({length:count},(_,i)=>strobeComposition({...strobeScoreAt(plan,time),...extra},i,count));
test('fixture roles hold their own directions while musical attacks change visibility',()=>{
 const plan=song(),a=row(plan,1.1),b=row(plan,1.45);
 assert.deepEqual(a.map(c=>[c.x,c.y]),b.map(c=>[c.x,c.y]));
 assert.notDeepEqual(a.map(c=>c.level),b.map(c=>c.level));
 assert.equal(new Set(a.map(c=>c.fixtureRole)).size,4);
 assert.ok(new Set(a.map(c=>`${c.x},${c.y}`)).size>=4,'roles hold distinct beam directions; parallel answers may share an angle');
 assert.ok(a.some(c=>c.level===0)&&b.some(c=>c.level===0),'inactive heads are completely shuttered');
});
test('most heads stay dark on both small and large rigs, without losing every beam',()=>{
 const plan=song();
 for(const count of [4,8,32,128]){
  let lit=0,total=0,all=0;
  for(let frame=60;frame<480;frame++){
   const values=row(plan,frame/60,count),visible=values.filter(c=>c.level>.01).length;
   assert.ok(visible>0,'the supporting role retains light');
   if(visible===count)all++;
   lit+=visible;total+=count;
  }
  assert.ok(lit/total<.65,`${count} heads: light is a selected formation, not a dim full rig`);
  assert.equal(all,0);
 }
});
test('answers require melody evidence and strong accents require contrast',()=>{
 const plan=song(),early=row(plan,1.05,8),echo=row(plan,1.25,8),late=row(plan,1.47,8);
 assert.ok(early[0].level>0&&early[1].level===0);
 assert.equal(echo[1].level,0,'a drum beat cannot invent a melodic answer');
 assert.ok(late[0].level===0&&late[3].level>0);
 assert.equal(strobeFixtureRole(2,8),'accent');
 const uniform=song();uniform.arrangement.accents.fill(.95);
 assert.equal(row(uniform,1.05,8)[2].level,0,'uniform loud beats are not exceptional accents');
 const loud=song();loud.arrangement.accents[2]=.95;
 assert.ok(row(loud,1.05,8)[2].level>0);
 assert.equal(row(loud,1.4,8)[2].level,0);
});
test('picture changes reposition roles in darkness and seeking restores the exact state',()=>{
 const plan=song();plan.showScore[1].role='arrival';
 const changed=row(plan,8.2,8),lead=changed.find(c=>c.fixtureRole==='lead');assert.equal(lead.level,0);
 const support=row(plan,8.4,8).find(c=>c.fixtureRole==='support');assert.ok(support.level>0,'accompaniment enters on the lead release');
 assert.notDeepEqual(row(plan,2,8).map(c=>c.fixtureRole),changed.map(c=>c.fixtureRole),'complete pairs exchange roles on a contrasting musical arrival');
 const sample=row(plan,8.8,4);row(plan,15,4);assert.deepEqual(row(plan,8.8,4),sample);
 const held=song();held.sectionLighting=[{start:1,end:16,movement:0,rhythm:'auto'}];
 assert.deepEqual(row(held,9,4).map(c=>[c.x,c.y]),row(held,2,4).map(c=>[c.x,c.y]));
});
test('flicker zero holds a sparse picture and manual rhythm none stops the pulse sequence',()=>{
 const plan=song();
 assert.deepEqual(row(plan,1.05,8,{flicker:0}),row(plan,1.4,8,{flicker:0}));
 const held=song();held.sectionLighting=[{start:0,end:16,rhythm:'none',movement:1}];
 assert.deepEqual(row(held,1.05).map(c=>c.level),row(held,1.4).map(c=>c.level));
 for(const count of [1,2,3])assert.ok(row(plan,1.05,count).some(c=>c.level>0));
});
test('real room motors hide an unfinished Strobo reposition and reopen after settling',()=>{
 const plan=newRoomPlan(10,10,4);plan.positions.head={x:0,y:8,height:3,type:'moving'};
 const layout=roomPlanLayout(plan),motors=createRoomMotors();
 const fixture={id:'head',type:'moving',position:plan.positions.head,motionPresentation:'strobe',movingGroupActive:true,power:1};
 const aim=direction=>({...fixture,...roomBeamHit(layout,[0,8,3],direction)});
 motors(aim([0,-1,-.3]),layout,0);
 const changed=aim([.65,-1,-.8]),moving=motors(changed,layout,.01);
 assert.equal(moving.power,0,'real motor progress controls reopening');
 let last;for(let i=2;i<240;i++)last=motors(changed,layout,i/60);
 assert.equal(last.power,1);
 assert.ok(Math.hypot(last.target.x-changed.target.x,last.target.y-changed.target.y)<.01);
});
