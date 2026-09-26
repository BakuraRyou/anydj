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


  await c('Page.navigate',{url:base+'/dj'});await wait("document.readyState==='complete'");
  const result=await evaluate(`(async()=>{
    const {createMovingHeads}=await import('/dmx-moving-heads.js');
    const {applyRoomPlan,newRoomPlan}=await import('/dmx-ar-model.js');
    document.body.replaceChildren();
    const scene=document.createElement('div'),controls=document.createElement('div');document.body.append(scene,controls);
    const devices=Array.from({length:4},(_,i)=>({id:'h'+i,group:i%3}));
    const layout={width:8,depth:8,positions:{}};
    let preview=[];
    const heads=createMovingHeads(scene,controls,{getDevices:()=>devices,getLayout:()=>layout,getPreviewEnabled:()=>true,onPreview:p=>preview=p});
    const plan={duration:30,sections:[{start:0,end:10,look:'flow',intensity:.5},{start:10,end:20,look:'held',intensity:.15},{start:20,end:30,look:'peak',intensity:.9}]};
    plan.beatGrid={downbeats:Array.from({length:16},(_,i)=>i*2)};
    plan.arrangement={patterns:{phrases:plan.sections.map((s,i)=>({...s,section:i,energy:s.intensity,movement:{character:'rhythmic',driving:i===1?.1:.8}}))}};
    const room=newRoomPlan(8,8,4);
    for(let i=6;i>=0;i--)room.positions['r'+i]={type:'moving',x:i-3,y:6,height:2,rotation:0};
    const frame={state:true,r:255,g:80,b:0,dimming:100};
    const own=devices.map(d=>({id:d.id,type:'moving',cells:[[255,80,0]]}));
    const inherited=[{id:'spot',type:'spot',profile:'dimmer-rgb',cells:[[255,80,0]]}];
    const run=(time,fixtures,mode='auto',blackout=false)=>{
      heads.update(fixtures,frame,time,blackout,[{movingPlan:plan,songTime:time,look:time<10?'flow':time<20?'held':'peak',frame,weight:1}],mode);
      const lights=applyRoomPlan({layout,lights:preview.map(l=>({...l,type:'moving'}))},room).lights;
      return {lit:lights.filter(l=>l.power>0).length,powers:lights.map(l=>l.power)};
    };
    const result={own:run(5,own),inherited:run(5,inherited),quiet:run(15,own),quietInherited:run(15,inherited),peak:run(25,own),blackout:run(25,own,'auto',true),manual:run(15,own,'wash')};
    heads.destroy();return result;
  })()`);
  assert.equal(result.own.lit,7);assert.equal(result.inherited.lit,7);
  assert.ok(result.own.powers.every(v=>v>=.45),'supporting gestures remain visible');
  assert.ok(Math.max(...result.own.powers)-Math.min(...result.own.powers)>.15,'leading heads receive distinct emphasis');
  assert.ok(result.quiet.lit>=1&&result.quiet.lit<=2);assert.equal(result.quietInherited.lit,result.quiet.lit);
  assert.equal(result.peak.lit,7);assert.equal(result.blackout.lit,0);assert.equal(result.manual.lit,7);
  assert.deepEqual(errors,[]);
  console.log('Browser: seven room heads keep distinct leading/supporting roles in flow, use a reduced standing image in quiet passages and open on strong peaks; own/inherited colors, blackout and manual mode pass.');
} finally {
  ws?.close();chrome.kill('SIGKILL');app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
