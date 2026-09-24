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
