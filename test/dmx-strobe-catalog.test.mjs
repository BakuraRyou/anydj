import test from 'node:test';
import assert from 'node:assert/strict';
import {STROBE_ANIMATIONS,STROBE_FAMILIES,strobeLevel,strobeAnimationAt} from '../public/dmx-strobe.js';
import {automaticStage} from '../public/dmx-auto.js';
const families=Object.keys(STROBE_FAMILIES);
function planFor(family,count=24){
 const look={calm:'quiet',flow:'flow',groove:'flow',build:'lift',impact:'peak',outro:'outro'}[family];
 const energy=family==='impact'?.9:family==='calm'?.2:.5;
 return {sections:Array.from({length:count},(_,i)=>({start:i*8,end:(i+1)*8,look,intensity:energy})),
  arrangement:{developments:family==='build'?Array.from({length:count},(_,i)=>[{time:i*8+1,progress:.1},{time:i*8+6,progress:.9}]).flat():[],drama:{step:1,intensity:Array(count*8).fill(energy),percussion:Array(count*8).fill(family==='groove'||family==='impact'?.8:.1)}}};
}
const source=(plan,time)=>({movingPlan:plan,songTime:time,look:plan.sections[Math.floor(time/8)]?.look,beat:time*2,sectionProgress:(time%8)/8,weight:1,flicker:100,frame:{state:true,r:40,g:150,b:255,dimming:60},washDimming:65});
test('120 catalog entries produce 120 different spatiotemporal traces',()=>{
 assert.equal(STROBE_ANIMATIONS.length,120);
 assert.equal(new Set(STROBE_ANIMATIONS.map(a=>a.id)).size,120);
 const signatures=new Set();
 for(const animation of STROBE_ANIMATIONS){
  const samples=[];
  for(let j=0;j<192;j++)for(let i=0;i<8;i++){
   const value=strobeLevel(animation,{beat:j*.173,progress:j/191,index:i,units:8});
   assert.ok(Number.isFinite(value)&&value>=0&&value<=1,animation.id);
   samples.push(Math.round(value*1000));
  }
  const signature=samples.join(',');assert.ok(!signatures.has(signature),`duplicate output: ${animation.id}`);signatures.add(signature);
 }
});
test('each family is selected only for its matching passages and all 20 variants are reachable',()=>{
 for(const family of families){
  const plan=planFor(family),chosen=[];
  for(let i=0;i<24;i++){
   const s=source(plan,i*8+1),a=strobeAnimationAt(s).animation;
   assert.equal(a.family,family);
   assert.equal(strobeAnimationAt({...s,songTime:i*8+7,beat:999}).animation.id,a.id);
   chosen.push(a.id);
  }
  assert.equal(new Set(chosen).size,20,family);
  for(let i=1;i<chosen.length;i++)assert.notEqual(chosen[i],chosen[i-1]);
 }
});
test('seeks, cloned plans and motif returns reproduce the same animation',()=>{
 const plan=planFor('impact',5);plan.sections[0].motif='chorus';plan.sections[4].motif='chorus';
 const first=strobeAnimationAt(source(plan,1)).animation.id;
 assert.equal(strobeAnimationAt(source(plan,33)).animation.id,first);
 for(const time of [17,1,25,9,33,17])assert.deepEqual(automaticStage([source(plan,time)],2,undefined,'strobe'),automaticStage([source(structuredClone(plan),time)],2,undefined,'strobe'));
});
test('every animation respects flicker zero, missing beats, and single-fixture bounds',()=>{
 for(const animation of STROBE_ANIMATIONS)for(const beat of [-1,0,.24,12.8,NaN,null]){
  assert.equal(strobeLevel(animation,{beat,flicker:0}),1);
  assert.ok(strobeLevel(animation,{beat,units:1})>=0);
  assert.equal(strobeLevel(animation,{beat:null}),1);
 }
});
test('mixed patches keep non-bar choreography independent of bar length and preserve gain input',()=>{
 const plan=planFor('groove'),s=source(plan,17);
 const equipment=n=>({devices:[{id:'a',type:'spot',cells:1},{id:'bar',type:'bar',cells:n},{id:'b',type:'moving',cells:1}]});
 const a=automaticStage([s],2,equipment(4),'strobe'),b=automaticStage([s],2,equipment(16),'strobe');
 assert.deepEqual(a.frames[0],b.frames[0]);assert.deepEqual(a.frames[2],b.frames[2]);
 assert.equal(b.frames[1].length,16);
 const dark=automaticStage([{...s,frame:{...s.frame,dimming:0}}],2,equipment(4),'strobe');
 assert.ok(dark.frames.flat().every(f=>f.dimming===0));
});
test('measured musical withdrawals suppress the strobe choreography',()=>{
 const plan=planFor('impact',2);plan.arrangement.blackouts=[{start:1,end:3}];
 const result=automaticStage([source(plan,2)],2,undefined,'strobe');
 assert.ok(result.frames.flat().every(f=>f.dimming===0));
});
test('build tempo does not accelerate with the absolute position in a long song',()=>{
 for(const a of STROBE_ANIMATIONS.filter(a=>a.family==='build')){
  for(const progress of [0,.3,.7,1]){
   const input={beat:1.37,progress,index:2,units:8};
   assert.ok(Math.abs(strobeLevel(a,input)-strobeLevel(a,{...input,beat:input.beat+384}))<1e-9,a.id);
  }
 }
});
test('calm sections and outros keep a continuous light floor',()=>{
 for(const a of STROBE_ANIMATIONS.filter(a=>['calm','outro'].includes(a.family)))
  for(let beat=0;beat<32;beat+=.13)assert.ok(strobeLevel(a,{beat,progress:.9,index:3,units:8})>0,a.id);
});
test('the local app serves the catalog module as JavaScript',async()=>{
 const {createApp}=await import('../server.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');
 const dir=await mkdtemp('/tmp/anydj-strobe-route-');
 const app=await createApp({demo:true,dataDir:dir});
 try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/dmx-strobe.js`);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
  assert.match(await response.text(),/export const STROBE_ANIMATIONS/);
 }finally{
  app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});
 }
});
test('Lichtshow profile activates Strobo and restores the stage mode when switching away',async()=>{
 const {applyShowProfile,SHOW_PROFILES}=await import('../public/dj-show-profile.js');
 const {stageModeForStreams}=await import('../public/dmx-auto.js');
 const {readFile}=await import('node:fs/promises');
 assert.ok(SHOW_PROFILES.includes('strobe'));
 assert.match(await readFile(new URL('../public/dj.html',import.meta.url),'utf8'),/<option value="strobe">Formationen<\/option>/);
 const base=planFor('impact',2),before=structuredClone(base),plan=applyShowProfile(base,'strobe');
 assert.deepEqual(base,before);assert.equal(plan.showProfile,'strobe');
 const stream=source(plan,1),normal=source(applyShowProfile(base,'auto'),1);
 for(const mode of ['shared','auto','design']){
  assert.equal(stageModeForStreams([stream],mode),'strobe');
  assert.deepEqual(automaticStage([stream],2,undefined,mode),automaticStage([stream],2,undefined,'strobe'));
  assert.equal(stageModeForStreams([normal],mode),mode);
  assert.equal(stageModeForStreams([{...stream,weight:0},normal],mode),mode);
 }
});
test('measured weak peaks stay restrained and strong rhythmic flow gets a groove',()=>{
 const weak=planFor('calm',2);weak.sections.forEach(s=>s.look='peak');
 assert.equal(strobeAnimationAt(source(weak,1)).animation.family,'calm');
 assert.equal(strobeAnimationAt(source(planFor('groove',2),1)).animation.family,'groove');
});
test('flicker zero removes flashes while retaining the configured colors',()=>{
 const plan=planFor('impact',1);plan.arrangement.times=[1];plan.arrangement.eventSalience=[.95];
 for(const t of [1.01,1.15,1.8]){
  const result=automaticStage([{...source(plan,t),flicker:0}],2,undefined,'strobe');
  assert.ok(result.frames.flat().every(f=>f.dimming===65&&result.palette.some(c=>c.every((v,i)=>v===[f.r,f.g,f.b][i]))));
 }
});
