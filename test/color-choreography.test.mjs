import test from 'node:test';
import assert from 'node:assert/strict';
import {choreographColors} from '../public/color-choreography.js';
import {showFrameAt} from '../public/show-plan.js';
import {sectionEditsFor,applySectionLighting} from '../public/section-lighting.js';
import {automaticStage} from '../public/dmx-auto.js';
import {prepareStageMotifs} from '../public/stage-motifs.js';
const fixture=()=>({duration:8,step:.125,effectiveOptions:{palette:'sunset'},colorPalette:[[255,80,0],[0,80,255]],
 sections:[{start:0,end:4,look:'held',motif:0},{start:4,end:8,look:'peak',motif:0}],
 frames:Array.from({length:64},()=>({r:200,g:40,b:10,dimming:30})),
 beatTiming:{minimum:5,maximum:75},beatGrid:{downbeats:[.13,2.13,4.13,6.13]},
 arrangement:{step:.125,bases:Array(64).fill(.3),times:Array.from({length:16},(_,i)=>i*.5+.13),accents:Array(16).fill(.5),decays:Array(16).fill(.2),decay:.2}});
test('quiet sections retain color; active colors change at exact off-frame beats',()=>{
 const base=fixture(),show=choreographColors(base,'disco');
 assert.ok(show.colorEvents.every(e=>e.time>=4&&base.arrangement.times.includes(e.time)));
 assert.equal(showFrameAt(show,2.5).r,200);
 const a=showFrameAt(show,4.629),b=showFrameAt(show,4.63);
 assert.equal(a.r,255);assert.equal(b.b,255);
 assert.equal(showFrameAt(show,4.99).b,255);
 assert.equal(base.colorEvents,undefined);
});
test('stage palettes follow within-section color events and explicit colors despite a stored motif anchor',()=>{
 const plan=choreographColors(fixture(),'disco');
 const motifColor=prepareStageMotifs(plan)[1].color;
 const render=(show,time,mode)=>automaticStage([{frame:showFrameAt(show,time),motifColor,weight:1,look:'peak',beat:0}],4,undefined,mode);
 for(const mode of ['auto','chase','wash','follow','alternate']){
   assert.deepEqual(render(plan,4.629,mode).palette[0],[255,80,0]);
   assert.deepEqual(render(plan,4.63,mode).palette[0],[0,80,255]);
   assert.deepEqual(render(plan,4.99,mode).palette[0],[0,80,255]);
 }
 const edits=sectionEditsFor(plan);edits[1].colors='hold';edits[1].colorA='#00ff00';
 assert.deepEqual(render(applySectionLighting(plan,edits),4.63,'auto').palette[0],[0,255,0]);
});
test('explicit section colors and reduced movement retain precedence over automatic cues',()=>{
 const plan=choreographColors(fixture(),'disco'),edits=sectionEditsFor(plan);
 edits[1].colors='hold';edits[1].colorA='#00ff00';
 const held=applySectionLighting(plan,edits);assert.equal(showFrameAt(held,4.63).g,255);assert.equal(showFrameAt(held,4.63).b,0);
 edits[1].colors='auto';edits[1].movement=0;
 const quiet=applySectionLighting(plan,edits);
 for(const t of [4.13,4.63,5.13])assert.equal(showFrameAt(quiet,t).r,plan.frames[32].r);
});
test('no inferred color contrast overrides an explicit custom single-color palette',()=>{
 const base=fixture();base.effectiveOptions.palette='custom';base.colorPalette=[[200,40,10],[200,40,10]];
 assert.equal(choreographColors(base,'disco').colorEvents.length,0);
});
test('local percussion raises color cadence within a section labelled flow',()=>{
 const plan=fixture();plan.sections[1].look='flow';
 plan.arrangement.drama={step:.1,intensity:Array(80).fill(.5),percussion:Array.from({length:80},(_,i)=>i>=60?.8:.1)};
 const show=choreographColors(plan,'disco');
 assert.ok(show.colorEvents.filter(e=>e.time>=6).length>show.colorEvents.filter(e=>e.time>=4&&e.time<6).length);
});
