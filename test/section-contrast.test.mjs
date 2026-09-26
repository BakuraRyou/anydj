import test from 'node:test';
import assert from 'node:assert/strict';
import {compileShow} from '../public/show-plan.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {settings} from '../lib/music.mjs';
const duration=48,beats=Array.from({length:96},(_,i)=>i*.5);
const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
const windows=Array.from({length:2400},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
const structure={version:1,source:'all-in-one',duration,segments:[{start:0,end:16,label:'verse'},{start:16,end:32,label:'chorus'},{start:32,end:48,label:'chorus'}]};
test('equal-energy verse and refrain retain different visual roles across profiles',()=>{
 const base=compileShow(windows,duration,settings({arrangement:'auto'}),grid,structure);
 assert.equal(base.sections[0].role,'support');assert.equal(base.sections[1].role,'feature');
 for(const profile of ['auto','party','disco']){
  const plan=applyShowProfile(base,profile);
  const verse=plan.colorDirection.events.filter(e=>e.time<16),chorus=plan.colorDirection.events.filter(e=>e.time>=16&&e.time<32);
  assert.ok(chorus.some(e=>e.reason==='section-contrast'),profile);
  assert.notDeepEqual(chorus[0].to,verse[0].to);
  assert.ok([...verse,...chorus].every(e=>e.role===0),profile);
  assert.ok(plan.arrangement.bases[24/.125]>plan.arrangement.bases[8/.125],profile);
  assert.deepEqual(plan.beatGrid,grid);
 }
});
test('a quiet predicted chorus does not suppress an actually energetic verse',()=>{
 const quiet=windows.map((w,i)=>i<800?w:{...w,rms:.004,bass:0,flux:0});
 const plan=compileShow(quiet,duration,settings({arrangement:'auto'}),grid,structure);
 assert.notEqual(plan.sections[0].role,'support');
 assert.notEqual(plan.sections[1].role,'feature');
});
