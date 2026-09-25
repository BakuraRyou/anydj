import test from 'node:test';
import assert from 'node:assert/strict';
import {createVRPlayback} from '../public/dmx-vr-playback.js';
const scene=x=>({layout:{width:8,depth:12},motion:x,lights:[{id:'a',type:'moving',power:x/100,position:{x:0,y:1,height:2},target:{x,y:0}}],transport:{selected:'A',decks:[]}});
test('buffer keeps lights and guest animation moving across irregular network arrival intervals',()=>{
 const p=createVRPlayback();assert.equal(p.sample(0),null);
 for(const time of [0,60,140,200,290])p.push(scene(time),time);
 for(const now of [170,190,210,230,250,270,290,310]){const s=p.sample(now);assert.ok(Math.abs(s.lights[0].target.x-(now-120))<1e-9);assert.ok(Math.abs(s.motion-(now-120))<1e-9);}
 assert.equal(p.sample(1000).motion,290,'holds newest state instead of extrapolating through a quiet zone');
});
test('controls stay current while visual state is buffered; room changes and long outages reset interpolation',()=>{
 const p=createVRPlayback();p.push(scene(0),0);const next=scene(100);next.transport.selected='B';p.push(next,100);
 assert.equal(p.sample(150).motion,30);assert.equal(p.sample(150).transport.selected,'B');
 const changed=scene(200);changed.layout.width=14;p.push(changed,200);assert.equal(p.sample(250).layout.width,14);assert.equal(p.sample(250).motion,200);
 p.push(scene(900),2000);assert.equal(p.sample(2000).motion,900);
});
test('matches moving fixtures by identity after reordering',()=>{
 const p=createVRPlayback(),a=scene(0),b=scene(100);a.lights.push({...a.lights[0],id:'b',target:{x:50,y:0}});b.lights.unshift({...b.lights[0],id:'b',target:{x:150,y:0}});p.push(a,0);p.push(b,100);
 const s=p.sample(170);assert.equal(s.lights[0].id,'b');assert.equal(s.lights[0].target.x,100);assert.equal(s.lights[1].target.x,50);
});

test('normalized moving paths remain smooth when a paired room maps buffered frames',()=>{
 const p=createVRPlayback(),a=scene(0),b=scene(100);
 a.lights[0].motionUV={x:.1,y:.2};b.lights[0].motionUV={x:.9,y:.8};
 p.push(a,0);p.push(b,100);
 assert.deepEqual(p.sample(170).lights[0].motionUV,{x:.5,y:.5});
 assert.deepEqual(p.sample(220).lights[0].motionUV,b.lights[0].motionUV);
});

test('paired playback interpolates target height between floor and wall',()=>{
 const p=createVRPlayback(),a=scene(0),b=scene(100);b.lights[0].target.z=2;
 p.push(a,0);p.push(b,100);assert.equal(p.sample(170).lights[0].target.z,1);
});

test('local 20 Hz updates produce intermediate motion frames without delaying blackout',async()=>{
 const {createMovingPreview}=await import('../public/dmx-vr-playback.js');
 const playback=createMovingPreview(),frame=x=>[{...scene(x).lights[0],motionUV:{x:x/100,y:x/200},power:1}];
 playback.push(frame(0),scene(0).layout,0);playback.push(frame(50),scene(0).layout,50);
 const values=[60,76,93].map(t=>playback.sample(t)[0]);
 assert.deepEqual(values.map(l=>l.target.x),[0,16,33]);
 assert.ok(Math.abs(values[1].motionUV.x-.16)<1e-9);
 const dark=frame(100);dark[0].power=0;playback.push(dark,scene(0).layout,100);
 assert.equal(playback.sample(110)[0].target.x,50);assert.equal(playback.sample(110)[0].power,0);
 assert.equal(playback.active(110),true);assert.equal(playback.active(211),false,'no perpetual redraw after movement stops');
 assert.equal(playback.sample(1000)[0].target.x,100,'never extrapolate beyond a received destination');
 playback.push([],scene(0).layout,1050);assert.deepEqual(playback.sample(1050),[],'removed lights disappear immediately');
});
