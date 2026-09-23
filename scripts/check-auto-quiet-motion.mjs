// Diagnostic reproduction of current behavior, not a desired-behavior regression test.
// Synthetic analysis windows; no audio files, lamp traffic or external services.
import assert from 'node:assert/strict';
import {compileShow} from '../public/show-plan.js';
import {settings} from '../lib/music.mjs';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {automaticStage} from '../public/dmx-auto.js';
const duration=48,beats=Array.from({length:96},(_,i)=>i*.5);
const grid={version:1,source:'beat-this',duration,beats,downbeats:beats.filter((_,i)=>i%4===0)};
const structure={version:1,source:'all-in-one',duration,segments:[
 {start:0,end:16,label:'chorus'},{start:16,end:32,label:'verse'},{start:32,end:48,label:'chorus'}]};
const cases=[];
for(const relativeAmplitude of [.4,.13333333333333333]){
 const windows=Array.from({length:2400},(_,i)=>{
  const quiet=i>=800&&i<1600,hit=i%25<3,scale=quiet?relativeAmplitude:1;
  return {rms:(hit?.3:.12)*scale,bass:(hit?.15:.02)*scale,flux:hit?(quiet?.08:.7):0,tone:.5,beatSeq:Math.floor(i/25)};
 });
 const plan=compileShow(windows,duration,settings({arrangement:'auto'}),grid,structure);
 const cues=movingCues(plan,'auto','balanced');
 const summary=start=>{
  const local=cues.filter(c=>c.time>=start&&c.time<start+16);
  let degrees=0;let prev=movingCueAt(cues,start+2)[0].pan;
  for(let t=start+2.05;t<start+14;t+=.05){const pan=movingCueAt(cues,t)[0].pan;degrees+=Math.abs(pan-prev);prev=pan;}
  return {targets:local.length,meanTargetInterval:local.length>1?(local.at(-1).time-local[0].time)/(local.length-1):null,panDegreesPerSecond:Math.round(degrees/12*10)/10};
 };
 const loud=summary(0),quiet=summary(16);
 assert.equal(plan.sections[1].look,'flow');assert.equal(plan.sections[1].role,'support');
 if(relativeAmplitude===.4){assert.equal(quiet.meanTargetInterval,.5);assert.equal(loud.meanTargetInterval,.5);}
 else assert.equal(quiet.targets,0);
 cases.push({relativeAmplitude,quietLook:plan.sections[1].look,loud,quiet});
}
const render=(time,dimming,look='flow')=>automaticStage([{frame:{state:true,r:255,g:40,b:0,dimming},weight:1,motionBeat:time*2,look,accentStrength:0}],2,undefined,'auto').frames.flat().map(f=>f.dimming/dimming);
let variation=0;
for(let t=0;t<8;t+=.125){
 const quiet=render(t,15),loud=render(t,75);
 quiet.forEach((v,i)=>assert.ok(Math.abs(v-loud[i])<1e-12));
 variation=Math.max(variation,Math.abs(quiet[0]-render(0,15)[0]));
}
assert.ok(variation>.2);
assert.deepEqual(render(0,15,'held'),render(2,15,'held'));
console.log(JSON.stringify({bpm:120,cases,stage:{flowWavePeriodSeconds:4,flowRotationSeconds:4,relativeWaveUnchangedWhenDimmed:true,heldPassageIsStationary:true}},null,2));
console.log('Reproduziert: weniger Pegel bedeutet im Auto-Modus nicht zwingend weniger Bewegungsziele. Keine Änderungen an der Lichtsteuerung.');
