import {legacyColorDirection} from '../public/color-direction.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {colorCuesFor,compileShow,showFrameAt} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
test('steady beats retain a color family; measured phrase changes cue a new one',()=>{
 const times=Array.from({length:96},(_,i)=>i*.5),bars=times.filter((_,i)=>i%4===0);
 const sections=[{start:0,end:48,look:'peak'}];
 const phrases=Array.from({length:6},(_,i)=>({start:i*8,end:(i+1)*8,section:0,energy:.7,tone:.4}));
 assert.equal(colorCuesFor({times,patterns:{phrases}},sections,bars).length,1);
 phrases[3].energy=.35;phrases[4].energy=.35;phrases[5].energy=.35;
 const cues=colorCuesFor({times,patterns:{phrases}},sections,bars);
 assert.deepEqual(cues.map(c=>c.time),[0,24]);
 assert.equal(cues[1].reason,'sound-change');
 assert.ok(cues.every(c=>times.includes(c.time)&&bars.includes(c.time)));
 assert.deepEqual(colorCuesFor({times},[{start:0,look:'held'}],bars),[]);
 assert.deepEqual(colorCuesFor({times:[]},sections,bars),[]);
});
test('legacy comparison: energetic sections alternate contrasting colors on selected musical accents',()=>{
 const duration=24,beats=Array.from({length:48},(_,i)=>i*.5);
 const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
 const windows=Array.from({length:1200},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
 const structure={version:1,source:'all-in-one',duration,segments:[{start:0,end:12,label:'verse'},{start:12,end:24,label:'chorus'}]};
 const plan=legacyColorDirection(compileShow(windows,duration,settings({arrangement:'auto'}),grid,structure));
 assert.equal(plan.colorCues.filter(c=>c.time>=12).length,1);
 const colors=[20.375,21.375,22.375,23.375].map(time=>showFrameAt(plan,time));
 const distance=(a,b)=>['r','g','b'].reduce((sum,key)=>sum+Math.abs(a[key]-b[key]),0);
 assert.ok(colors.slice(1).some((color,i)=>distance(color,colors[i])>200));
 assert.ok(plan.colorEvents.every(e=>beats.includes(e.time)));
 assert.ok(distance(showFrameAt(plan,8.375),showFrameAt(plan,20.375))>60);
 const frame=showFrameAt(plan,15.375);showFrameAt(plan,23);assert.deepEqual(showFrameAt(plan,15.375),frame);
 assert.deepEqual(plan.beatGrid,grid);
});

test('a returning chorus recovers its color family instead of continuing a global color counter',()=>{
 const duration=64,beats=Array.from({length:128},(_,i)=>i*.5);
 const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
 const windows=Array.from({length:3200},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
 const structure={version:1,source:'all-in-one',duration,segments:[
  {start:0,end:16,label:'verse'},{start:16,end:32,label:'chorus'},
  {start:32,end:48,label:'bridge'},{start:48,end:64,label:'chorus'}
 ]};
 const plan=compileShow(windows,duration,settings({arrangement:'auto',mood:'off'}),grid,structure);
 const a=showFrameAt(plan,28.375),b=showFrameAt(plan,60.375);
 assert.ok(['r','g','b'].reduce((sum,key)=>sum+Math.abs(a[key]-b[key]),0)<10);
 assert.equal(plan.colorCues.filter(c=>c.reason==='sound-change').length,0);
});
