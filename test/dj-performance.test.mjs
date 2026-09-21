import test from 'node:test';
import assert from 'node:assert/strict';
import {audioEnvelope,audioPeaks,dbGain,cleanCues,loopRange,tempoAt,jumpBeats} from '../public/dj-performance-model.js';
test('gain scale and stereo waveform preserve real audio peaks',()=>{
 assert.equal(dbGain(0),1);assert.ok(Math.abs(dbGain(-6)-.501187)<.00001);
 const channels=[new Float32Array([.1,.8,0,0]),new Float32Array([0,0,-.6,0])];
 const peaks=audioPeaks({numberOfChannels:2,length:4,getChannelData:i=>channels[i]},2);
 assert.ok(Math.abs(peaks[0]-.8)<.00001);assert.ok(Math.abs(peaks[1]-.6)<.00001);
});
test('hotcues exclude invalid positions, retaining zero',()=>assert.deepEqual(cleanCues([0,-1,NaN,12],10),[0,null,null,null]));
test('loops use real beat positions and reject incomplete boundaries',()=>{
 const beats=Array.from({length:20},(_,i)=>i*.5);
 assert.deepEqual(loopRange(beats,1.1,4,10),{start:1,end:3});
 assert.equal(loopRange(beats,8,4,10),null);assert.equal(loopRange(null,0,4,10),null);
 assert.equal(loopRange([0,3,6],0,1,10),null);assert.equal(loopRange(beats,1,4,2),null);
 assert.equal(tempoAt(beats,1.1),120);assert.equal(tempoAt([],0),null);
});

test('beat jumps preserve phase and loop cannot cross media end',()=>{
 const beats=Array.from({length:20},(_,i)=>i*.5);
 assert.equal(jumpBeats(beats,1.125,4),3.125);
 assert.equal(jumpBeats(beats,3.125,-4),1.125);
 assert.equal(jumpBeats([],1,4),null);
 assert.equal(loopRange(beats,1,4,3),null);
});

test('waveform distinguishes sustained energy even when transients reach the same peak',()=>{
 const data=Float32Array.from([1,0,0,0,1,.8,.8,.8]);
 const wave=audioEnvelope({numberOfChannels:1,length:8,getChannelData:()=>data},2);
 assert.deepEqual(wave.peaks,[1,1]);assert.equal(wave.rms[0],.5);
 assert.ok(wave.rms[1]>.8&&wave.rms[1]<1);
});
test('waveform uses a common scale for overshoots and preserves stereo energy without cancellation',()=>{
 const channels=[Float32Array.from([2,2,1,1]),Float32Array.from([-2,-2,-1,-1])];
 const wave=audioEnvelope({numberOfChannels:2,length:4,getChannelData:i=>channels[i]},2);
 assert.deepEqual(wave.peaks,[1,.5]);assert.deepEqual(wave.rms,[1,.5]);
 const silence=audioEnvelope({numberOfChannels:1,length:2,getChannelData:()=>new Float32Array(2)});
 assert.deepEqual(silence.rms,[0,0]);assert.deepEqual(silence.peaks,[0,0]);
});
