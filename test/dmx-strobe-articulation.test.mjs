import test from 'node:test';
import assert from 'node:assert/strict';
import {strobeConductor,strobeMusicExposure} from '../public/dmx-strobe-conductor.js';
const song=(picture={})=>({duration:12,showScore:[{start:0,end:12,role:'groove',character:'rhythmic',drive:.8,energy:.8,...picture}],arrangement:{bassAttacks:[0,.45,.9,1.35,1.8,4,4.45].map(time=>({time,strength:.9,duration:.3}))}});
test('a repeated bass figure articulates one unit instead of switching on every attack',()=>{
 const events=strobeConductor(song()).events;
 assert.equal(events.length,7);
 assert.deepEqual(events.slice(0,5).map(e=>e.ordinal),[0,0,0,0,0]);
 assert.deepEqual(events.slice(5).map(e=>e.ordinal),[1,1]);
 assert.equal(events.filter(e=>e.advance).length,2);
});
test('vocal and held passages reduce percussive density and contrast',()=>{
 const rhythmic=strobeConductor(song()).events;
 const vocal=strobeConductor(song({character:'vocal',vocals:.8})).events;
 assert.ok(vocal.length<rhythmic.length);
 assert.ok(vocal.every(e=>e.gain<rhythmic[0].gain));
 assert.ok(vocal.filter(e=>e.time<2).every(e=>e.ordinal===0),'thinned attacks do not manufacture a musical rest');
});
test('strong climaxes may articulate faster without manufacturing extra events',()=>{
 const plan=song({climax:true});plan.arrangement.bassAttacks=[0,.24,.48,.72].map(time=>({time,strength:1,duration:.2}));
 const calm=structuredClone(plan);calm.showScore[0].climax=false;
 assert.equal(strobeConductor(plan).events.length,4);
 assert.equal(strobeConductor(calm).events.length,2);
 assert.ok(strobeConductor(plan).events.every(e=>e.ordinal===0));
});
test('a subdued percussion event cannot regain full contrast in fixture exposure',()=>{
 const event=strobeConductor(song({role:'held'})).events[0];
 const music={role:'groove',evidence:true,energy:.8,active:[{...event,elapsed:.1}]};
 const level=strobeMusicExposure(music,'lead',0,2,true);
 assert.ok(level>0&&level<=.45);
});
