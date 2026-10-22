import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQuality} from '../public/dmx-stage-desktop.js';
function run(q,{frames=90,interval=1000/12,drawMs=14,continuous=true,pixelRatio=1,start=0}={}){
 for(let i=0;i<frames;i++)q.record(start+i*interval,{drawMs,continuous,pixelRatio});
 return start+frames*interval;
}
test('GPU-bound twelve FPS reduces resolution even when CPU work fits in one frame',()=>{
 const q=createPreviewQuality();run(q);
 assert.equal(q.scale(1),.5);
 assert.ok(q.frameMs>80);
});
test('healthy continuous rendering and sparse idle updates retain full resolution',()=>{
 for(const [continuous,interval] of [[true,1000/60],[false,1000/12],[false,250]]){
  const q=createPreviewQuality();run(q,{continuous,interval,drawMs:4,frames:400});
  assert.equal(q.scale(1),1);
 }
});
test('a tab pause or one slow frame cannot immediately lower quality',()=>{
 const q=createPreviewQuality();run(q,{frames:120,interval:1000/60,drawMs:4});
 q.record(15000,{drawMs:4,continuous:true});
 assert.equal(q.frameMs,0);
 run(q,{frames:20,interval:1000/60,drawMs:4,start:15000});
 assert.equal(q.scale(1),1);
});
test('recovery is slower than reduction and honours device pixel ratio',()=>{
 const q=createPreviewQuality();run(q,{frames:65});assert.equal(q.scale(1),.5);
 const next=run(q,{start:10000,frames:181,interval:1000/60,drawMs:4});assert.equal(q.scale(1),.75);
 run(q,{start:next,frames:180,interval:1000/60,drawMs:4});assert.equal(q.scale(1),1);
 assert.ok(q.scale(2)<=1.5);
});
test('ordinary thirty FPS does not repeatedly reduce resolution',()=>{
 const q=createPreviewQuality();run(q,{interval:1000/30,frames:300});
 assert.equal(q.scale(1),1);
});
