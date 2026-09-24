import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneSettings,zoneLights} from '../public/dmx-zone-plan.js';
const layout={width:10,depth:10};
const lamp={id:'fixture-1',type:'spot',position:{x:0,y:8,height:3},target:{x:0,y:5},power:1};
test('saved zones remain inside the room and tolerate invalid settings',()=>{
 assert.deepEqual(zoneSettings(null),{zones:[],aims:{}});
 const s=zoneSettings({zones:[{x:2,y:-1,width:2,depth:.2}],aims:{a:{x:2,y:-1}}});
 assert.equal(s.zones[0].x,0);assert.equal(s.zones[0].y,0);assert.equal(s.zones[0].width,1);assert.deepEqual(s.aims.a,{x:1,y:0});
});
test('manual aim changes fixed fixtures without changing source lights',()=>{
 const before=structuredClone(lamp),s=zoneSettings({aims:{'fixture-1':{x:.8,y:.3}}});
 assert.deepEqual(zoneLights([lamp],layout,s)[0].target,{x:3.0000000000000004,y:3});assert.deepEqual(lamp,before);
 assert.deepEqual(zoneLights([{...lamp,type:'moving'}],layout,s)[0].target,lamp.target);
});
test('moving targets avoid padded zones; fixed lights retain direction and dim',()=>{
 const s=zoneSettings({zones:[{x:.4,y:.4,width:.2,depth:.2}]});
 const [fixed,moving]=zoneLights([lamp,{...lamp,type:'moving'}],layout,s);
 assert.deepEqual(fixed.target,lamp.target);assert.equal(fixed.power,.1);
 assert.ok(moving.target.x < -1.25 || moving.target.x>1.25 || moving.target.y<3.75 || moving.target.y>6.25);assert.equal(moving.power,1);
});
test('fully covered floor dims instead of picking another prohibited target',()=>{
 const s=zoneSettings({zones:[{x:0,y:0,width:1,depth:1}]});
 assert.equal(zoneLights([{...lamp,type:'moving'}],layout,s)[0].power,.1);
});
