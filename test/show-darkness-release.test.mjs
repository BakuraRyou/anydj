import test from 'node:test';
import assert from 'node:assert/strict';
import {activityAt,movingPresenceAt,applyMovingPresence} from '../public/dmx-activity.js';
function plan(short=false){
 const p={duration:6,showProfile:'show',sections:[{start:0,end:6,look:'held'}],
  arrangement:{step:.1,bases:Array(60).fill(.3),times:[],accents:[],blackouts:short?[{start:2,end:4}]:[]},
  showScore:[{start:0,end:2,index:0,role:'held',occupancy:.5,rowFraction:.5,rowSelection:1},
   {start:2,end:6,index:1,role:'silence',occupancy:0,rowFraction:.5,rowSelection:2}]};
 if(!short)p.structure={instruments:{step:.1,drums:Array.from({length:60},(_,i)=>i<20?1:0),bass:Array(60).fill(0),vocals:Array(60).fill(0),other:Array(60).fill(0)}};
 return p;
}
const source=(p,time)=>({movingPlan:p,movingMood:'show',songTime:time});
function lights(p,time){return applyMovingPresence(Array.from({length:48},(_,i)=>({id:String(i),type:'moving',position:{x:i%8,y:Math.floor(i/8)},power:.4,movingPresenceBasePower:.4,movingPresence:movingPresenceAt(source(p,time))})));}
for(const short of [false,true])test(`measured ${short?'short blackout':'instrument rest'} owns the release, not an immediate empty formation`,()=>{
 const p=plan(short),duration=short?.06:.6,before=lights(p,1.999);
 assert.ok(before.some(l=>l.power>0));
 for(const fraction of [.001,.1,.5,.9,1.01]){
  const time=2+duration*fraction,level=activityAt(source(p,time),1)[0],actual=lights(p,time);
  for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i].power-before[i].power*level)<1e-9,'fade must preserve the outgoing pairs and rows');
  if(fraction<1)assert.ok(actual.some(l=>l.power>0));else assert.ok(actual.every(l=>l.power===0));
 }
 assert.deepEqual(lights(p,2.03),lights(p,2.03),'seeking does not depend on previous frames');
});
test('an explicitly empty picture without a measured release does not inherit lights',()=>{
 const p=plan();delete p.structure;
 assert.ok(lights(p,2.001).every(l=>l.power===0));
});
