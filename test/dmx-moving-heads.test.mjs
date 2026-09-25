import test from 'node:test';
import assert from 'node:assert/strict';
import {movingHeadTargets,advanceMovingHeads,restingHeads} from '../public/dmx-moving-model.js';
const source=(more={})=>({frame:{state:true,dimming:70},weight:1,beat:3,look:'peak',...more});
const render=(more={},mode='auto')=>movingHeadTargets([source(more)],mode);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('motion uses the musical clock, repeats motifs and holds without a beat grid',()=>{
  assert.deepEqual(render(),render());
  assert.notDeepEqual(render(),render({beat:4}));
  assert.deepEqual(render({motionBeat:2,beat:10}),render({motionBeat:2,beat:90}));
  assert.deepEqual(render({beat:null}),restingHeads());
  assert.deepEqual(render({beat:NaN,motionBeat:Infinity}),restingHeads());
});
test('breaks and wash stay restrained; builds increase their movement range',()=>{
  const range=(look,sectionProgress=0,mode='auto')=>{
    const values=Array.from({length:129},(_,i)=>render({look,sectionProgress,beat:i/4},mode)[0].pan);
    return Math.max(...values)-Math.min(...values);
  };
  assert.ok(range('held')<range('flow'));
  assert.ok(range('flow')<range('peak'));
  assert.ok(range('lift',0)<range('lift',1));
  assert.equal(range('peak',0,'wash'),range('held'));
  assert.deepEqual(render({look:'break',accentStrength:1}),render({look:'break',accentStrength:0}));
  assert.notDeepEqual(render({accentStrength:1}),render({accentStrength:0}));
});
test('crossfades blend both choreographies continuously and ignore dark decks',()=>{
  const a=source({beat:1}),b=source({beat:7,look:'flow'});
  const left=movingHeadTargets([a]),right=movingHeadTargets([b]);
  for(const w of [0,.25,.49,.5,.51,.75,1]){
    const output=movingHeadTargets([{...a,weight:1-w},{...b,weight:w}]);
    output.forEach((pose,i)=>{near(pose.pan,left[i].pan*(1-w)+right[i].pan*w);near(pose.tilt,left[i].tilt*(1-w)+right[i].tilt*w);});
  }
  assert.deepEqual(movingHeadTargets([a,{...b,frame:{state:true,dimming:0}}]),left);
  assert.equal(movingHeadTargets([]),null);
  for(const extra of [{weight:0},{weight:NaN},{frame:null},{frame:{state:false,dimming:100}},{frame:{dimming:0}}])assert.equal(movingHeadTargets([source(extra)]),null);
});
test('seeks ease within motor limits, stay bounded and do not catch up after hidden time',()=>{
  const initial=restingHeads(),target=render({beat:80,accentStrength:1});
  const next=advanceMovingHeads(initial,target,.05);
  next.forEach((pose,i)=>{
    assert.ok(Math.abs(pose.pan-initial[i].pan)<=3.5);
    assert.ok(Math.abs(pose.tilt-initial[i].tilt)<=.04+1e-10);
  });
  assert.deepEqual(advanceMovingHeads(initial,target,30),advanceMovingHeads(initial,target,.1));
  assert.deepEqual(advanceMovingHeads(initial,target,-1),initial);
  let settled=initial;
  for(let i=0;i<200;i++)settled=advanceMovingHeads(settled,target,.05);
  settled.forEach((pose,i)=>{near(pose.pan,target[i].pan);near(pose.tilt,target[i].tilt);});
  for(const mode of ['auto','wash','follow','alternate','chase','design'])for(let beat=-32;beat<64;beat+=.25){
    for(const pose of render({beat,accentStrength:2,sectionProgress:Infinity},mode)){
      assert.ok(Number.isFinite(pose.pan)&&Math.abs(pose.pan)<=42);
      assert.ok(pose.tilt>=.55&&pose.tilt<=1.15);
    }
  }
});

test('deck flashes do not tug on movement during crossfades with a slow light base',()=>{
 const a=source({beat:1,weight:.5,washDimming:35}),b=source({beat:7,weight:.5,washDimming:45});
 const before=movingHeadTargets([a,b]);
 assert.deepEqual(movingHeadTargets([{...a,frame:{state:true,dimming:10}},{...b,frame:{state:true,dimming:100}}]),before);
 assert.deepEqual(movingHeadTargets([a,{...b,frame:{state:true,dimming:0}}]),movingHeadTargets([a]));
});

test('device assignment preserves whole musical roles instead of averaging opposing heads into the centre',async()=>{
 const {movingDevicePoses}=await import('../public/dmx-layout-model.js');
 const poses=[{pan:-35,tilt:.6},{pan:-22,tilt:.75},{pan:22,tilt:.95},{pan:35,tilt:1.1}];
 for(const count of [1,3,5,8]){
  const devices=Array.from({length:count},(_,i)=>({id:String(i),group:2}));
  const mapped=movingDevicePoses(poses,devices);
  assert.ok(mapped.every(p=>Math.abs(p.pan)>15),'background heads retain a real gesture');
  if(count>1)assert.ok(new Set(mapped.map(p=>p.pan+','+p.tilt)).size>1,'background is not a duplicated midpoint');
  assert.deepEqual(movingDevicePoses(poses,devices),mapped);
 }
 const devices=[{id:'left',group:0},{id:'right',group:1}];
 assert.deepEqual(movingDevicePoses(poses,devices),[poses[0],poses[3]],'left/right groups retain paired roles');
});
