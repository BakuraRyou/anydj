import test from 'node:test';
import assert from 'node:assert/strict';
import {songPalettes,songPaletteAt} from '../public/song-palette.js';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {automaticPalette,automaticStage} from '../public/dmx-auto.js';
import {settings} from '../lib/music.mjs';
import {applyTrackColors} from '../public/dj-color-modes.js';
import {applySectionLighting,sectionEditsFor} from '../public/section-lighting.js';
const dark={bands:[.75,.15,.06,.03,.01],tone:.15,flatness:.05,tonality:.8};
const bright={bands:[.03,.04,.1,.4,.43],tone:.85,flatness:.6,tonality:.2};
const windows=kind=>Array.from({length:800},(_,i)=>({...kind,rms:.1+(i%25<3?.2:0),bass:.1,beatSeq:Math.floor(i/25),bpm:120,confidence:.9}));
const options=settings({arrangement:'auto'});
test('absolute timbre creates distinct deterministic song palettes, not random per-song colors',()=>{
 const sections=[{start:0,end:16}],fallback=[[255,0,0],[0,0,255]];
 const a=songPalettes(windows(dark),sections,fallback),b=songPalettes(windows(bright),sections,fallback);
 assert.deepEqual(a,songPalettes(windows(dark),sections,fallback));
 assert.ok(a[0].flat().reduce((sum,v,i)=>sum+Math.abs(v-b[0].flat()[i]),0)>500);
 const constant=compileShow(windows(dark),16,options);
 assert.deepEqual(constant,compileShow(windows(dark),16,options));
 assert.ok(constant.soundPalettes.flat(2).every(v=>Number.isInteger(v)&&v>=0&&v<=255));
});
test('section palettes evolve with measured timbre, constant sound does not acquire a color clock',()=>{
 const parts=[{start:0,end:8},{start:8,end:16}];
 const constant=songPalettes(windows(dark),parts,[[255,0,0]]);
 assert.deepEqual(constant[0],constant[1]);
 const changed=songPalettes([...windows(dark).slice(0,400),...windows(bright).slice(0,400)],parts,[[255,0,0]]);
 assert.notDeepEqual(changed[0],changed[1]);
 const silent=songPalettes(windows(dark).map(w=>({...w,rms:0})),parts,[[23,45,67]]);
 assert.deepEqual(silent,[[[23,45,67]],[[23,45,67]]]);
});
test('choreography and stage use song colors, including two-deck blends and seeks',()=>{
 const plan=compileShow(windows(bright),16,options);
 assert.ok(plan.colorDirection.events.length>0);
 for(const e of plan.colorDirection.events){
  const time=e.time+e.transition,palette=songPaletteAt(plan,time),frame=showFrameAt(plan,time);
  assert.deepEqual([frame.r,frame.g,frame.b],palette[0]);
 }
 const streams=[2,7].map((time,i)=>({frame:showFrameAt(plan,time),palette:songPaletteAt(plan,time),weight:i?.3:.7,look:'peak',beat:0}));
 const palettes=streams.map(s=>automaticPalette(s.frame,4,s.look,s.palette));
 const stage=automaticStage(streams,4);
 assert.deepEqual(stage.palette,palettes[0].map((p,i)=>p.map((v,c)=>Math.round(v*.7+palettes[1][i][c]*.3))));
 const atSeven=structuredClone(songPaletteAt(plan,7));
 songPaletteAt(plan,14);songPaletteAt(plan,0);
 assert.deepEqual(songPaletteAt(plan,7),atSeven);
});
test('track and section overrides take precedence, including one-color holds',()=>{
 const plan=compileShow(windows(dark),16,options);
 const custom=applyTrackColors(plan,{id:'test',name:'Test',colors:['#ff0000','#0000ff']});
 assert.deepEqual(songPaletteAt(custom,4),[[255,0,0],[0,0,255]]);
 const edits=sectionEditsFor(plan);edits.forEach(e=>{e.colors='hold';e.colorA='#00ff00';});
 const edited=applySectionLighting(plan,edits);
 const p=songPaletteAt(edited,4);
 assert.deepEqual(p,[[0,255,0]]);
 assert.deepEqual(automaticPalette(showFrameAt(edited,4),4,'peak',p),Array.from({length:4},()=>[0,255,0]));
 const explicit=compileShow(windows(dark),16,settings({arrangement:'auto',palette:'custom',colorA:'#ff0000',colorB:'#0000ff'}));
 assert.equal(explicit.effectiveOptions.palette,'custom');assert.equal(explicit.soundPalettes.length,0);
});
