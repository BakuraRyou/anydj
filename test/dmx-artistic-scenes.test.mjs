import test from 'node:test';
import assert from 'node:assert/strict';
import {planArtisticScenes,SONG_MOVEMENT_VERSION} from '../public/song-movement-plan.js';
import {artisticPose,groupComposition,automaticGroupMotionAt,showGroupMotionAt} from '../public/dmx-group-motion.js';
const names=['blossom','architecture','braid','dialogue','dissolve'];
const passage=(start,role='groove',extra={})=>({start,end:start+12,motion:'unison-sweep',composition:'parallel-sweep',role,energy:.5,drive:.5,...extra});
test('each artistic scene requires matching musical evidence',()=>{
 const fixtures=[
  [passage(0),passage(12,'build')],
  [passage(0),passage(12,'sweep',{drive:.3})],
  [passage(0),passage(12,'groove',{energy:.65,drive:.7})],
  [passage(0,'groove',{attention:{leader:'vocals',confidence:.8}}),passage(12,'groove',{attention:{leader:'other',confidence:.8}})],
  [passage(0,'groove',{energy:.7}),passage(12,'groove',{energy:.4})]
 ];
 fixtures.forEach((parts,i)=>{
  const tail=Array.from({length:8},(_,j)=>passage(24+j*12));
  planArtisticScenes([...parts,...tail]);assert.equal(parts[1].artisticScene?.name,names[i]);
 });
 const quiet=Array.from({length:8},(_,i)=>passage(i*12,'silence',{motion:null}));
 planArtisticScenes(quiet);assert.ok(quiet.every(p=>!p.artisticScene));
});
test('artistic scenes remain sparse, repeatable and stable after serialization',()=>{
 const source=Array.from({length:40},(_,i)=>passage(i*12,i%4===0?'build':'groove',{energy:.8,drive:.75}));
 const a=planArtisticScenes(structuredClone(source)),b=planArtisticScenes(structuredClone(source));
 assert.deepEqual(a,b);assert.deepEqual(planArtisticScenes(JSON.parse(JSON.stringify(a))),a);
 const scenes=a.filter(p=>p.artisticScene);
 assert.ok(scenes.length>1);assert.ok(scenes.length*12<=480*.25);
 for(let i=1;i<scenes.length;i++)assert.ok(scenes[i].start-scenes[i-1].end>=24);
});
test('all five scenes stay symmetric and continuous with a distinct passage arc',()=>{
 const signatures=new Set();
 for(const name of names){
  const art={name,strength:.85};
  const at=(p,rank,count=8,row=0)=>groupComposition({composition:'parallel-sweep',progress:.5,phase:1,sceneProgress:p,intent:{symmetry:'paired',artisticScene:art}},rank,count,row,3);
  signatures.add(JSON.stringify([.25,.5,.75].flatMap(p=>[0,1,2].flatMap(row=>Array.from({length:8},(_,r)=>at(p,r,8,row))))));
  for(const count of [2,3,8,12])for(let i=0;i<=100;i++)for(let rank=0;rank<count;rank++){
   const p=i/100,a=at(p,rank,count),b=at(p,count-1-rank,count),next=at(Math.min(1,p+1e-6),rank,count);
   assert.ok(a.x>=0&&a.x<=1&&a.y>=0&&a.y<=1);
   assert.ok(Math.abs(a.x+b.x-1)<1e-9);assert.equal(a.y,b.y);
   assert.ok(Math.hypot(a.x-next.x,a.y-next.y)<1e-4);
  }
  assert.equal(artisticPose(art,0,0,8).weight,0);assert.equal(artisticPose(art,1,0,8).weight,0);
  assert.deepEqual(at(0,0),at(1,0));
 }
 assert.equal(signatures.size,5);
});
test('manual holds freeze the artistic clock in both Automatic and Show',()=>{
 const p={duration:12,songMovement:{version:SONG_MOVEMENT_VERSION,passages:[passage(0,'build',{artisticScene:{name:'blossom',strength:.85}})]},sectionLighting:[{start:3,end:11,movement:0}]};
 assert.deepEqual(automaticGroupMotionAt(p,4),automaticGroupMotionAt(p,10));
 assert.deepEqual(showGroupMotionAt(p,4,{role:'build'}),showGroupMotionAt(p,10,{role:'build'}));
 const normal={...p,sectionLighting:[]};
 assert.notEqual(automaticGroupMotionAt(normal,4).sceneProgress,automaticGroupMotionAt(normal,10).sceneProgress);
});
