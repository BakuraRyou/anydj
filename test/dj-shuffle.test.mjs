import test from 'node:test';
import assert from 'node:assert/strict';
import {createShufflePicker} from '../public/dj-shuffle.js';
const tracks=['a','b','c','d'].map(id=>({id,file:{}}));
test('draws every title once before beginning a new round',()=>{
 const picker=createShufflePicker(()=>0);
 assert.deepEqual(Array.from({length:4},()=>picker.next(tracks).id),['a','b','c','d']);
 assert.equal(picker.next(tracks,['d']).id,'a');
});
test('queued and loaded titles are excluded and count towards this round',()=>{
 const picker=createShufflePicker(()=>0);
 assert.equal(picker.next(tracks,['a','b']).id,'c');
 assert.equal(picker.next(tracks,['a','b','c']).id,'d');
 assert.equal(picker.next(tracks,tracks.map(t=>t.id)),null);
 assert.equal(picker.next(tracks,['d']).id,'a');
});
test('unavailable files are skipped; new and reconnected files enter the selection',()=>{
 const picker=createShufflePicker(()=>0);
 const bad=['missing','pendingChange','failed','queuePreparationError','deleted'].map(key=>({id:key,file:{},[key]:true}));
 assert.equal(picker.next([...bad,{id:'no-access'}]),null);
 assert.equal(picker.next([{id:'folder',handle:{}}]).id,'folder');
 assert.equal(picker.next([{id:'folder',handle:{}},tracks[0]],['folder']).id,'a');
});
test('small libraries terminate and alternate when the prior title is released',()=>{
 const picker=createShufflePicker(()=>0),pair=tracks.slice(0,2);
 assert.equal(picker.next(pair,['a']).id,'b');
 assert.equal(picker.next(pair,['a','b']),null);
 assert.equal(picker.next(pair,['b']).id,'a');
 assert.equal(picker.next([tracks[0]],['a']),null);
});

test('lookahead setting uses a safe default and bounded whole song counts',async()=>{
 const {shuffleLookahead}=await import('../public/dj-shuffle.js');
 for(const value of [null,'',undefined,'invalid',0,-1,Infinity])assert.equal(shuffleLookahead(value),3);
 assert.equal(shuffleLookahead('1'),1);assert.equal(shuffleLookahead('10'),10);
 assert.equal(shuffleLookahead(4.9),4);assert.equal(shuffleLookahead(999),50);
});
