import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {BeatAnalysis} from '../lib/beat-analysis.mjs';
import {StyleAnalysis} from '../lib/style-analysis.mjs';
import {StructureAnalysis} from '../lib/structure-analysis.mjs';
import {STYLE_FAMILIES} from '../public/music-style.js';
for(const [name,Service,rate,result] of [
 ['beats',BeatAnalysis,64000,{version:1,source:'beat-this',duration:5,beats:[],downbeats:[]}],
 ['style',StyleAnalysis,64000,{version:1,source:'discogs-effnet',duration:5,segments:[{start:0,end:5,scores:Object.fromEntries(STYLE_FAMILIES.map(name=>[name,.2])),tags:[]}]}],
 ['structure',StructureAnalysis,176400,{version:1,source:'all-in-one',duration:5,segments:[{start:0,end:5,label:'intro'}]}]
])test(`${name}: advancing one day does not cancel inference`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let entered,finish,signal;
 const started=new Promise(r=>entered=r),done=new Promise(r=>finish=r);
 const service=new Service({ready:async()=>{},run:async(_,options)=>{signal=options.signal;entered();await done;return result;}});
 const req=Readable.from([Buffer.alloc(rate*5)]);req.headers={'content-type':'application/octet-stream','x-analysis-budget-ms':'1'};req.complete=true;
 const res=new EventEmitter();res.writableEnded=false;
 const pending=service.handle(req,res);
 await started;t.mock.timers.tick(86400000);
 const aborted=signal.aborted;finish();
 await pending;assert.equal(aborted,false);assert.equal(service.active,null);
});
