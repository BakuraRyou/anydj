import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instrumentRests} from '../public/instrument-activity.js';
import {lightingScenes} from '../public/dmx-light-scenes.js';
import {musicalDarknessAt,movingPresenceAt,movingPresenceLevel} from '../public/dmx-activity.js';
import {planSongMovement} from '../public/song-movement-plan.js';
import {strobeConductor} from '../public/dmx-strobe-conductor.js';
import {automaticStage} from '../public/dmx-auto.js';
const evidence=JSON.parse(readFileSync(new URL('./fixtures/tomorrowland-quiet-passage.json',import.meta.url)));
const signal=()=>structuredClone(evidence);
function planFor({originalMix=true}={}){
 const e=signal();
 return {duration:36,step:.125,showProfile:'strobe',sections:[{start:0,end:36,look:'flow',intensity:.5}],
  frames:Array.from({length:288},()=>({state:true,r:80,g:150,b:255,dimming:60})),
  structure:{instruments:e.instruments},arrangement:{times:[],accents:[],...(originalMix?{motionEnvelope:e.motionEnvelope}:{}),
   patterns:{phrases:[{start:0,end:18.7,energy:.7},{start:18.7,end:31.6,energy:.1},{start:31.6,end:36,energy:.5}]}}};
}

test('Tomorrowland 2:42 retains its audible quiet layer instead of a 13-second false pause',()=>{
 const {instruments,motionEnvelope,offset}=signal();
 const old=instrumentRests(instruments);
 assert.equal(old.length,1);assert.equal(old[0].start+offset,162.7);assert.equal(old[0].end+offset,175.6);
 assert.deepEqual(instrumentRests(instruments,motionEnvelope),[]);
 const plan=planFor();
 assert.ok(lightingScenes(plan).every(s=>s.kind!=='silence'));
 for(let time=18;time<32;time+=.1)assert.equal(musicalDarknessAt(plan,time).level,1);
});

test('saved silence intent cannot override the corrected original-audio evidence',()=>{
 const legacy=planFor({originalMix:false});legacy.songMovement=planSongMovement(legacy);
 assert.ok(legacy.songMovement.passages.some(p=>p.role==='silence'),'reproduce the persisted false silence');
 const plan=planFor();plan.songMovement=legacy.songMovement;
 const original=JSON.stringify(plan);
 assert.ok(strobeConductor(plan).sequences.every(s=>s.role!=='silence'));
 const equipment={devices:Array.from({length:8},(_,i)=>({id:'spot'+i,type:'spot',cells:1}))};
 for(const time of [18.69,18.7,18.71,19,22,26,31.59,31.6]){
  const source={movingPlan:plan,songTime:time,frame:plan.frames[0],washDimming:60,weight:1,flicker:53};
  const frames=automaticStage([source],2,equipment,'strobe').frames.flat();
  assert.ok(frames.some(f=>f.dimming>0),`fixed fixtures went dark at ${time+144}`);
  const presence=movingPresenceAt({...source,stageMode:'strobe'});
  assert.ok(Array.from({length:12},(_,i)=>movingPresenceLevel(presence,i,12)).some(v=>v>0),`moving heads went dark at ${time+144}`);
 }
 assert.equal(JSON.stringify(plan),original,'do not mutate saved song data');
});

test('original near-silence and explicit musical blackout cues remain authoritative',()=>{
 const plan=planFor(),envelope=plan.arrangement.motionEnvelope;
 envelope.forEach(p=>{if(p.time>=18.5&&p.time<=31.75)p.energy=0;});
 assert.ok(instrumentRests(plan.structure.instruments,envelope).length>0);
 assert.equal(musicalDarknessAt(plan,22).level,0);
 assert.ok(lightingScenes(plan).some(s=>s.kind==='silence'));
 const stop=planFor();stop.arrangement.blackouts=[{start:20,end:21}];
 assert.equal(musicalDarknessAt(stop,20.2).level,0);
 assert.ok(lightingScenes(stop).some(s=>s.start===20&&s.end===21&&s.kind==='silence'));
});
