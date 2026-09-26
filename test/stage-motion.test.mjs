import test from 'node:test';
import assert from 'node:assert/strict';
import {phraseMovement} from '../public/stage-motion.js';
import {movingCues,movingCueAt} from '../public/dmx-moving-cues.js';
import {automaticStage} from '../public/dmx-auto.js';
const phrase={start:0,end:16,kind:'bounce',section:0,energy:.6,tone:.5};
const source=driving=>({times:Array.from({length:32},(_,i)=>i*.5),accents:Array(32).fill(.3),patterns:{phrases:[{...phrase}],events:Array.from({length:32},(_,i)=>({kind:'bounce',alternate:i%2,driving}))}});
const windows=(level,pulse)=>Array.from({length:800},(_,i)=>({rms:level*(pulse?(i%25<3?1:.25):1)}));
test('loud sustained sound and quiet driving rhythm are classified by character, not level',()=>{
 assert.equal(phraseMovement(windows(.6,false),phrase,source(false)).character,'atmospheric');
 assert.equal(phraseMovement(windows(.06,true),phrase,source(true)).character,'rhythmic');
 assert.deepEqual(phraseMovement(windows(.6,true),phrase,source(true)),phraseMovement(windows(.06,true),phrase,source(true)));
});
test('steady automatic music develops slowly while standout rhythmic cues stay responsive',()=>{
 const p={duration:16,sections:[{start:0,end:16,look:'flow'}],arrangement:source(false)};
 const before=movingCues(p,'auto');
 p.arrangement.patterns.phrases[0].movement=phraseMovement(windows(.6,false),phrase,p.arrangement);
 const after=movingCues(p,'auto');
 assert.equal(before.length,32);assert.ok(after.length>2&&after.length<before.length);
 assert.ok(after.slice(1).every(c=>c.travel<=4));
 assert.ok(after.some(c=>c.reason==='section-flow'&&c.continuous));
 const path=cues=>{let result=0,prev=movingCueAt(cues,0)[0].pan;for(let t=.025;t<16;t+=.025){const next=movingCueAt(cues,t)[0].pan;result+=Math.abs(next-prev);prev=next;}return result;};
 assert.ok(path(after)>5&&path(after)<path(before)/2,'quiet development remains visible with less than half the travel');
 const rhythmic=structuredClone(p);rhythmic.arrangement.patterns.phrases[0].movement.character='rhythmic';assert.ok(movingCues(rhythmic,'auto').length>=after.length);
 // Explicit choreography overrides keep their existing behavior.
 assert.deepEqual(movingCues(p,'follow'),movingCues(rhythmic,'follow'));
 const trajectory=cues=>cues.map(({time,travel,pose})=>({time,travel,pose}));
 assert.deepEqual(trajectory(movingCues(p,'auto','energetic')),trajectory(movingCues(rhythmic,'auto','energetic')));
 rhythmic.arrangement.accents[12]=.7;
 assert.ok(movingCues(rhythmic,'auto').length>after.length);
 const expected=movingCueAt(after,7);movingCueAt(after,15);assert.deepEqual(movingCueAt(after,7),expected);
});
test('atmospheric auto output does not add a continuous wave or rotate the chosen colors',()=>{
 const stream={frame:{state:true,r:200,g:100,b:30,dimming:30},weight:1,look:'flow',accentStrength:0,motionCharacter:'atmospheric'};
 const render=(beat,s=stream,mode='auto')=>automaticStage([{...s,beat}],2,undefined,mode).frames;
 assert.deepEqual(render(0),render(9));
 assert.deepEqual(render(0,{...stream,motionCharacter:'rhythmic'}),render(1,{...stream,motionCharacter:'rhythmic'})); // A beat alone no longer switches active groups.
 assert.notDeepEqual(render(0,stream,'chase'),render(1,stream,'chase'));
});
