import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioAnalysis, BeatTracker } from '../public/audio-analysis.js';
import { lightFrame, settings, levels } from '../lib/music.mjs';
function signal(frequency, amplitude = 0.2, rate = 48000, duration = 1, stereo = false) {
  const output = [], analysis = new AudioAnalysis(rate, l => output.push(l));
  const channels = [new Float32Array(1)]; if (stereo) channels.push(new Float32Array(1));
  for (let i = 0; i < duration * rate; i++) {
    channels[0][0] = Math.sin(2 * Math.PI * frequency * i / rate) * (typeof amplitude === 'function' ? amplitude(i / rate) : amplitude);
    if (stereo) channels[1][0] = -channels[0][0];
    analysis.pushFrame(channels, 0);
  }
  return output;
}
test('Kontinuierliche Analyse liefert 50 Fenster pro Sekunde; Bass trennt 80 Hz von 2 kHz', () => {
  for (const rate of [16000, 44100, 48000]) {
    const bass = signal(80, 0.2, rate), treble = signal(2000, 0.2, rate);
    assert.equal(bass.length, 50);
    assert.ok(bass.at(-1).bass > treble.at(-1).bass * 50);
    assert.ok(Math.abs(bass.at(-1).rms - treble.at(-1).rms) < 0.02);
  }
});
test('Gegenphasiges Stereo löscht den Pegel nicht aus', () => {
  const mono = signal(80).at(-1), stereo = signal(80, 0.2, 48000, 1, true).at(-1);
  assert.ok(Math.abs(mono.rms - stereo.rms) < 1e-6);
  assert.ok(Math.abs(mono.bass - stereo.bass) < 1e-6);
});
test('Stille und sehr leises Rauschen werden nicht künstlich hochgezogen', () => {
  for (const amplitude of [0, 0.0001]) {
    const output = signal(80, amplitude);
    assert.ok(output.every(l => l.energy === 0 && l.bassEnergy === 0 && l.beatSeq === 0));
  }
});
test('Kurze Bassimpulse bleiben bis zum nächsten Lichtpaket erkennbar und Dauertöne triggern nicht ständig', () => {
  const output = signal(80, t => t % 0.5 < 0.04 ? 0.2 : 0, 48000, 2);
  assert.equal(output.at(-1).beatSeq, 4);
  const sampled = output.filter((_, i) => i % 6 === 5);
  assert.ok(sampled.at(-1).beatSeq >= 4);
  assert.ok(signal(80, 0.2, 48000, 2).at(-1).beatSeq <= 2);
  let state = 0, count = 0;
  sampled.forEach((l, i) => { const frame = lightFrame(l, settings({ mode: 'disco', speed: 4 }), state, i * 0.12); state = frame.animation; count += Number(frame.beat); });
  assert.equal(count, 4);
});
test('Leise und laute Passagen verändern adaptive Pegel deutlich und lassen sie bei Stille abfallen', () => {
  const output = signal(80, t => t < 0.4 ? 0.2 : t < 0.8 ? 0.02 : 0);
  assert.ok(output[15].energy > output[35].energy * 5);
  assert.ok(output[15].bassEnergy > output[35].bassEnergy * 5);
  assert.equal(output.at(-1).energy, 0);
});
test('Erweiterte Audiofelder bleiben validiert und alte Clients kompatibel', () => {
  assert.deepEqual(levels({ rms: 0, bass: 0 }), { rms: 0, bass: 0 });
  for (const value of [{ energy: 2 }, { bassEnergy: NaN }, { beatSeq: -1 }, { beatSeq: 1.2 }]) assert.throws(() => levels({ rms: 0, bass: 0, ...value }));
});

test('Tempoerkennung folgt 90, 120 und 150 BPM und behält jeden Beat im Disco-Modus', () => {
  for (const bpm of [90, 120, 150]) {
    const period = 60 / bpm;
    const output = signal(80, t => t % period < 0.05 ? 0.2 : 0, 16000, 8);
    assert.ok(Math.abs(output.at(-1).bpm - bpm) <= 3);
    assert.ok(output.at(-1).confidence >= 0.65);
    let state = 0, count = 0;
    output.filter((_, i) => i % 6 === 5).forEach((l, i) => {
      const f = lightFrame(l, settings({ mode: 'disco' }), state, i * 0.12); state = f.animation; count += Number(f.beat);
    });
    assert.ok(Math.abs(count - 8 / period) <= 1, `${bpm} BPM: ${count} Lichtbeats`);
  }
});
test('Disco hat einen klaren Beat-Akzent und fällt trotz anhaltend lauter Musik ab', () => {
  const o = settings({ mode: 'disco', smoothing: 1 });
  const beat = lightFrame({ rms: 0.5, bass: 0.3, energy: 1, beatSeq: 1 }, o, 0, 0);
  assert.equal(beat.params.dimming, o.maximum);
  const between = lightFrame({ rms: 0.5, bass: 0.3, energy: 1, beatSeq: 1 }, o, beat.animation, 0.375);
  assert.ok(between.params.dimming < o.minimum + 5);
  assert.equal(between.animation.position, beat.animation.position);
});


test('Stabiler Beat filtert zusätzliche Offbeats und verliert den Takt bei Stille', () => {
  const tracker = new BeatTracker();
  for (let i = 0; i <= 5; i++) tracker.update(i * 0.5, true, true);
  const before = tracker.sequence;
  tracker.update(2.75, true, true);
  assert.equal(tracker.sequence, before);
  const onBeat = tracker.update(3, true, true);
  assert.equal(onBeat.beatSeq, before + 1); assert.equal(onBeat.bpm, 120);
  const quiet = tracker.update(4.5, false, false);
  assert.equal(quiet.confidence, 0); assert.equal(quiet.bpm, 0);
});

test('Kick-Beat bleibt bei zusätzlichen Hi-Hats zwischen den Schlägen auf 120 BPM', () => {
  const output = [], rate = 16000, channels = [new Float32Array(1)];
  const analysis = new AudioAnalysis(rate, l => output.push(l));
  for (let i = 0; i < rate * 8; i++) {
    const t = i / rate, kick = t % 0.5, hat = (t + 0.25) % 0.5;
    channels[0][0] = (kick < 0.1 ? 0.5 * Math.exp(-kick * 25) * Math.sin(2 * Math.PI * 80 * t) : 0) + (hat < 0.03 ? 0.2 * Math.sin(2 * Math.PI * 3500 * t) : 0);
    analysis.pushFrame(channels, 0);
  }
  assert.ok(Math.abs(output.at(-1).bpm - 120) <= 3);
  assert.ok(output.at(-1).confidence >= 0.65);
  assert.ok(output.at(-1).beatSeq >= 15 && output.at(-1).beatSeq <= 17);
});
