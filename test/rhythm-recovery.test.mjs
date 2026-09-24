import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeShow,arrangementAccentProfile} from '../public/show-arrangement.js';
import {movingCues} from '../public/dmx-moving-cues.js';
import {activityAt} from '../public/dmx-activity.js';
const duration=24;
const make=(steady=false,grid=false)=>{
 const windows=Array.from({length:1200},(_,i)=>({rms:i<200?.02:.3,bass:i<200?.005:.15,flux:.05,tone:.5}));
 const zero=Array(240).fill(0),instruments={step:.1,drums:zero.map((_,i)=>i<40?.002:steady?.2:i%5===0?.3:.12),bass:zero.map((_,i)=>i<40?.002:.15),vocals:zero,other:zero.map((_,i)=>i<40?.01:.18)};
 const beats=grid?Array.from({length:48},(_,i)=>i*.5):[0,.5,1,1.5,2,2.5,3,3.5,22,22.5,23,23.5];
 return arrangeShow(windows,duration,[{start:0,end:4,label:'intro'},{start:4,end:24,label:'solo'}],beats,[],null,instruments);
};
test('real drum attacks recover an energetic passage without manufacturing a replacement beat grid',()=>{
 const a=make(),indices=a.eventSources.flatMap((s,i)=>s==='instrument'?[i]:[]);
 assert.ok(indices.length>=12);assert.ok(indices.every(i=>Math.abs(a.times[i]*2-Math.round(a.times[i]*2))<1e-8));
 assert.ok(a.patterns.phrases.filter(p=>p.start>=4).every(p=>p.movement.character==='rhythmic'));
 assert.ok(indices.some(i=>arrangementAccentProfile(a,i).gain>0));
 const p={duration,sections:a.passages,beatGrid:{beats:[0,.5,1,1.5,22,22.5,23]},arrangement:a};
 assert.ok(movingCues(p,'auto').filter(c=>c.time>6&&c.time<20).length>=5);
 assert.deepEqual(make(),a);
});
test('stable stems and a reliable beat grid do not get extra recovery attacks',()=>{
 for(const a of [make(true),make(false,true)])assert.equal(a.eventSources.filter(s=>s==='instrument').length,0);
});
test('an established peak stays fully open while a true quiet-to-loud build still stages fixtures',()=>{
 const create=start=>({sections:[{start:0,end:10,look:'peak'}],arrangement:{drama:{step:.1,intensity:Array.from({length:100},(_,i)=>start+(.95-start)*i/99)}}});
 const peak=create(.65),build=create(.1);
 for(const t of [1,3,5,8])assert.deepEqual(activityAt({movingPlan:peak,songTime:t,look:'peak'},4),[1,1,1,1]);
 assert.ok(activityAt({movingPlan:build,songTime:2,look:'peak'},4).some(v=>v<.5));
});
test('measured non-percussive development moves the heads without adding brightness accents',()=>{
 const zeros=Array(200).fill(0),other=zeros.map((_,i)=>i<100?.025+i*.0015:.2);
 const a=arrangeShow(Array.from({length:1000},(_,i)=>({rms:i<500?.025+i*.0003:.2,bass:0,flux:0,tone:.5})),20,
  [{start:0,end:10,label:'bridge'},{start:10,end:20,label:'solo'}],[],[],null,{step:.1,drums:zeros,bass:zeros,vocals:zeros,other});
 assert.equal(a.times.length,0);assert.ok(a.developments.length>=2);
 const p={duration:20,sections:a.passages,arrangement:a};
 const c=movingCues(p,'auto');assert.ok(c.some(c=>c.reason==='build-development'));
 assert.deepEqual(movingCues(p,'auto'),c);
});
