import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectralAnalysis } from '../public/spectral-analysis.js';
import { pitchCandidates, trackMelody, musicalScore } from '../public/melody-analysis.js';
import { compileShow } from '../public/show-plan.js';
import { settings } from '../lib/music.mjs';

test('Harmonischer Ton wird trotz stärkerer zweiter Harmonischer kontinuierlich verfolgt',()=>{
  const rate=16000,spectrum=new SpectralAnalysis(rate,4096),features=[];
  for(const midi of [60,60,62,62,64,64,65,65,64,64,62,62]) {
    const hz=440*2**((midi-69)/12);
    const pcm=Float32Array.from({length:4096},(_,i)=>.15*Math.sin(2*Math.PI*hz*i/rate)+.20*Math.sin(4*Math.PI*hz*i/rate)+.08*Math.sin(6*Math.PI*hz*i/rate));
    const f=spectrum.at([pcm],2048);features.push({...f,pitches:pitchCandidates(spectrum.power,rate,4096)});
  }
  const track=trackMelody(features);
  assert.deepEqual(track.map(p=>p.midi),[60,60,62,62,64,64,65,65,64,64,62,62]);
  assert.ok(track.some(p=>p.confidence>.18));
});
const windowsFor = pitches => pitches.flatMap(midi=>Array.from({length:25},()=>({rms:midi===null?0:.2,bass:.05,leadMidi:midi??60,leadConfidence:midi===null?0:.9,tone:.4}))).map((w,i)=>({...w,beatSeq:Math.floor(i/25)}));
test('Steigen, Halten, Fallen und Pause sind unabhängig vom Beat in der Partitur sichtbar',()=>{
  const windows=windowsFor([60,62,64,67,67,67,64,62,null,null]);
  const p=compileShow(windows,5,settings({palette:'custom',colorA:'#ff0000',colorB:'#0000ff'}));
  const at=t=>p.score.track[Math.floor(t/.08)].position;
  assert.ok(at(.2)<at(1.2));assert.ok(at(1.2)<at(2.2));
  assert.equal(at(2),at(2.6));assert.ok(at(3.7)<at(2.6));assert.equal(at(4.8),at(3.8));
  const old=compileShow(windows.map(({leadMidi,leadConfidence,...w})=>w),5,settings());
  assert.deepEqual(p.frames.map(f=>f.dimming),old.frames.map(f=>f.dimming));
});
test('Wiederholte und transponierte Tonmotive verwenden dieselbe Farbkurve',()=>{
  const motif=[60,62,64,67,65,64,62,60];
  const w=windowsFor([...motif,...motif.map(n=>n+5)]);
  const score=musicalScore(w,8,Array.from({length:16},(_,i)=>i*.5));
  assert.equal(score.phrases[0].motif,score.phrases[1].motif);
  assert.ok(score.motifs.some(m=>m.occurrences===2));
  for(const t of [.5,1,2,3])assert.ok(Math.abs(score.track[Math.round(t/.08)].position-score.track[Math.round((t+4)/.08)].position)<.12);
});
test('Unklare Tonspur hält Farbe; Stille erfindet weder Noten noch Motive',()=>{
  const w=windowsFor([60,64,64,64]);
  for(let i=50;i<w.length;i++){w[i].leadConfidence=0;w[i].leadMidi=i%2?80:49;}
  const score=musicalScore(w,2,[]);
  assert.equal(new Set(score.track.filter(p=>p.time>1).map(p=>p.position)).size,1);
  const silence=musicalScore(w.map(l=>({...l,rms:0})),2,[]);
  assert.equal(silence.notes.length,0);assert.equal(silence.motifs.length,0);
});

test('Ein einzelner sicher scheinender Ton in unklarer Passage erzeugt keinen Farbsprung',()=>{
  const w=windowsFor([60,60,60,60]);
  for(let i=50;i<w.length;i++){w[i].leadConfidence=0;w[i].leadMidi=84;}
  for(let i=72;i<76;i++)w[i].leadConfidence=.9;
  const score=musicalScore(w,2,[]);
  assert.equal(new Set(score.track.filter(p=>p.time>=1).map(p=>p.position)).size,1);
});


test('Unsichere Melodie blockiert hörbare Klangwechsel nicht; Beat-Helligkeit bleibt gleich',()=>{
  const w=windowsFor(Array(24).fill(64));
  for(let i=0;i<w.length;i++) {
    w[i].leadConfidence=0;
    w[i].tone=i<300?.2:.8;
    w[i].bands=i<300?[.8,.1,.05,.04,.01]:[.01,.04,.05,.1,.8];
  }
  const options=settings({palette:'custom',colorA:'#ff0000',colorB:'#0000ff'});
  const plan=compileShow(w,12,options);
  const a=plan.frames[24],b=plan.frames[80];
  assert.ok(Math.abs(a.r-b.r)>100 || Math.abs(a.b-b.b)>100);
  assert.ok(plan.colorDrivers.every(d=>d==='spectrum'));
  assert.deepEqual(plan.frames.map(f=>f.dimming),compileShow(w.map(({leadMidi,leadConfidence,...l})=>l),12,options).frames.map(f=>f.dimming));
});
test('Sichere gehaltene Melodie führt, längere Lücken wechseln sanft zum Klangbild, Stille hält',()=>{
  const w=windowsFor(Array(24).fill(64));
  for(let i=300;i<450;i++)w[i].leadConfidence=0;
  for(let i=450;i<w.length;i++){w[i].rms=0;w[i].leadConfidence=0;w[i].tone=i%2;}
  const plan=compileShow(w,12,settings());
  assert.equal(plan.colorDrivers[32],'melody');
  assert.equal(plan.colorDrivers[49],'melody'); // bridge the first short gap
  assert.equal(plan.colorDrivers[68],'spectrum');
  assert.equal(plan.colorDrivers[85],'pause');
});
