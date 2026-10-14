import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeFormationBank} from '../public/dmx-strobe-motifs.js';
import {strobeComposition} from '../public/dmx-strobe-score.js';
const figure=(form,ordinal=0)=>({form,motifId:'exchange',kind:'groove',energy:.8,progress:.6,music:{role:'groove',evidence:true,energy:.8,tone:.5,pitch:null,active:[{role:'lead',ordinal,elapsed:.1,duration:.3,strength:.9}]}});
const row=(form,event=0,count=8)=>Array.from({length:count},(_,rank)=>strobeComposition(figure(form,event),rank,count,0,3));
test('a fan wave exposes mirrored parts with a readable spatial span',()=>{
 for(const form of [0,1,6,10,11,17,18])for(const count of [2,3,8]){
  const values=row(form,0,count);assert.ok(values.some(c=>c.level>0));
  for(let i=0;i<count;i++)assert.equal(values[i].level,values[count-1-i].level);
  assert.ok(new Set(values.map(c=>c.x.toFixed(4))).size>1);
 }
});
test('each crossing entrance contains both mirrored rays even on uneven rows',()=>{
 for(const count of [2,3,7,8])for(const form of [2,5,12,16])for(let event=0;event<4;event++){
  const values=row(form,event,count);
  assert.ok(values.some(c=>c.level>0));
  for(let i=0;i<count;i++)assert.equal(values[i].level,values[count-1-i].level);
 }
});
test('travelling and diagonal segments stay contiguous and contain at least two rays',()=>{
 for(const count of [4,5,8,11])for(const form of [3,7,8,9,13,14,19]){
  const banks=strobeFormationBank(form,0,count).banks;
  for(let event=0;event<banks;event++){
   const lit=row(form,event,count).flatMap((c,i)=>c.level>0?[i]:[]);
   assert.ok(lit.length>=2);assert.equal(lit.at(-1)-lit[0]+1,lit.length);
  }
 }
});
test('the diagonal retains its height progression throughout the musical picture',()=>{
 for(const progress of [0,.5,1]){
  const values=Array.from({length:8},(_,rank)=>strobeComposition({...figure(13),progress},rank,8));
  for(let i=1;i<values.length;i++)assert.ok(values[i].y>values[i-1].y);
 }
});
