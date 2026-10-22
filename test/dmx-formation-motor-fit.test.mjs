import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationAction} from '../public/dmx-formation-actions.js';
import {combinedFormationRoom} from '../public/dmx-room-presets.js';
import {createRoomPreview,applyRoomPlan,roomMusicalAim,alignRoomFormation} from '../public/dmx-ar-model.js';

const beat=.47,beats=Array.from({length:80},(_,i)=>i*beat),timeline={roles:{lead:beats.map(time=>({time,strength:.9})),drums:[],bass:[]}};
const plan={beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)}};
const storyFor=(shape,start=0,end=beat*16)=>{
 const story={start,end,arcStart:start,arcEnd:end,motion:'dialogue',shape,direction:1,energy:.8,knots:[{time:start,position:0},{time:end,position:1}],
  musicalEvidence:{texture:'drums',energy:.8,movementDrive:.9}};
 return {...story,action:planFormationAction(story,plan,timeline)};
};
test('a wide crossing has two full bars on both sides of a turn even when it starts on an odd bar',()=>{
 const start=beat*4,story=storyFor('open-fan',start,start+beat*16),path=story.action.path;
 for(const shape of ['open-fan','crossed-fans','braided-ribbons','double-helix','diamond','hourglass']){
  const path=storyFor(shape,start,start+beat*16).action.path;
  assert.equal(path.length,3);
  for(let i=1;i<path.length;i++)assert.ok(path[i].time-path[i-1].time>=beat*8-1e-9,shape);
 }
 const compact=storyFor('parallel-lines',start,start+beat*16);
 assert.ok(compact.action.path.length>path.length,'compact formations keep their faster musical statements');
 assert.deepEqual(story.action.cues,compact.action.cues,'group answers stay on the same source hits');
});
const axis=light=>{
 const d=[light.target.x-light.position.x,light.target.y-light.position.y,(light.target.z??0)-(light.emissionHeight??light.position.height)],length=Math.hypot(...d);
 return d.map(v=>v/length);
};
test('low side banks on the combined stage reach the wide crossing without falling behind the beat',()=>{
 const room=combinedFormationRoom();assert.deepEqual(room.zones,[]);
 const original=JSON.stringify(room),story=storyFor('open-fan'),preview=createRoomPreview(),dt=1/60;
 const source=time=>({layout:{width:8,depth:6,positions:{}},crowd:[],lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
  motionPresentation:'strobe',power:1,color:'#fff',movingPresenceBasePower:1,movingShutter:1,movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,
   groupMotion:{presentation:'strobe',flicker:53,music:{sequence:{start:story.start,end:story.end,time,age:time,role:'groove',sharedPassage:{},formationId:story.shape,formationProgram:{kind:'dialogue'},formationStory:story}}}}}]});
 let peakError=0,arrivalError=0,samples=0;
 for(let i=0;i<=Math.floor(story.end/dt);i++){
  const time=i*dt,scene=source(time),future=source(time+.12).lights[0];
  scene.lights[0].motionAhead={seconds:.12,target:future.target,motionUV:future.motionUV,movingPresence:future.movingPresence};
  const raw=applyRoomPlan(scene,room),ideal=alignRoomFormation(raw.lights.map(l=>roomMusicalAim(l,raw.layout,room)),raw.layout);
  const actual=preview(scene,room,false,time);
  if(time<1)continue;
  for(let j=0;j<actual.lights.length;j++){
   const a=actual.lights[j];if(!a.id.startsWith('combined-formation-arena-0-'))continue;
   const x=axis(a),y=axis(ideal[j]),error=Math.acos(Math.max(-1,Math.min(1,x.reduce((sum,v,k)=>sum+v*y[k],0))))*180/Math.PI;
   peakError=Math.max(peakError,error);samples++;
   if(story.action.path.some(p=>Math.abs(time-p.time)<dt/2))arrivalError=Math.max(arrivalError,error);
  }
 }
 assert.ok(samples>1000);assert.ok(peakError<8,`side banks must not trail a crossing by tens of degrees: ${peakError}`);
 assert.ok(arrivalError<2,`the beam picture must arrive on its musical cue: ${arrivalError}`);
 assert.equal(JSON.stringify(room),original);
});

test('continuous low fans remain within real side-bank motor limits',()=>{
 const room=combinedFormationRoom();assert.deepEqual(room.zones,[]);
 const original=JSON.stringify(room),base=storyFor('nested-gates');
 const seed={...base,motion:'bloom',opening:[{time:0,position:1},{time:base.end,position:1}],
  musicalEvidence:{texture:'bass',energy:.85,movementDrive:.85,bass:.9,drums:.2,density:.65,tone:.25}};
 const story={...seed,action:planFormationAction(seed,plan,{roles:{...timeline.roles,bass:timeline.roles.lead}})},preview=createRoomPreview(),dt=1/60;
 assert.ok(story.action.trajectory);
 const source=time=>({layout:{width:8,depth:6,positions:{}},crowd:[],lights:[{id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
  motionPresentation:'strobe',power:1,color:'#fff',movingPresenceBasePower:1,movingShutter:1,movingPresence:{level:1,spread:1,mask:'all',rowFraction:1,rowSelection:0,trackMotion:true,
   groupMotion:{presentation:'strobe',flicker:53,music:{sequence:{start:story.start,end:story.end,time,age:time,role:'groove',sharedPassage:{},formationId:story.shape,formationProgram:{kind:'dialogue'},formationStory:story}}}}}]});
 let peakError=0,arrivalError=0,samples=0;
 for(let i=0;i<=Math.floor(story.end/dt);i++){
  const time=i*dt,scene=source(time),future=source(time+.12).lights[0];
  scene.lights[0].motionAhead={seconds:.12,target:future.target,motionUV:future.motionUV,movingPresence:future.movingPresence};
  const raw=applyRoomPlan(scene,room),ideal=alignRoomFormation(raw.lights.map(l=>roomMusicalAim(l,raw.layout,room)),raw.layout);
  const actual=preview(scene,room,false,time);
  if(time<1)continue;
  for(let j=0;j<actual.lights.length;j++){
   const a=actual.lights[j];if(!a.id.startsWith('combined-formation-arena-0-'))continue;
   const x=axis(a),y=axis(ideal[j]),error=Math.acos(Math.max(-1,Math.min(1,x.reduce((sum,v,k)=>sum+v*y[k],0))))*180/Math.PI;
   peakError=Math.max(peakError,error);samples++;
   if(story.action.path.some(p=>Math.abs(time-p.time)<dt/2))arrivalError=Math.max(arrivalError,error);
  }
 }
 assert.ok(samples>1000);assert.ok(peakError<8,`side banks must not trail a crossing by tens of degrees: ${peakError}`);
 assert.ok(arrivalError<2,`the beam picture must arrive on its musical cue: ${arrivalError}`);
 assert.equal(JSON.stringify(room),original);
});
