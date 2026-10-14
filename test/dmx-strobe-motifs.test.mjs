import test from 'node:test';
import assert from 'node:assert/strict';
import {STROBE_MOTIFS,motifExposure,strobeRole,strobeRoleColor} from '../public/dmx-strobe-motifs.js';
import {strobeComposition,strobeScoreAt} from '../public/dmx-strobe-score.js';
const figure={motifId:'exchange',form:17,kind:'groove',progress:.5,energy:.8,amount:1};
const mask=(f,beat,row=0,groups=1,count=8)=>Array.from({length:count},(_,rank)=>motifExposure({...f,rhythmBeat:beat},rank,count,row,groups));
test('held motors reveal different formations with a repeatable sentence and intentional rests',()=>{
 const a=Array.from({length:8},(_,rank)=>strobeComposition({...figure,rhythmBeat:.2,progress:.1},rank,8));
 const b=Array.from({length:8},(_,rank)=>strobeComposition({...figure,rhythmBeat:1.2,progress:.9},rank,8));
 assert.deepEqual(a.map(c=>[c.x,c.y]),b.map(c=>[c.x,c.y]));
 assert.notDeepEqual(a.map(c=>c.level),b.map(c=>c.level));
 assert.deepEqual(mask(figure,.2),mask(figure,8.2));
 assert.ok(mask(figure,2.2).every(v=>v===0));
});
test('changing geometry does not change event order or exposure',()=>{
 for(let form=0;form<20;form++)for(const beat of [.2,1.2,1.9,3.6]){
  const levels=f=>Array.from({length:8},(_,rank)=>strobeComposition({...figure,form:f,rhythmBeat:beat},rank,8).level);
  assert.deepEqual(levels(form),levels(17));
 }
});
test('physical rows lead, answer and accent at different entrances',()=>{
 assert.ok(mask(figure,.2,0,3).some(v=>v>0));
 assert.ok(mask(figure,.2,1,3).every(v=>v===0));
 assert.ok(mask(figure,1.9,1,3).some(v=>v>0));
 assert.ok(mask(figure,1.9,0,3).every(v=>v===0));
 assert.ok(mask(figure,.2,2,3).every(v=>v===0));
 assert.ok(mask({...figure,accentLevel:.8},.2,2,3).every(v=>v===.8));
});
test('nearby measured attacks adjust entrance time without filling the authored rest',()=>{
 const f={...figure,attackBeats:[.18]};
 assert.ok(mask(f,.1).every(v=>v===0));
 assert.ok(mask(f,.3).some(v=>v>0));
 assert.ok(mask({...f,attackBeats:[.18,2.2]},2.2).every(v=>v===0));
});
test('all motifs have visible lead and answer events on small and uneven rigs',()=>{
 for(const motifId of Object.keys(STROBE_MOTIFS))for(const counts of [[1],[2],[3],[4],[8],[1,3,8]]){
  const seen=new Set();let lit=0;
  for(let tick=0;tick<320;tick++)counts.forEach((count,row)=>{
   mask({...figure,motifId,accentLevel:.6},tick/40,row,counts.length,count).forEach((level,rank)=>{
    assert.ok(Number.isFinite(level)&&level>=0&&level<=1);
    if(level>0){lit++;seen.add(strobeRole(rank,count,row,counts.length));}
   });
  });
  assert.ok(lit>0,motifId);
  assert.ok(seen.has('lead'));
  if(counts.length>1||counts[0]>=3)assert.ok(seen.has('answer'),`${motifId} missing answer`);
 }
});
test('role colors retain brightness and create stable contrast',()=>{
 const base=[30,100,255];
 assert.deepEqual(strobeRoleColor(base,'lead'),base);
 assert.notDeepEqual(strobeRoleColor(base,'answer'),base);
 for(const role of ['lead','answer','accent'])assert.equal(Math.max(...strobeRoleColor(base,role)),255);
});
test('accent entrances come from analysis events and seeking restores exact state',()=>{
 const plan={duration:16,sections:[{start:0,end:16,look:'peak'}],beatGrid:{beats:Array.from({length:33},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10,12,14]},arrangement:{times:[3.3],accents:[.7],drama:{step:1,intensity:Array(16).fill(.9),percussion:Array(16).fill(.9)}}};
 assert.equal(strobeScoreAt(plan,3.2).accentLevel,0);
 assert.ok(strobeScoreAt(plan,3.35).accentLevel>0);
 assert.equal(strobeScoreAt(plan,3.6).accentLevel,0);
 const before=strobeScoreAt(plan,3.35);strobeScoreAt(plan,12);assert.deepEqual(strobeScoreAt(plan,3.35),before);
});
test('room expansion assigns color roles to physical rows rather than copied source roles',async()=>{
 const {applyRoomPlan,newRoomPlan}=await import('../public/dmx-ar-model.js');
 const room=newRoomPlan(8,6,4),base=[30,100,255];
 const lights=Array.from({length:9},(_,i)=>{
  const position={x:(i%3-1)*2,y:1+Math.floor(i/3)*2,height:3};
  room.positions['h'+i]={...position,type:'moving',rotation:0,group:'row'+Math.floor(i/3)};
  return {id:'h'+i,type:'moving',position,target:{x:0,y:2},motionUV:{x:.5,y:.5},motionPresentation:'strobe',strobeColor:base,color:'rgb(30,100,255)',power:1,movingPresenceBasePower:1,movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,trackMotion:true,groupMotion:{...figure,presentation:'strobe',rhythmBeat:.2}},movingShutter:1};
 });
 const scene={layout:{width:8,depth:6,positions:{}},lights};
 const output=applyRoomPlan(scene,room).lights.filter(l=>l.type==='moving');
 assert.ok(new Set(output.map(l=>l.color)).size>=2);
 const again=applyRoomPlan(scene,room).lights.filter(l=>l.type==='moving');
 assert.deepEqual(output.map(l=>l.color),again.map(l=>l.color));
});
