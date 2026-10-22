import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeConductor,strobeMusicAt} from '../public/dmx-strobe-conductor.js';
import {strobeScoreAt,strobeComposition} from '../public/dmx-strobe-score.js';
import {presenceComposition} from '../public/dmx-group-motion.js';
const picture=(start,end,extra={})=>({start,end,role:'groove',rhythmic:true,energy:.8,tone:.5,motif:'riff',...extra});
const song=()=>({duration:16,showProfile:'strobe',showScore:[picture(0,16)],sections:[{start:0,end:16,look:'peak'}],
 beatGrid:{beats:Array.from({length:33},(_,i)=>i*.5)},
 arrangement:{times:Array.from({length:32},(_,i)=>i*.5),accents:Array(32).fill(.6),eventSources:Array(32).fill('onset')}});
const sample=(plan,time,count=8)=>Array.from({length:count},(_,i)=>strobeComposition(strobeScoreAt(plan,time),i,count));
const art=s=>[s.pattern,s.layout,s.rolePhase,s.motion];
test('splitting the same riff into analysis fragments cannot cycle patterns, roles or pulse assignments',()=>{
 const a=song(),b=song();b.showScore=Array.from({length:4},(_,i)=>picture(i*4,(i+1)*4));
 const sequences=strobeConductor(b).sequences;
 assert.ok(sequences.every(s=>JSON.stringify(art(s))===JSON.stringify(art(sequences[0]))));
 for(const time of [1.1,4.1,4.3,7.4,8.1,8.3,12.1,15.4])assert.deepEqual(sample(a,time),sample(b,time));
});
test('a repeated musical motif recalls its idea after a contrasting arrival',()=>{
 const plan=song();plan.showScore=[picture(0,4),picture(4,8,{role:'arrival',motif:'hit'}),picture(8,16)];
 const sequences=strobeConductor(plan).sequences;
 assert.deepEqual(art(sequences[0]),art(sequences[2]));
 assert.notDeepEqual(art(sequences[0]),art(sequences[1]));
 assert.match(sequences[1].reason,/Höhepunkt/);
});
test('generic beat entries do not replace acoustic evidence or invent replies',()=>{
 const plan=song();plan.arrangement.eventSources.fill('beat');
 assert.equal(strobeConductor(plan).sequences[0].entrances.length,0);
 assert.deepEqual(sample(plan,1.1),sample(plan,1.3));
 const drums=song();for(const time of [1.1,1.2,1.35]){
  const roles=sample(drums,time,8);assert.equal(roles.find(c=>c.fixtureRole==='answer').level,0);
 }
});
test('musical builds open only their leading role; ordinary grooves hold their directions',()=>{
 const groove=song(),build=song();build.showScore=[picture(0,8,{role:'build'}),picture(8,16,{role:'build'})];
 const a=sample(build,2),b=sample(build,6);
 assert.ok(a.some((c,i)=>c.fixtureRole==='lead'&&c.visibleMotion&&c.x!==b[i].x));
 assert.deepEqual(a.filter(c=>c.fixtureRole==='support').map(c=>[c.x,c.y]),b.filter(c=>c.fixtureRole==='support').map(c=>[c.x,c.y]));
 assert.ok(sample(groove,2).every(c=>!c.visibleMotion));
 const left=sample(build,8-1e-7),right=sample(build,8);
 left.forEach((c,i)=>assert.ok(Math.hypot(c.x-right[i].x,c.y-right[i].y)<1e-6,'one build does not restart on the analysis boundary'));
 const presence={layers:[{weight:1,groupMotion:strobeScoreAt(build,2)}]};
 assert.equal(presenceComposition(presence,0,8).visibleMotion,true,'intent survives layered room composition');
});
test('a melodic response uses the measured onset and does not advance the drum sequence',()=>{
 const plan=song();plan.score={notes:[{start:0,end:1,midi:60},{start:2.3,end:3.1,midi:67}],
  track:[{time:2.3,confidence:.8},{time:2.4,confidence:.8},{time:2.5,confidence:.8}]};
 const plain=song();
 assert.equal(strobeMusicAt(plan,2.45).sequence.step,strobeMusicAt(plain,2.45).sequence.step);
 const answer=sample(plan,2.45).filter(c=>c.fixtureRole==='answer');
 assert.ok(answer.some(c=>c.level>0));
 assert.ok(sample(plain,2.45).filter(c=>c.fixtureRole==='answer').every(c=>c.level===0));
});
