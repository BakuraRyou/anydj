import test from 'node:test';
import assert from 'node:assert/strict';
import {cueAt,editorFrame,validateCues} from '../public/editor-model.js';
import {MusicSession,settings} from '../lib/music.mjs';
const a={time:0,color:'#ff0000',brightness:80,temp:2200,transition:'smooth'},b={time:10,color:'#0000ff',brightness:40,temp:6500,transition:'smooth'};
test('Editor interpoliert Farben, Weißtemperatur und Helligkeit; harter Übergang erst am Punkt',()=>{
 assert.deepEqual(cueAt([a,b],5),{rgb:[128,0,128],brightness:60,temp:4350});
 assert.deepEqual(cueAt([a,{...b,transition:'cut'}],9).rgb,[255,0,0]);
 assert.deepEqual(cueAt([a,b],20).rgb,[0,0,255]);
});
test('Editor begrenzt Projekte und verwirft ungültige oder doppelte Zeitpunkte',()=>{
 assert.throws(()=>validateCues([b],20));assert.throws(()=>validateCues([a,a],20));
 assert.throws(()=>validateCues([{...a,color:'invalid'}],20));
 assert.throws(()=>validateCues([a,{...b,time:30}],20));
 assert.deepEqual(validateCues([b,a],20),[a,b]);
});
test('Editor passt Ausgabe an RGB, Weißtemperatur und reine Dimmer an',()=>{
 assert.equal(editorFrame([a,b],0,{color:true},{dimming:100}).dimming,80);
 assert.equal(editorFrame([a,b],0,{color:true},{dimming:5}).dimming,5);
 assert.deepEqual(editorFrame([a,b],0,{color:false,temperature:true,minKelvin:2700,maxKelvin:6000}),{state:true,dimming:80,temp:2700});
 assert.deepEqual(editorFrame([a,b],0,{color:false,temperature:false}),{state:true,dimming:80});
});
test('Show transportiert Weißtemperatur nur an geeignete Lampen und stellt Zustand wieder her',async()=>{
 const calls=[],original={state:true,temp:3000,dimming:20};
 const music=new MusicSession({inspect:async()=>({pilot:original,capabilities:{color:false,brightness:true,temperature:true,minKelvin:2700,maxKelvin:6000}}),exchange:async(ip,m,p)=>calls.push(p)},{tickMs:100000});
 const {id}=await music.start('192.168.1.2','show',settings({maximum:100}));
 music.frame(id,{params:{state:true,temp:6500,dimming:70}});music.tick(music.session);await music.session.inFlight;
 assert.equal(calls[0].temp,6000);assert.equal(calls[0].r,undefined);await music.stop(id);assert.deepEqual(calls.at(-1),original);
});
