import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingScenes,lightingGestures} from '../public/dmx-light-scenes.js';
import {movingPresenceAt} from '../public/dmx-activity.js';
const song=()=>({duration:24,sections:[{start:0,end:24,look:'flow'}],beatGrid:{downbeats:[0,2,4,6,8,10,12,14,16,18,20,22]},arrangement:{times:Array.from({length:48},(_,i)=>i*.5),eventSources:Array(48).fill('onset'),drama:{step:1,intensity:[...Array(8).fill(.55),...Array(8).fill(.65),...Array(8).fill(.65)],percussion:Array(24).fill(.3)},patterns:{phrases:[0,8,16].map(start=>({start,end:start+8,energy:.6,tone:.4,movement:{character:'rhythmic',driving:1}}))}}});
test('measured guitar-like rhythm survives a low relative drum share',()=>{
 const plan=song(),saved=structuredClone(plan),scenes=lightingScenes(plan);
 assert.ok(scenes.every(s=>s.kind==='groove'&&s.drive>=.55));
 assert.ok(lightingGestures(plan).some(g=>g.time>=8&&g.drive>=.55));
 assert.deepEqual(plan,saved);
});
test('a beat grid or phrase label alone cannot turn sustained music into a groove',()=>{
 for(const change of [p=>p.arrangement.eventSources.fill('beat'),p=>p.arrangement.patterns.phrases.forEach(s=>s.movement.character='atmospheric'),p=>p.arrangement.drama.percussion.fill(.05)]){
  const plan=song();change(plan);
  assert.ok(lightingScenes(plan).every(s=>s.kind==='sweep'));
 }
 const plan=song();plan.arrangement.blackouts=[{start:8,end:16}];
 assert.equal(lightingScenes(plan).find(s=>s.start===8).kind,'silence');
});
test('groups hand over at measured changes, hold over identical phrases, and blend continuously',()=>{
 const plan=song(),scenes=lightingScenes(plan);
 assert.notEqual(scenes[0].groupIndex,scenes[1].groupIndex);
 assert.equal(scenes[1].groupIndex,scenes[2].groupIndex);
 const at=t=>movingPresenceAt({movingPlan:plan,songTime:t,movingMood:'balanced'});
 assert.notEqual(at(4).layers.at(-1).rowSelection,at(12).layers.at(-1).rowSelection);
 const near=at(8.00001);assert.ok(near.layers[0].weight>.999);
 assert.ok(near.layers.at(-1).weight<.001);
 const saved=at(12);at(20);assert.deepEqual(at(12),saved);
 const edited={...plan,sectionLighting:[{start:0,end:24,rhythm:'none',movement:0}]};
 const manual=movingPresenceAt({movingPlan:edited,songTime:12,movingMood:'balanced'});
 assert.ok(manual.layers.every(p=>p.supportSelection===undefined&&p.rowSelection===undefined));
});
