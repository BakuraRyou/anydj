import test from 'node:test';
import assert from 'node:assert/strict';
import {refineSpectralBuilds,arrangeShow} from '../public/show-arrangement.js';
import {activityAt} from '../public/dmx-activity.js';
const sections=[{start:0,end:14,label:'inst'},{start:14,end:24,label:'inst'}];
const signal=()=>Array.from({length:1200},(_,i)=>{
 const t=i*.02,p=Math.max(0,Math.min(1,(t-2)/8));
 return t>=14?{rms:.5,bass:.3,tone:.2,flatness:.03,rolloff:.3}:t>=11?
  {rms:.12,bass:.02,tone:.45,flatness:.08,rolloff:.55}:
  {rms:.3-.05*p,bass:.07,tone:.5+.2*p,flatness:.2+.2*p,rolloff:.65+.2*p};
});
test('spectral rise with falling loudness becomes a build before the pre-drop withdrawal',()=>{
 const windows=signal(),original=structuredClone(sections),refined=refineSpectralBuilds(windows,sections);
 assert.equal(refined.length,3);assert.equal(refined[0].end,11);assert.equal(refined[1].start,11);
 assert.equal(refined[0].buildEvidence.kind,'spectral');assert.equal(refined[1].buildEvidence,undefined);
 assert.deepEqual(sections,original);
 const arrangement=arrangeShow(windows,24,refined,[],[]);
 assert.equal(arrangement.passages[0].look,'lift');
 assert.equal(arrangement.times.length,0,'spectral development must not invent flashes');
 assert.ok(arrangement.bases[9/.125]>arrangement.bases[2/.125]);
 const plan={sections:arrangement.passages,arrangement};
 const sum=t=>activityAt({movingPlan:plan,songTime:t,look:'lift'},4).reduce((a,b)=>a+b,0);
 assert.ok(sum(3)<sum(7));assert.ok(sum(7)<sum(10));
 const first=sum(3);sum(10);assert.equal(sum(3),first);
});
test('bright pads, fades, alternating timbres and a single spectral change are not builds',()=>{
 const mutations=[
  w=>w.map(v=>({...v,tone:.7,flatness:.4,rolloff:.85})),
  w=>w.map(v=>({...v,flatness:.2})),
  w=>w.map(v=>({...v,rolloff:.7})),
  w=>w.map((v,i)=>i>=700?{...v,rms:.2,bass:.03}:v),
  w=>w.map((v,i)=>i<550?{...v,tone:i%100<50?.5:.7}:v),
  w=>w.map((v,i)=>i<500?{...v,tone:.5,flatness:.2,rolloff:.65}:v),
  w=>w.map(({rolloff,...v})=>v),
 ];
 for(const mutate of mutations)assert.deepEqual(refineSpectralBuilds(mutate(signal()),sections),sections);
});

test('compiled show retains spectral evidence and renders the rise separately from its withdrawal',async()=>{
 const {compileShow,showFrameAt}=await import('../public/show-plan.js');
 const {settings}=await import('../lib/music.mjs');
 const structure={version:1,source:'all-in-one',duration:24,segments:sections};
 const plan=compileShow(signal(),24,settings({arrangement:'auto',minimum:5,maximum:100}),null,structure);
 assert.equal(plan.sections[0].look,'lift');
 assert.equal(plan.sections[0].buildEvidence.kind,'spectral');
 assert.equal(plan.sections[1].start,11);
 assert.ok(showFrameAt(plan,9).dimming>showFrameAt(plan,3).dimming);
 assert.ok(showFrameAt(plan,13).dimming<showFrameAt(plan,9).dimming);
 const before=showFrameAt(plan,7);showFrameAt(plan,20);assert.deepEqual(showFrameAt(plan,7),before);
});
