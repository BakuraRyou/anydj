import test from 'node:test';
import assert from 'node:assert/strict';
import {developFormationPhrase} from '../public/dmx-formation-music.js';
import {catalogCandidates,catalogFormation,catalogMatchScore} from '../public/dmx-formation-catalog.js';
import {planFormationScenes,formationSceneStateAt,strobeChoreography} from '../public/dmx-strobe-choreography.js';
const evidence={texture:'drums',energy:.8,tone:.5,drums:.85,bass:.3,movementDrive:.8,density:.65,impulses:16,pitchConfidence:.2};
const decision={motion:'relay',shape:'open-fan',evidence};

test('new motif names do not reset the eligible catalogue to the same familiar first picture',()=>{
 const history=[],chosen=[];
 for(let i=0;i<9;i++){
  const next=developFormationPhrase(decision,0,'open-fan',{history});chosen.push(next.shape);
  if(i){
   const candidates=catalogCandidates('relay',evidence),score=catalogMatchScore(catalogFormation(next.shape),'relay',evidence);
   assert.ok(catalogMatchScore(candidates[0],'relay',evidence)-score<=.75+1e-12,'recency cannot promote an unsuitable picture');
   assert.notEqual(next.shape,chosen[i-1]);
  }
  history.push({shape:next.shape,layout:next.scene.layout});
 }
 assert.equal(chosen[0],'open-fan');assert.ok(new Set(chosen).size>=7);
});
test('a matching motif can recall its picture and explicitly authored openings retain priority',()=>{
 const history=[{shape:'geometry-quarters-fold',layout:'ensemble'}],recalled='geometry-span-stairs';
 const next=developFormationPhrase(decision,4,null,{history,recalled});
 assert.equal(next.shape,recalled);assert.equal(next.evidence.selection,'motif-recall');
 const authored=developFormationPhrase(decision,0,'parallel-lines',{history,anchorLocked:true});
 assert.equal(authored.shape,'parallel-lines');assert.equal(authored.evidence.selection,'authored-opening');
});
test('impact openings develop while genuine builds and unmeasured sustained music retain their long arc',()=>{
 const history=[{shape:'open-fan',layout:'ensemble'}],opening={...decision,motion:'bloom'};
 assert.equal(developFormationPhrase(opening,2,null,{history}).shape,'open-fan');
 const arrival=developFormationPhrase(opening,2,null,{history,allowOpening:true});
 assert.ok(catalogFormation(arrival.shape));
 const silent={...decision,evidence:{...evidence,impulses:0}};
 assert.equal(developFormationPhrase(silent,2,null,{history}).shape,decision.shape);
});
function song(motifs){
 const duration=motifs.length*8,times=Array.from({length:duration*2},(_,i)=>i*.5+.03);
 const plan={duration,beatGrid:{beats:times.map(t=>t-.03),downbeats:times.filter((_,i)=>i%4===0).map(t=>t-.03)},arrangement:{
  times,accents:times.map(()=>.9),eventSources:times.map(()=>'onset'),motionEnvelope:[0,duration].map(time=>({time,energy:.8,tone:.5})),
  patterns:{phrases:motifs.map((_,i)=>({start:i*8}))}}};
 const sequences=motifs.map((motif,i)=>({start:i*8,end:(i+1)*8,role:'flow',energy:.8,
  sharedPassage:{motif,sequence:'wave',composition:'auto-sails-unison',intent:{transition:{overlap:.9}}},
  entrances:times.filter(t=>t>=i*8&&t<(i+1)*8).map(time=>({time,strength:.9}))}));
 return {sequences,scenes:planFormationScenes(sequences,plan)};
}
test('cross-section variety retains source boundaries, deterministic replay and continuous transferred handovers',()=>{
 const motifs=['a','b','c','d','e','f'],{sequences,scenes}=song(motifs);
 assert.deepEqual(scenes.map(s=>s.start),[0,8,16,24,32,40]);
 assert.ok(new Set(scenes.map(s=>s.formationId)).size>=5);
 assert.ok(scenes.slice(1).every(s=>catalogFormation(s.formationId)));
 assert.deepEqual(scenes.map(s=>s.formationStory),song(motifs).scenes.map(s=>s.formationStory));
 const figure=t=>{const s=sequences.find(s=>t>=s.start&&t<s.end);return {presentation:'strobe',flicker:53,music:{sequence:{...s,...formationSceneStateAt(s,t),time:t}}};};
 for(const t of [8,8.9,16,16.9,24,24.9,32,32.9,40,40.9])for(const row of [0,1,2])for(const rank of [0,4,11,15]){
  const a=strobeChoreography(figure(t-.00001),rank,16,row,3),b=strobeChoreography(figure(t+.00001),rank,16,row,3);
  for(const key of ['x','y','level','beamFocus'])assert.ok(Math.abs(a[key]-b[key])<.001,`${t}: ${key} must remain continuous`);
  assert.deepEqual(strobeChoreography(figure(t),rank,16,row,3),strobeChoreography(JSON.parse(JSON.stringify(figure(t))),rank,16,row,3));
 }
});
test('a recurring musical motif returns to its first picture while intervening motifs develop',()=>{
 const {scenes}=song(['a','b','c','a']);
 assert.notEqual(scenes[0].formationId,scenes[1].formationId);
 assert.equal(scenes[0].formationId,scenes[3].formationId);
 assert.equal(scenes[3].formationStory.musicalEvidence.selection,'motif-recall');
});
