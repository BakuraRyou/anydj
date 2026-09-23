import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticStage,automaticPalette,automaticColorCount} from '../public/dmx-auto.js';
const frame={state:true,r:255,g:40,b:0,dimming:60};
const source=(look='peak',more={})=>({frame,weight:1,beat:3,look,...more});
const hues=result=>new Set(result.frames.flat().filter(Boolean).map(f=>[f.r,f.g,f.b].join(',')));
test('color limit is adaptive: calm passages deliberately use one color on every lamp',()=>{
  for(const max of [1,2,3,4]){
    const calm=automaticStage([source('held')],max);
    assert.equal(calm.palette.length,1);assert.equal(hues(calm).size,1);
    const peak=automaticStage([source()],max);assert.equal(hues(peak).size,max);
    assert.equal(peak.palette.length,max);
  }
});
test('a build increases its palette within the chosen ceiling',()=>{
  assert.equal(automaticColorCount(4,'lift',0),1);
  assert.equal(automaticColorCount(4,'lift',.7),3);
  assert.equal(automaticColorCount(4,'lift',1),4);
  assert.equal(automaticColorCount(4,'flow'),2);
});
test('crossfades preserve the palette ceiling and interpolate per color slot',()=>{
  const a=source('held',{weight:.5}),b=source('peak',{weight:.5,frame:{...frame,r:0,g:0,b:255}});
  for(const max of [1,2,3,4]){
    const result=automaticStage([a,b],max);assert.ok(hues(result).size<=max);
    assert.deepEqual(result.palette[0],[128,20,128]);
  }
});
test('automatic activity holds without selected acoustic events',()=>{
  const a=automaticStage([source()],4),b=automaticStage([source('peak',{beat:3.5})],4);
  assert.deepEqual(a.frames,b.frames);assert.deepEqual(a,automaticStage([source()],4));
  const steady=automaticStage([source('flow',{beat:null})],4);
  assert.ok(steady.frames.flat().some(f=>f.dimming===51));
  assert.ok(steady.frames.flat().every(f=>f.dimming===51));
  assert.ok(a.frames.flat().every(f=>f.dimming<=60));
});
test('pause, disabled sources and zero brightness cannot light up the stage',()=>{
  for(const sources of [[],[source('peak',{weight:0})],[source('peak',{frame:{...frame,state:false}})]])assert.ok(automaticStage(sources,4).frames.flat().every(f=>f===null));
  assert.ok(automaticStage([source('peak',{frame:{...frame,dimming:0}})],4).frames.flat().every(f=>f.dimming===0));
  assert.deepEqual(automaticPalette(frame,1),[[255,40,0]]);
});

test('Lauflicht preserves the travelling wave as a separate mode',()=>{
  const equipment={devices:Array.from({length:4},(_,i)=>({id:String(i),type:'spot',cells:1}))};
  for(let i=0;i<4;i++){
    const streams=[source('peak',{beat:i*.5,stageCue:{kind:'punch',group:0,motion:1}})];
    const chase=automaticStage(streams,4,equipment,'chase').frames.flat();
    assert.equal(chase[i].dimming,60);
    assert.ok(chase.some(f=>f.dimming===0));
    assert.notDeepEqual(chase,automaticStage(streams,4,equipment).frames.flat());
  }
  const streams=[source('flow',{beat:null})];
  assert.ok(automaticStage(streams,4,equipment,'chase').frames.flat().every(f=>f.dimming===51));
});
test('DJ presets retain source pulses, calm base levels and four-beat group changes',()=>{
  const equipment={devices:Array.from({length:4},(_,i)=>({id:String(i),type:'spot',cells:1}))};
  const render=(mode,more={})=>automaticStage([source('peak',{beat:0,washDimming:25,...more})],4,equipment,mode).frames.flat().map(f=>f.dimming);
  for(const dimming of [0,5,60,100])assert.deepEqual(render('follow',{frame:{...frame,dimming}}),Array(4).fill(dimming));
  assert.deepEqual(render('wash'),[25,25,25,25]);
  assert.deepEqual(render('wash',{beat:2.3}),render('wash'));
  assert.deepEqual(render('alternate',{beat:3.999}),[60,0,60,0]);
  assert.deepEqual(render('alternate',{beat:4}),[0,60,0,60]);
  assert.deepEqual(render('alternate',{beat:4,motionBeat:0}),[0,60,0,60]);
  assert.deepEqual(render('alternate',{beat:null}),[60,60,60,60]);
  assert.deepEqual(render('alternate',{look:'held',beat:4}),[60,60,60,60]);
  for(const mode of ['wash','follow','alternate']){
    assert.deepEqual(render(mode,{frame:{...frame,dimming:0}}),[0,0,0,0]);
    assert.ok(automaticStage([],4,equipment,mode).frames.flat().every(f=>f===null));
    const one={devices:[{id:'solo',type:'spot',cells:1}]};
    assert.ok(automaticStage([source('peak',{beat:4,washDimming:25})],4,one,mode).frames[0][0].dimming>0);
  }
});
test('DJ presets blend both decks and respect the requested color ceiling',()=>{
  for(const mode of ['wash','follow','alternate'])for(const count of [1,2,3,4]){
    const a=source('peak',{weight:.25,beat:0,washDimming:20});
    const b=source('peak',{weight:.75,beat:4,washDimming:40,frame:{...frame,r:0,b:255,dimming:80}});
    const result=automaticStage([a,b],count,undefined,mode);
    assert.ok(hues(result).size<=count);
    const left=automaticStage([a],count,undefined,mode).frames.flat();
    const right=automaticStage([b],count,undefined,mode).frames.flat();
    result.frames.flat().forEach((f,i)=>assert.equal(f.dimming,left[i].dimming*.25+right[i].dimming*.75));
  }
});
test('ordinary playback does not gate fixtures on accents',()=>{
  const render=strength=>automaticStage([source('peak',{accentStrength:strength})],4).frames.flat();
  const resting=render(0),partial=render(.5),hit=render(1);
  assert.ok(resting.every(f=>f.dimming===60));
  assert.ok(hit.every(f=>f.dimming===60));
  assert.deepEqual(partial,resting); // An accent alone does not toggle fixture activity.
  for(const maximum of [0,30,100]){
    const frames=automaticStage([source('peak',{accentStrength:1,frame:{...frame,dimming:maximum}})],4).frames.flat();
    assert.ok(frames.every(f=>f.dimming===maximum));
  }
  const dark=source('peak',{accentStrength:1,frame:{...frame,dimming:0}});
  const without=automaticStage([source(),{...dark,accentStrength:0}],4);
  assert.deepEqual(automaticStage([source(),dark],4),without);
  for(const mode of ['chase','wash','follow','alternate']){
    assert.deepEqual(automaticStage([source('peak',{accentStrength:1})],4,undefined,mode),automaticStage([source('peak',{accentStrength:0})],4,undefined,mode));
  }
});
test('musical color decisions change fixture groupings while retaining the palette',()=>{
 const movingPlan={colorDirection:{events:[{time:0,reason:'entrance'},{time:8,reason:'sound-change'},{time:9,reason:'musical-accent'},{time:11,reason:'return'},{time:16,reason:'section-contrast'},{time:24,reason:'sound-change'}]}};
 const equipment={devices:Array.from({length:4},(_,i)=>({id:String(i),type:'spot',cells:1}))};
 const render=(time,count=2)=>automaticStage([source('peak',{movingPlan,songTime:time,beat:time*2})],count,equipment);
 const slots=t=>{const r=render(t);return r.frames.flat().map(f=>r.palette.findIndex(c=>c[0]===f.r&&c[1]===f.g&&c[2]===f.b));};
 assert.deepEqual(slots(1),[0,1,0,1]);
 assert.deepEqual(slots(8),[0,0,1,1]);
 assert.deepEqual(slots(16),[0,1,1,0]);
 assert.deepEqual(slots(24),[1,0,1,0]);
 assert.deepEqual(slots(4),slots(1)); // No beat-counter rotation.
 assert.deepEqual(slots(9),slots(8));assert.deepEqual(slots(11),slots(8));
 assert.deepEqual(slots(1),[0,1,0,1]); // Seek restores the same assignment.
 for(const count of [1,2,3,4])for(const t of [1,8,16,24]){
  const r=render(t,count);
  assert.deepEqual(r.palette,render(1,count).palette);
  assert.ok(hues(r).size<=count);
  assert.ok(r.frames.flat().every(f=>f.dimming===60));
 }
 const withBar={devices:[{id:'bar',type:'bar',cells:8},...equipment.devices]};
 assert.deepEqual(automaticStage([source('peak',{movingPlan,songTime:16})],2,withBar).frames.slice(1),render(16).frames);
});


test('two-color base formations never leave a permanent solo fixture across long songs',()=>{
 const movingPlan={colorDirection:{events:Array.from({length:32},(_,i)=>({time:i*20,reason:'sound-change'}))}};
 const equipment={devices:Array.from({length:4},(_,i)=>({id:String(i),type:'spot',cells:1}))};
 const render=time=>automaticStage([source('peak',{movingPlan,songTime:time})],2,equipment);
 const partners=new Set();
 for(let i=0;i<32;i++){
  const result=render(i*20+1),cells=result.frames.flat();
  const slots=cells.map(f=>result.palette.findIndex(c=>c[0]===f.r&&c[1]===f.g&&c[2]===f.b));
  assert.equal(slots.filter(v=>v===0).length,2);
  assert.equal(slots.filter(v=>v===1).length,2);
  partners.add(slots.findIndex((v,j)=>j!==2&&v===slots[2]));
  assert.deepEqual(render(i*20+19).frames,result.frames,'stable between musical decisions');
 }
 assert.deepEqual([...partners].sort(),[0,1,3],'the third fixture must share with every other position');
 const before=render(21);render(621);assert.deepEqual(render(21),before);
});
