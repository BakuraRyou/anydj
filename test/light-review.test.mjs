import test from 'node:test';
import assert from 'node:assert/strict';
import {lightReview,lightReviewJSON} from '../public/light-review.js';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
import {applySectionLighting,sectionEditsFor} from '../public/section-lighting.js';

test('review export preserves effective edits, precise song position and reproducible frames',()=>{
 const windows=Array.from({length:800},(_,i)=>({rms:.2,bands:[.5,.2,.1,.1,.1],tone:.4,bass:.1,flux:i%25===0?.7:0,beatSeq:Math.floor(i/25)}));
 const original=compileShow(windows,16,settings({arrangement:'auto'}));
 const edits=sectionEditsFor(original);edits.forEach(e=>{e.colors='hold';e.colorA='#ff0044';});
 const plan=applySectionLighting(original,edits),before=structuredClone(plan);
 const review=lightReview(plan,{time:6.375,title:'Comparison'}),saved=JSON.parse(lightReviewJSON(review));
 assert.equal(saved.reference.songTime,6.375);
 assert.deepEqual(saved.snapshot.frame,showFrameAt(plan,6.375));
 for(const time of [0,6.375,12.125,15.9])assert.deepEqual(showFrameAt(saved.plan,time),showFrameAt(plan,time));
 assert.deepEqual(plan,before);
 review.plan.frames[0].r=123;assert.deepEqual(plan,before);
 assert.equal(lightReview(plan,{time:99}).reference.songTime,16);
 assert.equal(lightReview(plan,{time:NaN}).reference.songTime,0);
 assert.deepEqual(JSON.parse(lightReviewJSON({values:new Float32Array([.5,1])})).values,[.5,1]);
});
