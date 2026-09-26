import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

const app=await createApp({demo:true,previewPort:0});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
await fetch(base+'/api/discover',{method:'POST',headers:{'Content-Type':'application/json','X-AnyDj-Local':'1'},body:'{}'});

const requests=[];
app.server.on('request',req=>requests.push(req.url));
const profile=await mkdtemp(join(tmpdir(),'wiz-dj-connection-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);
    chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.once('exit',()=>{clearTimeout(timer);reject(Error('Chrome exited'));});
  });
  ws=new WebSocket(endpoint);await once(ws,'open');
  let next=1;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  });
  const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>command(method,params,sessionId);
  await c('Runtime.enable');await c('Page.enable');
  const evaluate=async expression=>{const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+expression);};


  await c('Page.navigate',{url:base+'/surface-check'});await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {createRoomPreview,newRoomPlan}=await import('/dmx-ar-model.js');
    document.body.replaceChildren();
    const scene=document.createElement('div'),controls=document.createElement('div');document.body.append(scene,controls);
    const devices=Array.from({length:4},(_,i)=>({id:'h'+i})),layout={width:8,depth:8,positions:{}};
    const duration=90,plan={duration,sections:[{start:0,end:90,look:'held',intensity:.08}],beatGrid:{downbeats:Array.from({length:49},(_,i)=>i*1.875)},arrangement:{
      times:[],accents:[],blackouts:[{start:36,end:40}],
      drama:{step:1,intensity:Array.from({length:90},(_,i)=>i>=36&&i<40?.01:.08),percussion:Array.from({length:90},(_,i)=>i>=36&&i<40?0:.85),vocalShare:Array(90).fill(.7)},
      patterns:{phrases:[{start:0,end:36},{start:36,end:40},{start:40,end:90}]}
    }};
    let preview=[];
    const heads=createMovingHeads(scene,controls,{getPlans:()=>[plan],getDevices:()=>devices,getLayout:()=>layout,getPreviewEnabled:()=>true,onPreview:p=>preview=p});
    heads.setMood('balanced');
    for(let i=0;i<500&&!document.querySelector('.stage-moving-title').textContent.includes('Choreografie bereit');i++)await new Promise(r=>setTimeout(r,10));
    if(!document.querySelector('.stage-moving-title').textContent.includes('Choreografie bereit'))throw Error('Preparation did not finish');
    const room=newRoomPlan(8,8,4),render=createRoomPreview();
    for(let i=0;i<7;i++)room.positions['r'+i]={type:'moving',x:i-3,y:6,height:2,rotation:0};
    const frame={state:true,r:255,g:100,b:30,dimming:100},fixtures=devices.map(d=>({id:d.id,type:'moving',cells:[[255,100,30]]}));
    const samples=[];
    for(let n=0;n<duration*20;n++){
      const time=n/20;
      heads.update(fixtures,frame,time,false,[{movingPlan:plan,songTime:time,look:'held',frame,weight:1}], 'auto');
      const lights=render({layout,lights:preview.map(l=>({...l,type:'moving'}))},room,false,time).lights;
      if(n%5===0)samples.push({time,lit:lights.filter(l=>l.power>.05).length,power:Math.max(...lights.map(l=>l.power)),targets:lights.map(l=>[l.target.x,l.target.y,l.target.z])});
    }
    const prepared=document.querySelector('.stage-moving-heads').dataset.prepared;
    heads.destroy();return {prepared,samples};
  })()`);
  assert.equal(result.prepared,'true');
  for(const sample of result.samples){
    if(sample.time>2&&(sample.time<35||sample.time>41))assert.ok(sample.power>=.4&&sample.lit>=3,`audible groove at ${sample.time}s remains visible`);
    if(sample.time>=37&&sample.time<40)assert.equal(sample.lit,0,'measured pause remains dark');
  }
  for(const start of [4,16,26,44,60,74]){
    const samples=result.samples.filter(s=>s.time>=start&&s.time<start+8);
    const ranges=Array.from({length:7},(_,i)=>Array.from({length:3},(_,axis)=>Math.max(...samples.map(s=>s.targets[i][axis]))-Math.min(...samples.map(s=>s.targets[i][axis]))));
    assert.ok(ranges.some(r=>Math.hypot(...r)>.2),`visible motor targets keep developing at ${start}s: ${JSON.stringify(ranges)}`);
  }
  assert.deepEqual(errors,[]);
  console.log('Browser: 90 seconds of prepared choreography reach seven room heads; low relative energy, vocals and held labels retain visible movement; measured pause and return pass.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
