import { AudioAnalysis } from './audio-analysis.js';
import { SpectralAnalysis, spectralFlux } from './spectral-analysis.js';

// A bounded stereo history adds spectral information without delaying the
// existing 20 ms beat detector. Spectra refresh every 80 ms; no PCM is retained.
export class LiveAnalysis {
  constructor(rate, onLevel) {
    this.size = Math.min(16384, 2 ** Math.ceil(Math.log2(rate * 0.1)));
    this.ring = [new Float32Array(this.size), new Float32Array(this.size)];
    this.ordered = this.ring.map(() => new Float32Array(this.size));
    this.cursor = 0; this.count = 0; this.hop = Math.round(rate * 0.08);
    this.spectrum = new SpectralAnalysis(rate, this.size);
    this.feature = {};
    this.analysis = new AudioAnalysis(rate, level => onLevel({ ...level, ...this.feature }));
  }
  pushFrame(channels, i) {
    for (let c = 0; c < 2; c++) this.ring[c][this.cursor] = channels[c]?.[i] ?? channels[0]?.[i] ?? 0;
    this.cursor = (this.cursor + 1) % this.size;
    if (++this.count % this.hop === 0) {
      for (let c = 0; c < 2; c++) {
        this.ordered[c].set(this.ring[c].subarray(this.cursor));
        this.ordered[c].set(this.ring[c].subarray(0, this.cursor), this.size - this.cursor);
      }
      const feature = this.spectrum.at(this.ordered, this.size / 2);
      feature.flux = spectralFlux(this.feature.bands ? this.feature : null, feature);
      this.feature = feature;
    }
    this.analysis.pushFrame(channels, i);
  }
}
