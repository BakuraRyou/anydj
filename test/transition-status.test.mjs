import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionStatus} from '../public/dj-status.js';
const track={plan:{structure:{}},structureState:'complete'};
const plan={label:'Bassübergabe',duration:4,confidence:'analyzed'};
const input={from:track,to:track,plan};
test('transition readiness requires two prepared and accessible decks',()=>{
 assert.equal(transitionStatus({...input,to:null}).kind,'idle');
 assert.equal(transitionStatus({...input,to:{}}).kind,'working');
 assert.equal(transitionStatus({...input,needsFile:true}).kind,'warning');
 assert.equal(transitionStatus({...input,plan:{time:12}}).kind,'working');
 assert.equal(transitionStatus(input).text,'Bereit · Bassübergabe · 4.0 s');
});
test('background analysis distinguishes usable fallback from final pair plan',()=>{
 const fallback={...input,plan:{...plan,confidence:'fallback'},to:{plan:{},structureState:'running'}};
 assert.equal(transitionStatus(fallback).text,'Basisübergang bereit · Analyse läuft …');
 assert.equal(transitionStatus({...fallback,to:track}).kind,'ready');
 assert.equal(transitionStatus({...fallback,musical:false}).text,'Bereit · Crossfade · 4.0 s');
 assert.equal(transitionStatus({...input,active:true}).text,'Übergang läuft · Bassübergabe');
 assert.equal(transitionStatus({...input,starting:true}).kind,'working');
});
