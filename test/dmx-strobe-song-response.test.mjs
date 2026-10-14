import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeConductor,strobeMusicAt} from '../public/dmx-strobe-conductor.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
const song=()=>({duration:16,sections:[{start:0,end:16,look:'peak'}],beatGrid:{beats:Array.from({length:33},(_,i)=>i*.5),downbeats:[0,2,4,6,8,10,12,14]},arrangement:{times:[1.1,3.4,6.2],accents:[.7,.7,.7],eventSources:['onset','onset','onset'],eventSalience:[.3,.3,.3],drama:{step:1,intensity:Array(16).fill(.8),percussion:Array(16).fill(.9)}}});
const levels=(plan,time)=>{const f=strobeScoreAt(plan,time);return Array.from({length:8},(_,i)=>strobeComposition(f,i,8).level);};
test('same beat grid but different acoustic entrances produces different light sequences',()=>{
 const a=song(),b=song();b.arrangement.times=[1.7,4.1,7.3];
 assert.deepEqual(a.beatGrid,b.beatGrid);
 assert.notDeepEqual(levels(a,1.2),levels(b,1.2));
 assert.ok(strobeMusicAt(a,1.2).active.length);assert.equal(strobeMusicAt(b,1.2).active.length,0);
 assert.notDeepEqual(Array.from({length:160},(_,i)=>levels(a,i/10)),Array.from({length:160},(_,i)=>levels(b,i/10)));
});
test('moving the metronome does not move measured entrances or generate an eight-beat repeat',()=>{
 const a=song(),b=song();b.beatGrid.beats=b.beatGrid.beats.map(t=>t*1.3);
 assert.deepEqual(levels(a,1.2),levels(b,1.2));
 assert.equal(strobeMusicAt(a,5.2).active.length,0);
 assert.ok(strobeMusicAt(a,1.2).active.length>0);
});
test('a bare beat grid has no invented rhythmic event stream',()=>{
 const a=song();a.arrangement.eventSources=a.arrangement.times.map(()=>'beat');
 assert.equal(strobeConductor(a).events.length,0);
 assert.deepEqual(levels(a,.2),levels(a,.7));
 assert.ok(levels(a,.2).some(v=>v>0));
});
test('confident melody changes activate answer groups at their actual note onset',()=>{
 const a=song();a.score={notes:[{start:0,end:1,midi:60},{start:2.3,end:3.1,midi:67}],track:[{time:2.3,confidence:.8,position:.6},{time:2.4,confidence:.8,position:.6},{time:2.5,confidence:.8,position:.6}]};
 const b=structuredClone(a);delete b.score;
 assert.ok(strobeConductor(a).events.some(e=>e.kind==='melody'&&e.time===2.3&&e.role==='answer'));
 assert.notDeepEqual(levels(a,2.45),levels(b,2.45));
});
test('measured melodic and timbral contour changes spatial output and seeking is deterministic',()=>{
 const a=song(),b=song();
 a.arrangement.motionEnvelope=[{time:0,pitch:48,tone:.2,energy:.7},{time:16,pitch:60,tone:.4,energy:.8}];
 b.arrangement.motionEnvelope=[{time:0,pitch:72,tone:.8,energy:.7},{time:16,pitch:84,tone:.9,energy:.8}];
 const target=p=>{const f=strobeScoreAt(p,2);return strobeComposition(f,0,8);};
 assert.notEqual(target(a).y,target(b).y);
 const before=levels(a,1.2);levels(a,12);assert.deepEqual(levels(a,1.2),before);
});
