import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectralAnalysis, spectralFlux } from '../public/spectral-analysis.js';
import { compileShow } from '../public/show-plan.js';
import { settings } from '../lib/music.mjs';
const rate=16000;
const tone=frequency=>Float32Array.from({length:4096},(_,i)=>0.2*Math.sin(2*Math.PI*frequency*i/rate));
test('Spektralanalyse unterscheidet gleich laute Tonhöhen und erhält die Tonklasse über Oktaven', () => {
  const spectrum=new SpectralAnalysis(rate),low=spectrum.at([tone(220)],2048),high=spectrum.at([tone(880)],2048);
  assert.ok(high.tone>low.tone+0.25);assert.ok(Math.abs(high.pitchClass-low.pitchClass)<0.01);
  assert.ok(low.tonality>0.8);assert.ok(high.tonality>0.8);
});
test('Spektralanalyse ignoriert Stille und verliert gegenphasiges Stereo nicht', () => {
  const spectrum=new SpectralAnalysis(rate),a=tone(440),b=a.map(v=>-v);
  assert.equal(spectrum.at([new Float32Array(4096)],2048).tonality,0);
  assert.deepEqual(spectrum.at([a,b],2048),spectrum.at([a],2048));
});
test('Vorab-Show stellt Tonwechsel ohne Lautstärkeänderung als geglätteten Farbverlauf dar', () => {
  const spectrum=new SpectralAnalysis(rate),a=spectrum.at([tone(110)],2048),b=spectrum.at([tone(1760)],2048);
  const windows=Array.from({length:400},(_,i)=>({rms:0.2,bass:0.01,beatSeq:0,...(i<200?a:b)}));
  const p=compileShow(windows,8,settings({toneFollow:1,smoothing:1,palette:'rainbow'}));
  assert.notDeepEqual([p.frames[16].r,p.frames[16].g,p.frames[16].b],[p.frames[60].r,p.frames[60].g,p.frames[60].b]);
  const jump=Math.max(...['r','g','b'].map(k=>Math.abs(p.frames[32][k]-p.frames[31][k])));
  assert.ok(jump<100);
});

test('Tonverlaufsband erkennt steigende Töne auch über einem lauteren Bass', () => {
  const spectrum=new SpectralAnalysis(rate);
  const mixed=f=>Float32Array.from({length:4096},(_,i)=>0.5*Math.sin(2*Math.PI*80*i/rate)+0.1*Math.sin(2*Math.PI*f*i/rate));
  const low=spectrum.at([mixed(330)],2048),high=spectrum.at([mixed(990)],2048);
  assert.ok(low.melodyConfidence>0.5);assert.ok(high.melodyTone>low.melodyTone+0.4);
});

test('Fünf Frequenzbereiche trennen Bass, Mitten und Höhen und bilden normierte Anteile', () => {
  const s=new SpectralAnalysis(rate);
  for(const [frequency,band] of [[80,0],[330,1],[1000,2],[2500,3],[4500,4]]) {
    const f=s.at([tone(frequency)],2048);
    assert.ok(f.bands[band]>0.9);assert.ok(Math.abs(f.bands.reduce((a,b)=>a+b,0)-1)<1e-10);
  }
});
test('Breitbandiges Rauschen wird von harmonischem Dauerton unterschieden', () => {
  const s=new SpectralAnalysis(rate);let seed=123;
  const noise=Float32Array.from({length:4096},()=>{seed=(1664525*seed+1013904223)>>>0;return (seed/2**32-.5)*.4;});
  const a=s.at([tone(440)],2048),b=s.at([noise],2048);
  assert.ok(b.flatness>a.flatness+0.2);assert.ok(b.rolloff>a.rolloff);
});
test('Harmonische Profile unterscheiden unterschiedliche Mehrklänge', () => {
  const s=new SpectralAnalysis(rate);
  const chord=frequencies=>Float32Array.from({length:4096},(_,i)=>frequencies.reduce((sum,f)=>sum+Math.sin(2*Math.PI*f*i/rate)*.07,0));
  const a=s.at([chord([261.63,329.63,392])],2048),b=s.at([chord([261.63,311.13,392])],2048);
  assert.ok(a.chroma.reduce((sum,v,i)=>sum+Math.abs(v-b.chroma[i]),0)>0.2);
});


test('Klangänderung ist bei gleichem Spektrum null und reagiert auf veränderte Frequenzanteile', () => {
  const s=new SpectralAnalysis(rate),a=s.at([tone(330)],2048),b=s.at([tone(3300)],2048);
  assert.equal(spectralFlux(a,a),0);assert.equal(spectralFlux(undefined,a),0);assert.ok(spectralFlux(a,b)>0.5);
});
