import test from 'node:test';
import assert from 'node:assert/strict';
import {activityAt} from '../public/dmx-activity.js';
import {automaticStage} from '../public/dmx-auto.js';
const plan={sections:[{start:0,end:12,look:'flow'},{start:12,end:20,look:'held'},{start:20,end:30,look:'peak'}],arrangement:{times:[1,1.2,2.73,6.1,13,15,20.4,20.85],accents:[.4,.1,.45,.5,.6,.6,.3,.4]}};
const source=(time,more={})=>({movingPlan:plan,songTime:time,look:time<12?'flow':time<20?'held':'peak',frame:{state:true,r:255,g:40,b:0,dimming:60},weight:1,...more});
test('groups rest and only selected acoustic events change the formation',()=>{
  const at=t=>activityAt(source(t),4);
  assert.equal(at(0).filter(v=>v===0).length,2);
  assert.deepEqual(at(.2),at(.9));
  assert.notDeepEqual(at(.9),at(1.3));
  assert.deepEqual(at(1.3),at(2.7));
  assert.notDeepEqual(at(2.7),at(3));
  assert.deepEqual(at(3),at(6));
  assert.deepEqual(at(13),at(19));
  assert.equal(at(21).filter(v=>v===0).length,1);
  // Seeking backward must not retain future state.
  assert.deepEqual(at(.2),at(0));
});
test('group handovers fade smoothly, retain light and do not anticipate a hit',()=>{
  const before=activityAt(source(.999),4),start=activityAt(source(1),4),middle=activityAt(source(1.12),4),end=activityAt(source(1.24),4);
  assert.deepEqual(before,start);
  assert.ok(middle.some(v=>v>0&&v<1));
  assert.ok(Math.abs(middle.reduce((a,b)=>a+b,0)-2)<1e-9);
  end.forEach((v,i)=>assert.ok(Math.abs(middle[i]-(before[i]+v)/2)<1e-9));
});
test('only exceptional accents open the whole rig, quiet passages remain sparse',()=>{
  assert.deepEqual(activityAt(source(3,{accentStrength:.6}),4),activityAt(source(3),4));
  assert.deepEqual(activityAt(source(3,{accentStrength:1}),4),[1,1,1,1]);
  assert.equal(activityAt(source(14,{accentStrength:1}),4).filter(v=>v===0).length,2);
  assert.deepEqual(activityAt(source(3),1),[1]);
  assert.deepEqual(activityAt(source(3),0),[]);
});
test('spots retain independent rests with a long bar, and automatic decks blend their own activity',()=>{
  const equipment={devices:[...Array.from({length:4},(_,i)=>({id:`s${i}`,type:'spot',cells:1})),{id:'bar',type:'bar',cells:40}]};
  const render=s=>automaticStage(s,2,equipment).frames.flat();
  const a=source(.5,{weight:.25}),b=source(3,{weight:.75});
  const left=render([a]),right=render([b]),mixed=render([a,b]);
  assert.equal(left.slice(0,4).filter(f=>f.dimming===0).length,2);
  assert.equal(left.slice(4).filter(f=>f.dimming===0).length,20);
  mixed.forEach((f,i)=>assert.ok(Math.abs(f.dimming-(left[i].dimming*.25+right[i].dimming*.75))<1e-9));
  for(const t of [0,1.1,3,14,21])for(const f of render([source(t)]))assert.ok(Number.isFinite(f.dimming)&&f.dimming>=0&&f.dimming<=60);
});
test('atmospheric phrases hold their groups even when the underlying section is flow',()=>{
  const atmospheric=structuredClone(plan);
  atmospheric.arrangement.patterns={phrases:[{start:0,end:30,movement:{character:'atmospheric'}}]};
  const at=time=>activityAt(source(time,{movingPlan:atmospheric,motionCharacter:'atmospheric'}),4);
  assert.deepEqual(at(0),at(3));
  assert.deepEqual(at(3),at(8));
});
