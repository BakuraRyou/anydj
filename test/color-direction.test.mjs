import test from 'node:test';
import assert from 'node:assert/strict';
import {planColorDirection,directionAt,directionRGB,legacyColorDirection} from '../public/color-direction.js';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {applyTrackColors,COLOR_MODES} from '../public/dj-color-modes.js';
import {applyShowProfile} from '../public/dj-show-profile.js';
import {applySectionLighting,sectionEditsFor} from '../public/section-lighting.js';
import {settings} from '../lib/music.mjs';
const dark={rms:.2,bands:[.7,.1,.1,.05,.05],tone:.15,flatness:.1};
const bright={rms:.2,bands:[.05,.05,.1,.4,.4],tone:.85,flatness:.6};
const audio=parts=>parts.flatMap(p=>Array.from({length:400},(_,i)=>({...p,beatSeq:Math.floor(i/25),bass:.1,flux:i%25===0?.7:0})));
const fixture=()=>({sections:[{motif:0,look:'peak'},{motif:1,look:'peak'},{motif:0,look:'peak'}],moods:[],arrangement:{patterns:{phrases:[0,1,2].map(i=>({start:i*8,end:(i+1)*8,section:i}))},times:Array.from({length:48},(_,i)=>i*.5),accents:Array(48).fill(.7)}});
test('new timbre opens a new color family and a returning motif recalls its identity',()=>{
 const source=fixture(),w=audio([dark,bright,dark]),p=planColorDirection(w,source);
 assert.deepEqual(p,planColorDirection(w,source));
 assert.deepEqual(directionAt(p,7),directionAt(p,23));
 assert.notDeepEqual(directionAt(p,3),directionAt(p,11));
 assert.equal(p.phrases[2].reason,'motif-return');
 assert.ok(p.events.every(e=>e.role===0));
 assert.ok(p.events.every((e,i)=>!i||e.time-p.events[i-1].time>=4));
 const expected=directionAt(p,9.3);directionAt(p,22);assert.deepEqual(directionAt(p,9.3),expected);
});
test('quiet unchanged material stays richly colored without a free-running clock',()=>{
 const f=fixture();f.sections.forEach(s=>{s.look='held';s.motif=0;});
 const p=planColorDirection(audio([bright,bright,bright]),f);
 assert.equal(p.events.length,1);
 const rgb=directionAt(p,10)[0];assert.ok((Math.max(...rgb)-Math.min(...rgb))/Math.max(...rgb)>.65);
 assert.equal(planColorDirection(audio([dark,dark,dark]).map(w=>({...w,rms:0})),f),null);
});
test('instrument changes are evidence even when the spectral averages are unchanged',()=>{
 const f=fixture();f.structure={instruments:{step:.1,...Object.fromEntries(['drums','bass','vocals','other'].map(name=>[name,Array.from({length:240},(_,i)=>(i<80||i>=160?name==='vocals':name==='drums')?1:0)]))}};
 const p=planColorDirection(audio([dark,dark,dark]),f);
 assert.ok(p.phrases[1].change>.9);assert.notDeepEqual(directionAt(p,3),directionAt(p,11));
 assert.deepEqual(directionAt(p,7),directionAt(p,23));
});
test('uncertain mood estimates do not force a color change, RGB remains in gamut',()=>{
 const f=fixture(),w=audio([dark,dark,dark]);const first=planColorDirection(w,f);
 f.moods=[{start:0,end:24,mood:'bright',confidence:.1}];assert.deepEqual(planColorDirection(w,f),first);
 for(let hue=0;hue<360;hue+=5)assert.ok(directionRGB([.7,.24,hue]).every(v=>Number.isInteger(v)&&v>=0&&v<=255));
});
test('A/B color comparison preserves every dimmer value, rhythm, movement and overrides',()=>{
 const w=audio([dark,bright,dark]),plan=compileShow(w,24,settings({arrangement:'auto'}));
 assert.ok(plan.directionActive);const snapshot=structuredClone(plan);
 const old=legacyColorDirection(plan);
 assert.notDeepEqual(plan.frames.map(f=>[f.r,f.g,f.b]),old.frames.map(f=>[f.r,f.g,f.b]));
 for(const profile of ['auto','party','disco','calm','atmospheric']){
  const a=applyShowProfile(applyTrackColors(plan,null),profile),b=applyShowProfile(applyTrackColors(plan,{id:'legacy-auto'}),profile);
  assert.deepEqual(a.beatTiming,b.beatTiming);assert.deepEqual(a.arrangement,b.arrangement);
  for(let t=0;t<24;t+=.137)assert.equal(showFrameAt(a,t).dimming,showFrameAt(b,t).dimming);
 }
 const custom=applyTrackColors(plan,COLOR_MODES.find(m=>m.id==='warm-white'));
 assert.deepEqual([showFrameAt(custom,4).r,showFrameAt(custom,4).g,showFrameAt(custom,4).b],[255,206,138]);
 const edits=sectionEditsFor(plan);edits.forEach(e=>{e.movement=0;e.colors='auto';});
 const held=applySectionLighting(plan,edits);
 for(const section of held.sectionLighting){const a=showFrameAt(held,section.start),b=showFrameAt(held,section.end-.001);assert.deepEqual([a.r,a.g,a.b],[b.r,b.g,b.b]);}
 assert.deepEqual(plan,snapshot);
});


test('short accents retain the scene palette and transitions stay inside endpoint RGB bounds',()=>{
 const f=fixture(),w=audio([dark,bright,dark]),p=planColorDirection(w,f);
 assert.equal(p.events.length,3);
 for(const event of p.events){
  if(!event.transition)continue;
  const start=directionAt(p,event.time),end=directionAt(p,event.time+event.transition);
  for(let t=0;t<=event.transition;t+=.025){
   const colors=directionAt(p,event.time+t);
   colors.forEach((rgb,i)=>rgb.forEach((v,c)=>assert.ok(v>=Math.min(start[i][c],end[i][c])&&v<=Math.max(start[i][c],end[i][c]))));
  }
 }
 assert.deepEqual(directionAt(p,9.1),directionAt(p,15.9));
 f.arrangement.accents=f.arrangement.accents.map((_,i)=>i%3===0?.95:.1);
 assert.deepEqual(planColorDirection(w,f),p,'brightness attacks do not recolor the scene');
});

test('short phrase changes defer the palette without losing a sustained new timbre',()=>{
 const f=fixture();f.arrangement.patterns.phrases=Array.from({length:12},(_,i)=>({start:i*2,end:i*2+2,section:i<1?0:1}));
 const w=audio([dark,bright,bright]);w.splice(100,300,...Array.from({length:300},()=>({...bright})));
 const p=planColorDirection(w,f);
 assert.equal(p.events[1].time,4);
 assert.equal(p.phrases[1].reason,'minimum-hold');
 assert.equal(p.phrases[1].eventTime,0);
 assert.notDeepEqual(directionAt(p,1),directionAt(p,5));
 assert.ok(p.events.every((e,i)=>!i||e.time-p.events[i-1].time>=4));
});

test('saved LCH color directions remain readable',()=>{
 const color=[.54,.28,30];
 assert.deepEqual(directionAt({version:1,events:[{time:0,transition:0,from:[color],to:[color]}]},1),[directionRGB(color)]);
});
