import { LiveAnalysis } from './live-analysis.js';
class MusicAnalysis extends AudioWorkletProcessor {
  constructor() {
    super();
    this.analysis = new LiveAnalysis(sampleRate, level => this.port.postMessage(level));
    this.port.onmessage = () => { this.analysis = new LiveAnalysis(sampleRate, level => this.port.postMessage(level)); };
  }
  process(inputs, outputs) {
    const channels = inputs[0];
    for (let c = 0; c < outputs[0].length; c++) outputs[0][c].set(channels[c] || channels[0] || new Float32Array(outputs[0][c].length));
    if (channels.length) for (let i = 0; i < channels[0].length; i++) this.analysis.pushFrame(channels, i);
    return true;
  }
}
registerProcessor('music-analysis', MusicAnalysis);
