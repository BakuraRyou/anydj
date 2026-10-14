import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeMusicAt,strobeMusicExposure} from '../public/dmx-strobe-conductor.js';
const song=()=>({duration:12,showScore:[{start:0,end:12,role:'groove',energy:.8}],arrangement:{times:[1,2.5,4,8],accents:[.8,.8,.8,.8],eventSources:['onset','onset','onset','onset']}});
const banks=(music,n=4)=>Array.from({length:n},(_,i)=>strobeMusicExposure(music,'lead',i,n,true));
test('light transfers continuously between neighbours without returning to darkness',()=>{
 const p=song();let previous;
 for(let i=0;i<1200;i++){
  const values=banks(strobeMusicAt(p,i/100));
  assert.ok(Math.abs(values.reduce((s,v)=>s+v,0)-.89)<1e-8);
  assert.ok(values.filter(v=>v>0).length<=2);
  if(previous)assert.ok(Math.max(...values.map((v,k)=>Math.abs(v-previous[k])))<.03);
  previous=values;
 }
 assert.notDeepEqual(banks(strobeMusicAt(p,1)),banks(strobeMusicAt(p,2.5)));
});
test('a gap after a pulse contains a moving handover rather than a closed shutter',()=>{
 const m=strobeMusicAt(song(),1.8);
 assert.equal(m.active.length,0);
 assert.equal(banks(m).filter(v=>v>0).length,2);
});
test('musical spacing changes the wave and a seek restores its exact position',()=>{
 const a=song(),b=song();b.arrangement.times=[1,3.5,6,9];
 assert.notDeepEqual(banks(strobeMusicAt(a,2)),banks(strobeMusicAt(b,2)));
 const before=banks(strobeMusicAt(a,2));strobeMusicAt(a,10);assert.deepEqual(banks(strobeMusicAt(a,2)),before);
});
test('picture boundaries preserve wave phase, real silence remains dark',()=>{
 const a=song(),b=song();b.showScore=[{start:0,end:3,role:'groove',energy:.8},{start:3,end:12,role:'groove',energy:.8}];
 assert.deepEqual(banks(strobeMusicAt(a,3)),banks(strobeMusicAt(b,3)));
 const m={...strobeMusicAt(a,3),role:'silence'};assert.ok(banks(m).every(v=>v===0));
});
test('without acoustic events the fallback holds a sparse picture, not an invented loop',()=>{
 const p=song();p.arrangement.eventSources=p.arrangement.times.map(()=>'beat');
 assert.deepEqual(banks(strobeMusicAt(p,1)),banks(strobeMusicAt(p,8)));
});
