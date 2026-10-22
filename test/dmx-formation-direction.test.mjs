import test from 'node:test';
import assert from 'node:assert/strict';
import {formationProgramFor,planFormationEntrances,strobeChoreography} from '../public/dmx-strobe-choreography.js';
import {strobeStageRoom} from '../public/dmx-room-presets.js';
import {applyRoomPlan} from '../public/dmx-ar-model.js';
import {presenceComposition} from '../public/dmx-group-motion.js';

function phrase(role='groove',sequence='exchange',functionName='verse'){
 const s={role,formationId:'open-fan',start:0,end:16,progress:.5,continuing:true,
  sharedPassage:{sequence,intent:{attention:{leader:'drums'}}},phraseArt:{function:functionName},
  entrances:Array.from({length:32},(_,i)=>({time:i*.5,duration:.2,strength:1}))};
 s.formationProgram=formationProgramFor(s);s.formationEntrances=planFormationEntrances(s);return s;
}
function figure(s,time,progress=.5){
 return {presentation:'strobe',kind:'groove',flicker:53,music:{sequence:{...s,time,progress,
  formationEntries:s.formationEntrances.filter(e=>e.time<=time&&time<e.releaseEnd)}}};
}
const row=(f,r)=>Array.from({length:16},(_,i)=>strobeChoreography(f,i,16,r,3));
const count=values=>values.filter(c=>c.level>.8).length;
test('a dialogue exchanges complete planes with a complementary answering formation',()=>{
 const s=phrase(),first=figure(s,.5),answer=figure(s,3.5);
 assert.ok(count(row(first,0))>=8,'the lead reveals a full readable fan');
 assert.ok(count(row(first,0))>count(row(first,2)));
 assert.ok(count(row(answer,2))>count(row(answer,0)),'upper plane answers at a measured phrase entrance');
 assert.notEqual(row(first,0)[0].formationId,row(first,2)[0].formationId);
 assert.ok(row(first,0).every(c=>c.paletteIndex===0));
 assert.ok(row(first,2).every(c=>c.paletteIndex===1));
 const twoRows=[0,1].map(r=>strobeChoreography(first,0,8,r,2));
 assert.equal(twoRows[1].paletteIndex,1,'two mounting rows retain a main and an answering plane');
 assert.notEqual(twoRows[0].formationId,twoRows[1].formationId);
});
test('quiet pictures, builds and arrivals have different stage density without reducing active beam strength',()=>{
 const quiet=figure(phrase('held','breath'),.5),build=phrase('build','opening'),peak=figure(phrase('arrival','wave','chorus'),.5);
 const occupancy=f=>[0,1,2].reduce((n,r)=>n+count(row(f,r)),0);
 assert.ok(occupancy(figure(build,.5,.1))<occupancy(figure(build,6.5,.9)));
 assert.ok(occupancy(quiet)<occupancy(peak));
 assert.ok(occupancy(peak)>32,'arrival uses multiple complete planes');
 for(const f of [quiet,peak,figure(build,6.5,.9)])assert.equal(Math.max(...row(f,0).map(c=>c.level)),1);
});
test('programs create distinct phrase developments and coordinated visible motor travel',()=>{
 const cases=[phrase('held','breath'),phrase('build','opening'),phrase('arrival','wave','chorus'),
  phrase('groove','exchange'),phrase('flow','wave'),phrase('flow','sweep'),phrase('flow','settle')];
 const traces=cases.map(s=>JSON.stringify([.5,2,3.5,5].map(t=>[0,1,2].map(r=>row(figure(s,t,t/8),r).map(c=>[c.x,c.y,c.level])))));
 assert.equal(new Set(traces).size,cases.length);
 const s=phrase('flow','sweep'),a=row(figure(s,.5),0),b=row(figure(s,2),0);
 assert.notDeepEqual(a.map(c=>[c.x,c.y]),b.map(c=>[c.x,c.y]),'geometry develops between musical statements');
 for(let tick=20;tick<1400;tick++)assert.ok([0,1,2].flatMap(r=>row(figure(s,tick/100),r)).some(c=>c.level>.25),'no collective strobe gap');
});
test('palette roles survive deck blending and the physical room keeps one color per plane',()=>{
 const f=figure(phrase(),.5),presence={level:1,groupMotion:f};
 const mixed={layers:[{...presence,weight:.6},{...presence,weight:.4}]};
 assert.equal(presenceComposition(mixed,0,16,2,3).paletteIndex,1);
 const source={id:'source',type:'moving',position:{x:0,y:4,height:3},target:{x:0,y:2},motionUV:{x:.5,y:.5},
  motionPresentation:'strobe',power:1,movingPresenceBasePower:1,movingPresence:mixed,
  strobePalette:[[40,150,255],[255,100,20]],color:'#2896ff',movingShutter:1};
 const scene=applyRoomPlan({layout:{width:8,depth:6,positions:{}},lights:[source]},strobeStageRoom());
 const heads=scene.lights.filter(l=>l.type==='moving');
 for(const y of [27,30,33])assert.equal(new Set(heads.filter(l=>l.position.y===y).map(l=>l.color)).size,1);
 assert.notEqual(heads.find(l=>l.position.y===27).color,heads.find(l=>l.position.y===33).color);
});
