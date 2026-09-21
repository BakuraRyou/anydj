import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInstruments,instrumentDrama,dramaAt} from '../public/instrument-activity.js';
import {validateStructure} from '../public/song-structure.js';
import {arrangeShow} from '../public/show-arrangement.js';
const fixture=()=>({version:1,source:'htdemucs',step:.1,
 drums:Array.from({length:200},(_,i)=>i<100?.001:i%5===0?.25:.05),
 bass:Array.from({length:200},(_,i)=>i<100?.004:.12),
 vocals:Array.from({length:200},(_,i)=>i<100?.06:.09),other:Array(200).fill(.025)});
test('stem envelopes survive structure validation and reject corrupt data',()=>{
 const instruments=fixture(),result=validateStructure({version:1,source:'all-in-one',duration:20,segments:[{start:0,end:20,label:'chorus'}],instruments,elapsedSeconds:1.2},20);
 assert.deepEqual(result.instruments,instruments);assert.equal(result.elapsedSeconds,1.2);
 instruments.drums[0]=NaN;assert.throws(()=>validateInstruments(instruments,20));
 assert.throws(()=>validateInstruments({...fixture(),step:0},20));
 assert.throws(()=>validateInstruments({...fixture(),drums:[]},20));
});
test('whole-song contrast keeps a vocal-led section quieter than a percussion entrance',()=>{
 const stems=fixture(),drama=instrumentDrama(stems,20);
 assert.ok(dramaAt(drama,4).intensity<.1);
 assert.ok(dramaAt(drama,14).intensity>.6);
 assert.ok(dramaAt(drama,4).vocalShare>dramaAt(drama,14).vocalShare);
 const windows=Array.from({length:1000},(_,i)=>({rms:i%25<3?.2:.12,bass:.04,flux:i%25<3?.8:0}));
 const beats=Array.from({length:40},(_,i)=>i*.5),sections=[{start:0,end:10,label:'chorus'},{start:10,end:20,label:'verse'}];
 const show=arrangeShow(windows,20,sections,beats,beats.filter((_,i)=>i%4===0),null,stems);
 assert.equal(show.passages[0].look,'held');assert.equal(show.passages[1].look,'peak');
 assert.ok(show.times.filter(t=>t<9).length<show.times.filter(t=>t>=11).length);
 assert.ok(show.bases[32]<show.bases[112]);
 assert.deepEqual(stems,fixture(),'planning must not mutate cached model data');
});
test('silent stems stay finite and old structure results retain the fallback',()=>{
 const stems=fixture();for(const key of ['drums','bass','vocals','other'])stems[key].fill(0);
 const drama=instrumentDrama(stems,20);assert.ok(drama.intensity.every(x=>x===0));
 assert.equal(instrumentDrama(null,20),null);assert.equal(dramaAt(null,3),null);
 const old={version:1,source:'all-in-one',duration:20,segments:[{start:0,end:20,label:'verse'}]};
 assert.deepEqual(validateStructure(old,20),old);
});
