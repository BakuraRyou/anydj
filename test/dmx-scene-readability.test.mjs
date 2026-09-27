import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneReadability} from '../public/dmx-scene-readability.js';
import {planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupScore,automaticGroupMotionAt,groupComposition,presenceRowFocus} from '../public/dmx-group-motion.js';
import {applyMovingPresence} from '../public/dmx-activity.js';
function song(energies=[.5,.55,.9,.5]){
 const sections=energies.map((energy,i)=>({start:i*8,end:(i+1)*8,look:'flow',motif:i%2,intensity:energy}));
 const p={duration:energies.length*8,sections,beatGrid:{downbeats:Array.from({length:energies.length*4},(_,i)=>i*2)},structure:{segments:sections.map((s,i)=>({...s,label:i%2?'verse':'chorus'}))},arrangement:{patterns:{phrases:sections.map(s=>({...s,energy:s.intensity,tone:.5,movement:{driving:.55}}))}}};
 return {...p,songMovement:planSongMovement(p)};
}
const light=(i,x=0)=>({id:'h'+i,type:'moving',motionPresentation:'auto',position:{x:i%2?1:-1,y:3,height:3},target:{x,y:2,z:0},power:.8,color:'#33aacc',sceneGain:1,sceneLead:1});
test('surface overlap limits only crowded receiving surfaces and retains bright lead beams',()=>{
 const separated=Array.from({length:8},(_,i)=>light(i,i*4));
 assert.ok(sceneReadability(separated).every(l=>l.surfaceGain===1&&l.power===.8));
 const input=Array.from({length:12},(_,i)=>light(i)),saved=structuredClone(input),result=sceneReadability(input);
 assert.ok(result.every(l=>l.surfaceGain<1&&l.surfaceGain>=.55));
 assert.ok(result.every(l=>l.power===.8&&l.color==='#33aacc'));
 assert.deepEqual(input,saved);
 assert.deepEqual(sceneReadability(input.map(l=>({...l,motionPresentation:'party'}))),input.map(l=>({...l,motionPresentation:'party'})));
 assert.ok(sceneReadability(input.map(l=>({...l,power:0}))).every(l=>l.power===0));
});
test('only accompanying beams yield where routed footprints overlap the main figure',()=>{
 const main=light(0),support={...light(1),sceneLead:0,sceneGain:.84};
 const [a,b]=sceneReadability([main,support]);
 assert.equal(a.power,main.power);assert.ok(b.power<support.power);
 assert.deepEqual(b.target,support.target);
 const otherWall={...support,targetSurface:'wall',wallIndex:0};
 assert.equal(sceneReadability([main,otherWall])[1].power,support.power);
});
test('lead selection stays inside the occupied rows and preserves source strength and blackouts',()=>{
 const p=song(),motion=automaticGroupMotionAt(p,3),presence={level:1,mask:'show-score',spread:1,rowSelection:4,rowFraction:.5,groupMotion:motion};
 const focus=Array.from({length:6},(_,row)=>presenceRowFocus(presence,row,6));
 assert.ok([4,5,0].some(row=>focus[row].gain===1));
 assert.ok([4,5,0].some(row=>focus[row].gain<1));
 const lights=Array.from({length:48},(_,i)=>({...light(i),position:{x:i%8,y:Math.floor(i/8)*3,height:3},movingPresence:presence,movingPresenceBasePower:.8}));
 const result=applyMovingPresence(lights);
 assert.equal(Math.max(...result.map(l=>l.power)),.8);
 assert.ok(result.some(l=>l.power>0&&l.power<.8));
 assert.ok(applyMovingPresence(lights.map(l=>({...l,movingShutter:0}))).every(l=>l.power===0));
 assert.ok(applyMovingPresence(lights.map(l=>({...l,movingPresenceBasePower:0}))).every(l=>l.power===0));
 assert.equal(presenceRowFocus(presence,0,1).gain,1);
});
test('song contrast reserves full spatial reach for the climax, uniform loudness does not invent one',()=>{
 const score=song().songMovement.passages;
 assert.ok(score.some(s=>s.staging.climax&&s.staging.space===1));
 assert.ok(score.some(s=>!s.staging.climax&&s.staging.space<1));
 assert.ok(song([.9,.9,.9,.9]).songMovement.passages.every(s=>!s.staging.climax));
});
test('a returning chorus recalls geometry and develops a bounded geometric variant',()=>{
 const p=song([.55,.5,.55,.5]),parts=p.songMovement.passages;
 assert.equal(parts[0].composition,parts[2].composition);
 assert.equal(parts[0].theme.key,parts[2].theme.key);
 assert.equal(parts[2].theme.occurrence,1);
 const motion={...automaticGroupMotionAt(p,3),progress:.4,phase:1};
 const a=groupComposition(motion,0,8,0,3),b=groupComposition({...motion,theme:parts[2].theme},0,8,0,3);
 assert.ok(Math.abs(a.x-b.x)>.001&&Math.abs(a.x-b.x)<.05);
 assert.equal(a.level,b.level);
});
test('entrance fitting reduces pose and velocity mismatch deterministically without mutating analysis',()=>{
 const p=song([.55,.9,.6,.85,.45]),saved=JSON.stringify(p),score=automaticGroupScore(p);
 const fits=score.filter(s=>s.transitionFit);
 assert.ok(fits.length>0&&fits.some(s=>s.transitionFit.after<s.transitionFit.before-.001));
 assert.ok(fits.every(s=>s.transitionFit.after<=s.transitionFit.before));
 assert.deepEqual(automaticGroupScore(JSON.parse(saved)),score);
 assert.equal(JSON.stringify(p),saved);
 for(const time of [29,3,17,29])assert.deepEqual(automaticGroupMotionAt(p,time),automaticGroupMotionAt(JSON.parse(saved),time));
});

test('shared desktop and VR geometry applies receiving-surface gain without dimming the beam or lens',async()=>{
 const {drawStageGeometry}=await import('../public/dmx-stage-3d-renderer.js');
 const render=surfaceGain=>{
  const result={surfaces:[],beams:[],lenses:[]};
  drawStageGeometry({width:8,depth:6,height:4,room:true,positions:{}},[{...light(0),surfaceGain}],[],0,{
   polygon(){},surfacePatch(p,color,strength){result.surfaces.push(strength);},beam(a,b,r,c,strength){result.beams.push(strength);return true;},lens(p,r,c,power){result.lenses.push(power);}
  });return result;
 };
 const normal=render(1),limited=render(.6);
 assert.ok(normal.surfaces.length>0&&normal.beams.length>0);
 assert.deepEqual(limited.beams,normal.beams);assert.deepEqual(limited.lenses,normal.lenses);
 limited.surfaces.forEach((v,i)=>assert.ok(Math.abs(v-normal.surfaces[i]*.6)<1e-9));
});
test('spatial readability remains symmetric after room motors and protected-zone routing',async()=>{
 const {createRoomPreview,newRoomPlan}=await import('../public/dmx-ar-model.js');
 const {movingPresenceAt}=await import('../public/dmx-activity.js');
 const p=song(),room=newRoomPlan(12,10,4);
 for(let row=0;row<3;row++)for(let rank=0;rank<8;rank++)room.positions[`r${row}h${rank}`]={type:'moving',x:(rank-3.5)*1.2,y:2+row*3,height:3.5,rotation:0,size:{width:.3,depth:.3,height:.4}};
 room.zones=[{id:'quiet',name:'Ruhezone',x:.42,y:.65,width:.16,depth:.15}];
 const preview=createRoomPreview();
 for(let tick=0;tick<90;tick++){
  const t=2+tick/30,presence=movingPresenceAt({movingPlan:p,movingMood:'balanced',songTime:t});
  const lights=Object.entries(room.positions).map(([id,position])=>({id,type:'moving',position,target:{x:0,y:4},motionUV:{x:.5,y:.5},motionPresentation:'auto',color:'#ffcc44',power:.8,movingPresenceBasePower:.8,movingPresence:presence}));
  const output=preview({layout:{width:12,depth:10,positions:room.positions},crowd:[],lights},room,false,t).lights;
  for(const l of output){
   assert.ok(Number.isFinite(l.target.x)&&Number.isFinite(l.target.y)&&l.power>=0&&l.power<=.8);
   assert.ok((l.surfaceGain??1)>=.55&&(l.surfaceGain??1)<=1);
  }
  // Groups are physical rows, so counterpart weights must remain identical.
  for(let row=0;row<3;row++)for(let rank=0;rank<4;rank++){
   const a=output.find(l=>l.id===`r${row}h${rank}`),b=output.find(l=>l.id===`r${row}h${7-rank}`);
   assert.ok(Math.abs(a.sceneGain-b.sceneGain)<1e-9);
   assert.ok(Math.abs(a.power-b.power)<1e-7);
  }
 }
});
