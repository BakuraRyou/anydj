import test from 'node:test';
import assert from 'node:assert/strict';
import {createLosslessEncoder,pcm16} from '../public/lossless-audio-encoder.js';
import {audioExportFormat} from '../public/audio-export-formats.js';

test('WAV writes an accurate stereo PCM16 header and interleaved samples',()=>{
 const encoder=createLosslessEncoder('wav',{total:3}),header=new DataView(encoder.header.buffer);
 assert.equal(new TextDecoder().decode(encoder.header.subarray(0,4)),'RIFF');
 assert.equal(header.getUint32(4,true),48);assert.equal(header.getUint32(24,true),44100);assert.equal(header.getUint16(22,true),2);assert.equal(header.getUint16(34,true),16);
 const [bytes]=encoder.encode(Float32Array.of(-1,0,1),Float32Array.of(.5,-.5,0)),v=new DataView(bytes.buffer);
 assert.deepEqual(Array.from({length:6},(_,i)=>v.getInt16(i*2,true)),[-32768,16384,0,-16384,32767,0]);assert.deepEqual(encoder.finish(),[]);
});

test('FLAC retains pending samples across chunks and declares the exact stream length',()=>{
 const total=5001,encoder=createLosslessEncoder('flac',{total});
 assert.equal(new TextDecoder().decode(encoder.header.subarray(0,4)),'fLaC');
 let packed=0n;for(const byte of encoder.header.subarray(18,26))packed=(packed<<8n)|BigInt(byte);
 assert.equal(Number(packed&((1n<<36n)-1n)),total);assert.equal(Number(packed>>44n),44100);
 assert.equal(encoder.encode(new Float32Array(3000),new Float32Array(3000)).length,0);
 assert.equal(encoder.encode(new Float32Array(2001),new Float32Array(2001)).length,1);
 assert.equal(encoder.finish().length,1);assert.throws(()=>encoder.finish());
});

test('invalid formats, excessive WAV sizes and incomplete streams are rejected',()=>{
 assert.throws(()=>audioExportFormat('aac'));assert.equal(audioExportFormat('flac').mime,'audio/flac');
 assert.throws(()=>createLosslessEncoder('wav',{total:2**31}));assert.throws(()=>createLosslessEncoder('flac',{total:NaN}));
 const encoder=createLosslessEncoder('flac',{total:3});assert.throws(()=>encoder.finish());assert.throws(()=>encoder.encode(Float32Array.of(0),new Float32Array(2)));
 assert.equal(pcm16(-2),-32768);assert.equal(pcm16(2),32767);assert.equal(pcm16(NaN),0);
});
