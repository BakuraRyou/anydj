import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveAnalysis } from '../public/live-analysis.js';
import { AudioAnalysis } from '../public/audio-analysis.js';
import { levels, settings, lightFrame } from '../lib/music.mjs';
function analyze(hz, rate=16000) {
  const rich=[],plain=[],a=new LiveAnalysis(rate,l=>rich.push(l)),b=new AudioAnalysis(rate,l=>plain.push(l));
  const mono=Float32Array.from({length:rate},(_,i)=>.25*Math.sin(2*Math.PI*hz*i/rate));
  const channels=[mono,Float32Array.from(mono,v=>-v)];
  for(let i=0;i<mono.length;i++){a.pushFrame(channels,i);b.pushFrame(channels,i);}
  assert.deepEqual(rich.map(l=>[l.beatSeq,l.rms,l.bass]),plain.map(l=>[l.beatSeq,l.rms,l.bass]));
  return rich.at(-1);
}
test('Live-Spektrum trennt Mitten und Höhen bei 16 und 48 kHz ohne Stereoauslöschung oder Beatänderung',()=>{
  for(const rate of [16000,48000]) {
    const mid=analyze(800,rate),high=analyze(4500,rate);
    assert.ok(mid.bands[2]>.9);assert.ok(high.bands[4]>.9);
    assert.ok(high.tone>mid.tone); assert.equal(levels(mid).bands.length,5);
  }
});
test('Live-Disco reagiert bei gleichem Beat auf Tonverläufe mit anderen Farben, identischer Helligkeit',()=>{
  const low={...analyze(220),beatSeq:1},high={...analyze(1500),beatSeq:1};
  const config=settings({mode:'disco',palette:'rainbow'});
  const a=lightFrame(levels(low),config,0,1),b=lightFrame(levels(high),config,0,1);
  assert.equal(a.params.dimming,b.params.dimming);
  assert.ok(['r','g','b'].some(k=>Math.abs(a.params[k]-b.params[k])>80));
});
test('API verwirft ungültige Klangmerkmale und lässt fehlendes Spektrum weiterhin zu',()=>{
  for(const value of [{bands:[1]}, {bands:[0,0,0,0,NaN]}, {tone:2}, {chroma:Array(12).fill(-1)}]) assert.throws(()=>levels({rms:.1,bass:.1,...value}));
  assert.deepEqual(levels({rms:0,bass:0}),{rms:0,bass:0});
});
