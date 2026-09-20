import test from 'node:test';
import assert from 'node:assert/strict';
import { compileShow, showFrameAt } from '../public/show-plan.js';
import { settings, MusicSession } from '../lib/music.mjs';
const options = settings();
const windows = Array.from({length:600},(_,i)=>({rms:i<200?0.005:i<400?0.06:0.2,bass:0.01,beatSeq:Math.floor(i/25)}));
test('Vorab-Show nutzt den ganzen Verlauf, bleibt deterministisch und hält Helligkeitsgrenzen ein', () => {
  const a=compileShow(windows,12,options),b=compileShow(windows,12,options);
  assert.deepEqual(a,b); assert.equal(a.frames.length,96);
  assert.ok(a.sections.some(s=>s.kind==='Ruhig')); assert.ok(a.sections.some(s=>s.kind==='Intensiv'));
  assert.ok(new Set(a.frames.map(f=>f.dimming)).size>2);
  assert.ok(a.frames.every(f=>f.dimming>=options.minimum&&f.dimming<=options.maximum));
});
test('Zeitposition wählt beim Springen sofort das richtige vorberechnete Bild', () => {
  const p=compileShow(windows,12,options);
  assert.deepEqual(showFrameAt(p,8),p.frames[64]); assert.deepEqual(showFrameAt(p,0),p.frames[0]);
  assert.deepEqual(showFrameAt(p,999),p.frames.at(-1)); assert.throws(()=>showFrameAt(p,NaN));
});
test('Stille erzeugt ruhiges Licht statt erfundener Beats', () => {
  const p=compileShow(Array.from({length:100},()=>({rms:0,bass:0,beatSeq:0})),2,options);
  assert.equal(p.beats,0); assert.ok(p.frames.every(f=>f.dimming===options.minimum));
});
test('Show-Sitzung validiert Lichtbilder, berücksichtigt Weißlampen und stellt Ausgangszustand wieder her', async () => {
  const calls=[], original={state:false,dimming:40,temp:2700};
  const music=new MusicSession({inspect:async()=>({pilot:original,capabilities:{brightness:true,color:false}}),exchange:async(ip,m,p)=>calls.push(p)},{tickMs:100000});
  const {id}=await music.start('192.168.1.2','show',options);
  assert.throws(()=>music.frame(id,{params:{state:true,sceneId:1}}));
  music.frame(id,{params:compileShow(windows,12,options).frames[0]});music.tick(music.session);await music.session.inFlight;
  assert.equal(calls[0].r,undefined);assert.equal(calls[0].state,true);
  await music.stop(id);assert.deepEqual(calls.at(-1),original);
});

test('Ausbleibende Show-Bilder beenden den Ablauf und stellen das Licht wieder her', async () => {
  const original={state:false,dimming:30,temp:2700}, calls=[];
  const music=new MusicSession({inspect:async()=>({pilot:original}),exchange:async(ip,m,p)=>calls.push(p)},{tickMs:100000});
  const {id}=await music.start('192.168.1.2','show',options);
  music.frame(id,{params:compileShow(windows,12,options).frames[0]});
  const session=music.session;session.lastFrame=Date.now()-2000;music.tick(session);await session.stopPromise;
  assert.equal(music.session,null);assert.deepEqual(calls.at(-1),original);
});

test('Wiederkehrende Klangabschnitte erhalten dieselbe Farbfamilie statt fortlaufendem Farbkreis', () => {
  const samples=Array.from({length:800},(_,i)=>({rms:i>=300&&i<500?0.25:0.08,bass:i>=300&&i<500?0.16:0.03,tone:i>=300&&i<500?0.7:0.3,beatSeq:Math.floor(i/25)}));
  const p=compileShow(samples,16,options);
  assert.equal(p.sections[0].motif,p.sections.at(-1).motif);
  assert.notEqual(p.sections[0].motif,p.sections.find(s=>s.kind==='Intensiv').motif);
  const a=showFrameAt(p,2),b=showFrameAt(p,15);
  assert.ok(['r','g','b'].every(k=>Math.abs(a[k]-b[k])<12));
});
test('Unveränderter Klang bleibt farblich zusammenhängend, ohne zeitgesteuerte Wanderung', () => {
  const samples=Array.from({length:1500},(_,i)=>({rms:0.1,bass:0.04,tone:0.3,tonality:0.8,pitchClass:0.4,beatSeq:Math.floor(i/25)}));
  const p=compileShow(samples,30,settings({toneFollow:1}));
  const a=showFrameAt(p,3),b=showFrameAt(p,28);
  assert.deepEqual([a.r,a.g,a.b],[b.r,b.g,b.b]);
});

test('Gleiche Beats erzeugen trotz anderer Lautstärke und Tonhöhe identische Helligkeit', () => {
  const sequence=Array.from({length:400},(_,i)=>({beatSeq:Math.floor(i/25),rms:0.05,bass:0.01,tone:0.2}));
  const a=compileShow(sequence,8,options);
  const b=compileShow(sequence.map(l=>({...l,rms:0.4,bass:0.2,tone:0.8})),8,options);
  assert.deepEqual(a.frames.map(f=>f.dimming),b.frames.map(f=>f.dimming));
});
test('Lauter Ton ohne Beats hebt die Mindesthelligkeit nicht an', () => {
  const p=compileShow(Array.from({length:200},()=>({rms:0.5,bass:0.3,tone:0.6,beatSeq:0})),4,options);
  assert.ok(p.frames.every(f=>f.dimming===options.minimum));
});
test('Farbglättung verändert keine Beat-Helligkeit', () => {
  const a=compileShow(windows,12,{...options,smoothing:0});const b=compileShow(windows,12,{...options,smoothing:1});
  assert.deepEqual(a.frames.map(f=>f.dimming),b.frames.map(f=>f.dimming));
});
test('Kurze Pegelschwankungen zerhacken eine anhaltende Passage nicht', () => {
  const samples=Array.from({length:2000},(_,i)=>({rms:Math.floor(i/100)%2?0.30:0.32,bass:0.2,tone:0.4,beatSeq:Math.floor(i/25)}));
  const p=compileShow(samples,40,options);assert.ok(p.sections.length<5);
});

test('Frequenzverteilung und Klangtextur verändern Farben, aber niemals Beat-Helligkeit', () => {
  const base=Array.from({length:300},(_,i)=>({rms:.2,bass:.1,tone:.4,beatSeq:Math.floor(i/25)}));
  const a=compileShow(base.map(l=>({...l,bands:[.8,.1,.05,.04,.01],flatness:0,rolloff:.2,harmonicHue:.1,harmonicConfidence:.7})),6,options);
  const b=compileShow(base.map(l=>({...l,bands:[.02,.03,.05,.4,.5],flatness:.6,rolloff:.9,harmonicHue:.6,harmonicConfidence:.1})),6,options);
  assert.deepEqual(a.frames.map(f=>f.dimming),b.frames.map(f=>f.dimming));
  assert.notDeepEqual(a.frames.map(f=>[f.r,f.g,f.b]),b.frames.map(f=>[f.r,f.g,f.b]));
});

test('Klangverlauf nutzt beide Palettenenden und erhält kräftige Farben bei 100 Prozent Sättigung', () => {
  const samples=Array.from({length:1200},(_,i)=>({rms:.2,bass:.1,beatSeq:Math.floor(i/25),tone:.3+.2*i/1200,bands:[.6,.15,.15,.05,.05],rolloff:.4}));
  const p=compileShow(samples,24,settings({palette:'custom',colorA:'#ff0000',colorB:'#0000ff'}));
  const first=showFrameAt(p,1),last=showFrameAt(p,23);
  assert.ok(first.r>230 && first.b<45,JSON.stringify(first));
  assert.ok(last.b>230 && last.r<45,JSON.stringify(last));
  assert.ok(p.frames.every(f=>f.g<30),'Sättigung darf nicht durch einen großen Weißanteil verloren gehen');
  const desaturated=compileShow(samples,24,settings({saturation:20}));
  assert.ok(desaturated.frames.every(f=>Math.min(f.r,f.g,f.b)>=200));
  assert.deepEqual(p.frames.map(f=>f.dimming),desaturated.frames.map(f=>f.dimming));
});

test('Vorbereitete Bilder werden ohne zusätzlichen Timer weitergeleitet, aber nicht unbegrenzt gesendet',async()=>{
  const calls=[];
  const music=new MusicSession({inspect:async()=>({pilot:{state:false},capabilities:{color:true}}),exchange:async(ip,m,p)=>calls.push(p)},{tickMs:100000});
  const {id}=await music.start('192.168.1.2','show',options);
  music.frame(id,{params:{state:true,r:255,g:1,b:1,dimming:70}});
  await music.session.inFlight;
  assert.equal(calls.length,1);
  music.frame(id,{params:{state:true,r:1,g:1,b:255,dimming:30}});
  assert.equal(calls.length,1);
  music.session.lastDispatch-=101;music.tick(music.session);await music.session.inFlight;
  assert.equal(calls.length,2);assert.equal(calls[1].dimming,30);
  await music.stop(id);
});
