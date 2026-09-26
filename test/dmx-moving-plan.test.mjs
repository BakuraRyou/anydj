import test from 'node:test';
import assert from 'node:assert/strict';
import {movingPlanJob,movingPlanAt,createMovingPreparation} from '../public/dmx-moving-plan.js';
const song=(duration=24)=>({duration,beatGrid:{beats:Array.from({length:duration*2+1},(_,i)=>i/2)},sections:[{start:0,end:8,look:'held',motif:0},{start:8,end:16,look:'lift',motif:1},{start:16,end:duration,look:'peak',motif:2}]});
const compile=(plan,mode)=>{const job=movingPlanJob(plan,mode);while(!job.done)job.advance();return job.result;};
test('prepared scene tracks are deterministic, interpolated and seek stable',()=>{
  const plan=song(),before=JSON.stringify(plan),a=compile(plan),b=compile(plan);
  assert.deepEqual(a.values,b.values);assert.equal(JSON.stringify(plan),before);
  const first=movingPlanAt(a,18.125);movingPlanAt(a,1);assert.deepEqual(movingPlanAt(a,18.125),first);
  assert.equal(first.length,4);assert.ok(first.every(p=>Number.isFinite(p.pan)&&Number.isFinite(p.tilt)));
  const left=movingPlanAt(a,18.1),right=movingPlanAt(a,18.15);
  first.forEach((p,i)=>assert.ok(p.pan>=Math.min(left[i].pan,right[i].pan)-1e-5&&p.pan<=Math.max(left[i].pan,right[i].pan)+1e-5));
  assert.deepEqual(movingPlanAt(a,-3),movingPlanAt(a,0));
  assert.deepEqual(movingPlanAt(a,Infinity),null);
  assert.deepEqual(movingPlanAt(a,100),movingPlanAt(a,24));
});
test('prepared section transitions respect speed limits; wash and missing beats stay calm',()=>{
  const a=compile(song());
  for(let i=8;i<a.values.length;i+=8)for(let h=0;h<4;h++){
    assert.ok(Math.abs(a.values[i+h*2]-a.values[i-8+h*2])<=70*a.step+1e-5);
    assert.ok(Math.abs(a.values[i+h*2+1]-a.values[i-8+h*2+1])<=.8*a.step+1e-5);
  }
  assert.notDeepEqual(a.values,compile(song(),'wash').values);
  const still=compile({...song(),beatGrid:null});
  for(const [a,b] of [[1,4],[9,12],[17,22]])assert.deepEqual(movingPlanAt(still,a),movingPlanAt(still,b),'without a grid hold the established image');
  const long=movingPlanJob(song(10000));assert.ok(long.result.values.byteLength<=2097184);
});
test('preparation is opt-in, chunked, cancellable, cached and invalidated by show replacement',()=>{
  let nextId=0;const tasks=new Map();
  const prep=createMovingPreparation({schedule:fn=>{tasks.set(++nextId,fn);return nextId;},cancel:id=>tasks.delete(id)});
  const step=()=>{const [id,fn]=tasks.entries().next().value;tasks.delete(id);fn();};
  const drain=()=>{while(tasks.size)step();};
  const a=song();
  prep.prepare([a]);assert.equal(tasks.size,0);assert.equal(prep.read(a,1),null);
  prep.setEnabled(true);prep.prepare([a]);assert.equal(tasks.size,1);
  step();assert.equal(prep.stats().ready,0);
  prep.setEnabled(false);assert.equal(tasks.size,0);
  prep.setEnabled(true);drain();assert.equal(prep.stats().ready,1);
  const saved=prep.read(a,12);prep.prepare([a]);assert.equal(tasks.size,0);assert.deepEqual(prep.read(a,12),saved);
  prep.prepare([a],'wash');assert.equal(tasks.size,1);drain();assert.notDeepEqual(prep.read(a,12,'wash'),saved);
  const replacement=song();prep.prepare([replacement]);assert.equal(prep.read(replacement,1),null);
  drain();assert.equal(prep.stats().ready,1);
  prep.prepare([{duration:NaN}]);drain();assert.equal(prep.stats().failed,1);
  prep.prepare([song(60)]);assert.equal(tasks.size,1);prep.destroy();assert.equal(tasks.size,0);
});
test('playback velocity is continuous across 50 ms sample boundaries without overshoot',()=>{
 const track={duration:.2,step:.05,values:Float32Array.from([0,1,3,4,4].flatMap(p=>Array.from({length:4},()=>[p,.8]).flat()))};
 const at=t=>movingPlanAt(track,t)[0].pan,h=.000001;
 for(const t of [.05,.1,.15]){
  const left=(at(t)-at(t-h))/h,right=(at(t+h)-at(t))/h;
  assert.ok(Math.abs(left-right)<.02);
 }
 for(let t=0;t<=.2;t+=.001){assert.ok(at(t)>=0&&at(t)<=4);}
 assert.equal(at(.175),4);
});
