import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateMode,analyzeMood} from '../public/mood-analysis.js';
import {compileShow} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
const profile=minor=>{const p=Array(12).fill(0);for(const n of minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11])p[n]=n===0?3:n===(minor?3:4)||n===7?2:1;return p.map(v=>v/11);};
const song=minor=>Array.from({length:1000},(_,i)=>({rms:.15,bass:.06,beatSeq:Math.floor(i/25),chroma:profile(minor),tone:.4,bpm:120,confidence:1}));
test('Tonale Profile unterscheiden Dur/Moll und lehnen gleichmäßige oder leere Verteilungen ab',()=>{
 assert.equal(estimateMode(profile(false)).mode,'major');assert.equal(estimateMode(profile(true)).mode,'minor');
 assert.equal(estimateMode(Array(12).fill(1/12)).mode,null);assert.equal(estimateMode(Array(12).fill(0)).mode,null);
});
test('Stimmungsmodus verändert Farben, nicht Beat-Helligkeit, und lässt sich ausschalten',()=>{
 const w=song(false),off=compileShow(w,20,settings()),on=compileShow(w,20,settings({mood:'auto'}));
 assert.equal(off.moods.length,0);assert.ok(on.moods.some(m=>m.mode==='major'&&m.mood==='bright'));
 assert.deepEqual(on.frames.map(f=>f.dimming),off.frames.map(f=>f.dimming));
 assert.notDeepEqual(on.frames,off.frames);
 assert.notDeepEqual(on.frames,compileShow(song(true),20,settings({mood:'auto'})).frames);
 assert.throws(()=>settings({mood:'invalid'}));
});
test('Unklare Folgepassage hält die zuvor erkannte Palette und Stille startet neutral',()=>{
 const w=song(true);for(let i=500;i<w.length;i++)w[i].chroma=Array(12).fill(1/12);
 const moods=analyzeMood(w,20);assert.equal(moods.at(-1).mood,moods[3].mood);assert.equal(moods.at(-1).held,true);
 assert.ok(analyzeMood(w.map(l=>({...l,rms:0})),20).every(m=>m.mood==='neutral'));
});

test('Gleiche Moll-Harmonik erhält bei niedriger und hoher Energie unterschiedliche Stimmungen',()=>{
 const w=song(true);
 for(let i=0;i<500;i++){w[i].rms=.02;w[i].bpm=70;}
 const moods=analyzeMood(w,20);
 assert.equal(moods[2].mood,'wistful');assert.equal(moods.at(-1).mood,'dramatic');
});
test('Palettenwechsel überblenden bei gleichbleibender Tonkontur statt sprunghaft umzuschalten',()=>{
 const w=song(true);for(let i=0;i<500;i++){w[i].rms=.02;w[i].bpm=70;}
 const plan=compileShow(w,20,settings({mood:'auto',toneFollow:1}));
 const jumps=plan.frames.slice(1).map((f,i)=>Math.max(...['r','g','b'].map(k=>Math.abs(f[k]-plan.frames[i][k]))));
 assert.ok(Math.max(...jumps)<35);
});
