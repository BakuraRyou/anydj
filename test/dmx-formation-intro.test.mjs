import test from 'node:test';
import assert from 'node:assert/strict';
import {planFormationScenes,formationStoryPose,formationSceneStateAt,strobeChoreography} from '../public/dmx-strobe-choreography.js';
import {planFormationAction} from '../public/dmx-formation-actions.js';

function intro(offset=0){
 const duration=32,values=value=>Array(65).fill(value);
 const plan={duration,beatGrid:{beats:Array.from({length:64},(_,i)=>i*.5)},
  arrangement:{times:[],accents:[],motionEnvelope:[0,8,16,32].map((time,i)=>({time,energy:.38,tone:.45+i*.05}))},
  structure:{instruments:{step:.5,drums:values(.001),bass:values(.001),vocals:values(.015),other:values(.2)}},
  score:{notes:Array.from({length:32},(_,i)=>({start:i+.35+offset,end:i+.95+offset,midi:58,confidence:.9})).filter(n=>n.start<32)}};
 const sequences=[[0,8],[8,16],[16,32]].map(([start,end])=>({start,end,role:'held',energy:.38,
  formationId:'horizontal-sheets',sharedPassage:{motif:'intro',intent:{transition:{overlap:1.8}}},entrances:[]}));
 const scenes=planFormationScenes(sequences,plan);
 return {plan,sequences,scenes};
}
const picture=(story,time)=>Array.from({length:16},(_,rank)=>formationStoryPose(story,time,rank,16,0,3));

test('an audible intro with notes and no drum attacks develops throughout its first thirty seconds',()=>{
 const {plan,scenes}=intro();assert.equal(plan.arrangement.times.length,0);
 assert.equal(scenes.length,3);
 for(const scene of scenes){
  const story=scene.formationStory;
  assert.equal(story.motion,'suspend','the restrained musical role remains intact');
  assert.equal(story.musicalEvidence.texture,'sustain','notes must not depend on the dominant texture label');
  assert.equal(story.action.kind,'develop');assert.equal(story.action.source,'melody');
  assert.ok(story.action.cues.every(c=>plan.score.notes.some(n=>n.start===c.time)));
  const a=picture(story,scene.start+1),b=picture(story,scene.end-1);
  assert.ok(a.filter((p,i)=>Math.hypot(p.x-b[i].x,p.y-b[i].y)>.04).length>=8,'the complete picture must visibly develop');
  assert.ok(a.some((p,i)=>Math.abs(p.exposure-b[i].exposure)>.1),'light groups build the picture as well as moving');
 }
});
test('shifting the melodic entrances changes the intro action without changing its beat grid',()=>{
 const a=intro(),b=intro(.3);assert.deepEqual(a.plan.beatGrid,b.plan.beatGrid);
 assert.notDeepEqual(picture(a.scenes[0].formationStory,3),picture(b.scenes[0].formationStory,3));
});
test('quiet development survives scene transfer and manual movement holds remain frozen',()=>{
 const {sequences}=intro(),time=4.1,s=sequences[0],state=formationSceneStateAt(s,time);
 const figure={presentation:'strobe',flicker:53,music:{sequence:{...s,...state,time}}},wire=JSON.parse(JSON.stringify(figure));
 for(const rank of [0,3,7,12,15])for(const key of ['x','y','level'])assert.ok(Math.abs(strobeChoreography(figure,rank,16,0,3)[key]-strobeChoreography(wire,rank,16,0,3)[key])<1e-10);
 const story=s.formationScenes[0].formationStory;
 assert.deepEqual(formationStoryPose(story,2,3,16,0,3,true),formationStoryPose(story,7,3,16,0,3,true));
});
test('a measured sound contour can develop a held picture without fabricating percussion',()=>{
 const story={start:0,end:12,motion:'suspend',shape:'horizontal-sheets',musicalEvidence:{texture:'sustain',energy:.4}};
 const roles={lead:[],bass:[],drums:[]},rows=Array.from({length:25},(_,i)=>({time:i*.5,energy:.3+i*.01,tone:.4+i*.005}));
 const developed=planFormationAction(story,{}, {roles,rows});
 assert.equal(developed.kind,'develop');assert.equal(developed.source,'expression');
 assert.ok(developed.cues.every(c=>rows.some(r=>r.time===c.time)));
 const flat=planFormationAction(story,{}, {roles,rows:rows.map(r=>({...r,energy:.4,tone:.5}))});
 assert.equal(flat.kind,'hold');assert.equal(flat.cues.length,0);
});
test('silence and uncertain notes cannot demand a quiet development action',()=>{
 const roles={lead:[],bass:[],drums:[]};
 const plan={score:{notes:[1,3,5].map(start=>({start,end:start+.5,confidence:.2}))}};
 const story={start:0,end:8,motion:'suspend',shape:'horizontal-sheets',musicalEvidence:{texture:'sustain',energy:.4}};
 assert.equal(planFormationAction(story,plan,{roles}).kind,'hold');
 plan.score.notes.forEach(n=>n.confidence=.9);
 assert.equal(planFormationAction({...story,musicalEvidence:{...story.musicalEvidence,energy:0}},plan,{roles}).kind,'hold');
 assert.equal(planFormationAction({...story,motion:'rest'},plan,{roles}).kind,'rest');
});
