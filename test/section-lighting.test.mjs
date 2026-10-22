import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionEditsFor,applySectionLighting,transferMotif,validateSectionEdits,snapSectionTime} from '../public/section-lighting.js';
import {showFrameAt} from '../public/show-plan.js';
const plan=()=>({duration:4,step:.125,sections:[{start:0,end:2,label:'chorus'},{start:2,end:4,label:'chorus'}],
 frames:Array.from({length:32},()=>({r:100,g:30,b:200,dimming:30,state:true})),
 beatGrid:{beats:[.13,.63,1.13,1.63,2.13,2.63,3.13,3.63],downbeats:[.13,2.13]},
 beatTiming:{times:[.13,.63,1.13,1.63,2.13,2.63,3.13,3.63],minimum:5,maximum:75},
 arrangement:{step:.125,bases:Array(32).fill(.2),times:[.13,.63,1.13,1.63,2.13,2.63,3.13,3.63],accents:Array(8).fill(.5),decays:Array(8).fill(.15),decay:.15}});
test('opening and saving neutral editor controls preserves the live show exactly',()=>{
 const base=plan(),edits=sectionEditsFor(base);
 assert.equal(applySectionLighting(base,edits),base);
 assert.equal(applySectionLighting(base,edits.map(e=>({...e,profile:'inherit',fixtures:[]}))),base);
 const first=showFrameAt(base,1.1);
 assert.deepEqual(showFrameAt(applySectionLighting(base,edits),1.1),first);
});
test('quiet edits mute accents only in the selected section without mutating the analysis',()=>{
 const base=plan(),snapshot=structuredClone(base),edits=sectionEditsFor(base);
 edits[0].rhythm='none';edits[0].movement=.35;
 const result=applySectionLighting(base,edits);
 assert.deepEqual(result.arrangement.accents.slice(0,4),[0,0,0,0]);
 assert.deepEqual(result.arrangement.accents.slice(4),[.5,.5,.5,.5]);
 assert.deepEqual(base,snapshot);assert.deepEqual(result.beatTiming.times,base.beatTiming.times);
});
test('color changes happen on exact beat times and are stable after seeking',()=>{
 const base=plan(),edits=sectionEditsFor(base);Object.assign(edits[0],{colors:'pair',colorA:'#ff0000',colorB:'#0000ff'});
 const result=applySectionLighting(base,edits);
 assert.equal(showFrameAt(result,.629).r,255);assert.equal(showFrameAt(result,.63).b,255);
 const expected=showFrameAt(result,.63);showFrameAt(result,3.9);assert.deepEqual(showFrameAt(result,.63),expected);
 assert.equal(showFrameAt(result,2.01).r,100);
});
test('motif transfer copies lighting but preserves independent names and time boundaries',()=>{
 const edits=sectionEditsFor(plan());edits[0].colors='hold';edits[0].movement=.2;
 const copy=transferMotif(edits,0);assert.equal(copy[1].movement,.2);assert.equal(copy[1].start,2);assert.equal(edits[1].movement,1);
 edits[1].motif='other';assert.equal(transferMotif(edits,0)[1].movement,1);
});
test('downbeat-only selection uses detected meter, and invalid boundaries are rejected',()=>{
 const base=plan(),edits=sectionEditsFor(base);edits[0].rhythm='bars';
 assert.deepEqual(applySectionLighting(base,edits).arrangement.accents.slice(0,4),[.5,0,0,0]);
 assert.equal(snapSectionTime(base,.7),.63);
 const invalid=structuredClone(edits);invalid[1].start=1;assert.throws(()=>validateSectionEdits(invalid,4));
 edits[0].movement=Infinity;assert.throws(()=>validateSectionEdits(edits,4));
});

test('section styles reuse song profiles and return to the song standard at exact boundaries',async()=>{
 const {applySongShowProfile}=await import('../public/dj-show-profile.js');
 const {sectionPlanAt}=await import('../public/section-lighting.js');
 const base=plan(),standard=applySongShowProfile(base,'calm'),edits=sectionEditsFor(base);
 edits[0].profile='auto';edits[1].profile='atmospheric';
 const result=applySectionLighting(standard,edits);
 assert.equal(sectionPlanAt(result,1.999).showProfile,'auto');
 assert.equal(sectionPlanAt(result,2).showProfile,'atmospheric');
 assert.deepEqual(showFrameAt(result,.5),showFrameAt(applySectionLighting(applySongShowProfile(base,'auto'),edits.map(e=>({...e,profile:'inherit'}))),.5));
 assert.equal(result.profilePlans.auto.showProfileBase,base);
 assert.throws(()=>applySectionLighting(base,[{...edits[0],profile:'unknown'}]));
});

test('an edited four-color palette survives seeks without inventing replacement colors',()=>{
 const base=plan(),edits=sectionEditsFor(base),palette=['#ff0000','#00ff00','#0000ff','#ffffff'];
 Object.assign(edits[0],{colors:'cycle',palette});
 const result=applySectionLighting(base,edits);
 assert.deepEqual(result.sectionLighting[0].palette,[[255,0,0],[0,255,0],[0,0,255],[255,255,255]]);
 assert.deepEqual([showFrameAt(result,1.63).r,showFrameAt(result,1.63).g,showFrameAt(result,1.63).b],[255,255,255]);
});

test('device cues use the existing look evaluator, prefer fixtures over groups and mix emitted light',async()=>{
 const {cleanLook,songFixtureMix}=await import('../public/dmx-show.js');
 const base=plan(),edits=sectionEditsFor(base);
 edits[0].fixtures=[{target:'patch-group:0',look:cleanLook({mode:'fixed',colors:['#ff0000','#ff0000'],animation:'follow'})},{target:'patch:fixture-a',look:cleanLook({mode:'fixed',colors:['#0000ff','#0000ff'],animation:'follow',brightness:50})}];
 const edited=applySectionLighting(base,edits),frame={r:20,g:40,b:60,state:true,dimming:100};
 const stream={frame,weight:1,movingPlan:edited,songTime:.5,beat:1};
 const fixture=songFixtureMix(frame,[stream],['patch:fixture-a','patch-group:0']);
 assert.equal(fixture.r,0);assert.equal(fixture.b,127.5);
 const group=songFixtureMix(frame,[stream],['patch:fixture-b','patch-group:0']);assert.equal(group.r,255);
 assert.deepEqual(songFixtureMix(frame,[{...stream,songTime:2}],['patch:fixture-a','patch-group:0']),frame);
 const mixed=songFixtureMix(frame,[{...stream,weight:.5},{frame,weight:.5}],['patch:fixture-a']);
 assert.equal(mixed.r,10);assert.equal(mixed.b,93.75);
});
