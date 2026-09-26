import test from 'node:test';
import assert from 'node:assert/strict';
import {applySectionLighting,sectionEditsFor} from '../public/section-lighting.js';
import {lightingScenes,scenePose,sceneVariants} from '../public/dmx-light-scenes.js';
import {movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {movingDevicePoses,projectMovingHeads} from '../public/dmx-layout-model.js';
import {createRoomPreview,newRoomPlan} from '../public/dmx-ar-model.js';
function example(scale=1){
 const looks=['quiet','flow','lift','peak','flow','break','flow'];
 const energies=[.2,.55,.55,.9,.5,.05,.55],drives=[.1,.8,.7,.9,.15,.05,.8];
 const sections=looks.map((look,i)=>({start:i*12*scale,end:(i+1)*12*scale,look,intensity:energies[i],motif:i===6?1:i}));
 const phrases=sections.map((s,i)=>({...s,section:i,energy:energies[i],tone:i===6?.9:.3,movement:{character:i===4?'atmospheric':'rhythmic',driving:drives[i]}}));
 const intensity=Array.from({length:84},(_,i)=>Math.floor(i/12)===2?.25+.65*(i%12)/11:energies[Math.floor(i/12)]);
 return {duration:84*scale,sections,beatGrid:{beats:Array.from({length:169},(_,i)=>i*.5*scale),downbeats:Array.from({length:43},(_,i)=>i*2*scale)},arrangement:{blackouts:[{start:60*scale,end:72*scale}],times:[],accents:[],patterns:{phrases},drama:{step:scale,intensity,percussion:Array.from({length:84},(_,i)=>drives[Math.floor(i/12)]),vocalShare:Array(84).fill(0),attacks:Array(84).fill(0)}}};
}
test('different musical situations select six distinct images across several tempos',()=>{
 for(const scale of [.75,1,1.4]){
  const plan=example(scale),before=structuredClone(plan),scenes=lightingScenes(plan);
  assert.deepEqual(scenes.map(s=>s.kind),['sculpture','groove','build','impact','sweep','silence','groove']);
  assert.equal(scenes[6].direction,scenes[1].direction);assert.equal(scenes[6].recalled,true);
  assert.deepEqual(plan,before);
 }
});
test('labels alone do not dictate the image; measured character and contrast matter',()=>{
 const kinds=[];
 for(const [energy,driving,character] of [[.2,.1,'rhythmic'],[.55,.8,'rhythmic'],[.5,.1,'atmospheric'],[.9,.9,'rhythmic']]){
  const plan={sections:[{start:0,end:20,look:'flow',intensity:energy}],arrangement:{patterns:{phrases:[{start:0,end:20,energy,movement:{driving,character}}]}}};
  kinds.push(lightingScenes(plan)[0].kind);
 }
 assert.deepEqual(kinds,['sculpture','groove','sweep','impact']);
});
test('occupancy and movement form the same picture; a groove answers without roaming',()=>{
 const plan=example(),scenes=lightingScenes(plan);
 const levels=time=>Array.from({length:7},(_,i)=>movingPresenceLevel(movingPresenceAt({movingPlan:plan,songTime:time,look:plan.sections.find(s=>time>=s.start&&time<s.end).look}),i,7));
 assert.ok(levels(5).filter(v=>v>0).length<=2);
 assert.equal(levels(41).filter(v=>v>0).length,7);
 assert.ok(levels(65).every(v=>v===0));
 const a=levels(12.5),b=levels(14.5);assert.notDeepEqual(a,b);
 assert.ok(a.every((v,i)=>v>0||b[i]>0),'both responses cover all seven heads');
 assert.deepEqual(scenePose(scenes[1],13),scenePose(scenes[1],21));
 const sum=a=>a.reduce((n,v)=>n+v,0);assert.ok(sum(levels(34))>sum(levels(26)));
 assert.notDeepEqual(scenePose(scenes[4],49),scenePose(scenes[4],58));
});
test('seven-device room projection retains distinct banks, parallel sweeps and high impact',()=>{
 const plan=example(),scenes=lightingScenes(plan),room=newRoomPlan(10,12,4);
 const devices=Array.from({length:7},(_,i)=>({id:'h'+i}));
 devices.forEach((d,i)=>room.positions[d.id]={type:'moving',x:i-3,y:10,height:2.5,rotation:0,size:{width:.34,depth:.34,height:.4}});
 const layout={width:10,depth:12,positions:room.positions};
 const signatures=[];
 for(const index of [0,1,2,3,4]){
  const scene={...scenes[index],...(index===1?{variant:'banks'}:index===4?{variant:'parallel'}:{})},time=scene.start+8;
  const mapped=movingDevicePoses(scenePose(scene,time),devices,{formation:'designed',layout});
  if(index===1){assert.equal(mapped[0].pan,mapped[1].pan);assert.notEqual(mapped[0].tilt,mapped[2].tilt);}
  if(index===4)assert.ok(mapped.every(p=>p.pan===mapped[0].pan&&p.tilt===mapped[0].tilt));
  const presence=movingPresenceAt({movingPlan:plan,songTime:time});
  const lights=projectMovingHeads(layout,mapped,devices).map(l=>({...l,type:'moving',power:1,movingPresenceBasePower:1,movingPresence:presence}));
  const rendered=createRoomPreview()({layout,lights},room,false,time).lights;
  assert.ok(rendered.every(l=>Object.values(l.target).every(Number.isFinite)));
  signatures.push(rendered.map(l=>[l.power.toFixed(2),l.target.x.toFixed(1),l.target.y.toFixed(1),l.target.z.toFixed(1)]));
 }
 assert.equal(new Set(signatures.map(JSON.stringify)).size,5);
});
test('quiet images hold while driven scenes develop without recurring dark transfers',()=>{
 const plan=example(),cues=movingCues(plan,'auto');
 assert.ok(cues.some(c=>c.reason==='scene-entry'&&c.darkTravel));
 assert.ok(cues.filter(c=>c.reason==='scene-development').every(c=>['build','sweep'].includes(c.scene)));
 assert.deepEqual(movingCueAt(cues,2),movingCueAt(cues,8),'a genuinely quiet image still holds');
 for(const [start,end] of [[13,20],[37,44]]){
  const poses=Array.from({length:Math.ceil((end-start)*10)},(_,i)=>JSON.stringify(movingCueAt(cues,start+i*.1)));
  assert.ok(new Set(poses).size>10,'driven passage moves even when two sampled endpoints share a musical phase');
 }
 assert.ok(cues.filter(c=>['groove','impact'].includes(c.scene)).every(c=>!c.darkTravel),'rhythmic motion remains visible');
});

test('manual movement and rhythm suppression also apply to authored scenes',()=>{
 const plan=example();
 Object.assign(plan,{step:1,frames:Array.from({length:84},()=>({r:100,g:100,b:100,dimming:100})),beatTiming:{minimum:0,maximum:255}});
 Object.assign(plan.arrangement,{step:1,bases:Array(84).fill(.5),decay:.2});
 const edits=sectionEditsFor(plan).map(e=>({...e,movement:0,rhythm:'none'}));
 const edited=applySectionLighting(plan,edits),cues=movingCues(edited,'auto');
 assert.equal(cues.length,1,'disabled movement holds the initial image throughout');
 assert.deepEqual(movingPresenceAt({movingPlan:edited,songTime:13}),movingPresenceAt({movingPlan:edited,songTime:15}),'disabled rhythm does not alternate groove groups');
 const partial=applySectionLighting(plan,[{...edits[4],start:51,end:55}]);
 const partialCues=movingCues(partial,'auto');
 assert.deepEqual(movingCueAt(partialCues,51),movingCueAt(partialCues,54.99),'later cues cannot anticipate travel into a frozen interval');
 assert.ok(partialCues.some(c=>c.time>55&&c.time<60),'movement resumes after the explicit hold');
});

function corpus(energy,drive,tone,texture=false){
 const sections=Array.from({length:10},(_,i)=>({start:i*16,end:(i+1)*16,look:'flow',intensity:energy}));
 return {duration:160,sections,beatGrid:{downbeats:Array.from({length:81},(_,i)=>i*2)},arrangement:{patterns:{phrases:sections.map(s=>({...s,energy,tone,movement:{driving:drive,character:texture?'atmospheric':'rhythmic'}}))}}};
}
test('whole-song direction limits repetition and reacts to independent musical profiles',()=>{
 const plans=[corpus(.55,.85,.2),corpus(.52,.6,.85),corpus(.4,.2,.6,true)];
 const sequences=plans.map(p=>lightingScenes(p).map(s=>s.kind+':'+s.variant));
 for(const seq of sequences){
  assert.ok(new Set(seq).size>=4);
  assert.ok(seq.every((v,i)=>!i||v!==seq[i-1]),'no immediate mechanical repetition without a recurring motif');
 }
 assert.equal(new Set(sequences.map(JSON.stringify)).size,3);
 assert.deepEqual(lightingScenes(structuredClone(plans[0])),lightingScenes(plans[0]),'reproducible across reloads');
 const motifPlan=plans[0];motifPlan.sections.forEach((s,i)=>s.motif=i%3);
 const recalled=lightingScenes(structuredClone(motifPlan));
 assert.equal(recalled[0].variant,recalled[3].variant);
 assert.equal(recalled[3].recalled,true);
});
test('all 25 geometries survive mapping to two, seven and twenty heads',()=>{
 const signatures=new Set();
 for(const [kind,variants] of Object.entries(sceneVariants))for(const variant of variants){
  const scene={kind,variant,start:0,end:16,direction:1,energy:.9};
  const pose=scenePose(scene,10);
  signatures.add(JSON.stringify(pose));
  for(const count of [2,7,20]){
   const devices=Array.from({length:count},(_,i)=>({id:'h'+i}));
   const layout={positions:Object.fromEntries(devices.map((d,i)=>[d.id,{x:i}]))};
   const mapped=movingDevicePoses(pose,devices,{formation:'designed',layout});
   assert.equal(mapped.length,count);
   assert.ok(mapped.every(p=>Number.isFinite(p.pan)&&p.tilt>=0&&p.tilt<=1&&Math.abs(p.pan)<=40));
  }
 }
 assert.equal(signatures.size,25,'different names must represent different actual geometry');
});
test('missing analysis holds a stable image and the largest impact is reserved',()=>{
 const unknown={sections:Array.from({length:6},(_,i)=>({start:i*10,end:(i+1)*10,look:'flow'}))};
 assert.ok(lightingScenes(unknown).every(s=>s.kind==='sculpture'&&s.variant==='parallel'));
 const plan=corpus(.9,.9,.3);
 plan.sections.forEach((s,i)=>{s.look='peak';s.intensity=i===9?1:.75;plan.arrangement.patterns.phrases[i].energy=s.intensity;});
 const scenes=lightingScenes(plan);
 assert.ok(scenes.slice(0,-1).every(s=>!s.climax&&s.variant!=='crown'));
 assert.equal(scenes.at(-1).climax,true);
});
