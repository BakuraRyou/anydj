import test from 'node:test';
import assert from 'node:assert/strict';
import {drawWaveform} from '../public/dj-waveform.js';
function canvas(){
 const operations=[],images=[];
 const context={clearRect(){},fillRect(...args){operations.push(['rect',...args]);},drawImage(image){operations.push(['image',image]);}};
 return {width:640,height:80,operations,images,getContext:()=>context,ownerDocument:{createElement(){const image=canvas();images.push(image);return image;}}};
}
test('waveform background is reused while playback and cue positions remain live',()=>{
 const c=canvas(),wave={version:2,peaks:[.8,.6],rms:[.5,.4]};
 drawWaveform(c,wave,0,100,[25]);
 const image=c.images[0],drawn=image.operations.length;
 c.operations.length=0;drawWaveform(c,wave,50,100,[75]);
 assert.equal(c.images.length,1);assert.equal(image.operations.length,drawn);
 assert.equal(c.operations[0][0],'image');
 assert.deepEqual(c.operations.slice(1),[['rect',319,0,2,80],['rect',479,0,2,10]]);
});
test('track, envelope arrays, color and canvas size changes refresh the background',()=>{
 const c=canvas();let wave={version:2,peaks:[.8],rms:[.5]};
 drawWaveform(c,wave,0,0);
 const image=c.images[0];let previous=image.operations.length;
 for(const change of [()=>{wave={...wave};},()=>{wave.peaks=[.9];},()=>{wave.rms=[.6];},()=>{c.width=1024;},()=>{c.height=100;}]){
  change();drawWaveform(c,wave,0,0);assert.ok(image.operations.length>previous);previous=image.operations.length;
 }
 drawWaveform(c,wave,0,0,[],'#77d2dc');assert.ok(image.operations.length>previous);
 assert.equal(c.images.length,1);
 c.operations.length=0;drawWaveform(c,null,0,0);assert.deepEqual(c.operations,[]);
});
