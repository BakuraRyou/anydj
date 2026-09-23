import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTransitionVariant,variantProblem,bindVariant} from '../public/transition-library.js';
import {matchingSetTransition} from '../public/setlist-transition.js';
import {copyQueueEntry} from '../public/provider-queue.js';
const track=id=>({id,name:id+'.wav',size:123,lastModified:42,plan:{duration:100}});
const plan={time:80,cue:4,duration:8,style:'smooth',points:null};
test('directed variants preserve identity, names and independent queued copies',()=>{
 const a=track('a'),b=track('b'),v=makeTransitionVariant(a,b,plan,{name:'Langer Mix'}),previous={id:'a-entry',trackId:a.id};
 assert.equal(variantProblem(v,a,b),'');assert.notEqual(variantProblem(v,b,a),'');
 const entry=copyQueueEntry({id:'b-entry',trackId:b.id,transition:bindVariant(v,previous,a,b)});
 assert.equal(matchingSetTransition(entry,previous,a.plan,b.plan,1,1,a,b).time,80);
 v.plan.time=70;assert.equal(entry.transition.plan.time,80);
 assert.equal(entry.transition.variantName,'Langer Mix');
 assert.equal(matchingSetTransition(entry,{...previous,id:'other-entry'},a.plan,b.plan,1,1,a,b),null);
});
test('missing/replaced files and tempo mismatches are rejected, lighting reanalysis is allowed',()=>{
 const a=track('a'),b=track('b'),v=makeTransitionVariant(a,b,plan),previous={id:'a-entry',trackId:a.id};
 assert.match(variantProblem(v,a,{...b,missing:true}),/fehlt/);
 assert.match(variantProblem(v,a,{...b,size:124}),/geändert/);
 assert.equal(variantProblem(v,a,{...b,plan:{duration:100,version:999}}),'');
 const entry={trackId:b.id,transition:bindVariant(v,previous,a,b)};
 assert.equal(matchingSetTransition(entry,previous,a.plan,b.plan,1.1,1,a,b),null);
 assert.equal(matchingSetTransition(entry,previous,a.plan,b.plan,1,1,a,{...b,pendingChange:true}),null);
 assert.throws(()=>bindVariant(v,previous,a,{...b,lastModified:43}));
});
test('tempo context and rate-dependent duration bounds survive saving',()=>{
 const a=track('a'),b=track('b');
 const v=makeTransitionVariant(a,b,{...plan,time:95,duration:8},{rateA:.5});
 assert.equal(v.rateA,.5);assert.equal(variantProblem(v,a,b,.5,1),'');
 assert.throws(()=>makeTransitionVariant(a,b,{...plan,time:95,duration:8},{rateA:1}));
});
