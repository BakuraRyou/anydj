import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeBaseDimming,renderStrobe} from '../public/dmx-strobe.js';
import {movingPresenceAt,musicalDarknessAt} from '../public/dmx-activity.js';

const plan=role=>({duration:4,showProfile:'strobe',effectiveOptions:{maximum:80},
 showScore:[{start:0,end:4,role,energy:.8,rhythmic:true,tone:.5}],
 sections:[{start:0,end:4,look:'peak'}],beatGrid:{beats:[0,.5,1,1.5,2,2.5,3,3.5]},
 arrangement:{times:[0,.5,1,1.5,2,2.5,3,3.5],accents:Array(8).fill(.6),eventSources:Array(8).fill('onset')}});
const source=(p,time=1.05)=>({movingPlan:p,songTime:time,look:'peak',weight:1,flicker:53,
 frame:{state:true,dimming:12,r:255,g:30,b:0},washDimming:10});

test('active sparse strobe roles have a useful brightness basis within the configured ceiling',()=>{
 const s=source(plan('groove'));
 assert.equal(strobeBaseDimming(s),67.2);
 s.movingPlan.effectiveOptions.maximum=40;
 assert.equal(strobeBaseDimming(s),33.6);
 s.frame.dimming=100;
 assert.equal(strobeBaseDimming(s),40);
});
test('the brightness correction preserves off states, passage edits and gentle passages',()=>{
 const p=plan('groove'),s=source(p);
 assert.equal(strobeBaseDimming({...s,frame:{...s.frame,dimming:0}}),0);
 assert.equal(strobeBaseDimming({...s,frame:{...s.frame,state:false}}),0);
 p.sectionLighting=[{start:0,end:2,movement:.4,rhythm:'auto'}];
 assert.equal(strobeBaseDimming(s),10);
 for(const role of ['held','silence'])assert.equal(strobeBaseDimming(source(plan(role))),10);
 assert.equal(strobeBaseDimming({...source(plan('groove')),look:'outro'}),10);
 assert.equal(strobeBaseDimming({...s,movingPlan:null}),10);
});
test('ordinary section metadata does not bypass the active strobe brightness correction',()=>{
 const p=plan('groove');p.sectionLighting=[{start:0,end:4,movement:1,rhythm:'auto',palette:null,events:[0,.5,1]}];
 assert.equal(strobeBaseDimming(source(p)),67.2);
 p.sectionLighting[0].rhythm='none';
 assert.equal(strobeBaseDimming(source(p)),10);
});
test('moving sources apply the musical fade once through presence, while fixed fixtures keep their fade',()=>{
 const p=plan('groove');p.arrangement.blackouts=[{start:1,end:2}];
 const s=source(p,1.03),darkness=musicalDarknessAt(p,s.songTime).level;
 assert.ok(Math.abs(darkness-.5)<1e-9);
 const moving=renderStrobe([s],[{type:'moving',cells:1}],{movingSource:true}).frames[0][0];
 assert.equal(moving.dimming,strobeBaseDimming(s));
 assert.equal(movingPresenceAt({...s,stageMode:'strobe'}).level,darkness);
 const staticSource={...s,flicker:0};
 const fixed=renderStrobe([staticSource],[{type:'spot',cells:1}]).frames[0][0];
 assert.ok(Math.abs(fixed.dimming-strobeBaseDimming(s)*darkness)<1e-9);
 const off={...s,songTime:1.5};
 assert.equal(movingPresenceAt({...off,stageMode:'strobe'}).level,0);
 assert.equal(renderStrobe([off],[{type:'spot',cells:1}]).frames[0][0].dimming,0);
});
