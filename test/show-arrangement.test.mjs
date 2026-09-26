import test from 'node:test';
import assert from 'node:assert/strict';
import {compileShow,showFrameAt} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
const duration=40;
const windows=Array.from({length:2000},(_,i)=>({rms:i<400?.02:i<1000?.07:i<1600?.2:.02,bass:.01,tone:.4,beatSeq:Math.floor(i/25)}));
const beats=Array.from({length:80},(_,i)=>i*.5);
const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
const structure={version:1,source:'all-in-one',duration,segments:[{start:0,end:8,label:'intro'},{start:8,end:20,label:'verse'},{start:20,end:32,label:'chorus'},{start:32,end:40,label:'outro'}]};
const make=()=>compileShow(windows,duration,settings({arrangement:'auto',minimum:10,maximum:70}),grid,structure);
test('Songabschnitte erhalten gehaltenes Licht, fließende Strophen und intensivere Refrains',()=>{
  const plan=make();
  assert.deepEqual(plan.sections.map(s=>s.look),['held','flow','peak','held']);
  assert.ok(showFrameAt(plan,28).dimming>showFrameAt(plan,16).dimming);
  assert.ok(showFrameAt(plan,16).dimming>showFrameAt(plan,6).dimming);
  assert.ok(plan.arrangement.times.every(t=>t>=8&&t<32));
  assert.ok(plan.frames.every(f=>f.dimming>=10&&f.dimming<=70));
  // Sustained light survives between beats instead of returning to black.
  assert.ok(plan.frames.slice(40,240).every(f=>f.dimming>15));
});
test('Konstante Musik erzeugt keinen Dauerblinker und keine Farbwechsel auf jedem Schlag',()=>{
  const steady=windows.map(w=>({...w,rms:.1,tone:.4}));
  const auto=compileShow(steady,duration,settings({arrangement:'auto'}),grid);
  const manual=compileShow(steady,duration,settings(),grid);
  const jumps=plan=>plan.frames.slice(1).filter((f,i)=>Math.abs(f.dimming-plan.frames[i].dimming)>20).length;
  assert.equal(jumps(auto),0);assert.ok(jumps(manual)>20);
  assert.ok(auto.arrangement.times.length<=Math.ceil(duration/3.5));
  const a=showFrameAt(auto,10),b=showFrameAt(auto,10.5);
  assert.deepEqual([a.r,a.g,a.b],[b.r,b.g,b.b]);
});
test('Stille bleibt auf Mindesthelligkeit, auch wenn ein Modell Beats behauptet',()=>{
  const plan=compileShow(windows.map(w=>({...w,rms:0,bass:0})),duration,settings({arrangement:'auto'}),grid,structure);
  assert.equal(plan.arrangement.times.length,0);
  assert.ok(plan.frames.every(f=>f.dimming===5));
  assert.equal(showFrameAt(plan,20.123).dimming,5);
});
test('Neue automatische Gestaltung ist deterministisch, seekbar und ohne KI-Struktur verfügbar',()=>{
  assert.deepEqual(make(),make());
  const plan=make(),before=showFrameAt(plan,16.123);showFrameAt(plan,38);assert.deepEqual(showFrameAt(plan,16.123),before);
  const fallback=compileShow(windows,duration,settings({arrangement:'auto'}),grid);
  assert.ok(fallback.arrangement);assert.ok(fallback.sections.every(s=>s.lookLabel));
});

test('Kräftige rhythmische Passagen bewegen Helligkeit und Farbe deutlich, leise Töne bleiben ruhig',()=>{
  const percussion=windows.map((w,i)=>({...w,rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:.02,tone:.4}));
  const plan=compileShow(percussion,duration,settings({arrangement:'auto'}),grid);
  assert.ok(plan.arrangement.times.length>30);
  assert.ok(showFrameAt(plan,10).dimming-showFrameAt(plan,10.4).dimming>15);
  const a=showFrameAt(plan,10),b=showFrameAt(plan,10.375);
  assert.ok(Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b)<25);
  assert.ok(showFrameAt(plan,10.4).dimming>plan.effectiveOptions.minimum+10);
  const pad=compileShow(percussion.map(w=>({...w,rms:.02,bass:0,flux:0})),duration,settings({arrangement:'auto'}),grid);
  assert.equal(pad.arrangement.times.length,0);
});
test('Laute Intros bleiben beweglich; unsichere Struktur ist kein erzwungener Ambient-Modus',()=>{
  const loud=windows.map((w,i)=>({...w,rms:i%25<3?.25:.2,bass:i%25<3?.12:.02,flux:i%25<3?.5:0}));
  const plan=compileShow(loud,duration,settings({arrangement:'auto'}),grid,structure);
  assert.equal(plan.sections[0].look,'flow');
  assert.ok(plan.arrangement.times.some(t=>t<8));
});

test('Gleicher Rhythmus bleibt in Strophe und Refrain aktiv, der Refrain hat mehr Kontrast',()=>{
  const percussion=windows.map((w,i)=>({...w,rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:.02}));
  const plan=compileShow(percussion,duration,settings({arrangement:'auto'}),grid,structure);
  const verse=plan.arrangement.times.filter(t=>t>=8&&t<20).length;
  const chorus=plan.arrangement.times.filter(t=>t>=20&&t<32).length;
  assert.ok(verse>=20);assert.ok(chorus>=verse);
  const mean=(start,end)=>plan.arrangement.accents.filter((_,i)=>plan.arrangement.times[i]>=start&&plan.arrangement.times[i]<end).reduce((a,b)=>a+b,0)/plan.arrangement.times.filter(t=>t>=start&&t<end).length;
  assert.ok(mean(20,32)>mean(8,20)*1.3);
  assert.ok(plan.arrangement.accents.every(a=>a<=.7));
});

test('Ein schwächerer Schlag im durchgehenden Groove lässt die Bewegung nicht aussetzen',()=>{
  const percussion=windows.map((w,i)=>{
    const weak=Math.floor(i/25)%4===2;
    return {...w,rms:i%25<3?(weak?.13:.3):.12,bass:i%25<3?(weak?.025:.15):.02,flux:0};
  });
  const plan=compileShow(percussion,duration,settings({arrangement:'auto'}),grid,structure);
  for(const time of [9,11,13,15,17])assert.ok(plan.arrangement.times.includes(time),`Groove fehlt bei ${time}`);
  assert.ok(showFrameAt(plan,13).dimming-showFrameAt(plan,13.4).dimming>=10);
});

test('Kräftige Schläge treiben Helligkeit, ohne bei hoher Farbkontur ständig die Farbe zu wechseln',()=>{
  const percussion=windows.map((w,i)=>({...w,rms:i%25<3?.3:.12,bass:i%25<3?.15:.02,flux:i%25<3?.7:0,tone:.95}));
  const plan=compileShow(percussion,duration,settings({arrangement:'auto'}),grid,structure);
  let moving=0;
  for(let t=22;t<30;t+=.5){const a=showFrameAt(plan,t+.125),b=showFrameAt(plan,t+.375);if(['r','g','b'].reduce((sum,key)=>sum+Math.abs(a[key]-b[key]),0)>40)moving++;}
  // The new phrase design may finish its entrance accent with a soft return;
  // it must not turn every drum hit into a hue change.
  assert.ok(moving<=2);
  assert.ok(plan.colorDirection.events.filter(e=>e.time>=22&&e.time<30).length<=1);
  assert.ok(showFrameAt(plan,26).dimming-showFrameAt(plan,26.375).dimming>15);
});

test('Ein leiser Anfang verdeckt keinen anhaltenden Aufbau; Flächen und einzelne Endschläge bleiben ruhig',async()=>{
  const {arrangeShow}=await import('../public/show-arrangement.js');
  const local=Array.from({length:2000},()=>({rms:.1,bass:0,flux:0,tone:.4}));
  const sections=[{start:0,end:20,label:'verse'},{start:20,end:40,label:'chorus'}];
  const make=kind=>{
    const other=Array.from({length:400},(_,i)=>i>=200?.25:kind==='rise'?.04+.1*Math.max(0,(i-100)/100):
      kind==='hit'&&i>=196?.25:kind==='oscillating'?(Math.floor(i/10)%2?.13:.04):.04);
    const instruments={step:.1,other,drums:Array(400).fill(0),bass:Array(400).fill(0),vocals:Array(400).fill(0)};
    return arrangeShow(local,40,sections,[],[],null,instruments);
  };
  const rise=make('rise');
  assert.ok(rise.passages[0].intensity<.25,'the section average alone still resembles a rest');
  assert.equal(rise.passages[0].look,'lift');
  assert.ok(rise.bases[18/.125]>rise.bases[2/.125]*1.5,'the measured build must reach the brightness output');
  assert.equal(rise.times.length,0,'a sustained rise must not invent rhythmic attacks');
  for(const kind of ['steady','hit','oscillating'])assert.equal(make(kind).passages[0].look,'held',kind);
});


test('automatic analysis retains measured offbeat bass attacks for moving-head switching',()=>{
 const input=windows.map((w,i)=>({...w,rms:.2,bass:i%25>=7&&i%25<10?.15:.02}));
 const plan=compileShow(input,duration,settings({arrangement:'auto'}),grid);
 assert.ok(plan.arrangement.bassAttacks.length>=70);
 assert.ok(plan.arrangement.bassAttacks.every(e=>Math.abs((e.time-.14)/.5-Math.round((e.time-.14)/.5))<1e-6));
 const steady=compileShow(input.map(w=>({...w,bass:.1})),duration,settings({arrangement:'auto'}),grid);
 assert.deepEqual(steady.arrangement.bassAttacks,[]);
});
