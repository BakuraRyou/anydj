import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticVisualFamily,selectAutomaticSequence,planSongMovement} from '../public/song-movement-plan.js';
import {automaticGroupMotionAt,automaticGroupScore,groupComposition} from '../public/dmx-group-motion.js';
const roles=['breath','sweep','opening','wave','exchange','settle'];
function sample(sequence,phase,rank=0,row=0,count=8,groups=4,progress=.5){
 return groupComposition({composition:'auto-vaults-unison',sequence,phase,progress,sceneProgress:progress,amount:1,energy:.6,drive:.6,intent:{symmetry:'paired',surface:'floor'}},rank,count,row,groups);
}
test('near silhouettes share history across legacy and expanded catalog',()=>{
 for(const names of [['auto-vaults-staggered','auto-crowns-staggered','staggered-columns'],['auto-polygons-staggered','auto-comets-staggered'],['auto-vaults-lanes','auto-crowns-lanes','unison-sweep']]){
  assert.equal(new Set(names.map(automaticVisualFamily)).size,1);
 }
});
test('musical function limits roles before repetition avoidance',()=>{
 const p={start:24,end:40,kind:'groove',energy:.8,drive:.8,vocals:.2};
 assert.equal(selectAutomaticSequence({...p,kind:'build'}),'opening');
 assert.equal(selectAutomaticSequence({...p,kind:'silence'}),null);
 assert.equal(selectAutomaticSequence({...p,kind:'sculpture',developing:false}),null);
 assert.equal(selectAutomaticSequence({...p,energy:.35,drive:.3},{energy:.85}),'settle');
 const history=[];
 for(let i=0;i<8;i++){
  const calm={...p,start:i*16,end:i*16+16,energy:.3,drive:.2};
  const sequence=selectAutomaticSequence(calm,null,history);
  assert.ok(['breath','sweep'].includes(sequence),'history must not force busy exchange into quiet music');
  history.push({...calm,sequence});
 }
 assert.equal(new Set(history.map(h=>h.sequence)).size,2);
});
test('roles change occupancy and development, keeping partners together without blackout',()=>{
 for(const role of roles)for(const count of [2,3,8,32])for(const groups of [1,4])for(let t=0;t<Math.PI*2;t+=.2){
  let sum=0;
  for(let row=0;row<groups;row++)for(let rank=0;rank<count;rank++){
   const a=sample(role,t,rank,row,count,groups),b=sample(role,t,count-1-rank,row,count,groups),next=sample(role,t+.0001,rank,row,count,groups);
   assert.ok(Math.abs(a.x+b.x-1)<1e-9&&Math.abs(a.y-b.y)<1e-9&&a.level===b.level);
   assert.ok(a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1&&a.level>=.3);
   assert.ok(Math.hypot(next.x-a.x,next.y-a.y)<.001&&Math.abs(next.level-a.level)<.001);
   sum+=a.level;
  }
  assert.ok(sum>=count*groups*.3);
 }
 const bright=sample('exchange',Math.PI/2,0,0),support=sample('exchange',Math.PI/2,0,1);
 assert.ok(bright.level-support.level>.6,'adjacent rows have distinct lead/support roles');
 assert.ok(sample('exchange',Math.PI*1.5,0,1).level>sample('exchange',Math.PI*1.5,0,0).level,'lead transfers');
 assert.equal(sample('sweep',1).level,1,'shared sweep does not add intensity modulation');
 assert.ok(sample('wave',0,0).level>sample('wave',0,3).level+.4,'wave travels across mirrored pairs');
 const opening=p=>groupComposition({composition:'auto-vaults-unison',sequence:'opening',coordination:'build',progress:p,sceneProgress:p,phase:1,amount:1,intent:{symmetry:'paired'}},0,8,0,4);
 assert.ok(opening(.9).x<opening(.2).x-.1,'build expands over the passage rather than repeating a cycle');
});
function song(){
 const energy=[.5,.53,.8,.82,.4,.55,.9,.6];
 const p={duration:96,sections:energy.map((e,i)=>({start:i*12,end:i*12+12,look:'flow',motif:1,intensity:e})),arrangement:{patterns:{phrases:energy.map((e,i)=>({start:i*12,end:i*12+12,energy:e,tone:.45,movement:{driving:.65}}))}}};
 p.songMovement=planSongMovement(p);return p;
}
test('live expanded score carries roles, with continuous geometry and levels at every handover',()=>{
 const p=song(),score=automaticGroupScore(p,true);
 assert.ok(new Set(score.map(s=>s.sequence)).size>=3);
 assert.deepEqual(score,automaticGroupScore(structuredClone(p),true));
 assert.ok(automaticGroupScore(p).every(s=>!s.sequence),'Show keeps its existing score');
 for(const part of score.slice(1))for(const offset of [0,.1,.7,1.4]){
  const time=part.start+offset;
  const a=automaticGroupMotionAt(p,time-1e-5,true),b=automaticGroupMotionAt(p,time+1e-5,true);
  if(!a||!b)continue;
  for(let row=0;row<4;row++)for(let rank=0;rank<8;rank++){
   const x=groupComposition(a,rank,8,row,4),y=groupComposition(b,rank,8,row,4);
   assert.ok(Math.hypot(x.x-y.x,x.y-y.y)<.001,`position at ${time}`);
   assert.ok(Math.abs(x.level-y.level)<.001,`occupancy at ${time}`);
  }
 }
});
test('group exchange reaches physical fixture intensity after room grouping',async()=>{
 const {applyMovingPresence}=await import('../public/dmx-activity.js');
 const lights=phase=>Array.from({length:16},(_,i)=>({id:`fixture-${i}`,type:'moving',position:{x:i%8-3.5,y:Math.floor(i/8)*4},power:1,movingPresenceBasePower:1,movingPresence:{level:1,mask:'all',rowFraction:1,rowSelection:0,groupMotion:{composition:'auto-vaults-unison',sequence:'exchange',phase,progress:.5,amount:1,energy:.6,drive:.6,intent:{symmetry:'paired',surface:'floor'}}}}));
 const before=applyMovingPresence(lights(Math.PI/2)),after=applyMovingPresence(lights(Math.PI*1.5));
 assert.ok(before[0].power>before[8].power+.5);
 assert.ok(after[8].power>after[0].power+.5);
 for(let i=0;i<16;i++)assert.ok(before[i].power>0&&after[i].power>0,'support remains visible');
});
