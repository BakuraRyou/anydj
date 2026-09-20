import { AudioAnalysis } from './audio-analysis.js';
import { SpectralAnalysis, spectralFlux } from './spectral-analysis.js';
import { pitchCandidates, trackMelody } from './melody-analysis.js';
import { compileShow } from './show-plan.js';
self.onmessage = event => {
  try {
    if(event.data.kind==='render') {
      self.postMessage({plan:compileShow(event.data.windows,event.data.duration,event.data.options,event.data.beatGrid??null,event.data.structure??null,event.data.musicStyle??null)});
      return;
    }
    const { channels, rate, options, beatGrid = null, structure = null, musicStyle = null } = event.data, windows=[];
    const analysis=new AudioAnalysis(rate,l=>windows.push(l));
    const length=channels[0].length;
    for(let i=0;i<length;i++) {
      analysis.pushFrame(channels,i);
      if(i%Math.round(rate*2)===0) self.postMessage({progress:Math.round(i/length*65)});
    }
    const spectrum = new SpectralAnalysis(rate, 4096);
    const melodyFeatures=[];
    let previousFeature;
    for (let i=0;i<windows.length;i+=4) {
      const feature=spectrum.at(channels,Math.round((i+2)*rate*0.02));
      feature.flux=spectralFlux(previousFeature,feature);
      previousFeature=feature;
      melodyFeatures.push({...feature,pitches: pitchCandidates(spectrum.power,rate,spectrum.size)});
      for(let j=i;j<Math.min(i+4,windows.length);j++)Object.assign(windows[j],feature);
      if(i%100===0)self.postMessage({progress:65+Math.round(i/windows.length*35)});
    }
    const melody=trackMelody(melodyFeatures);
    for(let i=0;i<windows.length;i++){const point=melody[Math.floor(i/4)];windows[i].leadMidi=point.midi;windows[i].leadConfidence=point.confidence;}
    const duration=length/rate;
    self.postMessage({windows,plan:compileShow(windows,duration,options,beatGrid,structure,musicStyle)});
  } catch(error) { self.postMessage({error:error.message}); }
};
