import test from 'node:test';
import assert from 'node:assert/strict';
import {planStrobePhrases} from '../public/dmx-strobe-conductor.js';
import {strobeDramaticComposition} from '../public/dmx-strobe-score.js';

function score(){
 const parts=[['verse',.5],['chorus',.9],['verse',.5],['chorus',.88]];
 const plan={structure:{segments:parts.map(([label],i)=>({start:i*4,end:i*4+4,label}))}};
 const sequences=parts.map(([label,energy],i)=>({start:i*4,end:i*4+4,role:'groove',energy,rhythmic:true,
  strobeSentence:i===2?'frame':'pair-run',
  sharedPassage:{motion:i===2?'box-frame':'parallel-sweep',composition:i===2?'box-frame':'parallel-sweep',
   sequence:i===2?'breath':'sweep',coordination:'layered',theme:{key:label+':groove'},
   intent:{rhythm:{density:i===1?.8:.3},attention:{leader:label==='verse'?'vocals':'drums'}}},
  entrances:Array.from({length:8},(_,step)=>({time:i*4+.05+step*.5,role:'lead',kind:'source',strength:.9,salience:step===3?1.2:.3,phraseStep:step%4}))}));
 return {plan,sequences};
}
const figure=(s,extra={})=>({kind:'groove',flicker:100,rhythmBeat:.2,music:{active:[],sequence:{...s,
 time:s.start+.5,step:0,stepBase:0,entry:s.entrances[0],progress:.025,...extra,formationEntries:[{...(extra.entry??s.entrances[0]),formationStep:extra.step??0,holdEnd:(extra.time??s.start+.5)+1,releaseEnd:(extra.time??s.start+.5)+1.4}],formationEntrances:s.entrances}}});

test('verses and choruses get different visibility scales and return to their musical group motif',()=>{
 const {plan,sequences}=score();planStrobePhrases(sequences,plan);
 assert.equal(sequences[0].strobeSentence,'dialogue');
 assert.equal(sequences[1].strobeSentence,'ripple');
 assert.equal(sequences[2].strobeSentence,'dialogue','a returning verse remembers its groups even on another shared geometry');
 assert.equal(sequences[3].strobeSentence,'ripple','a returning chorus recalls its first idea');
 assert.equal(sequences[2].phraseArt.recalled,true);
 assert.ok(sequences[0].phraseArt.rowDensity<sequences[1].phraseArt.rowDensity);
 const foregroundRows=s=>Array.from({length:6},(_,row)=>Array.from({length:8},(_,rank)=>strobeDramaticComposition(figure(s),rank,8,row,6).level)).flat().filter(v=>v>.5).length;
 assert.ok(foregroundRows(sequences[1])>foregroundRows(sequences[0]));
});
test('relative salience marks exceptional attacks and a uniformly loud grid has none',()=>{
 const {plan,sequences}=score();planStrobePhrases(sequences,plan);
 assert.deepEqual(sequences[0].entrances.map(e=>e.prominent),[false,false,false,true,false,false,false,false]);
 const loud=score();loud.sequences.forEach(s=>s.entrances.forEach(e=>e.salience=.95));
 planStrobePhrases(loud.sequences,loud.plan);
 assert.ok(loud.sequences.every(s=>s.entrances.every(e=>!e.prominent)));
});
test('preparation requires both energy contrast and an actual strong boundary attack',()=>{
 const {plan,sequences}=score();planStrobePhrases(sequences,plan);
 assert.deepEqual(sequences[0].phraseArt.anticipation,{start:3.2,end:4,strength:.9});
 assert.equal(sequences[1].phraseArt.arrival,.9);
 assert.equal(sequences[1].phraseArt.anticipation,undefined,'a release does not invent an upcoming drop');
 const weak=score();weak.sequences[1].entrances[0].strength=.2;
 planStrobePhrases(weak.sequences,weak.plan);
 assert.equal(weak.sequences[0].phraseArt.anticipation,undefined);
});
test('prominent entrances widen a selected group within the shared light phrase',()=>{
 const {plan,sequences}=score();planStrobePhrases(sequences,plan);
 const s={...sequences[0],strobeSentence:'pair-run',phraseArt:{...sequences[0].phraseArt,anticipation:null}};
 const entry={...s.entrances[3],phraseStep:0};
 const levels=prominent=>Array.from({length:16},(_,rank)=>strobeDramaticComposition(figure(s,{entry:{...entry,prominent},time:entry.time+.3}),rank,16).level);
 const ordinary=levels(false),special=levels(true);
 assert.ok(special.filter(v=>v>.5).length>ordinary.filter(v=>v>.5).length);
 assert.equal(Math.max(...special),Math.max(...ordinary));assert.ok(Math.max(...ordinary)>.8);
});
test('anticipation withdraws accompaniment while retaining full light on a leading group for any rig size',()=>{
 const {plan,sequences}=score();planStrobePhrases(sequences,plan);
 const s=sequences[0];
 for(const count of [1,2,4,8,24])for(const groups of [1,4]){
  const sample=time=>Array.from({length:groups},(_,row)=>Array.from({length:count},(_,rank)=>strobeDramaticComposition(figure(s,{time,entry:{...s.entrances.at(-1),time:time-.05,duration:.2},step:7}),rank,count,row,groups).level)).flat();
  const before=sample(3.1),prepared=sample(3.95);
  assert.equal(Math.max(...prepared),Math.max(...before));
  assert.ok(prepared.reduce((a,v)=>a+v,0)<=before.reduce((a,v)=>a+v,0)+1e-9);
 }
});
