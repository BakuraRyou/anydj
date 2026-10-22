import test from 'node:test';
import assert from 'node:assert/strict';
import {cueAt,editorFrame,validateCues} from '../public/editor-model.js';
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
