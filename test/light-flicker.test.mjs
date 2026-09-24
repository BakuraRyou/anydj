import test from 'node:test';
import assert from 'node:assert/strict';
import {showFrameAt,transitionFrame} from '../public/show-plan.js';
import {arrangementMotionAt} from '../public/show-arrangement.js';
import {flickerLimit} from '../public/light-flicker.js';
const make=(look='peak')=>({duration:4,step:1,frames:Array.from({length:4},()=>({state:true,r:210,g:70,b:20,dimming:40})),
 beatTiming:{times:[1,2],accents:[.4,.4],minimum:0,maximum:100,decay:.2,exponent:1,intensity:1.5},
 arrangement:{step:1,bases:[.2,.3,.4,0],times:[1,2],accents:[.4,.4],decays:[.2,.2],eventSalience:[.1,.1],passages:[{look}],
  patterns:{phrases:[{start:0,end:4,section:0,kind:'bounce',movement:{character:'rhythmic',contrast:.8}}],events:[{kind:'bounce'},{kind:'bounce'}]}}});
test('beat flicker caps only fast accents and preserves colors, development, darkness and motion',()=>{
 const p=make(),before=structuredClone(p),motion=arrangementMotionAt(p.arrangement,1);
 assert.deepEqual([0,25,50,100].map(v=>showFrameAt(p,1,v).dimming),[30,55,70,70]);
 for(const limit of [0,25,100]){
  const f=showFrameAt(p,1,limit);assert.deepEqual([f.r,f.g,f.b],[210,70,20]);
  assert.equal(showFrameAt(p,3,limit).dimming,0);
 }
 assert.equal(showFrameAt(p,.5,0).dimming,25);
 assert.equal(showFrameAt(p,2,0).dimming,40);
 assert.deepEqual(showFrameAt(p,1),showFrameAt(p,1,100));
 assert.deepEqual(p,before);assert.equal(arrangementMotionAt(p.arrangement,1),motion);
 const first=showFrameAt(p,1,25);showFrameAt(p,2.8,100);assert.deepEqual(showFrameAt(p,1,25),first);
});
test('slow build swells remain unchanged when beat flicker is disabled',()=>{
 const p=make('lift');assert.ok(showFrameAt(p,1.2,100).dimming>32);
 assert.deepEqual(showFrameAt(p,1.2,0),showFrameAt(p,1.2,100));
});
test('the limit applies to both plans during transitions and to older beat envelopes',()=>{
 const a=make(),b=make();b.arrangement.bases=[.4,.5,.6,0];
 assert.equal(transitionFrame(a,b,1,.5,0).dimming,40);
 assert.equal(transitionFrame(a,b,1,.5,100).dimming,80);
 delete a.arrangement;assert.equal(showFrameAt(a,1,0).dimming,0);assert.equal(showFrameAt(a,1,50).dimming,40);assert.equal(showFrameAt(a,1,25).dimming,25);
});
test('invalid limits fall back to full intensity and numeric values stay bounded',()=>{
 for(const value of [undefined,null,NaN,Infinity,'25'])assert.equal(flickerLimit(value),100);
 assert.equal(flickerLimit(-10),0);assert.equal(flickerLimit(120),100);
});

test('weaker beats and decaying tails retain their original gradations below the ceiling',()=>{
 const levels=[];
 for(const strength of [.05,.1,.2,.4]){
  const p=make();p.arrangement.accents=[strength,strength];
  const full=showFrameAt(p,1,100).dimming,limited=showFrameAt(p,1,25).dimming;
  if(strength<=.25)assert.equal(limited,full);
  else assert.ok(limited<full);
  levels.push(limited);
  assert.deepEqual(showFrameAt(p,1.5,25),showFrameAt(p,1.5,100));
 }
 assert.deepEqual(levels,[35,40,50,55]);
});
