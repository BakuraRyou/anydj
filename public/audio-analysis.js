// Shared continuous PCM analysis for browser worklet and Linux output capture.
const clamp = v => Math.max(0, Math.min(1, v));
function filter(rate, frequency, highpass) {
  const w = 2 * Math.PI * frequency / rate, c = Math.cos(w), a = Math.sin(w) / Math.SQRT2;
  const b = highpass ? (1 + c) / 2 : (1 - c) / 2;
  return { b0: b / (1 + a), b1: (highpass ? -2 : 2) * b / (1 + a), b2: b / (1 + a), a1: -2 * c / (1 + a), a2: (1 - a) / (1 + a), z1: 0, z2: 0 };
}
function apply(f, x) {
  const y = f.b0 * x + f.z1;
  f.z1 = f.b1 * x - f.a1 * y + f.z2; f.z2 = f.b2 * x - f.a2 * y;
  return y;
}
// Track recurring onset intervals and reject off-grid transients once locked.
export class BeatTracker {
  constructor() { this.events = []; this.period = 0; this.confidence = 0; this.last = -Infinity; this.sequence = 0; }
  update(time, onset, audible) {
    if (!audible && time - this.last > 1 || time - this.last > 3) {
      this.events = []; this.period = 0; this.confidence = 0;
    }
    if (onset && time - this.last >= 0.22) {
      let accepted = true;
      if (this.period && this.confidence >= 0.65) {
        const cycles = Math.max(1, Math.round((time - this.last) / this.period));
        accepted = Math.abs(time - this.last - cycles * this.period) < Math.max(0.06, this.period * 0.18);
        if (time - this.last > this.period * 2.5) { this.confidence = 0; this.period = 0; accepted = true; this.events = []; }
      }
      if (accepted) {
        const gap = time - this.last;
        if (this.period && gap < this.period * 2.5) this.period += (gap / Math.max(1, Math.round(gap / this.period)) - this.period) * 0.15;
        this.last = time; this.sequence++; this.events.push(time); this.events = this.events.slice(-9);
        const intervals = this.events.slice(1).map((t, i) => t - this.events[i]).filter(v => v >= 0.3 && v <= 1);
        if (intervals.length >= 3) {
          const sorted = [...intervals].sort((a, b) => a - b), candidate = sorted[Math.floor(sorted.length / 2)];
          const regular = intervals.filter(v => Math.abs(v - candidate) < candidate * 0.15).length / intervals.length;
          if (!this.period || this.confidence < 0.65) this.period = candidate;
          this.confidence = regular * Math.min(1, intervals.length / 4);
        }
      }
    }
    return { beatSeq: this.sequence, bpm: this.period ? Math.round(60 / this.period) : 0, confidence: this.confidence };
  }
}
export class AudioAnalysis {
  constructor(rate, emit) {
    this.rate = rate; this.emit = emit; this.window = Math.round(rate * 0.02);
    this.channels = []; this.count = this.sum = this.lowSum = this.time = this.beatSeq = 0;
    this.reference = this.bassReference = 0.02; this.average = this.bassAverage = 0;
    this.previous = this.previousBass = 0; this.tracker = new BeatTracker();
  }
  pushFrame(channels, index) {
    let sum = 0, bass = 0;
    for (let c = 0; c < channels.length; c++) {
      const filters = this.channels[c] ??= [filter(this.rate, 40, true), filter(this.rate, 180, false)];
      const sample = channels[c][index] || 0;
      const low = apply(filters[1], apply(filters[0], sample));
      sum += sample * sample; bass += low * low;
    }
    this.sum += sum / Math.max(1, channels.length); this.lowSum += bass / Math.max(1, channels.length);
    if (++this.count < this.window) return;
    const rms = clamp(Math.sqrt(this.sum / this.count)), low = clamp(Math.sqrt(this.lowSum / this.count));
    this.time += this.count / this.rate;
    this.reference = Math.max(0.02, rms, this.reference * Math.exp(-0.02 / 3));
    this.bassReference = Math.max(0.015, low, this.bassReference * Math.exp(-0.02 / 3));
    const bassRise = low > this.bassAverage * 1.35 + 0.002 && low > this.previousBass * 1.12;
    const broadbandRise = low < rms * 0.25 && rms > this.average * 1.6 + 0.004 && rms > this.previous * 1.2;
    const rhythm = this.tracker.update(this.time, bassRise || (broadbandRise && this.bassAverage < 0.004), rms > 0.003);
    this.average += (rms - this.average) * 0.035; this.bassAverage += (low - this.bassAverage) * 0.035;
    this.previous = rms; this.previousBass = low;
    this.emit({ rms, bass: low, energy: clamp((rms - 0.001) / this.reference * 0.85), bassEnergy: clamp((low - 0.001) / this.bassReference * 0.85), ...rhythm });
    this.count = this.sum = this.lowSum = 0;
  }
}
