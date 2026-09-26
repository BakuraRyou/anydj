import test from 'node:test';
import assert from 'node:assert/strict';
import {movingCueExposure,movingCueAt} from '../public/dmx-moving-cues.js';
import {applyMovingPresence} from '../public/dmx-activity.js';
import {createRoomMotors} from '../public/dmx-light-geometry.js';
const pose=pan=>Array.from({length:4},()=>({pan,tilt:.8}));
const cues=[{time:0,travel:0,pose:pose(-20)},{time:4,travel:1.5,pose:pose(20),darkTravel:true},{time:8,travel:1,pose:pose(22)}];
test('relocations fade before motion, remain dark in transit and reveal the arrival',()=>{
 assert.deepEqual(movingCueExposure(cues,2),{level:1,transfer:false});
 const fade=movingCueExposure(cues,2.4);assert.ok(fade.level>0&&fade.level<1);assert.equal(fade.transfer,false);
 assert.deepEqual(movingCueAt(cues,2.4),pose(-20));
 for(const time of [2.5,3,3.9,4])assert.deepEqual(movingCueExposure(cues,time),{level:0,transfer:true});
 assert.ok(movingCueExposure(cues,4.15).level>0&&movingCueExposure(cues,4.15).level<1);
 assert.deepEqual(movingCueExposure(cues,4.4),{level:1,transfer:false});
 assert.deepEqual(movingCueExposure(cues,7.5),{level:1,transfer:false},'ordinary expressive motion stays lit');
 assert.deepEqual(movingCueExposure(cues,3),movingCueExposure(cues,3),'seeking is deterministic');
});
test('room presence cannot relight a muted transfer',()=>{
 const light={id:'a',type:'moving',position:{x:0},power:1,movingPresence:{level:.75,spread:1},movingPresenceBasePower:1,movingShutter:0,cueTransit:true};
 assert.equal(applyMovingPresence([light])[0].power,0);
 assert.equal(applyMovingPresence([{...light,movingShutter:1}])[0].power,.75);
});
test('an authorized unlit relocation moves, while an ordinary inactive head rests',()=>{
 const layout={width:8,depth:8,height:4,room:true};
 const lamp={id:'a',type:'moving',position:{x:0,y:6,height:2},target:{x:-2,y:0,z:0},power:1};
 const motor=createRoomMotors();motor(lamp,layout,0);
 const parked=motor({...lamp,power:0,target:{x:2,y:0,z:0}},layout,.1);
 assert.deepEqual(parked.target,lamp.target);
 const transfer=motor({...lamp,power:0,cueTransit:true,target:{x:2,y:0,z:0}},layout,.2);
 assert.equal(transfer.power,0);assert.notDeepEqual(transfer.target,parked.target);
});
