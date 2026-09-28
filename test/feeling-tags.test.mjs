import test from 'node:test';
import assert from 'node:assert/strict';
import {inferFeelings,feelingIds,DEFAULT_FEELINGS,normalizeCatalog} from '../public/feeling-tags.js';
import {libraryTracks} from '../public/dj-library.js';
import {analyzeStyle} from '../public/style-analysis.js';
const plan=(energy=.4,mood='gentle')=>({sections:[{energy:.5},{energy:.9}],moods:[{start:0,end:20,energy,mood,confidence:.8,held:false}]});
test('browser fallback gives multiple broad feelings without desktop claims',()=>{
 const analysis=inferFeelings(plan());assert.equal(analysis.source,'browser');
 assert.deepEqual(feelingIds({feelingAnalysis:analysis}),['calm','gentle']);
 assert.equal(analysis.scores.romantic,undefined);assert.equal(analysis.scores.epic,undefined);
});
test('desktop evidence enriches the same analysis without requiring a new inference',()=>{
 const input=plan();input.musicStyle={segments:[{start:0,end:20,scores:{acoustic:.7,pop:.3}}]};
 const result=inferFeelings(input);assert.equal(result.source,'desktop');assert.ok(result.scores.romantic>=.3);
 assert.ok(result.scores.calm>=.3);
});
test('silent, absent and uncertain tonal evidence do not fabricate feelings',()=>{
 assert.deepEqual(inferFeelings(null).scores,{});
 assert.deepEqual(inferFeelings({...plan(),sections:[{energy:0}]}).scores,{});
 const input=plan(.6);input.moods[0].held=true;assert.deepEqual(inferFeelings(input).scores,{});
});
test('duration weighting ignores a brief wild ending on a calm song',()=>{
 const input=plan();input.moods.push({start:20,end:21,energy:.95,mood:'dramatic',confidence:.8,held:false});
 assert.equal(inferFeelings(input).scores.wild,undefined);
});
test('catalog extends automatic rules and manual changes survive new suggestions',()=>{
 const catalog=normalizeCatalog([...DEFAULT_FEELINGS,{id:'dream',label:'Verträumt',profile:'calm'},{id:'party',label:'Party',profile:''}]);
 const track={feelingAnalysis:inferFeelings(plan()),feelingAdded:['party'],feelingExcluded:['calm']};
 assert.deepEqual(feelingIds(track,catalog),['gentle','dream','party']);
 track.feelingAnalysis=inferFeelings(plan(.9,'bright'));
 assert.ok(feelingIds(track,catalog).includes('party'));assert.ok(!feelingIds(track,catalog).includes('calm'));
});
test('multiple feeling filters use OR, compose with search, and keep queue input unique',()=>{
 const tracks=[{id:'a',name:'Alpha',feelingAdded:['calm','wild']},{id:'b',name:'Beta',feelingAdded:['wild']},{id:'c',name:'Gamma'}];
 assert.deepEqual(libraryTracks(tracks,{feelings:['calm','wild'],sort:'az'}).map(t=>t.id),['a','b']);
 assert.deepEqual(libraryTracks(tracks,{feelings:['calm','wild'],query:'beta'}).map(t=>t.id),['b']);
});
test('invalid and duplicate catalog entries are rejected',()=>{
 assert.deepEqual(normalizeCatalog([{id:'a',label:' Ruhig ',profile:'calm'},{id:'b',label:'ruhig'},{id:'a',label:'Other'},null]),[{id:'a',label:'Ruhig',profile:'calm'}]);
});
test('unreachable desktop style service leaves browser feeling analysis usable',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
 const result=await analyzeStyle({duration:20});assert.equal(result.style,null);
 const tags=inferFeelings({...plan(),musicStyle:result.style});assert.equal(tags.source,'browser');assert.ok(tags.scores.calm);
});
