import test from 'node:test';
import assert from 'node:assert/strict';
import {createCutPlayback} from '../public/track-cut-playback.js';

class Media extends EventTarget{
 constructor(){super();this.position=0;this.paused=true;this.seeking=false;this.readyState=1;this.src='blob:test';this.playbackRate=1;this.preservesPitch=true;this.seeks=[];}
 get currentTime(){return this.position;}
 set currentTime(value){this.position=value;this.seeks.push(value);this.seeking=true;this.dispatchEvent(new Event('seeking'));queueMicrotask(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'));});}
 get currentSrc(){return this.src;}
 async play(){this.paused=false;this.dispatchEvent(new Event('playing'));}
 pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
 removeAttribute(){this.src='';}load(){}
 advance(time){this.position=time;this.dispatchEvent(new Event('timeupdate'));}
}
const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}});
const node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){}});
const context=()=>({currentTime:0,createGain:node,createBiquadFilter:node,createMediaElementSource:node});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
async function withoutTimers(run){const interval=globalThis.setInterval,Audio=globalThis.Audio;globalThis.setInterval=()=>0;globalThis.Audio=Media;try{await run();}finally{globalThis.setInterval=interval;globalThis.Audio=Audio;}}
const playerFor=(audio,getTrack)=>createCutPlayback({context:context(),audio,source:node(),destination:node(),getTrack});

test('player skips intro, internal edits and tail on media events without UI timers',()=>withoutTimers(async()=>{
 const audio=new Media(),track={plan:{duration:12},audioCuts:[[0,2],[4,8],[10,12]]},player=playerFor(audio,()=>track);
 await settle();assert.equal(audio.currentTime,2);await audio.play();audio.advance(4.02);await settle();assert.equal(audio.currentTime,8);
 audio.advance(10.01);await settle();assert.equal(audio.currentTime,12);assert.deepEqual(audio.seeks,[2,8,12]);player.destroy();
}));
test('seeking into a removed passage is corrected while paused and while playing',()=>withoutTimers(async()=>{
 const audio=new Media(),player=playerFor(audio,()=>({plan:{duration:12},audioCuts:[[4,8]]}));
 audio.currentTime=6;await settle();assert.equal(audio.currentTime,8);assert.equal(audio.paused,true);
 await audio.play();audio.currentTime=5;await settle();assert.equal(audio.currentTime,8);player.destroy();
}));
test('newly saved cuts affect an already connected deck and cleanup removes enforcement',()=>withoutTimers(async()=>{
 const audio=new Media(),track={plan:{duration:12},audioCuts:[]},player=playerFor(audio,()=>track);
 await audio.play();track.audioCuts=[[4,8]];audio.advance(5);await settle();assert.equal(audio.currentTime,8);
 player.destroy();audio.advance(5);assert.equal(audio.currentTime,5);
}));
test('internal crossfade handoff also works without polling timers',()=>withoutTimers(async()=>{
 const audio=new Media(),track={plan:{duration:12},audioCuts:[[4,8]],audioCutJoins:[{cut:[4,8],duration:1,style:'smooth',points:null}]},player=playerFor(audio,()=>track);
 await audio.play();audio.advance(3.1);await settle();assert.equal(player.handles(),true);
 audio.advance(4.02);await settle();assert.ok(audio.currentTime>=8&&audio.currentTime<9.2);assert.equal(player.handles(),false);player.destroy();
}));
test('late or throttled transition ticks immediately skip deleted audio',()=>withoutTimers(async()=>{
 const audio=new Media(),track={plan:{duration:12},audioCuts:[[4,8]],audioCutJoins:[{cut:[4,8],duration:1,style:'smooth',points:null}]},player=playerFor(audio,()=>track);
 await audio.play();audio.advance(3.1);await settle();audio.advance(5);await settle();assert.equal(audio.currentTime,8);assert.equal(player.handles(),false);player.destroy();
}));
test('deck is notified of cut jumps so a loop cannot keep seeking into deleted audio',()=>withoutTimers(async()=>{
 const audio=new Media(),jumps=[];
 const player=createCutPlayback({context:context(),audio,source:node(),destination:node(),getTrack:()=>({plan:{duration:12},audioCuts:[[4,8]]}),onSkip:jump=>jumps.push(jump)});
 await audio.play();audio.advance(5);await settle();assert.deepEqual(jumps,[{from:5,to:8}]);player.destroy();
}));
