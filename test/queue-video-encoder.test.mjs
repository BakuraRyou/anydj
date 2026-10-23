import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueueVideoEncoder} from '../public/queue-video-encoder.js';
const tick=()=>new Promise(setImmediate);
function harness(){
 let instance;const snapshots=[];
 class Encoder{
  static async isConfigSupported(){return {supported:true};}
  constructor(callbacks){instance=this;this.callbacks=callbacks;}
  configure(config){this.config=config;}
  encode(frame,options){this.lastOptions=options;}
  emit(value){this.callbacks.output({byteLength:1,copyTo:target=>{target[0]=value;}});}
  async flush(){}
  close(){this.closed=true;}
 }
 class Frame{constructor(canvas,options){Object.assign(this,options);snapshots.push(this);}close(){this.closed=true;}}
 return {Encoder,Frame,snapshots,get instance(){return instance;}};
}
const options={width:1920,height:1080,fps:30};
test('direct encoder falls back when codec support is unavailable',async()=>{
 assert.equal(await createQueueVideoEncoder({...options,Encoder:null}),null);
 const h=harness();h.Encoder.isConfigSupported=async()=>({supported:false});
 assert.equal(await createQueueVideoEncoder({...options,...h}),null);
});
test('direct encoder bounds pending frames and preserves chunk order under slow writes',async()=>{
 const h=harness(),sent=[],releases=[];
 const encoder=await createQueueVideoEncoder({...options,Encoder:h.Encoder,Frame:h.Frame,onChunk:data=>{sent.push(data[0]);return new Promise(resolve=>releases.push(resolve));}});
 await encoder.frame({},0);
 let ready=false;const second=encoder.frame({},1).then(()=>{ready=true;});
 await tick();assert.equal(ready,false);
 h.instance.emit(10);h.instance.emit(20);await tick();assert.deepEqual(sent,[10]);
 releases.shift()();await second;await tick();assert.deepEqual(sent,[10,20]);
 releases.shift()();await encoder.finish();
 assert.deepEqual(h.snapshots.map(f=>f.timestamp),[0,33333]);assert.ok(h.snapshots.every(f=>f.closed));
 encoder.destroy();assert.equal(h.instance.closed,true);
});
test('aborting releases a frame waiting for an encoder output',async()=>{
 const h=harness(),controller=new AbortController();
 const encoder=await createQueueVideoEncoder({...options,Encoder:h.Encoder,Frame:h.Frame,onChunk:async()=>{}});
 await encoder.frame({},0,controller.signal);
 const pending=encoder.frame({},1,controller.signal);controller.abort();
 await assert.rejects(pending,{name:'AbortError'});encoder.destroy();
});
test('native write failures propagate instead of leaving the encoder queue blocked',async()=>{
 const h=harness(),failure=Error('encoder stopped');
 const encoder=await createQueueVideoEncoder({...options,Encoder:h.Encoder,Frame:h.Frame,onChunk:async()=>{throw failure;}});
 await encoder.frame({},0);const pending=encoder.frame({},1);h.instance.emit(1);
 await assert.rejects(pending,/encoder stopped/);encoder.destroy();
});
