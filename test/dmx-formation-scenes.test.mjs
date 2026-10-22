import {groupComposition} from '../public/dmx-group-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMATION_SCENES,chooseFormationScene,formationScenePose} from '../public/dmx-formation-scenes.js';
import {FORMATION_NAMES,formationSpatialPose,formationStoryPose} from '../public/dmx-strobe-choreography.js';
import {developFormationPhrase} from '../public/dmx-formation-music.js';

const evidence={texture:'drums',density:.8,energy:.8,impulses:20,pitchConfidence:.2};
const trace=scene=>[.15,.5,.85].flatMap(progress=>[0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>{
 const p=formationScenePose(scene,formationSpatialPose(scene.shape,rank,16,row,3,progress),rank,16,row,3);
 assert.ok([p.x,p.y,p.membership].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 return [p.x,p.y,p.beamFocus,p.membership].map(v=>Math.round(v*1e5));
}))).flat().join(',');

test('every ground formation has six distinct bounded scene layouts',()=>{
 assert.ok(Object.keys(FORMATION_NAMES).length>=300);
 assert.equal(FORMATION_SCENES.length,Object.keys(FORMATION_NAMES).length*6);
 assert.deepEqual(new Set(FORMATION_SCENES.map(s=>s.shape)),new Set(Object.keys(FORMATION_NAMES)));
 assert.equal(new Set(FORMATION_SCENES.map(trace)).size,FORMATION_SCENES.length,'cosmetic variants cannot count as different scenes');
});
test('all scenes are selectable for eligible musical movements',()=>{
 const reached=new Set();
 for(const shape of Object.keys(FORMATION_NAMES))for(const motion of ['relay','dialogue','weave','suspend','bloom','gather'])
  for(let phrase=0;phrase<10;phrase++){
   const scene=chooseFormationScene(shape,motion,evidence,phrase);
   assert.ok(scene.motions.includes(motion));reached.add(scene.id);
  }
 assert.equal(reached.size,FORMATION_SCENES.length);
});
test('section matching excludes dense islands in sparse music and corridors under lead vocals',()=>{
 for(let phrase=0;phrase<40;phrase++)for(const motion of ['relay','dialogue','weave','suspend','bloom','gather']){
  const quiet=chooseFormationScene('open-fan',motion,{...evidence,density:.1,energy:.15},phrase);
  assert.notEqual(quiet.layout,'islands');
  const voice=chooseFormationScene('open-fan',motion,{...evidence,texture:'voice'},phrase);
  assert.notEqual(voice.layout,'corridor');
  if(motion==='suspend')assert.ok(['ensemble','terraces'].includes(quiet.layout));
 }
});
test('measured phrase development applies scene geometry to playback and survives wire serialization',()=>{
 const decision={motion:'relay',shape:'open-fan',act:'introduce',direction:1,variation:{key:'shared',path:'traverse'},evidence};
 const developed=Array.from({length:40},(_,i)=>developFormationPhrase(decision,i));
 assert.ok(new Set(developed.map(d=>d.scene.id)).size>=25);
 for(const d of developed){
  const story={...d,start:0,end:8,arcStart:0,arcEnd:8,energy:.8,phaseStart:0,phaseSpan:1,knots:[{time:0,position:0},{time:8,position:1}]};
  for(const row of [0,1,2])for(const rank of [0,3,7,12,15]){
   const pose=formationStoryPose(story,3,rank,16,row,3);
   assert.deepEqual(formationStoryPose(JSON.parse(JSON.stringify(story)),3,rank,16,row,3),pose);
   const base=formationStoryPose({...story,scene:null},3,rank,16,row,3);
   const expected=formationScenePose(d.scene,base,rank,16,row,3);
   assert.equal(pose.x,expected.x);assert.equal(pose.y,expected.y);
   assert.ok(Math.abs(pose.exposure-base.exposure*expected.membership)<1e-10);
  }
 }
});
test('no extra catalogue stepping on a grid-only pad and no scene stepping within a build',()=>{
 for(const motion of ['bloom','gather','suspend']){
  const base={motion,shape:'open-fan',evidence:{...evidence,impulses:0}};
  assert.equal(new Set(Array.from({length:12},(_,i)=>developFormationPhrase(base,i).scene.id)).size,1);
 }
});


test('structural layout changes preserve light and target continuity on the combined rig',()=>{
 const old={start:0,end:8,arcStart:0,arcEnd:8,motion:'relay',act:'introduce',shape:'parallel-lines',energy:.7,
  knots:[{time:0,position:0},{time:8,position:1}],variation:{path:'traverse',gesture:'carry',spread:1},
  scene:FORMATION_SCENES.find(s=>s.id==='parallel-lines/terraces')};
 for(const layout of ['ensemble','terraces','wings','corridor','islands']){
  const next={...old,start:8,end:16,arcStart:8,arcEnd:16,shape:'open-fan',
   scene:FORMATION_SCENES.find(s=>s.id===`open-fan/${layout}`),knots:[{time:8,position:0},{time:16,position:1}]};
  const picture=time=>{
   const story=time<8?old:next;
   return {presentation:'strobe',flicker:53,music:{sequence:{role:'groove',sharedPassage:{},time,age:time-story.start,
    formationId:story.shape,formationProgram:{kind:'sweep'},formationStory:story,
    ...(time>=8?{previous:{end:8,formationId:old.shape,formationProgram:{kind:'sweep'},formationStory:old}}:{})}}};
  };
  for(const rigFamily of ['rows','banks'])for(const rank of [0,3,7,12,15]){
   const sample=time=>groupComposition({...picture(time),rigFamily,rigRow:1,rigGroups:3},rank,16,1,3);
   for(const boundary of [8,8.9]){
    const a=sample(boundary-.00001),b=sample(boundary+.00001);
    for(const key of ['x','y','level','beamFocus'])assert.ok(Math.abs(a[key]-b[key])<.001,`${layout}: ${key} jumps at ${boundary}`);
   }
  }
 }
});
