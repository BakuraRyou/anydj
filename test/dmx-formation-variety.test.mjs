import {varietySong} from './fixtures/formation-variety-song.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,planFormationEntrances,formationProgramFor,strobeChoreography,formationSceneStateAt,formationStoryPose,formationStoryProgress,formationPreviewAt} from '../public/dmx-strobe-choreography.js';
import {strobeConductor} from '../public/dmx-strobe-conductor.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {planSongMovement} from '../public/song-movement-plan.js';

function sequence(start=0,end=64,motif='riff',role='groove'){
 const s={start,end,role,energy:.7,tone:.5,formationId:'open-fan',minimumHold:1.1,
  sharedPassage:{theme:{key:motif},sequence:'exchange',intent:{motionDrive:.7}},
  phraseArt:{function:role==='held'?'held':'development',motif},
  entrances:Array.from({length:Math.ceil((end-start)*2)},(_,i)=>({time:start+i*.5,duration:.2,strength:1}))};
 s.formationProgram=formationProgramFor(s);s.formationEntrances=planFormationEntrances(s);return s;
}
const timing=duration=>({beatGrid:{beats:Array.from({length:duration*2},(_,i)=>i*.5),downbeats:Array.from({length:duration/2},(_,i)=>i*2)}});
test('a long passage develops one theme through related musical sentences',()=>{
 const s=sequence(),scenes=planFormationScenes([s],timing(64));
 assert.equal(scenes.length,8);
 assert.equal(new Set(scenes.map(v=>v.formationStory.theme)).size,1,'one coherent theme replaces catalogue cycling');
 assert.deepEqual(scenes.slice(0,4).map(v=>v.formationStory.act),['introduce','answer','interlace','resolve']);
 assert.notEqual(scenes[0].formationStory.chapter,scenes[4].formationStory.chapter);
 assert.equal(scenes[0].formationId,'open-fan','recognizable opening survives');
 assert.ok(scenes.every(v=>v.formationStory.knots.length>2),'acoustic entrances carry the story clock');
 assert.deepEqual(scenes.map(v=>v.start),[0,8,16,24,32,40,48,56]);
});
test('analysis fragmentation cannot restart the visual sentence or accelerate changes',()=>{
 const a=sequence(),whole=planFormationScenes([a],timing(64));
 const fragments=Array.from({length:32},(_,i)=>sequence(i*2,i*2+2));
 const split=planFormationScenes(fragments,timing(64));
 const decisions=v=>v.map(s=>[s.start,s.end,s.formationId,s.formationProgram.kind]);
 assert.deepEqual(decisions(split),decisions(whole));
 const noGrid=planFormationScenes([sequence()],{});
 const splitNoGrid=planFormationScenes(Array.from({length:32},(_,i)=>sequence(i*2,i*2+2)),{});
 assert.deepEqual(decisions(splitNoGrid),decisions(noGrid),'the entrance-based fallback also ignores analysis fragmentation');
 const entries=fragments.flatMap(s=>s.formationEntrances).filter((e,i,all)=>!i||e.time!==all[i-1].time);
 for(let i=1;i<entries.length;i++)assert.ok(entries[i].time-entries[i-1].time>=1.1-1e-8);
});

test('strong accents and changing analysis labels do not repeatedly restart a musical peak',()=>{
 const fragments=Array.from({length:4},(_,i)=>{
  const s=sequence(i*8,(i+1)*8,'riff',i<3?'arrival':'groove');
  s.sharedPassage.motif=6;
  s.phraseArt.function=i%2?'development':'strong';s.phraseArt.motif=`6:impact:${s.phraseArt.function}`;
  return s;
 });
 const scenes=planFormationScenes(fragments,timing(32));
 assert.deepEqual(scenes.map(v=>v.formationStory.act),['introduce','answer','interlace','resolve']);
 assert.ok(scenes.every(v=>v.formationStory.arcStart===0&&v.formationStory.arcEnd===32));
 assert.equal(new Set(scenes.map(v=>v.formationStory.theme)).size,1);
});
test('returning motifs recall an opening and continue evolving, while quiet pictures change less often',()=>{
 const sequences=[sequence(0,32,'riff'),sequence(32,48,'break','held'),sequence(48,80,'riff')];
 const scenes=planFormationScenes(sequences,timing(80));
 const first=scenes.filter(v=>v.start<32),returning=scenes.filter(v=>v.start>=48);
 assert.equal(first[0].formationId,returning[0].formationId);
 assert.ok(returning[0].formationStory.returning);
 assert.equal(new Set(returning.map(v=>v.formationStory.act)).size,4);
 assert.equal(scenes.filter(v=>v.start>=32&&v.start<48).length,1);
});
test('development uses local musical features rather than a fixed elapsed-time catalog cycle',()=>{
 const run=(percussion,vocalShare)=>{
  const p={...timing(64),arrangement:{drama:{step:1,percussion:Array(64).fill(percussion),vocalShare:Array(64).fill(vocalShare),intensity:Array(64).fill(.7)}}};
  return planFormationScenes([sequence()],p).map(s=>[s.formationId,s.formationProgram.kind]);
 };
 assert.notDeepEqual(run(.9,.05),run(.1,.9));
 assert.deepEqual(run(.9,.05),run(.9,.05),'planning is deterministic');
});

test('prepared-song playback changes real geometric output within a single continuous song section',()=>{
 const p=varietySong(),scenes=strobeConductor(p).formationScenes;
 assert.ok(scenes.length>=6);assert.equal(new Set(scenes.map(v=>v.formationStory.act)).size,4);
 const trace=t=>Array.from({length:3},(_,row)=>Array.from({length:16},(_,rank)=>{
  const c=strobeComposition(strobeScoreAt(p,t),rank,16,row,3);return [c.x,c.y,c.level];
 }));
 assert.notDeepEqual(trace(4),trace(20));
 const before=trace(12);trace(52);assert.deepEqual(trace(12),before,'seeking does not reseed visual decisions');
 for(const scene of scenes.slice(1)){
  const f=strobeScoreAt(p,scene.start+.25);
  assert.ok(f.music.sequence.visualEnd>f.music.sequence.visualStart);
  assert.ok([0,1,2].flatMap(row=>Array.from({length:16},(_,rank)=>strobeChoreography(f,rank,16,row,3))).some(c=>c.level>.5));
 }
});
test('visual variations inside a build preserve the continuous musical opening',()=>{
 const s=sequence(0,64,'build','build'),scenes=planFormationScenes([s],timing(64));
 assert.ok(scenes.length>1);
 for(const scene of scenes.slice(1)){
  const before=formationSceneStateAt(s,scene.start-.01),after=formationSceneStateAt(s,scene.start+.01);
  assert.ok(after.progress>=before.progress,'the build cannot close again at a visual change');
 }
});

test('a musical stroke travels through adjacent fixtures and returns through the answering rows',()=>{
 const p=varietySong();
 const centroid=time=>{
  const f=strobeScoreAt(p,time);let total=0,x=0,z=0;
  for(let row=0;row<3;row++)for(let rank=0;rank<16;rank++){
   const c=strobeComposition(f,rank,16,row,3);total+=c.level;x+=rank*c.level;z+=row*c.level;
  }
  return {x:x/total,z:z/total};
 };
 const a=centroid(.5),b=centroid(7.5),c=centroid(15.5);
 assert.ok(a.x<3&&b.x>11&&c.x<4,'the light itself traverses the rig and answers in reverse');
 assert.ok(a.z<.3&&b.z>1.5&&c.z<.5,'the same stroke is passed between mounting rows');
 for(let tick=20;tick<6400;tick+=5){
  const f=strobeScoreAt(p,tick/100),all=Array.from({length:3},(_,row)=>Array.from({length:16},(_,rank)=>strobeComposition(f,rank,16,row,3))).flat();
  assert.ok(all.some(v=>v.level>.6),'no collective beat shutter interrupts the travelling stroke');
 }
});

test('handover preserves the outgoing geometry and exposure at sentence boundaries',()=>{
 const p=varietySong();
 for(const time of [8,16,24,32,40,48,56])for(let row=0;row<3;row++)for(let rank=0;rank<16;rank++){
  const a=strobeComposition(strobeScoreAt(p,time-.001),rank,16,row,3);
  const b=strobeComposition(strobeScoreAt(p,time+.001),rank,16,row,3);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.01,'geometry does not restart on a phrase boundary');
  assert.ok(Math.abs(a.level-b.level)<.01,'exposure follows the same continuous handover');
 }
});

test('acoustic phrasing changes travel timing even when the beat grid stays unchanged',()=>{
 const first=sequence(0,8),second=sequence(0,8);
 second.entrances=[0,.5,1,1.3,2.8,5.5,7].map(time=>({time,strength:1,duration:.2}));
 const a=planFormationScenes([first],timing(8))[0].formationStory;
 const b=planFormationScenes([second],timing(8))[0].formationStory;
 assert.notEqual(formationStoryProgress(a,4),formationStoryProgress(b,4));
 for(const story of [a,b]){
  assert.equal(formationStoryProgress(story,0),0);
  assert.ok(Math.abs(formationStoryProgress(story,8)-1)<1e-9);
 }
});

test('voice-led music gets an answering foundation and manual holds freeze the whole gesture',()=>{
 const s=sequence(),p={...timing(64),arrangement:{drama:{step:1,vocalShare:Array(64).fill(.9)}}};
 const scenes=planFormationScenes([s],p),story=scenes[1].formationStory;
 assert.equal(story.motion,'dialogue');
 const held=time=>Array.from({length:16},(_,rank)=>formationStoryPose(story,time,rank,16,0,3,true));
 assert.deepEqual(held(9),held(14));
 const active=formationStoryPose(story,9,0,16,0,3);
 assert.equal(active.exposure,1,'the answering phrase retains the lead outline');
 const preview=formationPreviewAt(12);
 assert.equal(preview.music.sequence.formationStory.act,'answer','the music-free demo uses the same story engine');
});

test('quiet musical passages develop a sparse line while an explicit hold remains stationary',()=>{
 const s=sequence(0,32,'quiet','held'),story=planFormationScenes([s],timing(32))[0].formationStory;
 const trace=(time,frozen=false)=>Array.from({length:3},(_,row)=>Array.from({length:16},(_,rank)=>formationStoryPose(story,time,rank,16,row,3,frozen))).flat();
 const a=trace(2),b=trace(14);
 assert.notDeepEqual(a.map(c=>[c.x,c.y,c.exposure]),b.map(c=>[c.x,c.y,c.exposure]));
 assert.ok(a.filter(c=>c.exposure>.8).length<16&&b.filter(c=>c.exposure>.8).length<16);
 assert.deepEqual(trace(2,true),trace(14,true));
});

test('fixed lights retain an outline and answer without copying the moving beam selection',()=>{
 const p=varietySong(),at=(time,role)=>{
  const f={...strobeScoreAt(p,time),fixtureRole:role};
  return Array.from({length:16},(_,rank)=>strobeComposition(f,rank,16).level);
 };
 assert.notDeepEqual(at(3,'lead'),at(3,'support'));
 assert.ok(at(10,'support').every(v=>v>=.45),'an answering foundation survives the moving stroke');
 assert.ok(at(3,'support').some(v=>v===0),'the support does not flood every fixture');
});
