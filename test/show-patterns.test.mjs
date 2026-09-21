import test from 'node:test';
import assert from 'node:assert/strict';
import {planPatterns,patternEnvelope} from '../public/show-patterns.js';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {settings} from '../lib/music.mjs';
test('long passages vary on detected bars without assuming four beats per bar',()=>{
 const times=Array.from({length:120},(_,i)=>i*.5),bars=times.filter((_,i)=>i%3===0);
 const plan=planPatterns([{start:0,end:60,look:'peak',motif:0}],times,bars);
 assert.ok(new Set(plan.phrases.map(p=>p.kind)).size===3);
 assert.ok(plan.phrases.slice(1).every(p=>bars.includes(p.start)));
 assert.ok(plan.phrases.every(p=>p.end-p.start>=6));
 assert.equal(plan.events.length,times.length);
 assert.deepEqual(plan,planPatterns([{start:0,end:60,look:'peak',motif:0}],times,bars));
});
test('broad waves, alternating accents and builds have distinct temporal shapes',()=>{
 const sample=kind=>[0,.1,.2,.3,.4].map(age=>patternEnvelope({kind,period:.5,alternate:1,progress:.8},age,.15));
 assert.ok(sample('sweep')[2]>sample('sweep')[0]);
 assert.ok(sample('punch')[0]>sample('punch')[2]);
 assert.notDeepEqual(sample('bounce'),sample('punch'));
 assert.ok(patternEnvelope({kind:'build',progress:.9},0,.15)>patternEnvelope({kind:'build',progress:.1},0,.15));
});
test('patterns are seekable, preserve beat grid and profiles, and keep silence dark',()=>{
 const duration=60,beats=Array.from({length:120},(_,i)=>i*.5),grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
 const windows=Array.from({length:3000},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
 const structure={version:1,source:'all-in-one',duration,segments:[{start:0,end:60,label:'chorus'}]};
 const plan=compileShow(windows,duration,settings({arrangement:'auto',maximum:75}),grid,structure);
 assert.deepEqual(plan.beatGrid,grid);assert.deepEqual(new Set(plan.arrangement.patterns.phrases.map(p=>p.kind)),new Set(['punch','bounce']));
 for(const profile of ['party','disco']) {
  const variant=applyShowProfile(plan,profile);
  assert.deepEqual(variant.arrangement.patterns,plan.arrangement.patterns);
  assert.deepEqual(variant.arrangement.times,plan.arrangement.times);
  assert.ok(variant.frames.every(f=>f.dimming>=5&&f.dimming<=75));
  const frame=showFrameAt(variant,12.24);showFrameAt(variant,55);assert.deepEqual(showFrameAt(variant,12.24),frame);
 }
 const first=showFrameAt(plan,12.24);showFrameAt(plan,55);assert.deepEqual(showFrameAt(plan,12.24),first);
 assert.ok(plan.frames.every(f=>f.dimming>=5&&f.dimming<=75));
 const silent=compileShow(windows.map(w=>({...w,rms:0,bass:0,flux:0})),duration,settings({arrangement:'auto',maximum:75}),grid,structure);
 assert.equal(silent.arrangement.times.length,0);assert.ok(silent.frames.every(f=>f.dimming===5));
});

test('builds keep rising across visual phrases and waves end continuously',()=>{
 const times=Array.from({length:96},(_,i)=>i*.5);
 const plan=planPatterns([{start:0,end:48,look:'lift'}],times,times.filter((_,i)=>i%4===0));
 assert.ok(plan.phrases.length>1);
 assert.ok(plan.events.every((e,i)=>!i||e.progress>plan.events[i-1].progress));
 assert.ok(patternEnvelope({kind:'sweep',period:.5},.49999,.15)<.001);
 assert.equal(patternEnvelope({kind:'sweep',period:.5},.5,.15),0);
});
test('local style can soften an intense passage and the following entrance stays crisp',()=>{
 const times=Array.from({length:128},(_,i)=>i*.5),bars=times.filter((_,i)=>i%4===0);
 const segments=Array.from({length:32},(_,i)=>({start:i*2,end:i*2+2,scores:{electronic:i<8?1:0,rock:0,pop:0,groove:0,acoustic:i<8?0:1,orchestral:0,ambient:0}}));
 const plan=planPatterns([{start:0,end:64,look:'peak'}],times,bars,{segments});
 assert.equal(plan.phrases[0].kind,'punch');
 assert.ok(plan.phrases.filter(p=>p.start>=16).every(p=>p.kind!=='punch'));
 assert.ok(plan.phrases.every((p,i)=>!i||p.kind!==plan.phrases[i-1].kind));
 const entrance=planPatterns([{start:0,end:16,look:'lift'},{start:16,end:64,look:'peak',motif:2}],times,bars);
 assert.equal(entrance.phrases.find(p=>p.start===16).kind,'punch');
 assert.equal(entrance.events[32].previousKind,undefined);
});
test('downbeats retain strong alternating accents and internal changes morph deterministically',()=>{
 const times=Array.from({length:96},(_,i)=>i*.5),bars=times.filter((_,i)=>i%3===0);
 const plan=planPatterns([{start:0,end:48,look:'peak'}],times,bars);
 assert.ok(plan.events.some(e=>e.previousKind));
 for(const [i,e] of plan.events.entries()) {
  if(bars.includes(times[i]))assert.equal(e.alternate,0);
  if(e.previousKind){
   const current=patternEnvelope({...e,previousKind:undefined},.1,.15);
   const prior=patternEnvelope({...e,kind:e.previousKind,previousKind:undefined},.1,.15);
   assert.equal(patternEnvelope(e,.1,.15),(current+prior)/2);
  }
 }
});

test('strong audible attacks keep driving patterns rather than rotating into soft waves',()=>{
 const times=Array.from({length:128},(_,i)=>i*.5),bars=times.filter((_,i)=>i%4===0);
 const plan=planPatterns([{start:0,end:64,look:'peak'}],times,bars,null,times.map(t=>t<32?.9:.2));
 assert.ok(plan.phrases.filter(p=>p.start<32).every(p=>['punch','bounce'].includes(p.kind)));
 assert.ok(plan.phrases.some(p=>p.start>=32&&p.kind==='sweep'));
 assert.ok(plan.phrases.filter(p=>p.start>=32).every(p=>p.kind!=='punch'));
 const repeated=planPatterns([{start:0,end:64,look:'peak'}],times,bars,null,times.map(t=>t<32?.9:.2));
 assert.deepEqual(plan,repeated);
 assert.ok(plan.events.filter(e=>e.driving).every(e=>!e.previousKind));
 assert.equal(plan.events.length,times.length);
});
