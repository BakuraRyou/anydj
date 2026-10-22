import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeChoreography,planFormationEntrances,formationPose,formationFor,FORMATION_NAMES} from '../public/dmx-strobe-choreography.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {planSongMovement,AUTO_FORMATIONS} from '../public/song-movement-plan.js';
import {strobeBaseDimming} from '../public/dmx-strobe.js';
const sequence=times=>{const s={role:'groove',strobeSentence:'pair-run',formationId:'crossed-fans',continuing:true,
 end:10,entrances:times.map(time=>({time,duration:.1,strength:1}))};s.formationEntrances=planFormationEntrances(s);return s;};
function sample(s,time,flicker=53){
 const figure={kind:'groove',flicker,music:{sequence:{...s,time,progress:.5,formationEntries:s.formationEntrances.filter(e=>e.time<=time&&time<e.releaseEnd)}}};
 return Array.from({length:16},(_,rank)=>strobeChoreography(figure,rank,16));
}
test('dense percussion produces held formations rather than multiple flashes per second',()=>{
 const s=sequence(Array.from({length:100},(_,i)=>i*.1));
 assert.ok(s.formationEntrances.length<=10);
 for(let i=1;i<s.formationEntrances.length;i++)assert.ok(s.formationEntrances[i].time-s.formationEntrances[i-1].time>=1.1-1e-8);
 assert.deepEqual(sample(s,.3),sample(s,.8),'dense intervening hits cannot change the picture');
 for(let tick=18;tick<950;tick++)assert.ok(Math.max(...sample(s,tick/100).map(c=>c.level))>.25,'handover retains visible beams');
});
test('53 percent flicker does not dim sustained beams, including small rigs',()=>{
 const s=sequence([0,1.5,3]);
 const normal=sample(s,.5,53),full=sample(s,.5,100);
 assert.deepEqual(normal,full);
 assert.equal(Math.max(...normal.map(c=>c.level)),1);
 const f={kind:'groove',flicker:53,music:{sequence:{...s,time:.5,formationEntries:s.formationEntrances.slice(0,1)}}};
 for(const n of [1,2,3,8,48])assert.equal(Math.max(...Array.from({length:n},(_,i)=>strobeChoreography(f,i,n).level)),1);
});
test('selected musical entrances stay on their actual timestamps and do not acquire a beat oscillator',()=>{
 const s=sequence([1.13,1.3,2.47]);
 assert.deepEqual(s.formationEntrances.map(e=>e.time),[1.13,2.47]);
 assert.ok(sample(s,1.1).every(c=>c.level===0));
 assert.ok(sample(s,1.5).some(c=>c.level===1));
 assert.ok(sample(s,1.8).some(c=>c.level===1),'a short percussive decay does not extinguish the formation');
 assert.notDeepEqual(sample(s,1.5).map(c=>c.level),sample(s,2.9).map(c=>c.level));
});
test('legacy mappings and authored spatial formations remain reachable and distinct',()=>{
 const selected=new Set([...AUTO_FORMATIONS.map(p=>formationFor({composition:p.name})),...Object.keys(FORMATION_NAMES).map(composition=>formationFor({composition}))]);
 assert.equal(selected.size,Object.keys(FORMATION_NAMES).length);
 const traces=Object.keys(FORMATION_NAMES).map(id=>JSON.stringify([.1,.5,.9].flatMap(p=>Array.from({length:3},(_,row)=>Array.from({length:8},(_,rank)=>formationPose(id,rank,8,row,3,p))))));
 assert.equal(new Set(traces).size,Object.keys(FORMATION_NAMES).length);
});
function song(offset=0){
 const beats=Array.from({length:17},(_,i)=>i*.5),times=[.31,1.12,2.83,4.02,6.6].map(t=>t+offset);
 const phrase={start:0,end:8,kind:'bounce',energy:.9,tone:.5,movement:{driving:.9,character:'rhythmic'}};
 const p={duration:8,showProfile:'strobe',step:.125,
  frames:Array.from({length:64},()=>({state:true,dimming:80,r:255,g:50,b:0})),
  sections:[{start:0,end:8,look:'peak',motif:0}],
  beatGrid:{beats,downbeats:beats.filter((_,i)=>i%4===0)},beatTiming:{times:beats,minimum:5,maximum:100},
  arrangement:{step:.125,times,accents:times.map(()=>.9),decays:times.map(()=>.18),
   eventSources:times.map(()=>'onset'),eventSalience:times.map(()=>.9),bases:Array(64).fill(.6),
   patterns:{phrases:[phrase]},lookTrack:Array(64).fill('peak'),
   drama:{step:.125,intensity:Array(64).fill(.9),percussion:Array(64).fill(.9),vocalShare:Array(64).fill(0)}}};
 p.songMovement=planSongMovement(p);return p;
}
test('the prepared song pipeline filters dense accents while retaining its musical passage decisions',()=>{
 const p=song(),f=strobeScoreAt(p,1.5),s=f.music.sequence;
 assert.ok(s.sharedPassage);assert.ok(s.formationId);
 assert.ok(s.formationEntrances.every(e=>p.arrangement.times.includes(e.time)));
 const maximum=t=>{const f=strobeScoreAt(p,t);return Math.max(...Array.from({length:16},(_,rank)=>strobeComposition({...f,flicker:53},rank,16).level));};
 assert.ok(maximum(.8)>.9);assert.ok(maximum(1.1)>.9);
});
test('source brightness preserves active-beam strength while respecting the configured ceiling',()=>{
 const p=song();p.effectiveOptions={maximum:80};
 const dimming=energy=>{p.arrangement.motionEnvelope=[{time:0,energy,tone:.5},{time:8,energy,tone:.5}];
 return strobeBaseDimming({movingPlan:{...p},songTime:2,frame:{state:true,dimming:12},washDimming:15});};
 assert.ok(dimming(.15)<dimming(.9));assert.ok(dimming(.15)>=56);assert.ok(dimming(.9)<=80);
});
