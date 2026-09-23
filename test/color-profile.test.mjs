import test from 'node:test';
import assert from 'node:assert/strict';
import {colorProfile} from '../public/color-profile.js';
const red={r:255,g:0,b:0,dimming:100},blue={r:0,g:0,b:255,dimming:20};
const plan=frames=>({frames,duration:frames.length,step:1});
test('profile preserves time proportions independently of brightness and chronological order',()=>{
 const p=colorProfile(plan([red,red,blue,red]));
 assert.equal(p.colors.find(c=>c.rgb[0]===255).share,.75);
 assert.equal(p.colors.find(c=>c.rgb[2]===255).share,.25);
 assert.deepEqual(p,colorProfile(plan([blue,red,red,red])));
 assert.match(p.gradient,/75/);
});
test('no invented profile before analysis or for blackouts; ignores invalid colors',()=>{
 assert.equal(colorProfile(null),null);assert.equal(colorProfile(plan([])),null);
 assert.equal(colorProfile(plan([{...red,dimming:0},{...blue,state:false}])),null);
 const p=colorProfile(plan([red,{...blue,r:NaN},{...blue,dimming:0}]));
 assert.equal(p.colors.length,1);assert.equal(p.colors[0].share,1);
});
test('partial final interval is weighted and grouping preserves all shares',()=>{
 const p=colorProfile({...plan([red,blue]),duration:1.5});assert.equal(p.colors[0].share,2/3);
 const varied=colorProfile(plan(Array.from({length:100},(_,i)=>({r:i*2,g:255-i*2,b:i,dimming:80}))));
 assert.ok(varied.colors.length<=6);assert.ok(Math.abs(varied.colors.reduce((s,c)=>s+c.share,0)-1)<1e-9);
});
test('immutable updated plans recalculate profiles while repeat renders reuse them',()=>{
 const a=plan([red]);assert.equal(colorProfile(a),colorProfile(a));
 assert.notDeepEqual(colorProfile(a),colorProfile(plan([blue])));
});
