import test from 'node:test';
import assert from 'node:assert/strict';
import {colorCuesFor,compileShow,showFrameAt} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
test('color changes follow selected accents and use actual downbeats in flowing passages',()=>{
 const times=Array.from({length:40},(_,i)=>i*.5);
 const sections=[{start:0,look:'flow'},{start:10,look:'peak'}];
 const bars=[0,1.5,3,4.5,6,7.5,9,10.5,12,13.5,15,16.5,18,19.5];
 const cues=colorCuesFor({times},sections,bars);
 assert.ok(cues.every(cue=>times.includes(cue.time)));
 assert.ok(cues.filter(cue=>cue.section===0).every(cue=>bars.includes(cue.time)));
 assert.ok(cues.filter(cue=>cue.section===1).length>cues.filter(cue=>cue.section===0).length);
 assert.deepEqual(colorCuesFor({times},[{start:0,look:'held'}],bars),[]);
 assert.deepEqual(colorCuesFor({times:[]},sections,bars),[]);
});
test('energetic passages use more than one fixed color pairing and remain seekable',()=>{
 const duration=24,beats=Array.from({length:48},(_,i)=>i*.5);
 const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
 const windows=Array.from({length:1200},(_,i)=>({rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.5,beatSeq:Math.floor(i/25)}));
 const structure={version:1,source:'all-in-one',duration,segments:[{start:0,end:12,label:'verse'},{start:12,end:24,label:'chorus'}]};
 const plan=compileShow(windows,duration,settings({arrangement:'auto'}),grid,structure);
 assert.ok(plan.colorCues.filter(c=>c.time>=12).length>=10);
 const colors=[14.375,15.375,16.375,17.375].map(time=>showFrameAt(plan,time));
 const distance=(a,b)=>['r','g','b'].reduce((sum,key)=>sum+Math.abs(a[key]-b[key]),0);
 assert.ok(colors.slice(1).every((color,i)=>distance(color,colors[i])>60));
 const frame=showFrameAt(plan,15.375);showFrameAt(plan,23);assert.deepEqual(showFrameAt(plan,15.375),frame);
 assert.deepEqual(plan.beatGrid,grid);
});
