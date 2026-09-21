import test from 'node:test';
import assert from 'node:assert/strict';
import {COLOR_MODES,applyTrackColors,validColorMode} from '../public/dj-color-modes.js';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
import {applySectionLighting,sectionEditsFor} from '../public/section-lighting.js';
const plan=()=>compileShow(Array.from({length:400},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)})),8,settings({arrangement:'auto'}));
test('color selection preserves timing and brightness without mutating the base show',()=>{
 const base=plan(),snapshot=structuredClone(base),mode=COLOR_MODES.find(m=>m.id==='ocean');
 const changed=applyTrackColors(base,mode);
 assert.deepEqual(base,snapshot);assert.deepEqual(changed.beatTiming,base.beatTiming);
 assert.deepEqual(changed.frames.map(f=>f.dimming),base.frames.map(f=>f.dimming));
 assert.notDeepEqual(changed.frames,base.frames);assert.equal(applyTrackColors(base,null),base);
});
test('single-color modes remain constant and explicit section colors take precedence',()=>{
 const changed=applyTrackColors(plan(),COLOR_MODES.find(m=>m.id==='warm-white'));
 for(const t of [0,.63,3,7.99]){const f=showFrameAt(changed,t);assert.deepEqual([f.r,f.g,f.b],[255,206,138]);}
 const edits=sectionEditsFor(changed);for(const e of edits){e.colors='hold';e.colorA='#00ff00';}
 const f=showFrameAt(applySectionLighting(changed,edits),3);assert.equal(f.g,255);assert.equal(f.r,0);
});
test('malformed saved color modes fall back to the original show',()=>{
 const base=plan();assert.equal(validColorMode({id:'x',name:'x',colors:['bad','bad']}),false);
 assert.equal(applyTrackColors(base,{colors:[]}),base);
});
