import test from 'node:test';
import assert from 'node:assert/strict';
import {createLightOutputTrace} from '../public/light-output-trace.js';
test('trace distinguishes global source loss from room attenuation, bounds history and copies exports',()=>{
 const trace=createLightOutputTrace({limit:2,interval:100});
 const source=[{songTime:91,frame:{state:true,dimming:30},weight:1,movingPlan:{showProfile:'show'}}];
 const before=[{type:'moving',power:.3},{type:'spot',power:.2}];
 trace.push(0,source,before,before.map(l=>({...l,power:0,zoneTransit:true})));
 trace.push(30,[],[],[]);
 const data=trace.snapshot();assert.equal(data.frames.length,1);
 assert.equal(data.frames[0].sources[0].dimming,30);
 assert.equal(data.frames[0].beforeRoom.moving.lit,1);
 assert.equal(data.frames[0].rendererInput.moving.lit,0);
 assert.equal(data.frames[0].rendererInput.spot.zoneTransit,1);
 data.frames.length=0;assert.equal(trace.snapshot().frames.length,1);
 trace.push(100,source,[],[]);trace.push(200,source,[],[]);
 assert.deepEqual(trace.snapshot().frames.map(f=>f.now),[100,200]);
});
